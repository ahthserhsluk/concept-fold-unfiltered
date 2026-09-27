#!/usr/bin/env python3
"""Generate og.png (1200x630) for link previews. Requires Pillow.
Run from demo-web/: python3 scripts/make_og.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H, M = 1200, 630, 72
BG, INK, MUTED, ACCENT, CARD, CARD_INK = "#f4efe6", "#171412", "#6b6259", "#c2410c", "#171412", "#f7f2ea"
OUT = Path(__file__).resolve().parent.parent / "og.png"

SERIF = ["/System/Library/Fonts/Supplemental/Georgia Bold.ttf", "/Library/Fonts/Georgia Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]
SERIF_IT = ["/System/Library/Fonts/Supplemental/Georgia Italic.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"]
SANS = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
SERIF_REG = ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]
SANS_REG = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]


def font(paths, size):
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def wrap(draw, text, f, max_w):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if draw.textlength(test, font=f) <= max_w or not line:
            line = test
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# Left column: wordmark
tag_f = font(SANS, 20)
tag = "CONCEPT FOR FOLD"
tw = d.textlength(tag, font=tag_f)
d.rounded_rectangle([M, M, M + tw + 32, M + 40], radius=20, outline=INK, width=2)
d.text((M + 16, M + 9), tag, font=tag_f, fill=INK)

d.text((M, 160), "Paisa Dost", font=font(SERIF, 86), fill=INK)
sub_f = font(SERIF_IT, 36)
for i, line in enumerate(wrap(d, "Your spending, roasted in Hinglish.", sub_f, 470)):
    d.text((M, 285 + i * 48), line, font=sub_f, fill=MUTED)

d.rectangle([M, H - M - 6, M + 80, H - M], fill=ACCENT)
d.text((M, H - M - 44), "All data fictional", font=font(SANS_REG, 20), fill=MUTED)

# Right column: roast card
cx0, cy0, cx1, cy1 = 640, M, W - M, H - M
d.rounded_rectangle([cx0, cy0, cx1, cy1], radius=28, fill=CARD)
pad = 40
d.text((cx0 + pad, cy0 + pad), "SAVAGE BEST FRIEND", font=font(SANS, 20), fill="#fb923c")
q_f = font(SERIF, 38)
y = cy0 + pad + 52
for line in wrap(d, "Swiggy pe ₹11,240? Bhai tu customer nahi, investor lag raha hai.", q_f, cx1 - cx0 - pad * 2):
    d.text((cx0 + pad, y), line, font=q_f, fill=CARD_INK)
    y += 52
d.line([cx0 + pad, cy1 - pad - 60, cx1 - pad, cy1 - pad - 60], fill="#4a433c", width=2)
d.text((cx0 + pad, cy1 - pad - 38), "Fix: cap food delivery at ₹8,000.", font=font(SERIF_REG, 26), fill="#d2c8bb")

img.save(OUT, optimize=True)
print(f"wrote {OUT} {img.size}")
