"""fanmask.py <capdir>: the fan's exact footprint per mock view from the projected viewmodel triangles (-tris.json, 390x844 CSS px):
leftmost x, top y, share of the frame, centroid; writes <view>-mask.png."""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
cap = sys.argv[1]
res = {}
for v in ['mock-proposal-B', 'mock-A-spawn-look', 'mock-B-quest-start', 'mock-C-hands-fan', 'mock-D-crown-arena']:
    p = os.path.join(cap, v + '-tris.json')
    if not os.path.exists(p): continue
    im = Image.new('L', (390, 844), 0); d = ImageDraw.Draw(im)
    # only the weapon's own meshes (the engine's MeshBasic helper box directly under the viewmodel root is not drawn)
    t = [x for m in json.load(open(p)) if m['path'] != 'Scene/PerspectiveCamera/Group/Mesh/' for x in m['out']]
    for i in range(0, len(t) - 5, 6):
        d.polygon([(t[i], t[i + 1]), (t[i + 2], t[i + 3]), (t[i + 4], t[i + 5])], fill=255)
    m = np.asarray(im) > 127; ys, xs = np.nonzero(m)
    res[v] = dict(left=int(xs.min()), top=int(ys.min()), share=round(100 * m.mean(), 1), cx=int(xs.mean()), cy=int(ys.mean()))
    im.save(os.path.join(cap, v + '-mask.png'))
    print(f"{v:20} left {res[v]['left']:4d}  top {res[v]['top']:4d}  share {res[v]['share']:5.1f}%  centroid ({res[v]['cx']},{res[v]['cy']})")
json.dump(res, open(os.path.join(cap, 'fanmask.json'), 'w'), indent=1)
