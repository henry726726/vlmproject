# -*- coding: utf-8 -*-
r"""
evaluate_paid_metrics.py  (verbose & safe)
- compare_report.csv + json/{base,lora}/*.json 를 읽어 PAID 레이아웃 지표 계산
- per-image 지표 CSV + 모델별 요약 CSV 저장 + 콘솔 요약
- 진단용 --verbose 옵션: 경로/개수/샘플 파일 등 로그 출력

사용 예:
  python -u .\evaluate_paid_metrics.py ^
    --out_dir ".\_cmp_out" ^
    --expected_taglines 1 ^
    --align_tol 0.03 ^
    --verbose
"""

import os, json, csv, argparse, math
from typing import Dict, Any, List, Tuple
from collections import defaultdict

import numpy as np

# ---------------- geometry utils ----------------
def clip01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))

def clip_box(box):
    if not box: return None
    x,y,w,h = map(float, box)
    x=clip01(x); y=clip01(y); w=clip01(w); h=clip01(h)
    if x+w>1: w=max(0.0, 1-x)
    if y+h>1: h=max(0.0, 1-y)
    return [x,y,w,h]

def iou_xywh(b1, b2):
    if not b1 or not b2: return 0.0
    x1,y1,w1,h1 = b1; x2,y2,w2,h2 = b2
    xa = max(x1,x2); ya = max(y1,y2)
    xb = min(x1+w1, x2+w2); yb = min(y1+h1, y2+h2)
    inter = max(0.0, xb-xa) * max(0.0, yb-ya)
    den = max(0.0, w1*h1) + max(0.0, w2*h2) - inter
    return inter/den if den>0 else 0.0

def center_of(b):
    x,y,w,h = b
    return (x + w/2.0, y + h/2.0)

# ---------------- JSON helpers ------------------
def load_json_safe(path) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def get_layout_items(js: Dict[str, Any]) -> Tuple[List[Dict[str,Any]], List[Dict[str,Any]]]:
    lay = js.get("layout") or {}
    ng = lay.get("nongraphic_layout") or []
    gr = lay.get("graphic_layout") or []
    return ng, gr

def list_boxes_of_type(items: List[Dict[str,Any]], want_type: str) -> List[List[float]]:
    out = []
    for it in items:
        if (it.get("type") or "").lower() == want_type and isinstance(it.get("bbox"), list) and len(it["bbox"])==4:
            b = clip_box(it["bbox"])
            if b: out.append(b)
    return out

def find_underlays_for_headlines(ng: List[Dict[str,Any]], gr: List[Dict[str,Any]]):
    """
    headline index -> list of underlay boxes that are likely paired.
    규칙:
      - 'underlay' 아이템에 "for": "headline#k"가 있으면 k로 매핑
      - 아니면 headline들과 IoU>=0.6 인 underlay를 매핑
    """
    headline_boxes = []
    for it in ng:
        if (it.get("type") or "").lower() == "headline" and isinstance(it.get("bbox"), list) and len(it["bbox"])==4:
            b = clip_box(it["bbox"]); 
            if b: headline_boxes.append(b)

    idx_map = defaultdict(list)

    # 명시적 "for"
    for it in gr:
        if (it.get("type") or "").lower() != "underlay": 
            continue
        b = clip_box(it.get("bbox"))
        if not b: 
            continue
        ref = it.get("for")
        if isinstance(ref, str) and ref.startswith("headline#"):
            try:
                k = int(ref.split("#")[1])
                if 0 <= k < len(headline_boxes):
                    idx_map[k].append(b)
                    continue
            except Exception:
                pass
        # IoU 추정
        best_k, best_iou = -1, 0.0
        for k, hb in enumerate(headline_boxes):
            iou = iou_xywh(hb, b)
            if iou > best_iou:
                best_k, best_iou = k, iou
        if best_k >= 0 and best_iou >= 0.6:
            idx_map[best_k].append(b)

    return idx_map

