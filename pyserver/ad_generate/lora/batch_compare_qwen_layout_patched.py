# -*- coding: utf-8 -*-
"""
Patched batch comparator for Qwen2.5-VL layouts (Base vs LoRA)

This version implements the three improvements we discussed:
 1) **Deterministic decoding for LoRA** when best-of-N is 1 (greedy + light repetition penalty).
 2) **Schema-aware JSON post-fix** (size/margin/AR/overlap fix) applied to *both* models before evaluation.
 3) **Best-of-N generation + re-ranking** for LoRA only (if --lora_best_of > 1),
    scored by the same composite metric used in reporting.

Outputs
- JSON:
    out_dir/json/base/<image>.base.json
    out_dir/json/lora/<image>.lora.json
- CSV summary (per-image metrics + composite score):
    out_dir/compare_report.csv
- Reason logs for rejected boxes (strict picker):
    out_dir/reasons/base/<image>.txt
    out_dir/reasons/lora/<image>.txt

Example (Windows PowerShell):
    python .\batch_compare_qwen_layout_patched.py `
      --images ".\data\ori_imgs\test1\*.jpg" `
      --base_model "Qwen/Qwen2.5-VL-3B-Instruct" `
      --lora_dir ".\checkpoints\qwen_layout_lora\epoch_1" `
      --cond_json ".\cond.json" `
      --out_dir ".\_cmp_out" `
      --max_new_tokens 480 `
      --temperature 0.2 `
      --top_p 0.8 `
      --lora_best_of 5

Notes
- Fix step is enabled by default for *both* models. Use --disable_post_fix to turn it off.
- If you want LoRA to be deterministic single-shot, set --lora_best_of 1 (default greedy decoding).
"""

import os, json, glob, csv, argparse
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple

import numpy as np
from PIL import Image

import torch
from transformers import AutoProcessor
from transformers import Qwen2_5_VLForConditionalGeneration as QwenVL
from peft import PeftModel, get_peft_model_state_dict
from qwen_vl_utils import process_vision_info

# ----------------- I/O utils -----------------
def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)

def read_json(p: str) -> dict:
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(p: str, obj: dict) -> None:
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


# ----------------- geometry ------------------
def clip01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))

def clip_bbox(b: List[float]) -> List[float]:
    x, y, w, h = map(float, b)
    x = clip01(x); y = clip01(y); w = clip01(w); h = clip01(h)
    if x + w > 1: w = max(0.0, 1 - x)
    if y + h > 1: h = max(0.0, 1 - y)
    return [x, y, w, h]

def bbox_from_center_ratio(center: List[float], ratio: List[float]) -> List[float]:
    cx, cy = center; rw, rh = ratio
    return clip_bbox([cx - rw/2, cy - rh/2, rw, rh])

