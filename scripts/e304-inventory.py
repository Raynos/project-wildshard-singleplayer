#!/usr/bin/env python3
"""e304-inventory.py — E304: every faced model in the four shards, as it was before the faces remaster, on one sheet.

    python3 scripts/e304-inventory.py --out progress/e304-faces/inventory.jpg

The cells: the in-game iPhone captures' "current" crops (scripts/e304-faces-capture.mjs → progress/e304-faces/raw/
current-<id>-face.jpg), the Nalati camp people's A cells from progress/e302-faces/<person>.jpg, the Golden King's old head
(a Blender face close-up of the pre-remaster rig, --king). Grouped by shard, one row each. JPEG under 500 KB.
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("--raw", default="progress/e304-faces/raw")
ap.add_argument("--e302", default="progress/e302-faces")
ap.add_argument("--king", default=os.path.expanduser("~/ml/img2mesh/out/e304-faces/inv-king.png"))
ap.add_argument("--out", default="progress/e304-faces/inventory.jpg")
ap.add_argument("--cell", type=int, default=240)
a = ap.parse_args()


def font(sz):
    for f in ("/System/Library/Fonts/SFNSMono.ttf", "/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(f, sz)
        except OSError:
            pass
    return ImageFont.load_default()


def e302(person):
    p = os.path.join(a.e302, f"{person}.jpg")
    return Image.open(p).convert("RGB").crop((6, 40, 426, 460)) if os.path.exists(p) else None


def raw(i):
    p = os.path.join(a.raw, f"current-{i}-face.jpg")
    return Image.open(p).convert("RGB") if os.path.exists(p) else None


rows = [
    ("NALATI GRASSLANDS · painterly", [("Baqyt Ata", e302("elder")), ("Dauren", e302("herderGate")), ("Erlan", e302("herderRail")),
                                        ("Ayan", e302("child")), ("Gulnar Apa", e302("cook")),
                                        ("Golden King", Image.open(a.king).convert("RGB") if os.path.exists(a.king) else None)]),
    ("PINE HOLLOW · photoreal PBR", [("Hale (ranger)", raw("ranger")), ("Mott (trader)", raw("trader")), ("Brandt (miller)", raw("miller"))]),
    ("DRIFTWOOD ISLE · toon low-poly", [("Wendell", raw("wendell")), ("Drowned Sailor", raw("sailor")), ("Drowned Captain", raw("captain"))]),
    ("NINE DRAGON STACK · jiehua ink", [("noodle cook", raw("cook")), ("hawker", raw("hawker")), ("mahjong sitter", raw("sitter"))]),
]
C, G, LH, TH = a.cell, 6, 28, 40
cols = max(len(r[1]) for r in rows)
W = G + cols * (C + G)
H = TH + len(rows) * (LH + C + 26 + G)
im = Image.new("RGB", (W, H), (13, 27, 38))
d = ImageDraw.Draw(im)
F1, F2 = font(15), font(13)
d.text((G, 12), "E304 · EVERY FACED MODEL, BEFORE · in-game iPhone crops (~2.5 m, midday); the King: Blender close-up", fill=(143, 227, 255), font=F1)
y = TH
for title, cells in rows:
    d.text((G, y + 6), title, fill=(255, 217, 138), font=F1)
    y += LH
    for j, (name, cim) in enumerate(cells):
        x = G + j * (C + G)
        if cim is not None:
            im.paste(cim.resize((C, C), Image.LANCZOS), (x, y))
        else:
            d.rectangle([x, y, x + C, y + C], outline=(80, 90, 100))
        d.text((x + 4, y + C + 5), name.upper(), fill=(230, 236, 240), font=F2)
    y += C + 26 + G
os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
for q in range(88, 40, -4):
    im.save(a.out, quality=q)
    if os.path.getsize(a.out) < 490_000:
        break
print(f"[inventory] {a.out} {W}x{H} q{q} {os.path.getsize(a.out) // 1000} KB")
