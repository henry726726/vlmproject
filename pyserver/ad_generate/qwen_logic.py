# -*- coding: utf-8 -*-
"""
qwen_logic.py
RunPod Handler에서 임포트하여 사용하는 Qwen-VL 레이아웃 생성 모듈
"""

import os
import json
import numpy as np
from PIL import Image
import torch
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info

# ---------------------------
# Runtime / Model Constants
# ---------------------------
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32
torch.backends.cuda.matmul.allow_tf32 = True

MODEL_ID = os.getenv("QWEN_VL_MODEL", "Qwen/Qwen2.5-VL-7B-Instruct")
FIRSTPASS_CAP = int(os.getenv("QWEN_FIRSTPASS_MAX_NEW_TOKENS", "384"))
ENV_DISABLE_FALLBACK = os.getenv("QWEN_DISABLE_FALLBACK", "0") == "1"

# ---------------------------
# Prompt (강화된 프롬프트)
# ---------------------------
SYSTEM = (
    "You are a layout planner for product advertisements.\n"
    "IMPORTANT:\n"
    "- Do NOT transcribe or reuse any existing text or logo in the image. No OCR.\n"
    "- Only propose NEW overlay placements for headline and brand logo.\n"
    "- Output JSON only. No explanations.\n"
)

SCHEMA_TEXT = (
    'Return ONLY the following JSON (no markdown, no commentary):\n'
    '{\n'
    '  "product": { "type":"...", "material":"...", "design":"...", "features":"..." },\n'
    '  "background": { "ideal_color":"...", "texture":"...", "lighting":"...", "style":"..." },\n'
    '  "layout": {\n'
    '    "subject_layout": { "center":[cx,cy], "ratio":[rw,rh] },\n'
    '    "nongraphic_layout": [ {"type":"headline","content":"","bbox":[x,y,w,h],"confidence":c} ],\n'
    '    "graphic_layout": [ {"type":"logo","content":"","bbox":[x,y,w,h],"confidence":c} ]\n'
    '  }\n'
    '}\n'
    '\n'
    '# Constraints:\n'
    '- Coordinates are normalized 0..1. bbox=[x,y,w,h]. Subject=[cx,cy,rw,rh].\n'
    '- Always output at least ONE headline and ONE logo candidate.\n'
    '- Text: horizontal aspect (AR>=1.8) preferred; margins; avoid subject IoU<=0.2.\n'
    '- Logo: aspect 0.7..3.0; area<=0.12; margins; avoid subject/text overlaps.\n'
)

# ---------------------------
# Background Prompt System
# ---------------------------
BG_SYSTEM = (
    "You design prompts for a background generator. Respect subject/text/logo boxes; never occlude them. "
    "Return JSON only. `background_prompt` in natural EN, ~120–200 words."
)
BG_SCHEMA = (
    'Only output the following JSON. No explanations.\n'
    '{\n'
    '  "background_prompt": "...",\n'
    '  "negative_prompt": "...",\n'
    '  "camera": { "angle":"eye-level|top-down|low-angle|macro|oblique", "distance":"closeup|medium|wide" },\n'
    '  "lighting": { "type":"soft|hard|rim|ambient", "direction":"left|right|front|back|top|bottom" },\n'
    '  "palette": ["#RRGGBB", "..."],\n'
    '  "objects": [ { "name":"flower petals","style":"bokeh|flat|painterly|realistic","bbox_hint":[x,y,w,h],\n'
    '                "depth":"behind_product|same_plane","avoid_iou_with":"subject,text_boxes,logo_boxes" } ]\n'
    '}\n'
)

# ---------------------------
# Utils: JSON & Helpers
# ---------------------------
def extract_json(text: str):
    try:
        s = text.index("{"); e = text.rindex("}") + 1
        return json.loads(text[s:e])
    except Exception:
        return {"raw": text}

def clip01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))

def clip_bbox(b):
    x,y,w,h = map(float, b)
    x=clip01(x); y=clip01(y); w=clip01(w); h=clip01(h)
    if x+w>1: w=max(0.0, 1-x)
    if y+h>1: h=max(0.0, 1-y)
    return [x,y,w,h]

