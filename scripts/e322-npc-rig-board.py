#!/usr/bin/env python3
"""e322-npc-rig-board.py — E322 F-M3: the Pine Hollow NPC rig decision board from scripts/e322-npc-rig-capture.mjs.

    python3 scripts/e322-npc-rig-board.py --raw <capture dir> --out art/pine-hollow/round-21-e322-npc-rig/board.jpg \
        [--walk a:ranger=1,b:ranger=0,...]

Two columns, A (today's rig) | B (legs, clavicle + twist, the walk). Row 1: Hale's point held, a close-up on his right
shoulder. Rows 2-4: Hale, Brandt and Mott sent 5 m out front of their posts, shot from the side mid-walk (A slides, B
steps). --walk picks which of the three 0.3 s-apart shots a cell uses (default 0). iPhone portrait (390x844 CSS at 3x).
JPEG under 500 KB (the pre-commit cap).
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("--raw", required=True)
ap.add_argument("--out", default="art/pine-hollow/round-21-e322-npc-rig/board.jpg")
ap.add_argument("--walk", default="")
ap.add_argument("--cell", type=int, default=440)
a = ap.parse_args()
pick = dict(kv.split("=") for kv in a.walk.split(",") if kv)
C, G, LW, TH, HH = a.cell, 8, 200, 48, 40
WH = int(C * 1.45)   # a walk cell: a portrait crop round the person


def font(sz):
    for f in ("/System/Library/Fonts/SFNSMono.ttf", "/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(f, sz)
        except OSError:
            pass
    return ImageFont.load_default()


F2, F3, F4 = font(16), font(40), font(13)
cols = [("A", "a", "Today: upper-body rig, no legs"), ("B", "b", "Legs + clavicle / twist + walk")]
rows = [("point", "Hale's point — his right shoulder", C)] + [(k, f"{n} walking (side)", WH) for k, n in (("ranger", "Hale"), ("miller", "Brandt"), ("trader", "Mott"))]
W = LW + len(cols) * (C + G) + G
H = TH + HH + sum(h + G for _, _, h in rows) + G
board = Image.new("RGB", (W, H), (13, 27, 38))
d = ImageDraw.Draw(board)
d.text((G, 14), "PINE HOLLOW · E322 F-M3 · NPC RIG · iPhone portrait, midday · Debug > Creatures & NPCs > NPC rig", fill=(143, 227, 255), font=F2)
for j, (letter, _, label) in enumerate(cols):
    x = LW + j * (C + G)
    d.text((x + 6, TH), letter, fill=(255, 217, 138), font=F3)
    d.text((x + 46, TH + 14), label.upper(), fill=(230, 236, 240), font=F4)
y = TH + HH + G
for key, label, h in rows:
    words, line, ly = label.split(), "", y + 10
    for w in words:
        if d.textlength(line + " " + w, font=F2) > LW - 24:
            d.text((G + 6, ly), line.strip(), fill=(230, 236, 240), font=F2); ly += 22; line = ""
        line += " " + w
    d.text((G + 6, ly), line.strip(), fill=(230, 236, 240), font=F2)
    for j, (_, v, _) in enumerate(cols):
        x = LW + j * (C + G)
        if key == "point":
            f = os.path.join(a.raw, f"{v}-point-crop.jpg")
            im = Image.open(f).convert("RGB").resize((C, C), Image.LANCZOS) if os.path.exists(f) else None
        else:
            f = os.path.join(a.raw, f"{v}-walk-{key}-{pick.get(f'{v}:{key}', '0')}.jpg")
            im = None
            if os.path.exists(f):
                src = Image.open(f).convert("RGB")
                sw, sh = src.size                      # 1170 x 2532: the person is centred (the camera aims at the hips)
                cw = int(sw * 0.8); ch = int(cw * h / C)
                top = max(0, min(sh - ch, sh // 2 - ch // 2))
                im = src.crop(((sw - cw) // 2, top, (sw + cw) // 2, top + ch)).resize((C, h), Image.LANCZOS)
        if im is not None:
            board.paste(im, (x, y))
        else:
            d.rectangle([x, y, x + C, y + h], outline=(80, 90, 100))
    y += h + G
os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
for q in range(88, 40, -4):
    board.save(a.out, quality=q)
    if os.path.getsize(a.out) < 490_000:
        break
print(f"[board] {a.out} {W}x{H} q{q} {os.path.getsize(a.out) // 1000} KB")
