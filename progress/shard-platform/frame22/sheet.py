# op-frame22 (E435): Sky Reach's grid A / B after the fix, labelled (iPhone 16 Pro portrait, muted, phone tier 2x).
#   python3 progress/shard-platform/frame22/sheet.py <sky-loading-out-dir> <out.jpg>
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', size)
shots = [('sky-A-4s.png', 'A · row off: the engine chain, AgX'), ('sky-B-4s.png', 'B · row on: its NEUTRAL curve (fixed)')]
panels = []
for name, label in shots:
  im = Image.open(src / name).convert('RGB')
  im = im.resize((540, round(im.height * 540 / im.width)))
  d = ImageDraw.Draw(im)
  d.rectangle([0, im.height - 64, im.width, im.height], fill=(0, 0, 0))
  d.text((14, im.height - 50), label, font=font(22), fill=(255, 255, 255))
  panels.append(im)
w, h = sum(p.width for p in panels) + 20, panels[0].height + 70
sheet = Image.new('RGB', (w, h), (18, 18, 22))
ImageDraw.Draw(sheet).text((14, 20), 'Sky Reach in the grid, north dock, 4 s after ready (Grid cell own composite)', font=font(24), fill=(255, 255, 255))
x = 0
for p in panels: sheet.paste(p, (x, 70)); x += p.width + 20
sheet.save(out, quality=70)
print(out, out.stat().st_size)
