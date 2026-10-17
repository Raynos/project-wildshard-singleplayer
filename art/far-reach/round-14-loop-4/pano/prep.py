"""Sky Reach panorama -> the shipped strips and data/panorama.json (loop 4, E374).

  python3 prep.py <horizon row in panorama.png> [source image]      # e.g. 564 ../../round-17-mockup-loop/panorama-graded.jpg

Writes public/assets/far-reach/sky/panorama.webp (desktop, native 5530 px) and panorama.phone.webp (4096 px), each
carrying PAD columns of wrap on either side (a lossy codec encodes an image's edges on their own: an unpadded strip
comes back with a step at heading 0, the spawn's forward view), and src/shards/far-reach/data/panorama.json: the
horizon row, the painted sun (heading, elevation), the zenith / nadir colours and the fog LUT (the haze just above the
horizon per heading, so the 3-D fog fades into the painting).
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
PAD = 16
PPD = 15.36
_png = os.path.join(HERE, 'panorama.png')  # the stitch's output; the committed source is its q92 JPEG
_src = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else (_png if os.path.exists(_png) else os.path.join(HERE, 'panorama-5530x1024.jpg'))  # E392: a graded source
src = np.asarray(Image.open(_src).convert('RGB')).astype(np.float64)
H, W, _ = src.shape
hor = float(sys.argv[1])

out_dir = os.path.join(REPO, 'public/assets/far-reach/sky')
os.makedirs(out_dir, exist_ok=True)
for name, width in (('panorama.webp', W), ('panorama.phone.webp', 4096)):
    im = Image.fromarray(src.clip(0, 255).astype(np.uint8))
    if width != W:
        # resize as a loop: pad, resize, crop, so the two ends stay continuous
        k = 64
        loop = np.concatenate([src[:, -k:], src, src[:, :k]], axis=1)
        h = int(round(H * width / W))
        r = Image.fromarray(loop.clip(0, 255).astype(np.uint8)).resize((int(round(loop.shape[1] * width / W)), h), Image.LANCZOS)
        kk = int(round(k * width / W))
        im = r.crop((kk, 0, kk + width, h))
    a = np.asarray(im)
    padded = np.concatenate([a[:, -PAD:], a, a[:, :PAD]], axis=1)
    Image.fromarray(padded).save(os.path.join(out_dir, name), 'WEBP', quality=88, method=6)
    print(name, padded.shape, os.path.getsize(os.path.join(out_dir, name)) // 1024, 'KB')

# the painted sun: the centroid of the brightest pixels
# (E399 round 6: the near-white disc pixels round the whitest one; a percentile of the whole strip's brightness took cloud
# rims elsewhere once the bloom round the disc turned orange, and the glow card drew 1.3 deg off the painted disc)
white = src.min(axis=2)
white[int(hor) - 8:] = 0  # the disc only: not its glitter on the cloud sea below the horizon
my, mx = np.unravel_index(np.argmax(white), white.shape)
ys, xs = np.nonzero(white > 222)
dx = (xs - mx + W / 2) % W - W / 2
keep = np.hypot(dx, ys - my) < 45
ys, xs = ys[keep], xs[keep]
# circular mean of x
ang = xs / W * 2 * np.pi
sx = (np.degrees(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) + 360) % 360
sy = ys.mean()
sun_heading, sun_elev = sx, (hor - sy) / PPD
print('sun heading', round(sun_heading, 1), 'elevation', round(sun_elev, 2))

srgb = src / 255.0
zen = srgb[:12].reshape(-1, 3).mean(axis=0)
nad = srgb[-12:].reshape(-1, 3).mean(axis=0)
band = srgb[int(hor - 2.5 * PPD):int(hor - 0.5 * PPD)].mean(axis=0)  # (W, 3)
N = 64
lut = np.stack([band[int(i * W / N):int((i + 1) * W / N)].mean(axis=0) for i in range(N)])
# a circular blur over 3 texels each side
lut = np.stack([np.mean([lut[(i + j) % N] for j in range(-3, 4)], axis=0) for i in range(N)])

# Keep the original emitted precision at the JSON boundary.
rounded = lambda values: [round(float(x), 4) for x in values]
data = {
    'PANO_HORIZON_V': round(hor / H, 4),
    'PANO_DEG_PER_V': round(H / PPD, 3),
    'PANO_SUN': {'heading': round(float(sun_heading), 2), 'elevation': round(float(sun_elev), 2)},
    'PANO_ZENITH_SRGB': rounded(zen),
    'PANO_NADIR_SRGB': rounded(nad),
    'PANO_FOG_SRGB': rounded(lut.reshape(-1)),
}
with open(os.path.join(REPO, 'src/shards/far-reach/data/panorama.json'), 'w') as output:
    json.dump(data, output, indent=2)
    output.write('\n')
print('wrote panorama.json')
