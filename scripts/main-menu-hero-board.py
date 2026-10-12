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
    aerial = report.get('round') == 'aerial'
    expected = 15 if aerial else 8
    if len(rows) != expected or not all(row['complete'] for row in rows):
        raise RuntimeError(f'{expected} complete engine captures are required')
    output.mkdir(parents=True, exist_ok=True)
    board = Image.new('RGB', (1179, 2556), '#101820')
    draw = ImageDraw.Draw(board)
    title = 'ROUNDABOUT FROM THE SKY' if aerial else 'MAIN MENU HERO — REAL ENGINE'
    draw.text((28, 24), title, font=font(43), fill='white')
    draw.text((28, 81), 'Which real-engine view should be the menu hero?', font=font(30), fill='#a9cce0')
    pin = report['version']['build']
    for index, row in enumerate(rows):
        world = Image.open(source / row['file']).convert('RGB')
        panel = Image.new('RGB', (1179, 2556), '#101820')
        body_top, body_height = (184, 2278) if aerial else (152, 2372)
        image = fit(world, 1179, body_height)
        panel.paste(image, ((1179-image.width)//2, body_top+(body_height-image.height)//2))
        label = ImageDraw.Draw(panel)
        label.text((28, 22), title, font=font(41), fill='white')
        label.text((28, 78), f"{row['id']} · {row['name']}", font=font(34), fill='#a9cce0')
        if aerial:
            detail = f"{row['eye']['y']:g} m high · {row['downDegrees']:.1f}° down · actual road light: dawn"
            label.text((28, 132), detail, font=font(26), fill='#a9cce0')
        label.text((28, 2503), f"{row['mode']} · {pin} · canvas only", font=font(26), fill='white')
        filename = f"{row['id']}-{row['mode']}.jpg"
        jpeg(panel, output / filename)
        row['labelledFile'] = filename
        step, thumb_height = (462, 376) if aerial else (773, 694)
        x, y = 20+(index % 3)*387, 153+(index // 3)*step
        thumb = fit(world, 365, thumb_height)
        board.paste(thumb, (x+(365-thumb.width)//2, y+76+(thumb_height-thumb.height)//2))
        draw.text((x+6, y+5), f"{row['id']} · {row['name']}", font=font(21), fill='white')
        detail = f"{row['eye']['y']:g} m · {row['downDegrees']:.1f}° · grid / dawn" if aerial else row['mode']
        draw.text((x+6, y+33), detail, font=font(21), fill='#a9cce0')
    if not aerial:
        x, y = 794, 1699
        for offset, text in enumerate(['CAPTURE FACTS', 'Real game, no paint-over', 'iPhone 16 Pro portrait', 'Developer ON · muted', 'No HUD · live clock', 'Shipped hero unchanged']):
            draw.text((x+10, y+offset*52), text, font=font(23), fill='white' if offset == 0 else '#a9cce0')
    draw.text((28, 2504), f'{pin} · No HUD{ " or weapon" if aerial else ""} · shipped hero unchanged', font=font(26), fill='white')
    jpeg(board, output / 'board.jpg')
    (output / 'capture.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'{expected} labelled JPEGs and board: {output}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: main-menu-hero-board.py <captures> <art folder>')
    main(*sys.argv[1:])
