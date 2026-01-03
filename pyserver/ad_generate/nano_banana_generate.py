# nano_banana_generate.py
# Stage 3: Gemini 2.5 Flash Image(= Nano Banana)로 "제품 보존 + 배경 합성"
# Google Gen AI SDK 사용 (Vertex AI 또는 Standard API Key 지원)

import os
import sys
import io
import json
import argparse
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from typing import List

# Google Gen AI SDK
from google import genai
from google.genai.types import GenerateContentConfig, Modality

def get_reserved_rects_px(meta: dict, out_w: int, out_h: int):
    rects = []
    layout = meta.get("layout", {}) or {}
    ng = layout.get("nongraphic_layout", []) or []
    gg = layout.get("graphic_layout", []) or []

    def n2p(b):
        x1 = int(np.clip(b[0], 0, 1) * out_w)
        y1 = int(np.clip(b[1], 0, 1) * out_h)
        x2 = int(np.clip(b[2], 0, 1) * out_w)
        y2 = int(np.clip(b[3], 0, 1) * out_h)
        if x2 < x1: x1, x2 = x2, x1
        if y2 < y1: y1, y2 = y2, y1
        return (x1, y1, x2, y2)

    for t in ng:
        b = t.get("bbox")
        if isinstance(b, list) and len(b) == 4:
            rects.append(n2p(b))
    for g in gg:
        b = g.get("bbox")
        if isinstance(b, list) and len(b) == 4:
            rects.append(n2p(b))
    return rects

def rect_busy_score(img: Image.Image, rects_px):
    if not rects_px:
        return 0.0
    g = img.convert("L")
    a = np.asarray(g, dtype=np.float32) / 255.0
    k = np.array([[0, 1, 0], [1,-4, 1], [0, 1, 0]], dtype=np.float32)
    pad = np.pad(a, ((1,1),(1,1)), mode="reflect")
    conv = (k[0,0]*pad[:-2, :-2] + k[0,1]*pad[:-2,1:-1] + k[0,2]*pad[:-2,2:] +
            k[1,0]*pad[1:-1, :-2] + k[1,1]*pad[1:-1,1:-1] + k[1,2]*pad[1:-1,2:] +
            k[2,0]*pad[2:, :-2] + k[2,1]*pad[2:,1:-1] + k[2,2]*pad[2:,2:])
    conv = np.abs(conv)

    vals = []
    h, w = a.shape
    for (x1,y1,x2,y2) in rects_px:
        x1 = np.clip(x1, 0, w-1); x2 = np.clip(x2, 0, w-1)
        y1 = np.clip(y1, 0, h-1); y2 = np.clip(y2, 0, h-1)
        if x2 <= x1 or y2 <= y1: continue
        patch = conv[y1:y2, x1:x2]
        if patch.size == 0: continue
        vals.append(float(patch.mean()))
    if not vals: return 0.0
    return float(np.mean(vals))

def load_mask(mask_path: str, size):
    m = Image.open(mask_path).convert("L").resize(size, Image.LANCZOS)
    arr = np.array(m, dtype=np.uint8)
    arr = (arr >= 128).astype(np.uint8) * 255
    return Image.fromarray(arr, mode="L")

def composite_product(original_rgb: Image.Image, generated_rgb: Image.Image, product_mask_L: Image.Image):
    return Image.composite(original_rgb, generated_rgb, product_mask_L)

def soften_reserved_areas(img: Image.Image, rects_px, radius=2):
    if not rects_px: return img
    base = img.copy()
    blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
    m = Image.new("L", img.size, 0)
    dr = ImageDraw.Draw(m)
    for (x1,y1,x2,y2) in rects_px:
        dr.rectangle([x1,y1,x2,y2], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(radius=1.5))
    return Image.composite(blurred, base, m)

def pil_from_response(resp):
    cand = getattr(resp, "candidates", None)
    if not cand: return None
    cand = cand[0]
    parts = getattr(cand.content, "parts", []) or []
    for p in parts:
        if getattr(p, "inline_data", None):
            mime = getattr(p.inline_data, "mime_type", "")
            data = getattr(p.inline_data, "data", None)
            if mime and data:
                return Image.open(io.BytesIO(data)).convert("RGB")
    return None

def generate_one(client, model, prompt_text, pil_img, cfg):
    resp = client.models.generate_content(model=model, contents=[prompt_text, pil_img], config=cfg)
    return pil_from_response(resp)

