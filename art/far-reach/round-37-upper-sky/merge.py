"""Feather a gen.py take's upper sky back into the panorama source (E410 #2).

  python3 merge.py <take.png> <out.jpg> [band row] [feather rows] [edge px]

The take is the 1536 x 1024 edit of headings -48..+48 deg, rows 0-983 of
art/far-reach/round-17-mockup-loop/panorama-warm.jpg (15.36 px a degree, heading 0 at column 0, the horizon at row 564).
Only rows above `band` (default 400: ~10.6 deg up, clear of the sun's disc at ~6 deg and most of its glow) come from the
take, eased in over `feather` rows (default 90) and over `edge` px at the crop's two ends (default 120), so the strip
stays seamless round the compass and at the horizon. Then: python3 ../round-14-loop-4/pano/prep.py 564 <out.jpg>.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '../round-17-mockup-loop/panorama-warm.jpg')
PPD, SPAN, ROWS = 15.36, 48, 983
take, out = sys.argv[1], sys.argv[2]
band = int(sys.argv[3]) if len(sys.argv) > 3 else 400
feather = int(sys.argv[4]) if len(sys.argv) > 4 else 90
edge = int(sys.argv[5]) if len(sys.argv) > 5 else 120

src = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)
H, W, _ = src.shape
half = int(round(SPAN * PPD))
cols = np.concatenate([np.arange(W - half, W), np.arange(0, half)])
new = np.asarray(Image.open(take).convert('RGB').resize((len(cols), ROWS), Image.LANCZOS)).astype(np.float64)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


rows = np.arange(ROWS)[:, None]
x = np.arange(len(cols))[None, :]
w = (1 - smooth(band - feather, band, rows)) * smooth(0, edge, x) * smooth(0, edge, len(cols) - 1 - x)
merged = src.copy()
merged[:ROWS, cols] = src[:ROWS, cols] * (1 - w[..., None]) + new * w[..., None]
Image.fromarray(merged.clip(0, 255).astype(np.uint8)).save(out, quality=95)
print('wrote', out, 'band', band, 'feather', feather, 'edge', edge)
