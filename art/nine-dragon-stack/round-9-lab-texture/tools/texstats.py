#!/usr/bin/env python3
"""texstats.py <capture> <edit> [region x0,y0,x1,y1 fractions] ... — how 'painted' a surface region reads, capture vs
its codex edit: mean luma, the fine texture energy (std of luma minus a 3 px blur: brush dabs, grain, joints) and the
mid texture energy (3–12 px band: grime runs, blotches, stains). Ratios near 1.0 = the capture carries as much painted
surface detail as the painter put there."""
import sys
import numpy as np
from PIL import Image, ImageFilter


def luma(im):
    a = np.asarray(im.convert('RGB')).astype(np.float64) / 255
    return a @ np.array([0.2126, 0.7152, 0.0722])


def stats(path, box, size):
    im = Image.open(path).convert('RGB').resize(size, Image.LANCZOS)
    W, H = im.size
    im = im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)))
    L = luma(im)
    b3 = luma(im.filter(ImageFilter.GaussianBlur(3)))
    b12 = luma(im.filter(ImageFilter.GaussianBlur(12)))
    return L.mean(), (L - b3).std(), (b3 - b12).std()


cap, edit = sys.argv[1], sys.argv[2]
regions = [[float(x) for x in r.split(',')] for r in sys.argv[3:]] or [[0, 0.62, 1, 1]]
size = Image.open(cap).size
for r in regions:
    c, e = stats(cap, r, size), stats(edit, r, size)
    print(f'region {r}: luma {c[0]:.3f} vs {e[0]:.3f} | fine {c[1]:.4f} vs {e[1]:.4f} ({c[1] / e[1]:.2f}) | mid {c[2]:.4f} vs {e[2]:.4f} ({c[2] / e[2]:.2f})')
