# op-frame21 (E435): Jake's labelled A / B board per shard from capture.mjs's shots (iPhone 16 Pro portrait, muted).
#   python3 progress/shard-platform/frame21/board.py <capture-dir> <out-dir>
# Writes <slug>-ab-board.jpg (A = the grid as now, B = the shard's own composite, and SHARD SELECT for reference) and the
# panels as JPEG beside it.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
ROWS = {
  'nine-dragon-stack': ('Nine Dragon in the grid: its own Jiehua composite (Debug > Look > Grid cell own composite)',
                        "B · its own composite (ink, bleed, drizzle, its LUT)"),
  'far-reach': ('Sky Reach in the grid: its own tone curve (Debug > Look > Grid cell own composite)',
                'B · its own tone curve (NEUTRAL, as standalone)'),
}
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', size)
for slug, (title, b) in ROWS.items():
  shots = [(f'{slug}-grid-A.png', 'A · the grid as now (the engine chain)'), (f'{slug}-grid-B.png', b), (f'{slug}-select.png', 'SHARD SELECT (standalone), for reference')]
  if not all((src / name).exists() for name, _ in shots): continue
  panels = []
  for name, label in shots:
    im = Image.open(src / name).convert('RGB')
    im = im.resize((540, round(im.height * 540 / im.width)))
    im.save(out / name.replace('.png', '.jpg'), quality=72)
    d = ImageDraw.Draw(im)
    d.rectangle([0, im.height - 70, im.width, im.height], fill=(0, 0, 0))
    d.text((14, im.height - 56), label, font=font(21), fill=(255, 255, 255))
    panels.append(im)
  w, h = sum(p.width for p in panels) + 20 * (len(panels) - 1), panels[0].height + 70
  board = Image.new('RGB', (w, h), (18, 18, 22))
  ImageDraw.Draw(board).text((14, 18), title, font=font(30), fill=(255, 255, 255))
  x = 0
  for p in panels: board.paste(p, (x, 70)); x += p.width + 20
  board.save(out / f'{slug}-ab-board.jpg', quality=70)
  print(out / f'{slug}-ab-board.jpg')
