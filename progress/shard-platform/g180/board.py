#!/usr/bin/env python3
"""G180 (E435): the content-cut boards for Jake, one per lever (view distance, tree density, herd size), each an A / B / C
board in iPhone portrait: A = today (the trim on), B and C = the two steps, the same three poses (gate, cabin, pond) down
the columns, each option's measured MB (labelled GL bytes and the JS heap, the mean of its runs, against A's) on its head.

python3 progress/shard-platform/g180/board.py <capture root> <out dir>
  <capture root>/<label>[-<run>]/{gate,cabin,pond}.png + measure.json, written by cut-capture.mjs
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

root, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
POSES = ['gate', 'cabin', 'pond']
LEVERS = [
    ('view-distance', 'VIEW DISTANCE', [('base', 'today'), ('view75', '75 %'), ('view50', '50 %')],
     'tree hi / lo / twig, cabin detail, animal draw / shadow, sun shadow reach x step'),
    ('tree-density', 'TREE DENSITY', [('base', 'today'), ('trees75', '75 %'), ('trees50', '50 %')],
     'the forest thinned evenly (every tree kept with the step\'s chance)'),
    ('herd-size', 'HERD SIZE', [('base', 'today'), ('herd50', '50 %'), ('herd25', '25 %')],
     'every herd group scaled (deer, boar, elk, bear)'),
]
F = '/System/Library/Fonts/HelveticaNeue.ttc'
big, mid, small = ImageFont.truetype(F, 44), ImageFont.truetype(F, 30), ImageFont.truetype(F, 24)


def runs(label):
    """every run of a label: <label>, <label>-2, <label>-3 … (the shots come from the first)"""
    out_runs = []
    for name in sorted(os.listdir(root)):
        if name == label or (name.startswith(label + '-') and name[len(label) + 1:].isdigit()):
            with open(os.path.join(root, name, 'measure.json')) as f:
                out_runs.append(json.load(f))
    return out_runs


def mean(xs):
    return sum(xs) / len(xs)


TW, TH = 360, 610
summary = {}
for slug, title, options, note in LEVERS:
    head = 250
    board = Image.new('RGB', (TW * 3, head + TH * 3 + 70), (14, 17, 22))
    d = ImageDraw.Draw(board)
    d.text((24, 18), f'PINE HOLLOW · {title}', font=big, fill=(236, 240, 244))
    d.text((24, 74), 'Pine memory trim ON (B1 B2 B4 B5) · phone tier · iPhone 16 Pro · midday', font=small, fill=(150, 160, 172))
    base = runs('base')
    gl0, heap0 = mean([r['glBytes'] for r in base]), mean([r['heapBytes'] for r in base])
    rows = []
    for i, (label, text) in enumerate(options):
        rs = runs(label)
        gl, heap = mean([r['glBytes'] for r in rs]), mean([r['heapBytes'] for r in rs])
        animals = rs[0]['animals']
        x = i * TW
        letter = 'ABC'[i]
        d.text((x + 24, 120), f'{letter} · {text}', font=mid, fill=(236, 240, 244))
        if i == 0:
            d.text((x + 24, 160), f'GL {gl / 1e6:.0f} MB', font=small, fill=(150, 160, 172))
            d.text((x + 24, 190), f'heap {heap / 1e6:.0f} MB · {animals} animals', font=small, fill=(150, 160, 172))
        else:
            dg, dh = (gl - gl0) / 1e6, (heap - heap0) / 1e6
            d.text((x + 24, 160), f'GL {dg:+.1f} MB', font=small, fill=(120, 220, 160) if dg < -2 else (230, 200, 120))
            d.text((x + 24, 190), f'heap {dh:+.1f} MB · {animals} animals', font=small, fill=(120, 220, 160) if dh < -2 else (230, 200, 120))
        rows.append({'option': letter, 'label': label, 'step': text, 'runs': len(rs), 'glMB': round(gl / 1e6, 2), 'heapMB': round(heap / 1e6, 2),
                     'glDeltaMB': round((gl - gl0) / 1e6, 2), 'heapDeltaMB': round((heap - heap0) / 1e6, 2), 'animals': animals,
                     'glRunsMB': [round(r['glBytes'] / 1e6, 2) for r in rs], 'heapRunsMB': [round(r['heapBytes'] / 1e6, 2) for r in rs]})
        for j, pose in enumerate(POSES):
            first = label if os.path.exists(os.path.join(root, label, f'{pose}.png')) else f'{label}-1'
            im = Image.open(os.path.join(root, first, f'{pose}.png')).convert('RGB')
            im = im.resize((TW - 6, int(im.height * (TW - 6) / im.width)))
            im = im.crop((0, 0, TW - 6, TH - 6))
            board.paste(im, (x + 3, head + j * TH + 3))
    for j, pose in enumerate(POSES):
        d.text((10, head + j * TH + 10), pose.upper(), font=small, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    d.text((24, head + TH * 3 + 18), note, font=small, fill=(150, 160, 172))
    board.save(os.path.join(out, f'board-{slug}.jpg'), quality=74)
    summary[slug] = rows
with open(os.path.join(out, 'measured.json'), 'w') as f:
    json.dump({'$doc': 'G180 content-cut boards: per option the mean labelled GL bytes and JS heap over its runs (decimal MB), the delta against A (today, trim on)', 'levers': summary}, f, indent=1)
    f.write('\n')
print(json.dumps(summary, indent=1))
