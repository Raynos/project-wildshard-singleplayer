#!/usr/bin/env python3
"""motion.py <dir> <name>... — the shimmer test. Three frames 1/30 s apart on a smooth walk: a stable surface moves
linearly, so frame 1 ≈ the mean of frames 0 and 2; what pops on/off (aliasing, crawl) does not. Reports the residual
|f1 − (f0+f2)/2| (luma, 0..255): mean, p99.5 and the share of pixels over 12, on the upper 60 % of the frame (towers).
Writes <name>-shimmer.png, the residual ×6."""
import sys
import numpy as np
from PIL import Image

d, names = sys.argv[1], sys.argv[2:]
for n in names:
    f = [np.asarray(Image.open(f'{d}/{n}-m{k}.png').convert('L')).astype(float) for k in range(3)]
    r = np.abs(f[1] - 0.5 * (f[0] + f[2]))
    h = r.shape[0]
    top = r[: int(h * 0.6)]
    print(f'{n:28s} mean {top.mean():6.3f}  p99.5 {np.percentile(top, 99.5):6.2f}  >12: {(top > 12).mean() * 100:5.2f} %')
    Image.fromarray(np.clip(r * 6, 0, 255).astype(np.uint8)).save(f'{d}/{n}-shimmer.png')
