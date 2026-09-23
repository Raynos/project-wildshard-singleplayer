# Asset pipeline for the clean-room prototype: sprites -> cleaned atlases, plates/tiles -> webp.
import json, sys
import numpy as np
from PIL import Image, ImageFilter

import os
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # dev/nalati-cleanroom; raw images in gen/raw (not committed)
RAW = D + '/gen/raw/'
OUT = D + '/assets/'


def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def blurf(a, r):
    # float blur via 16-bit trick: split into channels of 8-bit is lossy; good enough for fills
    return blur(a, r)


def clean_alpha(rgba):
    a = rgba[..., 3].astype(np.float32) / 255
    # kill specks: pixels whose neighbourhood is mostly empty
    dens = blur((a > 0.5).astype(np.float32), 6)
    a = np.where(dens < 0.18, 0, a)
    return a


def bleed(rgb, a):
    # fill transparent rgb with nearby opaque colour so bilinear/mip filtering has no dark halos
    out = rgb.copy()
    known = a > 0.5
    for r in (2, 4, 8, 16, 32, 64):
        w = np.asarray(Image.fromarray((known * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
        acc = np.zeros_like(rgb)
        for c in range(3):
            ch = np.asarray(Image.fromarray((out[..., c] * known).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)
            acc[..., c] = ch
        fill = acc / np.maximum(w[..., None], 1e-3)
        newk = w > 0.02
        m = (~known) & newk
        out[m] = fill[m]
        known = known | newk
    return out


def split_columns(a, min_gap=6):
    cols = (a > 0.3).sum(axis=0) > 2
    spans, start = [], None
    for x, c in enumerate(cols):
        if c and start is None:
            start = x
        if not c and start is not None:
            spans.append((start, x)); start = None
    if start is not None:
        spans.append((start, len(cols)))
    # merge small gaps
    merged = []
    for s in spans:
        if merged and s[0] - merged[-1][1] < min_gap:
            merged[-1] = (merged[-1][0], s[1])
        else:
            merged.append(s)
    return [s for s in merged if s[1] - s[0] > 40]


def atlas(name, cell_w, cell_h, pad=8, spans=None):
    im = np.asarray(Image.open(RAW + name + '.png').convert('RGBA')).astype(np.float32)
    a = clean_alpha(im)
    spans = spans or split_columns(a)
    print(name, 'sprites', spans)
    n = len(spans)
    W = cell_w * n
    out = np.zeros((cell_h, W, 4), np.float32)
    meta = []
    for i, (x0, x1) in enumerate(spans):
        sub_a = a[:, x0:x1]
        rows = np.where((sub_a > 0.3).sum(axis=1) > 0)[0]
        y0, y1 = rows[0], rows[-1] + 1
        crop = im[y0:y1, x0:x1].copy()
        ca = sub_a[y0:y1]
        h, w = ca.shape
        s = min((cell_w - 2 * pad) / w, (cell_h - 2 * pad) / h)
        nw, nh = int(w * s), int(h * s)
        rgb = Image.fromarray(crop[..., :3].astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
        al = Image.fromarray((ca * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
        ox = i * cell_w + (cell_w - nw) // 2
        oy = cell_h - pad - nh
        out[oy:oy + nh, ox:ox + nw, :3] = np.asarray(rgb)
        out[oy:oy + nh, ox:ox + nw, 3] = np.asarray(al)
        # uv rect (v up, GL convention with flipY)
        meta.append({'u0': ox / W, 'u1': (ox + nw) / W, 'v0': 1 - (oy + nh) / cell_h, 'v1': 1 - oy / cell_h, 'aspect': nw / nh})
    A = out[..., 3] / 255
    rgb = bleed(out[..., :3], A)
    res = np.dstack([rgb, out[..., 3]]).clip(0, 255).astype(np.uint8)
    Image.fromarray(res, 'RGBA').save(OUT + name + '.webp', quality=88, method=6)
    return meta


def tile(name, size):
    im = Image.open(RAW + name + '.png').convert('RGB').resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    # make seamless: blend with half-offset copy through a centre-weighted mask
    sh = np.roll(np.roll(a, size // 2, 0), size // 2, 1)
    y, x = np.mgrid[0:size, 0:size] / (size - 1)
    wx = 1 - np.abs(x - 0.5) * 2
    wy = 1 - np.abs(y - 0.5) * 2
    w = np.clip(np.minimum(wx, wy) * 4, 0, 1)[..., None]
    # (a is good in the centre, sh is good at the edges)
    res = a * w + sh * (1 - w)
    Image.fromarray(res.clip(0, 255).astype(np.uint8)).save(OUT + name + '.webp', quality=85, method=6)


def plate(name):
    Image.open(RAW + name + '.png').convert('RGB').save(OUT + name + '.webp', quality=86, method=6)


if __name__ == '__main__':
    what = sys.argv[1:]
    meta = {}
    try:
        meta = json.load(open(OUT + 'atlas.json'))
    except Exception:
        pass
    for w in what:
        if w == 'spruce':
            meta['spruce'] = atlas('spruce', 384, 1024)
        elif w == 'horses':
            meta['horses'] = atlas('horses', 512, 400, spans=[(0,527),(527,1031),(1031,1536)])
        elif w.startswith('plate'):
            plate(w)
        elif w in ('meadow', 'path', 'gravel'):
            tile(w, 1024)
        elif w == 'yurtwall':
            Image.open(RAW + w + '.png').convert('RGB').resize((1024, 683), Image.LANCZOS).save(OUT + w + '.webp', quality=86)
    json.dump(meta, open(OUT + 'atlas.json', 'w'), indent=1)
