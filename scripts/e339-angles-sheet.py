#!/usr/bin/env python3
"""E339: lay out scripts/e339-angles.mjs's crops as one angle sheet per group of heads (JPEG < 500 KB).

  python3 scripts/e339-angles-sheet.py <raw dir> <out.jpg> <variant:label,…> <target:name:portrait.jpg,…>

Per head and per variant, two rows: at 2.5 m (front · 3/4 left · side · 3/4 back · back) and at 0.8 m (front · 3/4 left ·
side), the latter with the codex portrait the head was made from and the whole in-game frame at 2.5 m.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

raw, out = Path(sys.argv[1]), Path(sys.argv[2])
variants = [v.split(":", 1) for v in sys.argv[3].split(",")]
targets = [t.split(":", 2) for t in sys.argv[4].split(",")]
FAR_M = sys.argv[sys.argv.index("--far") + 1] if "--far" in sys.argv else "2.5"   # the far row's distance (m), as shot

T, G = 230, 8                     # tile, gutter
W = 5 * T + 6 * G
BG, INK, DIM, CY = (13, 27, 38), (230, 238, 242), (140, 160, 172), (143, 227, 255)
try:
    F = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 15)
    FS = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 12)
    FB = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 20)
except OSError:
    F = FS = FB = ImageFont.load_default()


def tile(p: Path, fit: bool = False) -> Image.Image:
    im = Image.open(p).convert("RGB")
    if fit:   # letterbox into the square
        im.thumbnail((T, T), Image.LANCZOS)
        sq = Image.new("RGB", (T, T), (0, 0, 0))
        sq.paste(im, ((T - im.width) // 2, (T - im.height) // 2))
        return sq
    return im.resize((T, T), Image.LANCZOS)


ROW = 18 + T + G
HEAD = 34
H = G + len(targets) * (HEAD + len(variants) * 2 * ROW + G)
sheet = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(sheet)
y = G
FAR = [("0", "FRONT"), ("45", "3/4 LEFT"), ("90", "SIDE"), ("135", "3/4 BACK"), ("180", "BACK")]
for tid, name, portrait in targets:
    d.text((G, y + 6), name.upper(), font=FB, fill=CY)
    d.line((G, y + HEAD - 4, W - G, y + HEAD - 4), fill=(60, 110, 130))
    y += HEAD
    for vid, vlabel in variants:
        for ri, (kind, dist) in enumerate((("far", f"{FAR_M} m · in-game talk distance"), ("near", "0.8 m · close-up"))):
            d.text((G, y), f"{vlabel} · {dist}", font=F, fill=INK)
            cells = []
            if kind == "far":
                cells = [(raw / f"{vid}-{tid}-far-{a}.jpg", lab, False) for a, lab in FAR]
            else:
                cells = [(raw / f"{vid}-{tid}-near-{a}.jpg", lab, False) for a, lab in FAR[:3]]
                cells.append((Path(portrait), "CODEX PORTRAIT (SOURCE)", True))
                cells.append((raw / f"{vid}-{tid}-frame.jpg", f"WHOLE FRAME {FAR_M} M", True))
            for i, (p, lab, fit) in enumerate(cells):
                x = G + i * (T + G)
                if p.exists():
                    sheet.paste(tile(p, fit), (x, y + 18))
                else:
                    d.rectangle((x, y + 18, x + T, y + 18 + T), outline=DIM)
                    d.text((x + 8, y + 26), "missing", font=FS, fill=DIM)
                d.rectangle((x, y + 18 + T - 18, x + T, y + 18 + T), fill=(13, 27, 38))
                d.text((x + 5, y + 18 + T - 16), lab, font=FS, fill=CY)
            y += ROW
    y += G
out.parent.mkdir(parents=True, exist_ok=True)
for q in (86, 80, 74, 68, 62, 56):
    sheet.save(out, "JPEG", quality=q, optimize=True, progressive=True)
    if out.stat().st_size < 490_000:
        break
print(f"{out}: {sheet.width}×{sheet.height}, {out.stat().st_size // 1000} KB (q{q})")
