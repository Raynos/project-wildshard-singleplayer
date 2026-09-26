#!/usr/bin/env python3
"""tilesheet.py <out.jpg> [cell] — every paint layer tiled 2 x 2 (decoded: ratio x a mid wash), labelled, so a seam or
a repeat shows at a glance. Detail layers are shown over their wash colour from the spec's `wash` (default grey)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, '../../../../public/assets/nine-dragon/lab/tex')
WASH = {'flag': 0x3e4148, 'flag2': 0x3e4148, 'stone': 0x76767b, 'panel': 0x6f6f74, 'concrete': 0x8d96a3,
        'tiles': 0x2f7d5e, 'lacquer': 0x9c3627, 'wood': 0x5a4030}


def srgb2lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


spec = json.load(open(os.path.join(HERE, 'spec.json')))
cell = int(sys.argv[2]) if len(sys.argv) > 2 else 360
cols = 5
rows = (len(spec) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell, rows * (cell + 22)), (13, 27, 38))
d = ImageDraw.Draw(sheet)
for k, r in enumerate(spec):
    im = Image.open(os.path.join(TEX, r['name'] + '.jpg')).convert('RGB').resize((cell // 2, cell // 2), Image.LANCZOS)
    a = np.asarray(im).astype(np.float64) / 255
    if r.get('mode', 'detail') != 'colour':
        w = WASH.get(r['name'], 0x808080)
        wl = srgb2lin(np.array([(w >> 16) & 255, (w >> 8) & 255, w & 255]) / 255)
        a = lin2srgb(a * r.get('scale', 2.0) * wl[None, None, :] * 1.6)
    t = np.tile(a, (2, 2, 1))
    x, y = (k % cols) * cell, (k // cols) * (cell + 22)
    sheet.paste(Image.fromarray((t * 255).astype(np.uint8)), (x, y + 22))
    d.text((x + 6, y + 5), f"{r['name']} (2x2)", fill=(143, 227, 255))
sheet.save(sys.argv[1], quality=88)
print(sys.argv[1])
