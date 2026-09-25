#!/usr/bin/env python3
"""nalati-panorama.py — the round-6 360° sky panorama → the shipped WebP strips for the look-v2 sky dome.

  python3 scripts/nalati-panorama.py            # writes public/assets/nalati/panorama.webp (+ .phone.webp)

Source: art/nalati-grasslands/round-6-panorama/panorama-5530x1024.jpg (x = compass azimuth, 0 = north; README there).
Two things happen before the encode:

1. **Seam repair.** The stitched strip still carries faint vertical steps where two codex slices meet (a brightness /
   colour step down the whole height, x ≈ 1842 and 4914). Each is found as a column whose mean step is far above the
   median, then removed with a gain ramp (and the 1-px line a feathered join leaves is re-drawn from its neighbours): per channel, per row band (blurred vertically), the ratio across the seam is
   split half / half and eased out over ±SEAM_W px on each side — no step, no visible band.
2. **The wrap.** Column 0 and column W−1 are made continuous the same way, then re-drawn between their neighbours; each
   written strip carries PANO_PAD columns of the other end on either side (the lossy codec encodes an image's edges on
   their own: an unpadded wrap came back with a 1-px step due north), and the phone strip is resized as a loop.

Desktop keeps the native 5530 px (no upscale), the phone gets 4096 px. Both sRGB WebP.

It also writes src/nalati/look/panoramaData.ts (generated — don't edit): the painted horizon row, the ridge line (the
sky / land boundary per azimuth, so night can fade the painted *sky* into the stars and keep the ranges) and the
fog LUT (the painted haze just above the horizon, per azimuth, blurred — the 3D fog fades into exactly this colour).
The ridge is a hand-read envelope every 10° (RIDGE_ENV, rows of the peaks) refined per column: from the envelope down,
the first rows that stop looking like the sky just above it.
"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'art/nalati-grasslands/round-6-panorama/panorama-5530x1024.jpg')
OUT = os.path.join(ROOT, 'public/assets/nalati')
PANO_PAD = 16         # px of wrap copied onto each side of the written strips (sky.ts PANO_PAD_PX)
SEAM_W = 90          # px each side the gain ramp spans
ROW_BLUR = 24        # rows: the per-row ratio is smoothed this much (a seam's step varies slowly with height)


def blur_rows(v: np.ndarray, r: int) -> np.ndarray:
    k = np.ones(2 * r + 1) / (2 * r + 1)
    pad = np.pad(v, ((r, r), (0, 0)), mode='edge')
    return np.stack([np.convolve(pad[:, c], k, mode='valid') for c in range(v.shape[1])], axis=1)


def find_seams(a: np.ndarray) -> list[int]:
    col = a.mean(axis=(0, 2))
    d = np.abs(np.diff(col))
    med = float(np.median(d))
    # a seam: a step far above the texture's own column-to-column variation, and alone (not inside a busy stretch)
    out = []
    for i in np.argsort(d)[::-1][:40]:
        local = np.median(d[max(0, i - 30):i + 30])
        if d[i] > 5 * max(med, local) and d[i] > 1.8 and all(abs(i - j) > 60 for j in out):
            out.append(int(i))
    return sorted(out)


def repair(a: np.ndarray, x: int) -> None:
    """remove the step between column x and x + 1 (in place), easing over ±SEAM_W"""
    W = a.shape[1]
    L = a[:, (x - 3) % W:x + 1] if x >= 3 else np.concatenate([a[:, W - (3 - x):], a[:, :x + 1]], axis=1)
    R = a[:, (x + 1) % W:(x + 5) % W] if x + 5 <= W else np.concatenate([a[:, x + 1:], a[:, :(x + 5) - W]], axis=1)
    lm = blur_rows(L.mean(axis=1), ROW_BLUR)
    rm = blur_rows(R.mean(axis=1), ROW_BLUR)
    ratio = np.clip((rm + 1.0) / (lm + 1.0), 0.6, 1.6)           # rows × 3
    half = np.sqrt(ratio)
    for k in range(SEAM_W):
        w = 0.5 + 0.5 * np.cos(np.pi * k / SEAM_W)                  # 1 at the seam → 0 at SEAM_W
        gl = 1.0 + (half - 1.0) * w                                 # the left side rises toward the middle
        gr = 1.0 + (1.0 / half - 1.0) * w                           # the right side falls toward it
        a[:, (x - k) % W] *= gl
        a[:, (x + 1 + k) % W] *= gr


HORIZON_ROW = 800   # the painted eye-level horizon: the far plain / the ranges' feet (measured on the grid overlay)
FOG_ROWS = (768, 806)  # the fog LUT band: the hazy far ranges just above the horizon
# the peaks' envelope, row per 10° of azimuth (0 … 350), read off a gridded overlay of the strip
RIDGE_ENV = [683, 549, 515, 495, 491, 495, 465, 445, 495, 562, 565, 541, 531, 522, 541, 534, 546, 522,
             541, 549, 572, 611, 642, 680, 688, 695, 680, 695, 703, 718, 718, 721, 718, 721, 711, 703]


def ridge_line(a: np.ndarray, n: int = 512) -> np.ndarray:
    """per azimuth sample (n), the row where the sky ends (full-res rows)"""
    H, W = a.shape[:2]
    lum = a.mean(axis=2)
    out = np.zeros(n)
    for i in range(n):
        az = i / n * 360.0
        k = az / 10.0
        k0 = int(k) % 36; k1 = (k0 + 1) % 36; f = k - int(k)
        env = RIDGE_ENV[k0] * (1 - f) + RIDGE_ENV[k1] * f
        x0 = int(i / n * W); x1 = max(x0 + 1, int((i + 1) / n * W))
        col = a[:, x0:x1].mean(axis=1)                     # rows × 3
        ref = col[max(0, int(env) - 40):max(1, int(env) - 18)].mean(axis=0)   # the sky just above the peaks
        row = env
        for r in range(int(env) - 10, min(HORIZON_ROW, int(env) + 160)):
            d = np.abs(col[r:r + 8] - ref).sum(axis=1)
            if (d > 55).all():
                row = r
                break
        out[i] = max(env - 6, row)
    # soften: a 3-sample min filter (keep the peaks), then a light blur
    m = np.minimum(np.minimum(out, np.roll(out, 1)), np.roll(out, -1))
    return (np.roll(m, 1) + 2 * m + np.roll(m, -1)) / 4


def fog_lut(a: np.ndarray, n: int = 256) -> np.ndarray:
    H, W = a.shape[:2]
    band = a[FOG_ROWS[0]:FOG_ROWS[1]].mean(axis=0)          # W × 3
    cols = np.stack([band[int(i / n * W):int((i + 1) / n * W)].mean(axis=0) for i in range(n)])
    k = 6
    return np.stack([np.mean([cols[(i + j) % n] for j in range(-k, k + 1)], axis=0) for i in range(n)])


def write_data(a: np.ndarray) -> None:
    H = a.shape[0]
    ridge = ridge_line(a)
    lut = fog_lut(a)
    fmt = lambda xs: ', '.join(f'{x:.4f}' for x in xs)
    ts = f"""// GENERATED by scripts/nalati-panorama.py from the round-6 panorama — don't edit by hand.