def bbox_from_center_ratio(center, ratio):
    cx,cy = center; rw,rh = ratio
    return clip_bbox([cx-rw/2, cy-rh/2, rw, rh])

def iou_xywh(b1, b2):
    x1,y1,w1,h1 = b1; x2,y2,w2,h2 = b2
    xa=max(x1,x2); ya=max(y1,y2)
    xb=min(x1+w1, x2+w2); yb=min(y1+h1, y2+h2)
    inter=max(0.0, xb-xa)*max(0.0, yb-ya)
    a1=max(0.0, w1*h1); a2=max(0.0, w2*h2)
    u=a1+a2-inter
    return inter/u if u>0 else 0.0

def nms(items, iou_thr=0.3):
    arr=[it for it in items if isinstance(it.get("bbox"), list) and len(it["bbox"])==4]
    arr.sort(key=lambda d: float(d.get("confidence", 0.5)), reverse=True)
    kept=[]
    for it in arr:
        if all(iou_xywh(it["bbox"], k["bbox"])<iou_thr for k in kept):
            kept.append(it)
    return kept

# ---------------------------
# Visual analysis (Sobel energy)
# ---------------------------
def load_gray(image_path, max_side=1280):
    im = Image.open(image_path).convert("L")
    w,h = im.size
    scale = min(1.0, max_side / max(w,h))
    if scale < 1.0:
        im = im.resize((int(w*scale), int(h*scale)), Image.BICUBIC)
    arr = np.asarray(im, dtype=np.float32) / 255.0
    return arr  # HxW

def sobel_energy(gray):
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
    if mag.max() > 0: mag = mag / mag.max()
    return mag  # 0..1

def subject_bbox_from_energy(energy, q_low=0.15, q_high=0.85):
    H,W = energy.shape
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
    w_box = max(2/W, (x_hi - x_lo) / W)
    h_box = max(2/H, (y_hi - y_lo) / H)
    return clip_bbox([x,y,w_box,h_box])

def window_energy(energy, x, y, w, h):
    H,W = energy.shape
    x0 = int(round(x*W)); y0 = int(round(y*H))
    x1 = int(round((x+w)*W)); y1 = int(round((y+h)*H))
    x0 = max(0, min(W-1, x0)); x1 = max(0, min(W, x1))
    y0 = max(0, min(H-1, y0)); y1 = max(0, min(H, y1))
    if x1<=x0 or y1<=y0: return 1e9
    sub = energy[y0:y1, x0:x1]
    return float(sub.mean())

def grid_search_low_energy(energy, win_w, win_h, margin, avoid=[], stride=0.01, seed=None):
    rng = np.random.default_rng(seed if seed is not None else 1234)
    H,W = energy.shape
    xs = np.arange(margin, 1.0 - margin - win_w + 1e-6, stride)
    ys = np.arange(margin, 1.0 - margin - win_h + 1e-6, stride)
    if len(xs)==0 or len(ys)==0:
        return [margin, margin, win_w, win_h]
    xs = rng.permutation(xs)[:max(30, int(1/stride))]
    ys = rng.permutation(ys)[:max(30, int(1/stride))]
    best_b = None; best_s = 1e9
    for x in xs:
        for y in ys:
            e = window_energy(energy, x,y,win_w,win_h)
            pen = 0.0
            b = [x,y,win_w,win_h]
            for a in avoid:
                pen += 0.8 * iou_xywh(b, a)
            s = e + pen
            if s < best_s:
                best_s = s; best_b = b
    return clip_bbox(best_b)

# ---------------------------
# Hints & Rules
# ---------------------------
def area_from_text_hint(hint: dict):
    if not isinstance(hint, dict): return None
    chars = max(0, int(hint.get("approx_chars", 0)))
    lines = max(1, int(hint.get("lines", 1)))
    base = 0.06 * (chars / 14.0)
    area = base + 0.03*(lines-1)
    return float(min(0.20, max(0.02, area)))

