"""mockside.py <capdir> <out.jpg> [title]: the five council mockups (top) over the game's mock-* views (bottom)."""
import json, os, sys
from PIL import Image, ImageDraw
REPO = '/Users/raynos/projects/games/wildshard-singleplayer'
cap, out = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else ''
shots = [s for s in json.load(open(f'{REPO}/art/far-reach/progress/cameras.json'))['shots'] if s['id'].startswith('mock-')]
H = 760; W = int(H * 390 / 844); G = 8; T = 22
sheet = Image.new('RGB', (len(shots) * (W + G) + G, 2 * (H + T) + G + 26), (14, 20, 26))
d = ImageDraw.Draw(sheet)
d.text((G, 6), title, fill=(200, 230, 240))
for i, s in enumerate(shots):
    x = G + i * (W + G)
    for row, path in enumerate([f"{REPO}/{s['mockup']}", os.path.join(cap, s['id'] + '.jpg')]):
        y = 26 + row * (H + T)
        if os.path.exists(path):
            im = Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS)
            sheet.paste(im, (x, y))
        d.text((x + 4, y + H + 4), ('MOCKUP ' if row == 0 else 'GAME ') + s['id'][5:], fill=(160, 220, 240))
sheet.save(out, quality=86)
print(out)
