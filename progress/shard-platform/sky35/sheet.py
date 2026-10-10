# op-sky35 (from op-look25's, E435 G321): a labelled board per shard from capture.mjs's shots (iPhone 16 Pro portrait, muted).
#   python3 progress/shard-platform/sky35/sheet.py <capture-dir> <out-dir> <slug> "<title>" <shot>="<label>" ...
# <shot> is a capture file stem without the slug (grid-A, grid-B, select) or a path to a png; writes <out>/<name>.jpg
# (name: the slug, or --name=<name> first).
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
name = None
if args and args[0].startswith('--name='): name = args.pop(0)[7:]
src, out, slug, title, *rows = args
src, out = Path(src), Path(out)
out.mkdir(parents=True, exist_ok=True)
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', size)
panels = []
for row in rows:
  shot, label = row.split('=', 1)
  path = Path(shot) if shot.endswith('.png') else src / f'{slug}-{shot}.png'
  if not path.exists(): print('missing', path); continue
  im = Image.open(path).convert('RGB')
  im = im.resize((540, round(im.height * 540 / im.width)))
  d = ImageDraw.Draw(im)
  d.rectangle([0, im.height - 70, im.width, im.height], fill=(0, 0, 0))
  d.text((14, im.height - 56), label, font=font(21), fill=(255, 255, 255))
  panels.append(im)
w, h = sum(p.width for p in panels) + 20 * (len(panels) - 1), panels[0].height + 70
board = Image.new('RGB', (w, h), (18, 18, 22))
ImageDraw.Draw(board).text((14, 18), title, font=font(30 if len(panels) > 2 else 22), fill=(255, 255, 255))
x = 0
for p in panels: board.paste(p, (x, 70)); x += p.width + 20
target = out / f'{name or slug}.jpg'
board.save(target, quality=70)
print(target)
