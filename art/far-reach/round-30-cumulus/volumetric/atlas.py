"""Pack clouds.py's renders into Sky Reach's cumulus atlas (E407 row 5).

    python3 scripts/blender/far-reach-clouds/atlas.py <render dir> <atlas.webp> [preview.jpg]

The atlas is 4 x 4 cells of 512 x 256: row r, column c holds cloud (r // 2) * 4 + c, rows 0 and 2 lit `front`, rows 1
and 3 lit `back` (so a cloud's two lightings sit one cell apart vertically). Straight (not premultiplied) alpha.
The preview lays every cell over a sunset gradient, to judge them as the game shows them.
"""
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
preview = sys.argv[3] if len(sys.argv) > 3 else None
CW, CH = 512, 256
atlas = Image.new('RGBA', (CW * 4, CH * 4), (0, 0, 0, 0))
for i in range(8):
    for k, light in enumerate(('front', 'back')):
        cell = Image.open(f'{src}/cloud-{i}-{light}.png').convert('RGBA')
        col, row = i % 4, (i // 4) * 2 + k
        atlas.paste(cell, (col * CW, row * CH))
atlas.save(out, 'WEBP', quality=88, method=6, exact=True)
print('atlas', out, atlas.size)

if preview:
    sky = Image.new('RGB', atlas.size)
    px = sky.load()
    for y in range(atlas.size[1]):
        f = y / (atlas.size[1] - 1)
        c = tuple(int(a + (b - a) * f) for a, b in zip((112, 104, 150), (246, 186, 120)))
        for x in range(atlas.size[0]):
            px[x, y] = c
    sky.paste(atlas, (0, 0), atlas)
    sky.resize((atlas.size[0] // 2, atlas.size[1] // 2)).save(preview, 'JPEG', quality=85)
    print('preview', preview)