# ---------------- PAID metric calculators ----------------
def metric_val(area_text: float, area_logo: float, thr: float=1e-3) -> float:
    vt = 1.0 if area_text >= thr else 0.0
    vl = 1.0 if area_logo >= thr else 0.0
    return (vt + vl) / 2.0

def metric_ali(head_boxes: List[List[float]], logo_boxes: List[List[float]], tol: float=0.03) -> float:
    guides = [0.1, 0.5, 0.9]
    def aligned(b):
        cx, cy = center_of(b)
        ax = min(abs(cx - g) for g in guides)
        ay = min(abs(cy - g) for g in guides)
        return 1.0 if (ax <= tol or ay <= tol) else 0.0
    sc = []
    for b in head_boxes: sc.append(aligned(b))
    for b in logo_boxes: sc.append(aligned(b))
    return float(np.mean(sc)) if sc else float("nan")

def metric_ove(iou_text_logo: float) -> float:
    return iou_text_logo  # 낮을수록 좋음

def metric_uti(area_text: float, area_logo: float,
               text_range=(0.06, 0.16), logo_range=(0.02, 0.06)) -> float:
    in_text = 1.0 if (text_range[0] <= area_text <= text_range[1]) else 0.0
    in_logo = 1.0 if (logo_range[0] <= area_logo <= logo_range[1]) else 0.0
    return (in_text + in_logo) / 2.0

def metric_occ(iou_sub_text: float, iou_sub_logo: float) -> float:
    return max(iou_sub_text, iou_sub_logo)  # 낮을수록 좋음

def metric_rea(energy_text: float) -> float:
    return energy_text if energy_text >= 0 else float("nan")  # 낮을수록 좋음

def metric_undl(underlays, head_boxes) -> float:
    if not head_boxes:
        return float("nan")
    hit = 0
    for idx, hb in enumerate(head_boxes):
        ok = False
        for b in underlays.get(idx, []):
            if iou_xywh(hb, b) >= 0.6:
                ok = True; break
        hit += 1 if ok else 0
    return hit / len(head_boxes)

def metric_unds(underlays, head_boxes, energy_text: float, rea_thr: float=0.05) -> float:
    if math.isnan(energy_text): return float("nan")
    undl_hit = (len(underlays) > 0)
    return 1.0 if (undl_hit and energy_text <= rea_thr) else 0.0

def metric_tmr(num_pred_taglines: int, expected_taglines: int=1) -> float:
    if expected_taglines <= 0: return float("nan")
    return 1.0 if num_pred_taglines == expected_taglines else 0.0

# ---------------- utils ----------------
def echo(s: str, flush: bool=True):
    print(s, flush=flush)

def type_float(row, key, default=0.0):
    try:
        return float(row.get(key, default))
    except Exception:
        return default

