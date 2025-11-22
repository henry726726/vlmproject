# nano_banana_generate.py
# Stage 3: Gemini 2.5 Flash Image(= Nano Banana)로 "제품 보존 + 배경 합성"
# Google Gen AI SDK + Vertex AI 백엔드 사용

import os
import sys
import io
import json
import argparse
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from typing import List

# Google Gen AI SDK (Vertex 사용은 환경변수로 전환)
from google import genai
from google.genai.types import GenerateContentConfig, Modality

def get_reserved_rects_px(meta: dict, out_w: int, out_h: int):
    rects = []
    layout = meta.get("layout", {}) or {}
    ng = layout.get("nongraphic_layout", []) or []
    gg = layout.get("graphic_layout", []) or []

    def n2p(b):
        # b = [x1, y1, x2, y2] normalized 0~1
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
    # 간단한 라플라시안 커널
    k = np.array([[0, 1, 0],
                  [1,-4, 1],
                  [0, 1, 0]], dtype=np.float32)
    # same padding
    pad = np.pad(a, ((1,1),(1,1)), mode="reflect")
    # 2D conv
    conv = (k[0,0]*pad[:-2, :-2] + k[0,1]*pad[:-2,1:-1] + k[0,2]*pad[:-2,2:] +
            k[1,0]*pad[1:-1, :-2] + k[1,1]*pad[1:-1,1:-1] + k[1,2]*pad[1:-1,2:] +
            k[2,0]*pad[2:, :-2] + k[2,1]*pad[2:,1:-1] + k[2,2]*pad[2:,2:])
    conv = np.abs(conv)

    vals = []
    h, w = a.shape
    for (x1,y1,x2,y2) in rects_px:
        x1 = np.clip(x1, 0, w-1); x2 = np.clip(x2, 0, w-1)
        y1 = np.clip(y1, 0, h-1); y2 = np.clip(y2, 0, h-1)
        if x2 <= x1 or y2 <= y1: 
            continue
        patch = conv[y1:y2, x1:x2]
        if patch.size == 0: 
            continue
        # 평균 절대 라플라시안값이 높을수록 "복잡"
        vals.append(float(patch.mean()))
    if not vals:
        return 0.0
    return float(np.mean(vals))

def load_mask(mask_path: str, size):
    # mask_path(옵션): 흑백/알파 이미지 (255=제품, 0=배경)
    m = Image.open(mask_path).convert("L").resize(size, Image.LANCZOS)
    # 이진화(살짝 관용): 128 이상을 제품으로
    arr = np.array(m, dtype=np.uint8)
    arr = (arr >= 128).astype(np.uint8) * 255
    return Image.fromarray(arr, mode="L")

def composite_product(original_rgb: Image.Image, generated_rgb: Image.Image, product_mask_L: Image.Image):
    # product_mask=255 영역은 original에서 가져오고, 0은 generated 유지
    return Image.composite(original_rgb, generated_rgb, product_mask_L)

def soften_reserved_areas(img: Image.Image, rects_px, radius=2):
    if not rects_px:
        return img
    base = img.copy()
    blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
    m = Image.new("L", img.size, 0)
    dr = ImageDraw.Draw(m)
    for (x1,y1,x2,y2) in rects_px:
        dr.rectangle([x1,y1,x2,y2], fill=255)
    # 경계부만 살짝 더 부드럽게: 마스크에 가우시안 블러 한 번 더
    m = m.filter(ImageFilter.GaussianBlur(radius=1.5))
    return Image.composite(blurred, base, m)  # m=255일수록 blurred를 채택

def pil_from_response(resp):
    cand = getattr(resp, "candidates", None)
    if not cand:
        return None
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
    # 한 번 호출해서 PIL 이미지 리턴
    resp = client.models.generate_content(model=model, contents=[prompt_text, pil_img], config=cfg)
    return pil_from_response(resp)

