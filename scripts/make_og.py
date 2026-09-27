#!/usr/bin/env python3
"""Generate og.png (1200x630) for link previews. Requires Pillow.
Run from demo-web/: python3 scripts/make_og.py
Left: name and line. Right: a lock-screen notification using a real roast from data/roasts/swiggy.json.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "og.png"
W, H, M = 1200, 630, 72
BG, INK, INK2, MUTED = "#f4efe6", "#171412", "#4a433c", "#6b6259"
WP = [(243, 168, 140), (199, 154, 216), (109, 134, 216)]  # same wallpaper as the page

SERIF = ["/System/Library/Fonts/Supplemental/Georgia Bold.ttf", "/Library/Fonts/Georgia Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]
SERIF_IT = ["/System/Library/Fonts/Supplemental/Georgia Italic.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"]
# Sans must have the rupee sign (Arial doesn't): SF (variable, weight set below) or DejaVu.
SANS_B = ["/System/Library/Fonts/SFNS.ttf#Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
SANS_SB = ["/System/Library/Fonts/SFNS.ttf#Semibold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
SANS = ["/System/Library/Fonts/SFNS.ttf#Regular", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]

# Roast shown on the card: Swiggy loyalist, savage best friend, first roast. Title from moments.json if present.
ROAST = json.loads((ROOT / "data/roasts/swiggy.json").read_text())["savage-friend"][0]
TITLE, TIME = "₹11,240 on Swiggy this month", "Sat, 9:34 PM"
try:
    for m in json.loads((ROOT / "data/moments.json").read_text())["moments"]:
        if m["id"] == "swiggy-food":
            TITLE, TIME = m["title"], m["time"]
except (OSError, KeyError, ValueError):
    pass


def font(paths, size):
    for p in paths:
        path, _, style = p.partition("#")
        if Path(path).exists():
            f = ImageFont.truetype(path, size)
            if style:
                try:
                    f.set_variation_by_name(style)
                except (OSError, ValueError):
                    pass
            return f
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


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def wallpaper(w, h):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = min(1, max(0, (y / h) * 0.9 + (x / w) * 0.15))
            px[x, y] = lerp(WP[0], WP[1], t / 0.48) if t < 0.48 else lerp(WP[1], WP[2], (t - 0.48) / 0.52)
    return img


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# ---- Left column ----
tag_f = font(SANS_B, 19)
tag = "CONCEPT FOR FOLD"
tw = d.textlength(tag, font=tag_f)
d.rounded_rectangle([M, M, M + tw + 32, M + 40], radius=20, outline=INK, width=2)
d.text((M + 16, M + 10), tag, font=tag_f, fill=INK)

h_f = font(SERIF, 84)
d.text((M, 150), "Fold", font=h_f, fill=INK)
d.text((M, 240), "Unfiltered", font=h_f, fill=INK)
d.text((M, 360), "Be painfully aware,", font=font(SERIF_IT, 38), fill=INK2)
d.text((M, 408), "in Hinglish.", font=font(SERIF_IT, 38), fill=INK2)
d.text((M, H - M - 24), "Lock-screen roasts with one fix each  ·  fictional data", font=font(SANS, 20), fill=MUTED)

# ---- Right: phone top, bleeding off the bottom edge ----
px0, py0, pw = 640, 44, 488
px1 = px0 + pw
shadow = Image.new("L", (W, H), 0)
ImageDraw.Draw(shadow).rounded_rectangle([px0 + 6, py0 + 24, px1 - 6, H + 80], radius=70, fill=110)
shadow = shadow.filter(ImageFilter.GaussianBlur(26))
img.paste(Image.new("RGB", (W, H), (120, 90, 60)), (0, 0), shadow)
d = ImageDraw.Draw(img)
d.rounded_rectangle([px0, py0, px1, H + 80], radius=70, fill="#1b1a19")

sx0, sy0 = px0 + 14, py0 + 14
sw, sh = pw - 28, H + 80 - sy0
screen = wallpaper(sw, sh)
mask = Image.new("L", (sw, sh), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh + 60], radius=58, fill=255)
img.paste(screen, (sx0, sy0), mask)
d = ImageDraw.Draw(img)

cx = sx0 + sw // 2
d.rounded_rectangle([cx - 62, sy0 + 14, cx + 62, sy0 + 48], radius=17, fill="#000")
date_f = font(SANS_SB, 20)
date = "Saturday, 27 September"
d.text((cx - d.textlength(date, font=date_f) / 2, sy0 + 74), date, font=date_f, fill="#ffffff")
time_f = font(SANS_B, 104)
d.text((cx - d.textlength("9:41", font=time_f) / 2, sy0 + 96), "9:41", font=time_f, fill="#ffffff")

# Notification card
nx0, nx1 = sx0 + 16, sx0 + sw - 16
pad = 22
tw_max = nx1 - nx0 - pad * 2
title_f, body_f, fix_f = font(SANS_B, 22), font(SANS, 20), font(SANS, 18)
body = wrap(d, ROAST["roast"], body_f, tw_max)
fix_text = ROAST["fix"].removeprefix("Fix:").strip()
fix_label_f = font(SANS_B, 14)
fix_lw = d.textlength("FIX", font=fix_label_f) + 10
fix = wrap(d, fix_text, fix_f, tw_max - 28 - fix_lw)
ny0 = sy0 + 232
nh = pad + 34 + 30 + len(body) * 27 + 14 + (len(fix) * 24 + 22) + pad
card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
cd = ImageDraw.Draw(card)
cd.rounded_rectangle([nx0, ny0, nx1, ny0 + nh], radius=26, fill=(250, 248, 245, 232), outline=(255, 255, 255, 190), width=2)
img.paste(card, (0, 0), card)
d = ImageDraw.Draw(img)

y = ny0 + pad
d.rounded_rectangle([nx0 + pad, y, nx0 + pad + 26, y + 26], radius=7, fill="#2d2b29")
f_f = font(SANS_B, 17)
d.text((nx0 + pad + 13 - d.textlength("F", font=f_f) / 2, y + 4), "F", font=f_f, fill="#ffffff")
app_f = font(SANS_SB, 15)
d.text((nx0 + pad + 36, y + 5), "FOLD", font=app_f, fill=(20, 20, 20, 150))
t_f = font(SANS, 15)
d.text((nx1 - pad - d.textlength(TIME, font=t_f), y + 5), TIME, font=t_f, fill="#6b6b6b")
y += 38
d.text((nx0 + pad, y), TITLE, font=title_f, fill="#141414")
y += 30
for line in body:
    d.text((nx0 + pad, y), line, font=body_f, fill="#141414")
    y += 27
y += 10
fh = len(fix) * 24 + 18
d.rounded_rectangle([nx0 + pad, y, nx1 - pad, y + fh], radius=14, fill="#e9e5e1")
d.text((nx0 + pad + 14, y + 12), "FIX", font=fix_label_f, fill="#0f5132")
fy = y + 9
for line in fix:
    d.text((nx0 + pad + 14 + fix_lw, fy), line, font=fix_f, fill="#141414")
    fy += 24

img.save(OUT, optimize=True)
print(f"wrote {OUT} {img.size}")
