# train_qwen_vl_lora.py
# LoRA finetune for Qwen2.5-VL on processed JSONL (promptgen/layoutgen)
# - 경로 자동 복구: --img_root / --remap_from / --remap_to
# - 안정화: 정확 라벨 마스킹 + AMP(autocast) + GradScaler + Grad Clipping
# - 메모리: 이미지 다운스케일, use_cache=False, gradient checkpointing
# - 장치 이슈 해결: device_map=None (단일 GPU)
# - LoRA: 기본 q/k/v/o 4개 타겟

import os, json, math, random, argparse
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image

import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoModelForVision2Seq,   # v5에서 AutoModelForImageTextToText로 대체 예정(경고 무시 가능)
    AutoProcessor,
    get_linear_schedule_with_warmup
)
from peft import LoraConfig, get_peft_model

# ---------------- Utils ----------------
def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    out = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s: continue
            out.append(json.loads(s))
    return out

def set_seed(seed: int):
    random.seed(seed); torch.manual_seed(seed); torch.cuda.manual_seed_all(seed)

# ---------------- Path Resolver ----------------
class PathResolver:
    """
    이미지 경로를 최대한 복구:
    1) 그대로 존재하면 그대로 사용
    2) remap_from -> remap_to prefix 치환
    3) img_root가 주어지면 basename 일치 파일을 그 아래에서 우선 탐색(얕게)
    """
    def __init__(self, img_root: Optional[str], remap_from: Optional[str], remap_to: Optional[str]):
        self.img_root = Path(img_root) if img_root else None
        self.remap_from = str(remap_from) if remap_from else None
        self.remap_to = str(remap_to) if remap_to else None

    def resolve(self, p: str) -> Optional[str]:
        if not p: 
            return None
        try:
            orig = Path(p)
        except Exception:
            return None

        # 1) 그대로 존재
        if orig.exists():
            return str(orig)

        # 2) remap prefix
        if self.remap_from and self.remap_to:
            s = str(orig)
            if s.lower().startswith(self.remap_from.lower()):
                tail = s[len(self.remap_from):].lstrip("\\/")
                cand = Path(self.remap_to) / tail
                if cand.exists():
                    return str(cand)

        # 3) img_root 아래에서 basename 우선 탐색(동일 파일명 가정)
        if self.img_root is not None:
            name = orig.name
            # 흔한 하위 폴더 후보
            for sub in [Path("."), Path("train"), Path("test"), Path("images"), Path("imgs")]:
                cand = self.img_root / sub / name
                if cand.exists():
                    return str(cand)

        return None

# ---------------- Datasets ----------------
class PromptGenDataset(Dataset):
    """image -> JSON {foreground, background}"""
    def __init__(self, jsonl_path: Path, resolver: PathResolver):
        items = read_jsonl(jsonl_path)
        kept, dropped = 0, 0
        norm_items = []
        for x in items:
            if "image_path" not in x or "output_json" not in x:
                dropped += 1; continue
            newp = resolver.resolve(x["image_path"])
            if newp is None:
                dropped += 1; continue
            x = dict(x)
            x["image_path"] = newp
            norm_items.append(x); kept += 1
        print(f"[PromptGenDataset] file={jsonl_path} kept={kept} dropped={dropped}")
        self.items = norm_items

    def __len__(self): return len(self.items)

    def __getitem__(self, idx):
        ex = self.items[idx]
        img = Image.open(ex["image_path"]).convert("RGB")
        fg = ex["output_json"].get("foreground", "")
        bg = ex["output_json"].get("background", "")
        instruction = (
            "너는 전문 디자이너다. 입력 상품 이미지를 보고 아래 두 가지를 JSON으로 생성하라.\n"
            "1) foreground: 상품의 외형/재질/상세\n"
            "2) background: 상품이 돋보이는 배경(공간/질감/광원/배치 각도 등)\n"
            "### Answer:\n"
        )
        answer_json = json.dumps({"foreground": fg, "background": bg}, ensure_ascii=False)
        text = instruction + answer_json
        return {"image": img, "text": text}

