# SHARD-PLATFORM sp-o288 (W2a): the per-creature before / after board from specimens.mjs's stills.
#   python3 progress/shard-platform/w2a-o288/board.py <shots-dir> <out.jpg> <before-sha> <after-sha> id=Label ...
# Each row is one creature: the Model Explorer still before (public rig GLB with embedded maps) and after (the product's
# image-free rig + separate KTX2 maps), cropped to the specimen, with burned-in labels.
import json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

shots, out, before, after = sys.argv[1:5]
rows = [a.split('=', 1) for a in sys.argv[5:]]
font = lambda n: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', n)
def still(tag, spec):
    im = Image.open(f'{shots}/{tag}-{re.sub(r"[^a-zA-Z0-9-]", "_", spec)}.png').convert('RGB')
    w, h = im.size
    # the specimen sits in the upper canvas above the explorer's bottom sheet
    return im.crop((0, int(h * 0.10), w, int(h * 0.56)))
cw = 520
cells = []
for spec, label in rows:
    b, a = still('before', spec), still('after', spec)
    k = cw / b.width
    b = b.resize((cw, int(b.height * k)), Image.LANCZOS); a = a.resize((cw, int(a.height * k)), Image.LANCZOS)
    cells.append((label, b, a))
ch = cells[0][1].height
head, lab, gap = 120, 44, 8
W = cw * 2 + gap * 3
H = head + len(cells) * (ch + lab + gap) + gap
board = Image.new('RGB', (W, H), (18, 20, 24))
d = ImageDraw.Draw(board)
d.text((gap, 14), os.environ.get('TITLE', 'Pine Hollow creature hulls: before / after the product rigs (W2a, sp-o288)'), font=font(26), fill=(240, 240, 240))
d.text((gap, 50), f'Model Explorer, iPhone 16 Pro portrait, phone tier. LEFT before {before}: ' + os.environ.get('BEFORE', 'public rig GLB, embedded maps.'), font=font(19), fill=(190, 190, 190))
d.text((gap, 78), f'RIGHT after {after}: ' + os.environ.get('AFTER', 'image-free product rig + separate KTX2 base / normal blobs.'), font=font(19), fill=(190, 190, 190))
y = head
for label, b, a in cells:
    d.text((gap, y + 8), f'{label}  |  BEFORE', font=font(24), fill=(255, 210, 120))
    d.text((gap * 2 + cw, y + 8), f'{label}  |  AFTER', font=font(24), fill=(140, 220, 255))
    y += lab
    board.paste(b, (gap, y)); board.paste(a, (gap * 2 + cw, y))
    y += ch + gap
q = 80
while True:
    board.save(out, 'JPEG', quality=q, optimize=True)
    if os.path.getsize(out) <= 480_000 or q <= 40: break
    q -= 5
print(out, board.size, os.path.getsize(out), 'q', q)