/** the painted eye-level horizon, as v from the bottom of the strip (0..1) */
export const PANO_HORIZON_V = {1 - HORIZON_ROW / H:.4f};
/** the strip's vertical scale: degrees of elevation per unit of v (15.36 px per degree over {H} rows) */
export const PANO_DEG_PER_V = {H / 15.36:.3f};
/** the ridge line: per azimuth (512 samples, compass turns 0 = north), v from the bottom where the painted sky ends */
export const PANO_RIDGE_V = [{fmt(1 - ridge / H)}];
/** the fog LUT: per azimuth (256 samples), the painted haze just above the horizon, sRGB 0..1 (r, g, b interleaved) */
export const PANO_FOG_SRGB = [{fmt((lut / 255).reshape(-1))}];
"""
    p = os.path.join(ROOT, 'src/nalati/look/panoramaData.ts')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write(ts)
    print(p, len(ts) // 1024, 'KB')
    if '--check' in sys.argv:
        from PIL import ImageDraw
        W = a.shape[1]
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        d = ImageDraw.Draw(im)
        pts = [(i / 512 * W, r) for i, r in enumerate(ridge)]
        d.line(pts, fill=(255, 0, 255), width=3)
        d.line([(0, HORIZON_ROW), (W, HORIZON_ROW)], fill=(0, 255, 0), width=2)
        for i in range(256):
            x = i / 256 * W
            d.rectangle([x, 980, x + W / 256, 1024], fill=tuple(int(v) for v in lut[i]))
        im.crop((0, 380, W, 1024)).resize((2400, 279)).save('/private/tmp/claude-501/a2/ridge.jpg')


def deline(a: np.ndarray, x: int) -> None:
    """a feathered join can leave a 1-px darker / lighter column: re-draw columns x, x + 1 between x − 1 and x + 2"""
    W = a.shape[1]
    l, r = a[:, (x - 1) % W].copy(), a[:, (x + 2) % W].copy()
    a[:, x % W] = (2 * l + r) / 3
    a[:, (x + 1) % W] = (l + 2 * r) / 3


def main() -> None:
    im = Image.open(SRC).convert('RGB')
    a = np.asarray(im).astype(np.float64)
    for it in range(3):   # a seam can be a 1-px sliver (two steps side by side): repeat until none is left
        seams = find_seams(a)
        print('seams:', seams)
        for x in seams:
            repair(a, x)
            deline(a, x)
    repair(a, a.shape[1] - 1)   # the 0 / 360° wrap
    after = find_seams(a)
    print('left after repair:', after)
    write_data(a)
    # the wrap's own 1-px line (NALATI-MERGE L4: a thin vertical seam due north when zoomed): the gain ramp above only
    # matches the brightness either side, row-blurred, so the two edge columns kept their own per-row step. Re-draw them
    # between their neighbours, like every stitched seam (after write_data: the ridge / fog data stay as they were)
    deline(a, a.shape[1] - 1)
    out = Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))
    os.makedirs(OUT, exist_ok=True)
    desk = os.path.join(OUT, 'panorama.webp')
    phone = os.path.join(OUT, 'panorama.phone.webp')
    # the phone strip: resized as a LOOP (half the strip wrapped onto either side, resized, cropped back) — a plain
    # LANCZOS resize filters the two edges against nothing, which put a fresh step at the wrap
    W, H = out.size
    PW, PH = 4096, round(4096 * H / W)
    half = W // 2
    wide = Image.new('RGB', (W + 2 * half, H))
    wide.paste(out.crop((W - half, 0, W, H)), (0, 0)); wide.paste(out, (half, 0)); wide.paste(out.crop((0, 0, half, H)), (W + half, 0))
    k = PW / W
    big = wide.resize((round(wide.width * k), PH), Image.LANCZOS)
    x0 = round(half * k)
    small = big.crop((x0, 0, x0 + PW, PH))
    # both files carry PANO_PAD columns of the other end on either side: the lossy codec treats an image's edge blocks
    # on their own, so a strip whose 0° / 360° columns ARE its edges comes back with a step between them however clean
    # it went in. With the pad the wrap sits inside the image on both sides (sky.ts samples the inner strip only)
    for img, path, q in ((out, desk, 86), (small, phone, 84)):
        w, h = img.size
        padded = Image.new('RGB', (w + 2 * PANO_PAD, h))
        padded.paste(img.crop((w - PANO_PAD, 0, w, h)), (0, 0)); padded.paste(img, (PANO_PAD, 0)); padded.paste(img.crop((0, 0, PANO_PAD, h)), (w + PANO_PAD, 0))
        padded.save(path, 'WEBP', quality=q, method=6)
    for p in (desk, phone):
        print(p, os.path.getsize(p) // 1024, 'KB', Image.open(p).size)


if __name__ == '__main__':
    main()
