"""early_fix.py: the shipped early stage from early2 (round 18).

early2's seven slices were edited one by one (edit_stage.py) and each drifted in colour, so its stitch shows vertical
seams. The detail is the late painting's anyway (the edits kept its clouds), so the early stage is the late strip times
early2's colour change, both blurred hard across (80 px) and lightly up (6 px): the seams become gradients, the late
painting's clouds and horizon stay sharp. Round 18b (the lead: A's whole upper sky came out bright magenta; the mockups
keep the top a dark navy night with stars at every stage, the glow only in the band near the horizon): the re-colour
applies only low, easing out from 5 to 14 deg (A's frame top is ~15-19 deg), so the top stays the late painting's dark sky and stars. Writes
early/panorama.png for prep.py."""
import os
import numpy as np
from PIL import Image

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
ratio = (blur(e2) + 4.0) / (blur(late) + 4.0)
# round 19b (seat B: B's horizon band came out magenta, not orange): the re-colour may warm, not blue: its blue ratio held
# at or under 1, its green pulled toward its red
ratio[..., 2] = np.minimum(ratio[..., 2], 1.0)
ratio[..., 1] = 0.5 * (ratio[..., 1] + ratio[..., 0])
# round 21b (seat B after round 20: B's band red-pink, hue 353, against the mockup's orange, hue 19): in the west
# (headings 250-340, eased over 20 deg) the low band's re-colour leans orange: less blue, more green
Wd = ratio.shape[1]; hd = np.arange(Wd) / (Wd / 360.0)
wb = np.clip((hd - 230.0) / 20.0, 0, 1) * np.clip((360.0 - hd) / 20.0, 0, 1)
ratio[..., 2] *= 1.0 - 0.28 * wb[None, :]
ratio[..., 1] *= 1.0 + 0.14 * wb[None, :]
H, HOR, PPD = L.shape[0], int(1024 * 0.88), 1536 / 100.0
elev = (HOR - np.arange(H)) / PPD
t = np.clip((elev - 5.0) / 9.0, 0, 1)
low = (1.0 - t * t * (3 - 2 * t))[:, None, None]
out = np.clip(L * (1.0 + (ratio - 1.0) * low), 0, 255).astype(np.uint8)
os.makedirs(os.path.join(HERE, 'early'), exist_ok=True)
Image.fromarray(out).save(os.path.join(HERE, 'early', 'panorama.png'))
Image.fromarray(out).resize((2400, 444)).save(os.path.join(HERE, 'preview-early.jpg'), quality=85)
print('early', out.shape)
