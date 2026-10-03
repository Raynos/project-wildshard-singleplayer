"""late_fix.py: the late painting's eastern upper sky toward mockup C's violet-navy (round 21).

The lead after round 20: C's upper sky came out a saturated electric blue (12, 17, 67) where mockup C's is a deep
violet-navy (39, 32, 57); D's northern sky already matches its mockup. So the painting's east (headings 20-140 deg,
easing out over 20 deg either side) above 6 deg is pulled 75 % toward mockup C's violet, at 1.5x its own brightness. Reads
late/panorama_raw.png (the stitched painting, kept), writes late/panorama.png; then early_fix.py and prep.py.
"""
import os, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
raw = os.path.join(HERE, 'late', 'panorama_raw.png')
if not os.path.exists(raw):
    shutil.copy(os.path.join(HERE, 'late', 'panorama.png'), raw)
a = np.asarray(Image.open(raw).convert('RGB')).astype(np.float64)
H, W = a.shape[:2]
PPD, HOR = W / 360.0, int(1024 * 0.88)
head = np.arange(W) / PPD
def ease(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
wh = ease((head - 0.0) / 20.0) * ease((160.0 - head) / 20.0)          # 20..140 full, easing out over 20 deg
elev = (HOR - np.arange(H)) / (1536 / 100.0)
we = ease((elev - 6.0) / 8.0)
w = (we[:, None] * wh[None, :])[..., None] * 0.75
target = np.array([39.0, 32.0, 57.0]); tl = target @ np.array([0.2126, 0.7152, 0.0722])
lum = a @ np.array([0.2126, 0.7152, 0.0722])
violet = target[None, None, :] * np.minimum(lum * 1.5 / tl, 1.4)[..., None]  # C's sky 20 against the mockup's 36: 1.5x its brightness
out = np.clip(a * (1 - w) + violet * w, 0, 255).astype(np.uint8)
Image.fromarray(out).save(os.path.join(HERE, 'late', 'panorama.png'))
Image.fromarray(out).resize((2400, 444)).save(os.path.join(HERE, 'preview-late.jpg'), quality=85)
print('late fixed', out.shape)
