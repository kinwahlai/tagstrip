"""Python reference for the TS-12 M1 browser harness: the same model family, prompt, field lists and
scoring, with PyTorch on the GPU. Separates "the browser port is wrong" from "the model cannot do it".

Run with the lfm-extract-test venv (isolated mode):
    /home/snaic-darren/projects/lfm-extract-test/.venv/bin/python -I scripts/predict-reference.py --set synthetic
    ... --set eval --export <annotations.json> --docs <dir, searched recursively> --out <verdicts.json>
    ... --selftest                      (runs the scorer's test vectors, no model)

Model: LiquidAI/LFM2.5-VL-450M from Hugging Face (the base model; the browser runs the
onnx-community ONNX q4f16 conversion of it), bfloat16, greedy decoding, max 512 new tokens,
default processor settings (image splitting on, max 256 image tokens), as the browser does.
Prompt: src/lib/predict/prompt.json, the same file the TypeScript module imports.
Page image size: images are used as they are; PDF pages are rendered with pdfium at scale 2 (144 dpi),
resized to round(points * 2) in each direction, which is the size the harness gets from pdf.js
(RENDER_SCALE = 2 in src/lib/pdf.ts).

Output: ONLY counts and per-field verdicts by id (f001...) go to --out and the summary to stdout.
Never a value, a label value or a filename. Scoring is a port of src/lib/predict/score.ts.
"""

import argparse
import calendar
import json
import os
import re
import statistics
import sys
import time
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MODEL_ID = "LiquidAI/LFM2.5-VL-450M"
MAX_NEW_TOKENS = 512
IOU_HIT = 0.5
DOC_EXT = re.compile(r"\.(pdf|png|jpe?g|webp)$", re.I)


# ---------------------------------------------------------------- scoring (port of score.ts)
def normalise(s):
    return "".join(c for c in s.lower() if unicodedata.category(c)[0] in ("L", "N"))


def iou(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    if w <= 0 or h <= 0:
        return 0.0
    inter = w * h

    def area(r):
        return max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])

    union = area(a) + area(b) - inter
    return inter / union if union > 0 else 0.0


MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august",
          "september", "october", "november", "december"]


def month_number(word):
    w = word.lower().rstrip(".")
    if len(w) < 3:
        return None
    if w == "sept":
        return 9
    for i, m in enumerate(MONTHS):
        if m == w or (len(w) == 3 and m.startswith(w)):
            return i + 1
    return None


def valid_date(y, m, d):
    if not (1000 <= y <= 9999) or m < 1 or m > 12 or d < 1:
        return None
    if d > calendar.monthrange(y, m)[1]:
        return None
    return f"{y}-{m:02d}-{d:02d}"


