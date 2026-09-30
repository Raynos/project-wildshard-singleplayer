# gate_chart.py <gate.json> <out.jpg> — the rig gate as a chart (PIL): joint angles over the scripted sequence with the
# limits, one panel per joint, right arm solid, left arm dashed, events on the time axis
import sys, json
from PIL import Image, ImageDraw, ImageFont
g = json.load(open(sys.argv[1]))
out = sys.argv[2]
F = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 15)
T = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 19)
series = g['series']
t1 = series[-1]['t'] if series else 1
W, PH, L, Rm = 1800, 210, 70, 20
names = ['elbow', 'pronation', 'flexion', 'deviation']
lims = {'elbow': (0, 150), 'pronation': (-75, 75), 'flexion': (-60, 60), 'deviation': (-32, 22)}
H = 60 + len(names) * (PH + 30) + 60
im = Image.new('RGB', (W, H), (16, 18, 24))
d = ImageDraw.Draw(im)
d.text((12, 10), f"rig gate: {g['verdict']} · {g['frames']} frames at 60 Hz · right arm (cyan) / left arm (gold) · grey band = the joint limit", fill=(230, 230, 230), font=T)
X = lambda t: L + (W - L - Rm) * t / t1
for k, nm in enumerate(names):
    y0 = 60 + k * (PH + 30)
    lo, hi = lims[nm]
    vmin, vmax = lo - 20, hi + 20
    Y = lambda v: y0 + PH - (v - vmin) / (vmax - vmin) * PH
    d.rectangle([L, y0, W - Rm, y0 + PH], outline=(60, 64, 74))
    d.rectangle([L, Y(hi), W - Rm, Y(lo)], fill=(28, 32, 40))
    for v in (lo, 0, hi):
        d.line([L, Y(v), W - Rm, Y(v)], fill=(70, 74, 86) if v == 0 else (120, 70, 70))
        d.text((6, Y(v) - 8), f'{v:>4}', fill=(150, 150, 160), font=F)
    d.text((L + 6, y0 + 4), nm + ' (deg)', fill=(200, 210, 220), font=F)
    for side, col in (('R', (90, 220, 255)), ('L', (230, 180, 70))):
        pts = [(X(f['t']), Y(max(vmin, min(vmax, f[side][k])))) for f in series]
        if side == 'L':
            for i in range(0, len(pts) - 1, 2): d.line([pts[i], pts[i + 1]], fill=col, width=2)
        else:
            d.line(pts, fill=col, width=2)
ey = 60 + len(names) * (PH + 30)
for e in g['events']:
    x = X(e['t'])
    d.line([x, 60, x, ey - 20], fill=(55, 58, 66))
    d.text((x + 2, ey - 16 + (hash(e['what']) % 3) * 14), e['what'], fill=(170, 175, 185), font=F)
im.save(out, quality=88)
print('wrote', out)
