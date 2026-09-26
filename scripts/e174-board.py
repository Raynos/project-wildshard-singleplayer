#!/usr/bin/env python3
"""e174-board.py — the E174 before/after board from scripts/e174-shadows.mjs's output (one JPEG, A / B / C / D side by side).

  python3 scripts/e174-board.py /tmp/e174/run1 progress/NNN-e174-driftwood-shadows-board.jpg

Per pose and variant, on the 3D view between the HUD bands: SSIM vs A (luma, 7x7 windows like the scorecard), the pixels that differ. The board: one
column per variant (iPhone portrait frames, 390x844 CSS px), then for each close-up pose the 3x device-pixel window where
D differs most from A (the worst place, not a flattering one), then the numbers: shadow-map MB, all GL textures MB, GPU
ms a frame, SSIM. Prints the table as Markdown too.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

RUN = Path(sys.argv[1])
OUT = Path(sys.argv[2])
V = ['a', 'b', 'c', 'd']
NAMES = {'a': 'A  Today', 'b': 'B  Depth only', 'c': 'C  16-bit depth', 'd': 'D  Lean'}
res = json.loads((RUN / 'result.json').read_text())


def luma(p):
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def ssim(x, y, k=7):
    def box(f):
        s = np.cumsum(np.cumsum(np.pad(f, ((1, 0), (1, 0))), 0), 1)
        return (s[k:, k:] - s[:-k, k:] - s[k:, :-k] + s[:-k, :-k]) / (k * k)
    n = k * k
    cov = n / (n - 1)
    mx, my = box(x), box(y)
    vx = (box(x * x) - mx * mx) * cov
    vy = (box(y * y) - my * my) * cov
    vxy = (box(x * y) - mx * my) * cov
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    return float((((2 * mx * my + c1) * (2 * vxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))).mean())


def worst_window(pose, size):
    """the size x size device-px window (below the HUD's top, above the touch pad) where D (else C) differs most from A"""
    a = np.asarray(Image.open(RUN / f'{pose}-a.png').convert('RGB')).astype(np.int32)
    for v in ('d', 'c'):
        b = np.asarray(Image.open(RUN / f'{pose}-{v}.png').convert('RGB')).astype(np.int32)
        d = np.abs(a - b).max(axis=2).astype(np.float64)
        if d.sum() > 0:
            break
    h, w = d.shape
    y0, y1 = int(h * 0.2), int(h * 0.76)  # the minimap / quest line above, the buttons and the pad below
    s = np.cumsum(np.cumsum(np.pad(d, ((1, 0), (1, 0))), 0), 1)
    best, at = -1.0, (0, y0)
    step = 24
    for y in range(y0, y1 - size, step):
        for x in range(0, w - size, step):
            t = s[y + size, x + size] - s[y, x + size] - s[y + size, x] + s[y, x]
            if t > best:
                best, at = t, (x, y)
    return at


poses = list(res['poses'].keys())
stats = {}


def view(x):
    """the 3D view between the HUD bands (CSS y 169-637 of 844: below the minimap + quest line, above the buttons + pad):
    the DOM HUD animates on its own (the LOCK button's pulse), the frozen frame does not"""
    h = x.shape[0]
    return x[int(h * 0.2):int(h * 0.755)]


for pose in poses:
    la = view(luma(RUN / f'{pose}-a.png'))
    a = view(np.asarray(Image.open(RUN / f'{pose}-a.png').convert('RGB')).astype(np.int32))
    stats[pose] = {}
    for v in V:
        lb = view(luma(RUN / f'{pose}-{v}.png'))
        b = view(np.asarray(Image.open(RUN / f'{pose}-{v}.png').convert('RGB')).astype(np.int32))
        d = np.abs(a - b).max(axis=2)
        stats[pose][v] = {'ssim': 1.0 if v == 'a' else ssim(la, lb), 'diffPx': int((d > 0).sum()), 'diff8': int((d > 8).sum())}

# ── the numbers ──
mem = res.get('memory', {})
MiB = 2 ** 20


def shadow_mib(v):
    """the depth textures (0x81a5 / 0x81a6) and three's RGBA8 colour textures of the 2048² maps; a 1024² RGBA8 texture of
    something else rides in the tally's square-texture filter on every variant and is left out"""
    m = mem.get(v)
    return sum(r[0] for r in m['shadow'] if r[2] != '0x8058' or r[1] == '2048x2048') / MiB if m else None


def total_mib(v):
    m = mem.get(v)
    return m['total'] / MiB if m else None


def gpu(v, pose):
    return res['poses'][pose][v]['gpuMs']


def gpu_delta(v, pose):
    """median of the paired per-round differences v − a (the rounds alternate the variants: drift cancels)"""
    ga, gv = res['poses'][pose]['a']['gpu'], res['poses'][pose][v]['gpu']
    d = sorted(x - y for x, y in zip(gv, ga))
    return d[len(d) // 2]


lines = ['| variant | shadow maps MiB | saved MiB | all GL textures MiB | ' + ' | '.join(f'{p} GPU ms (Δ vs A)' for p in poses) + ' | ' + ' | '.join(f'{p} SSIM' for p in poses) + ' |',
         '|---|---|---|---|' + '---|' * (2 * len(poses))]
for v in V:
    sm, tm = shadow_mib(v), total_mib(v)
    saved = (shadow_mib('a') - sm) if sm is not None and shadow_mib('a') is not None else None
    cells = [NAMES[v].replace('  ', ' '), f'{sm:.0f}' if sm is not None else '?', f'{saved:.0f}' if saved is not None else '?', f'{tm:.1f}' if tm is not None else '?']
    cells += [f'{gpu(v, p):.2f} ({gpu_delta(v, p):+.2f})' for p in poses]
    cells += [f"{stats[p][v]['ssim']:.4f}" for p in poses]
    lines.append('| ' + ' | '.join(cells) + ' |')
table = '\n'.join(lines)
print(table)
print()
print('| pose | variant | pixels differing from A | > 8/255 |')
print('|---|---|---|---|')
for p in poses:
    for v in V[1:]:
        print(f"| {p} | {v.upper()} | {stats[p][v]['diffPx']} | {stats[p][v]['diff8']} |")
(RUN / 'table.md').write_text(table + '\n')

# ── the board ──
COLW = 390
CROP = 330  # device px (3x): 110 CSS px of the screen, shown at 390 px (nearest: every texel of the shadow edge visible)
FULL = [p for p in ('planks',) if p in poses]
# (pose, caption, device-px corner or None = where D differs most from A)
CLOSE = [c for c in (
    ('planks', 'pier, near cascade: a shadow edge', (330, 1400)),
    ('planks', 'pier, far cascade: where D differs most', None),
    ('palms', 'palm fronds on the sand (near cascade)', (150, 1810)),
    ('shore', 'driftwood shadow (mid cascade)', (660, 1110)),
    ('shore', 'fence + jetty (far cascade, 22-80 m)', (600, 900)),
) if c[0] in poses]
fontB = ImageFont.truetype('/System/Library/Fonts/SFNSMono.ttf', 22)
fontS = ImageFont.truetype('/System/Library/Fonts/SFNSMono.ttf', 14)
fontT = ImageFont.truetype('/System/Library/Fonts/SFNSMono.ttf', 21)
PAD, CAP, INSET = 8, 22, 120
head_h, label_h, stats_h = 70, 38, 260
W = 4 * COLW + 5 * PAD
H = head_h + label_h + len(FULL) * (844 + PAD) + len(CLOSE) * (COLW + CAP + PAD) + stats_h
board = Image.new('RGB', (W, H), (13, 27, 38))
dr = ImageDraw.Draw(board)
CYAN, WHITE, GREY = (143, 227, 255), (255, 255, 255), (190, 210, 222)
dr.text((PAD, 8), 'E174 · DRIFTWOOD PHONE SHADOW MAPS · A / B / C / D · iPhone 390x844 @3, tier=phone', font=fontT, fill=CYAN)
dr.text((PAD, 38), 'each column: the same frozen frame, only the shadow maps switched live · red inset = |variant - A| x 6', font=fontS, fill=GREY)
y = head_h
for i, v in enumerate(V):
    dr.text((PAD + i * (COLW + PAD) + 4, y + 4), NAMES[v].upper(), font=fontB, fill=WHITE)
y += label_h
for p in FULL:
    for i, v in enumerate(V):
        board.paste(Image.open(RUN / f'{p}-{v}.png').convert('RGB').resize((COLW, 844), Image.LANCZOS), (PAD + i * (COLW + PAD), y))
    y += 844 + PAD
for p, cap, at in CLOSE:
    cx, cy = at if at is not None else worst_window(p, CROP)
    box = (cx, cy, cx + CROP, cy + CROP)
    ref = np.asarray(Image.open(RUN / f'{p}-a.png').convert('RGB').crop(box)).astype(np.int32)
    dr.text((PAD + 2, y + 3), f'{p} · {cap}', font=fontS, fill=CYAN)
    for i, v in enumerate(V):
        x = PAD + i * (COLW + PAD)
        crop = Image.open(RUN / f'{p}-{v}.png').convert('RGB').crop(box)
        board.paste(crop.resize((COLW, COLW), Image.NEAREST), (x, y + CAP))
        if v != 'a':
            d = np.clip(np.abs(np.asarray(crop).astype(np.int32) - ref).max(axis=2) * 6, 0, 255).astype(np.uint8)
            d = d.reshape(CROP // 3, 3, CROP // 3, 3).max(axis=(1, 3))  # 3x3 max-pool: a one-pixel difference stays visible
            heat = np.zeros((*d.shape, 3), np.uint8)
            heat[..., 0] = np.maximum(d, 20)
            heat[..., 1] = 10
            heat[..., 2] = 20
            board.paste(Image.fromarray(heat).resize((INSET, INSET), Image.BOX), (x + COLW - INSET - 4, y + CAP + COLW - INSET - 4))
            dr.rectangle((x + COLW - INSET - 5, y + CAP + COLW - INSET - 5, x + COLW - 4, y + CAP + COLW - 4), outline=CYAN)
    y += COLW + CAP + PAD
y += PAD
for i, v in enumerate(V):
    x = PAD + i * (COLW + PAD)
    sm, tm = shadow_mib(v), total_mib(v)
    saved = shadow_mib('a') - sm if sm is not None else 0
    dr.text((x + 4, y), f'shadow maps {sm:.0f} MB' if sm is not None else 'shadow maps ?', font=fontB, fill=WHITE)
    dr.text((x + 4, y + 30), f'saved {saved:.0f} MB' if v != 'a' else 'saved 0 (today)', font=fontB, fill=(120, 255, 170) if v != 'a' else WHITE)
    rows2 = [f'all GL textures {tm:.0f} MB' if tm is not None else '']
    rows2 += [f'{p:<6} GPU {gpu(v, p):.2f} ms' + ('' if v == 'a' else f' ({gpu_delta(v, p):+.2f})') for p in ('pier', 'beach', 'wreck') if p in poses]
    rows2.append('SSIM vs A: ' + ' '.join(f"{stats[p][v]['ssim']:.4f}" for p in ('pier', 'beach', 'wreck') if p in poses))
    rows2.append(f"worst SSIM, all poses {min(stats[p][v]['ssim'] for p in poses):.4f}")
    for j, t in enumerate(rows2):
        dr.text((x + 4, y + 66 + j * 24), t, font=fontS, fill=GREY)
OUT.parent.mkdir(parents=True, exist_ok=True)
q = 88
while True:
    board.save(OUT, 'JPEG', quality=q, optimize=True, progressive=True)
    if OUT.stat().st_size <= 500 * 1024 or q <= 40:
        break
    q -= 4
print(f'board {OUT} {OUT.stat().st_size // 1024} KB (q {q}) {W}x{H}')