def choose_best_candidate(client, model, prompt_text, input_img_rgb, out_path, meta, args, cfg):
    # 1) 내부 작업 해상도 적용
    work_img = resize_max_side(input_img_rgb, args.internal_side)

    # 2) 후보 생성
    best = None
    best_score = 1e9
    rects_px = []  # 후보 결과의 사이즈가 같다고 가정(모델이 입력 비율 유지)
    for round_idx in range(max(1, args.max_retries)):
        candidates = []
        for i in range(args.candidates):
            print(f"... generating candidate {i+1}/{args.candidates} (round {round_idx+1}) ...")
            cand_img = generate_one(client, model, prompt_text, work_img, cfg)
            if cand_img is None:
                continue
            # 후보 저장(디버깅용)
            root, ext = os.path.splitext(out_path)
            cand_path = f"{root}_cand{i+1}_r{round_idx+1}.png"
            cand_img.save(cand_path)
            print(f"   saved candidate: {cand_path}")
            candidates.append(cand_img)

        if not candidates:
            continue

        # 3) 품질 스코어링
        #    - 텍스트 박스 busy score 계산 위해 후보 크기에 맞춘 rects_px 산출
        rects_px = get_reserved_rects_px(meta, candidates[0].width, candidates[0].height)
        survivors = []
        for i, imgc in enumerate(candidates):
            sc = rect_busy_score(imgc, rects_px)
            print(f"   candidate#{i+1} busy_score={sc:.4f}")
            if sc <= args.busy_threshold:
                survivors.append((sc, imgc, i))
            # best 후보 후보군 갱신(탈락해도 기록)
            if sc < best_score:
                best_score = sc
                best = imgc

        if survivors:
            # 가장 낮은 busy_score 선택
            survivors.sort(key=lambda x: x[0])
            best_score, best, best_idx = survivors[0]
            print(f" → picked candidate#{best_idx+1} with busy_score={best_score:.4f}")
            break
        else:
            print("   no survivor under threshold; retrying...")

    if best is None:
        raise RuntimeError("No image could be generated.")

    # 4) 임계치 넘는 경우, 완화 처리(옵션)
    if best_score > args.busy_threshold and args.post_blur_reserved:
        print(f" busy_score {best_score:.4f} > threshold; softening reserved areas...")
        best = soften_reserved_areas(best, rects_px, radius=2)

    return best

# ----------------------------
# 이미지 리사이즈 (최대 변 기준, 비율 유지)
# ----------------------------
def resize_max_side(img: Image.Image, max_side: int = 1024) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_side:
        return img
    if w >= h:
        nh = int(h * max_side / w)
        return img.resize((max_side, nh), Image.LANCZOS)
    else:
        nw = int(w * max_side / h)
        return img.resize((nw, max_side), Image.LANCZOS)

# ----------------------------
# 프롬프트 구성 (제품만 남기고 배경 합성, 텍스트/로고 금지)
# ----------------------------
def build_prompt(meta: dict) -> str:
    product = meta.get("product", {})
    background = meta.get("background", {}) or {}
    layout = meta.get("layout", {}) or {}
    subj = layout.get("subject_layout", {}) or {}
    ng = layout.get("nongraphic_layout", []) or []
    gg = layout.get("graphic_layout", []) or []
    bg_objs = meta.get("background_objects", []) or []

    # 1) 예약/금지 영역 수집 (문구/로고/언더레이 모두 '비워둘 영역')
    negative_rects = []
    for t in ng:
        b = t.get("bbox")
        if isinstance(b, list) and len(b) == 4:
            negative_rects.append({
                "type": t.get("type", "text"),
                "bbox": b
            })
    for g in gg:
        b = g.get("bbox")
        if isinstance(b, list) and len(b) == 4:
            # underlay도 Stage3에서는 그리지 않도록 'reserved' 처리
            negative_rects.append({
                "type": g.get("type", "graphic"),
                "bbox": b,
                "for": g.get("for", None)
            })

    # 2) 배경 세부 스펙 정리
    ideal_color   = background.get("ideal_color")
    texture       = background.get("texture")
    lighting      = background.get("lighting", {})
    lighting_type = lighting.get("type")
    lighting_dir  = lighting.get("direction")
    style         = background.get("style")
    bg_prompt     = background.get("prompt")
    neg_prompt    = background.get("negative_prompt")
    camera        = background.get("camera", {})
    cam_angle     = camera.get("angle")
    cam_distance  = camera.get("distance")
    palette       = background.get("palette", [])

    # 3) 시스템 지시(핵심 규칙)
    system_text = (
    "You are an advertising image compositor.\n"
    "Strictly REPLACE the entire background with the requested style while preserving the product pixels.\n"
    "Do NOT render any text, logos, underlay shapes, panels, boxes, stickers, banners, labels, rectangles, rounded rectangles, watermarks, or UI elements anywhere.\n"
    "Reserved areas must be visually indistinguishable from the surrounding background: "
    "seamlessly continue the same texture/color/noise (no panels, no solid fills, no transparency, no borders, no gradients, no shadows).\n"
    "Do NOT letterbox, pad, or add borders."
    )


    # 4) 룰/제약
    rules = [
    "- Preserve the foreground product EXACTLY (pixel-preserve). No redraw/smoothing.",
    "- The original table/surface must disappear (full background replacement).",
    "- Reserved areas: inpaint with matching background (NO rectangles/panels/solid blocks/alpha).",
    "- Follow subject_layout center/ratio for framing and composition.",
    "- No vignettes, borders, or drop shadows unless explicitly asked.",
    "- Output a single photorealistic image; same or higher resolution than input."
    ]


    # 5) 배경 스펙/카메라/팔레트/네거티브 프롬프트 반영
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

    # 6) 배경 오브젝트 지시 (제품 뒤에만, 텍스트 박스/subject와 IoU 제한)
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

    # 7) 사용자 지시문(메타 정보 삽입)
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


