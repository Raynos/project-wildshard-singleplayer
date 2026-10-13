#!/usr/bin/env python3
"""Label actual G332 canvas captures and compose a portrait board; no image synthesis.

python3 scripts/main-menu-hero-board.py <capture directory> <art directory>
Every delivered JPEG includes the question, candidate letter and shard/pose.

Round 3 (capture.json round 'landscape', G336): each desktop capture keeps its full size with a label band on top
(id, name, height, down angle, heading, which cell sits where); then, given the menu shot of the pick,
  ... <captures> <art> --menu=<desktop menu png> --phone=<phone menu png> --pick=<id> --why=<one line>
also writes a 3 x 2 landscape board.jpg (the five 2560 x 1440 candidates plus the pick on the real desktop menu)
and menu-board.jpg (the pick on the real menu, desktop landscape beside iPhone portrait).

Square round (capture.json round 'square', G344): ... <captures> <art> --pick=<square id> --pick-landscape=<id>
  --why=<one line> --phone-today=<phone png> --phone-pick=<phone png> --reference=<today's L-b jpg>
labels every capture with its 1x lens and writes a portrait board.jpg (squares, landscapes, the pick on the phone).

Round 4 (capture.json round '4', G343): ... <captures> <art> --pick=<square id> --pick-landscape=<id> --why=<one line>
  --phone-today=<phone png> --phone-pick=<phone png>: every capture labelled, and a portrait board.jpg by spot.
"""
import json
import math
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
    # progress/ and art/ images stay <= 500 KB: lower the quality, then (a tall board) the size
    for _ in range(6):
        for quality in range(88, 59, -4):
            image.save(path, 'JPEG', quality=quality, optimize=True)
            if path.stat().st_size <= 500000:
                return
        image = image.resize((round(image.width * 0.85), round(image.height * 0.85)), Image.Resampling.LANCZOS)
    raise RuntimeError(f'JPEG exceeds 500 KB: {path}')


def fit(image, width, height):
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    return copy


CELL_NAMES = {'pine-hollow': 'Pine', 'driftwood-isle': 'Driftwood', 'nalati-grasslands': 'Nalati',
              'template-2': 'template-2'}


def placement_text(row):
    parts = []
    for cell in row['placement']:
        where = f"{cell['side']}, {cell['depth']}" if cell['side'] != 'centre' else cell['depth']
        parts.append(f"{CELL_NAMES.get(cell['instance'], cell['instance'])} ({where})")
    return 'left to right: ' + ' · '.join(parts)


