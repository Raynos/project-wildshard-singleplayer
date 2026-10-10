#!/usr/bin/env python3
"""SF28: before / after pixel diff of the declared-panel captures (capture.mjs --png=<dir>) -> compare.json here."""
import json, sys
from pathlib import Path
from PIL import Image, ImageChops

src = Path(sys.argv[1])
out = {}
for before in sorted(src.glob('*-before.png')):
    name = before.name[: -len('-before.png')]
    after = src / f'{name}-after.png'
    if not after.exists():
        out[name] = {'missing': 'after'}
        continue
    a, b = Image.open(before).convert('RGBA'), Image.open(after).convert('RGBA')
    if a.size != b.size:
        out[name] = {'size': [a.size, b.size]}
        continue
    diff = ImageChops.difference(a, b)
    changed = sum(1 for p in diff.getdata() if p != (0, 0, 0, 0))
    out[name] = {'pixels': a.size[0] * a.size[1], 'changed': changed, 'bbox': diff.getbbox()}
Path(__file__).with_name('compare.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(out, indent=2))
