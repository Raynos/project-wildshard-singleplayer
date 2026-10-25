#!/usr/bin/env python3
"""A draft chart of Wildshard 1.0: the first hundred shards on the 10 x 10 grid (E505).

Drawn in the Isle of Vaelmora style Jake approved (x.com/xikhar/status/2114455448946700694): parchment frame,
shaded relief, stamped tree dots, letter-spaced serif names, legend, compass and scale bar. Every cell is a 500 m
shard; the 62.5 m gaps carry the 15 m boulevard. The most played shards hold the centre, the quiet and unmaintained
ones drift to the frontier. Every shard here is invented for the draft.

    python3 art/world-map/round-1-draft-100/worldmap.py tmp/world-map/full.png
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else 'tmp/world-map/full.png'
SEED = 1005
C, G = 320, 40            # a 500 m cell and its 62.5 m gap, in pixels (0.64 px per metre)
P = C + G
N = 10
W, H = 4400, 5300
GX0 = (W - (N * C + (N - 1) * G)) // 2
GY0 = 780
HEART = (GX0 + 5 * P - G / 2, GY0 + 5 * P - G / 2)
INK = (58, 44, 34)
PAPER = (238, 228, 202)
FONTS = '/System/Library/Fonts/Supplemental/'


def font(name, size, index=0):
    return ImageFont.truetype(FONTS + name, size, index=index)


# ---------------------------------------------------------------- noise and raster helpers

def up(a, w, h):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((w, h), Image.BICUBIC))


def fbm(rng, n, base=3, octaves=5, pers=0.5):
    out = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        r = base * 2 ** o
        g = rng.random((r + 3, r + 3)).astype(np.float32)
        big = up(g, n + 2 * n // r, n + 2 * n // r)
        k = n // r
        out += amp * big[k:k + n, k:k + n]
        tot += amp
        amp *= pers
    out /= tot
    lo, hi = np.percentile(out, 1), np.percentile(out, 99)
    return np.clip((out - lo) / (hi - lo + 1e-6), 0, 1)


def ridged(rng, n, base=3, octaves=5):
    return 1 - np.abs(2 * fbm(rng, n, base, octaves) - 1)


def _box(a, r, ax):
    pad = [(r + 1, r) if i == ax else (0, 0) for i in range(2)]
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=ax, dtype=np.float64)
    if ax == 0:
        return ((c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)).astype(np.float32)
    return ((c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)).astype(np.float32)


def blur(a, r):
    r = int(r)
    if r < 1:
        return a
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def coords(n=C):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / (n - 1)
    return x, y


def ramp(h, stops):
    ts = np.array([s[0] for s in stops], np.float32)
    cs = np.array([s[1] for s in stops], np.float32)
    out = np.empty(h.shape + (3,), np.float32)
    for k in range(3):
        out[..., k] = np.interp(h, ts, cs[:, k])
    return out


def mix(a, b, t):
    t = t[..., None] if np.ndim(t) == 2 else t
    return np.asarray(a, np.float32) * (1 - t) + np.asarray(b, np.float32) * t


def hillshade(h, z):
    gy, gx = np.gradient(h * z)
    lx, ly, lz = -0.62, -0.62, 0.48
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    norm = np.sqrt(gx * gx + gy * gy + 1)
    s = (-gx * lx - gy * ly + lz) / (norm * ln)
    return s - lz / ln


def contour(f, level, width=0.9):
    gy, gx = np.gradient(f)
    g = np.sqrt(gx * gx + gy * gy) + 1e-6
    return np.clip(1 - np.abs(f - level) / (g * width), 0, 1)


def jitter_points(rng, dens, step, margin=7):
    ys, xs = np.mgrid[margin:C - margin:step, margin:C - margin:step].astype(np.float32)
    xs = xs + rng.uniform(-0.5, 0.5, xs.shape) * step
    ys = ys + rng.uniform(-0.5, 0.5, ys.shape) * step
    xs, ys = np.clip(xs, margin, C - margin - 1), np.clip(ys, margin, C - margin - 1)
    keep = rng.random(xs.shape) < dens[ys.astype(int), xs.astype(int)]
    return list(zip(xs[keep].tolist(), ys[keep].tolist()))


def shade_col(c, k):
    return tuple(int(max(0, min(255, v * k))) for v in c)


# ---------------------------------------------------------------- the hundred shards (all invented)
# (name, biome, landmark icon, what people go there for)

SHARDS = [
    # the Heart: the four most played
    ('Dragonspire', 'volcano', 'citadel', 'Raid · the Ember Wyrm'),
    ('Skyharbor', 'sky', 'airship', 'Sky port · airship races'),
    ('The Drowned Colossus', 'reef', 'colossus', 'Dive · titan quest'),
    ('Neon Lotus', 'neon', 'pagoda', 'Night market · duels'),
    # the Inner Ring
    ('Thornwall Keep', 'forest', 'castle', 'Siege'),
    ('Glasswind Steppe', 'steppe', 'yurts', 'Mounted hunts'),
    ('Frostmaw', 'glacier', 'lair', 'Ice wyrm hunt'),
    ('The Hollow Crown', 'crater', 'arena', 'Arena'),
    ('Lanternmere', 'lake', 'temple', 'Lantern festival'),
    ('Sunscar Reach', 'desert', 'titan', 'Buried titan'),
    ('Wyrmwood Temple', 'jungle', 'ziggurat', 'Temple run'),
    ('Starfall Crater', 'crystal', 'crystal', 'Meteor mining'),
    ('Mirelight Bayou', 'swamp', 'greattree', 'Witch hunts'),
    ('The Clockwork Bazaar', 'city', 'dome', 'Trading'),
    ('Blossom Terraces', 'blossom', 'pagoda', 'Monastery trials'),
    ("Kraken's Rest", 'archipelago', 'wreck', 'Pirate coves'),
    # the Middle Ring
    ('Ironpeak Mines', 'mountain', 'tower', 'Delve'),
    ('Ashen Barrows', 'ruins', 'lair', 'Crypts'),
    ('Mosslight Hollow', 'forest', 'greattree', 'Fae puzzles'),
    ('Saltglass Flats', 'saltflat', 'portal', 'Mirage races'),
    ('Gloamreef', 'reef', 'lighthouse', 'Reef dives'),
    ('Highmoor Watch', 'steppe', 'tower', 'Ranger trials'),
    ('Cinderfall Forge', 'volcano', 'castle', 'Forge'),
    ('Emberleaf Vale', 'autumn', 'windmill', 'Harvest'),
    ('Thunderhead Spires', 'mountain', 'portal', 'Storm climb'),
    ('The Verdant Maw', 'jungle', 'lair', 'Beast hunt'),
    ('Coldharbour', 'island', 'lighthouse', 'Whaling port'),
    ('Amberway Canyon', 'canyon', 'arch', 'Canyon rail'),
    ('Pale Orchard', 'blossom', 'windmill', 'Cozy farming'),
    ('Duskmarket', 'neon', 'pagoda', "Thieves' guild"),
    ('Silverfen', 'swamp', 'ruin', 'Bog mysteries'),
    ('Wolfpine Ridge', 'pine', 'tower', 'Wolf hunts'),
    ('Mirrormere', 'lake', 'portal', 'Reflection puzzles'),
    ('Gildedsand Oasis', 'oasis', 'temple', 'Caravans'),
    ('Shatterglass Badlands', 'crystal', 'crystal', 'Crystal golems'),
    ('Cloudspan', 'sky', 'arch', 'Sky parkour'),
    # the Outer Ring (the six founders' demos drifted here)
    ('Nine Dragon Stack', 'neon', 'pagoda', 'Founders · vertical city'),
    ('Driftwood Isle', 'island', 'lighthouse', 'Founders · island'),
    ('Pine Hollow', 'pine', 'cabin', 'Founders · hunting'),
    ('Nalati Grasslands', 'steppe', 'yurts', 'Founders · riding'),
    ('Signal Dunes', 'desert', 'tower', 'Founders · signal towers'),
    ('Sky Reach', 'sky', 'tower', 'Founders · the climb'),
    ('Bramblemoor', 'swamp', 'cabin', ''),
    ('Copperhill', 'farmland', 'windmill', ''),
    ('Rimefall Pass', 'glacier', 'tower', ''),
    ('Old Quarry', 'canyon', 'ruin', ''),
    ('Tidewrack Shoals', 'archipelago', 'wreck', ''),
    ('Redcap Woods', 'autumn', 'cabin', ''),
    ('Murkwater', 'swamp', 'lair', ''),
    ('Glimmerdeep', 'crystal', 'portal', ''),
    ('The Sunken Abbey', 'lake', 'ruin', ''),
    ('Hearthvale', 'farmland', 'windmill', ''),
    ('Gullcry Point', 'island', 'lighthouse', ''),
    ('Stonecircle Heath', 'steppe', 'henge', ''),
    ('Bonewind Wastes', 'ruins', 'lair', ''),
    ('Ivyreach', 'jungle', 'ziggurat', ''),
    ('Frostfen', 'snowlake', 'cabin', ''),
    ('Larkspur Meadows', 'meadow', 'windmill', ''),
    ('Ravensgate', 'forest', 'castle', ''),
    ('Shellbeach', 'island', 'cabin', ''),
    ('Kettle Peaks', 'mountain', 'lair', ''),
    ('Smokestack Row', 'city', 'tower', ''),
    ('Willowbend', 'lake', 'cabin', ''),
    ('Whisperpine', 'pine', 'henge', ''),
    # the Frontier: quiet, unfinished and abandoned uploads
    ('Mudlark Flats', 'swamp', '', ''),
    ('Thistledown', 'meadow', '', ''),
    ('Quiet Pines', 'pine', 'cabin', ''),
    ('Dustbowl', 'desert', '', ''),
    ("Hermit's Rock", 'island', 'cabin', ''),
    ('Fogmarsh', 'swamp', '', ''),
    ("Bob's Test Shard", 'plain', 'cube', ''),
    ('Lonely Lighthouse', 'island', 'lighthouse', ''),
    ('Plot 41 (unfinished)', 'construction', 'crane', ''),
    ('Sleepy Hollow Farm', 'farmland', 'windmill', ''),
    ('Untitled Shard (3)', 'plain', 'cube', ''),
    ('Old Mine (abandoned)', 'ruins', 'ruin', ''),
    ('Goblin Camp', 'forest', 'yurts', ''),
    ('Snowglobe', 'snowlake', '', ''),
    ('Plot 77 (unfinished)', 'construction', 'crane', ''),
    ('Crabclaw Cove', 'island', '', ''),
    ('my first shard', 'plain', 'cube', ''),
    ('Bramblegate (abandoned)', 'ruins', 'ruin', ''),
    ('Cactus Garden', 'desert', '', ''),
    ('Grey Tarn', 'lake', '', ''),
    ('Under Construction', 'construction', 'crane', ''),
    ('Fernvale', 'forest', '', ''),
    ('Old Watchtower', 'meadow', 'tower', ''),
    ('asdf', 'plain', 'cube', ''),
    ('Slagheap', 'volcano', '', ''),
    ('Pebble Shore', 'island', '', ''),
    ('Lost Orchard', 'autumn', '', ''),
    ('Speedrun Box', 'plain', 'cube', ''),
    ('Rustwater', 'swamp', 'ruin', ''),
    ('Windy Knoll', 'meadow', '', ''),
    ('Echo Caverns (abandoned)', 'canyon', 'ruin', ''),
    ('Hollow Stump', 'forest', 'greattree', ''),
    ('Frozen Pond', 'snowlake', '', ''),
    ('Dune Sea Test', 'desert', '', ''),
    ('Ruined Chapel (abandoned)', 'ruins', 'ruin', ''),
    ('Mossy Steps', 'pine', '', ''),
]
assert len(SHARDS) == 100, len(SHARDS)
RING_NAMES = ['The Heart', 'The Inner Ring', 'The Middle Ring', 'The Outer Ring', 'The Frontier']


def ring_of(i, j):
    return int(max(abs(i - 4.5), abs(j - 4.5)) - 0.5)


# ---------------------------------------------------------------- cells

class Cell:
    def __init__(self, rng):
        self.rng = rng
        self.h = np.zeros((C, C), np.float32)
        self.L = np.ones((C, C), np.float32)
        self.land = None
        self.water = None
        self.z = 90.0
        self.trees = []        # (density map, step, kind, r range, colours)
        self.peaks = None      # height threshold for peak glyphs
        self.ops = []          # (z order, callable(draw))
        self.forest_tint = 0.14
        self.relief_k = 1.0
        self.landmark = (C * 0.5, C * 0.46)
        self.trails = True
        self.coast_ink = True


GRASS = [(0, (184, 196, 128)), (0.5, (170, 188, 116)), (1, (152, 172, 104))]
TREE_GREENS = [(96, 132, 70), (110, 146, 78), (84, 120, 64), (122, 150, 82)]
AUTUMN = [(196, 92, 52), (210, 140, 60), (176, 66, 44), (202, 168, 72), (120, 140, 70)]
PINES = [(62, 96, 66), (54, 86, 60), (72, 106, 72)]
SEA_DEEP, SEA_SHALLOW = (98, 134, 156), (134, 168, 178)


def island_mask(c, rad=0.36, rough=0.55, cx=0.5, cy=0.5, base=3):
    x, y = coords()
    d = np.hypot(x - cx, y - cy) / rad
    v = 1 - d + rough * (fbm(c.rng, C, base, 5) - 0.5)
    return smooth(-0.025, 0.025, v), np.clip(v, 0, None)


def edge_land(c, v):
    """Keep a strip of land along each edge midpoint so the edge entries meet the boulevard."""
    x, y = coords()
    m = np.zeros_like(v)
    for ex, ey in ((0.5, 0), (0.5, 1), (0, 0.5), (1, 0.5)):
        m = np.maximum(m, np.exp(-(((x - ex) / 0.05) ** 2 + ((y - ey) / 0.05) ** 2)))
    return np.maximum(v, m)


def b_forest(c, kind='round', cols=TREE_GREENS, dense=0.9, pal=GRASS):
    c.h = fbm(c.rng, C, 3, 6)
    c.z = 70
    c.land = ramp(c.h, pal)
    d = smooth(0.35, 0.55, fbm(c.rng, C, 3, 4)) * dense
    c.trees.append((d, 6, kind, (3.2, 4.6), cols))
    # a stream
    river(c, 0.6)


def river(c, prob, width=2.4):
    if c.rng.random() > prob:
        return
    rng = c.rng
    side = rng.integers(4)
    t = rng.uniform(0.25, 0.75)
    start = [(t, 0), (t, 1), (0, t), (1, t)][side]
    end = [(rng.uniform(0.2, 0.8), 1), (rng.uniform(0.2, 0.8), 0), (1, rng.uniform(0.2, 0.8)), (0, rng.uniform(0.2, 0.8))][side]
    pts = []
    ph1, ph2 = rng.uniform(0, 6), rng.uniform(0, 6)
    for k in range(41):
        s = k / 40
        x = start[0] + (end[0] - start[0]) * s + 0.06 * math.sin(s * 7 + ph1)
        y = start[1] + (end[1] - start[1]) * s + 0.06 * math.cos(s * 6 + ph2)
        pts.append((x * C, y * C))

    def draw(d):
        d.line(pts, fill=(88, 128, 160), width=int(width + 2), joint='curve')
        d.line(pts, fill=(124, 162, 186), width=int(width), joint='curve')
    c.ops.append((1, draw))


def b_pine(c):
    c.h = fbm(c.rng, C, 3, 6) * 0.7 + ridged(c.rng, C, 2, 4) * 0.3
    c.z = 120
    c.land = ramp(c.h, [(0, (168, 184, 122)), (0.6, (150, 166, 110)), (1, (170, 168, 140))])
    d = smooth(0.3, 0.5, fbm(c.rng, C, 3, 4)) * 0.95
    c.trees.append((d, 6, 'pine', (3.4, 4.8), PINES))
    river(c, 0.5)


def b_jungle(c):
    c.h = fbm(c.rng, C, 3, 6)
    c.z = 90
    c.land = ramp(c.h, [(0, (132, 166, 96)), (1, (116, 150, 84))])
    d = np.clip(smooth(0.15, 0.4, fbm(c.rng, C, 4, 4)), 0, 1) * 0.98
    c.trees.append((d, 5, 'round', (3.4, 5.4), [(72, 118, 60), (86, 132, 64), (60, 104, 56), (100, 140, 64)]))
    c.forest_tint = 0.22
    river(c, 1.0, 3.6)


def b_autumn(c):
    b_forest(c, 'round', AUTUMN, 0.9, [(0, (196, 182, 120)), (1, (184, 170, 110))])
    c.forest_tint = 0.06


def b_blossom(c):
    h = fbm(c.rng, C, 2, 5)
    c.h = np.floor(h * 9) / 9 * 0.7 + h * 0.3      # terraces
    c.z = 150
    c.land = ramp(c.h, [(0, (190, 198, 136)), (1, (176, 186, 124))])
    lines = sum(contour(h * 9, k + 0.0, 0.8) for k in range(1, 9))
    c.land = mix(c.land, (128, 140, 92), np.clip(lines, 0, 1) * 0.45)
    d = smooth(0.4, 0.6, fbm(c.rng, C, 4, 4)) * 0.7
    c.trees.append((d, 7, 'round', (3.0, 4.2), [(232, 170, 190), (240, 196, 208), (218, 150, 176), (110, 146, 78)]))


def b_steppe(c, pal=None):
    c.h = fbm(c.rng, C, 2, 6)
    c.z = 60
    c.land = ramp(c.h, pal or [(0, (204, 202, 132)), (0.5, (190, 196, 122)), (1, (176, 186, 112))])
    tufts = smooth(0.55, 0.7, fbm(c.rng, C, 5, 3)) * 0.35
    c.trees.append((tufts, 9, 'tuft', (2.5, 3.5), [(150, 160, 96)]))
    c.trees.append((smooth(0.7, 0.8, fbm(c.rng, C, 4, 3)) * 0.6, 9, 'round', (3, 4), TREE_GREENS))
    river(c, 0.7)


def b_meadow(c):
    b_steppe(c, [(0, (186, 200, 126)), (1, (166, 186, 112))])
    c.trees.append((smooth(0.5, 0.7, fbm(c.rng, C, 6, 3)) * 0.3, 8, 'flower', (1.6, 2.2), [(220, 120, 150), (240, 220, 120), (170, 140, 210)]))


def b_mountain(c, snowline=0.66, pal=None):
    r = ridged(c.rng, C, 2, 6)
    c.h = np.clip(r ** 1.6 * 0.85 + fbm(c.rng, C, 3, 4) * 0.15, 0, 1)
    c.z = 260
    c.land = ramp(c.h, pal or [(0, (164, 180, 118)), (0.35, (150, 160, 112)), (0.55, (170, 160, 140)),
                               (snowline, (204, 198, 188)), (snowline + 0.1, (244, 244, 240)), (1, (250, 250, 248))])
    c.trees.append(((c.h < 0.42) * smooth(0.3, 0.5, fbm(c.rng, C, 3, 4)) * 0.9, 6, 'pine', (3.2, 4.4), PINES))
    c.peaks = 0.62
    # tarns in the low valleys
    lake = smooth(0.0, 0.03, 0.08 - c.h) if c.rng.random() < 0.6 else np.zeros_like(c.h)
    c.L = 1 - lake


def b_glacier(c):
    b_mountain(c, 0.32, [(0, (196, 206, 206)), (0.3, (212, 222, 226)), (0.5, (232, 238, 242)), (1, (252, 252, 252))])
    crev = sum(contour(fbm(c.rng, C, 6, 2), 0.5, 0.6) for _ in range(2))
    c.land = mix(c.land, (150, 176, 196), np.clip(crev, 0, 1) * 0.5)
    c.trees = [((c.h < 0.25) * smooth(0.4, 0.6, fbm(c.rng, C, 3, 4)) * 0.7, 7, 'snowpine', (3, 4), PINES)]
    c.peaks = 0.55


def b_snowlake(c):
    x, y = coords()
    c.h = fbm(c.rng, C, 3, 5) * 0.6
    c.z = 60
    c.land = ramp(c.h, [(0, (230, 236, 238)), (1, (246, 248, 248))])
    m, _ = island_mask(c, 0.22)
    c.water = mix((172, 200, 214), (206, 224, 232), fbm(c.rng, C, 5, 3))  # ice
    c.L = 1 - m
    c.trees.append((smooth(0.5, 0.65, fbm(c.rng, C, 3, 4)) * 0.8, 7, 'snowpine', (3, 4), PINES))


def b_desert(c, pal=None):
    x, y = coords()
    warp = fbm(c.rng, C, 2, 4)
    a = c.rng.uniform(0, math.pi)
    u = (x * math.cos(a) + y * math.sin(a)) * 18 + warp * 9
    dunes = (np.sin(u) * 0.5 + 0.5) ** 1.6
    c.h = dunes * 0.35 + fbm(c.rng, C, 2, 4) * 0.65
    c.z = 70
    c.land = ramp(c.h, pal or [(0, (226, 204, 136)), (0.5, (234, 212, 144)), (1, (240, 222, 160))])
    c.trees.append((smooth(0.7, 0.85, fbm(c.rng, C, 5, 3)) * 0.25, 10, 'cactus', (2.4, 3.2), [(112, 140, 84)]))


def b_saltflat(c):
    c.h = fbm(c.rng, C, 2, 4) * 0.3
    c.z = 40
    c.land = ramp(c.h, [(0, (236, 234, 222)), (1, (246, 244, 236))])
    cracks = sum(contour(fbm(c.rng, C, 8, 2), 0.5, 0.5) for _ in range(3))
    c.land = mix(c.land, (196, 192, 176), np.clip(cracks, 0, 1) * 0.6)


def b_oasis(c):
    b_desert(c)
    m, _ = island_mask(c, 0.12, 0.3, 0.5, 0.52)
    c.L = 1 - m
    c.water = mix((92, 150, 160), (128, 178, 176), blur(1 - m, 6))
    ring = smooth(0.0, 0.2, 1 - np.hypot(*(np.array(coords()) - 0.5)) / 0.24 - 0.4)
    c.land = mix(c.land, (176, 190, 120), ring * 0.7)
    c.trees = [(ring * 0.8, 6, 'palm', (3.4, 4.4), [(84, 130, 70)])]
    c.landmark = (C * 0.5, C * 0.34)


def b_canyon(c):
    x, y = coords()
    h = fbm(c.rng, C, 2, 6)
    c.h = np.floor(h * 7) / 7 * 0.75 + h * 0.25
    gorge = np.exp(-((x - 0.5 - 0.12 * np.sin(y * 7)) / 0.05) ** 2)
    c.h = c.h * (1 - 0.8 * gorge)
    c.z = 240
    c.land = ramp(c.h, [(0, (176, 112, 76)), (0.3, (198, 128, 84)), (0.6, (214, 156, 104)), (1, (226, 182, 128))])
    strata = sum(contour(h * 7, k, 0.7) for k in range(1, 7))
    c.land = mix(c.land, (132, 76, 52), np.clip(strata, 0, 1) * 0.5)
    c.L = 1 - smooth(0.6, 0.9, gorge)
    c.water = np.full((C, C, 3), (110, 150, 170), np.float32)
    c.trees.append((smooth(0.7, 0.85, fbm(c.rng, C, 4, 3)) * 0.4, 8, 'round', (2.6, 3.4), [(130, 140, 80)]))


def b_crater(c):
    x, y = coords()
    d = np.hypot(x - 0.5, y - 0.48)
    rim = np.exp(-((d - 0.3) / 0.06) ** 2)
    bowl = smooth(0.3, 0.0, d)
    c.h = 0.35 + rim * 0.6 - bowl * 0.3 + fbm(c.rng, C, 3, 5) * 0.2
    c.z = 220
    c.land = ramp(c.h, [(0, (176, 172, 132)), (0.4, (168, 182, 116)), (0.7, (176, 164, 140)), (1, (210, 204, 190))])
    c.trees.append(((d > 0.38) * smooth(0.4, 0.6, fbm(c.rng, C, 3, 4)) * 0.9, 6, 'round', (3, 4.2), TREE_GREENS))
    c.peaks = 0.82
    c.landmark = (C * 0.5, C * 0.48)


def b_lake(c):
    m, v = island_mask(c, 0.3, 0.6, 0.5, 0.46)
    c.L = 1 - m
    c.h = fbm(c.rng, C, 3, 5)
    c.z = 80
    c.land = ramp(c.h, GRASS)
    c.trees.append((smooth(0.4, 0.6, fbm(c.rng, C, 3, 4)) * 0.85, 6, 'round', (3.0, 4.4), TREE_GREENS))
    # an islet holds the landmark
    x, y = coords()
    isle = smooth(-0.02, 0.02, 0.06 - np.hypot(x - 0.5, y - 0.44))
    c.L = np.maximum(c.L, isle)
    c.landmark = (C * 0.5, C * 0.44)
    c.lanterns = True


def b_swamp(c):
    c.h = fbm(c.rng, C, 4, 5)
    pools = smooth(0.0, 0.04, 0.36 - fbm(c.rng, C, 5, 4))
    c.L = 1 - pools
    c.water = mix((96, 124, 112), (126, 150, 132), fbm(c.rng, C, 6, 2))
    c.z = 40
    c.land = ramp(c.h, [(0, (150, 164, 122)), (1, (138, 154, 112))])
    c.trees.append((np.full((C, C), 0.5, np.float32), 8, 'reed', (3, 4), [(96, 116, 80)]))
    c.trees.append((smooth(0.5, 0.7, fbm(c.rng, C, 3, 4)) * 0.8, 7, 'round', (3.2, 4.6), [(112, 132, 86), (98, 120, 80), (126, 140, 96)]))
    c.coast_ink = False


def b_crystal(c):
    c.h = ridged(c.rng, C, 3, 5) * 0.7 + fbm(c.rng, C, 2, 4) * 0.3
    c.z = 200
    c.land = ramp(c.h, [(0, (150, 136, 156)), (0.5, (168, 152, 170)), (1, (196, 186, 196))])
    c.trees.append((smooth(0.55, 0.75, c.h) * 0.6, 7, 'crystal', (3, 6), [(150, 120, 214), (100, 196, 210), (196, 140, 220)]))


def b_volcano(c):
    x, y = coords()
    cx, cy = 0.5, 0.40
    d = np.hypot(x - cx, y - cy)
    cone = np.clip(1 - d / 0.46, 0, 1) ** 1.3
    crater = np.exp(-(d / 0.06) ** 2)
    c.h = np.clip(cone * 0.9 + fbm(c.rng, C, 4, 5) * 0.18 - crater * 0.5, 0, 1)
    c.z = 260
    c.land = ramp(c.h, [(0, (176, 166, 146)), (0.35, (150, 136, 122)), (0.7, (122, 108, 100)), (1, (96, 86, 82))])
    a = np.arctan2(y - cy, x - cx)
    warp = fbm(c.rng, C, 3, 3)
    flow = np.abs(np.sin(a * 3.5 + warp * 4 + d * 6))
    lava = smooth(0.12, 0.0, flow) * smooth(0.07, 0.1, d) * smooth(0.42, 0.25, d)
    lava = np.maximum(lava, smooth(0.045, 0.03, d))
    glow = blur(lava, 6)
    c.land = mix(c.land, (226, 108, 44), np.clip(glow * 1.6, 0, 0.55))
    c.land = mix(c.land, (250, 170, 70), lava)
    c.relief_k = 0.9
    c.trees.append(((d > 0.42) * smooth(0.5, 0.7, fbm(c.rng, C, 3, 3)) * 0.4, 9, 'dead', (3, 4), [(96, 84, 74)]))
    c.landmark = (C * 0.5, C * 0.68)
    c.ops.append((9, lambda dr: peak_glyph(dr, C * 0.5, C * 0.4 - 6, 30, smoke=True)))


def b_sky(c):
    x, y = coords()
    clouds = fbm(c.rng, C, 3, 5)
    c.water = mix((206, 216, 226), (246, 248, 250), smooth(0.3, 0.8, clouds))
    lines = sum(contour(clouds, lv, 0.7) for lv in (0.45, 0.62, 0.78))
    c.water = mix(c.water, (176, 192, 208), np.clip(lines, 0, 1) * 0.5)
    L = np.zeros((C, C), np.float32)
    rng = c.rng
    spots = [(0.5, 0.45, 0.2)] + [(rng.uniform(0.15, 0.85), rng.uniform(0.15, 0.85), rng.uniform(0.07, 0.12)) for _ in range(5)]
    n = fbm(rng, C, 4, 4)
    for sx, sy, sr in spots:
        L = np.maximum(L, smooth(-0.02, 0.02, 1 - np.hypot(x - sx, y - sy) / sr + 0.5 * (n - 0.5)))
    c.L = L
    c.h = fbm(rng, C, 3, 5)
    c.z = 80
    c.land = ramp(c.h, GRASS)
    c.trees.append((smooth(0.45, 0.65, fbm(rng, C, 3, 4)) * 0.8, 6, 'round', (3, 4.2), TREE_GREENS))
    c.sky = True
    c.coast_ink = True


def b_reef(c):
    x, y = coords()
    d = np.hypot(x - 0.5, y - 0.47)
    n = fbm(c.rng, C, 4, 5)
    ring = smooth(-0.02, 0.02, 0.035 - np.abs(d - 0.34 - 0.05 * (n - 0.5)))
    ring = ring * smooth(0.45, 0.55, fbm(c.rng, C, 3, 3) + 0.1)
    c.L = ring
    lagoon = smooth(0.36, 0.2, d)
    c.water = mix(mix((84, 132, 160), (100, 178, 186), smooth(0.5, 0.3, d)), (150, 210, 200), lagoon * 0.8)
    coral = smooth(0.62, 0.75, fbm(c.rng, C, 6, 3)) * lagoon
    c.water = mix(c.water, (226, 156, 140), coral * 0.6)
    c.h = n
    c.z = 40
    c.land = ramp(n, [(0, (232, 220, 176)), (1, (214, 210, 150))])
    c.trees.append((ring * 0.5, 6, 'palm', (3, 4), [(84, 130, 70)]))
    c.landmark = (C * 0.5, C * 0.46)


def b_island(c):
    m, v = island_mask(c, 0.34, 0.6)
    c.L = m
    c.h = np.clip(v * 1.4, 0, 1) * 0.7 + fbm(c.rng, C, 3, 5) * 0.3
    c.z = 120
    beach = smooth(0.12, 0.0, v)
    c.land = mix(ramp(c.h, GRASS), (232, 218, 172), beach)
    c.trees.append(((v > 0.1) * smooth(0.4, 0.6, fbm(c.rng, C, 3, 4)) * 0.85, 6, 'palm' if c.rng.random() < 0.5 else 'round', (3, 4.2), [(84, 130, 70), (100, 140, 74)]))
    c.landmark = (C * 0.5, C * 0.44)


def b_archipelago(c):
    x, y = coords()
    n = fbm(c.rng, C, 4, 5)
    v = n - 0.62 + 0.25 * (1 - np.hypot(x - 0.5, y - 0.5) / 0.6)
    c.L = smooth(-0.015, 0.015, v)
    c.h = np.clip(v * 3, 0, 1)
    c.z = 100
    beach = smooth(0.05, 0.0, v)
    c.land = mix(ramp(c.h, GRASS), (232, 218, 172), beach)
    c.trees.append(((v > 0.04) * 0.7, 6, 'palm', (3, 4), [(84, 130, 70)]))
    c.landmark = (C * 0.52, C * 0.5)


def b_ruins(c):
    c.h = fbm(c.rng, C, 3, 5)
    c.z = 90
    c.land = ramp(c.h, [(0, (176, 170, 150)), (1, (160, 152, 136))])
    c.trees.append((smooth(0.5, 0.7, fbm(c.rng, C, 4, 3)) * 0.35, 8, 'dead', (3, 4), [(100, 90, 78)]))
    c.trees.append((smooth(0.55, 0.75, fbm(c.rng, C, 5, 3)) * 0.2, 12, 'rubble', (3, 5), [(132, 126, 118)]))


def b_farmland(c):
    rng = c.rng
    c.h = fbm(rng, C, 2, 5)
    c.z = 50
    c.land = ramp(c.h, GRASS)
    fields = [(196, 184, 110), (178, 190, 112), (210, 196, 126), (158, 176, 100), (200, 170, 104)]
    img = Image.new('RGB', (C, C))
    d = ImageDraw.Draw(img)
    for _ in range(26):
        fx, fy = rng.uniform(0, C), rng.uniform(0, C)
        fw, fh = rng.uniform(40, 90), rng.uniform(30, 70)
        d.rectangle([fx, fy, fx + fw, fy + fh], fill=fields[rng.integers(len(fields))])
    arr = np.asarray(img).astype(np.float32)
    has = (arr.sum(-1) > 0).astype(np.float32)
    c.land = mix(c.land, arr, has * 0.85)
    c.trees.append(((1 - has) * 0.5, 8, 'round', (2.8, 3.6), TREE_GREENS))
    c.houses = 10


def b_city(c, neon=False):
    rng = c.rng
    x, y = coords()
    c.h = fbm(rng, C, 2, 4) * 0.3
    c.z = 30
    if neon:
        c.land = ramp(c.h, [(0, (62, 56, 84)), (1, (74, 66, 96))])
    else:
        c.land = mix(ramp(fbm(rng, C, 3, 5), GRASS), (210, 196, 166), smooth(0.44, 0.40, np.hypot(x - 0.5, y - 0.48)))
    canal = np.exp(-((y - 0.62 - 0.05 * np.sin(x * 9)) / 0.018) ** 2)
    c.L = 1 - smooth(0.4, 0.7, canal)
    c.water = np.full((C, C, 3), (60, 84, 110) if neon else (118, 154, 174), np.float32)
    c.coast_ink = not neon
    c.trails = False

    def draw(dr):
        r = C * 0.4
        cx, cy = C * 0.5, C * 0.48
        roof = [(176, 92, 66), (160, 80, 60), (190, 120, 84), (150, 100, 80)]
        nroof = [(96, 70, 120), (110, 82, 136), (84, 64, 112), (120, 60, 100)]
        for gy in range(int(cy - r), int(cy + r), 13):
            for gx in range(int(cx - r), int(cx + r), 13):
                if math.hypot(gx + 6 - cx, gy + 6 - cy) > r - 8 or rng.random() < 0.12:
                    continue
                if abs(gy + 6 - (0.62 * C + 0.05 * C * math.sin(gx / C * 9))) < 10:
                    continue
                w, hh = rng.uniform(7, 11), rng.uniform(7, 11)
                col = (nroof if neon else roof)[rng.integers(4)]
                dr.rectangle([gx + 1, gy + 1, gx + w, gy + hh], fill=col, outline=shade_col(col, 0.6))
        if neon:
            for _ in range(160):
                a, rr = rng.uniform(0, 2 * math.pi), r * math.sqrt(rng.random()) * 0.95
                lx, ly = cx + rr * math.cos(a), cy + rr * math.sin(a)
                col = [(255, 80, 180), (80, 230, 255), (255, 200, 80)][rng.integers(3)]
                dr.ellipse([lx - 4, ly - 4, lx + 4, ly + 4], fill=col + (60,))
                dr.ellipse([lx - 1.6, ly - 1.6, lx + 1.6, ly + 1.6], fill=col)
            dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 120, 200), width=2)
        else:
            dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=3)
            for k in range(16):
                a = k / 16 * 2 * math.pi
                tx, ty = cx + r * math.cos(a), cy + r * math.sin(a)
                dr.rectangle([tx - 3, ty - 3, tx + 3, ty + 3], fill=(200, 190, 170), outline=INK)
        for (ax, ay) in ((0.5, 0), (0.5, 1), (0, 0.48), (1, 0.48)):
            dr.line([(ax * C, ay * C), (cx, cy)], fill=(255, 210, 120) if neon else (232, 222, 196), width=4)
    c.ops.append((2, draw))


def b_neon(c):
    b_city(c, True)
    c.neon = True


def b_plain(c):
    c.h = np.zeros((C, C), np.float32)
    c.z = 0
    c.land = np.full((C, C, 3), (178, 192, 142), np.float32)
    c.trails = False
    c.landmark = (C * 0.5, C * 0.48)


def b_construction(c):
    c.h = np.zeros((C, C), np.float32)
    c.z = 0
    x, y = coords()
    c.land = np.full((C, C, 3), (214, 200, 168), np.float32)
    grid = ((np.mod(x * C, 20) < 1) | (np.mod(y * C, 20) < 1)).astype(np.float32)
    c.land = mix(c.land, (140, 160, 190), grid * 0.6)
    c.trails = False

    def draw(dr):
        rng = c.rng
        for _ in range(7):
            bx, by = rng.uniform(40, 250), rng.uniform(40, 250)
            dr.rectangle([bx, by, bx + rng.uniform(20, 50), by + rng.uniform(20, 40)], outline=(90, 110, 150), width=2)
        for _ in range(3):
            bx, by = rng.uniform(40, 250), rng.uniform(40, 250)
            dr.rectangle([bx, by, bx + 24, by + 18], fill=(170, 166, 160), outline=INK)
    c.ops.append((2, draw))


BIOMES = {
    'forest': b_forest, 'pine': b_pine, 'jungle': b_jungle, 'autumn': b_autumn, 'blossom': b_blossom,
    'steppe': b_steppe, 'meadow': b_meadow, 'mountain': b_mountain, 'glacier': b_glacier, 'snowlake': b_snowlake,
    'desert': b_desert, 'saltflat': b_saltflat, 'oasis': b_oasis, 'canyon': b_canyon, 'crater': b_crater,
    'lake': b_lake, 'swamp': b_swamp, 'crystal': b_crystal, 'volcano': b_volcano, 'sky': b_sky, 'reef': b_reef,
    'island': b_island, 'archipelago': b_archipelago, 'ruins': b_ruins, 'farmland': b_farmland, 'city': b_city,
    'neon': b_neon, 'plain': b_plain, 'construction': b_construction,
}


# ---------------------------------------------------------------- glyphs

def tree_glyph(d, x, y, kind, r, col):
    if kind == 'round':
        d.ellipse([x - r + 1.3, y - r + 1.8, x + r + 1.3, y + r + 1.8], fill=(40, 46, 24, 70))
        d.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=shade_col(col, 0.58))
        hr = r * 0.38
        d.ellipse([x - r * 0.4 - hr, y - r * 0.4 - hr, x - r * 0.4 + hr, y - r * 0.4 + hr], fill=shade_col(col, 1.22))
    elif kind in ('pine', 'snowpine'):
        pts = [(x, y - r * 1.7), (x - r * 0.95, y + r * 0.6), (x + r * 0.95, y + r * 0.6)]
        d.polygon([(px + 1.4, py + 1.6) for px, py in pts], fill=(30, 40, 24, 80))
        d.polygon(pts, fill=col, outline=shade_col(col, 0.6))
        d.line([(x, y - r * 1.5), (x - r * 0.5, y + r * 0.4)], fill=shade_col(col, 1.3))
        if kind == 'snowpine':
            d.polygon([(x, y - r * 1.7), (x - r * 0.4, y - r * 0.7), (x + r * 0.4, y - r * 0.7)], fill=(246, 248, 250))
    elif kind == 'palm':
        for k in range(5):
            a = k / 5 * 2 * math.pi + 0.3
            d.line([(x, y), (x + r * 1.3 * math.cos(a), y + r * 1.3 * math.sin(a))], fill=col, width=2)
        d.ellipse([x - 1.4, y - 1.4, x + 1.4, y + 1.4], fill=(110, 84, 54))
    elif kind == 'reed':
        for k in (-1, 0, 1):
            d.line([(x + k * 1.6, y + 2), (x + k * 2.2, y - r)], fill=col, width=1)
    elif kind == 'tuft':
        d.line([(x - 2, y), (x - 3, y - r)], fill=col)
        d.line([(x, y), (x, y - r - 1)], fill=col)
        d.line([(x + 2, y), (x + 3, y - r)], fill=col)
    elif kind == 'flower':
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    elif kind == 'cactus':
        d.line([(x, y + r), (x, y - r * 1.2)], fill=col, width=2)
        d.line([(x - r * 0.7, y - r * 0.2), (x - r * 0.7, y - r * 0.7)], fill=col, width=1)
        d.line([(x - r * 0.7, y - r * 0.2), (x, y - r * 0.2)], fill=col, width=1)
    elif kind == 'crystal':
        pts = [(x, y - r * 1.8), (x + r * 0.55, y), (x, y + r * 0.5), (x - r * 0.55, y)]
        d.polygon([(px + 2, py + 2) for px, py in pts], fill=(40, 30, 50, 80))
        d.polygon(pts, fill=col, outline=shade_col(col, 0.55))
        d.line([(x, y - r * 1.6), (x - r * 0.3, y)], fill=(250, 246, 255))
    elif kind == 'dead':
        d.line([(x, y + r), (x, y - r)], fill=col)
        d.line([(x, y - r * 0.2), (x - r * 0.7, y - r * 0.8)], fill=col)
        d.line([(x, y), (x + r * 0.7, y - r * 0.6)], fill=col)
    elif kind == 'rubble':
        d.rectangle([x - r, y - r * 0.4, x + r * 0.6, y + r * 0.4], fill=col, outline=INK)


def peak_glyph(d, x, y, s, smoke=False):
    left = [(x, y - s), (x - s * 0.9, y + s * 0.35), (x, y + s * 0.35)]
    right = [(x, y - s), (x + s * 0.9, y + s * 0.35), (x, y + s * 0.35)]
    d.polygon(left, fill=(242, 240, 234), outline=(110, 100, 92))
    d.polygon(right, fill=(156, 148, 140), outline=(110, 100, 92))
    if smoke:
        for k in range(5):
            d.ellipse([x - 5 + k * 4, y - s - 8 - k * 9, x + 5 + k * 5, y - s - k * 9], fill=(120, 114, 110, 120))


def house_glyph(d, x, y, s, roof=(176, 92, 66)):
    d.rectangle([x - s, y - s * 0.4, x + s, y + s * 0.7], fill=(226, 214, 186), outline=INK)
    d.polygon([(x - s * 1.2, y - s * 0.3), (x, y - s * 1.2), (x + s * 1.2, y - s * 0.3)], fill=roof, outline=INK)


def icon(d, kind, x, y, s, neon=False):
    """A landmark, drawn in ink and wash at height ~2s around (x, y)."""
    I = INK
    if kind in ('castle', 'citadel'):
        dark = kind == 'citadel'
        wall = (84, 72, 70) if dark else (214, 204, 182)
        roof = (190, 60, 40) if dark else (170, 70, 52)
        d.rectangle([x - s, y - s * 0.3, x + s, y + s * 0.6], fill=wall, outline=I, width=2)
        for k in range(-4, 5, 2):
            d.rectangle([x + k * s * 0.11 - s * 0.05, y - s * 0.42, x + k * s * 0.11 + s * 0.05, y - s * 0.3], fill=wall, outline=I)
        for tx, th in ((-s, 1.0), (s, 1.0), (0, 1.5)):
            d.rectangle([x + tx - s * 0.22, y - s * th, x + tx + s * 0.22, y + s * 0.6], fill=wall, outline=I, width=2)
            d.polygon([(x + tx - s * 0.3, y - s * th), (x + tx, y - s * th - s * 0.55), (x + tx + s * 0.3, y - s * th)], fill=roof, outline=I)
        d.rectangle([x - s * 0.15, y + s * 0.2, x + s * 0.15, y + s * 0.6], fill=(70, 50, 40))
        if dark:
            d.ellipse([x - s * 0.08, y - s * 2.2, x + s * 0.08, y - s * 2.05], fill=(255, 180, 60))
    elif kind == 'pagoda':
        cols = [(214, 70, 60), (60, 140, 140)] if not neon else [(255, 70, 160), (70, 220, 240)]
        tiers = 5
        for k in range(tiers):
            w = s * (1.0 - k * 0.15)
            ty = y + s * 0.6 - k * s * 0.45
            d.rectangle([x - w * 0.55, ty - s * 0.3, x + w * 0.55, ty], fill=(236, 222, 190), outline=I)
            d.polygon([(x - w * 0.95, ty - s * 0.24), (x - w * 0.6, ty - s * 0.5), (x + w * 0.6, ty - s * 0.5), (x + w * 0.95, ty - s * 0.24)],
                      fill=cols[k % 2], outline=I)
        d.line([(x, y + s * 0.6 - tiers * s * 0.45 - s * 0.1), (x, y + s * 0.6 - tiers * s * 0.45 - s * 0.6)], fill=I, width=2)
        if neon:
            d.ellipse([x - s * 1.4, y - s * 1.8, x + s * 1.4, y + s * 0.9], outline=(255, 120, 200, 140), width=3)
    elif kind == 'colossus':
        stone = (150, 170, 150)
        d.ellipse([x - s * 1.2, y + s * 0.5, x + s * 1.2, y + s * 0.95], fill=(90, 150, 170, 150))
        d.polygon([(x - s * 0.45, y + s * 0.7), (x - s * 0.3, y - s * 0.6), (x + s * 0.3, y - s * 0.6), (x + s * 0.45, y + s * 0.7)], fill=stone, outline=I, width=2)
        d.ellipse([x - s * 0.22, y - s * 1.05, x + s * 0.22, y - s * 0.6], fill=stone, outline=I, width=2)
        d.line([(x + s * 0.3, y - s * 0.5), (x + s * 0.8, y - s * 1.1)], fill=I, width=max(3, int(s * 0.16)))
        d.line([(x + s * 0.3, y - s * 0.5), (x + s * 0.8, y - s * 1.1)], fill=stone, width=max(1, int(s * 0.1)))
        d.line([(x + s * 0.8, y - s * 1.5), (x + s * 0.8, y - s * 0.7)], fill=(220, 210, 160), width=3)
        d.line([(x - s * 0.3, y - s * 0.5), (x - s * 0.7, y + s * 0.1)], fill=I, width=max(3, int(s * 0.16)))
        d.line([(x - s * 0.3, y - s * 0.5), (x - s * 0.7, y + s * 0.1)], fill=stone, width=max(1, int(s * 0.1)))
        for k in range(3):
            d.arc([x - s * (0.6 + k * 0.25), y + s * (0.55 + k * 0.05), x + s * (0.6 + k * 0.25), y + s * (0.85 + k * 0.08)], 0, 180, fill=(240, 248, 250), width=1)
    elif kind == 'airship':
        for k, (ox, oy, ss) in enumerate(((0, 0, 1.0), (-1.5, 1.1, 0.5), (1.4, 0.9, 0.45))):
            ax, ay, sz = x + ox * s, y + oy * s, s * ss
            d.ellipse([ax - sz * 1.1 + 4, ay - sz * 0.45 + 10, ax + sz * 1.1 + 4, ay + sz * 0.45 + 10], fill=(60, 70, 90, 50))
            d.ellipse([ax - sz * 1.1, ay - sz * 0.45, ax + sz * 1.1, ay + sz * 0.45], fill=(236, 226, 200), outline=I, width=2)
            for f in (-0.5, 0, 0.5):
                d.line([(ax + f * sz, ay - sz * 0.42), (ax + f * sz, ay + sz * 0.42)], fill=(190, 70, 52), width=2)
            d.rectangle([ax - sz * 0.35, ay + sz * 0.5, ax + sz * 0.35, ay + sz * 0.72], fill=(140, 96, 60), outline=I)
            d.polygon([(ax + sz * 1.0, ay), (ax + sz * 1.35, ay - sz * 0.3), (ax + sz * 1.35, ay + sz * 0.3)], fill=(190, 70, 52), outline=I)
    elif kind in ('tower', 'lighthouse'):
        lh = kind == 'lighthouse'
        d.polygon([(x - s * 0.3, y + s * 0.6), (x - s * 0.2, y - s), (x + s * 0.2, y - s), (x + s * 0.3, y + s * 0.6)], fill=(232, 224, 204), outline=I, width=2)
        if lh:
            for k in range(3):
                yy = y - s * 0.6 + k * s * 0.45
                d.rectangle([x - s * 0.26, yy, x + s * 0.26, yy + s * 0.18], fill=(196, 64, 52))
            d.ellipse([x - s * 0.5, y - s * 1.5, x + s * 0.5, y - s * 0.7], fill=(255, 230, 140, 110))
        d.polygon([(x - s * 0.3, y - s), (x, y - s * 1.5), (x + s * 0.3, y - s)], fill=(170, 70, 52) if not lh else (70, 60, 50), outline=I)
    elif kind == 'temple':
        d.polygon([(x - s, y - s * 0.4), (x, y - s * 1.0), (x + s, y - s * 0.4)], fill=(220, 206, 176), outline=I, width=2)
        d.rectangle([x - s * 0.9, y - s * 0.4, x + s * 0.9, y + s * 0.5], fill=(236, 226, 204), outline=I, width=2)
        for k in range(-3, 4):
            d.line([(x + k * s * 0.25, y - s * 0.3), (x + k * s * 0.25, y + s * 0.4)], fill=I)
        d.rectangle([x - s * 1.05, y + s * 0.5, x + s * 1.05, y + s * 0.65], fill=(200, 188, 160), outline=I)
    elif kind == 'ziggurat':
        for k in range(4):
            w = s * (1.1 - k * 0.24)
            ty = y + s * 0.6 - k * s * 0.38
            d.rectangle([x - w, ty - s * 0.38, x + w, ty], fill=(176, 170, 140), outline=I, width=2)
        d.rectangle([x - s * 0.08, y - s * 0.95, x + s * 0.08, y + s * 0.6], fill=(150, 140, 110))
        d.rectangle([x - s * 0.25, y - s * 1.2, x + s * 0.25, y - s * 0.92], fill=(196, 180, 140), outline=I)
    elif kind == 'lair':
        d.ellipse([x - s * 0.55, y - s * 0.55, x + s * 0.55, y + s * 0.55], outline=(176, 40, 36), width=3)
        d.ellipse([x - s * 0.25, y - s * 0.25, x + s * 0.25, y + s * 0.25], fill=(196, 52, 44), outline=(120, 30, 26))
        for k in range(8):
            a = k / 8 * 2 * math.pi
            d.line([(x + s * 0.6 * math.cos(a), y + s * 0.6 * math.sin(a)), (x + s * 0.8 * math.cos(a), y + s * 0.8 * math.sin(a))], fill=(176, 40, 36), width=2)
    elif kind == 'portal':
        d.ellipse([x - s * 0.7, y - s * 1.1, x + s * 0.7, y + s * 0.5], fill=(120, 230, 230, 60), outline=(60, 150, 160), width=4)
        d.ellipse([x - s * 0.45, y - s * 0.85, x + s * 0.45, y + s * 0.25], outline=(200, 250, 250), width=2)
        d.rectangle([x - s * 0.85, y + s * 0.45, x + s * 0.85, y + s * 0.6], fill=(170, 160, 150), outline=I)
    elif kind == 'dome':
        d.pieslice([x - s * 0.8, y - s * 1.2, x + s * 0.8, y + s * 0.2], 180, 360, fill=(120, 170, 150), outline=I, width=2)
        d.rectangle([x - s, y - s * 0.5, x + s, y + s * 0.5], fill=(226, 214, 186), outline=I, width=2)
        for k in range(-3, 4):
            d.line([(x + k * s * 0.28, y - s * 0.4), (x + k * s * 0.28, y + s * 0.4)], fill=I)
        d.ellipse([x - s * 0.18, y - s * 1.0, x + s * 0.18, y - s * 0.64], fill=(240, 220, 150), outline=I)
        for k in range(4):
            a = k / 4 * 2 * math.pi - math.pi / 2
            d.line([(x, y - s * 0.82), (x + s * 0.14 * math.cos(a), y - s * 0.82 + s * 0.14 * math.sin(a))], fill=I)
    elif kind == 'windmill':
        d.polygon([(x - s * 0.3, y + s * 0.6), (x - s * 0.18, y - s * 0.4), (x + s * 0.18, y - s * 0.4), (x + s * 0.3, y + s * 0.6)], fill=(232, 222, 200), outline=I, width=2)
        for k in range(4):
            a = k / 4 * 2 * math.pi + 0.5
            ex, ey = x + s * 0.9 * math.cos(a), y - s * 0.4 + s * 0.9 * math.sin(a)
            d.line([(x, y - s * 0.4), (ex, ey)], fill=I, width=2)
            d.polygon([(ex, ey), (x + s * 0.5 * math.cos(a + 0.25), y - s * 0.4 + s * 0.5 * math.sin(a + 0.25)), (x + s * 0.2 * math.cos(a + 0.3), y - s * 0.4 + s * 0.2 * math.sin(a + 0.3))], fill=(236, 230, 214), outline=I)
    elif kind == 'wreck':
        d.polygon([(x - s, y), (x + s * 0.8, y - s * 0.3), (x + s * 0.6, y + s * 0.3), (x - s * 0.7, y + s * 0.45)], fill=(132, 96, 64), outline=I, width=2)
        d.line([(x - s * 0.2, y - s * 0.1), (x - s * 0.5, y - s * 1.2)], fill=I, width=3)
        d.line([(x + s * 0.3, y - s * 0.2), (x + s * 0.5, y - s * 0.9)], fill=I, width=2)
        d.polygon([(x - s * 0.45, y - s * 1.0), (x + s * 0.1, y - s * 0.75), (x - s * 0.3, y - s * 0.45)], fill=(220, 208, 180), outline=I)
        for k in range(4):
            a = k / 4 * math.pi * 2
            d.arc([x - s * 1.5, y - s * 0.6, x + s * 1.5, y + s * 0.9], 200 + k * 10, 240 + k * 10, fill=(64, 60, 70), width=2)
    elif kind == 'crane':
        d.line([(x - s * 0.2, y + s * 0.6), (x - s * 0.2, y - s)], fill=(196, 150, 40), width=4)
        d.line([(x - s * 0.7, y - s), (x + s, y - s)], fill=(196, 150, 40), width=4)
        d.line([(x + s * 0.8, y - s), (x + s * 0.8, y - s * 0.3)], fill=I, width=1)
        for k in range(5):
            yy = y + s * 0.6 - k * s * 0.32
            d.line([(x - s * 0.3, yy), (x - s * 0.1, yy - s * 0.32)], fill=I)
    elif kind == 'ruin':
        for k, (ox, hh) in enumerate(((-0.7, 0.9), (-0.25, 0.5), (0.2, 1.1), (0.65, 0.4))):
            d.rectangle([x + ox * s, y + s * 0.5 - hh * s, x + ox * s + s * 0.3, y + s * 0.5], fill=(190, 182, 166), outline=I, width=2)
        d.arc([x - s * 0.7, y - s * 0.8, x + s * 0.5, y + s * 0.2], 180, 300, fill=I, width=3)
    elif kind == 'arena':
        d.ellipse([x - s * 1.2, y - s * 0.7, x + s * 1.2, y + s * 0.7], fill=(214, 200, 170), outline=I, width=3)
        d.ellipse([x - s * 0.8, y - s * 0.42, x + s * 0.8, y + s * 0.42], fill=(222, 196, 140), outline=I, width=2)
        for k in range(20):
            a = k / 20 * 2 * math.pi
            d.line([(x + s * 0.85 * math.cos(a), y + s * 0.47 * math.sin(a)), (x + s * 1.15 * math.cos(a), y + s * 0.67 * math.sin(a))], fill=I)
        for k in range(6):
            a = k / 6 * 2 * math.pi
            d.polygon([(x + s * 1.2 * math.cos(a), y + s * 0.7 * math.sin(a) - s * 0.25), (x + s * 1.2 * math.cos(a) - 4, y + s * 0.7 * math.sin(a)), (x + s * 1.2 * math.cos(a) + 4, y + s * 0.7 * math.sin(a))], fill=(196, 52, 44))
    elif kind == 'arch':
        d.polygon([(x - s, y + s * 0.6), (x - s * 0.8, y - s * 0.6), (x + s * 0.8, y - s * 0.6), (x + s, y + s * 0.6), (x + s * 0.5, y + s * 0.6),
                   (x + s * 0.45, y - s * 0.1), (x - s * 0.45, y - s * 0.1), (x - s * 0.5, y + s * 0.6)], fill=(200, 140, 96), outline=I, width=2)
    elif kind == 'cabin':
        house_glyph(d, x, y, s * 0.6, (130, 80, 52))
        d.rectangle([x + s * 0.2, y - s * 0.95, x + s * 0.32, y - s * 0.5], fill=(120, 100, 90), outline=I)
    elif kind == 'yurts':
        for ox, oy in ((-0.6, 0.2), (0.5, 0.0), (0, 0.55), (0.9, 0.6)):
            px, py, r = x + ox * s, y + oy * s, s * 0.32
            d.pieslice([px - r, py - r, px + r, py + r], 180, 360, fill=(236, 226, 206), outline=I, width=2)
            d.line([(px - r, py), (px + r, py)], fill=I, width=2)
            d.ellipse([px - 2, py - r - 2, px + 2, py - r + 2], fill=(190, 70, 52))
    elif kind == 'greattree':
        d.rectangle([x - s * 0.12, y - s * 0.2, x + s * 0.12, y + s * 0.6], fill=(110, 80, 52), outline=I)
        for ox, oy, r in ((0, -0.7, 0.55), (-0.45, -0.35, 0.42), (0.45, -0.35, 0.42), (0, -0.25, 0.4)):
            d.ellipse([x + (ox - r) * s + 3, y + (oy - r) * s + 4, x + (ox + r) * s + 3, y + (oy + r) * s + 4], fill=(30, 40, 20, 70))
        for ox, oy, r in ((0, -0.7, 0.55), (-0.45, -0.35, 0.42), (0.45, -0.35, 0.42), (0, -0.25, 0.4)):
            d.ellipse([x + (ox - r) * s, y + (oy - r) * s, x + (ox + r) * s, y + (oy + r) * s], fill=(92, 140, 74), outline=(50, 76, 40), width=2)
        for _ in range(8):
            a = np.random.default_rng(int(x * 7 + y)).uniform(0, 6.28)
            d.ellipse([x + math.cos(a) * s * 0.5 - 2, y - s * 0.5 + math.sin(a) * s * 0.4 - 2, x + math.cos(a) * s * 0.5 + 2, y - s * 0.5 + math.sin(a) * s * 0.4 + 2], fill=(250, 240, 150))
    elif kind == 'titan':
        d.ellipse([x - s * 0.6, y - s * 0.6, x + s * 0.6, y + s * 0.5], fill=(214, 200, 170), outline=I, width=2)
        d.ellipse([x - s * 0.35, y - s * 0.3, x - s * 0.1, y - s * 0.05], fill=(60, 40, 30))
        d.ellipse([x + s * 0.1, y - s * 0.3, x + s * 0.35, y - s * 0.05], fill=(60, 40, 30))
        d.line([(x - s * 0.9, y + s * 0.5), (x + s * 0.9, y + s * 0.5)], fill=(200, 170, 110), width=6)
        for k in range(-2, 3):
            d.line([(x + k * s * 0.4, y + s * 0.3), (x + k * s * 0.5, y + s * 0.95)], fill=(176, 164, 140), width=3)
    elif kind == 'crystal':
        for ox, hh, col in ((-0.4, 1.0, (150, 120, 214)), (0.35, 1.3, (100, 196, 210)), (0, 1.8, (196, 140, 220)), (0.7, 0.8, (150, 120, 214))):
            px = x + ox * s
            pts = [(px, y + s * 0.5 - hh * s), (px + s * 0.22, y + s * 0.5 - hh * s * 0.6), (px + s * 0.18, y + s * 0.5), (px - s * 0.18, y + s * 0.5), (px - s * 0.22, y + s * 0.5 - hh * s * 0.6)]
            d.polygon(pts, fill=col, outline=I)
            d.line([(px, y + s * 0.5 - hh * s), (px - s * 0.05, y + s * 0.45)], fill=(250, 246, 255))
        d.ellipse([x - s * 1.2, y - s * 1.5, x + s * 1.2, y + s * 0.8], outline=(200, 160, 255, 110), width=3)
    elif kind == 'henge':
        for k in range(10):
            a = k / 10 * 2 * math.pi
            px, py = x + s * 0.8 * math.cos(a), y + s * 0.45 * math.sin(a)
            d.rectangle([px - 3, py - 8, px + 3, py + 2], fill=(170, 164, 156), outline=I)
    elif kind == 'cube':
        a = s * 0.6
        top = [(x, y - a), (x + a, y - a * 0.5), (x, y), (x - a, y - a * 0.5)]
        d.polygon(top, fill=(226, 226, 222), outline=I)
        d.polygon([(x - a, y - a * 0.5), (x, y), (x, y + a), (x - a, y + a * 0.5)], fill=(180, 180, 176), outline=I)
        d.polygon([(x + a, y - a * 0.5), (x, y), (x, y + a), (x + a, y + a * 0.5)], fill=(140, 140, 138), outline=I)


# ---------------------------------------------------------------- a cell, start to finish

def bezier(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (k / n for k in range(n + 1))]


def dashed(d, pts, fill, width=2, on=5, off=4):
    acc, draw_on = 0.0, True
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        t = 0.0
        while t < seg:
            step = min((on if draw_on else off) - acc, seg - t)
            if draw_on:
                a, b = t / seg, (t + step) / seg
                d.line([(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a), (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)], fill=fill, width=width)
            t += step
            acc += step
            if acc >= (on if draw_on else off) - 1e-6:
                acc, draw_on = 0.0, not draw_on


def render_cell(name, biome, icon_kind, ring, seed):
    rng = np.random.default_rng(seed)
    c = Cell(rng)
    BIOMES[biome](c)
    neon = getattr(c, 'neon', False)
    # base colour: relief, forest tint, water, coast
    s = hillshade(blur(c.h, 2), c.z * 0.45) if c.z > 0 else np.zeros((C, C), np.float32)
    s = np.clip(s, -0.45, 0.3)
    land = c.land * (1 + 0.75 * c.relief_k * s)[..., None]
    land = mix(land, (250, 246, 236), np.clip(c.h - 0.6, 0, 1) * 0.12)
    tint = np.zeros((C, C), np.float32)
    for dens, *_ in c.trees:
        tint = np.maximum(tint, blur(dens.astype(np.float32), 3))
    land = land * (1 - c.forest_tint * tint)[..., None]
    if c.water is None:
        near = blur(c.L, 9)
        c.water = mix(SEA_DEEP, SEA_SHALLOW, np.clip(near * 2.2, 0, 1))
        for lev, a in ((0.3, 0.32), (0.16, 0.22), (0.07, 0.14)):
            c.water = mix(c.water, (78, 110, 134), contour(near, lev, 0.9) * a)
    if getattr(c, 'sky', False):
        drop = np.roll(np.roll(c.L, 14, 0), 9, 1)
        cliff = np.clip(np.roll(c.L, 7, 0) - c.L, 0, 1)
        c.water = mix(c.water, (150, 160, 180), blur(drop, 5) * 0.55 * (1 - c.L))
        c.water = mix(c.water, (128, 100, 76), cliff)
    rgb = mix(c.water, land, c.L)
    if c.coast_ink and c.L.min() < 0.5:
        rgb = mix(rgb, (70, 60, 50), contour(c.L, 0.5, 1.1) * 0.85)
    if not neon:
        rgb = rgb * (0.97 + 0.06 * fbm(rng, C, 16, 2))[..., None]
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(img, 'RGBA')

    lx, ly = c.landmark
    # the four edge entries: 15 m road, 50 m in (G454 contract), then a trail to the landmark
    clear = Image.new('L', (C, C), 0)
    cd = ImageDraw.Draw(clear)
    trails = []
    for ex, ey, ix, iy in ((C / 2, 0, C / 2, 32), (C / 2, C, C / 2, C - 32), (0, C / 2, 32, C / 2), (C, C / 2, C - 32, C / 2)):
        trails.append(((ex, ey), (ix, iy)))
        cd.line([(ex, ey), (ix, iy)], fill=255, width=22)
        if c.trails:
            mid = ((ix + lx) / 2 + rng.uniform(-60, 60), (iy + ly) / 2 + rng.uniform(-60, 60))
            pts = bezier((ix, iy), mid, (lx, ly + 10))
            cd.line(pts, fill=255, width=10)
            trails.append(pts)
    cd.ellipse([lx - 46, ly - 54, lx + 46, ly + 34], fill=255)
    clear = np.asarray(clear).astype(np.float32) / 255

    def draw_trails(dr):
        for k, t in enumerate(trails):
            if len(t) == 2:
                dr.line(t, fill=(108, 72, 52), width=12)
                dr.line(t, fill=(236, 226, 200), width=8)
            else:
                dashed(dr, t, (120, 74, 52), 2)
    c.ops.append((3, draw_trails))

    for order, op in sorted((o for o in c.ops if o[0] < 5), key=lambda o: o[0]):
        op(d)
    # trees and other scatter, sorted top to bottom
    glyphs = []
    for dens, step, kind, (r0, r1), cols in c.trees:
        dm = dens * (c.L > 0.6) * (1 - clear)
        for px, py in jitter_points(rng, dm, step):
            glyphs.append((py, px, kind, rng.uniform(r0, r1), cols[rng.integers(len(cols))]))
    if c.peaks is not None:
        dm = (c.h > c.peaks).astype(np.float32) * (1 - clear) * 0.55
        for px, py in jitter_points(rng, dm, 22, 18):
            glyphs.append((py, px, 'peak', 9 + 12 * (c.h[int(py), int(px)] - c.peaks) / (1 - c.peaks + 1e-6), None))
    if getattr(c, 'houses', 0) or biome in ('lake', 'steppe', 'island', 'forest', 'pine') and ring <= 2:
        for _ in range(getattr(c, 'houses', 6)):
            a, rr = rng.uniform(0, 2 * math.pi), rng.uniform(30, 60)
            hx, hy = lx + rr * math.cos(a), ly + 8 + rr * 0.6 * math.sin(a)
            if 10 < hx < C - 10 and 10 < hy < C - 10 and c.L[int(hy), int(hx)] > 0.6:
                glyphs.append((hy, hx, 'house', 3.6, None))
    glyphs.sort(key=lambda g: g[0])
    for py, px, kind, r, col in glyphs:
        if kind == 'peak':
            peak_glyph(d, px, py, r)
        elif kind == 'house':
            house_glyph(d, px, py, r)
        else:
            tree_glyph(d, px, py, kind, r, col)
    if getattr(c, 'lanterns', False) and ring <= 2:
        for _ in range(40):
            a, rr = rng.uniform(0, 2 * math.pi), rng.uniform(0.06, 0.26) * C
            qx, qy = C * 0.5 + rr * math.cos(a), C * 0.46 + rr * math.sin(a)
            if c.L[int(qy), int(qx)] < 0.4:
                d.ellipse([qx - 4, qy - 4, qx + 4, qy + 4], fill=(255, 200, 90, 70))
                d.ellipse([qx - 1.5, qy - 1.5, qx + 1.5, qy + 1.5], fill=(255, 214, 110))
    for order, op in sorted((o for o in c.ops if o[0] >= 5), key=lambda o: o[0]):
        op(d)
    if icon_kind:
        s = [46, 34, 26, 20, 16][ring]
        icon(d, icon_kind, lx, ly, s, neon)
    # age: the frontier's ink fades
    arr = np.asarray(img).astype(np.float32)
    if not neon:
        arr = arr * 0.86 + np.array(PAPER, np.float32) * 0.14
    fade = [0.0, 0.0, 0.05, 0.15, 0.32][ring]
    if '(abandoned)' in name:
        fade += 0.16
    if fade:
        grey = arr.mean(-1, keepdims=True)
        arr = arr * (1 - fade) + (grey * 0.5 + np.array(PAPER) * 0.5) * fade
    if ring == 0:
        arr = arr * 1.04 + np.array([6, 3, -4])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')


# ---------------------------------------------------------------- layout

def place_shards(rng):
    """Ranks fill the rings from the centre out; within a ring, avoid repeating a neighbour's biome."""
    cells = [(i, j) for j in range(N) for i in range(N)]
    by_ring = {r: [] for r in range(5)}
    for i, j in cells:
        by_ring[ring_of(i, j)].append((i, j))
    placed = {}
    start = 0
    for r in range(5):
        ring_cells = sorted(by_ring[r], key=lambda ij: math.atan2(ij[1] - 4.5, ij[0] - 4.5))
        pool = list(range(start, start + len(ring_cells)))
        start += len(ring_cells)
        rng.shuffle(pool)
        for (i, j) in ring_cells:
            nb = {SHARDS[placed[n]][1] for n in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1)) if n in placed}
            pick = next((k for k in pool if SHARDS[k][1] not in nb), pool[0])
            pool.remove(pick)
            placed[(i, j)] = pick
    return placed


