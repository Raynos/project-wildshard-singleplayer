#!/usr/bin/env python3
"""Portrait infographic for the 2026-10-09 fleet audit. Needs Pillow:
   ~/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 infographic.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
BG, INK, MUTED, GRID = (18, 20, 26), (236, 238, 242), (150, 156, 168), (44, 48, 58)
LOST, SAVE, ACC = (214, 92, 72), (88, 186, 140), (240, 190, 80)
FONT = '/System/Library/Fonts/Helvetica.ttc'
f = lambda s, bold=False: ImageFont.truetype(FONT, s, index=1 if bold else 0)
img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
X0 = 56

d.text((X0, 56), 'Where 12 h of fleet time went', font=f(58, True), fill=INK)
d.text((X0, 128), 'SHARD-PLATFORM build fleet · 2026-10-09 01:20–13:20', font=f(30), fill=MUTED)
d.text((X0, 168), '138 agent-hours (Claude 64 h · Codex 74 h) · 271 commits · 88 pushes', font=f(30), fill=MUTED)

# KPI tiles
tiles = [('59 h', 'lost to the top 10 sinks'), ('6.2 min', 'commit to origin, median'), ('0 / 87', 'gpu-gate runs green')]
tw = (W - 2 * X0 - 2 * 24) // 3
for i, (big, small) in enumerate(tiles):
    x = X0 + i * (tw + 24)
    d.rounded_rectangle((x, 232, x + tw, 372), 18, fill=(28, 31, 40))
    d.text((x + 22, 250), big, font=f(52, True), fill=ACC if i else LOST)
    d.text((x + 22, 318), small, font=f(24), fill=MUTED)

# bars: lost (red) with the projected saving (green) laid over it
d.text((X0, 412), 'Top 10 time sinks, agent-hours in 12 h', font=f(34, True), fill=INK)
d.rectangle((X0, 466, X0 + 26, 492), fill=LOST)
d.text((X0 + 38, 464), 'lost', font=f(26), fill=MUTED)
d.rectangle((X0 + 130, 466, X0 + 156, 492), fill=SAVE)
d.text((X0 + 168, 464), 'projected saving', font=f(26), fill=MUTED)
rows = [
    ('Polling / waiting on runs and lanes', 11, 9),
    ('Local heavy proofs (parity, soak, physics)', 10, 7),
    ('Serialized push path (regen + gate + queue)', 8, 6),
    ('Per-lane full suites + lease queue', 7.2, 6.5),
    ('Receipts, State lines, handoffs', 6, 4.5),
    ('Clean exports, private-index landings', 5, 4),
    ('Builds + serve-build for captures', 4, 2),
    ('Rebakes, stale checkpoints', 3, 2),
    ('Commit hooks + refusals', 2.5, 2),
    ('git reads, herdr, re-briefing', 2.5, 1),
]
y, bx, bw = 520, X0, W - 2 * X0 - 90
scale = bw / 11.5
for label, lost, save in rows:
    d.text((bx, y), label, font=f(27), fill=INK)
    yb = y + 38
    d.rounded_rectangle((bx, yb, bx + lost * scale, yb + 30), 6, fill=LOST)
    d.rounded_rectangle((bx, yb, bx + save * scale, yb + 30), 6, fill=SAVE)
    d.text((bx + lost * scale + 14, yb - 1), f'{lost:g} h', font=f(27, True), fill=INK)
    d.text((bx + 10, yb + 1), f'-{save:g}', font=f(24, True), fill=BG)
    y += 86

# bottom panel
y += 16
d.line((X0, y, W - X0, y), fill=GRID, width=2)
y += 28
d.text((X0, y), 'Contention, in numbers', font=f(34, True), fill=INK)
y += 56
facts = [
    'One push lock: a push every 6.5 min, commits wait 6.2 min (p90 15.6)',
    'Full-test lease: ~150 lane full suites, queue median 152 s (max 566 s)',
    'Still in the last hour: 14 lane full suites, queue median 271 s',
    'CI: 382 runs, ~98 runner-hours; push CI red 56 of 96',
    '83 MB of receipts under progress/ (74 MB soak .gz/.br)',
]
for s in facts:
    d.ellipse((X0, y + 11, X0 + 12, y + 23), fill=ACC)
    d.text((X0 + 26, y), s, font=f(27), fill=INK)
    y += 46
y += 18
d.rounded_rectangle((X0, y, W - X0, y + 150), 18, fill=(30, 52, 44))
d.text((X0 + 26, y + 20), 'Projected: save ~44 of the 59 h', font=f(40, True), fill=SAVE)
d.text((X0 + 26, y + 78), 'push cycle ~6 min down to ~1.5 min; no lane waits on another', font=f(28), fill=INK)
out = Path(__file__).with_name('infographic.jpg')
img.save(out, quality=88)
print(out, img.size)
