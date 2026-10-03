"""measure.py <capdir>: the council's numbers for each mock-* view against its mockup (E399 round-5 rule: LUMINANCE,
Rec. 709 0.2126 R + 0.7152 G + 0.0722 B, never the max channel): the top-1 % luminance, the share of the frame above 230,
and the mean colour of the lower-left meadow region (rows 62-78 %, the left 45 %). Frames compared at 390 x 844, rows
60-700 only (under the top HUD, over the bottom bar)."""
import json, os, sys
import numpy as np
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
cap = sys.argv[1]
d = json.load(open(os.path.join(REPO, 'art/far-reach/progress/cameras.json')))
for s in d['shots']:
    if not s['id'].startswith('mock-'):
        continue
    for name, path in (('mock', os.path.join(REPO, s['mockup'])), ('game', os.path.join(cap, s['id'] + '.jpg'))):
        if not os.path.exists(path):
            continue
        a = np.asarray(Image.open(path).convert('RGB').resize((390, 844))).astype(float)
        lum = (a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722)[60:700]
        meadow = a[int(844 * 0.62):int(844 * 0.78), 0:int(390 * 0.45)].reshape(-1, 3).mean(0)
        print(f"{s['id'][5:]:16} {name}  lum p99 {np.percentile(lum, 99):5.1f}  >230 {100 * (lum > 230).mean():4.1f}%  meadow {meadow.round(0)}")
