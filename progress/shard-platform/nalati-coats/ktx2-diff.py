#!/usr/bin/env python3
"""ktx2-diff.py — SHARD-PLATFORM G226 (E435): each Nalati baked coat's KTX2 stand-in against its lossless coat (the
procedural paint's exact pixels, coat-diff.mjs proves that part), per tier.

basisu -unpack transcodes each KTX2 to every GPU format; level 0 of ASTC 4x4 (the iPhone, and Apple-silicon desktop
Chrome) and BC7 (other desktops) is decoded and compared with the WebP: mean absolute error, PSNR and the largest channel
difference over RGB. Writes ktx2-diff.json beside this file.

  python3 progress/shard-platform/nalati-coats/ktx2-diff.py
"""
import glob
import json
import math
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PUB = os.path.join(ROOT, 'public')
table = json.load(open(os.path.join(ROOT, 'scripts', 'bake-nalati-coats.json')))
out = {}
for tier in ('phone', 'desktop'):
    rows = {}
    for served, ktx2 in sorted(table[tier].items()):
        src = np.asarray(Image.open(PUB + served).convert('RGB'), dtype=np.float64)
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(['basisu', '-unpack', '-no_ktx', PUB + ktx2], cwd=tmp, check=True, capture_output=True)
            row = {}
            for fmt in ('ASTC', 'BC7'):
                hits = [f for f in glob.glob(os.path.join(tmp, f'*_{fmt}*level_0_face_0_layer_0000.png')) if 'rgba' in os.path.basename(f) or 'rgb' in os.path.basename(f)]
                if not hits:
                    continue
                dec = np.asarray(Image.open(sorted(hits)[0]).convert('RGB'), dtype=np.float64)
                d = np.abs(dec - src)
                mse = float(np.mean(d ** 2))
                row[fmt] = {'mae': round(float(np.mean(d)), 3), 'psnr': round(10 * math.log10(255 ** 2 / mse), 2) if mse > 0 else None, 'max': int(d.max())}
        rows[served] = {'ktx2': ktx2, 'bytes': os.path.getsize(PUB + ktx2), 'webpBytes': os.path.getsize(PUB + served), **row}
    out[tier] = rows
    worst = min((r[f]['psnr'] for r in rows.values() for f in ('ASTC', 'BC7') if f in r and r[f]['psnr'] is not None), default=None)
    print(f'ktx2-diff {tier}: {len(rows)} coats, lowest PSNR {worst} dB')
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'ktx2-diff.json'), 'w'), indent=1)