def parse_date(text):
    s = re.sub(r"\s+", " ", text.strip())
    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        return valid_date(int(m[1]), int(m[2]), int(m[3]))
    m = re.fullmatch(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", s)
    if m:
        return valid_date(int(m[3]), int(m[2]), int(m[1]))
    m = re.fullmatch(r"(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,9}\.?),? (\d{4})", s)
    if m:
        mo = month_number(m[2])
        return valid_date(int(m[3]), mo, int(m[1])) if mo else None
    m = re.fullmatch(r"([A-Za-z]{3,9}\.?) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})", s)
    if m:
        mo = month_number(m[1])
        return valid_date(int(m[3]), mo, int(m[2])) if mo else None
    return None


def name_tokens(s):
    return " ".join(sorted(t for t in re.split(r"[^\w]+|_", s.lower()) if t))


def value_verdict(got, expected, label):
    g = normalise(got)
    if g == "":
        return "blank"
    e = normalise(expected)
    if e == "":
        return "wrong"
    if g == e:
        return "match"
    gd = parse_date(got)
    if gd is not None and gd == parse_date(expected):
        return "match"
    if "name" in label.lower() and name_tokens(got) == name_tokens(expected):
        return "match"
    return "wrong"


def score_field(truth, predicted, fid):
    best, best_iou = None, -1.0
    for p in predicted:
        if normalise(p["label"]) != normalise(truth["label"]):
            continue
        v = iou(p["bbox"], truth["bbox"])
        if v > best_iou:
            best, best_iou = p, v
    if best is None:
        return {"id": fid, "box": "miss", "iou": 0.0, "value": "blank"}
    return {
        "id": fid,
        "box": "hit" if best_iou >= IOU_HIT else "miss",
        "iou": best_iou,
        "value": value_verdict(best["value"], truth["value"], truth["label"]),
    }


def summarise(fields, page_ms):
    count = lambda v: sum(1 for f in fields if f["value"] == v)
    return {
        "total": len(fields),
        "boxHits": sum(1 for f in fields if f["box"] == "hit"),
        "match": count("match"),
        "wrong": count("wrong"),
        "blank": count("blank"),
        "medianMs": statistics.median(page_ms) if page_ms else 0,
    }


# ---------------------------------------------------------------- lenient parser (port of parseFields)
def parse_fields(text):
    s = re.sub(r"```[a-zA-Z]*", "", text)
    start = s.find("[")
    if start < 0:
        return []
    objects, depth, in_str, esc, obj_start = [], 0, False, False, -1
    for i in range(start, len(s)):
        c = s[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c in "[{":
            if c == "{" and depth == 1:
                obj_start = i
            depth += 1
        elif c in "]}":
            depth -= 1
            if c == "}" and depth == 1 and obj_start >= 0:
                objects.append(s[obj_start : i + 1])
                obj_start = -1
            if depth == 0:
                break
    out = []
    for o in objects:
        try:
            r = json.loads(o)
        except ValueError:
            continue
        if not isinstance(r, dict):
            continue
        b = r.get("bbox")
        if not isinstance(r.get("label"), str) or not isinstance(b, list) or len(b) != 4:
            continue
        if not all(isinstance(n, (int, float)) and not isinstance(n, bool) for n in b):
            continue
        a, c, d, e = (min(1.0, max(0.0, float(n))) for n in b)
        v = r.get("value")
        value = v if isinstance(v, str) else (str(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else "")
        out.append({"label": r["label"], "value": value, "bbox": [min(a, d), min(c, e), max(a, d), max(c, e)]})
    return out


# ---------------------------------------------------------------- self-test: score.test.ts vectors
def selftest():
    truth = {"label": "Full name", "value": "Mary Ann Tan", "bbox": [0.2, 0.2, 0.6, 0.3]}

    def shift(b, dx):
        return [b[0] + dx, b[1], b[2] + dx, b[3]]

    def check(cond, what):
        if not cond:
            raise SystemExit(f"selftest FAILED: {what}")

    check(iou([0.1, 0.1, 0.5, 0.2], [0.1, 0.1, 0.5, 0.2]) == 1, "iou identical")
    check(iou([0, 0, 0.1, 0.1], [0.1, 0, 0.2, 0.1]) == 0, "iou touching")
    check(abs(iou([0.4, 0.4, 0.5, 0.5], [0, 0, 1, 1]) - 0.01) < 1e-10, "iou over union, not predicted box")
    r = score_field(truth, [{**truth, "bbox": shift(truth["bbox"], 0.4 / 3)}], "f1")
    check(abs(r["iou"] - 0.5) < 1e-10 and r["box"] == "hit", "iou 0.5 is a hit")
    check(score_field(truth, [{**truth, "bbox": shift(truth["bbox"], 0.14)}], "f1")["box"] == "miss", "below 0.5 miss")
    r = score_field(truth, [{**truth, "bbox": shift(truth["bbox"], 0.2)}], "f1")
    check(abs(r["iou"] - 1 / 3) < 1e-10 and r["box"] == "miss" and r["value"] == "match", "half-width shift")
    check(score_field(truth, [{**truth, "label": "Place"}], "f2") == {"id": "f2", "box": "miss", "iou": 0.0, "value": "blank"}, "no label")
    check(score_field(truth, [], "f3")["box"] == "miss", "no entries")
    far = {**truth, "label": "FULL  NAME", "value": "Other", "bbox": [0.7, 0.7, 0.9, 0.8]}
    r = score_field(truth, [far, {**truth, "label": "full name"}], "f4")
    check(r["box"] == "hit" and r["value"] == "match", "label case/space and best iou")
    check(value_verdict("Jane Doe", "Mary Ann Tan", "Full name") == "wrong", "different value wrong")
    check(value_verdict("", "x", "Place") == "blank" and value_verdict(" - ", "x", "Place") == "blank", "blank")
    check(value_verdict("A-123/45", "a 123 45", "Certificate number") == "match", "normalise")
    check(value_verdict("abc", "", "Place") == "wrong", "empty expected")
    check(value_verdict("Tan, Mary Ann", "Mary Ann Tan", "Husband name") == "match", "name order")
    check(value_verdict("Tan Mary", "Mary Ann Tan", "Full name") == "wrong", "name subset")
    check(value_verdict("Tan Mary Ann", "Mary Ann Tan", "Place") == "wrong", "name order only for name labels")
    check(value_verdict("7 March 2024", "2024-03-07", "Date of marriage") == "match", "date long vs iso")
    check(value_verdict("07/03/2024", "March 7, 2024", "Date of marriage") == "match", "date dmy vs mdy long")
    check(value_verdict("7 Mar 2024", "7th March 2024", "Date") == "match", "date abbreviations")
    check(value_verdict("8 March 2024", "2024-03-07", "Date of marriage") == "wrong", "different date")
    check(value_verdict("03/07/2024", "2024-03-07", "Date") == "wrong", "D/M/Y not M/D/Y")
    for t, want in [("2024-03-07", "2024-03-07"), ("7/3/2024", "2024-03-07"), ("7.3.2024", "2024-03-07"),
                    ("7 March 2024", "2024-03-07"), ("March 7, 2024", "2024-03-07"), ("Sept 1 2020", "2020-09-01"),
                    ("Mary Tan", None), ("31/02/2024", None), ("13/13/2024", None), ("7 Marchh 2024", None), ("12345", None)]:
        check(parse_date(t) == want, f"parse_date {t}")
    rs = [score_field(truth, [truth], "f001"),
          score_field(truth, [{**truth, "value": "zzz", "bbox": [0.8, 0.8, 0.9, 0.9]}], "f002"),
          score_field(truth, [], "f003")]
    check(summarise(rs, [10, 30, 20]) == {"total": 3, "boxHits": 1, "match": 1, "wrong": 1, "blank": 1, "medianMs": 20}, "summary")
    check([f["label"] for f in parse_fields('[{"label":"A","value":"x","bbox":[0,0,1]},{"label":5,"bbox":[0,0,1,1]},{"label":"B","value":"y","bbox":[0.1,0.1,0.2,0.2]}]')] == ["B"], "parse drops malformed")
    check(parse_fields('[{"label":"A","value":"a}{]","bbox":[1.5,0.4,-0.2,0.1]}]')[0]["bbox"] == [0, 0.1, 1, 0.4], "parse clamp")
    check(len(parse_fields('[{"label":"A","value":"x","bbox":[0,0,0.5,0.5]}, {"label":"B","value":"y","bb')) == 1, "parse truncated")
    print("selftest ok")


# ---------------------------------------------------------------- inputs
def synthetic_pages():
    from PIL import Image

    base = REPO / "test-fixtures" / "predict-fields"
    out = []
    for p in json.loads((base / "expected.json").read_text()):
        out.append({"truth": p["fields"], "image": (lambda f=base / p["page"]: Image.open(f).convert("RGB"))})
    return out, 0


def eval_pages(export_path, docs_dir):
    from PIL import Image
    import pypdfium2 as pdfium

    files = []
    for root, _dirs, names in os.walk(docs_dir, followlinks=True):
        files += [Path(root) / n for n in names if DOC_EXT.search(n)]
    if not files:
        raise SystemExit("no documents in --docs")
    dupes = len(files) - len({f.name for f in files})
    if dupes:
        raise SystemExit(f"--docs has {dupes} duplicate filename(s) across subfolders")
    by_name = {f.name: f for f in files}
    export = json.loads(Path(export_path).read_text())
    label_name = {l["id"]: l["name"] for l in export["labelSchema"]["labels"]}
    pages, skipped = [], 0
    for doc in export["documents"]:
        f = by_name.get(doc["filename"])
        if f is None:
            skipped += len(doc["annotations"])
            continue
        by_page = {}
        for a in doc["annotations"]:
            if a["labelId"] not in label_name:
                continue
            by_page.setdefault(a["pageIndex"], []).append({
                "label": label_name[a["labelId"]],
                "value": a.get("text") or "",
                "bbox": [a["x"], a["y"], a["x"] + a["width"], a["y"] + a["height"]],
            })
        for page_index in sorted(by_page):
            if doc["sourceType"] == "pdf":
                def render(f=f, i=page_index):
                    pdf = pdfium.PdfDocument(str(f))
                    try:
                        page = pdf[i]
                        w, h = page.get_size()
                        img = page.render(scale=2).to_pil().convert("RGB")
                        size = (round(w * 2), round(h * 2))
                        return img if img.size == size else img.resize(size, Image.LANCZOS)
                    finally:
                        pdf.close()
            else:
                def render(f=f):
                    return Image.open(f).convert("RGB")
            pages.append({"truth": by_page[page_index], "image": render})
    return pages, skipped


# ---------------------------------------------------------------- model
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", choices=("synthetic", "eval"))
    ap.add_argument("--export")
    ap.add_argument("--docs")
    ap.add_argument("--out")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--keep-raw-to", help="synthetic only: write the model's raw text per page here (for prompt work)")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if not args.set:
        ap.error("--set or --selftest is required")
    if args.set == "eval" and not (args.export and args.docs):
        ap.error("--set eval needs --export and --docs")
    if args.keep_raw_to and args.set != "synthetic":
        ap.error("--keep-raw-to is for the synthetic set only")
    try:
        pages, skipped = synthetic_pages() if args.set == "synthetic" else eval_pages(args.export, args.docs)
    except SystemExit:
        raise
    except Exception:
        if args.set == "eval":
            raise SystemExit("could not read the eval inputs (details withheld)")
        raise
    if not pages:
        raise SystemExit("no pages to score")

    import torch
    from transformers import AutoModelForImageTextToText, AutoProcessor

    template = json.loads((REPO / "src" / "lib" / "predict" / "prompt.json").read_text())["template"]
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
    model = AutoModelForImageTextToText.from_pretrained(
        MODEL_ID, device_map="auto",
        dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
    )
    processor = AutoProcessor.from_pretrained(MODEL_ID)

    def predict(img, fields):
        prompt = template.replace("{fields}", ", ".join(fields))
        conversation = [{"role": "user", "content": [{"type": "image", "image": img}, {"type": "text", "text": prompt}]}]
        inputs = processor.apply_chat_template(
            conversation, add_generation_prompt=True, return_tensors="pt", return_dict=True, tokenize=True
        ).to(model.device)
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS, do_sample=False)
        return processor.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0]

    asked = lambda item: list(dict.fromkeys(t["label"] for t in item["truth"]))
    predict(pages[0]["image"](), asked(pages[0]))  # untimed warm-up, as in the harness
    records, all_fields, seq, raws = [], [], 0, []
    for i, item in enumerate(pages):
        img = item["image"]()
        t0 = time.perf_counter()
        raw = predict(img, asked(item))
        ms = (time.perf_counter() - t0) * 1000
        raws.append(raw)
        predicted = parse_fields(raw)
        fields = []
        for t in item["truth"]:
            seq += 1
            fields.append(score_field(t, predicted, f"f{seq:03d}"))
        all_fields += fields
        records.append({"page": f"p{i + 1:03d}", "ms": ms, "fields": fields})
    summary = summarise(all_fields, [r["ms"] for r in records])
    if args.out:
        Path(args.out).write_text(json.dumps({
            "set": args.set, "runtime": "pytorch", "device": device_name,
            "summary": summary, "skipped": skipped, "pages": records,
        }, indent=2) + "\n")
    if args.keep_raw_to:
        Path(args.keep_raw_to).write_text(json.dumps(raws, indent=2) + "\n")
    print(f"device: {device_name}")
    print(f"fields {summary['total']}, box hits {summary['boxHits']}, match {summary['match']}, "
          f"wrong {summary['wrong']}, blank {summary['blank']}, "
          f"median s/page {summary['medianMs'] / 1000:.2f}, skipped {skipped}")


if __name__ == "__main__":
    main()
