"""Assemble the G246 map-style frames and the A / B / C board (art/maps/round-1-baked-map-style/)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

SHOTS, MAPS, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
SHARDS = [('driftwood-isle', 'DRIFTWOOD ISLE'), ('far-reach', 'SKY REACH')]
VARS = [('A', 'PHOTO', 'the raw top-down render'), ('B', 'STYLIZED', 'flat colours by ground type + hillshade'),
        ('C', 'PHOTO + OUTLINES', 'render, +contrast, crisp edge lines'), ('now', 'TODAY', 'current registered-pieces map')]
MONO = '/System/Library/Fonts/Menlo.ttc'
BG, FG, CY, DIM = (11, 16, 22), (235, 240, 245), (143, 227, 255), (150, 165, 178)

def font(sz, bold=False):
    return ImageFont.truetype(MONO, sz, index=1 if bold else 0)

def save_jpg(im, path, limit=500_000):
    q = 86
    while True:
        im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(path) <= limit or q <= 50: return q
        q -= 4

def strip(im, text):
    w = im.width; s = Image.new('RGB', (w, 84), BG); d = ImageDraw.Draw(s)
    d.text((28, 22), text, font=font(34, True), fill=FG)
    out = Image.new('RGB', (w, im.height + 84), BG); out.paste(s, (0, 0)); out.paste(im, (0, 84)); return out

# per-frame JPEGs with a burned-in title strip
for slug, name in SHARDS:
    for v, label, _ in VARS:
        for kind, role in (('minimap', 'minimap HUD'), ('mapscreen', 'Bag > MAP')):
            im = Image.open(f'{SHOTS}/{slug}-{v}-{kind}.png').convert('RGB')
            tag = v if v != 'now' else 'TODAY'
            save_jpg(strip(im, f'{tag} · {label if v != "now" else "current map"} · {name} · {role}'), f'{OUT}/{slug}-{v}-{kind}.jpg')
        if v != 'now':
            save_jpg(Image.open(f'{MAPS}/{slug}-{v}.png').convert('RGB'), f'{OUT}/{slug}-{v}-map.jpg', 400_000)

# the board: per shard a row, per variant a column: the minimap at the phone's own pixels, then the MAP screen
COLW, GAP, PAD = 620, 26, 40
W = PAD * 2 + COLW * 3 + GAP * 2
mm_box = (780, 0, 1179, 400)  # the minimap's corner of the 1179 x 2556 frame (iPhone 16 Pro @3)
rows = []
for slug, name in SHARDS:
    cols = []
    for v, label, cap in VARS[:3]:
        hud = Image.open(f'{SHOTS}/{slug}-{v}-minimap.png').convert('RGB')
        mm = hud.crop(mm_box)
        ms = Image.open(f'{SHOTS}/{slug}-{v}-mapscreen.png').convert('RGB')
        ms = ms.resize((COLW, round(ms.height * COLW / ms.width)), Image.LANCZOS)
        h = 150 + mm.height + 20 + ms.height
        c = Image.new('RGB', (COLW, h), BG); d = ImageDraw.Draw(c)
        d.text((0, 0), v, font=font(96, True), fill=CY)
        d.text((84, 14), label, font=font(34, True), fill=FG)
        d.text((86, 62), cap, font=font(21), fill=DIM)
        d.text((0, 118), 'minimap close-up (crop of the HUD frame)', font=font(19), fill=DIM)
        c.paste(mm, ((COLW - mm.width) // 2, 150))
        c.paste(ms, (0, 150 + mm.height + 20))
        cols.append(c)
    rh = max(c.height for c in cols)
    row = Image.new('RGB', (W, rh + 90), BG); d = ImageDraw.Draw(row)
    d.text((PAD, 18), name, font=font(46, True), fill=FG)
    for i, c in enumerate(cols): row.paste(c, (PAD + i * (COLW + GAP), 90))
    rows.append(row)
title_h = 190
H = title_h + sum(r.height for r in rows) + 40 * len(rows) + 60
board = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(board)
d.text((PAD, 34), 'G246 · Which look for the map baked from the world?', font=font(44, True), fill=FG)
d.text((PAD, 104), 'Real orthographic renders of HEAD 46d6962, shown in the real HUD (POIs, YOU arrow, quest card are live).', font=font(22), fill=DIM)
d.text((PAD, 138), 'Fog of war drawn fully explored to judge the look.  Recommended: B (reads at minimap size on both shards).', font=font(22), fill=DIM)
y = title_h
for r in rows:
    board.paste(r, (0, y)); y += r.height + 40
board = board.resize((1600, round(board.height * 1600 / board.width)), Image.LANCZOS)
q = save_jpg(board, f'{OUT}/board.jpg')
print('board', board.size, 'q', q, os.path.getsize(f'{OUT}/board.jpg'))
