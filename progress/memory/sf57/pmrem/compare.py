"""Pixel diff of the before/after home poses (and each build against itself across circuits, the noise floor)."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(sys.argv[1])
out = {}
def load(p): return np.asarray(Image.open(p).convert('RGB'), dtype=np.int16)
def diff(a, b):
    d = np.abs(load(a) - load(b))
    m = d.max(axis=2)
    return {'meanAbs': round(float(d.mean()), 4), 'maxAbs': int(m.max()), 'pctOver8': round(float((m > 8).mean() * 100), 4), 'pctOver0': round(float((m > 0).mean() * 100), 4)}
for pose in ['home-east', 'home-north']:
    for c in [1, 4]:
        out[f'before-vs-after c{c} {pose}'] = diff(root / 'before' / f'c{c}-{pose}.png', root / 'after' / f'c{c}-{pose}.png')
    for build in ['before', 'after']:
        out[f'{build} c1-vs-c4 {pose}'] = diff(root / build / f'c1-{pose}.png', root / build / f'c4-{pose}.png')
print(json.dumps(out, indent=1))