def cell_xy(i, j):
    return GX0 + i * P, GY0 + j * P


def paper(rng, w, h):
    n = up(rng.random((60, 50)), w, h) * 0.6 + up(rng.random((240, 200)), w, h) * 0.4
    base = np.array(PAPER, np.float32)
    arr = base * (0.94 + 0.08 * n)[..., None]
    return arr


def spaced(d, xy, text, f, fill, spacing, anchor='mm', stroke=0, stroke_fill=None):
    widths = [d.textlength(ch, font=f) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = xy[0] - total / 2
    for ch, w in zip(text, widths):
        d.text((x + w / 2, xy[1]), ch, font=f, fill=fill, anchor='mm', stroke_width=stroke, stroke_fill=stroke_fill)
        x += w + spacing
    return total


def fit_font(d, text, name, size, index, maxw, spacing=0):
    while size > 10:
        f = font(name, size, index)
        if d.textlength(text, font=f) + spacing * (len(text) - 1) <= maxw:
            return f
        size -= 1
    return font(name, size, index)


def main():
    rng = np.random.default_rng(SEED)
    placed = place_shards(rng)
    base = paper(rng, W, H)
    # the radiant warmth of the Heart, under everything
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rr = np.hypot(xx - HEART[0], yy - HEART[1])
    base = mix(base, (246, 220, 160), np.exp(-(rr / 1500) ** 2) * 0.35)
    canvas = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(canvas, 'RGBA')

    # unclaimed plots beyond the hundred: the grid goes on
    for j in range(-3, N + 3):
        for i in range(-2, N + 2):
            if 0 <= i < N and 0 <= j < N:
                continue
            x0, y0 = cell_xy(i, j)
            if x0 + C < 0 or y0 + C < 0 or x0 > W or y0 > H:
                continue
            d.rectangle([x0, y0, x0 + C, y0 + C], fill=(242, 234, 212, 140))
            for k in range(-C, C, 22):
                d.line([(x0 + max(0, k), y0 + max(0, -k)), (x0 + min(C, C + k), y0 + min(C, C - k))], fill=(196, 182, 150, 70))
            dashed(d, [(x0, y0), (x0 + C, y0), (x0 + C, y0 + C), (x0, y0 + C), (x0, y0)], (160, 140, 110, 160), 2, 10, 8)

    # roads: the 15 m boulevard down the middle of every gap; solid inside the hundred, ghosted beyond
    road_w = G * 15 / 62.5
    lo, hi = GX0 - G / 2, GX0 + N * P - G / 2
    loy, hiy = GY0 - G / 2, GY0 + N * P - G / 2
    for k in range(-2, N + 3):
        x = GX0 + k * P - G / 2
        y = GY0 + k * P - G / 2
        inside = 0 <= k <= N
        for seg in ((x, 0, x, H), ):
            if inside:
                d.line([(x, loy), (x, hiy)], fill=(214, 204, 172), width=int(G))
        if 0 <= k <= N:
            d.line([(lo, y), (hi, y)], fill=(214, 204, 172), width=int(G))
    for k in range(-2, N + 3):
        x = GX0 + k * P - G / 2
        y = GY0 + k * P - G / 2
        dashed(d, [(x, 0), (x, H)], (170, 150, 120, 150), 3, 18, 12)
        dashed(d, [(0, y), (W, y)], (170, 150, 120, 150), 3, 18, 12)
    for k in range(0, N + 1):
        x = GX0 + k * P - G / 2
        y = GY0 + k * P - G / 2
        for a, b in (((x, loy), (x, hiy)), ((lo, y), (hi, y))):
            d.line([a, b], fill=(104, 70, 52), width=int(road_w + 4))
            d.line([a, b], fill=(240, 230, 204), width=int(road_w))
    # the boulevard gilds toward the Heart
    for k in range(0, N + 1):
        x = GX0 + k * P - G / 2
        y = GY0 + k * P - G / 2
        for step in range(0, N * P, 12):
            for (px, py) in ((x, loy + step), (lo + step, y)):
                g = math.exp(-(math.hypot(px - HEART[0], py - HEART[1]) / 1300) ** 2)
                if g > 0.08:
                    d.line([(px, py), (px + (0 if px == x else 12), py + (12 if px == x else 0))], fill=(214, 166, 60, int(200 * g)), width=int(road_w - 2))
        dashed(d, [(x, loy), (x, hiy)], (160, 64, 48, 200), 1, 7, 6)
        dashed(d, [(lo, y), (hi, y)], (160, 64, 48, 200), 1, 7, 6)

    # the hundred shards
    lab = []
    for (i, j), k in placed.items():
        name, biome, ic, genre = SHARDS[k]
        r = ring_of(i, j)
        img = render_cell(name, biome, ic, r, SEED * 1000 + k)
        x0, y0 = cell_xy(i, j)
        d.rectangle([x0 + 5, y0 + 7, x0 + C + 5, y0 + C + 7], fill=(60, 44, 30, 70))   # a drop shadow lifts each plot
        canvas.paste(img, (x0, y0))
        lab.append((i, j, k, r))
    d = ImageDraw.Draw(canvas, 'RGBA')

    # plot borders: gilt at the Heart, plain ink further out, dashed for the abandoned
    for i, j, k, r in lab:
        x0, y0 = cell_xy(i, j)
        name = SHARDS[k][0]
        box = [(x0, y0), (x0 + C, y0), (x0 + C, y0 + C), (x0, y0 + C), (x0, y0)]
        if '(abandoned)' in name:
            dashed(d, box, INK, 2, 9, 7)
        else:
            d.rectangle([x0, y0, x0 + C, y0 + C], outline=INK, width=2 if r else 3)
        if r == 0:
            d.rectangle([x0 + 5, y0 + 5, x0 + C - 5, y0 + C - 5], outline=(200, 156, 60), width=3)
        elif r == 1:
            d.rectangle([x0 + 4, y0 + 4, x0 + C - 4, y0 + C - 4], outline=(200, 160, 80, 160), width=1)

    # light columns at every junction
    for a in range(0, N + 1):
        for b in range(0, N + 1):
            x, y = GX0 + a * P - G / 2, GY0 + b * P - G / 2
            g = math.exp(-(math.hypot(x - HEART[0], y - HEART[1]) / 1600) ** 2)
            rr2 = 9 + 6 * g
            d.ellipse([x - rr2 * 2, y - rr2 * 2, x + rr2 * 2, y + rr2 * 2], fill=(255, 236, 170, int(40 + 70 * g)))
            d.ellipse([x - rr2 * 0.6, y - rr2 * 0.6, x + rr2 * 0.6, y + rr2 * 0.6], fill=(255, 248, 220), outline=(150, 110, 40), width=2)

    # the Heart: the world's origin, where the four most played shards meet
    hx, hy = HEART
    for rad, al in ((190, 40), (130, 70), (90, 110)):
        d.ellipse([hx - rad, hy - rad, hx + rad, hy + rad], fill=(255, 226, 140, al))
    star(d, hx, hy, 120, 34, 8, (232, 186, 70), (120, 80, 30))
    star(d, hx, hy, 82, 20, 4, (250, 236, 200), INK, rot=math.pi / 4)
    d.ellipse([hx - 22, hy - 22, hx + 22, hy + 22], fill=(196, 52, 44), outline=INK, width=3)
    d.ellipse([hx - 8, hy - 8, hx + 8, hy + 8], fill=(255, 240, 200))

    # names
    halo = (244, 236, 214)
    for i, j, k, r in lab:
        name, biome, ic, genre = SHARDS[k]
        x0, y0 = cell_xy(i, j)
        cx = x0 + C / 2
        dark = biome in ('neon',)
        fill = (250, 236, 220) if dark else INK
        sf = (52, 40, 70) if dark else halo
        rank = k + 1
        if r == 0:
            sp = 6 if len(name) < 13 else 1
            f = fit_font(d, name.upper(), 'Copperplate.ttc', 34, 2, C - 24, sp)
            spaced(d, (cx, y0 + C - 46), name.upper(), f, fill, sp, stroke=4, stroke_fill=sf)
            g = font('Hoefler Text.ttc', 21, 2)
            d.text((cx, y0 + C - 18), genre, font=g, fill=(120, 40, 30) if not dark else (255, 200, 120), anchor='mm', stroke_width=3, stroke_fill=sf)
        elif r <= 2:
            size = 27 if r == 1 else 22
            f = fit_font(d, name.upper(), 'Copperplate.ttc', size, 2 if r == 1 else 0, C - 24, 3)
            spaced(d, (cx, y0 + C - 40), name.upper(), f, fill, 3, stroke=3, stroke_fill=sf)
            if genre:
                g = font('Hoefler Text.ttc', 18 if r == 1 else 16, 2)
                d.text((cx, y0 + C - 16), genre, font=g, fill=(120, 40, 30) if not dark else (255, 200, 120), anchor='mm', stroke_width=3, stroke_fill=sf)
        else:
            idx = 0 if r == 3 else 2
            f = fit_font(d, name, 'Hoefler Text.ttc', 22 if r == 3 else 20, idx, C - 20)
            ty = y0 + C - (34 if genre else 22)
            d.text((cx, ty), name, font=f, fill=fill if r == 3 else (96, 80, 66), anchor='mm', stroke_width=3, stroke_fill=sf)
            if genre:
                g = font('Hoefler Text.ttc', 15, 2)
                d.text((cx, y0 + C - 13), genre, font=g, fill=(120, 40, 30) if not dark else (255, 200, 120), anchor='mm', stroke_width=3, stroke_fill=sf)
        # rank medallion
        mr = [22, 17, 15, 13, 12][r]
        mx, my = x0 + mr + 8, y0 + mr + 8
        medal = [(226, 180, 64), (214, 200, 176), (226, 214, 192), (232, 224, 204), (236, 228, 210)][r]
        d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=medal, outline=INK, width=2)
        fz = font('Baskerville.ttc', [22, 17, 15, 13, 12][r], 1)
        d.text((mx, my + 1), str(rank), font=fz, fill=INK, anchor='mm')

    ring_labels(d)
    # the Heart's warmth over the plots too
    arr = np.asarray(canvas).astype(np.float32)
    arr = mix(arr, (255, 214, 130), np.exp(-(rr / 1000) ** 2) * 0.13)
    canvas = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    furniture(canvas, rng, placed)
    canvas = finish(canvas, rng)
    canvas.save(OUT)
    print('wrote', OUT, canvas.size)


