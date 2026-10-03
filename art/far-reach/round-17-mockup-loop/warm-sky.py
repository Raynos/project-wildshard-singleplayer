"""warm the upper sky of the sun-raised panorama (E399 seats: 'the upper sky reads blue; the mockups are gold and peach, blue only at the very top')."""
import numpy as np
from PIL import Image
D = '/Users/raynos/projects/games/wildshard-singleplayer/art/far-reach/round-17-mockup-loop/'
a = np.asarray(Image.open(D + 'panorama-sun.jpg').convert('RGB')).astype(np.float64) / 255
H = a.shape[0]
row = np.linspace(0, 1, H)[:, None]
high = np.clip((0.56 - row) / 0.56, 0, 1) ** 0.8          # 1 at the top, 0 at the horizon
blue = np.clip((a[..., 2] - a[..., 0]) * 3.0, 0, 1)        # how blue a pixel is
k = (0.75 * (1 - high * 0.4) * blue)[..., None]           # strongest in the middle band, keep some blue at the top
lum = a.mean(-1, keepdims=True)
warm = np.concatenate([lum * 1.12, lum * 0.98, lum * 0.92], -1)   # a peach-lavender grey of the same brightness
out = a * (1 - k) + warm * k
Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8)).save(D + 'panorama-warm.jpg', quality=94)
print('ok')
