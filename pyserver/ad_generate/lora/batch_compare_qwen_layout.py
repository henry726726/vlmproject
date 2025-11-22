# -*- coding: utf-8 -*-
"""
postprocess_layout_json.py
- 광고 레이아웃 JSON(모델 출력)을 후처리:
  * 텍스트-로고 분리 (IoU>thr → 반대 방향 밀어내기)
  * 정렬 스냅 (cx,cy → {0.1,0.5,0.9}, tol 내인 경우)
  * 면적 클램프 (텍스트/로고 스윗스팟 범위로 스케일)
  * AR 제약 (text>=2.0, logo∈[0.8,2.2])
  * 마진 (min margin from edges ≥ 0.06)
  * 주제(상품)과의 겹침 억제 (IoU≤0.15)
- 입력: 단일 JSON 또는 폴더(재귀적으로 *.json 처리)
- 출력: 기본은 파일명에 .pp.json 붙여 저장(또는 --out_dir 지정)

사용 예)
  # 단일 파일
  python postprocess_layout_json.py --in_json .\_cmp_out\json\lora\0.jpg.lora.json

  # 디렉터리 전체 처리 (재귀)
  python postprocess_layout_json.py --in_json .\_cmp_out\json\lora --out_dir .\_cmp_out\json\lora_pp

  # base와 lora를 각각 처리
  python postprocess_layout_json.py --in_json .\_cmp_out\json\base --out_dir .\_cmp_out\json\base_pp
  python postprocess_layout_json.py --in_json .\_cmp_out\json\lora --out_dir .\_cmp_out\json\lora_pp
"""

import os, json, math, argparse, glob
from typing import List, Dict, Any, Tuple

# =============== geometry utils ===============
def clip01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))

def clip_box_xywh(b):
    if not b: return None
    x,y,w,h = map(float, b)
    x=clip01(x); y=clip01(y); w=clip01(w); h=clip01(h)
    if x+w>1: w=max(0.0, 1-x)
    if y+h>1: h=max(0.0, 1-y)
    return [x,y,w,h]

def iou_xywh(b1, b2) -> float:
    if not b1 or not b2: return 0.0
    x1,y1,w1,h1 = b1; x2,y2,w2,h2 = b2
    xa = max(x1,x2); ya = max(y1,y2)
    xb = min(x1+w1, x2+w2); yb = min(y1+h1, x2+w2 if False else y2+h2)  # fixed below
    # ↑ 오타 방지: 다음 줄로 대체
    xb = min(x1+w1, x2+w2); yb = min(y1+h1, y2+h2)
    inter = max(0.0, xb-xa) * max(0.0, yb-ya)
    den = max(0.0, w1*h1) + max(0.0, w2*h2) - inter
    return inter/den if den>0 else 0.0

def area(b) -> float:
    return 0.0 if not b else max(0.0, float(b[2])*float(b[3]))

def center(b):
    x,y,w,h = b
    return (x + w/2.0, y + h/2.0)

def from_center(cx, cy, w, h):
    x = clip01(cx - w/2.0)
    y = clip01(cy - h/2.0)
    return clip_box_xywh([x,y,w,h])

def move(b, dx, dy, min_margin=0.0):
    """중심을 이동. 마진 고려하여 벽에 닿으면 clamp."""
    x,y,w,h = b
    cx,cy = center(b)
    cx = clip01(cx + dx)
    cy = clip01(cy + dy)
    x = cx - w/2.0; y = cy - h/2.0
    # 마진 클램프
    x = max(min_margin, min(x, 1.0 - min_margin - w))
    y = max(min_margin, min(y, 1.0 - min_margin - h))
    return [x,y,w,h]

def snap_to_grid(cx, cy, guides=(0.1,0.5,0.9), tol=0.03):
    def nearest(v):
        g = min(guides, key=lambda g: abs(g - v))
        d = abs(g - v)
        return (g, d)
    gx, dx = nearest(cx)
    gy, dy = nearest(cy)
    cx2 = gx if dx <= tol else cx
    cy2 = gy if dy <= tol else cy
    return cx2, cy2

