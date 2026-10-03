"""Pack the windmill textures into public/assets/far-reach/tex/mill-*.webp (E392 loop 20).

stone: 1024 px, kept as painted (codex painted it tileable; tile2x2.jpg here is the check). canvas: 512 px. ivy: the
magenta key cut to alpha with the spill removed (as the branch sheet, round-17 pack.py), 1024 px RGBA.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '../../../public/assets/far-reach/tex'))

s = Image.open(os.path.join(HERE, 'stone.jpg')).convert('RGB').resize((1024, 1024), Image.LANCZOS)
s.save(os.path.join(OUT, 'mill-stone.webp'), 'WEBP', quality=84, method=6)
t = Image.new('RGB', (2048, 2048))
for x in (0, 1024):
    for y in (0, 1024): t.paste(s, (x, y))
t.resize((1024, 1024)).save(os.path.join(HERE, 'tile2x2.jpg'), quality=82)

c = Image.open(os.path.join(HERE, 'canvas.jpg')).convert('RGB').resize((512, 512), Image.LANCZOS)
c.save(os.path.join(OUT, 'mill-canvas.webp'), 'WEBP', quality=84, method=6)

b = np.asarray(Image.open(os.path.join(HERE, 'ivy.jpg')).convert('RGB').resize((1024, 1024), Image.LANCZOS)).astype(np.float64)
r, g, bl = b[..., 0], b[..., 1], b[..., 2]
key = np.clip(((r + bl) / 2 - g - 60) / 80, 0, 1)
spill = np.minimum(r, bl) - g
b[..., 0] -= np.clip(spill, 0, None) * 0.7
b[..., 2] -= np.clip(spill, 0, None) * 0.7
ivy = np.dstack([b.clip(0, 255), (1 - key) * 255]).astype(np.uint8)
Image.fromarray(ivy, 'RGBA').save(os.path.join(OUT, 'mill-ivy.webp'), 'WEBP', quality=86, method=6)
for n in ('mill-stone', 'mill-canvas', 'mill-ivy'):
    print(n, os.path.getsize(os.path.join(OUT, f'{n}.webp')) // 1024, 'KB')
