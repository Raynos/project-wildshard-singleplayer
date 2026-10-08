"""G227 platform atlas: SSIM (7 x 7 box window on luma, the repo's scripts/parity/ssim.mjs constants) and pixel diffs
between two capture runs. python3 compare.py <shots dir> <label a> <label b> [out.json]"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def luma(path):
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float64)
    return a, 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def box(x, k=7):
    s = np.pad(x, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    return (s[k:, k:] - s[:-k, k:] - s[k:, :-k] + s[:-k, :-k]) / (k * k)


def ssim(x, y):
    c1, c2, n = (0.01 * 255) ** 2, (0.03 * 255) ** 2, 49
    mx, my = box(x), box(y)
    vx = (box(x * x) - mx * mx) * n / (n - 1)
    vy = (box(y * y) - my * my) * n / (n - 1)
    cxy = (box(x * y) - mx * my) * n / (n - 1)
    return float((((2 * mx * my + c1) * (2 * cxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))).mean())


def main():
    root, a, b = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    rows = []
    for pa in sorted(root.glob(f'{a}-*.png')):
        pb = root / pa.name.replace(f'{a}-', f'{b}-', 1)
        if not pb.exists():
            continue
        ra, la = luma(pa)
        rb, lb = luma(pb)
        d = np.abs(ra - rb).max(axis=2)
        rows.append({'pose': pa.name[len(a) + 1:-4], 'ssim': round(ssim(la, lb), 6), 'maxChannelDiff': int(d.max()),
                     'pixelsDiffering': int((d > 0).sum()), 'pixelsOver2': int((d > 2).sum()), 'pixels': int(d.size)})
    for r in rows:
        print(f"{r['pose']:28s} ssim {r['ssim']:.6f}  max {r['maxChannelDiff']:3d}  differing {r['pixelsDiffering']:7d}  >2 {r['pixelsOver2']:6d}")
    if len(sys.argv) > 4:
        Path(sys.argv[4]).write_text(json.dumps({'a': a, 'b': b, 'rows': rows}, indent=1) + '\n')


main()
