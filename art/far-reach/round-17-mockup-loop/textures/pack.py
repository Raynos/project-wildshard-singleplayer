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


for name in ('rock', 'meadow', 'cloudsea'):
    im = seamless(os.path.join(HERE, f'{name}.png'))
    im.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=86, method=6)
    im.save(os.path.join(HERE, f'{name}.jpg'), quality=86)
    print(name, os.path.getsize(os.path.join(OUT, f'{name}.webp')) // 1024, 'KB')
# the storm vortex seen from below (E399, mockup D): the crown storm's underside
if os.path.exists(os.path.join(HERE, 'stormeye.png')):
    eye = Image.open(os.path.join(HERE, 'stormeye.png')).convert('RGB').resize((1024, 1024), Image.LANCZOS)
    eye.save(os.path.join(OUT, 'stormeye.webp'), 'WEBP', quality=86, method=6); eye.save(os.path.join(HERE, 'stormeye.jpg'), quality=86)
if os.path.exists(os.path.join(HERE, 'maelstrom.png')):
    vortex = Image.open(os.path.join(HERE, 'maelstrom.png')).convert('RGB').resize((1024, 1024), Image.LANCZOS)
    vortex.save(os.path.join(OUT, 'maelstrom.webp'), 'WEBP', quality=86, method=6); vortex.save(os.path.join(HERE, 'maelstrom.jpg'), quality=86)
c = Image.open(os.path.join(HERE, 'clouds.png')).convert('RGB').resize((1024, 683), Image.LANCZOS)
c.save(os.path.join(OUT, 'clouds.webp'), 'WEBP', quality=88, method=6)
c.save(os.path.join(HERE, 'clouds.jpg'), quality=88)
print('clouds', os.path.getsize(os.path.join(OUT, 'clouds.webp')) // 1024, 'KB')
# the branch sheet: the magenta key cut to alpha (soft at the needles' edge, the fringe's magenta spill removed)
if os.path.exists(os.path.join(HERE, 'branches.png')):
    b = np.asarray(Image.open(os.path.join(HERE, 'branches.png')).convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(np.float64)
    r, g, bl = b[..., 0], b[..., 1], b[..., 2]
    key = np.clip(((r + bl) / 2 - g - 60) / 80, 0, 1)            # 1 on the magenta
    alpha = (1 - key) * 255
    spill = np.minimum(r, bl) - g
    b[..., 0] -= np.clip(spill, 0, None) * 0.7
    b[..., 2] -= np.clip(spill, 0, None) * 0.7
    out = np.dstack([b.clip(0, 255), alpha]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, 'branches.webp'), 'WEBP', quality=88, method=6)
    Image.fromarray(out, 'RGBA').save(os.path.join(HERE, 'branches-cut.png'))
    print('branches', os.path.getsize(os.path.join(OUT, 'branches.webp')) // 1024, 'KB')