def star(d, x, y, R, r, n, fill, outline, rot=0.0):
    pts = []
    for k in range(2 * n):
        a = rot - math.pi / 2 + k * math.pi / n
        rad = R if k % 2 == 0 else r
        pts.append((x + rad * math.cos(a), y + rad * math.sin(a)))
    d.polygon(pts, fill=fill, outline=outline, width=2)
    for k in range(0, 2 * n, 2):
        a = rot - math.pi / 2 + k * math.pi / n
        d.polygon([(x, y), (x + R * math.cos(a), y + R * math.sin(a)), (x + r * math.cos(a + math.pi / n), y + r * math.sin(a + math.pi / n))], fill=shade_col(fill, 0.78))


def ring_labels(d):
    """Name the rings along the boulevard north of the Heart, Vaelmora's way of naming a road."""
    f = font('Hoefler Text.ttc', 22, 2)
    for r, name in enumerate(RING_NAMES[1:], start=1):
        y = HEART[1] - r * P
        x = HEART[0] + P / 2 + 6
        d.text((x, y), name, font=f, fill=(110, 60, 40), anchor='mm', stroke_width=4, stroke_fill=(240, 230, 204))


def furniture(canvas, rng, placed):
    d = ImageDraw.Draw(canvas, 'RGBA')
    cream = (240, 232, 212)
    # title cartouche
    tw, th = 2100, 300
    tx, ty = (W - tw) // 2, 150
    for side in (-1, 1):
        ex = tx if side < 0 else tx + tw
        d.polygon([(ex, ty + 40), (ex + side * 150, ty + 60), (ex + side * 100, ty + th / 2), (ex + side * 150, ty + th - 60), (ex, ty + th - 40)], fill=(226, 214, 186), outline=INK, width=3)
    d.rectangle([tx, ty, tx + tw, ty + th], fill=cream, outline=INK, width=4)
    d.rectangle([tx + 14, ty + 14, tx + tw - 14, ty + th - 14], outline=INK, width=2)
    title = font('Baskerville.ttc', 150, 3)
    d.text((W / 2, ty + 120), 'Wildshard', font=title, fill=INK, anchor='mm')
    sub = font('Hoefler Text.ttc', 40, 2)
    d.text((W / 2, ty + 222), 'the Grid at One Hundred Shards  ·  a draft chart of version 1.0', font=sub, fill=(90, 70, 56), anchor='mm')
    for side in (-1, 1):
        dx = W / 2 + side * 640
        d.polygon([(dx, ty + 108), (dx + 14, ty + 120), (dx, ty + 132), (dx - 14, ty + 120)], fill=(170, 50, 40))
        d.line([(dx + side * 30, ty + 120), (dx + side * 170, ty + 120)], fill=INK, width=2)

    compass(d, W - 380, 380, 190)

    # legend (bottom left) and the most played (bottom right)
    by = GY0 + N * P + 40
    lx0, lx1 = 140, 1880
    d.rectangle([lx0, by, lx1, H - 140], fill=cream, outline=INK, width=3)
    d.rectangle([lx0 + 10, by + 10, lx1 - 10, H - 150], outline=INK, width=1)
    hf = font('Baskerville.ttc', 46, 3)
    d.text(((lx0 + lx1) / 2, by + 56), 'Legend', font=hf, fill=INK, anchor='mm')
    item = font('Hoefler Text.ttc', 30, 0)
    rows = [
        ('plot', 'A shard: one upload, 500 m square'),
        ('road', 'The Boulevard (15 m, owned by the grid)'),
        ('column', 'Light column at a junction'),
        ('heart', 'The Heart of the Grid (0, 0)'),
        ('medal', 'Rank by players this season'),
        ('trail', 'Edge entry and trail'),
        ('lair', 'Lair of a raid or world boss'),
        ('peak', 'Peak'),
        ('abandoned', 'Abandoned (no update in a season)'),
        ('ghost', 'Unclaimed plot: the grid goes on'),
    ]
    yy = by + 120
    col2 = lx0 + 880
    for n, (kind, text) in enumerate(rows):
        x = lx0 + 60 if n < 5 else col2
        y = yy + (n % 5) * 70
        legend_glyph(d, kind, x + 40, y)
        d.text((x + 100, y), text, font=item, fill=INK, anchor='lm')
    # ring key
    ky = yy + 5 * 70 + 20
    d.line([(lx0 + 40, ky - 20), (lx1 - 40, ky - 20)], fill=INK, width=1)
    rk = font('Hoefler Text.ttc', 27, 2)
    spans = ['1–4', '5–16', '17–36', '37–64', '65–100']
    sw = (lx1 - lx0 - 80) / 5
    for r, (nm, sp) in enumerate(zip(RING_NAMES, spans)):
        x = lx0 + 40 + r * sw + sw / 2
        medal = [(226, 180, 64), (214, 200, 176), (226, 214, 192), (232, 224, 204), (236, 228, 210)][r]
        d.ellipse([x - 26, ky + 10, x + 26, ky + 62], fill=medal, outline=INK, width=2)
        d.text((x, ky + 37), sp.split('–')[0], font=font('Baskerville.ttc', 22, 1), fill=INK, anchor='mm')
        d.text((x, ky + 92), nm, font=rk, fill=INK, anchor='mm')
        d.text((x, ky + 126), 'ranks ' + sp, font=font('Hoefler Text.ttc', 23, 0), fill=(110, 90, 72), anchor='mm')
    # the move rule, in a line
    d.text(((lx0 + lx1) / 2, H - 182), 'Each season the most played shards move toward the Heart; quiet and unmaintained ones drift out to the Frontier.',
           font=font('Hoefler Text.ttc', 25, 2), fill=(110, 60, 40), anchor='mm')
    # scale bar: 1 km = 1000 m * 0.64 px/m
    sx, sy = lx1 - 40 - 640 * 1.0, by - 0
    # the most played
    rx0, rx1 = 1960, W - 140
    d.rectangle([rx0, by, rx1, H - 140], fill=cream, outline=INK, width=3)
    d.rectangle([rx0 + 10, by + 10, rx1 - 10, H - 150], outline=INK, width=1)
    d.text(((rx0 + rx1) / 2, by + 56), 'The Most Played', font=hf, fill=INK, anchor='mm')
    nf = font('Copperplate.ttc', 30, 2)
    gf = font('Hoefler Text.ttc', 26, 2)
    for k in range(16):
        name, biome, ic, genre = SHARDS[k]
        col = k // 8
        x = rx0 + 60 + col * ((rx1 - rx0 - 80) / 2)
        y = by + 124 + (k % 8) * 62
        r = 0 if k < 4 else 1
        medal = [(226, 180, 64), (214, 200, 176)][r]
        d.ellipse([x, y - 22, x + 44, y + 22], fill=medal, outline=INK, width=2)
        d.text((x + 22, y + 1), str(k + 1), font=font('Baskerville.ttc', 22, 1), fill=INK, anchor='mm')
        d.text((x + 64, y - 10), name.upper(), font=nf, fill=INK, anchor='lm')
        d.text((x + 64, y + 20), genre, font=gf, fill=(120, 40, 30), anchor='lm')
    # scale bar along the bottom of the most-played box
    km = 1000 * C / 500
    bx, byy = rx0 + 60, H - 214
    d.text((bx + km, byy - 40), 'Scale of kilometres', font=font('Hoefler Text.ttc', 26, 2), fill=INK, anchor='mm')
    for q in range(4):
        d.rectangle([bx + q * km / 2, byy, bx + (q + 1) * km / 2, byy + 16], fill=INK if q % 2 == 0 else cream, outline=INK, width=2)
    for q in range(5):
        d.text((bx + q * km / 2, byy + 40), f'{q * 0.5:g}', font=font('Hoefler Text.ttc', 24, 0), fill=INK, anchor='mm')
    d.text((bx + 2 * km + 50, byy + 10), 'km', font=font('Hoefler Text.ttc', 24, 2), fill=INK, anchor='lm')
    d.text((rx1 - 60, byy + 10), 'Every name on this chart is invented for the draft.', font=font('Hoefler Text.ttc', 24, 2), fill=(110, 90, 72), anchor='rm')


