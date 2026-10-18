#!/usr/bin/env python3
"""Rasterize the deliberately tiny SVG subset emitted by review-driftwood-enemy-rigs.mjs.
Uses installed Pillow only; no browser, external SVG delegate or downloaded package.
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/driftwood-rig-review/rig-contact-sheet.svg')
root = ET.parse(source).getroot()
scale = 2
image = Image.new('RGB', (int(root.attrib['width']) * scale, int(root.attrib['height']) * scale))
draw = ImageDraw.Draw(image)
fonts = {}
for node in root:
    tag = node.tag.rsplit('}', 1)[-1]
    a = node.attrib
    def number(key, default=0):
        return float(a.get(key, default)) * scale
    fill = a.get('fill', '#000000')
    if tag == 'rect':
        x, y = number('x'), number('y')
        box = (x, y, x + number('width'), y + number('height'))
        draw.rounded_rectangle(box, radius=number('rx'), fill=fill)
    elif tag == 'ellipse':
        x, y, rx, ry = number('cx'), number('cy'), number('rx'), number('ry')
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=fill)
    elif tag == 'polygon':
        points = [tuple(float(v) * scale for v in point.split(',')) for point in a['points'].split()]
        draw.polygon(points, fill=fill)
    elif tag == 'text':
        size, bold = int(number('font-size', 16)), a.get('font-weight') == 'bold'
        key = (size, bold)
        if key not in fonts:
            font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
            fonts[key] = ImageFont.truetype(font, size)
        draw.text((number('x'), number('y')), ''.join(node.itertext()), font=fonts[key], fill=fill,
                  anchor='ms' if a.get('text-anchor') == 'middle' else 'ls')
    else:
        raise ValueError(f'Unsupported source-review SVG element: {tag}')
image = image.resize((image.width // scale, image.height // scale), Image.Resampling.LANCZOS)
image.save(source.with_suffix('.png'))
image.save(source.with_suffix('.webp'), quality=84, method=6)
print(source.with_suffix('.webp'))