class LayoutGenDataset(Dataset):
    """(image + input_cond) -> label_layout(JSON)"""
    def __init__(self, jsonl_path: Path, resolver: PathResolver):
        items = read_jsonl(jsonl_path)
        kept, dropped = 0, 0
        norm_items = []
        for x in items:
            if "image_path" not in x or "input_cond" not in x or "label_layout" not in x:
                dropped += 1; continue
            newp = resolver.resolve(x["image_path"])
            if newp is None:
                dropped += 1; continue
            x = dict(x)
            x["image_path"] = newp
            norm_items.append(x); kept += 1
        print(f"[LayoutGenDataset] file={jsonl_path} kept={kept} dropped={dropped}")
        self.items = norm_items

    def __len__(self): return len(self.items)

    def __getitem__(self, idx):
        ex = self.items[idx]
        img = Image.open(ex["image_path"]).convert("RGB")
        cond = ex["input_cond"]
        instruction = (
            "입력 이미지와 조건(JSON)을 보고 subject/nongraphic/graphic 전체 레이아웃을 JSON으로 예측하라.\n"
            "조건(JSON):\n" + json.dumps(cond, ensure_ascii=False) + "\n"
            "주의: subject bbox는 [cx,cy,w,h] 정규화, CCLP의 가림 허용/불가 준수.\n"
            "### Answer:\n"
        )
        answer_json = json.dumps(ex["label_layout"], ensure_ascii=False)
        text = instruction + answer_json
        return {"image": img, "text": text}

# ---------------- Collator ----------------
class VLDataCollator:
    """Qwen2.5-VL 전용: chat template + 다운스케일 + 정밀 라벨 마스킹"""
    def __init__(self, processor, max_image_side: int = 448, pad_to_multiple_of=8):
        self.processor = processor
        self.max_image_side = max_image_side
        self.pad_to_multiple_of = pad_to_multiple_of
        self.ANSWER_TAG = "### Answer:\n"

    @staticmethod
    def _resize_max_side(img: Image.Image, max_side: int = 448) -> Image.Image:
        w, h = img.size
        s = max(w, h)
        if s <= max_side:
            return img
        scale = max_side / float(s)
        new = (max(1, int(w * scale)), max(1, int(h * scale)))
        return img.resize(new, Image.BICUBIC)

    def __call__(self, features):
        images = [f["image"] for f in features]
        texts  = [f["text"]  for f in features]
        images = [self._resize_max_side(img, self.max_image_side) for img in images]

        msgs_batch = []
        for t in texts:
            if self.ANSWER_TAG in t:
                user_txt, ans_txt = t.split(self.ANSWER_TAG, 1)
            else:
                user_txt, ans_txt = t, ""

            msgs = [
                {"role": "user", "content": [{"type": "image"}, {"type": "text", "text": user_txt}]},
                {"role": "assistant", "content": [{"type": "text", "text": ans_txt}]}
            ]
            msgs_batch.append(msgs)

        # 전체(prompt+answer) / 유저만(prompt만) 프롬프트를 각각 생성
        prompts_full = [
            self.processor.apply_chat_template(m, tokenize=False, add_generation_prompt=False)
            for m in msgs_batch
        ]
        prompts_user = [
            self.processor.apply_chat_template(m[:-1], tokenize=False, add_generation_prompt=True)
            for m in msgs_batch
        ]

        batch_full = self.processor(text=prompts_full, images=images, padding=True, return_tensors="pt")
        batch_user = self.processor(text=prompts_user, padding=True, return_tensors="pt")

        input_ids = batch_full["input_ids"]
        labels = input_ids.clone()

        pad_id = self.processor.tokenizer.pad_token_id
        user_lens = (batch_user["input_ids"] != pad_id).sum(dim=1)  # 각 샘플의 "유저 토큰 길이"

        # 유저 부분은 -100으로 마스킹 → 어시스턴트 답변만 학습
        for i, L in enumerate(user_lens.tolist()):
            labels[i, :L] = -100

        batch_full["labels"] = labels
        return batch_full