def choose_best_candidate(client, model, prompt_text, input_img_rgb, out_path, meta, args, cfg):
    work_img = resize_max_side(input_img_rgb, args.internal_side)
    best = None
    best_score = 1e9
    rects_px = []

    for round_idx in range(max(1, args.max_retries)):
        candidates = []
        for i in range(args.candidates):
            print(f"... generating candidate {i+1}/{args.candidates} (round {round_idx+1}) ...")
            try:
                cand_img = generate_one(client, model, prompt_text, work_img, cfg)
            except Exception as e:
                print(f"Generate Error: {e}")
                continue
                
            if cand_img is None: continue
            
            # (옵션) 후보 이미지 저장 - 디버깅용
            # root, ext = os.path.splitext(out_path)
            # cand_path = f"{root}_cand{i+1}_r{round_idx+1}.png"
            # cand_img.save(cand_path)
            
            candidates.append(cand_img)

        if not candidates: continue

        rects_px = get_reserved_rects_px(meta, candidates[0].width, candidates[0].height)
        survivors = []
        for i, imgc in enumerate(candidates):
            sc = rect_busy_score(imgc, rects_px)
            print(f"   candidate#{i+1} busy_score={sc:.4f}")
            if sc <= args.busy_threshold:
                survivors.append((sc, imgc, i))
            if sc < best_score:
                best_score = sc
                best = imgc

        if survivors:
            survivors.sort(key=lambda x: x[0])
            best_score, best, best_idx = survivors[0]
            print(f" -> picked candidate#{best_idx+1} with busy_score={best_score:.4f}")
            break
        else:
            print("   no survivor under threshold; retrying...")

    if best is None:
        raise RuntimeError("No image could be generated.")

    if best_score > args.busy_threshold and args.post_blur_reserved:
        print(f" busy_score {best_score:.4f} > threshold; softening reserved areas...")
        best = soften_reserved_areas(best, rects_px, radius=2)

    return best

def resize_max_side(img: Image.Image, max_side: int = 1024) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_side: return img
    if w >= h:
        nh = int(h * max_side / w)
        return img.resize((max_side, nh), Image.LANCZOS)
    else:
        nw = int(w * max_side / h)
        return img.resize((nw, max_side), Image.LANCZOS)

