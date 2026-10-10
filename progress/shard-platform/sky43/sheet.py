# op-sky43 (op-sky40's / op-sky36's, from op-look25's, E435 G321): a labelled board per shard from capture.mjs's shots
# (iPhone 16 Pro portrait, muted), one row per group of panels (groups split by a lone '//').
#   python3 progress/shard-platform/sky43/sheet.py <out.jpg> "<title>" <png>="<label>" ... [// <png>="<label>" ...]
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out, title, *args = sys.argv[1:]
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', size)
rows, row = [], []
for arg in args:
  if arg == '//': rows.append(row); row = []; continue
  shot, label = arg.split('=', 1)
  im = Image.open(shot).convert('RGB')
  im = im.resize((540, round(im.height * 540 / im.width)))
  d = ImageDraw.Draw(im)
  d.rectangle([0, im.height - 70, im.width, im.height], fill=(0, 0, 0))
  d.text((14, im.height - 56), label, font=font(21), fill=(255, 255, 255))
  row.append(im)
if row: rows.append(row)
w = max(sum(p.width for p in r) + 20 * (len(r) - 1) for r in rows)
h = 70 + sum(r[0].height for r in rows) + 20 * (len(rows) - 1)
board = Image.new('RGB', (w, h), (18, 18, 22))
ImageDraw.Draw(board).text((14, 18), title, font=font(30), fill=(255, 255, 255))
y = 70
for r in rows:
  x = 0
  for p in r: board.paste(p, (x, y)); x += p.width + 20
  y += r[0].height + 20
Path(out).parent.mkdir(parents=True, exist_ok=True)
board.save(out, quality=int(__import__('os').environ.get('QUALITY', '70')))
print(out)