# -------------- main evaluation -----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out_dir", required=True, help="batch_compare_qwen_layout.py 출력 폴더")
    ap.add_argument("--expected_taglines", type=int, default=1, help="기대 태그라인(헤드라인) 수")
    ap.add_argument("--align_tol", type=float, default=0.03, help="Ali 정렬 허용 오차")
    ap.add_argument("--val_area_thr", type=float, default=1e-3, help="Val 면적 유효 임계값(정규화)")
    ap.add_argument("--paid_csv", default=None, help="per-image PAID 지표 CSV 저장 경로(기본 out_dir/paid_metrics.csv)")
    ap.add_argument("--paid_summary_csv", default=None, help="모델 요약 CSV 저장 경로(기본 out_dir/paid_summary.csv)")
    ap.add_argument("--verbose", action="store_true", help="자세한 로그 출력")
    args = ap.parse_args()

    out_dir = args.out_dir
    cmp_csv = os.path.join(out_dir, "compare_report.csv")
    if not os.path.exists(cmp_csv):
        echo(f"[ERR] compare_report.csv not found: {cmp_csv}")
        return

    paid_csv = args.paid_csv or os.path.join(out_dir, "paid_metrics.csv")
    paid_summary_csv = args.paid_summary_csv or os.path.join(out_dir, "paid_summary.csv")

    if args.verbose:
        echo(f"[info] out_dir: {out_dir}")
        echo(f"[info] compare_report.csv: {cmp_csv}")
        echo(f"[info] json/base dir: {os.path.join(out_dir,'json','base')}")
        echo(f"[info] json/lora dir: {os.path.join(out_dir,'json','lora')}")

    # 1) compare_report.csv 로드
    rows = []
    with open(cmp_csv, "r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            for k in ["json_ok","have_headline","have_logo","margin_ok_text","margin_ok_logo",
                      "ar_text","ar_logo","area_text","area_logo",
                      "iou_subject_text","iou_subject_logo","iou_text_logo",
                      "energy_text","energy_logo","composite_score"]:
                if k in row and row[k] != "":
                    try:
                        row[k] = float(row[k])
                    except Exception:
                        pass
            rows.append(row)
    if args.verbose:
        echo(f"[info] loaded rows from compare_report.csv: {len(rows)}")
        if rows:
            echo(f"[info] first row: {rows[0]}")

    # JSON 파일 개수 진단
    base_dir = os.path.join(out_dir, "json", "base")
    lora_dir = os.path.join(out_dir, "json", "lora")
    base_jsons = [x for x in os.listdir(base_dir) if x.endswith(".json")] if os.path.isdir(base_dir) else []
    lora_jsons = [x for x in os.listdir(lora_dir) if x.endswith(".json")] if os.path.isdir(lora_dir) else []
    if args.verbose:
        echo(f"[info] base json count: {len(base_jsons)} (ex: {base_jsons[:3]})")
        echo(f"[info] lora json count: {len(lora_jsons)} (ex: {lora_jsons[:3]})")

    # 2) 이미지×모델 루프
    per_image = []
    miss_json = 0
    for row in rows:
        image = row["image"]; model = row["model"]
        jdir = os.path.join(out_dir, "json", model)
        jpath = os.path.join(jdir, f"{image}.{model}.json")
        js = load_json_safe(jpath)

        if not js:
            # fallback: 오래된 파일명 규칙 시도(<image>.json)
            alt = os.path.join(jdir, f"{image}.json")
            js = load_json_safe(alt)
            if js and args.verbose:
                echo(f"[warn] used legacy json name: {alt}")
        if not js:
            miss_json += 1
            if args.verbose:
                echo(f"[warn] json not found for {image}/{model}. tried: {jpath}")
            # JSON 기반 Ali/Underlay/TMR는 N/A지만 CSV 기반 지표는 계산 가능 → 빈 JSON으로 진행
            js = {}

        ng, gr = get_layout_items(js)
        head_boxes = list_boxes_of_type(ng, "headline")
        logo_boxes = list_boxes_of_type(gr, "logo")
        underlays = find_underlays_for_headlines(ng, gr)
        num_taglines = len(head_boxes)

        area_text = type_float(row, "area_text", 0.0)
        area_logo = type_float(row, "area_logo", 0.0)
        iou_tl   = type_float(row, "iou_text_logo", 0.0)
        iou_st   = type_float(row, "iou_subject_text", 0.0)
        iou_sl   = type_float(row, "iou_subject_logo", 0.0)
        energy_t = row.get("energy_text", float("nan"))
        try:
            energy_t = float(energy_t)
        except Exception:
            energy_t = float("nan")

        # --- PAID metrics ---
        Val  = metric_val(area_text, area_logo, thr=args.val_area_thr)
        Ali  = metric_ali(head_boxes, logo_boxes, tol=args.align_tol)
        Ove  = metric_ove(iou_tl)
        Uti  = metric_uti(area_text, area_logo)
        Occ  = metric_occ(iou_st, iou_sl)
        Rea  = metric_rea(energy_t)
        Undl = metric_undl(underlays, head_boxes)
        Unds = metric_unds(underlays, head_boxes, energy_t)
        TMR  = metric_tmr(num_taglines, expected_taglines=args.expected_taglines)

        both_valid = 1.0 if (row.get("have_headline",0)==1.0 and row.get("have_logo",0)==1.0) else 0.0
        any_valid  = 1.0 if (row.get("have_headline",0)==1.0 or row.get("have_logo",0)==1.0) else 0.0

        per_image.append({
            "image": image, "model": model,
            "Val": round(Val,4),
            "Ali": round(Ali,4) if not math.isnan(Ali) else "",
            "Ove": round(Ove,4),
            "Uti": round(Uti,4),
            "Occ": round(Occ,4),
            "Rea": round(Rea,4) if not math.isnan(Rea) else "",
            "Undl": round(Undl,4) if not math.isnan(Undl) else "",
            "Unds": round(Unds,4) if not math.isnan(Unds) else "",
            "TMR": round(TMR,4) if not math.isnan(TMR) else "",
            "both_valid": int(both_valid),
            "any_valid": int(any_valid),
            "area_text": round(area_text,4),
            "area_logo": round(area_logo,4),
            "iou_text_logo": round(iou_tl,4),
            "iou_subject_text": round(iou_st,4),
            "iou_subject_logo": round(iou_sl,4),
            "energy_text": round(energy_t,4) if not math.isnan(energy_t) else ""
        })

    if args.verbose:
        echo(f"[info] per-image rows computed: {len(per_image)}  (json missing: {miss_json})")

    if not per_image:
        echo("[ERR] No per-image metrics computed. 점검:")
        echo("  1) compare_report.csv에 rows가 있는지")
        echo("  2) json/base|lora 아래 파일명이 '<image>.<model>.json' 형식인지")
        echo("  3) --out_dir 경로가 맞는지 (절대경로로 시도)")
        return

    # 저장
    try:
        with open(paid_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(per_image[0].keys()))
            w.writeheader()
            for r in per_image:
                w.writerow(r)
        echo(f"[OK] wrote per-image metrics: {paid_csv}")
    except Exception as e:
        echo(f"[ERR] writing per-image csv failed: {e}")
        return

    # 3) 모델별 요약(평균/표준편차)
    def to_float_list(vals):
        out=[]
        for v in vals:
            if v=="" or v is None: continue
            try: out.append(float(v))
            except Exception: pass
        return out

    models = sorted(set(r["model"] for r in per_image))
    metrics = ["Val","Ali","Ove","Uti","Occ","Rea","Undl","Unds","TMR","both_valid","any_valid"]

    summary_rows=[]
    for m in models:
        sub=[r for r in per_image if r["model"]==m]
        agg={"model":m, "count":len(sub)}
        for k in metrics:
            arr = to_float_list([r[k] for r in sub])
            if not arr:
                agg[f"{k}_mean"] = ""
                agg[f"{k}_std"] = ""
            else:
                agg[f"{k}_mean"] = round(float(np.mean(arr)), 4)
                agg[f"{k}_std"]  = round(float(np.std(arr, ddof=0)), 4)
        summary_rows.append(agg)

    try:
        with open(paid_summary_csv, "w", newline="", encoding="utf-8") as f:
            fields = ["model","count"] + sum(([f"{k}_mean", f"{k}_std"] for k in metrics), [])
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in summary_rows:
                w.writerow(r)
        echo(f"[OK] wrote model summary    : {paid_summary_csv}")
    except Exception as e:
        echo(f"[ERR] writing summary csv failed: {e}")
        return

    # 4) 콘솔 요약
    for r in summary_rows:
        echo(f"\n=== MODEL: {r['model']} ===")
        for k in metrics:
            echo(f"{k:>10}: mean={r.get(f'{k}_mean','')}  std={r.get(f'{k}_std','')}")
