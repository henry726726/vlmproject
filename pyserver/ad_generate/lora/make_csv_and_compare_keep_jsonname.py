
import argparse
import json
import re
from pathlib import Path
import numpy as np
import pandas as pd

REQ_COLS = [
    "image","model","json_ok","have_headline","have_logo","num_head_boxes","num_logo_boxes",
    "margin_ok_text","margin_ok_logo","ar_text","ar_logo","area_text","area_logo",
    "iou_subject_text","iou_subject_logo","iou_text_logo","energy_text","energy_logo",
    "negspace_compliance","prompt_len","composite_score","headline_suggestion","background_prompt"
]

ALIASES = {
    "image": ["image","img","filename","image_name"],
    "model": ["model","mdl","method"],
    "json_ok": ["json_ok","jsonValid","ok"],
    "have_headline": ["have_headline","headline_present","headline.exists","has_headline"],
    "have_logo": ["have_logo","logo_present","logo.exists","has_logo"],
    "num_head_boxes": ["num_head_boxes","headline_boxes","head_count"],
    "num_logo_boxes": ["num_logo_boxes","logo_boxes","logo_count"],
    "margin_ok_text": ["margin_ok_text","margin_text_ok","text_margin_ok"],
    "margin_ok_logo": ["margin_ok_logo","margin_logo_ok","logo_margin_ok"],
    "ar_text": ["ar_text","aspect_ratio_text"],
    "ar_logo": ["ar_logo","aspect_ratio_logo"],
    "area_text": ["area_text","text_area"],
    "area_logo": ["area_logo","logo_area"],
    "iou_subject_text": ["iou_subject_text","iou_text_subject","iou_text_product"],
    "iou_subject_logo": ["iou_subject_logo","iou_logo_subject","iou_logo_product"],
    "iou_text_logo": ["iou_text_logo"],
    "energy_text": ["energy_text"],
    "energy_logo": ["energy_logo"],
    "negspace_compliance": ["negspace_compliance","negative_space_ok","negspace_ok"],
    "prompt_len": ["prompt_len","prompt_length"],
    "composite_score": ["composite_score","score","composite"],
    "headline_suggestion": ["headline_suggestion","headline","title"],
    "background_prompt": ["background_prompt","bg_prompt","prompt"]
}

def safe_get(d, keys, default=None):
    for k in keys:
        # support nested dotted keys
        if "." in k:
            cur = d
            ok = True
            for part in k.split("."):
                if isinstance(cur, dict) and part in cur:
                    cur = cur[part]
                else:
                    ok = False
                    break
            if ok:
                return cur
        else:
            if k in d:
                return d[k]
    return default

def infer_model(json_path: Path, json_data: dict, mode: str) -> str:
    if mode == "parent_dir":
        parent = json_path.parent.name.lower()
        if "base" in parent:
            return "BASE"
        if "lora" in parent:
            return "LoRA"
    elif mode == "field":
        m = safe_get(json_data, ALIASES["model"], default=None)
        if isinstance(m, str):
            ml = m.strip().lower()
            if ml in ["base","baseline","origin","original"]:
                return "BASE"
            if ml in ["lora","lora-v1","finetune","fine-tuned"]:
                return "LoRA"
    # fallback: filename suffix
    n = json_path.name.lower()
    if n.endswith(".base.json"):
        return "BASE"
    if n.endswith(".lora.json"):
        return "LoRA"
    return "UNKNOWN"

def coerce_numeric(x):
    if x is None:
        return np.nan
    try:
        v = float(x)
        if v == -1:
            return np.nan
        return v
    except Exception:
        return np.nan

def compute_prompt_len(row):
    if not pd.isna(row.get("prompt_len")):
        return row["prompt_len"]
    txt = None
    for key in ["background_prompt","headline_suggestion"]:
        v = row.get(key)
        if isinstance(v, str) and v.strip():
            txt = v
            break
    if not txt:
        return np.nan
    return float(len(re.findall(r"\w+", txt)))

