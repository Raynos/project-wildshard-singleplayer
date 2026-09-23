#!/usr/bin/env python3
"""key.py <strip.png> <out_rgba.png> [--night] [--alpha-from other_rgba.png]

Pulls the painted far distance off the painted sky: a per-row, slowly varying sky model S(x, y) estimated from the
strip's own sky pixels, alpha = how far a pixel is from it, colour un-mixed (F = S + (P - S) / a). Below the horizon
row the painted sea is kept for 0.6 deg then faded out by -1.6 deg (the game's sea covers it).
"""
import sys, numpy as np
from PIL import Image
from scipy.ndimage import uniform_filter1d, gaussian_filter

EL_MIN, EL_MAX = -4.0, 24.0
src, out = sys.argv[1], sys.argv[2]
night = '--night' in sys.argv
P = np.asarray(Image.open(src).convert('RGB'), dtype=np.float32) / 255
H, W, _ = P.shape
el = EL_MAX - (EL_MAX - EL_MIN) * (np.arange(H) + 0.5) / H

mx = P.max(-1); mn = P.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-4)
r, g, b = P[..., 0], P[..., 1], P[..., 2]
if night:
    skyish = (b > r + 0.03) & (b >= g) & (mx < 0.55)
else:
    skyish = (b > r + 0.12) & (b >= g) & (sat > 0.22)

# sky model: windowed mean of sky-classified pixels along each row (wrapping), then filled / smoothed vertically
WIN = 301
S = np.zeros_like(P); cnt = np.zeros((H, W), np.float32)
m = skyish.astype(np.float32)
pad = WIN // 2
def wrapfilt(a):
    ap = np.concatenate([a[:, -pad:], a, a[:, :pad]], 1)
    return uniform_filter1d(ap, WIN, axis=1)[:, pad:pad + W]
cnt = wrapfilt(m)
for c in range(3):
    S[..., c] = wrapfilt(P[..., c] * m) / np.maximum(cnt, 1e-4)
# rows / places with too few sky samples: carry the value down from above
ok = cnt > 0.08
for y in range(1, H):
    bad = ~ok[y]
    S[y, bad] = S[y - 1, bad]
    ok[y, bad] = ok[y - 1, bad]
S = gaussian_filter(S, sigma=(3, 12, 0), mode=['nearest', 'wrap', 'nearest'])

d = np.sqrt(((P - S) ** 2).sum(-1))
lo, hi = (0.035, 0.14) if not night else (0.03, 0.12)
t = np.clip((d - lo) / (hi - lo), 0, 1)
A = t * t * (3 - 2 * t)
A = gaussian_filter(A, 0.6)
# fill enclosed holes (hazy blue-grey rock faces read as sky): low-alpha pockets not connected to the open sky above
from scipy.ndimage import binary_fill_holes, binary_closing
solid = binary_closing(A > 0.45, structure=np.ones((5, 5)), iterations=1)
solid[int(H * (EL_MAX - 0) / (EL_MAX - EL_MIN)):, :] = True           # the sea closes every pocket from below
wrapw = 64
tiled = np.concatenate([solid[:, -wrapw:], solid, solid[:, :wrapw]], 1)
filled = binary_fill_holes(tiled)[:, wrapw:wrapw + W]
A = np.maximum(A, gaussian_filter(filled.astype(np.float32), 0.8) * filled)
# below the horizon: keep the painted feet 0.6 deg, then fade the painted sea out
elg = el[:, None] * np.ones((1, W))
below = np.clip((elg + 1.6) / (1.6 - 0.6), 0, 1)   # 1 at -0.6 deg, 0 at -1.6
A = np.where(elg < 0, np.where(elg > -0.6, 1.0, below), A)
# very top: nothing
A *= np.clip((EL_MAX - 0.3 - elg) / 2.0, 0, 1)

if '--alpha-from' in sys.argv:
    other = np.asarray(Image.open(sys.argv[sys.argv.index('--alpha-from') + 1]), dtype=np.float32) / 255
    A = other[..., 3]

a = np.maximum(A, 1e-3)[..., None]
F = np.clip(S + (P - S) / a, 0, 1)
F = np.where(A[..., None] > 0.02, F, S)   # fully transparent texels keep the sky colour (no dark halos in the mips)
F = np.where(elg[..., None] < 0, P, F)
rgba = np.dstack([F, A])
Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(out)
Image.fromarray((A * 255).astype(np.uint8)).save(out.replace('.png', '-alpha.png'))
# preview: over a checker of two sky colours
bg1 = np.array([0.36, 0.62, 0.95]); bg2 = np.array([0.95, 0.55, 0.35])
chk = ((np.arange(W)[None, :] // 512) % 2).astype(np.float32)[..., None]
bg = bg1 * (1 - chk) + bg2 * chk
comp = F * A[..., None] + bg * (1 - A[..., None])
Image.fromarray((comp * 255).astype(np.uint8)).save(out.replace('.png', '-comp.jpg'), quality=88)
print('wrote', out, 'mean alpha above horizon', float(A[elg > 0].mean()))
