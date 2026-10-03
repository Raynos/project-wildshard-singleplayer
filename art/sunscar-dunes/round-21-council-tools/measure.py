"""measure.py <capdir> [<capdir2>]: the council's numbers for each Signal Dunes mock-* view against its mockup (E399; the
round-5 rule: LUMINANCE, Rec. 709 0.2126 R + 0.7152 G + 0.0722 B, never one channel). Frames compared at 390 x 844.

  near sand  the seats' clean patch: x 10-190, y 1160-1420 of the frame at 780 x 1688 (clear of the coil, Sefa and the HUD;
             round 9: the old rows 60-86 % x the left 40 % took in the coil and Sefa; round 10, R10B-8: the lowered hold's cord
             reached x 207-240 and the HUD bar y 1425+, so the patch narrowed): mean, p50,
             p5-p95 spread, fine detail (mean |luma - luma blurred by a 2 px gaussian|) and the mean colour
  frame      top-1 % luminance and the share above 230, rows 120-1400 of 1688 (under the top HUD, over the bottom bar)

With a second capture dir it prints that one too (e.g. the previous round's), so a gain in one view never silently costs
another (the lead's round-6 rule)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
W = np.array([0.2126, 0.7152, 0.0722])

def stats(path):
    im = Image.open(path).convert('RGB').resize((780, 1688), Image.LANCZOS)
    rgb = np.asarray(im).astype(float); lum = rgb @ W
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(2))).astype(float) @ W
    rows, cols = slice(1160, 1420), slice(10, 190)
    s = lum[rows, cols]; c = rgb[rows, cols].reshape(-1, 3).mean(0); f = lum[120:1400]
    return (f'sand mean {s.mean():5.1f} p50 {np.percentile(s, 50):5.1f} spread {np.percentile(s, 95) - np.percentile(s, 5):5.1f} '
            f'fine {np.abs(lum - blur)[rows, cols].mean():4.1f} rgb {c.round(0)}  frame p99 {np.percentile(f, 99):5.1f} >230 {100 * (f > 230).mean():4.1f}%')

d = json.load(open(os.path.join(REPO, 'art/sunscar-dunes/progress/cameras.json')))
caps = sys.argv[1:]
for s in d['shots']:
    if not s['id'].startswith('mock-'):
        continue
    print(s['id'][5:])
    print('  mock ', stats(os.path.join(REPO, s['mockup'])))
    for cap in caps:
        p = os.path.join(cap, s['id'] + '.jpg')
        if os.path.exists(p):
            print(f'  {os.path.basename(os.path.normpath(cap))[-8:]:8}', stats(p))
