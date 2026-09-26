#!/usr/bin/env python3
"""board.py <out.jpg> <title> <img>[@crop x0,y0,x1,y1 in fractions][=label] ... [// <img> ...] — a labelled board.
Every panel of a row is scaled to the row's height (--h=, default 900); `//` starts a new row, `//<px>` a new row of
that height. --q= sets the JPEG quality (default 86). Used for loop-<n>.jpg (capture crop | target crop, per subject)."""
import sys
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith('--')]
H = int(next((a[4:] for a in sys.argv if a.startswith('--h=')), '900'))
Q = int(next((a[4:] for a in sys.argv if a.startswith('--q=')), '86'))
out, title, items = args[0], args[1], args[2:]
rows = [[]]
heights = [H]
for it in items:
    if it.startswith('//'):
        rows.append([])
        heights.append(int(it[2:]) if len(it) > 2 else H)
        continue
    rows[-1].append(it)


def row_panels(items, H):
  panels = []
  for it in items:
      label = ''
      if '=' in it:
          it, label = it.split('=', 1)
      crop = None
      if '@' in it:
          it, c = it.split('@', 1)
          crop = [float(x) for x in c.split(',')]
      im = Image.open(it).convert('RGB')
      if crop is not None:
          W0, H0 = im.size
          im = im.crop((int(crop[0] * W0), int(crop[1] * H0), int(crop[2] * W0), int(crop[3] * H0)))
      im = im.resize((max(1, round(im.width * H / im.height)), H), Image.LANCZOS)
      panels.append((im, label))
  return panels


gap, top = 8, 34
allrows = [row_panels(r, h) for r, h in zip(rows, heights)]
W = max(sum(p.width for p, _ in ps) + gap * (len(ps) + 1) for ps in allrows)
sheet = Image.new('RGB', (W, top + sum(h + gap for h in heights)), (13, 27, 38))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 16)
except OSError:
    font = ImageFont.load_default()
d.text((gap, 8), title, fill=(143, 227, 255), font=font)
y = top
for ri, panels in enumerate(allrows):
    x = gap
    for im, label in panels:
        sheet.paste(im, (x, y))
        if label:
            d.rectangle([x, y, x + 10 * len(label) + 12, y + 24], fill=(13, 27, 38))
            d.text((x + 6, y + 4), label, fill=(143, 227, 255), font=font)
        x += im.width + gap
    y += heights[ri] + gap
sheet.save(out, quality=Q)
print(out, sheet.size)