def area_from_logo_hint(hint: dict):
    if not isinstance(hint, dict): return None
    try:
        return float(min(0.12, max(0.01, float(hint.get("target_area", 0.05)))))
    except Exception:
        return 0.05

def ar_from_logo_hint(hint: dict):
    if not isinstance(hint, dict): return None
    try:
        ar = float(hint.get("aspect_ratio", 2.2))
        return float(min(3.5, max(0.6, ar)))
    except Exception:
        return 2.2

def enforce_text_rules(items, subject_bbox, rules, debug, quiet=False):
    out=[]
    for it in items:
        b=it.get("bbox")
        if not (isinstance(b,list) and len(b)==4):
            if not quiet: debug.append(("text","drop","invalid_bbox", b))
            continue
        x,y,w,h=clip_bbox(b)
        ar=(w/h) if h>0 else 999
        area=w*h
        if x < rules["min_margin"] or y < rules["min_margin"] or x+w > 1-rules["min_margin"] or y+h > 1-rules["min_margin"]:
            if not quiet: debug.append(("text","drop","margin", [x,y,w,h])); continue
        if ar < rules["min_ar"]:
            if not quiet: debug.append(("text","drop","min_ar", ar)); continue
        if area > rules["max_area"]:
            if not quiet: debug.append(("text","drop","max_area", area)); continue
        if subject_bbox and iou_xywh([x,y,w,h], subject_bbox) > rules["max_iou_subject"]:
            if not quiet: debug.append(("text","drop","iou_subject", iou_xywh([x,y,w,h], subject_bbox))); continue
        it["bbox"]=[x,y,w,h]; it["confidence"]=float(it.get("confidence",0.5)); it["content"]=""
        out.append(it)
    return out

def enforce_logo_rules(items, subject_bbox, text_bbox, rules, debug, quiet=False):
    out=[]
    for it in items:
        if it.get("type")!="logo": continue
        b=it.get("bbox")
        if not (isinstance(b,list) and len(b)==4):
            if not quiet: debug.append(("logo","drop","invalid_bbox", b)); continue
        x,y,w,h=clip_bbox(b)
        ar=(w/h) if h>0 else 999
        area=w*h
        if x < rules["min_margin"] or y < rules["min_margin"] or x+w > 1-rules["min_margin"] or y+h > 1-rules["min_margin"]:
            if not quiet: debug.append(("logo","drop","margin", [x,y,w,h])); continue
        if area > rules["max_area"]:
            if not quiet: debug.append(("logo","drop","max_area", area)); continue
        if not (rules["ar_range"][0] <= ar <= rules["ar_range"][1]):
            if not quiet: debug.append(("logo","drop","ar_range", ar)); continue
        if subject_bbox and iou_xywh([x,y,w,h], subject_bbox) > rules["max_iou_subject"]:
            if not quiet: debug.append(("logo","drop","iou_subject", iou_xywh([x,y,w,h], subject_bbox))); continue
        if text_bbox and iou_xywh([x,y,w,h], text_bbox) > rules["max_iou_text"]:
            if not quiet: debug.append(("logo","drop","iou_text", iou_xywh([x,y,w,h], text_bbox))); continue
        it["bbox"]=[x,y,w,h]; it["confidence"]=float(it.get("confidence",0.5)); it["content"]=""
        out.append(it)
    return out

def pick_single_text(texts, subject_bbox):
    if not texts: return []
    def score(t):
        b=t["bbox"]
        return t.get("confidence",0.5) + 0.1*min((b[2]/max(b[3],1e-6))/3,1.0) + 0.03*(b[2]*b[3]) - 0.6*iou_xywh(b, subject_bbox)
    return [max(texts, key=score)]

def pick_single_logo(logos, subject_bbox, chosen_text):
    if not logos: return []
    tb=chosen_text[0]["bbox"] if chosen_text else None
    def score(g):
        b=g["bbox"]; area=b[2]*b[3]
        pen=0.6*iou_xywh(b, subject_bbox) + (0.4*iou_xywh(b, tb) if tb else 0.0)
        return g.get("confidence",0.5) + 0.05*area - pen
    return [max(logos, key=score)]

