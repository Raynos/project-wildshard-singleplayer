#!/usr/bin/env python3
"""texprep.py — turn a codex image_gen swatch into a layer of the P5 paint array (E169, round-9-lab-texture).

  python3 texprep.py <spec.json>          (every layer in the spec)
  python3 texprep.py <spec.json> <name>   (one layer)

A spec row: {name, src, mode: detail | colour | panel, crop: [x0, y0, x1, y1] (fractions), heal: bool, flatten: 0..1,
chroma: 0..1, contrast: float, alpha: none | cavity | coverage, size: 1024, quality: 88}.

- heal: offset + quilting min-cut, horizontally then vertically (the patch is the best-matching interior chunk; the
  two seams it leaves run along the minimum-error path, feathered 1.5 px), so the layer tiles.
- detail: the layer is a painted DETAIL RATIO, not a colour: linear(texel) / its local mean, with the lowest frequencies
  flattened (the local mean is a wrap-around gaussian of sigma = size/5, mixed in by `flatten`) so the tile has no
  large gradient that would show as a repeat at distance. Chroma is kept at `chroma`, contrast scaled by `contrast`,
  and stored LINEAR as ratio / 2 (so the mip chain converges on ratio 1: a far surface is exactly its wash, and the
  round-8 palette fit survives). The shader multiplies the wash by 2 * texel.
- colour: stored as it is (sRGB), for the posters.
- panel: like detail but not healed (a single carved panel mapped to its field).
- alpha (a separate greyscale JPEG, `<name>-a.jpg`): cavity = the smoothed darkness (flagstone puddles, grooves),
  coverage = paper vs wall (posters: saturation + distance from the wall grey).
"""
import json, os, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../public/assets/nine-dragon/lab/tex')


def srgb2lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def blur_wrap(a, sigma):
    """gaussian blur with wrap-around (FFT), per channel"""
    h, w = a.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi ** 2) * (sigma ** 2) * (fx ** 2 + fy ** 2))
    if a.ndim == 2:
        return np.real(np.fft.ifft2(np.fft.fft2(a) * g))
    return np.stack([np.real(np.fft.ifft2(np.fft.fft2(a[..., k]) * g)) for k in range(a.shape[2])], -1)


def mincut_cols(err):
    """a vertical path through err (H x W) with minimal summed error; returns the column per row"""
    h, w = err.shape
    cost = err.copy()
    back = np.zeros((h, w), np.int32)
    for y in range(1, h):
        prev = cost[y - 1]
        l = np.concatenate([[np.inf], prev[:-1]])
        r = np.concatenate([prev[1:], [np.inf]])
        stack = np.stack([l, prev, r])
        k = np.argmin(stack, 0)
        back[y] = k - 1
        cost[y] += stack[k, np.arange(w)]
    path = np.zeros(h, np.int32)
    path[-1] = int(np.argmin(cost[-1]))
    for y in range(h - 1, 0, -1):
        path[y - 1] = np.clip(path[y] + back[y, path[y]], 0, w - 1)
    return path