def load_rows(input_dir: Path, infer_mode: str):
    rows = []
    for p in input_dir.rglob("*.json"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            json_ok = 1
        except Exception:
            data = {}
            json_ok = 0

        model = infer_model(p, data, infer_mode)

        # **Keep JSON filename as-is** for the 'image' column
        image_name = p.name

        row = {col: np.nan for col in REQ_COLS}
        row["image"] = image_name
        row["model"] = model
        row["json_ok"] = json_ok

        for col, aliases in ALIASES.items():
            if col in ["image","model","json_ok"]:
                continue
            v = safe_get(data, aliases, default=None)
            if col in [
                "have_headline","have_logo","margin_ok_text","margin_ok_logo",
                "negspace_compliance"
            ]:
                if isinstance(v, (bool,int,float)):
                    row[col] = int(bool(v))
                else:
                    row[col] = np.nan
            elif col in ["headline_suggestion","background_prompt"]:
                row[col] = v if isinstance(v, str) else ""
            else:
                row[col] = coerce_numeric(v)

        row["prompt_len"] = compute_prompt_len(row)

        rows.append(row)
    return rows

def summarize(df: pd.DataFrame):
    out = []
    for model, g in df.groupby("model", dropna=False):
        N = len(g)
        def rate(col):
            if col not in g:
                return np.nan
            s = g[col]
            if s.dtype.kind in "biufc":
                return float(np.nanmean(s))
            return np.nan
        entry = {
            "Model": model,
            "N": N,
            "json_ok_rate": rate("json_ok"),
            "headline_rate": rate("have_headline"),
            "logo_rate": rate("have_logo"),
            "both_valid_rate": float(np.nanmean((g["have_headline"]==1) & (g["have_logo"]==1))) if N>0 else np.nan,
            "any_valid_rate": float(np.nanmean((g["have_headline"]==1) | (g["have_logo"]==1))) if N>0 else np.nan,
            "margin_ok_text_rate": rate("margin_ok_text"),
            "margin_ok_logo_rate": rate("margin_ok_logo"),
            "IoU_text_logo (↓)": rate("iou_text_logo"),
            "IoU_subject_text (↓)": rate("iou_subject_text"),
            "IoU_subject_logo (↓)": rate("iou_subject_logo"),
            "negspace_compliance_mean": rate("negspace_compliance"),
            "area_text_mean": rate("area_text"),
            "area_logo_mean": rate("area_logo"),
            "prompt_len_mean": rate("prompt_len"),
            "composite_all_mean": rate("composite_score"),
            "composite_valid_mean": float(np.nanmean(g.loc[(g["have_headline"]==1) | (g["have_logo"]==1), "composite_score"])) if N>0 else np.nan,
        }
        out.append(entry)
    return pd.DataFrame(out)

def pairwise_wins(df: pd.DataFrame):
    # With image = JSON filename, pairs won't match across models.
    # We'll fall back to pairing by a base stem if possible, else skip.
    sub = df[df["model"].isin(["BASE","LoRA"])].copy()
    if sub.empty:
        return pd.DataFrame(columns=["key","base","lora","winner"]), pd.DataFrame({"who":["Base","LoRA","Tie"], "wins":[0,0,0]})
    # derive a common key: remove trailing ".base.json"/".lora.json"
    def key_of(name: str):
        n = name.lower()
        if n.endswith(".base.json"):
            return name[:-10]  # strip ".base.json"
        if n.endswith(".lora.json"):
            return name[:-10]  # strip ".lora.json"
        if n.endswith(".json"):
            return name[:-5]
        return name
    sub["key"] = sub["image"].astype(str).map(key_of)

    agg = sub.groupby(["key","model"], as_index=False)["composite_score"].mean()
    piv = agg.pivot(index="key", columns="model", values="composite_score")
    wins = {"Base":0, "LoRA":0, "Tie":0}
    rows = []
    for key, row in piv.iterrows():
        b = row.get("BASE")
        l = row.get("LoRA")
        if np.isnan(b) or np.isnan(l):
            continue
        if b > l:
            who = "Base"
        elif l > b:
            who = "LoRA"
        else:
            who = "Tie"
        wins[who] += 1
        rows.append({"key": key, "base": b, "lora": l, "winner": who})
    wins_df = pd.DataFrame({"who": list(wins.keys()), "wins": list(wins.values())})
    return pd.DataFrame(rows), wins_df

def piad_proxy(df: pd.DataFrame):
    out = []
    for model, g in df.groupby("model", dropna=False):
        if len(g)==0:
            out.append({"Model": model, "Val↑": np.nan, "Ove↓": np.nan, "Ali_text↑": np.nan, "Ali_logo↑": np.nan,
                        "Undl↑": np.nan, "Unds↑": np.nan, "Uti↑": np.nan, "Occ↓": np.nan, "TMR↑": np.nan})
            continue
        val = float(np.nanmean((g["have_headline"]==1) & (g["have_logo"]==1)))
        ove = float(np.nanmean(g["iou_text_logo"]))
        def align_band(s):
            s = g[s].astype(float)
            ok = (s >= 0.05) & (s <= 0.25)
            return float(np.nanmean(ok))
        ali_t = align_band("area_text")
        ali_l = align_band("area_logo")
        undl = float(np.nanmean(1 - np.minimum(g["iou_subject_logo"].astype(float), 1.0)))
        unds = float(np.nanmean(1 - np.minimum(g["iou_subject_text"].astype(float), 1.0)))
        uti = float(np.nanmean((g["margin_ok_text"]==1) | (g["margin_ok_logo"]==1)))
        occ = float(np.nanmean(np.nanmax(np.vstack([g["iou_text_logo"].astype(float).to_numpy(),
                                                    g["iou_subject_text"].astype(float).to_numpy(),
                                                    g["iou_subject_logo"].astype(float).to_numpy()]), axis=0)))
        tmr = float(np.nanmean(g["composite_score"].astype(float)))
        out.append({"Model": model, "Val↑": val, "Ove↓": ove, "Ali_text↑": ali_t, "Ali_logo↑": ali_l,
                    "Undl↑": undl, "Unds↑": unds, "Uti↑": uti, "Occ↓": occ, "TMR↑": tmr})
    return pd.DataFrame(out)

def add_arrows(summary_df: pd.DataFrame):
    if not {"BASE","LoRA"}.issubset(set(summary_df["Model"])):
        return pd.DataFrame()
    base = summary_df.set_index("Model").loc["BASE"]
    lora = summary_df.set_index("Model").loc["LoRA"]
    rows = []
    for col in summary_df.columns:
        if col in ["Model","N"]:
            continue
        b = base[col]; l = lora[col]
        if pd.isna(b) or pd.isna(l):
            arrow = "→"
        else:
            if "(↓)" in col:
                arrow = "↑" if l < b else ("↓" if l > b else "→")
            else:
                arrow = "↑" if l > b else ("↓" if l < b else "→")
        rows.append({"metric": col, "BASE": b, "LoRA": l, "LoRA vs BASE": arrow})
    return pd.DataFrame(rows)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=str, required=True, help="Folder containing JSON files (recursively).")
    ap.add_argument("--infer-model-from", choices=["parent_dir","field"], default="parent_dir",
                    help="Infer model label either from parent folder name (base/lora) or a 'model' field in JSON.")
    args = ap.parse_args()

    input_dir = Path(args.input)
    if not input_dir.exists():
        raise SystemExit(f"[ERROR] Input path not found: {input_dir}")

    rows = load_rows(input_dir, args.infer_model_from)
    if not rows:
        print("[WARN] No JSON files found.")
    df = pd.DataFrame(rows, columns=REQ_COLS)

    # save merged
    merged_out = input_dir / "results_merged.csv"
    df.to_csv(merged_out, index=False, encoding="utf-8-sig")

    # summaries
    summary = summarize(df)
    summary_out = input_dir / "summary_by_model.csv"
    summary.to_csv(summary_out, index=False, encoding="utf-8-sig")

    # pairwise wins
    pairs, wins = pairwise_wins(df)
    pairs.to_csv(input_dir / "pairwise_wins.csv", index=False, encoding="utf-8-sig")
    wins.to_csv(input_dir / "wins_counts.csv", index=False, encoding="utf-8-sig")

    # piad proxy
    piad = piad_proxy(df)
    piad.to_csv(input_dir / "piad_proxy.csv", index=False, encoding="utf-8-sig")

    # arrows compare
    arrows = add_arrows(summary)
    if len(arrows)>0:
        arrows.to_csv(input_dir / "compare_with_arrows.csv", index=False, encoding="utf-8-sig")

    # stdout summary
    print("== Summary by model ==")
    print(summary.fillna("NaN").to_string(index=False))
    print("\n== Pairwise wins (composite_score) ==")
    print(wins.to_string(index=False))
    print("\n== PIAD-style proxy metrics ==")
    print(piad.fillna("NaN").to_string(index=False))
    if len(arrows)>0:
        print("\n== LoRA vs BASE (arrows) ==")
        print(arrows.to_string(index=False))

if __name__ == "__main__":
    main()
