#!/usr/bin/env python3
"""cards.py — transparent 1080x1920 text overlays for the progress video."""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cards')
os.makedirs(P, exist_ok=True)
W, H = 1080, 1920
TTC = '/System/Library/Fonts/Avenir Next Condensed.ttc'

def font(size, style):
    for i in range(12):
        try:
            f = ImageFont.truetype(TTC, size, index=i)
        except OSError:
            break
        if f.getname()[1] == style:
            return f
    return ImageFont.truetype(TTC, size)

def text(d, xy, s, f, fill, anchor='la', spacing=0):
    if spacing:
        x, y = xy
        for ch in s:
            d.text((x, y), ch, font=f, fill=fill, anchor=anchor)
            x += f.getlength(ch) + spacing
    else:
        d.text(xy, s, font=f, fill=fill, anchor=anchor)

def shadowed(draw_fn, blur=14, alpha=170, scrim=None):
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if scrim:
        g = Image.new('L', (1, H))
        for y in range(H):
            g.putpixel((0, y), int(scrim(y / H)))
        base.paste(Image.new('RGBA', (W, H), (0, 0, 0, 255)), (0, 0), g.resize((W, H)))
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(sh), (0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    fg = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(fg), None)
    return Image.alpha_composite(Image.alpha_composite(base, sh), fg)

GOLD = (255, 196, 92, 255)
WHITE = (255, 255, 255, 255)
SOFT = (235, 238, 245, 235)

def chapter(name, big, date, lines):
    fb, fd, fl = font(190, 'Heavy'), font(46, 'Demi Bold'), font(52, 'Medium')
    def draw(d, c):
        text(d, (84, 150), date.upper(), fd, c or GOLD, spacing=6)
        text(d, (78, 200), big, fb, c or WHITE)
        for i, l in enumerate(lines):
            text(d, (86, 420 + i * 66), l, fl, c or SOFT)
    shadowed(draw, blur=10, alpha=235, scrim=lambda u: max(0, 175 * (1 - u / 0.42))).save(f'{P}/{name}.png')

def title():
    f1, f2, f3 = font(150, 'Heavy'), font(150, 'Heavy'), font(50, 'Demi Bold')
    def draw(d, c):
        text(d, (W / 2, 760), 'BUILDING', f1, c or WHITE, anchor='mm')
        text(d, (W / 2, 900), 'MY FIRST MMO', f2, c or WHITE, anchor='mm')
        text(d, (W / 2, 1030), 'DAY 1 TO DAY 22', f3, c or GOLD, anchor='mm')
    shadowed(draw, blur=18, alpha=200, scrim=lambda u: 90).save(f'{P}/title.png')

def ending():
    f1, f2, f3 = font(132, 'Heavy'), font(56, 'Demi Bold'), font(60, 'Medium')
    def draw(d, c):
        text(d, (W / 2, 820), 'WILDSHARD', f1, c or WHITE, anchor='mm')
        text(d, (W / 2, 925), '22 DAYS · 6 SHARDS', f2, c or GOLD, anchor='mm')
        text(d, (W / 2, 1010), 'week four is next', f3, c or SOFT, anchor='mm')
    shadowed(draw, blur=18, alpha=200, scrim=lambda u: 110).save(f'{P}/end.png')

def quad_labels():
    f = font(64, 'Heavy')
    def draw(d, c):
        for (x, y), s in zip([(30, 40), (570, 40), (30, 1000), (570, 1000)], ['DAY 1', 'DAY 8', 'DAY 15', 'DAY 22']):
            text(d, (x + 18, y), s, f, c or WHITE)
    shadowed(draw, blur=10, alpha=220).save(f'{P}/quad.png')

if __name__ == '__main__':
    title(); ending(); quad_labels()
    chapter('day1', 'DAY 1', '16 Sep 2026', ['Pine Hollow: one forest chunk,', 'a cabin and a crossbow'])
    chapter('week1', 'WEEK 1', 'Day 8 · 23 Sep', ['Driftwood Isle and the Nalati', 'Grasslands join the world'])
    chapter('week2', 'WEEK 2', 'Day 15 · 30 Sep', ['Nine Dragon Stack rises,', 'Pine Hollow is remastered'])
    chapter('week3', 'WEEK 3', 'Day 22 · 7 Oct', ['Sky Reach and Sunscar Dunes:', 'six shards and counting'])
    print(sorted(os.listdir(P)))
