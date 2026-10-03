"""early_fix.py: the shipped early stage from early2 (round 18).

early2's seven slices were edited one by one (edit_stage.py) and each drifted in colour, so its stitch shows vertical
seams. The detail is the late painting's anyway (the edits kept its clouds), so the early stage is the late strip times
early2's colour change, both blurred hard across (80 px) and lightly up (6 px): the seams become gradients, the late
painting's clouds and horizon stay sharp. Writes early/panorama.png for prep.py (the first early panorama, too tall a
glow, is replaced)."""
import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
late = Image.open(os.path.join(HERE, 'late', 'panorama.png')).convert('RGB')
e2 = Image.open(os.path.join(HERE, 'early2', 'panorama.png')).convert('RGB').resize(late.size)


def blur(im):
    # anisotropic: a horizontal box of 161 px then a vertical one of 13 px (wrap round the heading by padding)
    a = np.asarray(im).astype(np.float64); pad = 200
    a = np.concatenate([a[:, -pad:], a, a[:, :pad]], axis=1)
    k = np.ones(161) / 161
    a = np.apply_along_axis(lambda r: np.convolve(r, k, mode='same'), 1, a)
    kv = np.ones(13) / 13
    a = np.apply_along_axis(lambda c: np.convolve(c, kv, mode='same'), 0, a)
    return a[:, pad:-pad]


L = np.asarray(late).astype(np.float64)
# just after sunset there are no stars and no milky way yet: star points go (a median test), and above ~14 deg the late
# painting's detail is mostly blended into its own smooth gradient (the clouds sit lower)
med = np.asarray(late.filter(ImageFilter.MedianFilter(7))).astype(np.float64)
L = np.where((L.sum(2, keepdims=True) - med.sum(2, keepdims=True)) > 45, med, L)
H, HOR, PPD = L.shape[0], int(1024 * 0.88), 1536 / 100.0
elev = (HOR - np.arange(H)) / PPD
w = np.clip((elev - 14.0) / 10.0, 0, 1)[:, None, None] * 0.8
L = L * (1 - w) + blur(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8))) * w
ratio = (blur(e2) + 4.0) / (blur(late) + 4.0)
out = np.clip(L * ratio, 0, 255).astype(np.uint8)
os.makedirs(os.path.join(HERE, 'early'), exist_ok=True)
Image.fromarray(out).save(os.path.join(HERE, 'early', 'panorama.png'))
Image.fromarray(out).resize((2400, 444)).save(os.path.join(HERE, 'preview-early.jpg'), quality=85)
print('early', out.shape)