def build_prompt(meta: dict) -> str:
    product = meta.get("product", {})
    background = meta.get("background", {}) or {}
    layout = meta.get("layout", {}) or {}
    subj = layout.get("subject_layout", {}) or {}
    ng = layout.get("nongraphic_layout", []) or []
    gg = layout.get("graphic_layout", []) or []
    bg_objs = meta.get("background_objects", []) or []

    negative_rects = []
    for t in ng:
        b = t.get("bbox")
        if isinstance(b, list) and len(b) == 4:
            negative_rects.append({"type": t.get("type", "text"), "bbox": b})
    for g in gg:
        b = g.get("bbox")
        if isinstance(b, list) and len(b) == 4:
            negative_rects.append({"type": g.get("type", "graphic"), "bbox": b, "for": g.get("for", None)})

    ideal_color = background.get("ideal_color")
    texture = background.get("texture")
    lighting = background.get("lighting", {})
    lighting_type = lighting.get("type")
    lighting_dir = lighting.get("direction")
    style = background.get("style")
    bg_prompt = background.get("prompt")
    neg_prompt = background.get("negative_prompt")
    camera = background.get("camera", {})
    cam_angle = camera.get("angle")
    cam_distance = camera.get("distance")
    palette = background.get("palette", [])

    system_text = (
    "You are an advertising image compositor.\n"
    "Strictly REPLACE the entire background with the requested style while preserving the product pixels.\n"
    "Do NOT render any text, logos, underlay shapes, panels, boxes, stickers, banners, labels, rectangles, rounded rectangles, watermarks, or UI elements anywhere.\n"
    "Reserved areas must be visually indistinguishable from the surrounding background: "
    "seamlessly continue the same texture/color/noise (no panels, no solid fills, no transparency, no borders, no gradients, no shadows).\n"
    "Do NOT letterbox, pad, or add borders."
    )

    rules = [
    "- Preserve the foreground product EXACTLY (pixel-preserve). No redraw/smoothing.",
    "- The original table/surface must disappear (full background replacement).",
    "- Reserved areas: inpaint with matching background (NO rectangles/panels/solid blocks/alpha).",
    "- Follow subject_layout center/ratio for framing and composition.",
    "- No vignettes, borders, or drop shadows unless explicitly asked.",
    "- Output a single photorealistic image; same or higher resolution than input."
    ]

    spec_lines = []
    if ideal_color:   spec_lines.append(f"- Ideal background color: {ideal_color}.")
    if texture:       spec_lines.append(f"- Texture: {texture}.")
    if style:         spec_lines.append(f"- Style: {style}.")
    if lighting_type: spec_lines.append(f"- Lighting: {lighting_type}.")
    if lighting_dir:  spec_lines.append(f"- Key light direction: {lighting_dir}.")
    if cam_angle:     spec_lines.append(f"- Camera angle: {cam_angle}.")
    if cam_distance:  spec_lines.append(f"- Camera distance: {cam_distance}.")
    if palette:       spec_lines.append(f"- Prefer palette: {', '.join(palette)}.")
    if bg_prompt:     spec_lines.append(f"- Positive prompt: {bg_prompt}")
    if neg_prompt:    spec_lines.append(f"- Negative prompt: {neg_prompt}")

    obj_lines = []
    for obj in bg_objs:
        name = obj.get("name")
        style_o = obj.get("style")
        bbox_hint = obj.get("bbox_hint")
        depth = obj.get("depth")
        notes = obj.get("notes")
        line = f"- Optional background object: {name}"
        if style_o:   line += f" (style: {style_o})"
        if depth:     line += f", depth: {depth}"
        if bbox_hint: line += f", place within bbox_hint {bbox_hint}"
        if notes:     line += f", notes: {notes}"
        obj_lines.append(line + ".")

    user_text = (
        "TASK: Replace the background completely while preserving the product.\n\n"
        f"PRODUCT:\n{json.dumps(product, ensure_ascii=False)}\n\n"
        "BACKGROUND SPEC:\n" + "\n".join(spec_lines) + "\n\n"
        f"SUBJECT LAYOUT (normalized 0~1):\n{json.dumps({'subject_layout': subj}, ensure_ascii=False)}\n\n"
        f"RESERVED NEGATIVE SPACES (do NOT mark or visualize; fill seamlessly with the same background):\n"
        f"{json.dumps(negative_rects, ensure_ascii=False)}\n\n"
        "BACKGROUND OBJECTS (optional):\n" + ("\n".join(obj_lines) if obj_lines else "(none)") + "\n\n"
        "RULES:\n" + "\n".join(rules)
    )

    return system_text + "\n\n" + user_text

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--layout_json", required=True)
    ap.add_argument("--out", default="stage3_output.png")
    ap.add_argument("--max_side", type=int, default=1024)
    ap.add_argument("--model", default="gemini-2.0-flash-exp") # 모델명 기본값 수정
    ap.add_argument("--internal_side", type=int, default=1536)
    ap.add_argument("--candidates", type=int, default=4)
    ap.add_argument("--max_retries", type=int, default=1)
    ap.add_argument("--busy_threshold", type=float, default=0.12)
    ap.add_argument("--mask", default=None)
    ap.add_argument("--post_blur_reserved", action="store_true")

    args = ap.parse_args()

    # ★★★ API Key 인증 방식 우선 적용 (RunPod용) ★★★
    api_key = os.environ.get("GEMINI_API_KEY")

    if api_key:
        print(f"--- [Nano] Using GEMINI_API_KEY mode ---")
        client = genai.Client(api_key=api_key)
    else:
        # 기존 Vertex AI 방식 (로컬 개발용 or 인증 파일이 있을 때)
        print(f"--- [Nano] Using Vertex AI mode (Checking env vars...) ---")
        need_vars = ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "GOOGLE_GENAI_USE_VERTEXAI"]
        missing = [v for v in need_vars if not os.environ.get(v)]
        if missing:
            print(f"ERROR: Missing API Key OR Vertex Env Vars: {', '.join(missing)}")
            print("Please set GEMINI_API_KEY in RunPod environment variables.")
            sys.exit(1)
            
        client = genai.Client(
            vertexai=True,
            project=os.environ["GOOGLE_CLOUD_PROJECT"],
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "global"),
        )

    # 입력 로드
    try:
        with open(args.layout_json, "r", encoding="utf-8") as f:
            meta = json.load(f)
    except Exception as e:
        print(f"Layout load failed: {e}")
        sys.exit(1)

    try:
        img = Image.open(args.image).convert("RGB")
    except Exception as e:
        print(f"Image load failed: {e}")
        sys.exit(1)

    original_rgb = img.copy()
    img = resize_max_side(img, args.max_side)
    
    prompt_text = build_prompt(meta)

    cfg = GenerateContentConfig(
        response_modalities=[Modality.TEXT, Modality.IMAGE],
        candidate_count=1,
    )

    print(f"... Requesting '{args.model}' ...")
    try:
        best_img = choose_best_candidate(
            client=client,
            model=args.model,
            prompt_text=prompt_text,
            input_img_rgb=original_rgb,
            out_path=args.out,
            meta=meta,
            args=args,
            cfg=cfg
        )
    except Exception as e:
        print(f"Generation Failed: {e}")
        sys.exit(1)

    if args.mask and os.path.exists(args.mask):
        try:
            pmask = load_mask(args.mask, best_img.size)
            best_img = composite_product(original_rgb.resize(best_img.size, Image.LANCZOS), best_img, pmask)
        except Exception:
            pass

    best_img.save(args.out)
    print(f"--- [Nano] Success: {args.out} ---")

if __name__ == "__main__":
    main()