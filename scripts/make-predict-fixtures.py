"""Generates test-fixtures/predict-fields/: 8 synthetic certificate-like pages plus expected.json.

All names, numbers, dates and places are invented. Each page prints 3-5 labelled fields (label
in small grey type, value in larger dark type to its right) at random but recorded positions;
expected.json holds the VALUE's box, normalised to 0..1, for each field.
Run with any Python that has Pillow:
    /home/snaic-darren/projects/lfm-extract-test/.venv/bin/python -I scripts/make-predict-fixtures.py
Deterministic (fixed seed); regenerating leaves the committed files unchanged given the same fonts.
"""

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "test-fixtures" / "predict-fields"
LIB = "/usr/share/fonts/truetype/liberation/"
W, H = 1000, 1300
FIRST = ["Mara", "Joel", "Ines", "Tomas", "Wen", "Aroha", "Lucas", "Priya", "Elena", "Kofi", "Sana", "Ivo"]
LAST = ["Brandt", "Okafor", "Lindqvist", "Marchetti", "Tan", "Haddad", "Novak", "Silva", "Kerrigan", "Doyle"]
PLACES = ["Rivermouth", "Saint Alden", "Northfield", "Port Kessel", "Little Harwick", "Eastbrook", "Valmora"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
LABELS = ["Full name", "Certificate number", "Date of marriage", "Place", "Officiant name"]


def value_for(rng, label):
    if label in ("Full name", "Officiant name"):
        return f"{rng.choice(FIRST)} {rng.choice(LAST)}"
    if label == "Certificate number":
        return f"{rng.choice('ABCDEFGH')}{rng.choice('KMNPRSTW')}-{rng.randint(10000, 99999)}"
    if label == "Place":
        return rng.choice(PLACES)
    d, m, y = rng.randint(1, 28), rng.randint(1, 12), rng.randint(1962, 2019)
    style = rng.choice(["long", "iso", "dmy"])
    if style == "long":
        return f"{d} {MONTHS[m - 1]} {y}"
    if style == "iso":
        return f"{y}-{m:02d}-{d:02d}"
    return f"{d:02d}/{m:02d}/{y}"


def main():
    rng = random.Random(20261028)
    OUT.mkdir(parents=True, exist_ok=True)
    title_font = ImageFont.truetype(LIB + "LiberationSerif-Bold.ttf", 44)
    label_font = ImageFont.truetype(LIB + "LiberationSans-Regular.ttf", 24)
    value_fonts = [
        ImageFont.truetype(LIB + "LiberationSerif-Regular.ttf", 38),
        ImageFont.truetype(LIB + "LiberationSans-Bold.ttf", 34),
        ImageFont.truetype(LIB + "LiberationMono-Regular.ttf", 34),
    ]
    expected = []
    for n in range(1, 9):
        img = Image.new("RGB", (W, H), (252, 250, 244))
        d = ImageDraw.Draw(img)
        d.rectangle([30, 30, W - 30, H - 30], outline=(90, 70, 40), width=4)
        d.rectangle([44, 44, W - 44, H - 44], outline=(150, 130, 90), width=1)
        title = rng.choice(["Certificate of Marriage", "Marriage Record", "Register Extract"])
        tw = d.textlength(title, font=title_font)
        d.text(((W - tw) / 2, 90), title, font=title_font, fill=(40, 30, 20))
        labels = rng.sample(LABELS, rng.randint(3, 5))
        rows = sorted(rng.sample(range(0, 9), len(labels)))
        vfont = rng.choice(value_fonts)
        fields = []
        for label, row in zip(labels, rows):
            y = 240 + row * 110 + rng.randint(-15, 15)
            x = rng.randint(80, 200)
            d.text((x, y + 8), label, font=label_font, fill=(110, 110, 110))
            vx = x + int(d.textlength(label, font=label_font)) + rng.randint(30, 80)
            value = value_for(rng, label)
            x1, y1, x2, y2 = d.textbbox((vx, y), value, font=vfont)
            d.text((vx, y), value, font=vfont, fill=(15, 15, 40))
            pad = 3
            box = [x1 - pad, y1 - pad, x2 + pad, y2 + pad]
            fields.append({
                "label": label,
                "value": value,
                "bbox": [round(box[0] / W, 4), round(box[1] / H, 4), round(box[2] / W, 4), round(box[3] / H, 4)],
            })
        name = f"p{n:02d}.png"
        img.save(OUT / name, optimize=True)
        expected.append({"page": name, "fields": fields})
    (OUT / "expected.json").write_text(json.dumps(expected, indent=2) + "\n")


main()