def clamp_area_ar_keep_center(b, target_area, ar_min=None, ar_max=None, min_margin=0.0):
    """중심 고정, area/AR 제약을 모두 만족하도록 w,h 결정."""
    x,y,w,h = b
    cx, cy = center(b)
    # 현재 AR
    cur_ar = (w / h) if h>0 else 1.0
    # 새 AR 범위 설정
    if ar_min is not None and ar_max is not None:
        new_ar = min(max(cur_ar, ar_min), ar_max)
    elif ar_min is not None:
        new_ar = max(cur_ar, ar_min)
    elif ar_max is not None:
        new_ar = min(cur_ar, ar_max)
    else:
        new_ar = cur_ar if cur_ar>0 else 1.0

    A = max(target_area, 1e-6)
    new_w = math.sqrt(A * new_ar)
    new_h = new_w / new_ar

    # 화면 경계와 마진 고려 (필요시 살짝 축소)
    max_w = 1.0 - 2*min_margin
    max_h = 1.0 - 2*min_margin
    if new_w > max_w:
        scale = max_w / new_w
        new_w *= scale; new_h *= scale
    if new_h > max_h:
        scale = max_h / new_h
        new_w *= scale; new_h *= scale

    return from_center(cx, cy, new_w, new_h)

def ensure_min_margin(b, min_margin) -> List[float]:
    x,y,w,h = b
    x = max(min_margin, min(x, 1.0 - min_margin - w))
    y = max(min_margin, min(y, 1.0 - min_margin - h))
    return [x,y,w,h]

def unit_vec(from_pt, to_pt):
    dx = to_pt[0] - from_pt[0]
    dy = to_pt[1] - from_pt[1]
    n = math.hypot(dx, dy)
    if n < 1e-6: return (0.0, 0.0)
    return (dx/n, dy/n)

