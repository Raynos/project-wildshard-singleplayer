# sp-o5 look48: one labelled board per shard from capture.mjs's shots: iPhone 16 Pro portrait on top (SHARD SELECT · grid
# cell), desktop 1440 × 900 under it (SHARD SELECT · grid cell), every panel with a burned-in label.
#   python3 progress/shard-platform/look48/sheet.py <capture-dir> <out-dir> <slug> "<title>" "<verdict line>"
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, out, slug, title, verdict = sys.argv[1:6]
src, out = Path(src), Path(out)
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', size)
W, GAP, BAR = 540, 20, 54


def panel(stem, label):
  path = src / f'{slug}-{stem}.png'
  if path.exists():
    im = Image.open(path).convert('RGB')
    im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
  else:
    im = Image.new('RGB', (W, 300), (60, 20, 20))
    ImageDraw.Draw(im).text((14, 130), 'NO SHOT (see capture json)', font=font(22), fill=(255, 200, 200))
  d = ImageDraw.Draw(im)
  d.rectangle([0, im.height - BAR, im.width, im.height], fill=(0, 0, 0))
  d.text((12, im.height - BAR + 14), label, font=font(20), fill=(255, 255, 255))
  return im


rows = [[panel('select', 'A  SHARD SELECT · iPhone 16 Pro'), panel('grid-now', 'B  grid cell · iPhone 16 Pro')],
        [panel('select-desktop', 'C  SHARD SELECT · desktop'), panel('grid-now-desktop', 'D  grid cell · desktop')]]
head = 110
h = head + sum(max(p.height for p in r) for r in rows) + GAP * len(rows)
board = Image.new('RGB', (2 * W + GAP, h), (18, 18, 22))
d = ImageDraw.Draw(board)
d.text((14, 14), title, font=font(22), fill=(255, 255, 255))
line, y0 = '', 50  # the verdict, wrapped to the board's width
for word in verdict.split():
  if d.textlength(f'{line} {word}', font=font(19)) > 2 * W + GAP - 28: d.text((14, y0), line, font=font(19), fill=(220, 220, 160)); line, y0 = word, y0 + 26
  else: line = f'{line} {word}'.strip()
d.text((14, y0), line, font=font(19), fill=(220, 220, 160))
y = head
for r in rows:
  x = 0
  for p in r: board.paste(p, (x, y)); x += W + GAP
  y += max(p.height for p in r) + GAP
out.mkdir(parents=True, exist_ok=True)
target = out / f'{slug}-board.jpg'
q = 72
while True:
  board.save(target, quality=q)
  if target.stat().st_size <= 480_000 or q <= 40: break
  q -= 6
print(target, target.stat().st_size, q)
