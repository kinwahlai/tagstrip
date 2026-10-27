"""Generates test-fixtures/ocr-crops/: 20 synthetic field-like crops plus expected.json.

All text is invented. Run with any Python that has Pillow and numpy:
    /home/snaic-darren/projects/lfm-extract-test/.venv/bin/python -I scripts/make-ocr-fixtures.py
Output is deterministic (fixed seed), so regenerating leaves the committed files unchanged
when the same fonts are installed.
"""

import json
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "test-fixtures" / "ocr-crops"
LIB = "/usr/share/fonts/truetype/liberation/"
DJV = "/usr/share/fonts/truetype/dejavu/"
FONTS = {
    "sans": LIB + "LiberationSans-Regular.ttf",
    "sansb": LIB + "LiberationSans-Bold.ttf",
    "serif": LIB + "LiberationSerif-Regular.ttf",
    "serifb": LIB + "LiberationSerif-Bold.ttf",
    "mono": LIB + "LiberationMono-Regular.ttf",
    "djv": DJV + "DejaVuSans.ttf",
    "djvserif": DJV + "DejaVuSerif.ttf",
}

# id, lines, font, size px, padding (x, y), effect
SPECS = [
    ("c01", ["Marcus Aldervane"], "sans", 28, (12, 8), None),
    ("c02", ["Priya Thornwick-Lowe"], "serif", 34, (16, 10), None),
    ("c03", ["Esperanza Quillfeather"], "djv", 22, (10, 6), None),
    ("c04", ["14 March 1987"], "sans", 30, (14, 10), None),
    ("c05", ["03/11/2019"], "mono", 26, (12, 8), None),
    ("c06", ["2004-07-22"], "djv", 40, (20, 14), None),
    ("c07", ["Nov 9, 1995"], "serifb", 24, (8, 6), "noise"),
    ("c08", ["Certificate No. KX-482915"], "sans", 30, (14, 10), None),
    ("c09", ["REG/2018/0043-B7"], "mono", 32, (16, 12), None),
    ("c10", ["ID 7Q4M-20913-ZR"], "sansb", 26, (12, 8), "blur"),
    ("c11", ["S9136482H"], "djv", 48, (24, 16), None),
    ("c12", ["Port Wexcombe"], "serif", 36, (18, 12), None),
    ("c13", ["Ashgrove Heights"], "sansb", 20, (8, 5), "noise"),
    ("c14", ["Tamsin Okonkwo-Reyes"], "djvserif", 30, (14, 10), "blur"),
    ("c15", ["Bartholomew J. Finchley"], "sans", 44, (20, 14), None),
    ("c16", ["Lena Marquardt", "Orla Vandermeer"], "sans", 28, (14, 10), None),
    ("c17", ["Blk 52 Larkspur Road", "Unit 08-113"], "serif", 26, (12, 8), "noise"),
    ("c18", ["31 Dec 2001"], "mono", 18, (8, 5), None),
    ("c19", ["Doc Ref: FM-2207-5518"], "djv", 24, (10, 8), None),
    ("c20", ["Rosalind Hartwell"], "serifb", 52, (22, 16), None),
]


def render(lines, font_key, size, pad, effect, rng):
    font = ImageFont.truetype(FONTS[font_key], size)
    line_h = int(size * 1.3)
    widths = [font.getlength(t) for t in lines]
    w = int(max(widths)) + 2 * pad[0]
    h = line_h * len(lines) + 2 * pad[1]
    img = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(img)
    for i, t in enumerate(lines):
        d.text((pad[0], pad[1] + i * line_h), t, font=font, fill=20)
    if effect == "blur":
        img = img.filter(ImageFilter.GaussianBlur(0.8))
    elif effect == "noise":
        a = np.asarray(img, dtype=np.float32)
        a += rng.normal(0, 7, a.shape)
        a -= rng.uniform(0, 14, a.shape)  # light grey speckle
        img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return img.convert("RGB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(1234)
    expected = []
    for cid, lines, font, size, pad, effect in SPECS:
        render(lines, font, size, pad, effect, rng).save(OUT / f"{cid}.png", optimize=False)
        expected.append({"id": cid, "file": f"{cid}.png", "expected": "\n".join(lines)})
    (OUT / "expected.json").write_text(json.dumps(expected, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(expected)} crops to {OUT}")


if __name__ == "__main__":
    random.seed(0)
    main()
