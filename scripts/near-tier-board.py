#!/usr/bin/env python3
"""Label real near-tier / hero captures with each cell's drawn tier and compose the boards; no image synthesis.

python3 scripts/near-tier-board.py <capture directory> <art directory> [<round label, e.g. 5 or 6b>]

Reads capture.json from scripts/capture-main-menu-hero.mjs (round 'near', '5' or '6'). Every panel gets a label band burned
in: what it is (A / B, the view, the device or aspect) and each cell's real tier from that frame's readout
(grid.state().cells[].shows: entered, near, far proxy, tiles). Writes every labelled panel as JPEG (<= 500 KB) and:
  round 'near': board-desktop.jpg and board-iphone.jpg (A beside B beside C when shot, one row a view);
  round '5'/'6': board.jpg (each pose, square beside landscape).
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

NAMES = {'pine-hollow': 'Pine', '_template': 'template', 'driftwood-isle': 'Driftwood', 'nalati-grasslands': 'Nalati',
         'sunscar-dunes': 'Signal', 'far-reach': 'Sky Reach', 'blender-template': 'Blender tmpl',
         'pastel-plain': 'Pastel', 'ink-cel-valley': 'Ink-cel'}
TIERS = [('playing', 'entered'), ('frozen', 'home (frozen)'), ('near', 'NEAR'), ('tiles', 'L1 tiles'),
         ('far proxy', 'far proxy'), ('loading', 'loading')]
VIEWS = {'road-driftwood': 'road view toward Driftwood', 'road-pine': 'road view toward Pine',
         'road-nalati': 'road view toward Nalati', 'road-template': 'road view toward the template',
         'SQ-NA-a': 'shipped hero SQ-NA-a (over Nalati, toward Pine)',
         'SQ-NW-b': 'shipped hero SQ-NW-b (over Nalati, toward Driftwood)',
         'SQ-NE-b': 'shipped hero SQ-NE-b (over Nalati’s far edge, toward Driftwood)'}
MODES = {'A': ('today (far proxy)', (255, 196, 64)), 'B': ('near tier (4 nearest)', (120, 210, 255)),
         'C': ('every cell near (capture-only)', (150, 240, 170))}
AMBER, CYAN, WHITE, GREY, INK = (255, 196, 64), (120, 210, 255), (240, 240, 240), (170, 176, 186), (16, 18, 24)


def font(size):
    for path in ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise RuntimeError('A readable label font is required')


def jpeg(image, path):
    for _ in range(8):
        for quality in range(88, 59, -4):
            image.save(path, 'JPEG', quality=quality, optimize=True)
            if path.stat().st_size <= 500000:
                return
        image = image.resize((round(image.width * 0.85), round(image.height * 0.85)), Image.Resampling.LANCZOS)
    raise RuntimeError(f'JPEG exceeds 500 KB: {path}')


def tier_lines(row):
    """Each cell's drawn tier, grouped: 'NEAR: Nalati, Pine · far proxy: …', from the frame's own readout."""
    cells, near = row['frame']['cells'], row['frame'].get('near') or {}
    distance = {c['instance']: c.get('distance') for c in near.get('cells', [])}
    groups = []
    for key, label in TIERS:
        names = []
        for c in cells:
            if c['shows'] != key:
                continue
            name = NAMES.get(c['slug'], c['slug'])
            drawn = c.get('drawn') or {}
            if key == 'near' and distance.get(c['instance']) is not None:
                name += f" {distance[c['instance']]} m"
            if key in ('near', 'far proxy', 'tiles') and drawn.get('l1', 0) + drawn.get('l0', 0) > 0:
                name += f" +{drawn.get('l1', 0)} L1/{drawn.get('l0', 0)} L0"
            names.append(name)
        if names:
            groups.append((label, ', '.join(names)))
    return groups


def view_name(row):
    stem = Path(row['file']).stem
    for key, label in VIEWS.items():
        if key in stem:
            return label
    return row.get('name', row['id'])


def label(image, title, colour, groups, width):
    """A band above the capture: the title, then one line a tier group, wrapped to the panel width."""
    scale = max(0.6, width / 1400)
    big, small = font(round(34 * scale)), font(round(26 * scale))
    lines = []
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    for name, cells in groups:
        text = f'{name}: {cells}'
        words, current = text.split(' '), ''
        for word in words:
            trial = f'{current} {word}'.strip()
            if probe.textlength(trial, font=small) > width - 40 * scale and current:
                lines.append(current); current = '   ' + word
            else:
                current = trial
        lines.append(current)
    pad = round(14 * scale)
    band = pad * 2 + round(42 * scale) + len(lines) * round(32 * scale)
    out = Image.new('RGB', (width, band + image.height), INK)
    draw = ImageDraw.Draw(out)
    draw.text((pad, pad), title, font=big, fill=colour)
    y = pad + round(44 * scale)
    for line in lines:
        draw.text((pad, y), line, font=small, fill=CYAN if line.startswith('NEAR') else WHITE if not line.startswith('   ') else GREY)
        y += round(32 * scale)
    out.paste(image, (0, band))
    return out


def board(tiles, columns, heading, sub, path, cell_width):
    rows = [tiles[i:i + columns] for i in range(0, len(tiles), columns)]
    scaled = [[t.resize((cell_width, round(t.height * cell_width / t.width)), Image.Resampling.LANCZOS) for t in r] for r in rows]
    gap, top = 12, 110
    height = top + sum(max(t.height for t in r) + gap for r in scaled)
    out = Image.new('RGB', (columns * cell_width + (columns + 1) * gap, height), INK)
    draw = ImageDraw.Draw(out)
    draw.text((gap, 16), heading, font=font(40), fill=WHITE)
    draw.text((gap, 64), sub, font=font(26), fill=GREY)
    y = top
    for r in scaled:
        for i, t in enumerate(r):
            out.paste(t, (gap + i * (cell_width + gap), y))
        y += max(t.height for t in r) + gap
    jpeg(out, path)


def main(source, output, tag=None):
    source, output = Path(source), Path(output)
    output.mkdir(parents=True, exist_ok=True)
    report = json.loads((source / 'capture.json').read_text())
    shots = [s for s in report['shots'] if s.get('complete')]
    labelled = {}
    for row in shots:
        image = Image.open(source / row['file']).convert('RGB')
        if report['round'] == 'near':
            ab, device = row['session'].split('-')
            title = (f"{ab} · {MODES[ab][0]} · {view_name(row)} · "
                     f"{'iPhone 16 Pro' if device == 'iphone' else 'desktop'}")
            colour = MODES[ab][1]
        else:
            aspect = 'square, phone band' if row['id'].startswith('SQ') else 'landscape, desktop'
            where = "over Nalati's far edge" if report['round'] == '6' else 'over Nalati'
            title = (f"{row['id']} · {where}, to Driftwood · {round(row['eye']['y'])} m, "
                     f"{row['downDegrees']:.0f}° down · {aspect}")
            colour = CYAN
        if image.width > 1920:
            image = image.resize((1920, round(image.height * 1920 / image.width)), Image.Resampling.LANCZOS)
        tile = label(image, title, colour, tier_lines(row), image.width)
        name = Path(row['file']).stem + '.jpg'
        jpeg(tile, output / name)
        row['labelledFile'] = name
        labelled[row['file']] = tile
    if report['round'] == 'near':
        modes = [ab for ab in MODES if any(s['session'] == f'{ab}-desktop' or s['session'] == f'{ab}-iphone' for s in shots)]
        for device in ('desktop', 'iphone'):
            order = []
            for view in VIEWS:
                for ab in modes:
                    match = [s for s in shots if s['session'] == f'{ab}-{device}' and view in Path(s['file']).stem]
                    order += [labelled[m['file']] for m in match]
            board(order, len(modes), f"Near tier · round {tag or '4'} · {' / '.join(modes)} · {device}",
                  ' · '.join(f'{ab} {MODES[ab][0]}' for ab in modes) + ' · real build · each label lists every cell’s drawn tier',
                  output / f'board-{device}.jpg', 900 if device == 'desktop' else 560)
    else:
        order, six = [], report['round'] == '6'
        for variant in ('a', 'b', 'c'):
            for aspect in ('SQ', 'LS'):
                order += [labelled[s['file']] for s in shots if s['id'] == f"{aspect}-{'NE' if six else 'NW'}-{variant}"]
        board(order, 2, f"Main-menu hero · round {tag or '6'} · above Nalati’s far edge, toward Driftwood" if six else 'Main-menu hero · round 5 · above Nalati, toward Driftwood',
              ('Neighbour detail C (every cell near) · Nalati entered · phone-1x lens · each label lists every cell’s drawn tier' if six
               else 'Neighbour detail B · Nalati entered · phone-1x lens · each label lists every cell’s drawn tier'),
              output / 'board.jpg', 900)
    (output / 'capture.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else None)
