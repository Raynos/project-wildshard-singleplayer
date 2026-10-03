"""pack.py <frames_dir>: the fire's flipbook atlas from fire.py's frames (f00..f31.png, 256 x 512 RGBA).

8 columns x 4 rows of 256 x 512 = 2048 x 2048, frame i at column i % 8, row i // 8 (row 0 at the TOP of the image;
world/fireFx.ts flips v). The emission-only render's alpha is 0 (the flame is light): its RGB is kept as the premultiplied flame over
black, and the shader derives its coverage from the colour. Writes
public/assets/sunscar-dunes/fx/fire-book.webp and a preview strip here.
"""
import os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../..'))
src = sys.argv[1]
FW, FH, COLS, ROWS = 256, 512, 8, 4
atlas = Image.new('RGB', (FW * COLS, FH * ROWS), (0, 0, 0))
for i in range(COLS * ROWS):
    # the render's alpha is 0 everywhere (emission adds no coverage): its RGB is the premultiplied flame over black
    r, g, b, _ = Image.open(os.path.join(src, f'f{i:02d}.png')).convert('RGBA').split()
    flat = Image.merge('RGB', (r, g, b)).resize((FW, FH), Image.LANCZOS)
    atlas.paste(flat, ((i % COLS) * FW, (i // COLS) * FH))
out = os.path.join(REPO, 'public/assets/sunscar-dunes/fx'); os.makedirs(out, exist_ok=True)
atlas.save(os.path.join(out, 'fire-book.webp'), quality=90, method=6)
atlas.resize((1024, 1024)).save(os.path.join(HERE, 'atlas-preview.jpg'), quality=85)
print('atlas', atlas.size, os.path.getsize(os.path.join(out, 'fire-book.webp')) // 1024, 'KB')
