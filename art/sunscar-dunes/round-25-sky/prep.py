"""prep.py: the shipped painted skies from the stitched panoramas (pano.py stitch), one per dusk stage.

Each <stage>/panorama.png is 5530 x 1024: x = heading (0 = the spawn's forward view, -z), 15.36 px a degree both ways,
the horizon at row 901 (88 %), so the strip spans +58.6 deg to -8 deg. The shipped strip keeps +45 deg down to -8 deg
(above 45 deg the painted sky is a plain gradient: look/sky.ts carries its top row on to the zenith), resized to 4096
wide: public/assets/sunscar-dunes/sky/dusk-<stage>.webp, one file for both tiers (4096 x 604, ~10 MB of GPU each).
look/sky.ts PAINTED holds the same numbers (ELEV_TOP, ELEV_BOTTOM); change both together.
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../..'))
PPD, HOR, TOP, BOTTOM, WIDTH = 1536 / 100.0, int(1024 * 0.88), 45.0, -8.0, 4096
OUT = os.path.join(REPO, 'public/assets/sunscar-dunes/sky')
os.makedirs(OUT, exist_ok=True)
for stage in ('early', 'late'):  # round 18: two stages (the mid painting fit no mockup; early is early_fix.py's)
    im = Image.open(os.path.join(HERE, stage, 'panorama.png')).convert('RGB')
    if stage == 'late':
        # round 22 (the lead after round 21: D's sky crossed by pink cloud streaks, its mockup a clean gradient; seats B and
        # C: B's and D's mockups keep the late sky clean and starry): above 5 deg the late sky is its own colour averaged
        # over +-25 deg of heading, so the streaks go and the gradient and its heading's hue stay (the shader adds the stars)
        a = np.asarray(im).astype(np.float64); n = int(25 * PPD); pad = n + 1
        w = np.concatenate([a[:, -pad:], a, a[:, :pad]], axis=1)
        c = np.cumsum(np.concatenate([np.zeros((w.shape[0], 1, 3)), w], axis=1), axis=1)
        sm = (c[:, 2 * n + 1:] - c[:, :-2 * n - 1]) / (2 * n + 1)
        sm = sm[:, pad - n:pad - n + a.shape[1]]
        el = (HOR - np.arange(a.shape[0])) / PPD
        t = np.clip((el - 5.0) / 4.0, 0, 1); t = (t * t * (3 - 2 * t))[:, None, None]
        a = a * (1 - t) + sm * t
        # round 22b (the lead and seat C: D's mid sky magenta, 151,70,100 against the mockup's violet 88,62,104): toward
        # D's view (heading 341, full within +-10 deg, easing out by +-70) the red falls to 0.62 from 4 to 14 deg, easing
        # out to 0.82 at the horizon band (its green up 20 %, peach not red-pink) and to none by 22 deg
        hd = np.arange(a.shape[1]) / PPD
        def ease(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
        dh = np.abs((hd - 341.0 + 180.0) % 360.0 - 180.0)  # D's frame spans ~323-359; B's (303) ends by ~321
        # round 23 (TOP10-3 row 4, the lead's round-22 ruling: the 8 deg shoulders showed as a seam in the clip): full within
        # +-10 deg of D's heading, easing to none by +-70 deg, so no edge falls inside any frame
        wh = ease((70.0 - dh) / 60.0)
        rf = np.interp(el, [-8.0, 1.0, 4.0, 14.0, 22.0, 90.0], [0.82, 0.82, 0.62, 0.62, 1.0, 1.0])
        # the glow line keeps its value (the mockup's 160,103,99 against 199,97,92): less red, a little more green
        gf = np.interp(el, [-8.0, 2.0, 5.0, 14.0, 22.0, 90.0], [1.2, 1.2, 0.95, 0.95, 1.0, 1.0])
        a[..., 0] *= 1.0 - (1.0 - rf)[:, None] * wh[None, :]
        a[..., 1] *= 1.0 + (gf - 1.0)[:, None] * wh[None, :]
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    y0 = int(round(HOR - TOP * PPD)); y1 = min(im.height, int(round(HOR - BOTTOM * PPD)))
    strip = im.crop((0, y0, im.width, y1))
    h = int(round(strip.height * WIDTH / strip.width))
    strip = strip.resize((WIDTH, h), Image.LANCZOS)
    path = os.path.join(OUT, f'dusk-{stage}.webp')
    strip.save(path, quality=88, method=6)
    strip.resize((1600, int(1600 * h / WIDTH))).save(os.path.join(HERE, f'preview-{stage}.jpg'), quality=85)
    print(stage, strip.size, os.path.getsize(path) // 1024, 'KB')
