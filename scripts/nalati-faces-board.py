#!/usr/bin/env python3
"""nalati-faces-board.py — NALATI-FINISH B5 / E302: the camp faces decision board from scripts/nalati-faces-capture.mjs.

    python3 scripts/nalati-faces-board.py --raw progress/e302-faces/raw --out progress/e302-faces/board.jpg \
        --rows "A:current:Current,B:hunyuan:Hunyuan3D-2 head,C:trellis:TRELLIS.2 head,D:painted:Painted face"

One row per variant (its letter + name), one column per person: the iPhone portrait capture's square crop round the
head (390×844 CSS at 3×, ~2.5 m, midday). Also writes <out dir>/<person>.jpg: that person's variants side by side.
JPEG under 500 KB (the pre-commit cap).
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("--raw", default="progress/e302-faces/raw")
ap.add_argument("--out", default="progress/e302-faces/board.jpg")
ap.add_argument("--rows", required=True)
ap.add_argument("--people", default="elder:Baqyt Ata,herderGate:Dauren,herderRail:Erlan,child:Ayan,cook:Gulnar Apa")
ap.add_argument("--cell", type=int, default=300)
ap.add_argument("--title", default="NALATI · CAMP FACES · iPhone portrait, ~2.5 m, midday · pause > Settings > Debug > Creatures & NPCs > Camp faces")
a = ap.parse_args()
rows = [r.split(":", 2) for r in a.rows.split(",")]
people = [p.split(":", 1) for p in a.people.split(",")]
C, G, LW, TH, HH = a.cell, 6, 190, 44, 34


def font(sz):
    for f in ("/System/Library/Fonts/SFNSMono.ttf", "/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(f, sz)
        except OSError:
            pass
    return ImageFont.load_default()


F1, F2, F3 = font(22), font(15), font(40)
W = LW + len(people) * (C + G) + G
H = TH + HH + len(rows) * (C + G) + G
board = Image.new("RGB", (W, H), (13, 27, 38))
d = ImageDraw.Draw(board)
d.text((G, 12), a.title, fill=(143, 227, 255), font=F2)
for j, (_, name) in enumerate(people):
    d.text((LW + j * (C + G) + 8, TH + 6), name.upper(), fill=(143, 227, 255), font=F2)
for i, (letter, key, label) in enumerate(rows):
    y = TH + HH + i * (C + G)
    d.text((G + 6, y + 8), letter, fill=(255, 217, 138), font=F3)
    words, line, ly = label.split(), "", y + 64
    for w in words:
        if d.textlength(line + " " + w, font=F2) > LW - 20:
            d.text((G + 8, ly), line.strip(), fill=(230, 236, 240), font=F2); ly += 20; line = ""
        line += " " + w
    d.text((G + 8, ly), line.strip(), fill=(230, 236, 240), font=F2)
    for j, (pid, _) in enumerate(people):
        f = os.path.join(a.raw, f"{key}-{pid}-face.jpg")
        x = LW + j * (C + G)
        if os.path.exists(f):
            board.paste(Image.open(f).convert("RGB").resize((C, C), Image.LANCZOS), (x, y))
        else:
            d.rectangle([x, y, x + C, y + C], outline=(80, 90, 100)); d.text((x + 10, y + C // 2), "—", fill=(120, 130, 140), font=F1)
os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
for q in range(88, 40, -4):
    board.save(a.out, quality=q)
    if os.path.getsize(a.out) < 490_000:
        break
print(f"[board] {a.out} {W}x{H} q{q} {os.path.getsize(a.out) // 1000} KB")
# per person: its variants in a row, bigger
for pid, name in people:
    cells = [(letter, label, os.path.join(a.raw, f"{key}-{pid}-face.jpg")) for letter, key, label in rows]
    cells = [c for c in cells if os.path.exists(c[2])]
    if not cells:
        continue
    S = 420
    im = Image.new("RGB", (G + len(cells) * (S + G), S + 2 * G + 40), (13, 27, 38))
    dd = ImageDraw.Draw(im)
    for k, (letter, label, f) in enumerate(cells):
        im.paste(Image.open(f).convert("RGB").resize((S, S), Image.LANCZOS), (G + k * (S + G), 40))
        dd.text((G + k * (S + G) + 4, 10), f"{letter} · {label}".upper(), fill=(255, 217, 138), font=F2)
    p = os.path.join(os.path.dirname(a.out), f"{pid}.jpg")
    for q in range(88, 40, -4):
        im.save(p, quality=q)
        if os.path.getsize(p) < 490_000:
            break
    print(f"[board] {p}")