# ----------------------------
# 첫 이미지 파트 저장
# ----------------------------
def save_first_image_part(resp, out_path: str) -> bool:
    cand = None
    if getattr(resp, "candidates", None):
        cand = resp.candidates[0]
    if not cand or not getattr(cand, "content", None):
        return False

    parts = getattr(cand.content, "parts", []) or []
    for p in parts:
        # TEXT or IMAGE가 섞여서 나옵니다. (이미지 전용은 지원X)  :contentReference[oaicite:5]{index=5}
        if getattr(p, "inline_data", None):
            mime = getattr(p.inline_data, "mime_type", "")
            data = getattr(p.inline_data, "data", None)
            if mime and data:
                ext = mime.split("/")[-1].lower().replace("jpeg", "jpg")
                root, _ = os.path.splitext(out_path)
                out_file = f"{root}.{ext}"
                with open(out_file, "wb") as f:
                    f.write(data)
                print(f" [저장 완료] {out_file}")
                return True
    return False

# ----------------------------
# 메인
# ----------------------------
def main():
    ap = argparse.ArgumentParser(description="Stage 3 with Gemini 2.5 Flash Image (Vertex backend via google-genai).")
    ap.add_argument("--image", required=True, help="Path to the product foreground image.")
    ap.add_argument("--layout_json", required=True, help="Path to the layout JSON file.")
    ap.add_argument("--out", default="stage3_output.png", help="Output file path (extension adapts to returned MIME).")
    ap.add_argument("--max_side", type=int, default=1024, help="Max side length for resizing input image.")
    ap.add_argument("--model", default="gemini-2.5-flash-image-preview", help="Model id.")

    # ▼ 품질 게이트 / 퀵윈 관련 옵션들 (이미 추가했다면 중복 제거)
    ap.add_argument("--internal_side", type=int, default=1536, help="Internal working max side for generation (hires).")
    ap.add_argument("--candidates", type=int, default=4, help="How many candidates to generate and score.")
    ap.add_argument("--max_retries", type=int, default=1, help="If all candidates fail quality gates, retry N rounds.")
    ap.add_argument("--busy_threshold", type=float, default=0.12, help="Max allowed high-frequency energy in reserved areas.")
    ap.add_argument("--mask", default=None, help="Optional 1-channel product mask (white=product).")
    ap.add_argument("--post_blur_reserved", action="store_true", help="If reserved areas are too busy, softly blur them.")

    args = ap.parse_args()

    # 환경변수 점검 (Vertex 백엔드 사용 설정)
    need_vars = ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "GOOGLE_GENAI_USE_VERTEXAI"]
    missing = [v for v in need_vars if not os.environ.get(v)]
    if missing:
        print(f" 환경변수 누락: {', '.join(missing)}")
        print("   예) PowerShell:")
        print('   $env:GOOGLE_CLOUD_PROJECT="nano-471710"')
        print('   $env:GOOGLE_CLOUD_LOCATION="global"')
        print('   $env:GOOGLE_GENAI_USE_VERTEXAI="True"')
        sys.exit(1)

    # 인증(ADC) 점검은 SDK가 진행. 실패 시 예외 발생.
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
        print(f" 레이아웃 JSON 로드 실패: {e}")
        sys.exit(1)

    try:
        img = Image.open(args.image).convert("RGB")
    except Exception as e:
        print(f" 이미지 로드 실패({args.image}): {e}")
        sys.exit(1)

    # 원본 보관(마스크 합성용)
    original_rgb = img.copy()

    # 내부 리사이즈(생성 품질용)와 프롬프트 생성
    img = resize_max_side(img, args.max_side)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    _ = buf.getvalue()  # (SDK에 PIL 직접 전달하므로 bytes는 사용 안 해도 됨)

    prompt_text = build_prompt(meta)

    cfg = GenerateContentConfig(
        response_modalities=[Modality.TEXT, Modality.IMAGE],
        candidate_count=1,  # 여러 장은 반복 호출로 뽑음
    )

    print(f"... Requesting '{args.model}' (Vertex backend) with {args.candidates} candidates ...")
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
        print(f" [후보 생성 실패] {e}")
        print("   - 모델/리전/인증/결제를 점검하세요.")
        sys.exit(1)

    # 제품 마스크가 있으면: 결과 위에 원본 제품을 복원(픽셀 보존)
    if args.mask and os.path.exists(args.mask):
        try:
            pmask = load_mask(args.mask, best_img.size)
            best_img = composite_product(original_rgb.resize(best_img.size, Image.LANCZOS), best_img, pmask)
            print(" [합성] 원본 제품을 결과 위에 복원(제품 픽셀 보존).")
        except Exception as e:
            print(f" [제품 합성 실패] {e}")

    # 최종 저장
    best_img.save(args.out)
    print(f" [저장 완료] {args.out}")


if __name__ == "__main__":
    main()
