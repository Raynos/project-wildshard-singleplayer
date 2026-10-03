"""Raise the painted sun (E392 / E399, mockup A: the sun glows just left of the windmill's cap; at 4.75 deg it sat behind
the high step's isle from the spawn, so the spawn view had no sun at all).

  python3 sun-raise.py <source> <out> <lift px> [slide px]   # 15.36 px per degree; shipped: panorama-graded.jpg panorama-sun.jpg 81 260 (E399: ~9 deg up just right of the windmill from the spawn, where the sky is open; left of it the high step and the winch house hid it, behind it the tower)
  (loop 20: at +100 px the sun still hid behind the winch house on the high step from the spawn)

The disc is lifted out (filled from the blurred glow around it, so its old place keeps the horizon's gold) and repainted
<lift> px higher with a soft bloom around it. Then: python3 ../round-14-loop-4/pano/prep.py 564 <out>.
"""
import sys
import numpy as np
from PIL import Image

src, out, lift = sys.argv[1], sys.argv[2], int(sys.argv[3])
slide = int(sys.argv[4]) if len(sys.argv) > 4 else 0   # px along the heading (+ = east); 15.36 px per degree
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float64)
H, W, _ = a.shape
HOR = 564
lum = a.mean(axis=2).copy()
lum[HOR - 8:] = 0
ys, xs = np.nonzero(lum > np.percentile(lum, 99.97))
# the disc's own pixels: the brightest cluster (bright cloud rims elsewhere in the strip would drag a plain mean)
my, mx = np.unravel_index(np.argmax(np.where(lum > 0, lum, 0)), lum.shape)
near = np.hypot(xs - mx, ys - my) < 60
ys, xs = ys[near], xs[near]
cy, cx = ys.mean(), xs.mean()
r = max(8.0, np.sqrt(len(xs) / np.pi))
print('sun at', round(cx), round(cy), 'radius', round(r, 1))

# the sun sits near the strip's seam: roll it to the middle, edit, roll back
shift = int(W // 2 - cx)
a = np.roll(a, shift, axis=1); cx += shift
x0, x1 = int(cx - 420), int(cx + 420)
y0, y1 = max(0, int(cy - lift - 380)), min(HOR + 40, H)
win = a[y0:y1, x0:x1].copy()
yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float64)
d_old = np.hypot(xx - cx, yy - cy)

# 1. lift the disc out: a normalised blur of the window with the disc (and its hot core) masked
hole = d_old < r * 2.4
keep = (~hole).astype(np.float64)
def blur(x, s):
    # separable gaussian in numpy (no scipy here)
    k = np.exp(-0.5 * (np.arange(-3 * s, 3 * s + 1) / s) ** 2); k /= k.sum()
    x = np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), 0, x)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), 1, x)
fill = np.dstack([blur(win[..., c] * keep, 18) for c in range(3)]) / np.maximum(blur(keep, 18), 1e-4)[..., None]
soft = np.clip((r * 3.0 - d_old) / (r * 0.8), 0, 1)[..., None]
win = win * (1 - soft) + fill * soft

# 2. the disc and its bloom, lift px higher
ny, nx = cy - lift, cx + slide
d = np.hypot(xx - nx, yy - ny)
disc = np.clip((r + 1.5 - d) / 3.0, 0, 1)[..., None]
bloom = (np.exp(-(d / (r * 2.2)) ** 2) * 0.55 + np.exp(-(d / (r * 7.0)) ** 2) * 0.22 + np.exp(-(d / (r * 18.0)) ** 2) * 0.10)[..., None]
warm = np.array([255.0, 214.0, 150.0])
win = win + (255.0 - win) * np.clip(bloom * (warm / 255.0), 0, 1)
win = win * (1 - disc) + np.array([255.0, 250.0, 232.0]) * disc

b = a.copy()
b[y0:y1, x0:x1] = win
b = np.roll(b, -shift, axis=1)
Image.fromarray(b.clip(0, 255).astype(np.uint8)).save(out, quality=94)
print('wrote', out, 'sun now at elevation', round((HOR - ny) / 15.36, 2))
