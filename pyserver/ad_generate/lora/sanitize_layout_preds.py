# sanitize_layout_preds.py
import json, re
from pathlib import Path
from PIL import Image

def _clip01(x): 
    x = float(x); 
    return 0.0 if x < 0 else (1.0 if x > 1 else x)

def _bbox_to_center_wh_xyxy(b, W, H):
    # xyxy -> center-wh (normalized)
    x1,y1,x2,y2 = b
    w = max(0.0, x2-x1); h = max(0.0, y2-y1)
    cx = x1 + w/2; cy = y1 + h/2
    return [ _clip01(cx/W), _clip01(cy/H), _clip01(w/W), _clip01(h/H) ]

def _bbox_to_center_wh_xywh(b, W, H):
    # xywh -> center-wh (normalized)
    x,y,w,h = b
    cx = x + w/2; cy = y + h/2
    return [ _clip01(cx/W), _clip01(cy/H), _clip01(w/W), _clip01(h/H) ]

def _norm_bbox_guess(b, W, H):
    # b가 이미 [cx,cy,w,h] 0~1이면 그대로
    try:
        if max(b) <= 1.0:
            return [ _clip01(b[0]), _clip01(b[1]), _clip01(b[2]), _clip01(b[3]) ]
    except Exception:
        return None
    # 픽셀일 때: xyxy or xywh 추정
    x,y,a,b2 = b
    # xywh 가 합리적인가?
    if (x>=0 and y>=0 and a>0 and b2>0 and x+a<=W+2 and y+b2<=H+2):
        return _bbox_to_center_wh_xywh([x,y,a,b2], W, H)
    # xyxy 가 합리적인가?
    if (a>x and b2>y and 0<=x<=W and 0<=a<=W and 0<=y<=H and 0<=b2<=H):
        return _bbox_to_center_wh_xyxy([x,y,a,b2], W, H)
    # 마지막으로 안전클리핑
    return [ _clip01(b[0]/W), _clip01(b[1]/H), _clip01(b[2]/W), _clip01(b[3]/H) ]

def _extract_json(s: str):
    # 코드펜스/잡문자 제거 후 가장 바깥 { ... }만 추출
    s = re.sub(r"^```.*?\n", "", s.strip())
    s = re.sub(r"```$", "", s.strip())
    if "{" in s and "}" in s:
        try:
            s2 = s[s.index("{"): s.rindex("}")+1]
            return json.loads(s2)
        except Exception:
            pass
    # 실패하면 빈 dict
    return {}

def _type_map(t: str):
    t = (t or "").lower()
    if t in ["tagline","headline","text"]: return "tagline"
    if t in ["logo"]: return "logo"
    if t in ["underlay","shadow","panel"]: return "underlay"
    if t in ["subject","product"]: return "subject"
    return t or "unknown"

def sanitize_line(obj):
    img = obj.get("image_path")
    raw = obj.get("pred_layout", {}).get("raw")
    if not (img and raw): 
        return None

    # 이미지 크기
    try:
        W,H = Image.open(img).size
    except Exception:
        # 이미지가 없어도 평가가 가능하도록 대략값
        W,H = 1024,1024

    lay = _extract_json(raw)
    if not isinstance(lay, dict): 
        return None

    out = {"subject_layout": [], "nongraphic_layout": [], "graphic_layout": []}

    # subject
    for e in (lay.get("subject_layout") or []):
        b = e.get("bbox") or e.get("center")  # center/ratio 들어온 경우도 대비
        r = e.get("ratio")
        if isinstance(b, list) and len(b)==4 and (r is None):
            bb = _norm_bbox_guess(b, W, H)
        elif isinstance(b, list) and isinstance(r, list) and len(b)==2 and len(r)==2:
            # {center:[cx,cy], ratio:[w,h]}
            bb = [ _clip01(b[0]), _clip01(b[1]), _clip01(r[0]), _clip01(r[1]) ]
        else:
            continue
        out["subject_layout"].append({"type":"subject","bbox": bb})

    # nongraphic/text
    for e in (lay.get("nongraphic_layout") or []):
        t = _type_map(e.get("type"))
        b = e.get("bbox")
        if not (isinstance(b, list) and len(b)==4): 
            continue
        bb = _norm_bbox_guess(b, W, H)
        out["nongraphic_layout"].append({"type": "tagline" if t=="tagline" else t, "bbox": bb})

    # graphic/logo/underlay
    for e in (lay.get("graphic_layout") or []):
        t = _type_map(e.get("type"))
        b = e.get("bbox")
        if not (isinstance(b, list) and len(b)==4): 
            continue
        bb = _norm_bbox_guess(b, W, H)
        g = {"type": t, "bbox": bb}
        if e.get("content"): g["content"] = e["content"]
        out["graphic_layout"].append(g)

    # 최소한 subject 하나는 있어야 평가 가능
    if not out["subject_layout"]:
        return None

    return {"image_path": img, "pred_layout": out}

def sanitize_file(in_path: str, out_path: str):
    src = Path(in_path); dst = Path(out_path)
    dst.parent.mkdir(parents=True, exist_ok=True)
    kept = 0; total = 0
    with src.open("r", encoding="utf-8") as f, dst.open("w", encoding="utf-8") as w:
        for line in f:
            s = line.strip()
            if not s: continue
            total += 1
            try:
                obj = json.loads(s)
            except Exception:
                continue
            fixed = sanitize_line(obj)
            if fixed:
                w.write(json.dumps(fixed, ensure_ascii=False) + "\n")
                kept += 1
    print(f"[sanitize] {src.name}: kept {kept}/{total} -> {dst}")

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--in_jsonl", required=True)
    ap.add_argument("--out_jsonl", required=True)
    args = ap.parse_args()
    sanitize_file(args.in_jsonl, args.out_jsonl)
