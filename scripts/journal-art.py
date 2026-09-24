#!/usr/bin/env python3
"""journal-art.py — ships Pine Hollow's hunter's-journal art (PINE-HOLLOW-REMASTER PH-C5 / PH-C4).

Sources: art/pine-hollow/round-6-journal-sketches/*.jpg (codex image_gen pencil sketches + chalk outlines).
Out:     public/assets/pine-hollow/journal/
  <id>.webp        the plate: paper levelled to white (the page multiplies it onto its own paper), 720 px (places 780 × 520)
  <id>-sil.webp    beasts only: the flat graphite silhouette an unknown page and a ??? neighbour show (alpha)
  chalk.webp       the trophy wall's outline atlas: stag · elk · boar · bear · king, 5 square cells in a row, white on black

  python3 scripts/journal-art.py        (numpy + Pillow; no scipy)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art/pine-hollow/round-6-journal-sketches')
OUT = os.path.join(ROOT, 'public/assets/pine-hollow/journal')
os.makedirs(OUT, exist_ok=True)

BEASTS = ['red-deer', 'white-deer', 'piebald', 'boar', 'black-boar', 'scarback', 'elk', 'pale-elk', 'black-bear', 'brown-bear',
          'grizzled-sow', 'ironhide', 'ghost-stag', 'blackpaw', 'imperial-bull', 'antler-king']
CHALK = ['stag', 'elk', 'boar', 'bear', 'king']


def level(im: Image.Image) -> np.ndarray:
    """RGB float array with the paper (median of a border strip) mapped to white, graphite kept"""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    b = max(8, a.shape[0] // 40)
    border = np.concatenate([a[:b].reshape(-1, 3), a[-b:].reshape(-1, 3), a[:, :b].reshape(-1, 3), a[:, -b:].reshape(-1, 3)])
    paper = np.median(border, axis=0)
    return np.clip(a / paper * 255.0, 0, 255)


def save(a: np.ndarray, path: str, size: tuple[int, int], q: int) -> None:
    im = Image.fromarray(a.astype(np.uint8)).convert('L').resize(size, Image.LANCZOS)  # graphite: the page's CSS warms it
    im.save(path, 'WEBP', quality=q, method=6)
    print(f'{os.path.relpath(path, ROOT)}  {os.path.getsize(path) // 1024} KB')


def fill_small_holes(m: np.ndarray, max_area: int) -> np.ndarray:
    """fill the enclosed background regions smaller than `max_area` px (the fur's hatching gaps, not the gap between the
    legs over the ground shadow — a plain hole-fill turned every beast into a block)"""
    h, w = m.shape
    seen = m.copy()
    out = m.copy()
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0, x0]:
                continue
            stack, region, edge = [(y0, x0)], [], False
            seen[y0, x0] = True
            while stack:
                y, x = stack.pop()
                region.append((y, x))
                if y in (0, h - 1) or x in (0, w - 1):
                    edge = True
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if not edge and len(region) < max_area:
                for y, x in region:
                    out[y, x] = True
    return out


def silhouette(a: np.ndarray, path: str, size: int) -> None:
    """the animal's shape: graphite darker than the paper, closed a little, small holes filled; a soft grey fill"""
    dark = 255.0 - a.mean(axis=2)
    small = 360
    m = Image.fromarray(((dark > 22) * 255).astype(np.uint8)).resize((small, small), Image.BILINEAR).point(lambda v: 255 if v > 50 else 0)
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    filled = fill_small_holes(np.asarray(m) > 0, int(small * small * 0.012))
    alpha = Image.fromarray((filled * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    alpha = alpha.resize((size, size), Image.BICUBIC).filter(ImageFilter.GaussianBlur(size / 300))  # soft graphite edge, no stair steps
    rgba = Image.new('RGBA', (size, size), (84, 77, 66, 0))
    rgba.putalpha(alpha)
    rgba.save(path, 'WEBP', quality=70, method=6)
    print(f'{os.path.relpath(path, ROOT)}  {os.path.getsize(path) // 1024} KB')


for k in BEASTS:
    a = level(Image.open(os.path.join(SRC, f'{k}.jpg')))
    save(a, os.path.join(OUT, f'{k}.webp'), (720, 720), 62)
    silhouette(a, os.path.join(OUT, f'{k}-sil.webp'), 540)

for f in sorted(os.listdir(SRC)):
    if f.startswith('place-') and f.endswith('.jpg'):
        a = level(Image.open(os.path.join(SRC, f)))
        save(a, os.path.join(OUT, f.replace('.jpg', '.webp')), (780, 520), 50)

CELL = 384
atlas = Image.new('L', (CELL * len(CHALK), CELL), 0)
for i, k in enumerate(CHALK):
    g = Image.open(os.path.join(SRC, f'chalk-{k}.jpg')).convert('L')
    g = g.point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 1.35)))  # the black stays black: it is the alpha
    atlas.paste(g.resize((CELL, CELL), Image.LANCZOS), (i * CELL, 0))
atlas.save(os.path.join(OUT, 'chalk.webp'), 'WEBP', quality=75, method=6)
print(f'chalk.webp  {os.path.getsize(os.path.join(OUT, "chalk.webp")) // 1024} KB')