def propose_fallback_text_visual(energy, subject_bbox, rules, hint=None, seed=None):
    target_area = area_from_text_hint(hint) if hint else 0.06
    aspect = max(rules["min_ar"], 2.2)
    h = (target_area/aspect)**0.5
    w = aspect*h
    w = min(w, 1 - 2*rules["min_margin"])
    h = min(h, 0.22)
    b = grid_search_low_energy(
        energy, win_w=w, win_h=h, margin=rules["min_margin"],
        avoid=[subject_bbox], stride=0.02, seed=seed
    )
    return {"type":"headline","content":"","bbox":b,"confidence":0.6}

def propose_fallback_logo_visual(energy, subject_bbox, text_bbox, rules, hint=None, seed=None):
    targ = area_from_logo_hint(hint) if hint else 0.05
    ar = ar_from_logo_hint(hint) if hint else 2.2
    w = (targ)**0.5
    h = max(0.04, w/ar)
    w = min(w, 1 - 2*rules["min_margin"])
    h = min(h, 0.15)
    b = grid_search_low_energy(
        energy, win_w=w, win_h=h, margin=rules["min_margin"],
        avoid=[subject_bbox, text_bbox] if text_bbox else [subject_bbox],
        stride=0.02, seed=(None if seed is None else seed+7)
    )
    return {"type":"logo","content":"","bbox":b,"confidence":0.6}

def add_text_underlays(layout, pad=0.015, opacity=0.6, radius=0.08):
    texts = layout.get("nongraphic_layout", []) or []
    layout.setdefault("graphic_layout", [])
    for idx,t in enumerate(texts):
        b=t.get("bbox"); 
        if not (isinstance(b,list) and len(b)==4): continue
        x,y,w,h=b
        under={
            "type":"underlay",
            "for": t.get("type","text")+f"#{idx}",
            "bbox": clip_bbox([x-pad, y-pad, w+2*pad, h+2*pad]),
            "style":{"shape":"rounded","radius":radius,"opacity":opacity},
            "confidence": min(0.9, float(t.get("confidence",0.5))+0.1)
        }
        layout["graphic_layout"].append(under)

def extract_palette_hex(image_path, k=5):
    try:
        im=Image.open(image_path).convert("RGB")
        im_thumb=im.copy(); im_thumb.thumbnail((256,256))
        pal=im_thumb.convert("P", palette=Image.ADAPTIVE, colors=k).convert("RGB")
        colors=pal.getcolors(256*256) or []
        colors.sort(key=lambda x:x[0], reverse=True)
        hexes=[]
        for _,rgb in colors[:k]:
            hexes.append('#%02x%02x%02x' % rgb)
        dedup=[]
        for h in hexes:
            if h not in dedup: dedup.append(h)
        return dedup[:k] or ["#ffffff","#000000"]
    except Exception:
        return ["#ffffff","#000000"]

def summarize_layout_for_bg(parsed):
    if not isinstance(parsed, dict) or "layout" not in parsed: return "no layout"
    layout=parsed["layout"]
    subj=layout.get("subject_layout", {"center":[0.5,0.5], "ratio":[0.3,0.3]})
    cx,cy=subj.get("center",[0.5,0.5]); rw,rh=subj.get("ratio",[0.3,0.3])
    subj_bbox=[cx-rw/2, cy-rh/2, rw, rh]
    texts=layout.get("nongraphic_layout", []) or []
    logos=layout.get("graphic_layout", []) or []
    top_free = cy - rh/2; bottom_free = 1 - (cy + rh/2)
    left_free = cx - rw/2; right_free = 1 - (cx + rw/2)
    hints=[]
    if top_free>0.25: hints.append("top has ample negative space")
    if bottom_free>0.25: hints.append("bottom has ample negative space")
    if left_free>0.25: hints.append("left side has ample negative space")
    if right_free>0.25: hints.append("right side has ample negative space")
    return json.dumps({
        "subject_bbox": subj_bbox,
        "text_boxes": [t.get("bbox") for t in texts if isinstance(t.get("bbox"), list)],
        "logo_boxes": [g.get("bbox") for g in logos if isinstance(g.get("bbox"), list)],
        "free_space_hints": hints
    }, ensure_ascii=False)

