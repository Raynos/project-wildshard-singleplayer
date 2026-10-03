"""Ease a fitted 33^3 LUT back to identity in the highlights (E407 row 10, second fit).

    python3 art/far-reach/round-32-lut/highlights.py <in.bin> <out.bin> [lo] [hi]

The fit grades the midtones toward the mockups but also lifts near-white (the sun, its glow, lit cloud) past them: live,
top 1 % 243-246 against the mockups' 236-241. Each cell whose input luminance (Rec. 709, display) is over `lo` blends
toward its own input, fully at `hi`, so the grade keeps the sky, isles and meadow and leaves the brightest light alone.
File layout as src/engine/world/lut.ts: 33^3 x RGBA8, index (b * 33 + g) * 33 + r, display sRGB in and out.
"""
import sys

N = 33
src, out = sys.argv[1], sys.argv[2]
lo = float(sys.argv[3]) if len(sys.argv) > 3 else 0.72
hi = float(sys.argv[4]) if len(sys.argv) > 4 else 0.95
data = bytearray(open(src, 'rb').read())
assert len(data) == N * N * N * 4, len(data)


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


for b in range(N):
    for g in range(N):
        for r in range(N):
            i = ((b * N + g) * N + r) * 4
            ir, ig, ib = r / (N - 1), g / (N - 1), b / (N - 1)
            k = smooth(lo, hi, 0.2126 * ir + 0.7152 * ig + 0.0722 * ib)
            for c, v in enumerate((ir, ig, ib)):
                data[i + c] = round(data[i + c] * (1 - k) + v * 255 * k)
open(out, 'wb').write(data)
print('wrote', out, 'lo', lo, 'hi', hi)
