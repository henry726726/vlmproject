# -*- coding: utf-8 -*-
r"""
ab_compare_paid_eval.py  (BASE vs LoRA, PAID-style eval, robust CUDA-safe, HYBRID JSON + PROGRESS LOG)

변경 요약 (터미널 진행 표시):
- tqdm(있으면) 기반 프로그레스 바 + 없으면 프린트 폴백
- 단계별 로그: 환경/장치/이미지 개수/출력 경로/저장 결과
- Pass1(BASE), Pass2(LoRA) 각각 개별 진행률 표시
- 예외/폴백/요약 카운터 출력

기능/출력 구조/사용 예시는 상단 설명 동일
"""

import os, json, glob, csv, argparse, math, traceback, time, re
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple

import numpy as np
from PIL import Image, ImageOps, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True  # 손상 이미지 관대 모드

import torch
from torch.backends.cuda import sdp_kernel
from transformers import AutoProcessor
from transformers import Qwen2_5_VLForConditionalGeneration as QwenVL
from peft import PeftModel, get_peft_model_state_dict
from qwen_vl_utils import process_vision_info

# tqdm 사용 가능 시 프로그레스 바, 아니면 폴백
try:
    from tqdm import tqdm  # type: ignore
except Exception:
    tqdm = None

def _iter_progress(it, desc=""):
    if tqdm is not None:
        return tqdm(it, desc=desc, ncols=100, leave=False)
    # 폴백: tqdm이 없으면 원래 이터레이터 그대로
    return it

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

# ----------------- CUDA 안정화 (모델 로드 전) -----------------
if torch.cuda.is_available():
    # Flash/메모리 효율 경로 끄고 수학 경로로 유도 (문제 shape 회피)
    sdp_kernel(enable_flash=False, enable_mem_efficient=False, enable_math=True)

# ----------------- I/O utils -----------------
def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)

def read_json(p: str) -> dict:
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(p: str, obj: dict) -> None:
    ensure_dir(os.path.dirname(p))
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

# ----------------- geometry ------------------
def clip01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))

def clip_bbox(b):
    x, y, w, h = map(float, b)
    x = clip01(x); y = clip01(y); w = clip01(w); h = clip01(h)
    if x + w > 1: w = max(0.0, 1 - x)
    if y + h > 1: h = max(0.0, 1 - y)
    return [x, y, w, h]

def bbox_from_center_ratio(center, ratio):
    cx, cy = center; rw, rh = ratio
    return clip_bbox([cx - rw/2, cy - rh/2, rw, rh])

def iou_xywh(b1, b2):
    if not b1 or not b2:
        return 0.0
    x1, y1, w1, h1 = b1; x2, y2, w2, h2 = b2
    xa = max(x1, x2); ya = max(y1, y2)
    xb = min(x1 + w1, x2 + w2); yb = min(y1 + h1, y2 + h2)
    inter = max(0.0, xb - xa) * max(0.0, yb - ya)
    a1 = max(0.0, w1 * h1); a2 = max(0.0, w2 * h2)
    u = a1 + a2 - inter
    return inter / u if u > 0 else 0.0