# =============== JSON helpers ===============
def load_json(path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def dump_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_layout(js):
    lay = js.get("layout") or {}
    return lay

def get_headlines(js) -> List[Dict[str,Any]]:
    ng = (js.get("layout") or {}).get("nongraphic_layout") or []
    return [it for it in ng if (it.get("type") or "").lower()=="headline" and isinstance(it.get("bbox"), list) and len(it["bbox"])==4]

def get_logos(js) -> List[Dict[str,Any]]:
    gr = (js.get("layout") or {}).get("graphic_layout") or []
    return [it for it in gr if (it.get("type") or "").lower()=="logo" and isinstance(it.get("bbox"), list) and len(it["bbox"])==4]

def get_underlays(js) -> List[Dict[str,Any]]:
    gr = (js.get("layout") or {}).get("graphic_layout") or []
    return [it for it in gr if (it.get("type") or "").lower()=="underlay" and isinstance(it.get("bbox"), list) and len(it["bbox"])==4]

def set_box(it, b):
    it["bbox"] = [round(float(v), 6) for v in b]

def subject_boxes(js) -> List[List[float]]:
    lay = js.get("layout") or {}
    subj = lay.get("subject_layout")
    out=[]
    # 패턴 A) {"center":[cx,cy],"ratio":[w,h]}
    if isinstance(subj, dict) and "center" in subj and "ratio" in subj:
        cx, cy = subj["center"]
        rw, rh = subj["ratio"]
        out.append(clip_box_xywh([cx - rw/2.0, cy - rh/2.0, rw, rh]))
    # 패턴 B) subject를 항목으로 두는 경우
    for sec in ["subject_layout", "nongraphic_layout", "graphic_layout"]:
        items = lay.get(sec)
        if isinstance(items, list):
            for it in items:
                if (it.get("type") or "").lower()=="subject" and isinstance(it.get("bbox"), list) and len(it["bbox"])==4:
                    out.append(clip_box_xywh(it["bbox"]))
    return [b for b in out if b]

# =============== pairing & metrics ===============
def pair_by_nearest(heads: List[Dict[str,Any]], logos: List[Dict[str,Any]]) -> List[Tuple[int,int]]:
    """headline 인덱스와 가장 가까운 logo 인덱스를 그리디 매칭."""
    pairs=[]
    used_logo=set()
    for hi,h in enumerate(heads):
        hc = center(clip_box_xywh(h["bbox"]))
        # 가장 가까운 로고 찾기
        best, best_d = -1, 1e9
        for li,l in enumerate(logos):
            if li in used_logo: continue
            lc = center(clip_box_xywh(l["bbox"]))
            d = math.hypot(hc[0]-lc[0], hc[1]-lc[1])
            if d < best_d:
                best, best_d = li, d
        if best>=0:
            pairs.append((hi, best))
            used_logo.add(best)
    return pairs

def ali_score(boxes: List[List[float]], guides=(0.1,0.5,0.9), tol=0.03):
    """정렬 점수: 가이드에 tol 이내로 붙은 축(x 또는 y)이 있으면 1, 아니면 0; 평균."""
    if not boxes: return float("nan")
    sc=[]
    for b in boxes:
        cx,cy = center(b)
        ax = min(abs(cx - g) for g in guides)
        ay = min(abs(cy - g) for g in guides)
        sc.append(1.0 if (ax<=tol or ay<=tol) else 0.0)
    return sum(sc)/len(sc)

# =============== post-process steps ===============
def postprocess_one(js: Dict[str,Any],
                    iou_thr_tl=0.15,
                    sep_step=0.01,
                    sep_iters=60,
                    guides=(0.1,0.5,0.9),
                    snap_tol=0.03,
                    text_area_range=(0.06,0.16),
                    logo_area_range=(0.02,0.06),
                    text_ar_min=2.0,
                    logo_ar_min=0.8,
                    logo_ar_max=2.2,
                    min_margin=0.06,
                    subj_iou_thr=0.15,
                    update_underlay=False) -> Dict[str,Any]:

    log = {"pre":{}, "post":{}, "ops":[]}

    heads = get_headlines(js)
    logos = get_logos(js)
    subs  = subject_boxes(js)

    # clip
    for it in heads: set_box(it, clip_box_xywh(it["bbox"]))
    for it in logos: set_box(it, clip_box_xywh(it["bbox"]))

    # ------- pre metrics -------
    def cur_metrics():
        # headline/로고 첫 개 위주로 요약
        hb = clip_box_xywh(heads[0]["bbox"]) if heads else None
        lb = clip_box_xywh(logos[0]["bbox"]) if logos else None
        iou_tl = iou_xywh(hb, lb) if (hb and lb) else 0.0
        iou_st = max((iou_xywh(hb, s) for s in subs), default=0.0) if hb else 0.0
        iou_sl = max((iou_xywh(lb, s) for s in subs), default=0.0) if lb else 0.0
        ali = ali_score(([hb] if hb else []) + ([lb] if lb else []), guides, snap_tol)
        return {
            "area_text": area(hb) if hb else 0.0,
            "area_logo": area(lb) if lb else 0.0,
            "iou_text_logo": iou_tl,
            "iou_subject_text": iou_st,
            "iou_subject_logo": iou_sl,
            "ali": ali
        }
    log["pre"] = cur_metrics()

    # ------- 1) area clamp + AR constraints -------
    for it in heads:
        b = clip_box_xywh(it["bbox"])
        A = area(b)
        lo, hi = text_area_range
        target = A
        if A < lo: target = lo
        if A > hi: target = hi
        b2 = clamp_area_ar_keep_center(b, target, ar_min=text_ar_min, ar_max=None, min_margin=min_margin)
        b2 = ensure_min_margin(b2, min_margin)
        set_box(it, b2)
        if abs(area(b2)-A) > 1e-6: log["ops"].append("text_area_clamp")

    for it in logos:
        b = clip_box_xywh(it["bbox"])
        A = area(b)
        lo, hi = logo_area_range
        target = A
        if A < lo: target = lo
        if A > hi: target = hi
        b2 = clamp_area_ar_keep_center(b, target, ar_min=logo_ar_min, ar_max=logo_ar_max, min_margin=min_margin)
        b2 = ensure_min_margin(b2, min_margin)
        set_box(it, b2)
        if abs(area(b2)-A) > 1e-6: log["ops"].append("logo_area_clamp")

    # ------- 2) edge margin -------
    changed=False
    for it in heads:
        b=ensure_min_margin(clip_box_xywh(it["bbox"]), min_margin)
        if b!=it["bbox"]:
            set_box(it,b); changed=True
    for it in logos:
        b=ensure_min_margin(clip_box_xywh(it["bbox"]), min_margin)
        if b!=it["bbox"]:
            set_box(it,b); changed=True
    if changed: log["ops"].append("margin_enforced")

    # ------- 3) text-logo separation (pairwise) -------
    pairs = pair_by_nearest(heads, logos)
    for hi, li in pairs:
        hb = clip_box_xywh(heads[hi]["bbox"])
        lb = clip_box_xywh(logos[li]["bbox"])
        if not hb or not lb: continue
        # 반복 밀어내기
        iters=0
        while iou_xywh(hb, lb) > iou_thr_tl and iters < sep_iters:
            hc = center(hb); lc = center(lb)
            ux, uy = unit_vec(lc, hc)  # 로고→텍스트 방향 단위벡터
            # 서로 반대 방향으로 이동
            hb = move(hb, +sep_step*ux, +sep_step*uy, min_margin=min_margin)
            lb = move(lb, -sep_step*ux, -sep_step*uy, min_margin=min_margin)
            iters += 1
        set_box(heads[hi], hb); set_box(logos[li], lb)
        if iters>0: log["ops"].append(f"sep_text_logo:{iters}")

    # ------- 4) subject separation -------
    if subs:
        subj = subs[0]  # 첫 주제 박스 사용
        for it in heads:
            hb = clip_box_xywh(it["bbox"]); iters=0
            while iou_xywh(hb, subj) > subj_iou_thr and iters < sep_iters:
                hc = center(hb); sc = center(subj)
                ux, uy = unit_vec(sc, hc)  # 주제→텍스트 방향
                hb = move(hb, +sep_step*ux, +sep_step*uy, min_margin=min_margin)
                iters += 1
            set_box(it, hb)
            if iters>0: log["ops"].append(f"sep_text_subject:{iters}")
        for it in logos:
            lb = clip_box_xywh(it["bbox"]); iters=0
            while iou_xywh(lb, subj) > subj_iou_thr and iters < sep_iters:
                lc = center(lb); sc = center(subj)
                ux, uy = unit_vec(sc, lc)
                lb = move(lb, +sep_step*ux, +sep_step*uy, min_margin=min_margin)
                iters += 1
            set_box(it, lb)
            if iters>0: log["ops"].append(f"sep_logo_subject:{iters}")

    # ------- 5) alignment snap -------
    for it in heads + logos:
        b = clip_box_xywh(it["bbox"])
        cx, cy = center(b)
        cx2, cy2 = snap_to_grid(cx, cy, guides=guides, tol=snap_tol)
        if (cx2,cy2)!=(cx,cy):
            b = from_center(cx2, cy2, b[2], b[3])
            b = ensure_min_margin(b, min_margin)
            set_box(it, b)
            log["ops"].append("snap")

    # ------- 6) optional: underlay sync -------
    if update_underlay:
        # headline#k 매칭이 없는 underlay는 가장 IoU 높은 헤드라인을 찾아 bbox를 패딩 확장
        gr = (js.get("layout") or {}).get("graphic_layout") or []
        heads_boxes = [clip_box_xywh(it["bbox"]) for it in heads]
        for u in get_underlays(js):
            ref = u.get("for")
            ub = clip_box_xywh(u["bbox"])
            target_idx = None
            if isinstance(ref, str) and ref.startswith("headline#"):
                try:
                    target_idx = int(ref.split("#")[1])
                except Exception:
                    target_idx = None
            if target_idx is None and heads_boxes:
                # IoU로 가장 가까운 헤드라인
                best, best_iou = None, 0.0
                for i, hb in enumerate(heads_boxes):
                    v = iou_xywh(ub, hb)
                    if v>best_iou: best, best_iou = i, v
                target_idx = best
            if target_idx is not None and 0<=target_idx<len(heads):
                hb = heads_boxes[target_idx]
                # 패딩 확장 (8%씩)
                pad = 0.08
                x = max(0.0, hb[0] - hb[2]*pad)
                y = max(0.0, hb[1] - hb[3]*pad)
                w = hb[2]*(1+2*pad)
                h = hb[3]*(1+2*pad)
                if x+w>1.0: w = 1.0 - x
                if y+h>1.0: h = 1.0 - y
                set_box(u, [x,y,w,h])
                u["for"] = f"headline#{target_idx}"
                log["ops"].append("underlay_sync")

    # ------- post metrics -------
    log["post"] = cur_metrics()
    js["postprocess_log"] = log
    return js

# =============== I/O & main ===============
def iter_json_files(path: str):
    if os.path.isdir(path):
        for p in glob.glob(os.path.join(path, "**", "*.json"), recursive=True):
            yield p
    else:
        yield path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in_json", required=True, help="입력 JSON 파일 또는 디렉토리")
    ap.add_argument("--out_dir", default="", help="출력 폴더(비우면 원본 옆에 .pp.json)")
    ap.add_argument("--iou_thr_tl", type=float, default=0.15)
    ap.add_argument("--sep_step", type=float, default=0.01)
    ap.add_argument("--sep_iters", type=int, default=60)
    ap.add_argument("--guides", default="0.1,0.5,0.9")
    ap.add_argument("--snap_tol", type=float, default=0.03)
    ap.add_argument("--text_area_range", default="0.06,0.16")
    ap.add_argument("--logo_area_range", default="0.02,0.06")
    ap.add_argument("--text_ar_min", type=float, default=2.0)
    ap.add_argument("--logo_ar_min", type=float, default=0.8)
    ap.add_argument("--logo_ar_max", type=float, default=2.2)
    ap.add_argument("--min_margin", type=float, default=0.06)
    ap.add_argument("--subj_iou_thr", type=float, default=0.15)
    ap.add_argument("--update_underlay", action="store_true")
    args = ap.parse_args()

    guides = tuple(float(x.strip()) for x in args.guides.split(","))
    text_area_range = tuple(float(x.strip()) for x in args.text_area_range.split(","))
    logo_area_range = tuple(float(x.strip()) for x in args.logo_area_range.split(","))

    total, saved = 0, 0
    for src in iter_json_files(args.in_json):
        try:
            js = load_json(src)
        except Exception as e:
            print(f"[skip] read fail: {src} ({e})")
            continue
        total += 1
        js2 = postprocess_one(
            js,
            iou_thr_tl=args.iou_thr_tl,
            sep_step=args.sep_step,
            sep_iters=args.sep_iters,
            guides=guides,
            snap_tol=args.snap_tol,
            text_area_range=text_area_range,
            logo_area_range=logo_area_range,
            text_ar_min=args.text_ar_min,
            logo_ar_min=args.logo_ar_min,
            logo_ar_max=args.logo_ar_max,
            min_margin=args.min_margin,
            subj_iou_thr=args.subj_iou_thr,
            update_underlay=args.update_underlay
        )
        # 저장 경로
        if args.out_dir:
            rel = os.path.relpath(src, args.in_json) if os.path.isdir(args.in_json) else os.path.basename(src)
            rel = rel.replace(".json", ".pp.json")
            dst = os.path.join(args.out_dir, rel)
        else:
            base = src[:-5] if src.lower().endswith(".json") else src
            dst = base + ".pp.json"
        dump_json(dst, js2)
        saved += 1
        pre = js2.get("postprocess_log",{}).get("pre",{})
        post = js2.get("postprocess_log",{}).get("post",{})
        print(f"[ok] {src} -> {dst}  |  IoU_tl: {pre.get('iou_text_logo',0):.3f} → {post.get('iou_text_logo',0):.3f}  "
              f"Ali: {pre.get('ali',float('nan')):.3f} → {post.get('ali',float('nan')):.3f}  "
              f"Occ(max): {max(pre.get('iou_subject_text',0),pre.get('iou_subject_logo',0)):.3f} → "
              f"{max(post.get('iou_subject_text',0),post.get('iou_subject_logo',0)):.3f}")
    print(f"[done] processed {saved}/{total} files")

if __name__ == "__main__":
    main()
