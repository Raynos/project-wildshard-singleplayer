#!/usr/bin/env python3
"""palette-delta.py — the Driftwood mockup loop's colour check (E43, DRIFTWOOD-REMASTER look track).

Samples the MEAN colour of the same regions in each mockup frame and its in-game capture (the 9 E43 spawn-cove
cameras, art/driftwood-isle/round-4-remaster/README.md) and prints mockup vs game per region with CIEDE2000 ΔE.

  python3 scripts/palette-delta.py art/driftwood-isle/round-4-remaster 'art/driftwood-isle/round-6-loop/ingame-{n}.jpg'

Regions are fixed rectangles in normalised image coordinates per camera, the same for the mockup and the capture;
inside each rectangle only the pixels that belong to the material count (a hue / saturation / value filter), so a
palm or a HUD panel crossing the rectangle does not pollute the sand's mean. A material's mean is over every rectangle
it has, in every frame. `sand shadow` is the sand-hued rectangle's pixels darker than 72 % of its lit sand's median.
"""
import colorsys
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# material → [(frame, (x0, y0, x1, y1))]
REGIONS = {
    'shallow water': [(5, (0.1, 0.62, 0.9, 0.95)), (6, (0.05, 0.62, 0.95, 0.95)), (7, (0.55, 0.35, 0.95, 0.95)), (9, (0.05, 0.12, 0.95, 0.3))],
    'deep water': [(7, (0.45, 0.0, 1.0, 0.07)), (8, (0.0, 0.0, 0.55, 0.07)), (9, (0.0, 0.0, 1.0, 0.07))],
    'sand': [(5, (0.05, 0.05, 0.95, 0.45)), (7, (0.1, 0.45, 0.5, 0.95)), (9, (0.1, 0.45, 0.9, 0.95))],
    'sand shadow': [(5, (0.05, 0.05, 0.95, 0.45)), (7, (0.1, 0.45, 0.5, 0.95)), (9, (0.1, 0.45, 0.9, 0.95))],
    'grass': [(6, (0.05, 0.12, 0.95, 0.38))],
    'foliage': [(7, (0.0, 0.45, 0.2, 0.95)), (9, (0.25, 0.55, 0.6, 0.95))],
    'sky zenith': [(2, (0.02, 0.12, 0.35, 0.2)), (3, (0.02, 0.12, 0.35, 0.2))],
    'sky horizon': [(2, (0.02, 0.4, 0.35, 0.46)), (3, (0.02, 0.4, 0.35, 0.46))],
}

# material → hue range (deg), min sat, min value, max value
FILTERS = {
    'shallow water': (160, 205, 0.25, 0.35, 1.0),
    'deep water': (195, 245, 0.35, 0.15, 1.0),
    'sand': (18, 55, 0.15, 0.5, 1.0),
    'grass': (65, 160, 0.3, 0.35, 1.0),
    'foliage': (65, 160, 0.35, 0.12, 1.0),
    'sky zenith': (190, 240, 0.3, 0.3, 1.0),
    'sky horizon': (185, 235, 0.12, 0.4, 1.0),
}


def hsv(px):
    a = px / 255.0
    mx, mn = a.max(1), a.min(1)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = a[:, 0], a[:, 1], a[:, 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    return h * 60, s, mx


def pixels(img, rect):
    w, h = img.size
    x0, y0, x1, y1 = rect
    return np.asarray(img.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))).convert('RGB'), dtype=np.float64).reshape(-1, 3)


def select(mat, px):
    H, S, V = hsv(px)
    lum = px @ np.array([0.299, 0.587, 0.114])
    if mat == 'sand shadow':
        lo, hi, smin, vmin, vmax = FILTERS['sand']
        lit = (H >= lo) & (H <= hi) & (S >= smin) & (V >= vmin)
        if lit.sum() < 20: return px[:0]
        med = np.median(lum[lit])
        green = (H >= 65) & (H <= 160) & (S > 0.25)
        return px[(lum < 0.72 * med) & (V > 0.12) & ~green]
    lo, hi, smin, vmin, vmax = FILTERS[mat]
    return px[(H >= lo) & (H <= hi) & (S >= smin) & (V >= vmin) & (V <= vmax)]


def srgb_to_lab(rgb):
    c = np.array(rgb) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    x, y, z = M @ c / np.array([0.95047, 1.0, 1.08883])
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def ciede2000(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0: dh = 0
    elif dh > 180: dh -= 360
    elif dh < -180: dh += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0: hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180: hbp = (h1p + h2p) / 2
    else: hbp = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp)) + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.2 * math.cos(math.radians(4 * hbp - 63))
    dth = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dth)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def main():
    mock_dir, game_pat = Path(sys.argv[1]), sys.argv[2]
    mocks = {n: Image.open(next(mock_dir.glob(f'mockup-{n}-*.jpg'))) for n in range(1, 10)}
    games = {n: Image.open(game_pat.format(n=n)) for n in range(1, 10) if Path(game_pat.format(n=n)).exists()}
    rows, worst = [], 0.0
    for mat, regs in REGIONS.items():
        acc = {'m': [], 'g': []}
        for n, rect in regs:
            if n not in games: continue
            acc['m'].append(select(mat, pixels(mocks[n], rect)))
            acc['g'].append(select(mat, pixels(games[n], rect)))
        m = np.concatenate(acc['m']) if acc['m'] else np.zeros((0, 3))
        g = np.concatenate(acc['g']) if acc['g'] else np.zeros((0, 3))
        if len(m) < 20 or len(g) < 20:
            rows.append((mat, None, None, None, len(m), len(g))); continue
        mm, gm = m.mean(0), g.mean(0)
        de = ciede2000(srgb_to_lab(mm), srgb_to_lab(gm))
        worst = max(worst, de)
        rows.append((mat, mm, gm, de, len(m), len(g)))
    hexc = lambda c: '#%02x%02x%02x' % tuple(int(round(v)) for v in c)
    print(f"{'region':14} {'mockup':8} {'game':8} {'ΔE00':>6}   (pixels mock / game)")
    for mat, mm, gm, de, nm, ng in rows:
        if de is None: print(f'{mat:14} {"—":8} {"—":8} {"n/a":>6}   ({nm} / {ng})'); continue
        flag = '' if de < 10 else '  <-- over 10'
        print(f'{mat:14} {hexc(mm):8} {hexc(gm):8} {de:6.1f}   ({nm} / {ng}){flag}')
    print(f'worst ΔE00 = {worst:.1f}')


if __name__ == '__main__':
    main()
