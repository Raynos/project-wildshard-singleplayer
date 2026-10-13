#!/usr/bin/env python3
"""board.py <spec.json> <out.jpg>: a labelled BEFORE / AFTER board, iPhone portrait panels, burned-in labels.
spec: {"title": str, "subtitle": str, "notes": [str], "rows": [{"label": str, "before": path, "after": path}]}"""
import json, sys
from PIL import Image, ImageDraw, ImageFont

spec = json.load(open(sys.argv[1]))
PW, PH, GAP, M = (540, 1168, 16, 28) if len(json.load(open(sys.argv[1]))["rows"]) <= 2 else (400, 865, 14, 24)
F = '/System/Library/Fonts/HelveticaNeue.ttc'
big, mid, small = ImageFont.truetype(F, 44, index=1), ImageFont.truetype(F, 30, index=1), ImageFont.truetype(F, 26)
rows = spec['rows']
note_h = 34 * 3 * (len(spec.get('notes', [])) + 1) + 120
W = M * 2 + PW * 2 + GAP
H = M + 60 + 46 + note_h + 20 + len(rows) * (PH + 50 + GAP) + M
img = Image.new('RGB', (W, H), (18, 18, 22))
d = ImageDraw.Draw(img)
y = M
def wrap(text, font, width):
    lines, line = [], ''
    for word in text.split(' '):
        trial = (line + ' ' + word).strip()
        if d.textlength(trial, font=font) <= width: line = trial
        else: lines.append(line); line = word
    return lines + [line]
for line in wrap(spec['title'], big, W - 2 * M):
    d.text((M, y), line, font=big, fill=(240, 236, 228)); y += 56
for line in wrap(spec.get('subtitle', ''), small, W - 2 * M):
    d.text((M, y), line, font=small, fill=(190, 186, 178)); y += 34
y += 8
for n in spec.get('notes', []):
    for line in wrap(n, small, W - 2 * M):
        d.text((M, y), line, font=small, fill=(230, 200, 140)); y += 34
y += 20
for r in rows:
    d.text((M, y), r['label'], font=mid, fill=(240, 236, 228)); y += 50
    tags = spec.get('tags', ['BEFORE · GLSL', 'AFTER · SF59 graph'])
    for i, (key, tag, col) in enumerate((('before', tags[0], (200, 200, 200)), ('after', tags[1], (140, 220, 160)))):
        x = M + i * (PW + GAP)
        p = Image.open(r[key]).convert('RGB').resize((PW, PH), Image.LANCZOS)
        img.paste(p, (x, y))
        d.rectangle((x, y, x + PW, y + 52), fill=(0, 0, 0))
        d.text((x + 14, y + 10), tag, font=mid, fill=col)
    y += PH + GAP
q = 82
while True:
    img.crop((0, 0, W, y + M)).save(sys.argv[2], 'JPEG', quality=q, optimize=True)
    import os
    if os.path.getsize(sys.argv[2]) <= 480_000 or q <= 40: break
    q -= 6
print(sys.argv[2], os.path.getsize(sys.argv[2]), q)
