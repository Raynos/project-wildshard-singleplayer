# op-look30 (E435, SF63): numbers for the boards.
#   python3 measure.py sat <x0,x1,y0,y1> <png> ...     median / mean HSV saturation (0-255) of a screen-fraction box
#   python3 measure.py band <dir> <shot>                rank capture.mjs PROBE=4's band clips by how much each object's
#                                                       hiding changed the band (mean abs RGB difference, and the
#                                                       darkest-row change), against <shot>-band-base.png
import sys, json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

cmd, *rest = sys.argv[1:]
if cmd == 'sat':
  box, *files = rest
  x0, x1, y0, y1 = map(float, box.split(','))
  for f in files:
    im = Image.open(f).convert('RGB'); w, h = im.size
    crop = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))).convert('HSV')
    s = sorted(crop.getchannel('S').getdata()); v = ImageStat.Stat(crop.getchannel('V')).mean[0]
    print(json.dumps({'file': Path(f).name, 'satMedian': s[len(s) // 2], 'satMean': round(sum(s) / len(s), 1), 'valueMean': round(v, 1)}))
elif cmd == 'band':
  d, shot = Path(rest[0]), rest[1]
  base = Image.open(d / f'{shot}-band-base.png').convert('RGB')
  cap = json.loads((d / 'capture.json').read_text())
  probes = {}
  for row in cap['shards'].values():
    for s in row['shots'].values():
      if s['name'] == shot: probes = {p['k']: p['name'] for p in s.get('probes', [])}
  rows = []
  for f in sorted(d.glob(f'{shot}-band-[0-9]*.png')):
    k = int(f.stem.rsplit('-', 1)[1]); im = Image.open(f).convert('RGB')
    diff = ImageStat.Stat(ImageChops.difference(base, im)).mean
    rows.append((round(sum(diff) / 3, 2), k, probes.get(k, '?')))
  for r in sorted(rows, reverse=True)[:15]: print(r)
