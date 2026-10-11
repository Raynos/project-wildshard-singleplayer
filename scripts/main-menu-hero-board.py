#!/usr/bin/env python3
"""Label actual G332 canvas captures and compose a portrait board; no image synthesis.

python3 scripts/main-menu-hero-board.py <capture directory> <art directory>
Every delivered JPEG includes the question, candidate letter and shard/pose.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def font(size):
    for path in ['/System/Library/Fonts/Supplemental/Arial.ttf',
                 '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise RuntimeError('A readable label font is required')


def jpeg(image, path):
    for quality in range(88, 39, -4):
        image.save(path, 'JPEG', quality=quality, optimize=True)
        if path.stat().st_size <= 500000:
            return
    raise RuntimeError(f'JPEG exceeds 500 KB: {path}')


def fit(image, width, height):
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    return copy


def main(source, output):
    source, output = Path(source), Path(output)
    report = json.loads((source / 'capture.json').read_text())
    rows = report['shots']
    if len(rows) != 8 or not all(row['complete'] for row in rows):
        raise RuntimeError('Eight complete engine captures are required')
    output.mkdir(parents=True, exist_ok=True)
    board = Image.new('RGB', (1179, 2556), '#101820')
    draw = ImageDraw.Draw(board)
    draw.text((28, 24), 'MAIN MENU HERO — REAL ENGINE', font=font(43), fill='white')
    draw.text((28, 81), 'Which view should replace the painted hero?', font=font(30), fill='#a9cce0')
    pin = report['version']['build']
    for index, row in enumerate(rows):
        world = Image.open(source / row['file']).convert('RGB')
        panel = Image.new('RGB', (1179, 2556), '#101820')
        image = fit(world, 1179, 2372)
        panel.paste(image, ((1179-image.width)//2, 152+(2372-image.height)//2))
        label = ImageDraw.Draw(panel)
        label.text((28, 22), 'MAIN MENU HERO — REAL ENGINE', font=font(41), fill='white')
        label.text((28, 78), f"{row['id']} · {row['name']}", font=font(34), fill='#a9cce0')
        label.text((28, 2503), f"{row['mode']} · {pin} · canvas only", font=font(26), fill='white')
        filename = f"{row['id']}-{row['mode']}.jpg"
        jpeg(panel, output / filename)
        row['labelledFile'] = filename
        x, y = 20+(index % 3)*387, 153+(index // 3)*773
        thumb = fit(world, 365, 694)
        board.paste(thumb, (x+(365-thumb.width)//2, y+67+(694-thumb.height)//2))
        draw.text((x+6, y+5), f"{row['id']} · {row['name']}", font=font(21), fill='white')
        draw.text((x+6, y+33), row['mode'], font=font(21), fill='#a9cce0')
    x, y = 794, 1699
    for offset, text in enumerate(['CAPTURE FACTS', 'Real game, no paint-over', 'iPhone 16 Pro portrait', 'Developer ON · muted', 'No HUD · live clock', 'Shipped hero unchanged']):
        draw.text((x+10, y+offset*52), text, font=font(23), fill='white' if offset == 0 else '#a9cce0')
    draw.text((28, 2504), f'{pin} · A–H are candidates, not replacements', font=font(26), fill='white')
    jpeg(board, output / 'board.jpg')
    (output / 'capture.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'Eight labelled JPEGs and board: {output}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: main-menu-hero-board.py <captures> <art folder>')
    main(*sys.argv[1:])