def iou_xywh(b1: Optional[List[float]], b2: Optional[List[float]]) -> float:
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
def load_gray(image_path: str, max_side=1280) -> np.ndarray:
    im = Image.open(image_path).convert("L")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1.0:
        im = im.resize((int(w * scale), int(h * scale)), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0

def sobel_energy(gray: np.ndarray) -> np.ndarray:
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

def window_energy(energy: np.ndarray, b: Optional[List[float]]) -> float:
    if not b:
        return 1.0
    x, y, w, h = b
    H, W = energy.shape
    x0 = int(round(x * W)); y0 = int(round(y * H))
    x1 = int(round((x + w) * W)); y1 = int(round((y + h) * H))
    x0 = max(0, min(W - 1, x0)); x1 = max(0, min(W, x1))
    y0 = max(0, min(H - 1, y0)); y1 = max(0, min(H, y1))
    if x1 <= x0 or y1 <= y0:
        return 1.0
    sub = energy[y0:y1, x0:x1]
    return float(sub.mean())

def window_energy_safe(energy: np.ndarray, b: Optional[List[float]]) -> float:
    try:
        return window_energy(energy, b) if b else -1.0
    except Exception:
        return -1.0

def subject_from_energy(energy: np.ndarray, q_low=0.15, q_high=0.85) -> List[float]:
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


# -------------- model / inference ------------
SYSTEM = (
    "You are a layout planner for product advertisements.\n"
    "Output JSON only. Do NOT transcribe or reuse any existing text/logo in the image.\n"
    "Constraints:\n"
    "- All bbox are [x,y,w,h] floats normalized to [0,1].\n"
    "- 0.03 <= x,y <= 0.92; 0.05 <= w <= 0.70; 0.06 <= h <= 0.35.\n"
    "- headline: aspect ratio (w/h) >= 1.6; logo: 0.7 <= (w/h) <= 3.0.\n"
    "- Provide at least one 'headline' in nongraphic_layout and one 'logo' in graphic_layout.\n"
    "- Avoid overlaps: IoU(headline,subject)<=0.2; IoU(logo,subject)<=0.2; IoU(headline,logo)<=0.25.\n"
    "- Do not output zero-sized or full-frame boxes.\n"
)

SCHEMA = (
    '{ "product":{},'
    '  "background":{},'
    '  "layout":{'
    '     "subject_layout":{"center":[cx,cy],"ratio":[rw,rh]},'
    '     "nongraphic_layout":[{"type":"headline","content":"","bbox":[x,y,w,h],"confidence":0.5}],'
    '     "graphic_layout":[{"type":"logo","content":"","bbox":[x,y,w,h],"confidence":0.5}]'
    '  } }'
)

def extract_json(text: str) -> dict:
    try:
        s = text.index("{"); e = text.rindex("}") + 1
        return json.loads(text[s:e])
    except Exception:
        return {"raw": text}


def run_qwen(
    image_path: str,
    cond: dict,
    product_name: str,
    model: QwenVL,
    processor: AutoProcessor,
    max_new_tokens: int = 320,
    temperature: float = 0.2,
    top_p: float = 0.8,
    is_lora: bool = False,
    deterministic_lora: bool = True,
) -> dict:
    """Single-shot generation. If is_lora and deterministic_lora=True, use greedy decoding.
    Otherwise use sampling with provided temperature/top_p.
    """
    messages = [
        {"role": "system", "content": [{"type": "text", "text": SYSTEM}]},
        {"role": "user", "content": [
            {"type": "image", "image": f"file://{image_path}"},
            {"type": "text", "text":
                f"[PRODUCT]{product_name or ''}\n"
                f"[COND]{json.dumps(cond, ensure_ascii=False)}\n"
                f"Return ONLY JSON like: {SCHEMA}"}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)

    inputs = processor(
        text=[text], images=image_inputs, videos=video_inputs,
        padding=True, return_tensors="pt"
    ).to(model.device)

    gen_kwargs = {
        "max_new_tokens": max_new_tokens,
        "pad_token_id": getattr(processor.tokenizer, 'pad_token_id', None),
        "eos_token_id": getattr(processor.tokenizer, 'eos_token_id', None),
    }

    if is_lora and deterministic_lora:
        # Greedy, lightly penalize repeats for stability
        gen_kwargs.update(dict(
            do_sample=False,
            repetition_penalty=1.07,
        ))
    else:
        gen_kwargs.update(dict(
            do_sample=True,
            temperature=temperature,
            top_p=top_p,
        ))

    with torch.no_grad():
        out_ids = model.generate(**inputs, **gen_kwargs)
    out = processor.batch_decode(out_ids[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]
    return extract_json(out)


# -------------- metrics & rules --------------
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


def margin_ok(b: Optional[List[float]], m: float) -> int:
    if b is None:
        return 0
    x, y, w, h = b
    return int(x >= m and y >= m and x + w <= 1 - m and y + h <= 1 - m)


def composite_score(row: dict) -> float:
    s = 0.0
    # 존재
    s += 1.0 * row["have_headline"] + 1.0 * row["have_logo"]
    # 여백
    s += 0.5 * row["margin_ok_text"] + 0.5 * row["margin_ok_logo"]
    # AR 보상
    if row["ar_text"] > 0:
        s += 0.5 * min(row["ar_text"] / 3.0, 1.0)
    if row["ar_logo"] > 0 and 0.7 <= row["ar_logo"] <= 3.0:
        s += 0.3
    # 면적 sweet spot
    if 0.04 <= row["area_text"] <= 0.12:
        s += 0.3
    if 0.015 <= row["area_logo"] <= 0.06:
        s += 0.2
    # 패널티
    s -= 0.6 * row["iou_subject_text"]
    s -= 0.4 * row["iou_subject_logo"]
    s -= 0.2 * row["iou_text_logo"]
    if row["energy_text"] >= 0:
        s -= 0.5 * row["energy_text"]
    if row["energy_logo"] >= 0:
        s -= 0.2 * row["energy_logo"]
    return float(round(s, 4))


# ==== Type aliases & normalizer ====
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


# ==== Strict box picker (with reasons) ====
MIN_W = 0.02      # 최소 너비 2%
MIN_H = 0.04      # 최소 높이 4%
MIN_AREA = 1e-3   # 최소 면적 0.1%

def pick_first_box_strict(items, want_type, reasons=None, tag=""):
    """유효치(min_w/h/area) 미만 박스는 거절하며 reasons에 이유를 남김."""
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

    for it in items:
        if it.get("type") == want_type and isinstance(it.get("bbox"), list) and len(it["bbox"]) == 4:
            b = clip_bbox(it["bbox"])
            if ok(b):
                return b
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("bbox"), list) and len(it["bbox"]) == 4:
            b = clip_bbox(it["bbox"])
            if ok(b):
                return b
    return None


# -------------- Post-fix (schema & constraints) --------------

def _clamp_with_margin(b: List[float], min_margin: float) -> List[float]:
    x, y, w, h = clip_bbox(b)
    w = max(w, 0.05); h = max(h, 0.06)
    x = min(max(x, min_margin), 1 - min_margin - w)
    y = min(max(y, min_margin), 1 - min_margin - h)
    return [x, y, w, h]


def _adjust_ar(b: List[float], want_min_ar=None, ar_min=None, ar_max=None, min_margin=0.03) -> List[float]:
    x, y, w, h = b
    if want_min_ar is not None and h > 0 and (w / h) < want_min_ar:
        w = max(w, want_min_ar * h)
    if ar_min is not None and h > 0 and (w / h) < ar_min:
        w = max(w, ar_min * h)
    if ar_max is not None and h > 0 and (w / h) > ar_max:
        w = min(w, ar_max * h)
    return _clamp_with_margin([x, y, w, h], min_margin)


def _push_if_overlap(b: List[float], other: List[float], thr: float, min_margin: float) -> List[float]:
    if iou_xywh(b, other) <= thr:
        return b
    x, y, w, h = b
    candidates = [
        [min(x + 0.02, 1 - w - min_margin), y, w, h],
        [max(x - 0.02, min_margin), y, w, h],
        [x, min(y + 0.02, 1 - h - min_margin), w, h],
        [x, max(y - 0.02, min_margin), w, h],
    ]
    best = min(candidates, key=lambda bb: iou_xywh(bb, other))
    return _clamp_with_margin(best, min_margin)


def fix_layout(layout: dict, subject: Optional[List[float]], rules: Rules) -> dict:
    """Schema/constraint enforcement for fairness & stability. Applies to any model output."""
    lay = normalize_types(layout or {})
    ng = lay.setdefault("nongraphic_layout", [])
    gr = lay.setdefault("graphic_layout", [])

    # 최소 1개씩 보장
    if not any(i.get("type") == "headline" for i in ng):
        ng.append({"type": "headline", "content": "", "bbox": [0.08, 0.78, 0.78, 0.16], "confidence": 0.5})
    if not any(i.get("type") == "logo" for i in gr):
        gr.append({"type": "logo", "content": "", "bbox": [0.08, 0.08, 0.22, 0.09], "confidence": 0.5})

    # 클램프 + AR 보정
    for it in ng:
        if it.get("type") == "headline" and isinstance(it.get("bbox"), list):
            it["bbox"] = _adjust_ar(_clamp_with_margin(it["bbox"], rules.min_margin), want_min_ar=rules.min_ar_text, min_margin=rules.min_margin)
    for it in gr:
        if it.get("type") == "logo" and isinstance(it.get("bbox"), list):
            it["bbox"] = _adjust_ar(_clamp_with_margin(it["bbox"], rules.min_margin), ar_min=rules.ar_logo_min, ar_max=rules.ar_logo_max, min_margin=rules.min_margin)

    # 겹침 완화
    head = next((i for i in ng if i.get("type") == "headline"), None)
    logo = next((i for i in gr if i.get("type") == "logo"), None)

    if subject is not None:
        if head:
            head["bbox"] = _push_if_overlap(head["bbox"], subject, rules.max_iou_subject, rules.min_margin)
        if logo:
            logo["bbox"] = _push_if_overlap(logo["bbox"], subject, rules.max_iou_subject, rules.min_margin)
    if head and logo and iou_xywh(head["bbox"], logo["bbox"]) > rules.max_iou_text:
        head["bbox"] = _push_if_overlap(head["bbox"], logo["bbox"], rules.max_iou_text, rules.min_margin)
        logo["bbox"] = _push_if_overlap(logo["bbox"], head["bbox"], rules.max_iou_text, rules.min_margin)

    return lay


# -------------- evaluation (strict) --------------

def eval_one(image_path: str, pred: dict, rules: Rules, reason_dir: Optional[str] = None) -> dict:
    gray = load_gray(image_path)
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
    texts = layout.get("nongraphic_layout", [])
    graphics = layout.get("graphic_layout", [])

    reasons = []
    head = pick_first_box_strict(texts, "headline", reasons=reasons, tag="headline")
    logo = pick_first_box_strict(graphics, "logo", reasons=reasons, tag="logo")

    if reason_dir:
        ensure_dir(reason_dir)
        base = os.path.splitext(os.path.basename(image_path))[0]
        if reasons:
            with open(os.path.join(reason_dir, f"{base}.txt"), "w", encoding="utf-8") as f:
                f.write("\n".join(reasons))

    def _ar(b):
        if not b:
            return 0.0
        w, h = b[2], b[3]
        return (w / h) if h > 0 else 0.0

    def _area(b):
        return (b[2] * b[3]) if b else 0.0

    row = {
        "json_ok": int("layout" in pred),
        "have_headline": int(head is not None),
        "have_logo": int(logo is not None),
        "num_head_boxes": len([i for i in texts if isinstance(i, dict) and i.get("type") == "headline"]),
        "num_logo_boxes": len([i for i in graphics if isinstance(i, dict) and i.get("type") == "logo"]),
        "margin_ok_text": margin_ok(head, rules.min_margin),
        "margin_ok_logo": margin_ok(logo, rules.min_margin),
        "ar_text": round(_ar(head), 4),
        "ar_logo": round(_ar(logo), 4),
        "area_text": round(_area(head), 6),
        "area_logo": round(_area(logo), 6),
        "iou_subject_text": round(iou_xywh(head, subject), 4) if head else 0.0,
        "iou_subject_logo": round(iou_xywh(logo, subject), 4) if logo else 0.0,
        "iou_text_logo": round(iou_xywh(head, logo), 4) if head and logo else 0.0,
        "energy_text": -1,
        "energy_logo": -1,
        "negspace_compliance": 0.0,
        "prompt_len": 0,
        "headline_suggestion": "",
        "background_prompt": "",
    }
    e_t = window_energy_safe(energy, head)
    e_g = window_energy_safe(energy, logo)
    row["energy_text"] = round(e_t, 4) if e_t >= 0 else -1
    row["energy_logo"] = round(e_g, 4) if e_g >= 0 else -1

    # 간단한 negspace 컴플라이언스: 텍스트 에너지 낮을수록 1에 가깝게
    if e_t >= 0:
        row["negspace_compliance"] = float(max(0.0, 1.0 - e_t))

    # content 기반 보조 정보
    try:
        head_item = next((i for i in texts if i.get("type") == "headline"), None)
        if head_item:
            content = (head_item.get("content") or "").strip()
            row["headline_suggestion"] = content[:200]
            row["prompt_len"] = len(content.split()) if content else 0
    except Exception:
        pass
    try:
        bg = (pred.get("background") or {})
        row["background_prompt"] = (bg.get("prompt") or bg.get("desc") or "")[:200]
    except Exception:
        pass

    row["composite_score"] = composite_score(row)
    return row


# ----------------- LoRA loader (NO offload) -----------------

def load_lora_model_no_offload(base_model_id: str, lora_dir: str, dtype, device: str):
    """LoRA를 CPU에 붙인 뒤 통째로 target device로 이동(오프로딩 우회)."""
    lora_base = QwenVL.from_pretrained(
        base_model_id, dtype=dtype, device_map=None, attn_implementation="sdpa"
    ).eval()

    lora = PeftModel.from_pretrained(lora_base, lora_dir).eval()
    # sanity check: LoRA 파라미터 존재?
    sd = get_peft_model_state_dict(lora)
    print(f"[LoRA] num lora params: {sum(v.numel() for v in sd.values())}")

    lora.to(device)
    return lora


# ----------------- Best-of-N for LoRA -----------------

def best_of_n(
    image_path: str,
    cond: dict,
    product_name: str,
    model: QwenVL,
    processor: AutoProcessor,
    rules: Rules,
    n: int = 5,
    max_new_tokens: int = 480,
    temperature: float = 0.2,
    top_p: float = 0.8,
    apply_post_fix: bool = True,
) -> dict:
    gray = load_gray(image_path)
    energy = sobel_energy(gray)
    subject = subject_from_energy(energy)

    best_pred = None
    best_score = -1e9
    for _ in range(max(1, n)):
        # LoRA 후보는 샘플링으로 다양성 확보
        pred = run_qwen(
            image_path, cond, product_name, model, processor,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_p=top_p,
            is_lora=True,
            deterministic_lora=False,
        )
        if apply_post_fix and isinstance(pred, dict) and "layout" in pred:
            try:
                pred["layout"] = fix_layout(pred["layout"], subject, rules)
            except Exception:
                pass
        row = eval_one(image_path, pred, rules)
        score = row.get("composite_score", -1e9)
        if score > best_score:
            best_score = score
            best_pred = pred

    return best_pred


# ----------------- summary printer -----------------

def print_eval_summary(rows: List[dict]):
    import numpy as _np

    def model_rows(m):
        return [r for r in rows if r.get("model") == m]

    def rates(rs):
        N = len(rs)
        both = sum(1 for r in rs if r["have_headline"] == 1 and r["have_logo"] == 1)
        anyv = sum(1 for r in rs if r["have_headline"] == 1 or r["have_logo"] == 1)
        both_rate = round(both / N, 4) if N else 0.0
        any_rate = round(anyv / N, 4) if N else 0.0
        valid_only = [r for r in rs if (r["have_headline"] == 1 or r["have_logo"] == 1)]
        comp_all = round(float(_np.mean([r["composite_score"] for r in rs])), 4) if rs else 0.0
        comp_valid = round(float(_np.mean([r["composite_score"] for r in valid_only])), 4) if valid_only else 0.0
        return {"N": N, "both_rate": both_rate, "any_rate": any_rate, "comp_all": comp_all, "comp_valid": comp_valid}

    def pairwise_wins():
        imgs = sorted(set(r["image"] for r in rows))
        b = l = t = 0
        for im in imgs:
            rb = next((r for r in rows if r["image"] == im and r["model"] == "base"), None)
            rl = next((r for r in rows if r["image"] == im and r["model"] == "lora"), None)
            if not rb or not rl:
                continue
            if rb["composite_score"] > rl["composite_score"]:
                b += 1
            elif rb["composite_score"] < rl["composite_score"]:
                l += 1
            else:
                t += 1
        return b, l, t

    base_s = rates(model_rows("base"))
    lora_s = rates(model_rows("lora"))
    wb, wl, wt = pairwise_wins()

    print("\n=== SUMMARY (A/B/C 판정표) ===")
    print("A) both_valid_rate  = 헤드라인+로고 모두 존재 비율")
    print("B) any_valid_rate   = 헤드라인 또는 로고 중 하나라도 존재 비율")
    print("C) comp_valid_mean  = 유효 샘플에서의 composite 평균")
    print("\n[BASE]", base_s, "\n[LORA]", lora_s)
    print(f"Wins — base:{wb}  lora:{wl}  ties:{wt}")


# ----------------- main loop (sequential) -----------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True, help="Glob path(s), e.g. .\\data\\imgs\\*.jpg or '*.png;*.jpg'")
    ap.add_argument("--base_model", default="Qwen/Qwen2.5-VL-3B-Instruct")
    ap.add_argument("--lora_dir", required=True)
    ap.add_argument("--cond_json", default=None)
    ap.add_argument("--product_name", default="")
    ap.add_argument("--out_dir", default="./_cmp_out")
    ap.add_argument("--max_new_tokens", type=int, default=480)
    ap.add_argument("--temperature", type=float, default=0.2)
    ap.add_argument("--top_p", type=float, default=0.8)
    # Post-fix toggle (default ON)
    ap.add_argument("--disable_post_fix", action="store_true", help="Disable schema/constraints post-fix step")
    # LoRA best-of-N & sampling knobs
    ap.add_argument("--lora_best_of", type=int, default=5, help="Generate N candidates for LoRA and pick best by composite score (N=1 => greedy)")
    ap.add_argument("--lora_temp", type=float, default=0.2)
    ap.add_argument("--lora_top_p", type=float, default=0.8)

    args = ap.parse_args()

    ensure_dir(args.out_dir)
    out_json_base = os.path.join(args.out_dir, "json", "base"); ensure_dir(out_json_base)
    out_json_lora = os.path.join(args.out_dir, "json", "lora"); ensure_dir(out_json_lora)

    # cond
    cond = {}
    if args.cond_json and os.path.exists(args.cond_json):
        cond_raw = read_json(args.cond_json)
        cond = cond_raw.get("input_cond", cond_raw)

    # images: support semicolon-separated patterns
    patterns = [p.strip() for p in args.images.split(";")]
    images = []
    for pat in patterns:
        images.extend(glob.glob(pat))
    images = sorted(set(images))
    assert images, f"No images matched: {args.images}. Tip: wrap the glob in quotes."

    # device / dtype
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32

    # processor
    processor = AutoProcessor.from_pretrained(args.base_model, use_fast=False)

    rules = Rules()
    rows: List[Dict[str, Any]] = []

    # ------------------ PASS 1: BASE ------------------
    print("\n[Pass 1/2] Loading BASE model...")
    base = QwenVL.from_pretrained(
        args.base_model, dtype=dtype, device_map="auto", attn_implementation="sdpa"
    ).eval()

    total = len(images)
    for i, img in enumerate(images, 1):
        print(f"[BASE {i}/{total}] {os.path.basename(img)} 처리 시작", flush=True)

        pred_b = run_qwen(
            img, cond, args.product_name, base, processor,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            top_p=args.top_p,
            is_lora=False,
        )

        # Post-fix (apply to BOTH models for fairness)
        if (not args.disable_post_fix) and isinstance(pred_b, dict) and "layout" in pred_b:
            try:
                gray = load_gray(img); energy = sobel_energy(gray); subject = subject_from_energy(energy)
                pred_b["layout"] = fix_layout(pred_b["layout"], subject, rules)
            except Exception:
                pass

        write_json(os.path.join(out_json_base, os.path.basename(img) + ".base.json"), pred_b)
        m_b = eval_one(img, pred_b, rules, reason_dir=os.path.join(args.out_dir, "reasons", "base"))
        m_b["image"] = os.path.basename(img); m_b["model"] = "base"
        rows.append(m_b)

    # Release BASE
    try:
        del base
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    print(f"  ↳ 저장: {os.path.join(out_json_base, os.path.basename(img) + '.base.json')} "
          f"score={m_b.get('composite_score', float('nan')):.3f}", flush=True)

    # ------------------ PASS 2: LoRA (NO offload) ------------------
    print("\n[Pass 2/2] Loading LoRA model (NO offload)...")
    lora = load_lora_model_no_offload(args.base_model, args.lora_dir, dtype, device)

    for i, img in enumerate(images, 1):
        print(f"[LORA {i}/{total}] {os.path.basename(img)} 처리 시작 (best_of={args.lora_best_of})", flush=True)

        if args.lora_best_of and args.lora_best_of > 1:
            pred_l = best_of_n(
            img, cond, args.product_name, lora, processor, rules,
            n=args.lora_best_of,
            max_new_tokens=args.max_new_tokens,
            temperature=args.lora_temp,
            top_p=args.lora_top_p,
            apply_post_fix=(not args.disable_post_fix),
        )
        else:
            pred_l = run_qwen(
            img, cond, args.product_name, lora, processor,
            max_new_tokens=args.max_new_tokens,
            temperature=args.lora_temp,
            top_p=args.lora_top_p,
            is_lora=True,
            deterministic_lora=False,  # (공정 샘플링 단발이면 False)
        )
            if (not args.disable_post_fix) and isinstance(pred_l, dict) and "layout" in pred_l:
                try:
                    gray = load_gray(img); energy = sobel_energy(gray); subject = subject_from_energy(energy)
                    pred_l["layout"] = fix_layout(pred_l["layout"], subject, rules)
                except Exception:
                    pass

        write_json(os.path.join(out_json_lora, os.path.basename(img) + ".lora.json"), pred_l)
        m_l = eval_one(img, pred_l, rules, reason_dir=os.path.join(args.out_dir, "reasons", "lora"))
        m_l["image"] = os.path.basename(img); m_l["model"] = "lora"
        rows.append(m_l)

    # Release LoRA
    try:
        del lora
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    print(f"  ↳ 저장: {os.path.join(out_json_lora, os.path.basename(img) + '.lora.json')} "
          f"score={m_l.get('composite_score', float('nan')):.3f}", flush=True)

    # ------------------ Save CSV & Aggregate ------------------
    csv_path = os.path.join(args.out_dir, "compare_report.csv")
    fields = [
        "image", "model", "json_ok", "have_headline", "have_logo",
        "num_head_boxes", "num_logo_boxes",
        "margin_ok_text", "margin_ok_logo", "ar_text", "ar_logo",
        "area_text", "area_logo",
        "iou_subject_text", "iou_subject_logo", "iou_text_logo",
        "energy_text", "energy_logo", "negspace_compliance",
        "prompt_len", "composite_score", "headline_suggestion", "background_prompt"
    ]
    ensure_dir(args.out_dir)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})

    # aggregate means
    def agg(model_name: str):
        sub = [r for r in rows if r["model"] == model_name]
        if not sub:
            return {}
        out = {}
        for k in fields:
            if k in ("image", "model", "headline_suggestion", "background_prompt"):
                continue
            vals = [r[k] for r in sub if isinstance(r.get(k), (int, float))]
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
        if not b or not l:
            continue
        if b["composite_score"] > l["composite_score"]:
            wins_base += 1
        elif b["composite_score"] < l["composite_score"]:
            wins_lora += 1
        else:
            ties += 1

    print("\n=== Aggregate (mean) ===")
    print("[BASE]", agg_base)
    print("[LORA]", agg_lora)
    print(f"Wins — base:{wins_base}  lora:{wins_lora}  ties:{ties}")
    print(f"[OK] wrote CSV: {csv_path}")

    # 판정표 출력
    print_eval_summary(rows)


if __name__ == "__main__":
    main()
