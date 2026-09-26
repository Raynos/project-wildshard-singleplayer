#!/usr/bin/env python3
"""compare.py <out.jpg> <title> panel... — a side-by-side board, each panel = path[@x0,y0,x1,y1 in 0..1]|label.
Every panel is scaled to the same height. Prints luma mean / std and edge density (Sobel > 0.12 at 402-px width) per
panel, the detail-density ruler from TECHNIQUES.md §8."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

out, title, specs = sys.argv[1], sys.argv[2], sys.argv[3:]
H = int(1100)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 22)
    tfont = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 26)
except OSError:
    font = tfont = ImageFont.load_default()

def stats(im):
    w = 402
    h = max(1, round(im.height * w / im.width))
    g = np.asarray(im.convert('L').resize((w, h), Image.LANCZOS)).astype(float) / 255.0
    gx = np.zeros_like(g); gy = np.zeros_like(g)
    gx[:, 1:-1] = g[:, 2:] - g[:, :-2]
    gy[1:-1, :] = g[2:, :] - g[:-2, :]
    mag = np.hypot(gx, gy)
    return g.mean(), g.std(), (mag > 0.12).mean()

panels = []
for sp in specs:
    path, label = sp.split('|', 1)
    box = None
    if '@' in path:
        path, b = path.split('@')
        box = [float(v) for v in b.split(',')]
    im = Image.open(path).convert('RGB')
    if box is not None:
        W, Hh = im.size
        im = im.crop((int(box[0] * W), int(box[1] * Hh), int(box[2] * W), int(box[3] * Hh)))
    m, s, e = stats(im)
    print(f'{label:40s} luma {m:.3f} ± {s:.3f}  edges {e:.3f}')
    sc = H / im.height
    panels.append((im.resize((max(1, round(im.width * sc)), H), Image.LANCZOS), f'{label}  e={e:.2f}'))

gap = 12
Wt = sum(p.width for p, _ in panels) + gap * (len(panels) + 1)
board = Image.new('RGB', (Wt, H + 90), (13, 27, 38))
d = ImageDraw.Draw(board)
d.text((gap, 10), title, fill=(143, 227, 255), font=tfont)
x = gap
for im, lab in panels:
    board.paste(im, (x, 80))
    d.text((x + 4, 50), lab, fill=(200, 230, 240), font=font)
    x += im.width + gap
board.save(out, quality=86)
print('wrote', out, board.size)