def landscape(source, output, report, menu, pick, why, phone=None):
    rows = report['shots']
    sessions = sorted({row['session'] for row in rows}, key=lambda key: -int(key.split('x')[0]))
    if len(rows) != 10 or len(sessions) != 2 or not all(row['complete'] for row in rows):
        raise RuntimeError('10 complete desktop captures (5 poses x 2 resolutions) are required')
    output.mkdir(parents=True, exist_ok=True)
    pin = report['version']['build']
    for row in rows:
        world = Image.open(source / row['file']).convert('RGB')
        width, height = world.size
        if f'{width}x{height}' != row['session']:
            raise RuntimeError(f"{row['file']} is {width}x{height}, not {row['session']}")
        band = round(width * 0.06)
        panel = Image.new('RGB', (width, height + band), '#101820')
        panel.paste(world, (0, band))
        label = ImageDraw.Draw(panel)
        big, small = font(round(band * 0.36)), font(round(band * 0.22))
        label.text((round(band * 0.2), round(band * 0.1)), f"{row['id']} · {row['name']}", font=big, fill='white')
        right = f"{row['session'].replace('x', ' × ')} desktop · real engine, canvas only · {pin}"
        label.text((width - round(band * 0.2) - label.textlength(right, font=small), round(band * 0.17)), right,
                   font=small, fill='#a9cce0')
        detail = (f"{row['eye']['y']:g} m high · {row['downDegrees']:.1f}° down · heading {row['headingDegrees']:g}° · "
                  f"roundabout centred · {placement_text(row)}")
        if label.textlength(detail, font=small) > width - band * 0.4:
            raise RuntimeError(f"label overflows {row['file']}")
        label.text((round(band * 0.2), round(band * 0.6)), detail, font=small, fill='#a9cce0')
        filename = f"{row['id']}-{row['session']}.jpg"
        jpeg(panel, output / filename)
        row['labelledFile'] = filename
    if menu is not None:
        large = [row for row in rows if row['session'] == sessions[0]]
        if pick not in [row['id'] for row in large]:
            raise RuntimeError(f'--pick must be one of {[row["id"] for row in large]}')
        margin, gap, cell_w = 24, 20, 770
        cell_h, head = round(cell_w * 9 / 16), 70
        top = 170
        width = margin * 2 + cell_w * 3 + gap * 2
        board = Image.new('RGB', (width, top + 2 * (head + cell_h + 28) + 60), '#101820')
        draw = ImageDraw.Draw(board)
        draw.text((margin, 22), 'MAIN MENU HERO · ROUND 3 · DESKTOP LANDSCAPE', font=font(44), fill='white')
        draw.text((margin, 84), f'Recommended: {pick}. {why}', font=font(28), fill='#ffd27a')
        draw.text((margin, 124), 'All aimed at the real roundabout cross.0.0; four shards should read left to right.',
                  font=font(24), fill='#a9cce0')
        tiles = [(row, Image.open(source / row['file']).convert('RGB')) for row in large]
        tiles.append((None, Image.open(menu).convert('RGB')))
        for index, (row, image) in enumerate(tiles):
            x = margin + (index % 3) * (cell_w + gap)
            y = top + (index // 3) * (head + cell_h + 28)
            thumb = image.resize((cell_w, cell_h), Image.Resampling.LANCZOS) if abs(image.width / image.height - 16 / 9) < 0.01 \
                else fit(image, cell_w, cell_h)
            board.paste(thumb, (x + (cell_w - thumb.width) // 2, y + head))
            if row is None:
                title, detail, colour = f'{pick} on the real desktop menu', \
                    f"{Image.open(menu).width} × {Image.open(menu).height} · local build {pin} · hero image routed", '#ffd27a'
            else:
                title = f"{row['id']} · {row['name']}" + ('  · RECOMMENDED' if row['id'] == pick else '')
                detail = f"{row['eye']['y']:g} m · {row['downDegrees']:.1f}° down · heading {row['headingDegrees']:g}°"
                colour = '#ffd27a' if row['id'] == pick else 'white'
            draw.text((x, y + 4), title, font=font(27), fill=colour)
            draw.text((x, y + 38), detail, font=font(22), fill='#a9cce0')
            if row is not None and row['id'] == pick:
                draw.rectangle((x - 5, y + head - 5, x + cell_w + 4, y + head + cell_h + 4), outline='#ffd27a', width=5)
        draw.text((margin, board.height - 46), f'{pin} · 2560 × 1440 desktop tier, DSF 1 · no HUD or weapon · '
                  'shipped hero unchanged', font=font(24), fill='white')
        jpeg(board, output / 'board.jpg')
    if menu is not None and phone is not None:
        # G336: the pick on the real menu in landscape and portrait, side by side at one height.
        desk, hand = Image.open(menu).convert('RGB'), Image.open(phone).convert('RGB')
        body = 1100
        desk = desk.resize((round(desk.width * body / desk.height), body), Image.Resampling.LANCZOS)
        hand = hand.resize((round(hand.width * body / hand.height), body), Image.Resampling.LANCZOS)
        sheet = Image.new('RGB', (desk.width + hand.width + 72, body + 210), '#101820')
        draw = ImageDraw.Draw(sheet)
        draw.text((24, 22), f'{pick} AS THE MAIN-MENU HERO · REAL MENU, LOCAL BUILD {pin}', font=font(40), fill='white')
        draw.text((24, 80), 'Desktop landscape 1920 × 1080', font=font(28), fill='#ffd27a')
        draw.text((desk.width + 48, 80), 'iPhone 16 Pro portrait', font=font(28), fill='#ffd27a')
        sheet.paste(desk, (24, 130))
        sheet.paste(hand, (desk.width + 48, 130))
        draw.text((24, body + 156), 'Only the hero image request is answered with the capture; menu code and layout unchanged.',
                  font=font(24), fill='#a9cce0')
        jpeg(sheet, output / 'menu-board.jpg')
    (output / 'capture.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'{len(rows)} labelled JPEGs{" and board" if menu else ""}: {output}')


def hfov(vfov, aspect):
    return 2 * math.degrees(math.atan(math.tan(math.radians(vfov) / 2) * aspect))


def label_full(source, output, rows, report):
    """Each capture at full size under a three-line label band (name; lens and pose; resolution and build)."""
    output.mkdir(parents=True, exist_ok=True)
    pin = report['version']['build']
    for row in rows:
        world = Image.open(source / row['file']).convert('RGB')
        width, height = world.size
        if f'{width}x{height}' != row['session']:
            raise RuntimeError(f"{row['file']} is {width}x{height}, not {row['session']}")
        # Three lines (name; lens and pose; resolution and build), so a long name never runs into the build.
        unit = round(width * (0.075 if width == height else 0.06))
        band = round(unit * 1.2)
        panel = Image.new('RGB', (width, height + band), '#101820')
        panel.paste(world, (0, band))
        label = ImageDraw.Draw(panel)
        big, small = font(round(unit * 0.34)), font(round(unit * 0.2))
        aspect = width / height
        label.text((round(unit * 0.2), round(unit * 0.08)), f"{row['id']} · {row['name']}", font=big, fill='white')
        slant = math.dist([row['eye'][k] for k in 'xyz'], [row['target'][k] for k in 'xyz'])
        detail = (f"1x lens: {row['fovDegrees']:g}° vertical, {hfov(row['fovDegrees'], aspect):.0f}° across · "
                  f"{row['eye']['y']:g} m high · {row['downDegrees']:.0f}° down · {slant:.0f} m from the roundabout · "
                  f"heading {row['headingDegrees']:g}°")
        if label.textlength(detail, font=small) > width - unit * 0.4:
            raise RuntimeError(f"label overflows {row['file']}")
        label.text((round(unit * 0.2), round(unit * 0.54)), detail, font=small, fill='#a9cce0')
        label.text((round(unit * 0.2), round(unit * 0.84)), f"{width} × {height} · real engine, canvas only · {pin}",
                   font=small, fill='#7f9fb3')
        filename = f"{row['id']}-{row['session']}.jpg"
        jpeg(panel, output / filename)
        row['labelledFile'] = filename
    return pin


def square(source, output, report, options):
    """G344: the phone-1x round. Each capture keeps its full size under a label band (id, lens, height, angle,
    distance, resolution, build); board.jpg is portrait: the square picks, the landscape picks, then the recommended
    square in the real phone layout beside today's, with today's L-b for its lens."""
    rows = report['shots']
    if not rows or not all(row['complete'] for row in rows):
        raise RuntimeError('every square-round capture must be complete')
    pin = label_full(source, output, rows, report)
    pick, pick_wide, why = options['pick'], options['pick-landscape'], options['why']
    sizes = {row['session'] for row in rows}
    big_square = max((s for s in sizes if s.split('x')[0] == s.split('x')[1]), key=lambda s: int(s.split('x')[0]))
    big_wide = max((s for s in sizes if s.split('x')[0] != s.split('x')[1]), key=lambda s: int(s.split('x')[0]))
    squares = [row for row in rows if row['session'] == big_square]
    wides = [row for row in rows if row['session'] == big_wide]
    if pick not in [row['id'] for row in squares] or pick_wide not in [row['id'] for row in wides]:
        raise RuntimeError('--pick must be a square id and --pick-landscape a landscape id')
    margin, gap, cell = 30, 24, 560
    width = margin * 2 + cell * 3 + gap * 2
    phone_h, head = 860, 92
    wide_h = round(cell * 9 / 16)
    heights = [250, 64 + head + cell + 30, 64 + head + wide_h + 30, 64 + head + phone_h + 30, 70]
    board = Image.new('RGB', (width, sum(heights)), '#101820')
    draw = ImageDraw.Draw(board)
    draw.text((margin, 24), 'MAIN MENU HERO · L-b AT A PHONE-1x LENS (G344)', font=font(46), fill='white')
    draw.text((margin, 90), 'Today\'s L-b is shot at the game\'s 72° vertical (104° across): Jake: "0.5x zoom … too fisheye".',
              font=font(25), fill='#a9cce0')
    draw.text((margin, 128), 'Same roundabout, same heading; the camera steps back along L-b\'s line at a 1x lens.',
              font=font(25), fill='#a9cce0')
    draw.text((margin, 176), f'Recommended: {pick} (square) and {pick_wide} (landscape). {why}', font=font(27), fill='#ffd27a')

    def tile(x, y, image, w, h, title, detail, chosen):
        thumb = image.resize((w, h), Image.Resampling.LANCZOS) if abs(image.width / image.height - w / h) < 0.01 \
            else fit(image, w, h)
        board.paste(thumb, (x + (w - thumb.width) // 2, y + head))
        draw.text((x, y + 6), title, font=font(27), fill='#ffd27a' if chosen else 'white')
        draw.text((x, y + 46), detail, font=font(21), fill='#a9cce0')
        if chosen:
            draw.rectangle((x - 5, y + head - 5, x + w + 4, y + head + thumb.height + 4), outline='#ffd27a', width=5)

    def lens(row):
        a = int(row['session'].split('x')[0]) / int(row['session'].split('x')[1])
        slant = math.dist([row['eye'][k] for k in 'xyz'], [row['target'][k] for k in 'xyz'])
        return (f"{row['fovDegrees']:g}° v / {hfov(row['fovDegrees'], a):.0f}° across · {row['eye']['y']:g} m · "
                f"{row['downDegrees']:.0f}° down · {slant:.0f} m out")

    y = heights[0]
    for title, group, h, chosen in [('SQUARE · the portrait centre band (G341 B)', squares, cell, pick),
                                    ('LANDSCAPE · desktop (G341 A)', wides, wide_h, pick_wide)]:
        draw.text((margin, y + 8), title, font=font(32), fill='white')
        for index, row in enumerate(group):
            x = margin + index * (cell + gap)
            tile(x, y + 64, Image.open(source / row['file']).convert('RGB'), cell, h,
                 f"{row['id']} · {row['name']}" + ('  · PICK' if row['id'] == chosen else ''), lens(row), row['id'] == chosen)
        y += 64 + head + h + 30
    draw.text((margin, y + 8), 'ON THE PHONE · iPhone 16 Pro portrait, real menu, Developer off', font=font(32), fill='white')
    today, routed, reference = (Image.open(options[k]).convert('RGB') for k in ('phone-today', 'phone-pick', 'reference'))
    phone_w = round(phone_h * today.width / today.height)
    tile(margin, y + 64, today, phone_w, phone_h, 'Today: L-b band', '72° v / 104° across', False)
    tile(margin + phone_w + gap, y + 64, routed, phone_w, phone_h, f'{pick} band', 'routed as the hero image', True)
    ref_x = margin + 2 * (phone_w + gap)
    ref_w = width - margin - ref_x
    tile(ref_x, y + 64, reference, ref_w, round(ref_w * reference.height / reference.width),
         "Today's L-b (round 3), for the lens", '135 m · 32° down · 254 m out · 72° v / 104° across', False)
    draw.text((margin, board.height - 50), f'{pin} · desktop tier, DSF 1 · no HUD or weapon · capture lens only, '
              'CAMERA_FOV unchanged · shipped hero unchanged', font=font(23), fill='white')
    jpeg(board, output / 'board.jpg')
    (output / 'capture.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'{len(rows)} labelled JPEGs and board: {output}')


def round4(source, output, report, options):
    """G343: hero round 4, the camera over Driftwood, Nalati and Pine (never the template) with the near tier on. Every
    capture labelled at full size; board.jpg is portrait: a row of squares and a row of landscapes per spot, then the
    recommended square in the real phone layout (G341 B) beside today's SQ-c."""
    rows = report['shots']
    if not rows or not all(row['complete'] for row in rows):
        raise RuntimeError('every round-4 capture must be complete')
    pin = label_full(source, output, rows, report)
    pick, pick_wide, why = options['pick'], options['pick-landscape'], options['why']
    squares = {row['id']: row for row in rows if row['session'] == '2048x2048'}
    wides = {row['id']: row for row in rows if row['session'] == '2560x1440'}
    if pick not in squares or pick_wide not in wides:
        raise RuntimeError('--pick must be a square id and --pick-landscape a landscape id')
    spots = [('DW', 'ABOVE DRIFTWOOD'), ('NA', 'ABOVE NALATI'), ('PH', 'ABOVE PINE')]
    margin, gap, cell, head = 30, 24, 560, 92
    width = margin * 2 + cell * 3 + gap * 2
    wide_h, phone_h = round(cell * 9 / 16), 1000
    spot_h = 64 + (head + cell + 20) + (head + wide_h + 30)
    heights = [250, spot_h * 3, 64 + head + phone_h + 30, 70]
    board = Image.new('RGB', (width, sum(heights)), '#101820')
    draw = ImageDraw.Draw(board)
    draw.text((margin, 24), 'MAIN MENU HERO · ROUND 4 · ABOVE THE SHARDS (G343)', font=font(46), fill='white')
    draw.text((margin, 90), 'The camera stands over Driftwood, Nalati or Pine (never the template), aimed across the roundabout,',
              font=font(25), fill='#a9cce0')
    entered = all(row.get('entered') is not None for row in rows)
    draw.text((margin, 128), ('the cell under the camera entered (its own runtime), the others near tier B; ' if entered
                              else 'with the near-placeholder tier on (B, shipped by G385); ')
              + 'phone-1x lens: square 62°, landscape 70° across.', font=font(25), fill='#a9cce0')
    draw.text((margin, 176), f'Recommended: {pick} (square) and {pick_wide} (landscape). {why}', font=font(27), fill='#ffd27a')

    def tile(x, y, image, w, h, title, detail, chosen):
        thumb = image.resize((w, h), Image.Resampling.LANCZOS) if abs(image.width / image.height - w / h) < 0.01 \
            else fit(image, w, h)
        board.paste(thumb, (x + (w - thumb.width) // 2, y + head))
        draw.text((x, y + 6), title, font=font(27), fill='#ffd27a' if chosen else 'white')
        draw.text((x, y + 46), detail, font=font(21), fill='#a9cce0')
        if chosen:
            draw.rectangle((x - 5, y + head - 5, x + w + 4, y + head + thumb.height + 4), outline='#ffd27a', width=5)

    def lens(row):
        slant = math.dist([row['eye'][k] for k in 'xyz'], [row['target'][k] for k in 'xyz'])
        return f"{row['eye']['y']:g} m high · {row['downDegrees']:.0f}° down · {slant:.0f} m from the roundabout"

    y = heights[0]
    for code, title in spots:
        draw.text((margin, y + 8), title, font=font(34), fill='white')
        y += 64
        for group, prefix, h, chosen in [(squares, 'SQ', cell, pick), (wides, 'LS', wide_h, pick_wide)]:
            for index, variant in enumerate('abc'):
                row = group[f'{prefix}-{code}-{variant}']
                tile(margin + index * (cell + gap), y, Image.open(source / row['file']).convert('RGB'), cell, h,
                     f"{row['id']} · {row['name'].split(', ', 1)[-1]}" + ('  · PICK' if row['id'] == chosen else ''), lens(row), row['id'] == chosen)
            y += head + h + (20 if prefix == 'SQ' else 30)
    draw.text((margin, y + 8), 'ON THE PHONE · iPhone 16 Pro portrait, real menu (G341 B), Developer off', font=font(32), fill='white')
    today, routed = (Image.open(options[k]).convert('RGB') for k in ('phone-today', 'phone-pick'))
    phone_w = round(phone_h * today.width / today.height)
    tile(margin, y + 64, today, phone_w, phone_h, 'Today: SQ-c band', 'interim hero (G346)', False)
    tile(margin + phone_w + gap, y + 64, routed, phone_w, phone_h, f'{pick} band', 'routed as the square hero image', True)
    draw.text((margin, board.height - 50), f'{pin} · desktop tier, DSF 1 · near tier B · no HUD or weapon · capture lens only, '
              'shipped hero unchanged', font=font(23), fill='white')
    jpeg(board, output / 'board.jpg')
    (output / 'capture.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'{len(rows)} labelled JPEGs and board: {output}')


def main(source, output, menu=None, pick=None, why='', phone=None, options=None):
    source, output = Path(source), Path(output)
    report = json.loads((source / 'capture.json').read_text())
    if report.get('round') == '4':
        round4(source, output, report, options or {})
        return
    if report.get('round') == 'square':
        square(source, output, report, options or {})
        return
    if report.get('round') == 'landscape':
        landscape(source, output, report, menu, pick, why, phone)
        return
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
    positional = [arg for arg in sys.argv[1:] if not arg.startswith('--')]
    options = dict(arg[2:].split('=', 1) for arg in sys.argv[1:] if arg.startswith('--'))
    known = {'menu', 'phone', 'pick', 'why', 'pick-landscape', 'phone-today', 'phone-pick', 'reference'}
    if len(positional) != 2 or not set(options) <= known:
        raise SystemExit('usage: main-menu-hero-board.py <captures> <art folder> [--menu=<png> --phone=<png> --pick=<id> --why=<text>]\n'
                         '  square round: --pick=<square id> --pick-landscape=<id> --why=<text> --phone-today=<png> '
                         '--phone-pick=<png> --reference=<L-b jpg>')
    main(*positional, menu=options.get('menu'), pick=options.get('pick'), why=options.get('why', ''), phone=options.get('phone'),
         options=options)