def ensure_background_prompts(parsed, product_name, context_json, min_chars=800):
    bg=parsed.setdefault("background", {})
    prompt=(bg.get("prompt") or '').strip()
    negative=(bg.get("negative_prompt") or '').strip()
    cam=bg.get("camera") or {}; light=bg.get("lighting") or {}
    angle=str(cam.get("angle","eye-level")).replace('_','-')
    distance=str(cam.get("distance","closeup"))
    ltype=(light.get("type") or "soft").lower()
    ldir=(light.get("direction") or "front").lower()
    palette=bg.get("palette") or []
    if len(prompt) < min_chars:
        try:
            ctx=json.loads(context_json) if isinstance(context_json,str) else (context_json or {})
            free_hints=ctx.get("free_space_hints", []) or []
        except Exception:
            free_hints=[]
        free_txt = f" The composition preserves ample {', '.join(free_hints)} for copy layers." if free_hints else ""
        palette_txt = f" The color harmony follows {', '.join(palette)}." if palette else ""
        product_txt = f" The scene flatters the {product_name}." if product_name else " The scene flatters the product."
        prompt = (
            f"A minimal studio scene viewed {angle} at a {distance} distance, built on a clean white base with a "
            f"uniform, smooth surface. The background feels airy and uncluttered so the jewelry remains the visual anchor. "
            f"Lighting is {ltype} from the {ldir}, creating gentle highlights on metal and controlled shadows that avoid the subject. "
            f"Subtle gradients and a clean vignette guide the eye toward the center without stealing attention. "
            f"Props are placed behind the product and outside text/logo areas; their scale is modest and their edges soft to prevent occlusion. "
            f"Depth cues are introduced with a mild blur in the far plane and a crisp focus on the subject plane. "
            f"Micro-texture is barely perceptible, keeping reflections smooth and elegant. "
            f"Overall mood is calm, premium, and editorial." + palette_txt + free_txt + product_txt
        )
        bg["prompt"]=prompt
    if not negative:
        bg["negative_prompt"]=(
            "busy patterns, harsh shadows, specular clipping on metal, occluding props, "
            "off-palette colors, tilted horizon, text overlays, watermarks, low resolution"
        )
    cam["angle"]=angle; cam["distance"]=distance
    light["type"]=ltype; light["direction"]=ldir
    bg["camera"]=cam; bg["lighting"]=light
    parsed["background"]=bg
    return parsed

# ---------------------------
# Functions for Handler
# ---------------------------
def load_model():
    """
    Handler의 Init 단계에서 한 번만 호출됨.
    모델과 프로세서를 로드하여 반환.
    """
    print(f"--- [Qwen Logic] Loading Model: {MODEL_ID} ---")
    processor = AutoProcessor.from_pretrained(MODEL_ID, use_fast=False)
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        MODEL_ID, dtype=DTYPE, device_map="auto", attn_implementation="sdpa"
    ).eval()
    return model, processor

