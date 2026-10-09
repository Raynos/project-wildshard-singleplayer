import json, sys
from PIL import Image, ImageChops
import numpy as np
out = sys.argv[1]
poses = ['spawn', 'whip', 'ray', 'quest', 'centre']
rows = {}
def load(name):
    return np.asarray(Image.open(f'{out}/{name}.png').convert('RGB').resize((402, 874), Image.BILINEAR)).astype(np.int16)
for p in poses:
    try:
        a, b, c = load(f'off-{p}'), load(f'off2-{p}'), load(f'on-{p}')
    except FileNotFoundError:
        continue
    def stats(x, y):
        d = np.abs(x - y).max(axis=2)
        return {'meanAbs': round(float(np.abs(x - y).mean()), 3), 'over8': round(float((d > 8).mean() * 100), 2), 'over24': round(float((d > 24).mean() * 100), 2)}
    rows[p] = {'noise(off-off2)': stats(a, b), 'swap(off-on)': stats(a, c)}
    # a side-by-side JPEG (off | on | |diff|x4) for the README
    d = np.clip(np.abs(a - c) * 4, 0, 255).astype(np.uint8)
    Image.fromarray(np.concatenate([a.astype(np.uint8), c.astype(np.uint8), d], axis=1)).save(f'{out}/pair-{p}.jpg', quality=70)
json.dump(rows, open(f'{out}/pixel-diff.json', 'w'), indent=1)
print(json.dumps(rows, indent=1))
