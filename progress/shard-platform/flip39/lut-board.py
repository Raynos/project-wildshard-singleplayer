#!/usr/bin/env python3
"""op-flip39 (G326, E435): Pine Hollow's parity against its frozen legacy copy with the learned LUT that copy lost.

SF73 froze legacy under the level id `pine-hollow-legacy`; its look calls `loadLUT(level.id)`, which finds no
`/assets/lut/pine-hollow-legacy.bin`, so legacy renders without Pine's LUT (PH-L4) while the shardfile entry keeps it.
This applies `public/assets/lut/pine-hollow.bin` (33^3 RGBA8, index (b*33+g)*33+r, display sRGB in and out, trilinear) to
op-ship38 parity.mjs's legacy captures, scores each pose (MAE 0-255 on 390-px copies, as parity.mjs does) and writes the
labelled board: LEGACY (as served) | LEGACY + PINE LUT | SHARDFILE, plus lut-check.json.

  python3 progress/shard-platform/flip39/lut-board.py <capture dir from parity.mjs> [<lut-skipped capture dir>]
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
N = 33
cap = sys.argv[1]
skipped = sys.argv[2] if len(sys.argv) > 2 else None
lut = np.frombuffer(open(os.path.join(ROOT, 'public/assets/lut/pine-hollow.bin'), 'rb').read(), dtype=np.uint8)
L = lut.reshape(N, N, N, 4)[..., :3].astype(np.float32) / 255  # [b][g][r]


def apply_lut(img: Image.Image) -> Image.Image:
    a = np.asarray(img).astype(np.float32) / 255 * (N - 1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    r0, g0, b0 = [np.clip(np.floor(x).astype(int), 0, N - 2) for x in (r, g, b)]
    fr, fg, fb = r - r0, g - g0, b - b0
    out = np.zeros_like(a)
    for db in (0, 1):
        for dg in (0, 1):
            for dr in (0, 1):
                w = (fr if dr else 1 - fr) * (fg if dg else 1 - fg) * (fb if db else 1 - fb)
                out += w[..., None] * L[b0 + db, g0 + dg, r0 + dr]
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))


def small(img: Image.Image) -> np.ndarray:
    return np.asarray(img.resize((390, round(img.height * 390 / img.width)))).astype(float)


def mae(a: Image.Image, b: Image.Image) -> float:
    return round(float(np.abs(small(a) - small(b)).mean()), 1)


report = {'lut': 'public/assets/lut/pine-hollow.bin', 'poses': []}
tmp = tempfile.mkdtemp()
rows = []
for pose in ('view-1', 'view-2', 'view-3'):
    leg = Image.open(os.path.join(cap, f'pine-hollow-{pose}-legacy.jpg')).convert('RGB')
    sf = Image.open(os.path.join(cap, f'pine-hollow-{pose}-shardfile.jpg')).convert('RGB')
    lg = apply_lut(leg)
    row = {'pose': pose, 'legacyVsShardfile': mae(leg, sf), 'legacyPlusLutVsShardfile': mae(lg, sf),
           'mean': {'legacy': small(leg).mean((0, 1)).round(1).tolist(), 'legacyPlusLut': small(lg).mean((0, 1)).round(1).tolist(), 'shardfile': small(sf).mean((0, 1)).round(1).tolist()}}
    if skipped:
        sk = json.load(open(os.path.join(skipped, 'parity-pine-hollow.json')))
        row['shardfileLutSkippedVsLegacy'] = next(d['mae'] for d in sk['diffs'] if d['pose'] == pose)
    report['poses'].append(row)
    lg.save(os.path.join(tmp, 'lg.jpg'), quality=92)
    panels = [(os.path.join(cap, f'pine-hollow-{pose}-legacy.jpg'), f'LEGACY as served (no LUT) · {pose}', 'a'),
              (os.path.join(tmp, 'lg.jpg'), f'LEGACY + PINE LUT · MAE {row["legacyPlusLutVsShardfile"]}', 'b'),
              (os.path.join(cap, f'pine-hollow-{pose}-shardfile.jpg'), f'SHARDFILE · MAE vs legacy {row["legacyVsShardfile"]}', 'c')]
    outs = []
    for src, text, k in panels:
        o = os.path.join(tmp, f'{pose}-{k}.png')
        subprocess.run(['magick', src, '-resize', '400x', '-gravity', 'north', '-background', '#111', '-splice', '0x36', '-fill', 'white', '-pointsize', '17', '-annotate', '+0+9', text, o], check=True)
        outs.append(o)
    r = os.path.join(tmp, f'{pose}.png')
    subprocess.run(['magick', *outs, '+append', r], check=True)
    rows.append(r)
body = os.path.join(tmp, 'body.png')
subprocess.run(['magick', *rows, '-append', body], check=True)
live = '' if not skipped else ' · live: SHARDFILE with only its LUT pass skipped vs LEGACY = MAE ' + ' / '.join(str(p['shardfileLutSkippedVsLegacy']) for p in report['poses'])
subprocess.run(['magick', body, '-gravity', 'north', '-background', '#000', '-splice', '0x104', '-fill', 'white', '-gravity', 'northwest',
                '-pointsize', '24', '-annotate', '+14+8', "G326 Pine Hollow: the frozen LEGACY copy lost Pine's learned LUT",
                '-pointsize', '16', '-annotate', '+14+42', "Cause: SF73 renamed legacy's level id to pine-hollow-legacy; loadLUT(level.id) finds no file, so legacy draws no LUT pass.",
                '-annotate', '+14+64', 'MAE (0-255) against SHARDFILE unless noted' + live,
                '-annotate', '+14+84', 'same poses · iPhone 16 Pro · Developer on · midday · build 0d7b1b9',
                '-quality', '72', os.path.join(HERE, 'board-pine-hollow.jpg')], check=True)
json.dump(report, open(os.path.join(HERE, 'lut-check.json'), 'w'), indent=1)
print(json.dumps(report))