def legend_glyph(d, kind, x, y):
    if kind == 'plot':
        d.rectangle([x - 26, y - 22, x + 26, y + 22], fill=(170, 188, 116), outline=INK, width=2)
    elif kind == 'road':
        d.line([(x - 40, y), (x + 40, y)], fill=(104, 70, 52), width=14)
        d.line([(x - 40, y), (x + 40, y)], fill=(240, 230, 204), width=10)
        dashed(d, [(x - 40, y), (x + 40, y)], (160, 64, 48), 1, 7, 6)
    elif kind == 'column':
        d.ellipse([x - 20, y - 20, x + 20, y + 20], fill=(255, 236, 170, 90))
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(255, 248, 220), outline=(150, 110, 40), width=2)
    elif kind == 'heart':
        star(d, x, y, 30, 9, 8, (232, 186, 70), (120, 80, 30))
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(196, 52, 44), outline=INK)
    elif kind == 'medal':
        d.ellipse([x - 20, y - 20, x + 20, y + 20], fill=(226, 180, 64), outline=INK, width=2)
        d.text((x, y + 1), '1', font=font('Baskerville.ttc', 22, 1), fill=INK, anchor='mm')
    elif kind == 'trail':
        d.line([(x - 40, y), (x - 10, y)], fill=(108, 72, 52), width=10)
        d.line([(x - 40, y), (x - 10, y)], fill=(236, 226, 200), width=6)
        dashed(d, [(x - 10, y), (x + 40, y - 10)], (120, 74, 52), 2)
    elif kind == 'lair':
        icon(d, 'lair', x, y, 30)
    elif kind == 'peak':
        peak_glyph(d, x, y + 6, 22)
    elif kind == 'abandoned':
        dashed(d, [(x - 26, y - 22), (x + 26, y - 22), (x + 26, y + 22), (x - 26, y + 22), (x - 26, y - 22)], INK, 2, 8, 6)
    elif kind == 'ghost':
        d.rectangle([x - 26, y - 22, x + 26, y + 22], fill=(242, 234, 212))
        dashed(d, [(x - 26, y - 22), (x + 26, y - 22), (x + 26, y + 22), (x - 26, y + 22), (x - 26, y - 22)], (160, 140, 110), 2, 8, 6)


