#!/usr/bin/env python3
"""SF28 proof board: Jake's picked G87 board (round-19 B) beside the built big item cards in three shard accents."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ART = HERE.parent
PANELS = [
    (ART / 'round-19-ui-kit' / 'B-big-cards-accent.jpg', "JAKE'S PICK · G87 (MOCKUP)"),
    (HERE / 'driftwood-shop-big.jpg', 'DRIFTWOOD · 05 MARIGOLD · SHOP'),
    (HERE / 'pine-pickup.jpg', 'PINE HOLLOW · 08 MOSS · PICKUP'),
    (HERE / 'nalati-pickup.jpg', 'NALATI · 01 EMBER · PICKUP'),
]
W, H, PAD, HEAD = 402, 874, 16, 44
board = Image.new('RGB', (PAD + len(PANELS) * (W + PAD), HEAD + H + PAD), (10, 16, 24))
draw = ImageDraw.Draw(board)
try:
    font = ImageFont.truetype('/System/Library/Fonts/SFNSMono.ttf', 15)
except OSError:
    font = ImageFont.load_default()
for i, (path, label) in enumerate(PANELS):
    img = Image.open(path).convert('RGB')
    img = img.resize((W, round(img.height * W / img.width)))
    if img.height > H:
        img = img.crop((0, 0, W, H))
    x = PAD + i * (W + PAD)
    board.paste(img, (x, HEAD))
    draw.text((x, 14), label, fill=(230, 242, 248), font=font)
board.save(HERE / 'board.jpg', quality=82)
print(HERE / 'board.jpg', board.size)