def run_vlm_inference(image_path, product_name, cond, processor, model, max_new_tokens=900, top_p=0.9, temperature=0.7):
    """VLM Inference Only (Pass 1 & Pass 2 공용)"""
    messages = [
        {"role":"system","content":[{"type":"text","text":SYSTEM}]},
        {"role":"user","content":[
            {"type":"image","image": f"file://{image_path}"},
            {"type":"text","text": f"[PRODUCT]{product_name or ''}\n[COND]{json.dumps(cond, ensure_ascii=False)}\n{SCHEMA_TEXT}"}
        ]}
    ]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(text=[text], images=image_inputs, videos=video_inputs,
                       padding=True, return_tensors="pt").to(model.device)
    
    first_tokens = min(int(max_new_tokens or 512), FIRSTPASS_CAP)
    with torch.no_grad():
        out_ids = model.generate(
            **inputs, max_new_tokens=first_tokens, do_sample=True,
            top_p=top_p, temperature=temperature
        )
    gen = processor.batch_decode(out_ids[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]
    return extract_json(gen)

def generate_layout(model, processor, image_path, product_name=None, cond=None, 
                   max_new_tokens=900, temperature=0.7, top_p=0.9, bg_min_chars=900,
                   bg_prompt=True, no_fallback=False, no_rules=False, 
                   relax_if_all_dropped=True, fallback_strategy="visual", seed=1234, quiet=False):
    """
    Handler가 요청(Job)마다 호출하는 메인 로직 함수
    """
    if cond is None: cond = {}

    # 규칙 파싱
    text_rules = {
        "min_margin": float(cond.get("text_rules",{}).get("min_margin", 0.03)),
        "min_ar": float(cond.get("text_rules",{}).get("min_ar", 1.8)),
        "max_area": float(cond.get("text_rules",{}).get("max_area", 0.20)),
        "max_iou_subject": float(cond.get("text_rules",{}).get("max_iou_with_subject", 0.20)),
    }
    logo_rules = {
        "min_margin": float(cond.get("logo_rules",{}).get("min_margin", 0.03)),
        "max_area": float(cond.get("logo_rules",{}).get("max_area", 0.12)),
        "ar_range": tuple(cond.get("logo_rules",{}).get("ar_range", [0.7, 3.0])),
        "max_iou_subject": float(cond.get("logo_rules",{}).get("max_iou_with_subject", 0.20)),
        "max_iou_text": float(cond.get("logo_rules",{}).get("max_iou_with_text", 0.25)),
    }
    text_hint = cond.get("headline_hint", {})
    logo_hint = cond.get("logo_hint", {})

    if not quiet:
        print("[rules] text:", text_rules)
        print("[rules] logo:", logo_rules)

    # 1) VLM Pass 1 (Layout)
    parsed = run_vlm_inference(
        image_path=image_path, product_name=product_name, cond=cond,
        processor=processor, model=model,
        max_new_tokens=max_new_tokens, top_p=top_p, temperature=temperature
    )

    # 2) Visual analysis
    gray = load_gray(image_path)
    energy = sobel_energy(gray)
    layout = parsed.get("layout", parsed if isinstance(parsed, dict) else {})
    subj = layout.get("subject_layout", {})
    try:
        subject_bbox = bbox_from_center_ratio(subj.get("center",[0.5,0.5]), subj.get("ratio",[0.3,0.3]))
    except Exception:
        subject_bbox = subject_bbox_from_energy(energy)
        if not quiet: print("[subject] visual-estimated:", subject_bbox)

    # 3) Filtering & Selection
    debug=[]
    texts = layout.get("nongraphic_layout", [])
    graphics = layout.get("graphic_layout", [])
    if not isinstance(texts, list): texts=[]
    if not isinstance(graphics, list): graphics=[]

    if no_rules:
        for t in texts:
            if isinstance(t, dict):
                t["content"]=""
                t["bbox"]=clip_bbox(t.get("bbox",[0.05,0.8,0.9,0.15]))
        logos = [g for g in graphics if g.get("type")=="logo"]
    else:
        texts = enforce_text_rules(texts, subject_bbox, text_rules, debug, quiet=quiet)
        texts = nms(texts, iou_thr=0.3)
        texts = pick_single_text(texts, subject_bbox)
        
        logos = [g for g in graphics if g.get("type")=="logo"]
        logos = enforce_logo_rules(logos, subject_bbox, texts[0]["bbox"] if texts else None, logo_rules, debug, quiet=quiet)
        logos = nms(logos, iou_thr=0.3)
        logos = pick_single_logo(logos, subject_bbox, texts)

    # 4) Fallback
    use_fallback = not (no_fallback or ENV_DISABLE_FALLBACK)
    if use_fallback and not texts:
        if relax_if_all_dropped:
            text_rules_soft = dict(text_rules)
            text_rules_soft["min_ar"] = max(1.4, text_rules["min_ar"]*0.8)
            text_rules_soft["min_margin"] = max(0.015, text_rules["min_margin"]*0.8)
        else:
            text_rules_soft = text_rules
        fb_text = propose_fallback_text_visual(energy, subject_bbox, text_rules_soft, hint=text_hint, seed=seed)
        texts = [fb_text]
        if not quiet: print("[fallback] text:", fb_text["bbox"])

    if use_fallback and not logos:
        if relax_if_all_dropped:
            logo_rules_soft = dict(logo_rules)
            logo_rules_soft["ar_range"] = (min(logo_rules["ar_range"][0], 0.7), max(logo_rules["ar_range"][1], 3.2))
            logo_rules_soft["min_margin"] = max(0.015, logo_rules["min_margin"]*0.9)
        else:
            logo_rules_soft = logo_rules
        fb_logo = propose_fallback_logo_visual(energy, subject_bbox, texts[0]["bbox"] if texts else None, logo_rules_soft, hint=logo_hint, seed=seed)
        logos = [fb_logo]
        if not quiet: print("[fallback] logo:", fb_logo["bbox"])

    # 5) Assembly
    final_layout = {
        "subject_layout": {
            "center":[round(subject_bbox[0]+subject_bbox[2]/2,3), round(subject_bbox[1]+subject_bbox[3]/2,3)],
            "ratio":[round(subject_bbox[2],3), round(subject_bbox[3],3)]
        },
        "nongraphic_layout": texts,
        "graphic_layout": logos
    }
    
    underlay_pad = float(cond.get("underlay",{}).get("pad", 0.015))
    underlay_opacity = float(cond.get("underlay",{}).get("opacity", 0.6))
    underlay_radius = float(cond.get("underlay",{}).get("radius", 0.08))
    add_text_underlays(final_layout, pad=underlay_pad, opacity=underlay_opacity, radius=underlay_radius)
    parsed["layout"] = final_layout

    # 6) Background Prompt (Pass 2)
    need_bg = (bg_prompt or not (parsed.get("background", {}).get("prompt")))
    if need_bg:
        palette = extract_palette_hex(image_path, k=5)
        context = summarize_layout_for_bg(parsed)
        messages = [
            {"role":"system","content":[{"type":"text","text":BG_SYSTEM}]},
            {"role":"user","content":[
                {"type":"image","image": f"file://{image_path}"},
                {"type":"text","text": f"[제품명] {product_name or ''}\n[레이아웃] {context}\n[팔레트] {palette}\n{BG_SCHEMA}"}
            ]}
        ]
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(text=[text], images=image_inputs, videos=video_inputs,
                           padding=True, return_tensors="pt").to(model.device)
        
        first_tokens = min(512, FIRSTPASS_CAP)
        with torch.no_grad():
            out_ids = model.generate(
                **inputs, max_new_tokens=first_tokens, do_sample=True,
                top_p=top_p, temperature=temperature
            )
        gen = processor.batch_decode(out_ids[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]
        
        try:
            s=gen.index("{"); e=gen.rindex("}")+1; bg_plan=json.loads(gen[s:e])
        except Exception:
            bg_plan={"background_prompt": gen[:1200], "negative_prompt":"", "camera":{}, "lighting":{}, "palette": palette, "objects":[]}
        
        parsed.setdefault("background", {})
        parsed["background"].update({
            "prompt": bg_plan.get("background_prompt", ""),
            "negative_prompt": bg_plan.get("negative_prompt", ""),
            "camera": bg_plan.get("camera", parsed.get("background", {}).get("camera", {})),
            "lighting": bg_plan.get("lighting", parsed.get("background", {}).get("lighting", {})),
            "palette": bg_plan.get("palette", palette)
        })
        parsed.setdefault("background_objects", bg_plan.get("objects", parsed.get("background_objects", [])))

    parsed = ensure_background_prompts(parsed, product_name, summarize_layout_for_bg(parsed), min_chars=bg_min_chars)
    
    return parsed