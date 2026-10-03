"""mockiou.py <capdir>...: the mockups' fan+hand footprints (hand-traced polygons, 390x844) vs the game's exact mask: left, top,
share and IoU per view."""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
POLY = {
 'mock-C-hands-fan': [(120,547),(137,525),(197,450),(235,425),(270,417),(310,413),(350,412),(387,418),(390,430),(390,710),(360,700),(330,640),(320,665),(310,640),(305,590),(250,588),(120,555)],
 'mock-A-spawn-look': [(240,557),(247,540),(270,512),(300,492),(335,482),(365,480),(390,482),(390,700),(360,700),(340,650),(338,615),(342,602),(240,565)],
 'mock-B-quest-start': [(275,530),(282,515),(310,487),(340,465),(370,455),(390,452),(390,720),(368,720),(360,640),(350,590),(275,535)],
 'mock-proposal-B': [(200,555),(207,545),(220,520),(245,495),(275,480),(305,475),(335,487),(360,510),(377,540),(377,640),(330,625),(300,640),(310,740),(255,740),(250,660),(255,625),(200,560)],
 'mock-D-crown-arena': [(390,560),(335,610),(390,660)],
}
def polymask(p):
    im = Image.new('L', (390, 844), 0); ImageDraw.Draw(im).polygon(p, fill=255); return np.asarray(im) > 127
def stats(m):
    ys, xs = np.nonzero(m); return int(xs.min()), int(ys.min()), round(100 * m.mean(), 1)
rows = {}
for v, p in POLY.items():
    mk = polymask(p); l, t, s = stats(mk); line = f"{v:20} MOCKUP left {l:3d} top {t:3d} share {s:4.1f}%"
    for cap in sys.argv[1:]:
        f = os.path.join(cap, v + '-mask.png')
        if not os.path.exists(f): continue
        g = np.asarray(Image.open(f)) > 127; gl, gt, gs = stats(g); iou = (g & mk).sum() / max(1, (g | mk).sum())
        line += f" | {os.path.basename(cap)} left {gl:3d} top {gt:3d} share {gs:4.1f}% IoU {iou:.2f}"
        rows.setdefault(v, {})[os.path.basename(cap)] = dict(left=gl, top=gt, share=gs, iou=round(float(iou), 3))
    rows.setdefault(v, {})['mockup'] = dict(left=l, top=t, share=s)
    print(line)
json.dump(rows, open(os.path.join(sys.argv[-1], 'mockiou.json'), 'w'), indent=1)
