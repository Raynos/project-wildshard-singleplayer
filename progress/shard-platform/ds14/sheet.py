# sp-o4 DS1.4 look parity board: per shard, the shipped graph (A) beside the SDK-authored graph (B) on iPhone 16 Pro
# portrait and desktop, every panel labelled, with the A/B pixel difference measured over every shot pair.
#   python3 progress/shard-platform/ds14/sheet.py <capture-dir> <out.jpg>
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
font = lambda size: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', size)
SLUGS = [('ink-cel-valley', 'Ink & Cel Valley'), ('pastel-plain', 'Pastel Plain')]
PW, DW, BAR, GAP = 230, 520, 34, 12


def diff(stem):
  a, b = src / f'{stem}-A.png', src / f'{stem}-B.png'
  if not (a.exists() and b.exists()): return None
  x, y = (np.asarray(Image.open(p).convert('RGB'), dtype=np.int16) for p in (a, b))
  if x.shape != y.shape: return None
  d = np.abs(x - y).max(axis=2)
  return float(d.mean()), float((d > 8).mean() * 100), int(d.max())


def panel(stem, tag, width, label):
  path = src / f'{stem}-{tag}.png'
  im = Image.open(path).convert('RGB') if path.exists() else Image.new('RGB', (width, width), (60, 20, 20))
  im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
  d = ImageDraw.Draw(im)
  d.rectangle([0, im.height - BAR, im.width, im.height], fill=(0, 0, 0))
  d.text((8, im.height - BAR + 8), label, font=font(16), fill=(255, 255, 255))
  return im


rows, notes = [], []
for slug, title in SLUGS:
  phone = [panel(f'{slug}-phone-spawn', t, PW, f'{t} · {"shipped" if t == "A" else "SDK"} · iPhone') for t in ('A', 'B')]
  desk = [panel(f'{slug}-desktop-spawn', t, DW, f'{t} · {"shipped graph JSON" if t == "A" else "SDK TSL graph()"} · desktop') for t in ('A', 'B')]
  stats = []
  for dev in ('phone', 'desktop'):
    for pose in ('spawn', 'quarter'):
      r = diff(f'{slug}-{dev}-{pose}')
      stats.append(f'{dev} {pose}: ' + ('missing' if r is None else f'mean {r[0]:.2f}/255, {r[1]:.2f}% px > 8, max {r[2]}'))
  rows.append((title, phone, desk))
  notes.append((title, stats))

width = 2 * PW + GAP + 2 * DW + GAP * 4
row_h = max(max(p.height for p in phone), max(d.height for d in desk))
head = 120
height = head + len(rows) * (row_h + 46 + 4 * 22 + GAP) + 20
board = Image.new('RGB', (width, height), (24, 24, 28))
d = ImageDraw.Draw(board)
d.text((GAP, 14), 'DS1.4 look parity: shipped graph JSON (A) vs SDK-authored TSL graph() (B)', font=font(28), fill=(255, 255, 255))
d.text((GAP, 54), 'Graph materials on · midday · spawn pose · same build except data/rock.graph.json', font=font(18), fill=(200, 200, 210))
d.text((GAP, 82), 'iPhone 16 Pro portrait (phone tier) left · desktop 1440 × 900 (desktop tier) right', font=font(18), fill=(200, 200, 210))
y = head
for (title, phone, desk), (_, stats) in zip(rows, notes):
  d.text((GAP, y), title, font=font(24), fill=(255, 220, 140))
  y += 34
  x = GAP
  for im in phone + desk:
    board.paste(im, (x, y)); x += im.width + GAP
  y += row_h + 6
  for line in stats:
    d.text((GAP, y), 'A vs B  ' + line, font=font(16), fill=(180, 230, 180)); y += 22
  y += GAP
board.save(out, quality=82)
print(out, board.size, out.stat().st_size)
for title, stats in notes: print(title, *stats, sep='\n  ')