def heal_h(a, band=0.22, ov=0.07):
    """make `a` (H x W x C float) tile horizontally"""
    h, w = a.shape[:2]
    c = w // 2
    b = np.roll(a, c, axis=1)  # tiles at its borders; its seam is now at column c
    bw, ow = int(w * band / 2), max(8, int(w * ov))
    x0, x1 = c - bw, c + bw
    pw = x1 - x0
    # the patch: an interior chunk of `a` (never straddling a's own wrap), best matching b in the two overlap strips
    best, bx = np.inf, 0
    for sx in range(ow, w - pw - ow, max(4, w // 128)):
        p = a[:, sx:sx + pw]
        e = np.mean((p[:, :ow] - b[:, x0:x0 + ow]) ** 2) + np.mean((p[:, -ow:] - b[:, x1 - ow:x1]) ** 2)
        if e < best:
            best, bx = e, sx
    p = a[:, bx:bx + pw]
    err = np.sum((p - b[:, x0:x1]) ** 2, axis=2)
    left = mincut_cols(err[:, :ow])
    right = mincut_cols(err[:, -ow:]) + (pw - ow)
    xs = np.arange(pw)[None, :]
    m = ((xs >= left[:, None]) & (xs <= right[:, None])).astype(np.float64)
    full = np.zeros((h, w))
    full[:, x0:x1] = m
    full = np.clip(blur_wrap(full, 1.5), 0, 1)[..., None]
    patch = b.copy()
    patch[:, x0:x1] = p
    return b * (1 - full) + patch * full


def heal(a):
    a = heal_h(a)
    return np.transpose(heal_h(np.transpose(a, (1, 0, 2))), (1, 0, 2))


def seam_score(a):
    """mean |edge difference| across the wrap vs. across an interior column/row (1.0 = as smooth as the interior)"""
    h, w = a.shape[:2]
    wrap = np.mean(np.abs(a[:, 0] - a[:, -1])) + np.mean(np.abs(a[0] - a[-1]))
    inner = np.mean(np.abs(np.diff(a, axis=1))) + np.mean(np.abs(np.diff(a, axis=0)))
    return wrap / max(inner, 1e-6)


def periodic(img, x0, y0, px, py, nx, ny, m):
    """crop nx x ny whole periods of a periodic swatch (tiles) and cross-fade its first m px (both axes) into the
    structurally identical content one crop-width / crop-height later, so the crop tiles with its joints aligned"""
    a = np.asarray(img).astype(np.float64) / 255.0
    W, H = int(round(px * nx)), int(round(py * ny))
    c = a[y0:y0 + H, x0:x0 + W].copy()
    for i in range(m):
        t = (i / m) ** 1.0
        c[:, i] = c[:, i] * t + a[y0:y0 + H, x0 + W + i] * (1 - t)
    for i in range(m):
        t = i / m
        c[i, :] = c[i, :] * t + a[y0 + H + i, x0:x0 + W] * (1 - t)
    return Image.fromarray((np.clip(c, 0, 1) * 255 + 0.5).astype(np.uint8))


def prep(row):
    name = row['name']
    # RAW = the folder of codex swatches (scratchpad; the prompts are mkjobs.py next to this file)
    im = Image.open(row['src'].replace('RAW', os.environ.get('RAW', '.'))).convert('RGB')
    W, H = im.size
    if 'period' in row:
        pr = row['period']
        im = periodic(im, pr['x0'], pr['y0'], pr['px'], pr['py'], pr['nx'], pr['ny'], pr['m'])
    else:
        cx = row.get('crop', [0, 0, 1, 1])
        im = im.crop((int(cx[0] * W), int(cx[1] * H), int(cx[2] * W), int(cx[3] * H)))
    size = row.get('size', 1024)
    im = im.resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float64) / 255.0
    mode = row.get('mode', 'detail')
    if row.get('heal', mode == 'detail'):
        a = heal(a)
    lin = srgb2lin(a)
    info = {'name': name, 'mode': mode, 'seam': round(float(seam_score(lin)), 2)}
    if mode in ('detail', 'panel'):
        mean = lin.reshape(-1, 3).mean(0)
        local = blur_wrap(lin, size * row.get('sigma', 0.2))
        k = row.get('flatten', 0.7)
        ref = local ** k * mean[None, None, :] ** (1 - k)
        ratio = lin / np.maximum(ref, 1e-4)
        L = (ratio * np.array([0.2126, 0.7152, 0.0722])).sum(-1, keepdims=True)
        ratio = L + (ratio - L) * row.get('chroma', 0.6)
        ratio = 1 + (ratio - 1) * row.get('contrast', 1.0)
        # brush-dab boost: an unsharp mask on the 2-12 px band (the codex edits paint stone as dappled dabs, not
        # smooth photo grain): ratio *= (ratio / blur(ratio, r))^boost
        b = row.get('boost', 0.0)
        if b > 0:
            soft = blur_wrap(ratio, row.get('boostPx', 6.0))
            ratio = ratio * (np.maximum(ratio, 1e-3) / np.maximum(soft, 1e-3)) ** b
        # renormalise so the mean is exactly 1 per channel (the far mip = the wash)
        ratio = ratio / ratio.reshape(-1, 3).mean(0)[None, None, :]
        S = row.get('scale', 2.0)  # stored as ratio / S (the shader's LAYERS table carries S)
        enc = np.clip(ratio / S, 0, 1)
        info['clip'] = round(float(np.mean(ratio > S)), 4)
        info['p5_p95'] = [round(float(np.percentile(ratio, 5)), 2), round(float(np.percentile(ratio, 95)), 2)]
        out = (enc * 255 + 0.5).astype(np.uint8)
    else:
        out = (a * 255 + 0.5).astype(np.uint8)
    os.makedirs(OUT, exist_ok=True)
    q = row.get('quality', 88)
    Image.fromarray(out).save(os.path.join(OUT, f'{name}.jpg'), quality=q, optimize=True)
    al = row.get('alpha', 'none')
    if al != 'none':
        lum = (lin * np.array([0.2126, 0.7152, 0.0722])).sum(-1)
        if al == 'cavity':
            lo = blur_wrap(lum, size / 96)
            base = blur_wrap(lum, size / 10)
            cav = np.clip(0.5 + (base - lo) / np.maximum(base, 1e-4) * row.get('cavityGain', 2.0), 0, 1)
        else:  # coverage: paper = saturated or far from the wall's grey
            hsv = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).convert('HSV')).astype(np.float64) / 255
            wall = np.median(lin.reshape(-1, 3), 0)
            dist = np.sqrt(((lin - wall) ** 2).sum(-1))
            cav = np.clip(np.maximum(hsv[..., 1] * 2.2 - 0.35, dist * 5 - 0.2), 0, 1)
            cav = np.clip(blur_wrap(cav, 2.0) * 1.3, 0, 1)
        Image.fromarray((cav * 255 + 0.5).astype(np.uint8)).resize((size // 2, size // 2), Image.LANCZOS).save(os.path.join(OUT, f'{name}-a.jpg'), quality=85, optimize=True)
    info['kb'] = round(os.path.getsize(os.path.join(OUT, f'{name}.jpg')) / 1024)
    return info


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1]))
    only = sys.argv[2] if len(sys.argv) > 2 else None
    for row in spec:
        if only is not None and row['name'] != only:
            continue
        print(json.dumps(prep(row)))
