import json, argparse
from pathlib import Path

def read_jsonl(p: Path):
    with p.open("r", encoding="utf-8") as f:
        for line in f:
            s=line.strip()
            if s: yield json.loads(s)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preds_jsonl", required=True)   # preds/baseline_promptgen.jsonl
    ap.add_argument("--data_jsonl",  required=True)   # processed/promptgen/test.jsonl
    ap.add_argument("--out_jsonl",   required=True)   # processed/promptgen/test_5.jsonl
    ap.add_argument("--num", type=int, default=5)
    args = ap.parse_args()

    preds = list(read_jsonl(Path(args.preds_jsonl)))
    want = [p["image_path"] for p in preds[:args.num] if "image_path" in p]
    want_set = set(want)

    kept = []
    for row in read_jsonl(Path(args.data_jsonl)):
        if row.get("image_path") in want_set:
            kept.append(row)
    outp = Path(args.out_jsonl)
    outp.parent.mkdir(parents=True, exist_ok=True)
    with outp.open("w", encoding="utf-8") as f:
        for r in kept:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[OK] wrote {len(kept)} rows to {outp}")

if __name__ == "__main__":
    main()
