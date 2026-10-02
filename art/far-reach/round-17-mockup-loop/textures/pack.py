"""Pack the painted textures into public/assets/far-reach/tex/ (E392).

rock / meadow: 1024 px, made seamless (the image is blended with its own half-offset copy across a feathered cross, so
the four edges meet) and saved as WebP. clouds: the 4 x 2 atlas at 1024 x 683, as painted (black = clear; the shader
takes alpha from the brightness).
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '../../../../public/assets/far-reach/tex'))
os.makedirs(OUT, exist_ok=True)


def seamless(src, size=1024):
    a = np.asarray(Image.open(src).convert('RGB').resize((size, size), Image.LANCZOS)).astype(np.float64)
    b = np.roll(np.roll(a, size // 2, axis=0), size // 2, axis=1)
    t = np.abs(np.linspace(-1, 1, size))
    w1 = np.clip((t - 0.6) / 0.4, 0, 1)                      # 0 in the middle, 1 at the edges
    mask = np.maximum(w1[:, None], w1[None, :]) ** 1.5         # where the original's edge seam would show, use the offset copy
    out = a * (1 - mask[..., None]) + b * mask[..., None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


for name in ('rock', 'meadow'):
    im = seamless(os.path.join(HERE, f'{name}.png'))
    im.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=86, method=6)
    im.save(os.path.join(HERE, f'{name}.jpg'), quality=86)
    print(name, os.path.getsize(os.path.join(OUT, f'{name}.webp')) // 1024, 'KB')
c = Image.open(os.path.join(HERE, 'clouds.png')).convert('RGB').resize((1024, 683), Image.LANCZOS)
c.save(os.path.join(OUT, 'clouds.webp'), 'WEBP', quality=88, method=6)
c.save(os.path.join(HERE, 'clouds.jpg'), quality=88)
print('clouds', os.path.getsize(os.path.join(OUT, 'clouds.webp')) // 1024, 'KB')
