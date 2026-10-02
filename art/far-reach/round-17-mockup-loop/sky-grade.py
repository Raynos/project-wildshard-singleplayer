"""The panorama toward the mockups' golden hour (E392, the judge: "the sky is pink-magenta, the mockup's gold low and
lavender-blue high"). Hue-shifts the loop-4 panorama: rose and magenta toward peach and gold, lavender-violet toward a
soft blue, more so up high; writes panorama-graded.jpg, then:

  python3 ../round-14-loop-4/pano/prep.py 564 panorama-graded.jpg      # -> the shipped strips + look/panoramaData.ts
"""
import colorsys, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
src = np.asarray(Image.open(os.path.join(HERE, '../round-14-loop-4/pano/panorama-5530x1024.jpg')).convert('RGB')).astype(np.float64) / 255
H, W, _ = src.shape
hsv = np.zeros_like(src)
r, g, b = src[..., 0], src[..., 1], src[..., 2]
mx, mn = src.max(-1), src.min(-1); d = mx - mn + 1e-9
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6   # 0..1
s = np.where(mx > 0, d / (mx + 1e-9), 0); v = mx
deg = h * 360
row = np.linspace(0, 1, H)[:, None]                 # 0 top .. 1 bottom
high = np.clip((0.55 - row) / 0.55, 0, 1)           # 1 at the top, 0 at the horizon (row 0.55)
# rose / magenta (290..360 and 0..10) -> toward peach-gold (+28..40 deg), less near the horizon's gold
pink = ((deg > 290) | (deg < 10)).astype(float)
shift = np.where(deg > 290, (360 - deg) + 30, 30 - deg) * 0.45   # pulls 330 -> ~359, 300 -> ~331: toward peach
deg2 = np.where(pink > 0, (deg + shift) % 360, deg)
# lavender-violet (240..290) high up -> toward soft blue (225)
lav = ((deg2 > 240) & (deg2 <= 290)).astype(float) * high
deg2 = deg2 - lav * (deg2 - 225) * 0.7
s2 = s * (1 - 0.12 * high)                          # a touch less saturated high up
v = np.clip(v * (1 + 0.07 * pink), 0, 1)             # the shifted clouds a little brighter (cream-gold, not tan)
h2 = deg2 / 360
i = np.floor(h2 * 6); f = h2 * 6 - i; p = v * (1 - s2); q = v * (1 - f * s2); t = v * (1 - (1 - f) * s2); i = i.astype(int) % 6
out = np.choose(i[..., None].repeat(3, -1) * 0 + np.arange(3)[None, None, :] * 0 + i[..., None],
                [np.stack([v, t, p], -1), np.stack([q, v, p], -1), np.stack([p, v, t], -1), np.stack([p, q, v], -1), np.stack([t, p, v], -1), np.stack([v, p, q], -1)])
Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8)).save(os.path.join(HERE, 'panorama-graded.jpg'), quality=92)
Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8)).resize((2400, 444)).save(os.path.join(HERE, 'panorama-graded-preview.jpg'), quality=85)
print('ok', out.shape)