def compass(d, x, y, R):
    d.ellipse([x - R * 0.72, y - R * 0.72, x + R * 0.72, y + R * 0.72], outline=INK, width=2)
    d.ellipse([x - R * 0.64, y - R * 0.64, x + R * 0.64, y + R * 0.64], outline=INK, width=1)
    for k in range(32):
        a = k / 32 * 2 * math.pi
        d.line([(x + R * 0.64 * math.cos(a), y + R * 0.64 * math.sin(a)), (x + R * 0.72 * math.cos(a), y + R * 0.72 * math.sin(a))], fill=INK)
    star(d, x, y, R * 0.6, R * 0.1, 8, (214, 200, 170), INK, rot=math.pi / 8)
    for k in range(4):
        a = -math.pi / 2 + k * math.pi / 2
        col = (176, 40, 36) if k == 0 else (60, 50, 44)
        tip = (x + R * math.cos(a), y + R * math.sin(a))
        l = (x + R * 0.14 * math.cos(a - math.pi / 2), y + R * 0.14 * math.sin(a - math.pi / 2))
        r = (x + R * 0.14 * math.cos(a + math.pi / 2), y + R * 0.14 * math.sin(a + math.pi / 2))
        d.polygon([tip, l, (x, y)], fill=col, outline=INK)
        d.polygon([tip, r, (x, y)], fill=(240, 232, 212), outline=INK)
    f = font('Baskerville.ttc', 44, 1)
    for k, lab in enumerate('NESW'):
        a = -math.pi / 2 + k * math.pi / 2
        d.text((x + R * 1.18 * math.cos(a), y + R * 1.18 * math.sin(a)), lab, font=f, fill=INK, anchor='mm', stroke_width=4, stroke_fill=(240, 232, 212))
    d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(240, 232, 212), outline=INK, width=2)