# ---------------- Train Loop ----------------
def train(args):
    set_seed(args.seed)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if args.bf16 and torch.cuda.is_available() else torch.float16

    print(f"[Init] base_model={args.base_model} device={device} dtype={dtype}")

    processor = AutoProcessor.from_pretrained(args.base_model, trust_remote_code=True)

    # 단일 GPU에 모두 올려 meta 장치 문제 제거
    model = AutoModelForVision2Seq.from_pretrained(
        args.base_model,
        dtype=dtype,
        low_cpu_mem_usage=False,   # 메타/지연 로딩 방지
        trust_remote_code=True,
        device_map=None,
    ).to(device)

    # 메모리/안정화
    model.config.use_cache = False
    model.gradient_checkpointing_enable()
    if hasattr(model, "enable_input_require_grads"):
        model.enable_input_require_grads()
    torch.backends.cuda.matmul.allow_tf32 = True

    # 비전 인코더/프로젝터 freeze (텍스트 디코더만 LoRA)
    freeze_keys = ["vision", "visual", "image", "mm_projector", "vision_tower", "visual_encoder", "resampler"]
    for n, p in model.named_parameters():
        if any(k in n.lower() for k in freeze_keys):
            p.requires_grad = False

    # LoRA 설정 (기본: q/k/v/o 4개)
    lora_targets = [t.strip() for t in args.target_modules.split(",")]
    peft_config = LoraConfig(
        r=args.lora_r, lora_alpha=args.lora_alpha, lora_dropout=args.lora_dropout,
        target_modules=lora_targets, bias="none", task_type="CAUSAL_LM"
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()
    model.to(device)

    # 경로 복구기
    resolver = PathResolver(args.img_root, args.remap_from, args.remap_to)

    # 데이터셋
    data_dir = Path(args.data_dir)
    if args.task == "promptgen":
        train_path = data_dir / "train.jsonl"
        dataset = PromptGenDataset(train_path, resolver)
    elif args.task == "layoutgen":
        train_path = data_dir / "train.jsonl"
        dataset = LayoutGenDataset(train_path, resolver)
    else:
        raise ValueError("--task must be one of {promptgen, layoutgen}")

    collator = VLDataCollator(processor, max_image_side=args.max_image_side)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True, num_workers=0, collate_fn=collator)

    # 옵티마이저/스케줄러
    optim = torch.optim.AdamW(model.parameters(), lr=args.lr)
    num_update_steps_per_epoch = math.ceil(len(loader) / args.grad_accum)
    t_total = int(num_update_steps_per_epoch * args.epochs)
    scheduler = get_linear_schedule_with_warmup(
        optim, num_warmup_steps=max(10, int(0.05 * t_total)), num_training_steps=t_total  # 워밍업 5%
    )

    # AMP 스칼러(FP16일 때만)
    use_fp16 = (dtype == torch.float16 and torch.cuda.is_available())
    # 신 API로 변경(경고 제거)
    scaler = torch.amp.GradScaler("cuda", enabled=use_fp16)

    model.train()
    global_step = 0
    os.makedirs(args.output_dir, exist_ok=True)

    for epoch in range(args.epochs):
        for step, batch in enumerate(loader):
            for k in batch:
                if torch.is_tensor(batch[k]):
                    batch[k] = batch[k].to(model.device)

            # AMP autocast
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=use_fp16):
                outputs = model(**batch)
                loss = outputs.loss / args.grad_accum

            # NaN 가드: 비정상 배치는 스킵
            if not torch.isfinite(loss.detach()):
                print(f"[warn] skip non-finite loss at global_step={global_step+1}")
                optim.zero_grad(set_to_none=True)
                continue

            if scaler.is_enabled():
                scaler.scale(loss).backward()
            else:
                loss.backward()

            if (step + 1) % args.grad_accum == 0:
                # 클리핑(수치폭주 방지)
                if scaler.is_enabled():
                    scaler.unscale_(optim)
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

                if scaler.is_enabled():
                    scaler.step(optim)
                    scaler.update()
                else:
                    optim.step()
                scheduler.step()
                optim.zero_grad()
                global_step += 1

                if global_step % 20 == 0:
                    shown = loss.item() * args.grad_accum
                    print(f"[epoch {epoch+1}] step {global_step}/{t_total} loss={shown:.4f}")

        # 에폭마다 저장
        save_dir = os.path.join(args.output_dir, f"epoch_{epoch+1}")
        model.save_pretrained(save_dir)
        processor.save_pretrained(save_dir)
        print(f"[SAVE] {save_dir}")

    # 최종 저장
    model.save_pretrained(args.output_dir)
    processor.save_pretrained(args.output_dir)
    print(f"[DONE] saved to {args.output_dir}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", required=True, choices=["promptgen", "layoutgen"])
    ap.add_argument("--data_dir", required=True)
    ap.add_argument("--output_dir", required=True)
    ap.add_argument("--base_model", default="Qwen/Qwen2.5-VL-3B-Instruct")

    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--lr", type=float, default=5e-6)
    ap.add_argument("--batch_size", type=int, default=1)
    ap.add_argument("--grad_accum", type=int, default=8)

    ap.add_argument("--lora_r", type=int, default=16)
    ap.add_argument("--lora_alpha", type=int, default=32)
    ap.add_argument("--lora_dropout", type=float, default=0.05)
    ap.add_argument("--target_modules", type=str, default="q_proj,k_proj,v_proj,o_proj")  # 기본 4개

    ap.add_argument("--max_image_side", type=int, default=448)  # VRAM 부족 시 384/320으로

    # === 경로 복구 옵션 ===
    ap.add_argument("--img_root", type=str, default=None, help="실제 이미지들이 모여 있는 루트 폴더")
    ap.add_argument("--remap_from", type=str, default=None, help="옛 경로 prefix")
    ap.add_argument("--remap_to", type=str, default=None, help="새 경로 prefix")

    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--bf16", action="store_true")
    args = ap.parse_args()
    train(args)

if __name__ == "__main__":
    main()