# -------------- image / energy ---------------
def load_gray_for_energy(image_path: str, max_side=1280):
    im = Image.open(image_path)
    im = ImageOps.exif_transpose(im)
    im = im.convert("L")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        im = im.resize((int(w * scale), int(h * scale)), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0

def sobel_energy(gray: np.ndarray):
    Kx = np.array([[1,0,-1],[2,0,-2],[1,0,-1]], dtype=np.float32)
    Ky = np.array([[1,2,1],[0,0,0],[-1,-2,-1]], dtype=np.float32)
    g = np.pad(gray, 1, mode='edge')
    sx = (Kx[0,0]*g[:-2,:-2] + Kx[0,1]*g[:-2,1:-1] + Kx[0,2]*g[:-2,2:] +
          Kx[1,0]*g[1:-1,:-2] + Kx[1,1]*g[1:-1,1:-1] + Kx[1,2]*g[1:-1,2:] +
          Kx[2,0]*g[2:,:-2] + Kx[2,1]*g[2:,1:-1] + Kx[2,2]*g[2:,2:])
    sy = (Ky[0,0]*g[:-2,:-2] + Ky[0,1]*g[:-2,1:-1] + Ky[0,2]*g[:-2,2:] +
          Ky[1,0]*g[1:-1,:-2] + Ky[1,1]*g[1:-1,1:-1] + Ky[1,2]*g[1:-1,2:] +
          Ky[2,0]*g[2:,:-2] + Ky[2,1]*g[2:,1:-1] + Ky[2,2]*g[2:,2:])
    mag = np.sqrt(sx*sx + sy*sy)
    if mag.max() > 0:
        mag = mag / mag.max()
    return mag

def window_energy(energy: np.ndarray, b):
    x, y, w, h = b
    H, W = energy.shape
    x0 = int(round(x * W)); y0 = int(round(y * H))
    x1 = int(round((x + w) * W)); y1 = int(round((y + h) * H))
    x0 = max(0, min(W - 1, x0)); x1 = max(0, min(W, x1))
    y0 = max(0, min(H - 1, y0)); y1 = max(0, min(H, y1))
    if x1 <= x0 or y1 <= y0: return 1.0
    sub = energy[y0:y1, x0:x1]
    return float(sub.mean())

def window_energy_safe(energy, b):
    try:
        return window_energy(energy, b) if b else -1.0
    except Exception:
        return -1.0

def subject_from_energy(energy: np.ndarray, q_low=0.15, q_high=0.85):
    H, W = energy.shape
    yy, xx = np.mgrid[0:H, 0:W]
    w = energy + 1e-6
    w = w / w.sum()
    x_flat = xx.flatten(); y_flat = yy.flatten(); w_flat = w.flatten()
    order_x = np.argsort(x_flat)
    order_y = np.argsort(y_flat)
    cdf_x = np.cumsum(w_flat[order_x])
    cdf_y = np.cumsum(w_flat[order_y])
    x_lo = x_flat[order_x][np.searchsorted(cdf_x, q_low)]
    x_hi = x_flat[order_x][np.searchsorted(cdf_x, q_high)]
    y_lo = y_flat[order_y][np.searchsorted(cdf_y, q_low)]
    y_hi = y_flat[order_y][np.searchsorted(cdf_y, q_high)]
    x = x_lo / W; y = y_lo / H
    w_box = max(2 / W, (x_hi - x_lo) / W)
    h_box = max(2 / H, (y_hi - y_lo) / H)
    return clip_bbox([x, y, w_box, h_box])

# -------------- schema / prompting --------------
SYSTEM = (
    "You are a layout planner for product advertisements.\n"
    "IMPORTANT:\n"
    "- Do NOT transcribe or reuse any existing text or logo in the image (no OCR).\n"
    "- Only propose NEW overlay placements for headline and brand logo.\n"
    "- Also propose optional background_objects (props) that enhance composition while avoiding overlaps.\n"
    "- Return STRICT JSON only. No explanations.\n"
    "All bbox are [x,y,w,h] floats normalized to [0,1].\n"
    "Constraints:\n"
    "- 0.03 <= x,y <= 0.92; 0.05 <= w <= 0.70; 0.06 <= h <= 0.35.\n"
    "- headline: horizontal aspect preferred (w/h >= 1.8), margin-respecting; IoU(headline,subject)<=0.2.\n"
    "- logo: 0.7 <= (w/h) <= 3.0; area<=0.12; margins; avoid overlaps with subject/text.\n"
    "- background_objects: 1–3 items; each has name, style, bbox_hint, depth ('behind_product' preferred), "
    "  avoid_iou_with ('subject,text_boxes,logo_boxes'); keep IoU<0.1 with subject/text/logo and respect margins.\n"
    "- Always include 'background_objects' array (can be empty if none).\n"
)


# 하이브리드 JSON 스키마 (product / background.prompt / layout)
SCHEMA = (
    'Return ONLY the following JSON (no markdown, no commentary):\n'
    '{\n'
    '  "product": {\n'
    '    "type": "Pendant|Ring|Earrings|Necklace|Bracelet|Watch|Accessory",\n'
    '    "material": "Silver|Gold|Rose Gold|Platinum|Stainless Steel|Titanium",\n'
    '    "design": "Flower|Minimal|Vintage|Modern|Geometric|Heart|Cross|Initial",\n'
    '    "features": ["..."]\n'
    '  },\n'
    '  "background": {\n'
    '    "ideal_color": "White|Black|Gray|Cream|Beige",\n'
    '    "texture": "Smooth|Matte|Glossy|Fine Grain|Soft Fabric",\n'
    '    "lighting": { "type": "soft|hard|rim|ambient", "direction": "left|right|front|back|top|bottom" },\n'
    '    "style": "Minimalist|Editorial|Studio|Lifestyle",\n'
    '    "prompt": "(natural English, 120–200 words, include camera & mood & negative space intent)",\n'
    '    "negative_prompt": "blurry|out-of-focus|colorful objects|background cluttered|unfocused details|low resolution|incorrect lighting|unnatural colors|wrong camera angle",\n'
    '    "camera": { "angle": "eye-level|top-down|low-angle|macro|oblique", "distance": "closeup|medium|wide" },\n'
    '    "palette": ["#RRGGBB"]\n'
    '  },\n'
    '  "layout": {\n'
    '    "subject_layout": { "center": [cx, cy], "ratio": [rw, rh] },\n'
    '    "nongraphic_layout": [ { "type": "headline", "content": "", "bbox": [x,y,w,h], "confidence": c } ],\n'
    '    "graphic_layout": [\n'
    '      { "type": "logo", "content": "", "bbox": [x,y,w,h], "confidence": c },\n'
    '      { "type": "underlay", "for": "headline#0", "bbox": [x,y,w,h], "style": { "shape": "rounded|rect|pill", "radius": 0.00, "opacity": 0.00 }, "confidence": c }\n'
    '    ]\n'
    '  },\n'
    '  "background_objects": [\n'
    '    {\n'
    '      "name": "...",\n'
    '      "style": "bokeh|flat|painterly|realistic",\n'
    '      "bbox_hint": [x,y,w,h],\n'
    '      "depth": "behind_product|same_plane|foreground",\n'
    '      "avoid_iou_with": ["subject","text_boxes","logo_boxes"]\n'
    '    }\n'
    '  ]\n'
    '}\n'
)



def safe_pil_rgb(image_path: str) -> Image.Image:
    im = Image.open(image_path)
    im = ImageOps.exif_transpose(im)
    if im.mode != "RGB":
        im = im.convert("RGB")
    return im

# --------- A. 파서 보강: 코드펜스/괄호 밸런싱/트레일링 콤마 보정 ----------
def _balanced_json_block(text: str) -> Optional[str]:
    """```json fences 제거 후, 문자열 내부 따옴표를 고려해 { ... } 균형을 맞춰 블록 추출"""
    if text is None:
        return None
    s = text.strip()
    # 코드펜스 제거
    if s.startswith("```"):
        nl = s.find("\n")
        if nl != -1:
            s = s[nl+1:]
        if s.endswith("```"):
            s = s[:-3]
    # 첫 '{' 위치
    start = s.find("{")
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return s[start:i+1]
    # 닫힘 중괄호가 끝까지 안 나오면 None
    return None

def _json_load_relaxed(s: Optional[str]) -> Optional[dict]:
    """사소한 문법(트레일링 콤마 등) 보정 후 로드 시도"""
    if not s:
        return None
    # 트레일링 콤마 제거
    s = re.sub(r",(\s*[}\]])", r"\1", s)
    try:
        return json.loads(s)
    except Exception:
        return None

def extract_json(text: str) -> dict:
    """강화된 파서: 코드펜스 제거 + 균형 블록 추출 + 보정 로드. 실패 시 raw 보관."""
    block = _balanced_json_block(text)
    data = _json_load_relaxed(block)
    return data if isinstance(data, dict) else {"raw": text}

def apply_chat_and_encode(messages, processor, device):
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(text=[text], images=image_inputs, videos=video_inputs,
                       padding=True, return_tensors="pt")
    return {k: v.to(device) if hasattr(v, "to") else v for k, v in inputs.items()}

def run_qwen(image_path: str, cond: dict, product_name: str,
             model: QwenVL, processor: AutoProcessor,
             max_new_tokens: int = 320, temperature: float = 0.2, top_p: float = 0.8) -> dict:
    pil = safe_pil_rgb(image_path)
    messages = [
        {"role": "system", "content": [{"type": "text", "text": SYSTEM}]},
        {"role": "user", "content": [
            {"type": "image", "image": pil},
            {"type": "text", "text":
                f"[PRODUCT]{product_name or ''}\n"
                f"[COND]{json.dumps(cond, ensure_ascii=False)}\n"
                f"{SCHEMA}"}
        ]}
    ]
    inputs = apply_chat_and_encode(messages, processor, model.device)

    # 토큰 범위/길이 가드
    try:
        ids = inputs["input_ids"].to("cpu")
        vocab = model.get_input_embeddings().num_embeddings
        assert ids.min().item() >= 0 and ids.max().item() < vocab, (
            "token_oob", ids.min().item(), ids.max().item(), vocab
        )
        assert ids.shape[1] <= 8192, ("seq_too_long", ids.shape)
    except Exception as e:
        return {"raw": f"[input_check_failed] {repr(e)}"}

    with torch.no_grad():
        try:
            out_ids = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=(temperature > 0),
                temperature=temperature,
                top_p=top_p
            )
        except RuntimeError as e:
            if "device-side assert" in str(e).lower():
                torch.cuda.empty_cache()
                try:
                    out_ids = model.generate(
                        **inputs,
                        max_new_tokens=min(128, max_new_tokens),
                        do_sample=False, temperature=0.0, top_p=1.0
                    )
                except Exception as e2:
                    return {"raw": f"[retry_failed] {repr(e2)}"}
            else:
                return {"raw": f"[generate_failed] {repr(e)}"}

    out = processor.batch_decode(out_ids[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0]
    return extract_json(out)

# -------------- type aliases & strict pick --------------
TYPE_ALIASES = {
    "headline": {"headline", "title", "tagline", "heading", "main_text", "copy", "text"},
    "logo": {"logo", "brand", "badge", "icon", "mark", "logotype"},
}

def normalize_types(layout: dict) -> dict:
    if not isinstance(layout, dict):
        return {"nongraphic_layout": [], "graphic_layout": []}
    for key in ("nongraphic_layout", "graphic_layout"):
        items = layout.get(key) or []
        for it in items:
            t = (it.get("type") or "").lower()
            if t in TYPE_ALIASES["headline"]:
                it["type"] = "headline"
            elif t in TYPE_ALIASES["logo"]:
                it["type"] = "logo"
    return layout

MIN_W = 0.02
MIN_H = 0.04
MIN_AREA = 1e-3

IGNORE_TYPES = {"underlay", "mask", "guide", "grid", "ruler"}

def pick_first_box_strict(items, want_type, reasons=None, tag=""):
    if not isinstance(items, list):
        return None

    def ok(b):
        x, y, w, h = clip_bbox(b)
        bad = []
        if w < MIN_W: bad.append("w<min")
        if h < MIN_H: bad.append("h<min")
        if (w * h) < MIN_AREA: bad.append("area<min")
        if bad and reasons is not None:
            reasons.append(f"{tag or want_type} rejected {bad} -> bbox={[round(float(z),4) for z in [x,y,w,h]]}")
        return not bad

    # 1순위: 원하는 타입
    for it in items:
        t = (it.get("type") or "").lower()
        if t in IGNORE_TYPES:  # ← 추가
            continue
        if t == want_type and isinstance(it.get("bbox"), list) and len(it["bbox"]) == 4:
            b = clip_bbox(it["bbox"])
            if ok(b): return b

    # 2순위: 타입 섞여 있어도, ignore 타입 제외하고 bbox만 유효한 첫 항목
    for it in items:
        t = (it.get("type") or "").lower()
        if t in IGNORE_TYPES:  # ← 추가
            continue
        if isinstance(it, dict) and isinstance(it.get("bbox"), list) and len(it["bbox"]) == 4:
            b = clip_bbox(it["bbox"])
            if ok(b): return b

    return None


# ----------------- rules & PAID-like scores -----------------
@dataclass
class Rules:
    min_margin: float = 0.03
    min_ar_text: float = 1.6
    max_area_text: float = 0.20
    max_area_logo: float = 0.12
    ar_logo_min: float = 0.7
    ar_logo_max: float = 3.0
    max_iou_subject: float = 0.20
    max_iou_text: float = 0.25
    energy_ok_text: float = 0.35  # 텍스트는 낮은 에너지 영역 선호
    energy_ok_logo: float = 0.55  # 로고는 텍스트보다 다소 자유

def margin_ok(b, m):
    if b is None: return 0
    x, y, w, h = b
    return int(x >= m and y >= m and x + w <= 1 - m and y + h <= 1 - m)

def composite_score(row: dict, rules: Rules) -> float:
    s = 0.0
    # 존재
    s += 1.2 * row["have_headline"] + 1.0 * row["have_logo"]
    # 여백
    s += 0.6 * row["margin_ok_text"] + 0.4 * row["margin_ok_logo"]
    # AR 보상
    if row["ar_text"] > 0: s += 0.5 * min(row["ar_text"] / 3.0, 1.0)
    if row["ar_logo"] > 0 and rules.ar_logo_min <= row["ar_logo"] <= rules.ar_logo_max: s += 0.3
    # 면적 sweet spot
    if 0.04 <= row["area_text"] <= 0.12: s += 0.4
    if 0.015 <= row["area_logo"] <= 0.06: s += 0.25
    # 겹침 패널티
    s -= 0.7 * row["iou_subject_text"]
    s -= 0.5 * row["iou_subject_logo"]
    s -= 0.2 * row["iou_text_logo"]
    # 에너지/네거티브 스페이스 (낮을수록 가산)
    if row["energy_text"] >= 0: s += 0.6 * max(0.0, (rules.energy_ok_text - row["energy_text"]))
    if row["energy_logo"] >= 0: s += 0.2 * max(0.0, (rules.energy_ok_logo - row["energy_logo"]))
    # 프롬프트 길이 (배경 프롬프트 길이에 보너스)
    if row.get("prompt_len", 0) > 0:
        if 120 <= row["prompt_len"] <= 1200: s += 0.3
        elif row["prompt_len"] < 60: s -= 0.1
    return float(round(s, 4))

# ----------------- evaluation -----------------
def eval_one(image_path: str, pred: dict, rules: Rules, reason_dir: str = None) -> dict:
    gray = load_gray_for_energy(image_path)
    energy = sobel_energy(gray)

    # subject bbox: prefer model, else visual estimate
    try:
        subj = (pred.get("layout") or {}).get("subject_layout") or {}
        subject = bbox_from_center_ratio(subj.get("center", [0.5, 0.5]), subj.get("ratio", [0.3, 0.3]))
    except Exception:
        subject = None
    if subject is None:
        subject = subject_from_energy(energy)

    layout = normalize_types(pred.get("layout") or {})
    texts = layout.get("nongraphic_layout", []) or []
    graphics = layout.get("graphic_layout", []) or []
    reasons = []
    head = pick_first_box_strict(texts, "headline", reasons=reasons, tag="headline")
    logo = pick_first_box_strict(graphics, "logo", reasons=reasons, tag="logo")

    # reason 로그
    if reason_dir:
        ensure_dir(reason_dir)
        base = os.path.splitext(os.path.basename(image_path))[0]
        if reasons:
            with open(os.path.join(reason_dir, f"{base}.txt"), "w", encoding="utf-8") as f:
                f.write("\n".join(reasons))

    def _ar(b):
        if not b: return 0.0
        w, h = b[2], b[3]
        return (w / h) if h > 0 else 0.0

    def _area(b):
        return (b[2] * b[3]) if b else 0.0

    row = {
        "json_ok": int("layout" in pred),
        "have_headline": int(head is not None),
        "have_logo": int(logo is not None),
        "margin_ok_text": margin_ok(head, rules.min_margin),
        "margin_ok_logo": margin_ok(logo, rules.min_margin),
        "ar_text": round(_ar(head), 4),
        "ar_logo": round(_ar(logo), 4),
        "area_text": round(_area(head), 6),
        "area_logo": round(_area(logo), 6),
        "iou_subject_text": round(iou_xywh(head, subject), 4) if head else 0.0,
        "iou_subject_logo": round(iou_xywh(logo, subject), 4) if logo else 0.0,
        "iou_text_logo": round(iou_xywh(head, logo), 4) if head and logo else 0.0,
        "energy_text": -1.0, "energy_logo": -1.0,
        "negspace_compliance": 0.0,  # 간단한 합격/불합격
        "num_head_boxes": len([it for it in texts if isinstance(it, dict) and it.get("bbox")]),
        "num_logo_boxes": len([it for it in graphics if isinstance(it, dict) and it.get("bbox")]),
        "prompt_len": 0,
    }

    e_t = window_energy_safe(energy, head)
    e_g = window_energy_safe(energy, logo)
    row["energy_text"] = round(e_t, 4) if e_t >= 0 else -1.0
    row["energy_logo"] = round(e_g, 4) if e_g >= 0 else -1.0
    # 간이 네거티브 스페이스 판정
    row["negspace_compliance"] = float(int((e_t >= 0 and e_t <= 0.35) and row["iou_subject_text"] <= 0.2))

    # 프롬프트 길이(배경 프롬프트 기준)
    try:
        bg = (pred.get("background") or {})
        hl = (bg.get("prompt") or "").strip()
        row["prompt_len"] = len(hl)
    except Exception:
        row["prompt_len"] = 0

    row["composite_score"] = composite_score(row, rules)
    return row

# ----------------- LoRA loader (NO offload) -----------------
def load_lora_model_no_offload(base_model_id: str, lora_dir: str, dtype, device: str):
    import os
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    # offload 폴더 준비 (모델 일부를 자동으로 CPU/RAM에 둠)
    offload_dir = os.path.join(os.getcwd(), "_offload")
    ensure_dir(offload_dir)

    # 핵심: device_map="auto" + low_cpu_mem_usage + offload_folder
    base = QwenVL.from_pretrained(
        base_model_id,
        dtype=dtype,
        device_map="auto",                 # ← GPU 용량에 맞춰 자동 분산
        low_cpu_mem_usage=True,
        attn_implementation="eager",
        offload_folder=offload_dir         # ← 부족분은 여기로 오프로딩
    ).eval()

    lora = PeftModel.from_pretrained(base, lora_dir).eval()
    lora = lora  # (그대로 반환; .to(device) 불필요—auto가 처리)
    return lora


# ----------------- Summary -----------------
def print_eval_summary(rows: list):
    import numpy as _np
    def model_rows(m): return [r for r in rows if r.get("model")==m]
    def rates(rs):
        N = len(rs)
        both = sum(1 for r in rs if r["have_headline"]==1 and r["have_logo"]==1)
        anyv = sum(1 for r in rs if r["have_headline"]==1 or r["have_logo"]==1)
        valid_only = [r for r in rs if (r["have_headline"]==1 or r["have_logo"]==1)]
        comp_all = round(float(_np.mean([r["composite_score"] for r in rs])), 4) if rs else 0.0
        comp_valid = round(float(_np.mean([r["composite_score"] for r in valid_only])), 4) if valid_only else 0.0
        return {"N":N, "both_rate":round(both/N,4) if N else 0.0,
                "any_rate":round(anyv/N,4) if N else 0.0,
                "comp_all":comp_all, "comp_valid":comp_valid}
    def pairwise_wins():
        imgs = sorted(set(r["image"] for r in rows))
        b=l=t=0
        for im in imgs:
            rb = next((r for r in rows if r["image"]==im and r["model"]=="base"), None)
            rl = next((r for r in rows if r["image"]==im and r["model"]=="lora"), None)
            if not rb or not rl: continue
            if rb["composite_score"] > rl["composite_score"]: b+=1
            elif rb["composite_score"] < rl["composite_score"]: l+=1
            else: t+=1
        return b,l,t
    base_s = rates(model_rows("base"))
    lora_s = rates(model_rows("lora"))
    wb, wl, wt = pairwise_wins()
    print("\n=== SUMMARY (A/B/C 지표) ===")
    print("A) both_valid_rate  = 헤드라인+로고 모두 존재 비율")
    print("B) any_valid_rate   = 헤드라인 또는 로고 중 하나라도 존재 비율")
    print("C) comp_valid_mean  = 유효 샘플에서의 composite 평균")
    print("\n[BASE]", base_s, "\n[LORA]", lora_s)
    print(f"Wins — base:{wb}  lora:{wl}  ties:{wt}")

# ----------------- 최소 하이브리드 외형 보정 -----------------
def _ensure_hybrid_shape(d: dict) -> dict:
    if not isinstance(d, dict):
        return {
            "product": {"type":"", "material":"", "design":"", "features":[]},
            "background": {
                "ideal_color":"", "texture":"", "style":"",
                "prompt":"", "negative_prompt":"",
                "camera":{}, "lighting":{}, "palette":[]
            },
            "layout": {
                "subject_layout":{"center":[0.5,0.5],"ratio":[0.3,0.3]},
                "nongraphic_layout":[], "graphic_layout":[]
            },
            "background_objects":[]
        }
    d.setdefault("product", {}).setdefault("features", [])
    bg = d.setdefault("background", {})
    bg.setdefault("ideal_color",""); bg.setdefault("texture",""); bg.setdefault("style","")
    bg.setdefault("prompt",""); bg.setdefault("negative_prompt","")
    bg.setdefault("camera", {}); bg.setdefault("lighting", {}); bg.setdefault("palette", [])
    lay = d.setdefault("layout", {})
    lay.setdefault("subject_layout", {"center":[0.5,0.5], "ratio":[0.3,0.3]})
    lay.setdefault("nongraphic_layout", [])
    lay.setdefault("graphic_layout", [])
    d.setdefault("background_objects", [])
    return d


# ----------------- main -----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True, help=r"Glob(s) e.g. .\data\ori_imgs\test1\*.jpg or '*.png;*.jpg'")
    ap.add_argument("--base_model", default="Qwen/Qwen2.5-VL-3B-Instruct")
    ap.add_argument("--lora_dir", required=True)
    ap.add_argument("--cond_json", default=None)
    ap.add_argument("--product_name", default="")
    ap.add_argument("--out_dir", default="./_cmp_out")
    ap.add_argument("--max_new_tokens", type=int, default=320)
    ap.add_argument("--temperature", type=float, default=0.2)
    ap.add_argument("--top_p", type=float, default=0.8)
    ap.add_argument("--use_fallback", action="store_true",
                    help="(선택) 최소 보정 상자 추가. 공정 비교를 위해 기본은 끔.")
    ap.add_argument("--force_cpu", action="store_true", help="(선택) CPU 강제 (디버그용)")
    args = ap.parse_args()

    # 시작 로그
    log("=== AB Compare (HYBRID JSON) ===")
    log(f"base_model = {args.base_model}")
    log(f"lora_dir   = {args.lora_dir}")
    log(f"out_dir    = {args.out_dir}")
    log(f"gen params = max_new_tokens:{args.max_new_tokens}, temp:{args.temperature}, top_p:{args.top_p}")

    ensure_dir(args.out_dir)
    out_json_base = os.path.join(args.out_dir, "json", "base"); ensure_dir(out_json_base)
    out_json_lora = os.path.join(args.out_dir, "json", "lora"); ensure_dir(out_json_lora)

    cond = {}
    if args.cond_json and os.path.exists(args.cond_json):
        cond_raw = read_json(args.cond_json)
        cond = cond_raw.get("input_cond", cond_raw)
        log(f"cond_json loaded: {args.cond_json}")

    # images: 세미콜론으로 여러 패턴 지원
    patterns = [p.strip() for p in args.images.split(";")]
    images = []
    for pat in patterns:
        images.extend(glob.glob(pat))
    images = sorted(set(images))
    assert images, f"No images matched: {args.images}. Tip: wrap the glob in quotes."
    log(f"images matched: {len(images)} file(s)")

    # device / dtype
    if args.force_cpu:
        device = "cpu"
    else:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    else:
        dtype = torch.float32
    log(f"device = {device}, dtype = {dtype}")

    # processor (use_fast=False for stability)
    processor = AutoProcessor.from_pretrained(args.base_model, use_fast=False)
    rules = Rules()
    rows = []

    # 진행 통계
    stats = {
        "base": {"ok":0, "raw":0, "saved":0},
        "lora": {"ok":0, "raw":0, "saved":0}
    }

    # ------------------ PASS 1: BASE ------------------
    log("[Pass 1/2] Loading BASE model ...")
    t0 = time.time()
    base = QwenVL.from_pretrained(
        args.base_model, dtype=dtype,
        device_map=("auto" if device=="cuda" else None),
        attn_implementation="eager"
    ).eval()
    if device == "cpu":
        base.to("cpu")
    log(f"[Pass 1/2] Model ready in {time.time()-t0:.2f}s")

    for img in _iter_progress(images, desc="BASE"):
        try:
            pred_b = run_qwen(img, cond, args.product_name, base, processor,
                              args.max_new_tokens, args.temperature, args.top_p)

            # fallback(선택) — 레이아웃 박스만 보정. 하이브리드 외형은 아래에서 보장.
            if args.use_fallback and isinstance(pred_b, dict) and "layout" in pred_b:
                lay = pred_b["layout"]
                if not lay.get("nongraphic_layout"): lay["nongraphic_layout"] = []
                if not lay.get("graphic_layout"): lay["graphic_layout"] = []
                if not any((it.get("type")=="headline") for it in lay["nongraphic_layout"]):
                    lay["nongraphic_layout"].append({"type": "headline", "content": "", "bbox": [0.06, 0.78, 0.78, 0.16], "confidence": 0.55})
                if not any((it.get("type")=="logo") for it in lay["graphic_layout"]):
                    lay["graphic_layout"].append({"type": "logo", "content": "", "bbox": [0.06, 0.08, 0.22, 0.09], "confidence": 0.55})

            pred_b = _ensure_hybrid_shape(pred_b)
            outp = os.path.join(out_json_base, os.path.basename(img) + ".base.json")
            write_json(outp, pred_b)
            stats["base"]["saved"] += 1

            m_b = eval_one(img, pred_b, rules, reason_dir=os.path.join(args.out_dir, "reasons", "base"))
            m_b["image"] = os.path.basename(img); m_b["model"] = "base"

            # CSV 컬럼 매핑: background.prompt -> background_prompt
            try:
                bg = (pred_b.get("background") or {})
                m_b["headline_suggestion"] = ""  # 하이브리드에선 빈 값
                m_b["background_prompt"]   = (bg.get("prompt")
                                               or (bg.get("background_prompt") if isinstance(bg.get("background_prompt"), str) else "")
                                               or "").replace("\n", " ").strip()
            except Exception:
                m_b["headline_suggestion"] = ""
                m_b["background_prompt"] = ""

            rows.append(m_b)
            # 상태 카운트
            if "raw" in pred_b:
                stats["base"]["raw"] += 1
            else:
                stats["base"]["ok"]  += 1
        except Exception as e:
            log(f"[BASE][ERR] {os.path.basename(img)}: {repr(e)}")
            # 계속 진행

    # Release BASE
    del base
    if device == "cuda":
        torch.cuda.empty_cache()
    log(f"[Pass 1/2] Done. ok:{stats['base']['ok']} raw:{stats['base']['raw']} saved:{stats['base']['saved']}")

    # ------------------ PASS 2: LoRA ------------------
    log("[Pass 2/2] Loading LoRA model ...")
    t1 = time.time()
    lora = load_lora_model_no_offload(args.base_model, args.lora_dir, dtype, device)
    log(f"[Pass 2/2] Model ready in {time.time()-t1:.2f}s")

    for img in _iter_progress(images, desc="LoRA"):
        try:
            pred_l = run_qwen(img, cond, args.product_name, lora, processor,
                              args.max_new_tokens, args.temperature, args.top_p)

            if args.use_fallback and isinstance(pred_l, dict) and "layout" in pred_l:
                lay = pred_l["layout"]
                if not lay.get("nongraphic_layout"): lay["nongraphic_layout"] = []
                if not lay.get("graphic_layout"): lay["graphic_layout"] = []
                if not any((it.get("type")=="headline") for it in lay["nongraphic_layout"]):
                    lay["nongraphic_layout"].append({"type": "headline", "content": "", "bbox": [0.06, 0.78, 0.78, 0.16], "confidence": 0.55})
                if not any((it.get("type")=="logo") for it in lay["graphic_layout"]):
                    lay["graphic_layout"].append({"type": "logo", "content": "", "bbox": [0.06, 0.08, 0.22, 0.09], "confidence": 0.55})

            pred_l = _ensure_hybrid_shape(pred_l)
            outp = os.path.join(out_json_lora, os.path.basename(img) + ".lora.json")
            write_json(outp, pred_l)
            stats["lora"]["saved"] += 1

            m_l = eval_one(img, pred_l, rules, reason_dir=os.path.join(args.out_dir, "reasons", "lora"))
            m_l["image"] = os.path.basename(img); m_l["model"] = "lora"

            try:
                bg = (pred_l.get("background") or {})
                m_l["headline_suggestion"] = ""
                m_l["background_prompt"]   = (bg.get("prompt")
                                               or (bg.get("background_prompt") if isinstance(bg.get("background_prompt"), str) else "")
                                               or "").replace("\n", " ").strip()
            except Exception:
                m_l["headline_suggestion"] = ""
                m_l["background_prompt"] = ""

            rows.append(m_l)
            if "raw" in pred_l:
                stats["lora"]["raw"] += 1
            else:
                stats["lora"]["ok"]  += 1
        except Exception as e:
            log(f"[LORA][ERR] {os.path.basename(img)}: {repr(e)}")

    # Release LoRA
    del lora
    if device == "cuda":
        torch.cuda.empty_cache()
    log(f"[Pass 2/2] Done. ok:{stats['lora']['ok']} raw:{stats['lora']['raw']} saved:{stats['lora']['saved']}")

    # ------------------ Save CSV & Aggregate ------------------
    csv_path = os.path.join(args.out_dir, "compare_report.csv")
    fields = [
        "image","model","json_ok","have_headline","have_logo",
        "num_head_boxes","num_logo_boxes",
        "margin_ok_text","margin_ok_logo","ar_text","ar_logo",
        "area_text","area_logo",
        "iou_subject_text","iou_subject_logo","iou_text_logo",
        "energy_text","energy_logo","negspace_compliance",
        "prompt_len","composite_score",
        "headline_suggestion","background_prompt",
    ]
    ensure_dir(args.out_dir)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})
    log(f"[CSV] wrote: {csv_path}")

    # aggregate means
    def agg(model_name: str):
        sub = [r for r in rows if r["model"] == model_name]
        if not sub: return {}
        out = {}
        for k in fields:
            if k in ("image","model","headline_suggestion","background_prompt"): continue
            vals = [r[k] for r in sub if isinstance(r.get(k), (int, float, float))]
            if vals:
                out[k] = round(float(np.mean(vals)), 4)
        out["count"] = len(sub)
        return out

    agg_base = agg("base")
    agg_lora = agg("lora")

    # wins by composite score
    wins_base = wins_lora = ties = 0
    for img in sorted(set(r["image"] for r in rows)):
        b = next((r for r in rows if r["image"] == img and r["model"] == "base"), None)
        l = next((r for r in rows if r["image"] == img and r["model"] == "lora"), None)
        if not b or not l: continue
        if b["composite_score"] > l["composite_score"]: wins_base += 1
        elif b["composite_score"] < l["composite_score"]: wins_lora += 1
        else: ties += 1

    ag = {
        "params": {
            "images": args.images, "base_model": args.base_model, "lora_dir": args.lora_dir,
            "max_new_tokens": args.max_new_tokens, "temperature": args.temperature, "top_p": args.top_p,
            "device": device, "dtype": str(dtype)
        },
        "base_mean": agg_base,
        "lora_mean": agg_lora,
        "wins": {"base": wins_base, "lora": wins_lora, "ties": ties},
        "stats": stats
    }
    agg_path = os.path.join(args.out_dir, "aggregate.json")
    write_json(agg_path, ag)
    log(f"[AGG] wrote: {agg_path}")

    print("\n=== Aggregate (mean) ===")
    print("[BASE]", agg_base)
    print("[LORA]", agg_lora)
    print(f"Wins — base:{wins_base}  lora:{wins_lora}  ties:{ties}")
    print(f"[OK] wrote CSV: {csv_path}")
    print_eval_summary(rows)
    log("All done ✅")

if __name__ == "__main__":
    # 선택: 연산 정밀도 힌트
    # torch.backends.cuda.matmul.allow_tf32 = True
    # torch.set_float32_matmul_precision("high")
    main()
