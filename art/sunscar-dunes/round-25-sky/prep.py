"""prep.py: the shipped painted skies from the stitched panoramas (pano.py stitch), one per dusk stage.

Each <stage>/panorama.png is 5530 x 1024: x = heading (0 = the spawn's forward view, -z), 15.36 px a degree both ways,
the horizon at row 901 (88 %), so the strip spans +58.6 deg to -8 deg. The shipped strip keeps +45 deg down to -8 deg
(above 45 deg the painted sky is a plain gradient: look/sky.ts carries its top row on to the zenith), resized to 4096
wide: public/assets/sunscar-dunes/sky/dusk-<stage>.webp, one file for both tiers (4096 x 604, ~10 MB of GPU each).
look/sky.ts PAINTED holds the same numbers (ELEV_TOP, ELEV_BOTTOM); change both together.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../..'))
PPD, HOR, TOP, BOTTOM, WIDTH = 1536 / 100.0, int(1024 * 0.88), 45.0, -8.0, 4096
OUT = os.path.join(REPO, 'public/assets/sunscar-dunes/sky')
os.makedirs(OUT, exist_ok=True)
for stage in ('early', 'late'):  # round 18: two stages (the mid painting fit no mockup; early is early_fix.py's)
    im = Image.open(os.path.join(HERE, stage, 'panorama.png')).convert('RGB')
    y0 = int(round(HOR - TOP * PPD)); y1 = min(im.height, int(round(HOR - BOTTOM * PPD)))
    strip = im.crop((0, y0, im.width, y1))
    h = int(round(strip.height * WIDTH / strip.width))
    strip = strip.resize((WIDTH, h), Image.LANCZOS)
    path = os.path.join(OUT, f'dusk-{stage}.webp')
    strip.save(path, quality=88, method=6)
    strip.resize((1600, int(1600 * h / WIDTH))).save(os.path.join(HERE, f'preview-{stage}.jpg'), quality=85)
    print(stage, strip.size, os.path.getsize(path) // 1024, 'KB')
