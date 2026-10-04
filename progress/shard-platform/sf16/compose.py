#!/usr/bin/env python3
"""SF16 M1 board: rows of (today | from its shardfile) per camera, labelled with SSIM; JPEG <= 500 KB."""
import io
import json
import sys
from PIL import Image, ImageDraw, ImageFont

shots = json.load(open(sys.argv[1]))
out = sys.argv[2]
W = 240  # each phone shot scaled to this width
cells = []
for shot in shots:
    pair = [Image.open(shot['today']).convert('RGB'), Image.open(shot['shardfile']).convert('RGB')]
    h = round(pair[0].height * W / pair[0].width)
    cells.append(([image.resize((W, h), Image.LANCZOS) for image in pair], shot))
header, label = 34, 22
cols = 3  # three cameras per board row, each camera a today / shardfile pair
pair_w = W * 2 + 8
rows = (len(cells) + cols - 1) // cols
cell_h = cells[0][0][0].height + label
board = Image.new('RGB', (cols * pair_w + (cols + 1) * 12, header + rows * (cell_h + 12) + 12), (18, 20, 24))
draw = ImageDraw.Draw(board)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16)
    small = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13)
except OSError:
    font = small = ImageFont.load_default()
draw.text((12, 8), 'SF16 M1: template today (left of each pair) vs booted from its shardfile (right), iPhone 16 Pro', fill=(230, 230, 230), font=font)
for i, (pair, shot) in enumerate(cells):
    x = 12 + (i % cols) * (pair_w + 12)
    y = header + (i // cols) * (cell_h + 12)
    draw.text((x, y + 3), f"{shot['name']}  SSIM {shot['ssim']:.3f}", fill=(240, 200, 120), font=small)
    board.paste(pair[0], (x, y + label))
    board.paste(pair[1], (x + W + 8, y + label))
quality = 88
while True:
    buffer = io.BytesIO()
    board.save(buffer, 'JPEG', quality=quality, optimize=True)
    if buffer.tell() <= 500_000 or quality <= 40:
        break
    quality -= 6
open(out, 'wb').write(buffer.getvalue())
print(f'board {board.width}x{board.height} q{quality} {buffer.tell() // 1024} KB')