def finish(canvas, rng):
    arr = np.asarray(canvas).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    arr *= (1 - 0.16 * smooth(0.7, 1.45, v))[..., None]
    grain = up(rng.random((H // 8, W // 8)), W, H)
    arr *= (0.975 + 0.05 * grain)[..., None]
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(out, 'RGBA')
    # the frame: an outer band of alternating ink and paper, a red diamond at each edge's middle, starred corners
    m = 56
    d.rectangle([0, 0, W, m], fill=(226, 214, 186))
    d.rectangle([0, H - m, W, H], fill=(226, 214, 186))
    d.rectangle([0, 0, m, H], fill=(226, 214, 186))
    d.rectangle([W - m, 0, W, H], fill=(226, 214, 186))
    d.rectangle([m, m, W - m, H - m], outline=INK, width=4)
    d.rectangle([m - 26, m - 26, W - m + 26, H - m + 26], outline=INK, width=2)
    seg = 120
    for x in range(m, W - m, seg):
        if (x // seg) % 2 == 0:
            d.rectangle([x, m - 16, min(x + seg, W - m), m - 6], fill=(70, 50, 40))
            d.rectangle([x, H - m + 6, min(x + seg, W - m), H - m + 16], fill=(70, 50, 40))
    for y in range(m, H - m, seg):
        if (y // seg) % 2 == 0:
            d.rectangle([m - 16, y, m - 6, min(y + seg, H - m)], fill=(70, 50, 40))
            d.rectangle([W - m + 6, y, W - m + 16, min(y + seg, H - m)], fill=(70, 50, 40))
    for (x, y) in ((W / 2, m - 11), (W / 2, H - m + 11), (m - 11, H / 2), (W - m + 11, H / 2)):
        d.polygon([(x, y - 14), (x + 14, y), (x, y + 14), (x - 14, y)], fill=(176, 40, 36), outline=INK)
    for (x, y) in ((m - 11, m - 11), (W - m + 11, m - 11), (m - 11, H - m + 11), (W - m + 11, H - m + 11)):
        d.rectangle([x - 26, y - 26, x + 26, y + 26], fill=(226, 214, 186), outline=INK, width=2)
        star(d, x, y, 22, 6, 4, (176, 40, 36), INK)
    return out


if __name__ == '__main__':
    main()
