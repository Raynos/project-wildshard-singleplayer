# sp-o2 sky47 (G321): one labelled board per grid cell from capture.mjs's shots: iPhone 16 Pro portrait inside / on the
# edge band, desktop inside over desktop edge band, each panel labelled with what it is and the frame's readout.
#   python3 progress/shard-platform/sky47/sheet.py <shots-dir> <out-dir>
import json, os, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

shots, out = Path(sys.argv[1]), Path(sys.argv[2])
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', size)
reports = {s: json.loads((shots / f'capture-{s}.json').read_text()) for s in ('phone', 'desktop') if (shots / f'capture-{s}.json').exists()}
NAMES = {'driftwood-isle': 'Driftwood Isle (home cell)', 'pine-hollow': 'Pine Hollow', 'template-2': 'Template (template-2)',
         'sunscar-dunes': 'Signal Dunes', 'nalati-grasslands': 'Nalati Grasslands', 'far-reach': 'Sky Reach'}

def panel(path, label, size):
  im = Image.open(path).convert('RGB')
  im.thumbnail(size)
  d = ImageDraw.Draw(im)
  d.rectangle([0, im.height - 46, im.width, im.height], fill=(0, 0, 0))
  d.text((10, im.height - 36), label, font=font(19), fill=(255, 255, 255))
  return im

def weight(frame, cell):
  w = (frame or {}).get('weights') or {}
  return w.get(cell, 0)

cells = list(dict.fromkeys(k for r in reports.values() for k in r['cells']))
out.mkdir(parents=True, exist_ok=True)
for cell in cells:
  tiles = {}
  for s, r in reports.items():
    row = r['cells'].get(cell, {})
    for where in ('inside', 'edge'):
      shot = row.get('shots', {}).get(where)
      if not shot: continue
      f = shot['frame']
      what = 'inside its cell' if where == 'inside' else 'on the 16 m edge band'
      label = f"{'iPhone' if s == 'phone' else 'Desktop'}: {what} (weight {weight(f, cell):.2f})"
      tiles[(s, where)] = panel(shot['path'], label, (540, 1170) if s == 'phone' else (960, 600))
  if not tiles: continue
  W = 540 * 2 + 20 + 960 + 20
  H = 70 + max(1170, 1220)
  board = Image.new('RGB', (W, H), (18, 18, 22))
  ImageDraw.Draw(board).text((14, 18), f"{NAMES.get(cell, cell)}: its own sky in the grid (G321)", font=font(30), fill=(255, 255, 255))
  x = 0
  for where in ('inside', 'edge'):
    t = tiles.get(('phone', where))
    if t: board.paste(t, (x, 70))
    x += 560
  y = 70
  for where in ('inside', 'edge'):
    t = tiles.get(('desktop', where))
    if t: board.paste(t, (x, y))
    y += 620
  path = out / f'{cell}-board.jpg'
  q = 72
  while True:
    board.save(path, quality=q)
    if os.path.getsize(path) <= 480_000 or q <= 40: break
    q -= 6
  print(path, os.path.getsize(path))
