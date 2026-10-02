#!/usr/bin/env python3
"""shard-compare-sheet.py — side-by-side sheets of all six shards, one per kind of view (E374 polish council, E389).

  python3 scripts/shard-compare-sheet.py --out=art/shard-polish-council/round-1

Takes each shard's latest scripts/shard-progress.mjs capture (progress/<slug>/<stamp>-<sha8>/) and writes, per view kind
(first frame, the four first-person hero views h1-h4 by position, aerial-spawn, aerial-overview), one JPEG row of the six
shards with the new two first, labelled with the shard, the view id and the capture's sha.
"""
import glob, json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--out=')), 'art/shard-polish-council/latest'))
SHARDS = ['sunscar-dunes', 'far-reach', 'driftwood-isle', 'nine-dragon-stack', 'pine-hollow', 'nalati-grasslands']
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
font, small = ImageFont.truetype(FONT, 20), ImageFont.truetype(FONT, 15)
W, H, LAB = 300, 649, 54  # 390x844 portrait at 300 wide

def latest(slug):
    caps = sorted(d for d in glob.glob(os.path.join(ROOT, 'progress', slug, '*-*')) if os.path.exists(os.path.join(d, 'meta.json')))
    return (caps[-1], json.load(open(os.path.join(caps[-1], 'meta.json')))) if caps else (None, None)

caps = {s: latest(s) for s in SHARDS}
def view(slug, kind):
    d, m = caps[slug]
    if d is None: return None, None
    ids = m['shots']
    if kind in ('first-frame', 'aerial-spawn', 'aerial-overview'): sid = kind if kind in ids else None
    else:
        heroes = [s for s in ids if s[:2] in ('h1', 'h2', 'h3', 'h4')]
        k = int(kind[1]) - 1
        sid = heroes[k] if k < len(heroes) else None
    return (os.path.join(d, f'{sid}.jpg'), sid) if sid else (None, None)

os.makedirs(OUT, exist_ok=True)
for kind in ['first-frame', 'h1', 'h2', 'h3', 'h4', 'aerial-spawn', 'aerial-overview']:
    sheet = Image.new('RGB', (W * len(SHARDS) + 8 * (len(SHARDS) + 1), H + LAB + 16), '#0b0d12')
    d = ImageDraw.Draw(sheet)
    for i, slug in enumerate(SHARDS):
        x = 8 + i * (W + 8)
        path, sid = view(slug, kind)
        if path and os.path.exists(path):
            im = Image.open(path).convert('RGB'); im.thumbnail((W, H)); sheet.paste(im, (x, 8))
        else:
            d.text((x + 10, 300), 'no capture', font=font, fill=(200, 80, 80))
        sha = caps[slug][1]['sha'][:8] if caps[slug][1] else ''
        d.text((x, H + 14), ('NEW · ' if i < 2 else '') + slug, font=font, fill=(255, 217, 138) if i < 2 else (159, 230, 255))
        d.text((x, H + 38), f'{sid or kind} · {sha}', font=small, fill=(170, 180, 195))
    out = os.path.join(OUT, f'compare-{kind}.jpg')
    sheet.save(out, quality=82)
    print('wrote', os.path.relpath(out, ROOT))
