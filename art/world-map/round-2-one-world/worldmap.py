#!/usr/bin/env python3
"""A draft chart of Wildshard 1.0, round 2: one continuous world (E505).

Round 1 drew a hundred map tiles with a road between them. Jake: "it needs to look like one gigantic world where
someone built the most ridiculous grid highway system you've ever seen natively in the map". So here every field
(height, land and sea, colour, forests, clouds, lava) is one world-wide raster: each shard writes its own design
into a window around its cell and the windows blend across the 62.5 m gaps, so a sea, a mountain range or a drop
into the clouds runs straight through a seam. The boulevard is graded into the land: embankments and cuttings,
bridges over water, viaducts over the cloud drops, tunnels under high peaks, an interchange with a light column at
every junction and the grand interchange at the Heart. Each shard's four edge entries are gates off the boulevard
that become the shard's own roads into its town.

Style: the Isle of Vaelmora map Jake approved (x.com/xikhar/status/2114455448946700694). Every shard is invented.

    python3 art/world-map/round-2-one-world/worldmap.py tmp/world-map/full.png
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else 'tmp/world-map/full.png'
SEED = 2025
C, G = 320, 40                 # a 500 m cell and its 62.5 m gap, full-res pixels
P = C + G
N = 10
W, H = 4400, 5300
GX0 = (W - (N * C + (N - 1) * G)) // 2
GY0 = 780
HEART = (GX0 + 5 * P - G / 2, GY0 + 5 * P - G / 2)
FS = 2                          # fields are computed at half resolution
FX0, FY0 = GX0 - P, GY0 - P     # the field covers the hundred plus one unclaimed ring
FN = 12 * P // FS               # 2160
CH = C // FS                    # a cell in field pixels (160)
WM = 128                        # window margin in field pixels (0.8 cell)
WN = CH + 2 * WM                # window size (352)
INK = (58, 44, 34)
PAPER = (238, 228, 202)
FONTS = '/System/Library/Fonts/Supplemental/'


def font(name, size, index=0):
    return ImageFont.truetype(FONTS + name, size, index=index)


# ---------------------------------------------------------------- raster helpers

def up(a, w, h):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((w, h), Image.BICUBIC))


def fbm(rng, n, base=3, octaves=5, pers=0.5):
    out = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        r = max(1, int(base * 2 ** o))
        g = rng.random((r + 3, r + 3)).astype(np.float32)
        k = max(1, n // r)
        big = up(g, n + 2 * k, n + 2 * k)
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


def ramp(h, stops):
    ts = np.array([s[0] for s in stops], np.float32)
    cs = np.array([s[1] for s in stops], np.float32)
    out = np.empty(np.shape(h) + (3,), np.float32)
    for k in range(3):
        out[..., k] = np.interp(h, ts, cs[:, k])
    return out


def mix(a, b, t):
    t = t[..., None] if np.ndim(t) == 2 else t
    return np.asarray(a, np.float32) * (1 - t) + np.asarray(b, np.float32) * t


def contour(f, level, width=0.9):
    gy, gx = np.gradient(f)
    g = np.sqrt(gx * gx + gy * gy) + 1e-6
    return np.clip(1 - np.abs(f - level) / (g * width), 0, 1)


def shade_col(c, k):
    return tuple(int(max(0, min(255, v * k))) for v in c[:3])


def sample(field, x, y):
    """A field value at full-res canvas coordinates (nearest)."""
    fx = int((x - FX0) / FS)
    fy = int((y - FY0) / FS)
    if 0 <= fx < FN and 0 <= fy < FN:
        return field[fy, fx]
    return None


# ---------------------------------------------------------------- the hundred shards (all invented)

SHARDS = [
    ('Dragonspire', 'volcano', 'citadel', 'Raid · the Ember Wyrm'),
    ('Skyharbor', 'sky', 'airship', 'Sky port · airship races'),
    ('The Drowned Colossus', 'reef', 'colossus', 'Dive · titan quest'),
    ('Neon Lotus', 'neon', 'pagoda', 'Night market · duels'),
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


# ---------------------------------------------------------------- biomes
# Each writes its design into a window around its cell, in cell units u, v (0..1 over the cell, -0.6..1.6 over the
# window). Heights are absolute (0 low plain .. 1 high peak); `wet` is land (> 0) versus water (< 0).

TREE_KINDS = {
    'green': ('round', [(96, 132, 70), (110, 146, 78), (84, 120, 64), (122, 150, 82)], 6, (3.2, 4.6)),
    'jungle': ('round', [(72, 118, 60), (86, 132, 64), (60, 104, 56), (100, 140, 64)], 5, (3.4, 5.2)),
    'autumn': ('round', [(196, 92, 52), (210, 140, 60), (176, 66, 44), (202, 168, 72), (120, 140, 70)], 6, (3.2, 4.6)),
    'pink': ('round', [(232, 170, 190), (240, 196, 208), (218, 150, 176), (110, 146, 78)], 7, (3.0, 4.2)),
    'willow': ('round', [(112, 132, 86), (98, 120, 80), (126, 140, 96)], 7, (3.2, 4.6)),
    'pine': ('pine', [(62, 96, 66), (54, 86, 60), (72, 106, 72)], 6, (3.4, 4.8)),
    'snowpine': ('snowpine', [(62, 96, 66), (54, 86, 60)], 7, (3.0, 4.2)),
    'palm': ('palm', [(84, 130, 70), (100, 140, 74)], 7, (3.2, 4.2)),
    'reed': ('reed', [(96, 116, 80)], 8, (3, 4)),
    'crystal': ('crystal', [(150, 120, 214), (100, 196, 210), (196, 140, 220)], 7, (3, 6)),
    'dead': ('dead', [(100, 88, 76)], 9, (3, 4)),
    'cactus': ('cactus', [(112, 140, 84)], 10, (2.4, 3.2)),
    'tuft': ('tuft', [(150, 160, 96)], 9, (2.5, 3.5)),
    'flower': ('flower', [(220, 120, 150), (240, 220, 120), (170, 140, 210)], 8, (1.6, 2.2)),
}
GRASS = [(0, (186, 196, 128)), (0.5, (172, 188, 118)), (1, (156, 172, 106))]


class Win:
    def __init__(self, rng):
        self.rng = rng
        x = (np.arange(WN, dtype=np.float32) - WM) / CH
        self.u, self.v = np.meshgrid(x, x)
        self.d0 = np.hypot(self.u - 0.5, self.v - 0.5)
        self.dc = np.maximum(np.abs(self.u - 0.5), np.abs(self.v - 0.5))
        self.inside = smooth(0.62, 0.42, self.dc)       # 1 in the cell, 0 well past its edge
        self.h = np.full((WN, WN), 0.22, np.float32)
        self.wet = np.full((WN, WN), 0.4, np.float32)
        self.col = None
        self.wcol = None
        self.cloud = 0.0
        self.lava = None
        self.dens = {}
        self.hub = (0.5, 0.45)
        self.feats = []          # callables (draw, to_xy) drawn after the trees
        self.houses = 1.0
        self.roads = True

    def n(self, per_cell=3, octaves=5):
        return fbm(self.rng, WN, max(1, round(per_cell * WN / CH)), octaves)

    def r(self, per_cell=3, octaves=5):
        return ridged(self.rng, WN, max(1, round(per_cell * WN / CH)), octaves)


def b_wild(w):
    w.h = 0.2 + 0.12 * w.n(2)
    w.col = ramp(w.n(3), [(0, (196, 198, 150)), (1, (184, 190, 138))])
    w.dens['green'] = smooth(0.6, 0.8, w.n(3)) * 0.3
    w.houses = 0
    w.roads = False


def b_forest(w, kind='green', pal=GRASS, dense=0.92):
    w.h = 0.22 + 0.16 * w.n(3)
    w.col = ramp(w.n(3), pal)
    w.dens[kind] = smooth(0.32, 0.52, w.n(3, 4)) * dense


def b_autumn(w):
    b_forest(w, 'autumn', [(0, (198, 184, 122)), (1, (186, 172, 112))])


def b_pine(w):
    w.h = 0.26 + 0.22 * (w.n(3) * 0.7 + w.r(2) * 0.3)
    w.col = ramp(w.h, [(0.2, (168, 184, 122)), (0.4, (150, 166, 110)), (0.6, (170, 168, 140))])
    w.dens['pine'] = smooth(0.3, 0.5, w.n(3, 4)) * 0.95


def b_jungle(w):
    w.h = 0.2 + 0.14 * w.n(3)
    w.col = ramp(w.n(3), [(0, (132, 166, 96)), (1, (116, 150, 84))])
    w.dens['jungle'] = smooth(0.12, 0.38, w.n(4, 4)) * 0.98


def b_blossom(w):
    t = w.n(2)
    terr = np.floor(t * 9) / 9
    w.h = 0.24 + 0.22 * (terr * 0.7 + t * 0.3) * w.inside
    lines = sum(contour(t * 9, k, 0.8) for k in range(1, 9)) * w.inside
    w.col = mix(ramp(t, [(0, (192, 198, 136)), (1, (178, 186, 124))]), (128, 140, 92), np.clip(lines, 0, 1) * 0.45)
    w.dens['pink'] = smooth(0.4, 0.6, w.n(4, 4)) * 0.75


def b_steppe(w, pal=None):
    w.h = 0.2 + 0.14 * w.n(2)
    w.col = ramp(w.n(2), pal or [(0, (206, 202, 134)), (0.5, (194, 196, 124)), (1, (178, 186, 112))])
    w.dens['tuft'] = smooth(0.55, 0.7, w.n(5, 3)) * 0.35
    w.dens['green'] = smooth(0.72, 0.82, w.n(4, 3)) * 0.6


def b_meadow(w):
    b_steppe(w, [(0, (188, 200, 128)), (1, (168, 186, 112))])
    w.dens['flower'] = smooth(0.5, 0.7, w.n(6, 3)) * 0.3


def b_mountain(w, snow=0.72, pal=None, kind='pine'):
    r = w.r(2, 6)
    w.h = 0.26 + 0.74 * np.clip(r ** 1.5 * 0.85 + w.n(3, 4) * 0.15, 0, 1) * smooth(0.66, 0.2, w.dc)
    w.col = ramp(w.h, pal or [(0.2, (164, 180, 118)), (0.38, (150, 160, 112)), (0.55, (172, 162, 142)),
                              (snow, (206, 200, 190)), (snow + 0.08, (244, 244, 240)), (1, (250, 250, 248))])
    w.dens[kind] = (w.h < 0.48) * smooth(0.3, 0.5, w.n(3, 4)) * 0.9
    tarn = smooth(0.0, 0.03, 0.31 - w.h) * w.inside * (w.rng.random() < 0.6)
    w.wet = 0.4 - 0.5 * tarn


def b_glacier(w):
    b_mountain(w, 0.4, [(0.2, (196, 206, 206)), (0.36, (214, 222, 226)), (0.5, (234, 238, 242)), (1, (252, 252, 252))], 'snowpine')
    crev = sum(contour(w.n(6, 2), 0.5, 0.6) for _ in range(2)) * smooth(0.45, 0.6, w.h)
    w.col = mix(w.col, (150, 176, 196), np.clip(crev, 0, 1) * 0.5)


def b_snowlake(w):
    w.h = 0.22 + 0.1 * w.n(3)
    w.col = ramp(w.n(3), [(0, (230, 236, 238)), (1, (246, 248, 248))])
    w.wet = (w.d0 - 0.2 - 0.1 * (w.n(3) - 0.5)) * 2
    w.wcol = mix((172, 200, 214), (210, 226, 234), w.n(5, 3))
    w.dens['snowpine'] = smooth(0.5, 0.65, w.n(3, 4)) * 0.8
    w.hub = (0.5, 0.78)


def b_desert(w):
    warp = w.n(2, 4)
    a = w.rng.uniform(0, math.pi)
    u = (w.u * math.cos(a) + w.v * math.sin(a)) * 16 + warp * 9
    dunes = (np.sin(u) * 0.5 + 0.5) ** 1.6
    w.h = 0.2 + 0.16 * (dunes * 0.4 + w.n(2, 4) * 0.6)
    w.col = ramp(w.h, [(0.2, (226, 204, 138)), (0.28, (234, 212, 146)), (0.36, (240, 222, 160))])
    w.dens['cactus'] = smooth(0.72, 0.85, w.n(5, 3)) * 0.25


def b_saltflat(w):
    w.h = 0.18 + 0.04 * w.n(2, 4)
    cracks = sum(contour(w.n(8, 2), 0.5, 0.5) for _ in range(3)) * w.inside
    w.col = mix(ramp(w.n(2), [(0, (236, 234, 222)), (1, (246, 244, 236))]), (196, 192, 176), np.clip(cracks, 0, 1) * 0.6)


def b_oasis(w):
    b_desert(w)
    pond = 0.1 + 0.03 * (w.n(4) - 0.5) - np.hypot(w.u - 0.5, w.v - 0.55)
    w.wet = -pond * 3 + 0.02
    w.wcol = np.full((WN, WN, 3), (98, 154, 160), np.float32)
    ring = smooth(0.26, 0.1, np.hypot(w.u - 0.5, w.v - 0.55))
    w.col = mix(w.col, (176, 190, 120), ring * 0.7)
    w.dens = {'palm': ring * 0.8, 'cactus': w.dens['cactus']}
    w.hub = (0.5, 0.36)


def b_canyon(w):
    t = w.n(2, 6)
    mesa = np.floor(t * 7) / 7 * 0.75 + t * 0.25
    gx = 0.5 + 0.12 * np.sin(w.v * 7)
    gorge = np.exp(-((w.u - gx) / 0.05) ** 2) * smooth(0.58, 0.46, w.dc)
    w.h = 0.24 + 0.34 * mesa * smooth(0.62, 0.35, w.dc) * (1 - 0.85 * gorge)
    strata = sum(contour(t * 7, k, 0.7) for k in range(1, 7)) * w.inside
    w.col = mix(ramp(w.h, [(0.2, (186, 128, 86)), (0.32, (198, 128, 84)), (0.45, (214, 156, 104)), (0.58, (226, 182, 128))]), (132, 76, 52), np.clip(strata, 0, 1) * 0.5)
    w.col = mix(ramp(w.n(3), GRASS), w.col, w.inside)
    w.wet = 0.4 - 0.7 * smooth(0.5, 0.85, gorge)
    w.wcol = np.full((WN, WN, 3), (110, 150, 170), np.float32)
    w.dens['green'] = smooth(0.72, 0.85, w.n(4, 3)) * 0.4
    w.hub = (0.5, 0.3)


def b_crater(w):
    d = np.hypot(w.u - 0.5, w.v - 0.48)
    rim = np.exp(-((d - 0.3) / 0.06) ** 2)
    bowl = smooth(0.3, 0.0, d)
    w.h = 0.28 + rim * 0.5 - bowl * 0.12 + w.n(3) * 0.12
    w.col = ramp(w.h, [(0.2, (176, 180, 128)), (0.35, (168, 182, 116)), (0.6, (176, 164, 140)), (0.8, (214, 208, 196))])
    w.dens['green'] = (d > 0.38) * smooth(0.4, 0.6, w.n(3, 4)) * 0.9
    w.hub = (0.5, 0.48)


def b_lake(w):
    lake = 0.3 + 0.08 * (w.n(3) - 0.5) - np.hypot(w.u - 0.5, w.v - 0.46)
    isle = 0.06 - np.hypot(w.u - 0.5, w.v - 0.44)
    w.wet = np.where(isle > 0, isle * 4 + 0.02, -lake * 2.2 + 0.03)
    w.h = 0.2 + 0.14 * w.n(3)
    w.col = ramp(w.n(3), GRASS)
    w.dens['green'] = smooth(0.4, 0.6, w.n(3, 4)) * 0.85
    w.hub = (0.5, 0.44)
    w.lanterns = True


def b_swamp(w):
    w.h = 0.18 + 0.06 * w.n(4)
    pools = 0.36 - w.n(5, 4)
    w.wet = -pools * 1.2 + 0.03
    w.wcol = mix((96, 124, 112), (126, 150, 132), w.n(6, 2))
    w.col = ramp(w.n(3), [(0, (150, 164, 122)), (1, (138, 154, 112))])
    w.dens['reed'] = np.full((WN, WN), 0.45, np.float32)
    w.dens['willow'] = smooth(0.5, 0.7, w.n(3, 4)) * 0.8


def b_crystal(w):
    w.h = 0.28 + 0.42 * (w.r(3) * 0.7 + w.n(2, 4) * 0.3) * smooth(0.62, 0.3, w.dc)
    w.col = ramp(w.h, [(0.25, (160, 146, 160)), (0.45, (168, 152, 172)), (0.7, (198, 188, 200))])
    w.dens['crystal'] = smooth(0.42, 0.6, w.h) * 0.6


def b_volcano(w):
    cx, cy = 0.5, 0.42
    d = np.hypot(w.u - cx, w.v - cy)
    cone = np.clip(1 - d / 0.5, 0, 1) ** 1.25
    crater = np.exp(-(d / 0.055) ** 2)
    w.h = np.clip(0.24 + cone * 0.74 + w.n(4) * 0.06 - crater * 0.3, 0, 1)
    w.col = ramp(w.h, [(0.2, (176, 168, 148)), (0.4, (150, 136, 122)), (0.7, (122, 108, 100)), (1, (96, 86, 82))])
    a = np.arctan2(w.v - cy, w.u - cx)
    flow = np.abs(np.sin(a * 3.5 + w.n(3, 3) * 4 + d * 6))
    lava = smooth(0.14, 0.0, flow) * smooth(0.06, 0.09, d) * smooth(0.46, 0.28, d)
    w.lava = np.maximum(lava, smooth(0.045, 0.03, d))
    w.dens['dead'] = (d > 0.44) * smooth(0.5, 0.7, w.n(3, 3)) * 0.4
    w.hub = (0.5, 0.74)
    w.peak = (cx, cy)


def b_sky(w):
    w.cloud = 1.0
    land = np.full((WN, WN), -1.0, np.float32)
    n = w.n(4, 4)
    spots = [(0.5, 0.45, 0.22)] + [(w.rng.uniform(0.12, 0.88), w.rng.uniform(0.12, 0.88), w.rng.uniform(0.07, 0.12)) for _ in range(5)]
    for sx, sy, sr in spots:
        land = np.maximum(land, 1 - np.hypot(w.u - sx, w.v - sy) / sr + 0.5 * (n - 0.5))
    w.wet = land * 0.4 * w.inside - 0.35 * (1 - w.inside) * 0 + np.minimum(land, 0) * 0.0
    w.wet = np.where(w.inside > 0.05, land * 0.35, -0.4)
    w.h = 0.42 + 0.1 * w.n(3)
    w.col = ramp(w.n(3), GRASS)
    w.dens['green'] = smooth(0.45, 0.65, w.n(3, 4)) * 0.8


def b_reef(w):
    d = np.hypot(w.u - 0.5, w.v - 0.47)
    n = w.n(4)
    ring = 0.035 - np.abs(d - 0.34 - 0.05 * (n - 0.5))
    gaps = smooth(0.4, 0.6, w.n(3, 3) + 0.1)
    w.wet = np.where(ring > 0, ring * 3 * gaps - 0.01 * (1 - gaps), -0.08 - 0.5 * smooth(0.36, 0.7, d))
    lagoon = smooth(0.36, 0.2, d)
    w.wcol = mix(mix((92, 136, 160), (110, 180, 186), smooth(0.6, 0.3, d)), (150, 210, 200), lagoon * 0.8)
    coral = smooth(0.62, 0.75, w.n(6, 3)) * lagoon
    w.wcol = mix(w.wcol, (226, 156, 140), coral * 0.6)
    w.h = 0.18 + 0.04 * n
    w.col = ramp(n, [(0, (232, 220, 176)), (1, (214, 210, 150))])
    w.dens['palm'] = np.full((WN, WN), 0.5, np.float32)
    w.hub = (0.5, 0.46)


def b_island(w):
    v = 0.36 - w.d0 + 0.2 * (w.n(3) - 0.5)
    w.wet = v * 1.2
    w.h = 0.18 + np.clip(v, 0, None) * 0.9 + 0.08 * w.n(3)
    beach = smooth(0.1, 0.0, v)
    w.col = mix(ramp(w.n(3), GRASS), (232, 218, 172), beach)
    w.dens['palm' if w.rng.random() < 0.5 else 'green'] = (v > 0.08) * smooth(0.4, 0.6, w.n(3, 4)) * 0.85
    w.hub = (0.5, 0.44)


def b_archipelago(w):
    v = w.n(4) - 0.6 + 0.25 * (1 - w.d0 / 0.6)
    w.wet = v * 1.2
    w.h = 0.18 + np.clip(v, 0, None) * 1.2
    beach = smooth(0.05, 0.0, v)
    w.col = mix(ramp(w.n(3), GRASS), (232, 218, 172), beach)
    w.dens['palm'] = (v > 0.04) * 0.7
    w.hub = (0.52, 0.5)


def b_ruins(w):
    w.h = 0.22 + 0.12 * w.n(3)
    w.col = ramp(w.n(3), [(0, (178, 172, 152)), (1, (160, 152, 136))])
    w.dens['dead'] = smooth(0.5, 0.7, w.n(4, 3)) * 0.35
    w.houses = 0.3


def b_farmland(w):
    rng = w.rng
    w.h = 0.2 + 0.1 * w.n(2)
    base = ramp(w.n(3), GRASS)
    fields = [(198, 186, 112), (178, 190, 112), (212, 198, 128), (158, 176, 100), (202, 172, 106)]
    img = Image.new('RGB', (WN, WN))
    d = ImageDraw.Draw(img)
    for _ in range(40):
        fx, fy = rng.uniform(WM * 0.6, WN - WM * 0.6), rng.uniform(WM * 0.6, WN - WM * 0.6)
        fw, fh = rng.uniform(20, 46), rng.uniform(16, 36)
        d.rectangle([fx, fy, fx + fw, fy + fh], fill=fields[rng.integers(len(fields))])
    arr = np.asarray(img).astype(np.float32)
    has = (arr.sum(-1) > 0).astype(np.float32) * w.inside
    w.col = mix(base, arr, has * 0.85)
    w.dens['green'] = (1 - has) * 0.35
    w.houses = 1.6


def b_city(w, neon=False):
    rng = w.rng
    b_forest(w, 'green', GRASS, 0.5)
    cd = np.hypot(w.u - 0.5, w.v - 0.48)
    w.dens['green'] = w.dens['green'] * smooth(0.4, 0.5, cd)
    plaster = (196, 184, 186) if neon else (212, 198, 168)
    w.col = mix(w.col, plaster, smooth(0.42, 0.38, cd))
    canal = np.exp(-((w.v - 0.62 - 0.05 * np.sin(w.u * 9)) / 0.02) ** 2) * w.inside
    w.wet = 0.4 - 0.8 * smooth(0.4, 0.7, canal)
    w.wcol = np.full((WN, WN, 3), (96, 120, 150) if neon else (118, 154, 174), np.float32)
    w.houses = 0
    w.hub = (0.5, 0.48)
    w.city = 'neon' if neon else 'walled'

    def draw(d, xy):
        cx, cy = xy(0.5, 0.48)
        r = C * 0.38
        roof = [(176, 92, 66), (160, 80, 60), (190, 120, 84), (150, 100, 80)]
        nroof = [(176, 96, 140), (92, 150, 172), (140, 108, 160), (190, 120, 150)]
        for gy in range(int(cy - r), int(cy + r), 9):
            for gx in range(int(cx - r), int(cx + r), 9):
                if math.hypot(gx + 4 - cx, gy + 4 - cy) > r - 6 or rng.random() < 0.18:
                    continue
                if abs(gx + 4 - cx) < 6 or abs(gy + 4 - cy) < 6:
                    continue
                _, canal_y = xy(0, 0.62 + 0.05 * math.sin(((gx - cx) / C + 0.5) * 9))
                if abs(gy + 4 - canal_y) < 8:
                    continue
                sz = rng.uniform(4.5, 7)
                col = (nroof if neon else roof)[rng.integers(4)]
                d.rectangle([gx + 1, gy + 1, gx + sz, gy + sz], fill=col, outline=shade_col(col, 0.6))
        if neon:
            for _ in range(70):
                a, rr = rng.uniform(0, 2 * math.pi), r * math.sqrt(rng.random()) * 0.95
                lx, ly = cx + rr * math.cos(a), cy + rr * math.sin(a)
                col = [(255, 80, 180), (80, 230, 255), (255, 200, 80)][rng.integers(3)]
                d.ellipse([lx - 4, ly - 4, lx + 4, ly + 4], fill=col + (55,))
                d.ellipse([lx - 1.4, ly - 1.4, lx + 1.4, ly + 1.4], fill=col)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(200, 80, 160), width=3)
        else:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=3)
        for k in range(12):
            a = k / 12 * 2 * math.pi + 0.26
            tx, ty = cx + r * math.cos(a), cy + r * math.sin(a)
            d.ellipse([tx - 3.5, ty - 3.5, tx + 3.5, ty + 3.5], fill=(204, 192, 172), outline=INK)
    w.feats.append(draw)


def b_neon(w):
    b_city(w, True)


def b_plain(w):
    w.h = np.full((WN, WN), 0.2, np.float32)
    w.col = mix(ramp(w.n(3), GRASS), (174, 192, 140), w.inside)
    w.dens['green'] = (1 - smooth(0.4, 0.6, w.dc)) * 0
    w.houses = 0
    w.hub = (0.5, 0.5)


def b_construction(w):
    w.h = 0.2 + 0.08 * w.n(3) * (1 - w.inside)
    grid = ((np.mod(w.u * C, 20) < 1) | (np.mod(w.v * C, 20) < 1)).astype(np.float32)
    w.col = mix(ramp(w.n(3), GRASS), (214, 200, 168), w.inside)
    w.col = mix(w.col, (140, 160, 190), grid * 0.55 * smooth(0.5, 0.42, w.dc))
    w.houses = 0
    w.hub = (0.5, 0.5)
    rng = w.rng

    def draw(d, xy):
        for _ in range(6):
            bx, by = xy(rng.uniform(0.15, 0.75), rng.uniform(0.15, 0.75))
            d.rectangle([bx, by, bx + rng.uniform(16, 40), by + rng.uniform(14, 30)], outline=(90, 110, 150), width=2)
    w.feats.append(draw)


BIOMES = {
    'wild': b_wild, 'forest': b_forest, 'pine': b_pine, 'jungle': b_jungle, 'autumn': b_autumn, 'blossom': b_blossom,
    'steppe': b_steppe, 'meadow': b_meadow, 'mountain': b_mountain, 'glacier': b_glacier, 'snowlake': b_snowlake,
    'desert': b_desert, 'saltflat': b_saltflat, 'oasis': b_oasis, 'canyon': b_canyon, 'crater': b_crater,
    'lake': b_lake, 'swamp': b_swamp, 'crystal': b_crystal, 'volcano': b_volcano, 'sky': b_sky, 'reef': b_reef,
    'island': b_island, 'archipelago': b_archipelago, 'ruins': b_ruins, 'farmland': b_farmland, 'city': b_city,
    'neon': b_neon, 'plain': b_plain, 'construction': b_construction,
}
SEA_DEEP, SEA_SHALLOW = (96, 132, 156), (136, 170, 180)


# ---------------------------------------------------------------- glyphs (Vaelmora-sized)

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


def peak_glyph(d, x, y, s, smoke=False):
    left = [(x, y - s), (x - s * 0.9, y + s * 0.35), (x, y + s * 0.35)]
    right = [(x, y - s), (x + s * 0.9, y + s * 0.35), (x, y + s * 0.35)]
    d.polygon(left, fill=(242, 240, 234), outline=(110, 100, 92))
    d.polygon(right, fill=(156, 148, 140), outline=(110, 100, 92))
    if smoke:
        for k in range(5):
            d.ellipse([x - 5 + k * 4, y - s - 8 - k * 9, x + 5 + k * 5, y - s - k * 9], fill=(120, 114, 110, 120))


def house_glyph(d, x, y, s, roof=(176, 92, 66)):
    d.rectangle([x - s, y - s * 0.4, x + s, y + s * 0.7], fill=(230, 218, 190), outline=INK)
    d.polygon([(x - s * 1.2, y - s * 0.3), (x, y - s * 1.2), (x + s * 1.2, y - s * 0.3)], fill=roof, outline=INK)


def icon(d, kind, x, y, s, neon=False):
    """A landmark map symbol, ~2s tall, in Vaelmora's fine ink-and-wash manner."""
    I = INK
    lw = 1 if s < 14 else 2
    if kind in ('castle', 'citadel'):
        dark = kind == 'citadel'
        wall = (96, 82, 78) if dark else (220, 210, 188)
        roof = (196, 64, 44) if dark else (170, 70, 52)
        d.rectangle([x - s, y - s * 0.2, x + s, y + s * 0.6], fill=wall, outline=I, width=lw)
        for tx, th in ((-s, 0.9), (s, 0.9), (0, 1.3)):
            d.rectangle([x + tx - s * 0.24, y - s * th, x + tx + s * 0.24, y + s * 0.6], fill=wall, outline=I, width=lw)
            d.polygon([(x + tx - s * 0.32, y - s * th), (x + tx, y - s * th - s * 0.55), (x + tx + s * 0.32, y - s * th)], fill=roof, outline=I)
        d.rectangle([x - s * 0.14, y + s * 0.25, x + s * 0.14, y + s * 0.6], fill=(70, 50, 40))
    elif kind == 'pagoda':
        cols = [(214, 70, 60), (60, 140, 140)] if not neon else [(240, 70, 160), (60, 200, 230)]
        tiers = 4
        for k in range(tiers):
            w = s * (1.0 - k * 0.17)
            ty = y + s * 0.6 - k * s * 0.42
            d.rectangle([x - w * 0.5, ty - s * 0.26, x + w * 0.5, ty], fill=(236, 222, 190), outline=I)
            d.polygon([(x - w * 0.9, ty - s * 0.2), (x - w * 0.55, ty - s * 0.44), (x + w * 0.55, ty - s * 0.44), (x + w * 0.9, ty - s * 0.2)], fill=cols[k % 2], outline=I)
        d.line([(x, y + s * 0.6 - tiers * s * 0.42 - s * 0.05), (x, y + s * 0.6 - tiers * s * 0.42 - s * 0.45)], fill=I, width=lw)
    elif kind == 'colossus':
        stone = (150, 170, 150)
        d.polygon([(x - s * 0.4, y + s * 0.7), (x - s * 0.28, y - s * 0.55), (x + s * 0.28, y - s * 0.55), (x + s * 0.4, y + s * 0.7)], fill=stone, outline=I, width=lw)
        d.ellipse([x - s * 0.2, y - s * 0.98, x + s * 0.2, y - s * 0.56], fill=stone, outline=I, width=lw)
        d.line([(x + s * 0.28, y - s * 0.45), (x + s * 0.7, y - s * 1.05)], fill=I, width=max(2, int(s * 0.18)))
        d.line([(x + s * 0.7, y - s * 1.45), (x + s * 0.7, y - s * 0.7)], fill=(226, 216, 166), width=2)
        for k in range(3):
            d.arc([x - s * (0.6 + k * 0.25), y + s * (0.5 + k * 0.05), x + s * (0.6 + k * 0.25), y + s * (0.8 + k * 0.08)], 0, 180, fill=(240, 248, 250), width=1)
    elif kind == 'airship':
        for ox, oy, ss in ((0, 0, 1.0), (-1.7, 1.2, 0.5), (1.6, 1.0, 0.45)):
            ax, ay, sz = x + ox * s, y + oy * s, s * ss
            d.ellipse([ax - sz + 4, ay - sz * 0.4 + 10, ax + sz + 4, ay + sz * 0.4 + 10], fill=(60, 70, 90, 50))
            d.ellipse([ax - sz, ay - sz * 0.4, ax + sz, ay + sz * 0.4], fill=(236, 226, 200), outline=I, width=lw)
            for f in (-0.45, 0, 0.45):
                d.line([(ax + f * sz, ay - sz * 0.37), (ax + f * sz, ay + sz * 0.37)], fill=(190, 70, 52), width=1)
            d.rectangle([ax - sz * 0.3, ay + sz * 0.45, ax + sz * 0.3, ay + sz * 0.62], fill=(140, 96, 60), outline=I)
    elif kind in ('tower', 'lighthouse'):
        lh = kind == 'lighthouse'
        d.polygon([(x - s * 0.3, y + s * 0.6), (x - s * 0.2, y - s), (x + s * 0.2, y - s), (x + s * 0.3, y + s * 0.6)], fill=(232, 224, 204), outline=I, width=lw)
        if lh:
            for k in range(3):
                yy = y - s * 0.6 + k * s * 0.45
                d.rectangle([x - s * 0.26, yy, x + s * 0.26, yy + s * 0.18], fill=(196, 64, 52))
            d.ellipse([x - s * 0.6, y - s * 1.55, x + s * 0.6, y - s * 0.65], fill=(255, 230, 140, 90))
        d.polygon([(x - s * 0.3, y - s), (x, y - s * 1.5), (x + s * 0.3, y - s)], fill=(170, 70, 52) if not lh else (70, 60, 50), outline=I)
    elif kind == 'temple':
        d.polygon([(x - s, y - s * 0.35), (x, y - s * 0.9), (x + s, y - s * 0.35)], fill=(220, 206, 176), outline=I, width=lw)
        d.rectangle([x - s * 0.9, y - s * 0.35, x + s * 0.9, y + s * 0.5], fill=(236, 226, 204), outline=I, width=lw)
        for k in range(-3, 4):
            d.line([(x + k * s * 0.25, y - s * 0.25), (x + k * s * 0.25, y + s * 0.4)], fill=I)
    elif kind == 'ziggurat':
        for k in range(4):
            w = s * (1.0 - k * 0.22)
            ty = y + s * 0.6 - k * s * 0.34
            d.rectangle([x - w, ty - s * 0.34, x + w, ty], fill=(176, 170, 140), outline=I, width=lw)
        d.rectangle([x - s * 0.22, y - s * 1.05, x + s * 0.22, y - s * 0.76], fill=(196, 180, 140), outline=I)
    elif kind == 'lair':
        d.ellipse([x - s * 0.55, y - s * 0.55, x + s * 0.55, y + s * 0.55], outline=(176, 40, 36), width=2)
        d.ellipse([x - s * 0.24, y - s * 0.24, x + s * 0.24, y + s * 0.24], fill=(196, 52, 44), outline=(120, 30, 26))
    elif kind == 'portal':
        d.ellipse([x - s * 0.6, y - s * 1.0, x + s * 0.6, y + s * 0.45], fill=(120, 230, 230, 60), outline=(60, 150, 160), width=lw + 1)
        d.rectangle([x - s * 0.75, y + s * 0.4, x + s * 0.75, y + s * 0.55], fill=(170, 160, 150), outline=I)
    elif kind == 'dome':
        d.pieslice([x - s * 0.75, y - s * 1.1, x + s * 0.75, y + s * 0.2], 180, 360, fill=(120, 170, 150), outline=I, width=lw)
        d.rectangle([x - s, y - s * 0.45, x + s, y + s * 0.5], fill=(226, 214, 186), outline=I, width=lw)
        for k in range(-3, 4):
            d.line([(x + k * s * 0.28, y - s * 0.35), (x + k * s * 0.28, y + s * 0.4)], fill=I)
    elif kind == 'windmill':
        d.polygon([(x - s * 0.3, y + s * 0.6), (x - s * 0.18, y - s * 0.4), (x + s * 0.18, y - s * 0.4), (x + s * 0.3, y + s * 0.6)], fill=(232, 222, 200), outline=I, width=lw)
        for k in range(4):
            a = k / 4 * 2 * math.pi + 0.5
            d.line([(x, y - s * 0.4), (x + s * 0.9 * math.cos(a), y - s * 0.4 + s * 0.9 * math.sin(a))], fill=I, width=lw)
    elif kind == 'wreck':
        d.polygon([(x - s, y), (x + s * 0.8, y - s * 0.3), (x + s * 0.6, y + s * 0.3), (x - s * 0.7, y + s * 0.45)], fill=(132, 96, 64), outline=I, width=lw)
        d.line([(x - s * 0.2, y - s * 0.1), (x - s * 0.5, y - s * 1.1)], fill=I, width=lw + 1)
        d.polygon([(x - s * 0.45, y - s * 0.95), (x + s * 0.1, y - s * 0.72), (x - s * 0.3, y - s * 0.45)], fill=(220, 208, 180), outline=I)
    elif kind == 'crane':
        d.line([(x - s * 0.2, y + s * 0.6), (x - s * 0.2, y - s)], fill=(196, 150, 40), width=3)
        d.line([(x - s * 0.7, y - s), (x + s, y - s)], fill=(196, 150, 40), width=3)
        d.line([(x + s * 0.8, y - s), (x + s * 0.8, y - s * 0.3)], fill=I, width=1)
    elif kind == 'ruin':
        for ox, hh in ((-0.7, 0.9), (-0.25, 0.5), (0.2, 1.1), (0.65, 0.4)):
            d.rectangle([x + ox * s, y + s * 0.5 - hh * s, x + ox * s + s * 0.28, y + s * 0.5], fill=(190, 182, 166), outline=I, width=1)
    elif kind == 'arena':
        d.ellipse([x - s * 1.2, y - s * 0.7, x + s * 1.2, y + s * 0.7], fill=(214, 200, 170), outline=I, width=lw + 1)
        d.ellipse([x - s * 0.78, y - s * 0.42, x + s * 0.78, y + s * 0.42], fill=(222, 196, 140), outline=I, width=lw)
        for k in range(18):
            a = k / 18 * 2 * math.pi
            d.line([(x + s * 0.82 * math.cos(a), y + s * 0.46 * math.sin(a)), (x + s * 1.15 * math.cos(a), y + s * 0.67 * math.sin(a))], fill=I)
    elif kind == 'arch':
        d.polygon([(x - s, y + s * 0.6), (x - s * 0.8, y - s * 0.6), (x + s * 0.8, y - s * 0.6), (x + s, y + s * 0.6), (x + s * 0.5, y + s * 0.6),
                   (x + s * 0.45, y - s * 0.1), (x - s * 0.45, y - s * 0.1), (x - s * 0.5, y + s * 0.6)], fill=(200, 140, 96), outline=I, width=lw)
    elif kind == 'cabin':
        house_glyph(d, x, y, s * 0.6, (130, 80, 52))
    elif kind == 'yurts':
        for ox, oy in ((-0.6, 0.2), (0.5, 0.0), (0, 0.55), (0.9, 0.6)):
            px, py, r = x + ox * s, y + oy * s, s * 0.32
            d.pieslice([px - r, py - r, px + r, py + r], 180, 360, fill=(236, 226, 206), outline=I, width=1)
            d.line([(px - r, py), (px + r, py)], fill=I, width=1)
    elif kind == 'greattree':
        d.rectangle([x - s * 0.12, y - s * 0.2, x + s * 0.12, y + s * 0.6], fill=(110, 80, 52), outline=I)
        for ox, oy, r in ((0, -0.7, 0.55), (-0.45, -0.35, 0.42), (0.45, -0.35, 0.42), (0, -0.25, 0.4)):
            d.ellipse([x + (ox - r) * s, y + (oy - r) * s, x + (ox + r) * s, y + (oy + r) * s], fill=(92, 140, 74), outline=(50, 76, 40), width=1)
    elif kind == 'titan':
        d.ellipse([x - s * 0.6, y - s * 0.6, x + s * 0.6, y + s * 0.5], fill=(214, 200, 170), outline=I, width=lw)
        d.ellipse([x - s * 0.35, y - s * 0.3, x - s * 0.1, y - s * 0.05], fill=(60, 40, 30))
        d.ellipse([x + s * 0.1, y - s * 0.3, x + s * 0.35, y - s * 0.05], fill=(60, 40, 30))
        for k in range(-2, 3):
            d.line([(x + k * s * 0.4, y + s * 0.3), (x + k * s * 0.5, y + s * 0.9)], fill=(176, 164, 140), width=2)
    elif kind == 'crystal':
        for ox, hh, col in ((-0.4, 1.0, (150, 120, 214)), (0.35, 1.3, (100, 196, 210)), (0, 1.8, (196, 140, 220))):
            px = x + ox * s
            pts = [(px, y + s * 0.5 - hh * s), (px + s * 0.22, y + s * 0.5 - hh * s * 0.6), (px + s * 0.18, y + s * 0.5), (px - s * 0.18, y + s * 0.5), (px - s * 0.22, y + s * 0.5 - hh * s * 0.6)]
            d.polygon(pts, fill=col, outline=I)
    elif kind == 'henge':
        for k in range(10):
            a = k / 10 * 2 * math.pi
            px, py = x + s * 0.8 * math.cos(a), y + s * 0.45 * math.sin(a)
            d.rectangle([px - 2, py - 6, px + 2, py + 1], fill=(170, 164, 156), outline=I)
    elif kind == 'cube':
        a = s * 0.6
        d.polygon([(x, y - a), (x + a, y - a * 0.5), (x, y), (x - a, y - a * 0.5)], fill=(226, 226, 222), outline=I)
        d.polygon([(x - a, y - a * 0.5), (x, y), (x, y + a), (x - a, y + a * 0.5)], fill=(180, 180, 176), outline=I)
        d.polygon([(x + a, y - a * 0.5), (x, y), (x, y + a), (x + a, y + a * 0.5)], fill=(140, 140, 138), outline=I)


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


def bezier(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (k / n for k in range(n + 1))]


def cubic(p0, p1, p2, p3, n=24):
    out = []
    for k in range(n + 1):
        t = k / n
        a, b, c, e = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]))
    return out


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


# ---------------------------------------------------------------- layout

def place_shards(rng):
    """Ranks fill the rings from the centre out; within a ring, avoid repeating a neighbour's biome."""
    by_ring = {r: [] for r in range(5)}
    for j in range(N):
        for i in range(N):
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


def lattice_x(k):
    return GX0 + k * P - G / 2


# ---------------------------------------------------------------- the world fields

def build_world(rng, placed):
    keys = ['h', 'wet', 'cloud', 'lava']
    F = {k: np.zeros((FN, FN), np.float32) for k in keys}
    col = np.zeros((FN, FN, 3), np.float32)
    wcol = np.zeros((FN, FN, 3), np.float32)
    dens = {k: np.zeros((FN, FN), np.float32) for k in TREE_KINDS}
    wsum = np.zeros((FN, FN), np.float32)
    # one warp for every boundary, so neighbouring shards agree where their seams wander
    warp_u = (fbm(rng, FN, 9, 3) - 0.5) * 0.8 + (fbm(rng, FN, 26, 3) - 0.5) * 0.7
    warp_v = (fbm(rng, FN, 9, 3) - 0.5) * 0.8 + (fbm(rng, FN, 26, 3) - 0.5) * 0.7
    cells = {}
    for j in range(-1, N + 1):
        for i in range(-1, N + 1):
            inside = 0 <= i < N and 0 <= j < N
            k = placed.get((i, j))
            biome = SHARDS[k][1] if inside else 'wild'
            win = Win(np.random.default_rng(SEED * 1000 + (k if inside else 500 + (j + 1) * 12 + i + 1)))
            BIOMES[biome](win)
            ox, oy = (i + 1) * CH + (i + 1) * (G // FS) - WM, (j + 1) * CH + (j + 1) * (G // FS) - WM
            x0, x1 = max(0, ox), min(FN, ox + WN)
            y0, y1 = max(0, oy), min(FN, oy + WN)
            if x1 <= x0 or y1 <= y0:
                continue
            sl = (slice(y0, y1), slice(x0, x1))
            wsl = (slice(y0 - oy, y1 - oy), slice(x0 - ox, x1 - ox))
            uu = win.u[wsl] + warp_u[sl]
            vv = win.v[wsl] + warp_v[sl]
            dp = (np.abs(uu - 0.5) ** 5 + np.abs(vv - 0.5) ** 5) ** 0.2 - 0.5
            wgt = 1 / (1 + np.exp(np.clip(dp / 0.1, -40, 40)))
            wsum[sl] += wgt
            F['h'][sl] += wgt * win.h[wsl]
            F['wet'][sl] += wgt * (win.wet[wsl] if np.ndim(win.wet) else win.wet)
            F['cloud'][sl] += wgt * win.cloud
            if win.lava is not None:
                F['lava'][sl] += wgt * win.lava[wsl]
            col[sl] += wgt[..., None] * win.col[wsl]
            wc = win.wcol[wsl] if win.wcol is not None else np.broadcast_to(np.array(SEA_SHALLOW, np.float32), win.col[wsl].shape)
            wcol[sl] += wgt[..., None] * wc
            for kind, arr in win.dens.items():
                dens[kind][sl] += wgt * arr[wsl]
            cells[(i, j)] = win
    ws = np.maximum(wsum, 1e-6)
    for k in keys:
        F[k] /= ws
    col /= ws[..., None]
    wcol /= ws[..., None]
    for k in dens:
        dens[k] /= ws
    F['col'], F['wcol'], F['dens'] = col, wcol, dens
    return F, cells


def corridor_dist():
    """Distance (field px) to the nearest boulevard centreline, inside the lattice."""
    xs = (np.arange(FN, dtype=np.float32) * FS + FX0)
    ys = (np.arange(FN, dtype=np.float32) * FS + FY0)
    lines = np.array([lattice_x(k) for k in range(N + 1)], np.float32)
    dx = np.min(np.abs(xs[:, None] - lines[None, :]), axis=1) / FS
    lines_y = np.array([GY0 + k * P - G / 2 for k in range(N + 1)], np.float32)
    dy = np.min(np.abs(ys[:, None] - lines_y[None, :]), axis=1) / FS
    X, Y = np.meshgrid(xs, ys)
    inx = (X >= lattice_x(0) - 30) & (X <= lattice_x(N) + 30)
    iny = (Y >= GY0 - G / 2 - 30) & (Y <= GY0 + N * P - G / 2 + 30)
    dv = np.where(iny, dx[None, :], 1e4)
    dh = np.where(inx, dy[:, None], 1e4)
    return np.minimum(dv, dh)


# ---------------------------------------------------------------- render

def main():
    rng = np.random.default_rng(SEED)
    placed = place_shards(rng)
    F, cells = build_world(rng, placed)
    h, wet, cloud = F['h'], F['wet'], F['cloud']

    # the boulevard is graded into the land: cuttings and embankments
    cd = corridor_dist()
    grade = smooth(11, 4, cd)
    hb = blur(h, 16)
    h = h * (1 - grade) + hb * grade

    # the fade into the unclaimed parchment beyond the hundred
    xs = np.arange(FN, dtype=np.float32) * FS + FX0
    ys = np.arange(FN, dtype=np.float32) * FS + FY0
    X, Y = np.meshgrid(xs, ys)
    out = np.maximum(np.maximum(lattice_x(0) - X, X - lattice_x(N)), np.maximum(GY0 - G / 2 - Y, Y - (GY0 + N * P - G / 2)))
    fade = smooth(-20, 230, out + 90 * (fbm(rng, FN, 8, 4) - 0.5))

    # full-res rasters
    def U(a):
        return up(a, FN * FS, FN * FS)
    Hf, WETf, CLf, LAVf, FADEf = U(h), U(wet), U(cloud), U(F['lava']), U(fade)
    COLf = np.stack([U(F['col'][..., k]) for k in range(3)], -1)
    WCf = np.stack([U(F['wcol'][..., k]) for k in range(3)], -1)
    land = smooth(-0.004, 0.004, WETf)

    gy, gx = np.gradient(Hf * 330)
    lx, ly, lz = -0.62, -0.62, 0.48
    ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    s = (-gx * lx - gy * ly + lz) / (np.sqrt(gx * gx + gy * gy + 1) * ln) - lz / ln
    s = np.clip(s, -0.5, 0.32)
    lcol = COLf * (1 + 0.8 * s)[..., None]
    lcol = mix(lcol, (250, 246, 236), np.clip(Hf - 0.75, 0, 1) * 0.3)
    tint = np.zeros_like(Hf)
    for kind in ('green', 'jungle', 'pine', 'willow', 'autumn'):
        tint = np.maximum(tint, U(blur(F['dens'][kind], 2)))
    lcol *= (1 - 0.14 * tint)[..., None]
    lava = LAVf
    glow = U(blur(F['lava'], 4))
    lcol = mix(lcol, (226, 108, 44), np.clip(glow * 1.6, 0, 0.55))
    lcol = mix(lcol, (250, 172, 72), np.clip(lava * 1.2, 0, 1))

    # water: depth from how far below the shore, ripple lines along every coast (Vaelmora's halo)
    depth = np.clip(-WETf, 0, None)
    water = mix(WCf, SEA_DEEP, smooth(0.0, 0.28, depth) * 0.75)
    for lev, a in ((0.02, 0.3), (0.05, 0.22), (0.1, 0.14)):
        water = mix(water, (82, 114, 138), contour(-WETf, lev, 0.9) * a)
    # clouds where the world falls away
    cl = up(fbm(rng, FN // 2, 12, 5), FN * FS, FN * FS)
    clouds = mix((206, 216, 228), (248, 250, 252), smooth(0.3, 0.8, cl))
    clouds = mix(clouds, (178, 194, 210), np.clip(sum(contour(cl, lv, 0.7) for lv in (0.45, 0.62, 0.78)), 0, 1) * 0.45)
    isle_shadow = np.roll(np.roll(land, 16, 0), 10, 1)
    clouds = mix(clouds, (150, 160, 182), up(blur(isle_shadow[::FS, ::FS], 4), FN * FS, FN * FS) * 0.5)
    under = mix(water, clouds, smooth(0.35, 0.65, CLf))
    cliff = np.clip(np.roll(land, 8, 0) - land, 0, 1) * smooth(0.35, 0.65, CLf)
    under = mix(under, (128, 100, 76), cliff)
    under = mix(under, (96, 74, 58), np.clip(np.roll(land, 3, 0) - land, 0, 1) * smooth(0.35, 0.65, CLf) * 0.6)
    rgb = mix(under, lcol, land)
    coast = contour(WETf, 0.0, 1.1) * (1 - smooth(0.4, 0.7, CLf) * 0.6)
    rgb = mix(rgb, (70, 60, 50), coast * 0.8)
    rgb = rgb * 0.88 + np.array(PAPER, np.float32) * 0.12
    # the Heart's warmth; the frontier's ink fades with neglect
    rr = np.hypot(X - HEART[0], Y - HEART[1])
    warm = U(np.exp(-(rr / 1100) ** 2))
    rgb = mix(rgb, (255, 214, 130), warm * 0.12)
    ringd = U(np.maximum(np.abs(X - HEART[0]), np.abs(Y - HEART[1])) / P)
    age = smooth(2.6, 5.0, ringd) * 0.24
    grey = rgb.mean(-1, keepdims=True)
    rgb = mix(rgb, grey * 0.5 + np.array(PAPER) * 0.5, age)

    # compose on parchment
    paper_arr = paper(rng)
    world = mix(rgb, PAPER, FADEf * 0)
    canvas_arr = paper_arr.copy()
    oy, ox = FY0, FX0
    hh, ww = world.shape[:2]
    y1, x1 = min(H, oy + hh), min(W, ox + ww)
    fsub = FADEf[:y1 - oy, :x1 - ox]
    canvas_arr[oy:y1, ox:x1] = mix(world[:y1 - oy, :x1 - ox], canvas_arr[oy:y1, ox:x1], fsub)
    canvas = Image.fromarray(np.clip(canvas_arr, 0, 255).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(canvas, 'RGBA')

    clear = Image.new('L', (FN, FN), 0)
    cdraw = ImageDraw.Draw(clear)

    def to_f(x, y):
        return ((x - FX0) / FS, (y - FY0) / FS)

    # boulevard corridor and junctions clear the forest
    for k in range(N + 1):
        x = lattice_x(k)
        y = GY0 + k * P - G / 2
        cdraw.line([to_f(x, GY0 - G / 2), to_f(x, GY0 + N * P - G / 2)], fill=255, width=16)
        cdraw.line([to_f(lattice_x(0), y), to_f(lattice_x(N), y)], fill=255, width=16)

    # shard roads: each edge entry leaves the boulevard through a gate and becomes the shard's road to its town
    shard_roads = []
    hubs = []
    for (i, j), k in placed.items():
        win = cells[(i, j)]
        x0, y0 = cell_xy(i, j)
        r = ring_of(i, j)

        def xy(u, v, x0=x0, y0=y0):
            return (x0 + u * C, y0 + v * C)
        rngh = np.random.default_rng(SEED * 3 + k)
        if win.hub == (0.5, 0.45):
            win.hub = (0.5 + rngh.uniform(-0.14, 0.14), 0.45 + rngh.uniform(-0.12, 0.14))
        hx, hy = xy(*win.hub)
        hubs.append((i, j, k, hx, hy, win, xy))
        if not win.roads:
            continue
        rngc = np.random.default_rng(SEED + k)
        for (eu, ev), (iu, iv) in (((0.5, -G / 2 / C), (0.5, 0.1)), ((0.5, 1 + G / 2 / C), (0.5, 0.9)),
                                   ((-G / 2 / C, 0.5), (0.1, 0.5)), ((1 + G / 2 / C, 0.5), (0.9, 0.5))):
            a, b = xy(eu, ev), xy(iu, iv)
            inward = (b[0] - a[0], b[1] - a[1])
            il = math.hypot(*inward) + 1e-6
            c1 = (b[0] + inward[0] / il * C * 0.2, b[1] + inward[1] / il * C * 0.2)
            perp = (-inward[1] / il, inward[0] / il)
            jit = rngc.uniform(-0.12, 0.12) * C
            c2 = (hx + (b[0] - hx) * 0.4 + perp[0] * jit, hy + (b[1] - hy) * 0.4 + perp[1] * jit)
            pts = [a] + cubic(b, c1, c2, (hx, hy), 28)
            shard_roads.append((pts, r, win))
            cdraw.line([to_f(*p) for p in pts], fill=255, width=7)
        cdraw.ellipse([*to_f(hx - 44, hy - 44), *to_f(hx + 44, hy + 44)], fill=255)
    clear_arr = blur(np.asarray(clear).astype(np.float32) / 255, 1)

    rivers = trace_rivers(rng, h, wet, cloud, placed, cells)
    for pts in rivers:
        n = len(pts)
        for q in range(n - 1):
            wdt = 1.6 + 2.6 * q / max(1, n - 1)
            d.line([pts[q], pts[q + 1]], fill=(86, 124, 156), width=int(wdt + 2))
        for q in range(n - 1):
            wdt = 1.6 + 2.6 * q / max(1, n - 1)
            d.line([pts[q], pts[q + 1]], fill=(126, 164, 188), width=max(1, int(wdt)))

    # trees and peaks over the whole world, top to bottom
    glyphs = []
    landf = smooth(0.01, 0.04, wet) * (1 - smooth(0.4, 0.6, cloud) * (wet < 0.02)) * (1 - smooth(0.2, 0.5, fade))
    for kind, (glyph, cols, step, (r0, r1)) in TREE_KINDS.items():
        dm = F['dens'][kind] * landf * (1 - clear_arr)
        if dm.max() < 0.02:
            continue
        ys_, xs_ = np.mgrid[0:FN * FS:step, 0:FN * FS:step].astype(np.float32)
        xs_ += rng.uniform(-0.5, 0.5, xs_.shape) * step
        ys_ += rng.uniform(-0.5, 0.5, ys_.shape) * step
        fx = np.clip((xs_ / FS).astype(int), 0, FN - 1)
        fy = np.clip((ys_ / FS).astype(int), 0, FN - 1)
        keep = rng.random(xs_.shape) < dm[fy, fx]
        for px, py in zip(xs_[keep].tolist(), ys_[keep].tolist()):
            glyphs.append((py + FY0, px + FX0, glyph, rng.uniform(r0, r1), cols[rng.integers(len(cols))]))
    pk = (h > 0.64) * (wet > 0.05) * (1 - clear_arr) * (1 - fade) * 0.5
    ys_, xs_ = np.mgrid[0:FN * FS:22, 0:FN * FS:22].astype(np.float32)
    xs_ += rng.uniform(-8, 8, xs_.shape)
    ys_ += rng.uniform(-8, 8, ys_.shape)
    fx = np.clip((xs_ / FS).astype(int), 0, FN - 1)
    fy = np.clip((ys_ / FS).astype(int), 0, FN - 1)
    keep = rng.random(xs_.shape) < pk[fy, fx]
    for px, py in zip(xs_[keep].tolist(), ys_[keep].tolist()):
        hv = h[int(py / FS), int(px / FS)]
        glyphs.append((py + FY0, px + FX0, 'peak', 8 + 16 * (hv - 0.64) / 0.36, None))
    glyphs.sort(key=lambda g: g[0])
    for py, px, kind, r, col in glyphs:
        if kind == 'peak':
            peak_glyph(d, px, py, r)
        else:
            tree_glyph(d, px, py, kind, r, col)

    # the boulevard
    draw_boulevard(d, Hf, WETf, CLf, FADEf)

    # shard roads, gates, towns
    for pts, r, win in shard_roads:
        width = [7, 6, 5, 5, 4][r]
        d.line(pts, fill=(104, 70, 52), width=width + 3, joint='curve')
        d.line(pts, fill=(236, 226, 200), width=width, joint='curve')
        # the gate where the entry leaves the boulevard
        gx_, gy_ = pts[1]
        ax_, ay_ = pts[0]
        nx, ny = gy_ - ay_, -(gx_ - ax_)
        nl = math.hypot(nx, ny) + 1e-6
        nx, ny = nx / nl, ny / nl
        d.line([(gx_ - nx * (width / 2 + 4), gy_ - ny * (width / 2 + 4)), (gx_ + nx * (width / 2 + 4), gy_ + ny * (width / 2 + 4))], fill=(150, 56, 40), width=3)
    for i, j, k, hx, hy, win, xy in hubs:
        r = ring_of(i, j)
        rngc = np.random.default_rng(SEED * 7 + k)
        for f in win.feats:
            f(d, xy)
        if getattr(win, 'lanterns', False) and r <= 2:
            for _ in range(46):
                a, rr2 = rngc.uniform(0, 2 * math.pi), rngc.uniform(0.07, 0.27) * C
                qx, qy = hx + rr2 * math.cos(a), hy + rr2 * math.sin(a)
                wv = sample(wet, qx, qy)
                if wv is not None and wv < -0.01:
                    d.ellipse([qx - 4, qy - 4, qx + 4, qy + 4], fill=(255, 200, 90, 70))
                    d.ellipse([qx - 1.5, qy - 1.5, qx + 1.5, qy + 1.5], fill=(255, 214, 110))
        # a town along the shard's roads, bigger where more people play
        count = int([34, 24, 16, 10, 5][r] * win.houses)
        ruined = '(abandoned)' in SHARDS[k][0]
        for _ in range(count):
            a, rr2 = rngc.uniform(0, 2 * math.pi), rngc.uniform(16, 52)
            if rngc.random() < 0.6:
                axis = rngc.integers(4)
                off = rngc.uniform(-4, 4)
                rr2 = rngc.uniform(14, 70)
                qx, qy = [(hx + off + 7, hy - rr2), (hx + off - 7, hy + rr2), (hx - rr2, hy + off + 7), (hx + rr2, hy + off - 7)][axis]
            else:
                qx, qy = hx + rr2 * math.cos(a), hy + rr2 * 0.7 * math.sin(a)
            wv = sample(wet, qx, qy)
            cv = sample(cloud, qx, qy)
            if wv is None or wv < 0.03:
                continue
            roof = (150, 144, 136) if ruined else [(176, 92, 66), (160, 80, 60), (184, 112, 76)][rngc.integers(3)]
            house_glyph(d, qx, qy, 3.2, roof)
        if SHARDS[k][2]:
            s = [17, 14, 12, 10, 9][r]
            icon(d, SHARDS[k][2], hx, hy, s, win.__dict__.get('city') == 'neon')
        if hasattr(win, 'peak'):
            px, py = xy(*win.peak)
            peak_glyph(d, px, py - 4, 22, smoke=True)

    draw_junctions(d, WETf, CLf, FADEf)
    draw_labels(d, placed, cells)
    ring_labels(d)
    furniture(canvas)
    canvas = finish(canvas, rng)
    canvas.save(OUT)
    print('wrote', OUT, canvas.size, len(glyphs), 'glyphs', len(rivers), 'rivers')


def paper(rng):
    n = up(rng.random((60, 50)), W, H) * 0.6 + up(rng.random((240, 200)), W, H) * 0.4
    return np.array(PAPER, np.float32) * (0.94 + 0.08 * n)[..., None]


def trace_rivers(rng, h, wet, cloud, placed, cells):
    """Rivers start high in hill and mountain shards and run downhill across seams until they reach water."""
    hs = blur(h, 5)
    gy, gx = np.gradient(hs)
    out = []
    for (i, j), k in placed.items():
        if SHARDS[k][1] not in ('mountain', 'glacier', 'pine', 'crater', 'forest', 'jungle', 'crystal') or rng.random() < 0.45:
            continue
        x0, y0 = cell_xy(i, j)
        fx0, fy0 = int((x0 - FX0) / FS), int((y0 - FY0) / FS)
        sub = hs[fy0 + 20:fy0 + CH - 20, fx0 + 20:fx0 + CH - 20]
        yy, xx = np.unravel_index(np.argmax(sub + rng.random(sub.shape) * 0.05), sub.shape)
        p = np.array([fx0 + 20 + xx, fy0 + 20 + yy], np.float32)
        v = np.array([0.0, 0.0], np.float32)
        pts = []
        for step in range(700):
            ix, iy = int(p[0]), int(p[1])
            if not (2 <= ix < FN - 2 and 2 <= iy < FN - 2):
                break
            pts.append((p[0] * FS + FX0, p[1] * FS + FY0))
            if wet[iy, ix] < -0.01 or cloud[iy, ix] > 0.5:
                break
            g = np.array([-gx[iy, ix], -gy[iy, ix]], np.float32)
            gl = float(np.hypot(*g))
            if gl < 1e-5:
                break
            v = 0.75 * v + 0.25 * g / gl + rng.normal(0, 0.06, 2).astype(np.float32)
            v /= (np.hypot(*v) + 1e-6)
            p = p + v * 1.6
        if len(pts) > 60:
            ok = wet[int(p[1]) if 0 <= p[1] < FN else 0, int(p[0]) if 0 <= p[0] < FN else 0] < -0.01
            if ok:
                out.append(pts[::2] + [pts[-1]])
    return out


def classify(Hf, WETf, CLf, x, y):
    fx, fy = int(x - FX0), int(y - FY0)
    if not (0 <= fx < Hf.shape[1] and 0 <= fy < Hf.shape[0]):
        return 'land'
    if WETf[fy, fx] < -0.005:
        return 'sky' if CLf[fy, fx] > 0.5 else 'water'
    if Hf[fy, fx] > 0.7:
        return 'tunnel'
    return 'land'


def draw_boulevard(d, Hf, WETf, CLf, FADEf):
    """The grid's own road, the ridiculous part: a dual carriageway in every gap, built into whatever it meets."""
    deck = 12                                   # ~19 m: the 15 m asphalt plus its kerbs, drawn proud
    segs = []
    y_lo, y_hi = GY0 - G / 2, GY0 + N * P - G / 2
    for k in range(N + 1):
        x = lattice_x(k)
        segs.append(((x, y_lo), (x, y_hi)))
        y = GY0 + k * P - G / 2
        segs.append(((lattice_x(0), y), (lattice_x(N), y)))
    # planned highways run on into the unclaimed parchment
    for k in range(N + 1):
        x = lattice_x(k)
        y = GY0 + k * P - G / 2
        for a, b in (((x, y_lo - 360), (x, y_lo)), ((x, y_hi), (x, y_hi + 360)), ((lattice_x(0) - 360, y), (lattice_x(0), y)), ((lattice_x(N), y), (lattice_x(N) + 360, y))):
            dashed(d, [a, b], (140, 104, 76, 150), 3, 12, 9)
    for (ax, ay), (bx, by) in segs:
        vertical = ax == bx
        length = abs(by - ay) if vertical else abs(bx - ax)
        runs = []
        cur, start = None, 0.0
        for t in np.arange(0, length + 1, 3.0):
            x = ax if vertical else ax + t
            y = ay + t if vertical else ay
            c = classify(Hf, WETf, CLf, x, y)
            if c != cur:
                if cur is not None:
                    runs.append((cur, start, t))
                cur, start = c, t
        runs.append((cur, start, length))

        def P_(t):
            return (ax, ay + t) if vertical else (ax + t, ay)
        nx, ny = (1, 0) if vertical else (0, 1)
        for kind, t0, t1 in runs:
            a, b = P_(t0), P_(t1)
            if kind == 'water' or kind == 'sky':
                # bridge or viaduct: shadow, piers, parapets
                off = (6, 8) if kind == 'water' else (12, 18)
                d.line([(a[0] + off[0], a[1] + off[1]), (b[0] + off[0], b[1] + off[1])], fill=(40, 50, 70, 36), width=deck)
                for t in np.arange(t0 + 8, t1 - 4, 16 if kind == 'water' else 22):
                    px, py = P_(t)
                    if kind == 'sky':
                        d.line([(px, py), (px + off[0], py + off[1])], fill=(140, 130, 124, 110), width=3)
                    d.rectangle([px - nx * (deck / 2 + 3) - 1.2 * ny, py - ny * (deck / 2 + 3) - 1.2 * nx, px + nx * (deck / 2 + 3) + 1.2 * ny, py + ny * (deck / 2 + 3) + 1.2 * nx], fill=(172, 158, 140), outline=(110, 90, 76))
                d.line([a, b], fill=(150, 124, 100), width=deck + 3)
                d.line([a, b], fill=(232, 222, 200), width=deck)
                for sgn in (-1, 1):
                    d.line([(a[0] + sgn * nx * (deck / 2 - 1), a[1] + sgn * ny * (deck / 2 - 1)), (b[0] + sgn * nx * (deck / 2 - 1), b[1] + sgn * ny * (deck / 2 - 1))], fill=(150, 120, 96), width=1)
            elif kind == 'tunnel':
                for sgn in (-1, 1):
                    dashed(d, [(a[0] + sgn * nx * deck / 2, a[1] + sgn * ny * deck / 2), (b[0] + sgn * nx * deck / 2, b[1] + sgn * ny * deck / 2)], INK, 2, 6, 5)
                for p in (a, b):
                    d.arc([p[0] - deck, p[1] - deck, p[0] + deck, p[1] + deck], 0, 360, fill=INK, width=2)
            else:
                # graded land: the embankment's shade, ink kerbs, two carriageways and a median
                d.line([(a[0] + 2, a[1] + 3), (b[0] + 2, b[1] + 3)], fill=(60, 44, 30, 60), width=deck + 10)
                d.line([a, b], fill=(196, 182, 150, 150), width=deck + 8)
                d.line([a, b], fill=(98, 68, 50), width=deck + 3)
                d.line([a, b], fill=(240, 232, 208), width=deck - 1)
        # the median down the whole length, and lanterns that gild toward the Heart
        dashed(d, [(ax, ay), (bx, by)], (166, 66, 48), 1, 8, 5)
        for t in np.arange(10, length, 26):
            px, py = P_(t)
            g = math.exp(-(math.hypot(px - HEART[0], py - HEART[1]) / 1500) ** 2)
            if g < 0.12:
                continue
            for sgn in (-1, 1):
                qx, qy = px + sgn * nx * (deck / 2 + 5), py + sgn * ny * (deck / 2 + 5)
                d.ellipse([qx - 4, qy - 4, qx + 4, qy + 4], fill=(255, 214, 120, int(90 * g)))
                d.ellipse([qx - 1.3, qy - 1.3, qx + 1.3, qy + 1.3], fill=(255, 230, 150))


def draw_junctions(d, WETf, CLf, FADEf):
    """An interchange with a light column at every crossing, the grand interchange at the Heart."""
    for a in range(N + 1):
        for b in range(N + 1):
            x, y = lattice_x(a), GY0 + b * P - G / 2
            if (x, y) == HEART:
                continue
            g = math.exp(-(math.hypot(x - HEART[0], y - HEART[1]) / 1600) ** 2)
            R = 13 + 5 * g
            d.ellipse([x - R - 3, y - R - 3, x + R + 3, y + R + 3], fill=(60, 44, 30, 50))
            d.ellipse([x - R, y - R, x + R, y + R], fill=(240, 232, 208), outline=(98, 68, 50), width=3)
            d.ellipse([x - R * 0.5, y - R * 0.5, x + R * 0.5, y + R * 0.5], fill=(150, 170, 110), outline=(98, 68, 50), width=2)
            d.ellipse([x - R * 1.9, y - R * 1.9, x + R * 1.9, y + R * 1.9], fill=(255, 236, 170, int(30 + 60 * g)))
            d.ellipse([x - 3.5, y - 3.5, x + 3.5, y + 3.5], fill=(255, 250, 226), outline=(150, 110, 40))
    hx, hy = HEART
    # cloverleaf loops in the four quadrants, then the ring, then the monument
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = hx + sx * 46, hy + sy * 46
            d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], outline=(98, 68, 50), width=12)
            d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], outline=(240, 232, 208), width=7)
            d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(160, 184, 116))
    for rad, al in ((210, 34), (150, 60), (100, 90)):
        d.ellipse([hx - rad, hy - rad, hx + rad, hy + rad], fill=(255, 226, 140, al))
    d.ellipse([hx - 48, hy - 48, hx + 48, hy + 48], fill=(240, 232, 208), outline=(98, 68, 50), width=4)
    star(d, hx, hy, 110, 26, 8, (232, 186, 70), (120, 80, 30))
    star(d, hx, hy, 70, 16, 4, (250, 236, 200), INK, rot=math.pi / 4)
    d.ellipse([hx - 18, hy - 18, hx + 18, hy + 18], fill=(196, 52, 44), outline=INK, width=3)
    d.ellipse([hx - 6, hy - 6, hx + 6, hy + 6], fill=(255, 240, 200))


def spaced(d, xy, text, f, fill, spacing, stroke=0, stroke_fill=None):
    widths = [d.textlength(ch, font=f) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = xy[0] - total / 2
    for ch, w_ in zip(text, widths):
        d.text((x + w_ / 2, xy[1]), ch, font=f, fill=fill, anchor='mm', stroke_width=stroke, stroke_fill=stroke_fill)
        x += w_ + spacing
    return total


def fit(d, text, name, size, index, maxw, spacing):
    while size > 10:
        f = font(name, size, index)
        if sum(d.textlength(ch, font=f) for ch in text) + spacing * (len(text) - 1) <= maxw:
            return f
        size -= 1
    return font(name, size, index)


def draw_labels(d, placed, cells):
    """One line per shard, Vaelmora's letter-spaced region names, larger the more it is played."""
    halo = (244, 236, 214, 210)
    for (i, j), k in placed.items():
        name = SHARDS[k][0]
        r = ring_of(i, j)
        x0, y0 = cell_xy(i, j)
        cx, cy = x0 + C / 2, y0 + C * 0.84
        if r <= 2:
            text = name.upper()
            sp = [7, 5, 3][r]
            f = fit(d, text, 'Copperplate.ttc', [36, 28, 23][r], 2 if r < 2 else 0, C * 0.96, sp)
            spaced(d, (cx, cy), text, f, (52, 38, 30), sp, stroke=4 if r == 0 else 3, stroke_fill=halo)
        else:
            f = fit(d, name, 'Hoefler Text.ttc', [0, 0, 0, 23, 21][r], 0 if r == 3 else 2, C * 0.96, 0)
            fill = (70, 56, 46) if r == 3 else (104, 88, 74)
            d.text((cx, cy), name, font=f, fill=fill, anchor='mm', stroke_width=3, stroke_fill=halo)


def ring_labels(d):
    f = font('Hoefler Text.ttc', 24, 2)
    for r, name in enumerate(RING_NAMES[1:], start=1):
        y = HEART[1] - r * P
        x = HEART[0] + P / 2
        d.text((x, y - 1), name, font=f, fill=(110, 50, 36), anchor='mm', stroke_width=5, stroke_fill=(244, 236, 214))


def furniture(canvas):
    d = ImageDraw.Draw(canvas, 'RGBA')
    cream = (240, 232, 212)
    tw, th = 2100, 300
    tx, ty = (W - tw) // 2, 150
    for side in (-1, 1):
        ex = tx if side < 0 else tx + tw
        d.polygon([(ex, ty + 40), (ex + side * 150, ty + 60), (ex + side * 100, ty + th / 2), (ex + side * 150, ty + th - 60), (ex, ty + th - 40)], fill=(226, 214, 186), outline=INK, width=3)
    d.rectangle([tx, ty, tx + tw, ty + th], fill=cream, outline=INK, width=4)
    d.rectangle([tx + 14, ty + 14, tx + tw - 14, ty + th - 14], outline=INK, width=2)
    d.text((W / 2, ty + 120), 'Wildshard', font=font('Baskerville.ttc', 150, 3), fill=INK, anchor='mm')
    d.text((W / 2, ty + 222), 'the Grid at One Hundred Shards  ·  a draft chart of version 1.0', font=font('Hoefler Text.ttc', 40, 2), fill=(90, 70, 56), anchor='mm')
    for side in (-1, 1):
        dx = W / 2 + side * 640
        d.polygon([(dx, ty + 108), (dx + 14, ty + 120), (dx, ty + 132), (dx - 14, ty + 120)], fill=(170, 50, 40))
        d.line([(dx + side * 30, ty + 120), (dx + side * 170, ty + 120)], fill=INK, width=2)
    compass(d, W - 380, 390, 190)

    by = GY0 + N * P + 40
    lx0, lx1 = 140, 1880
    d.rectangle([lx0, by, lx1, H - 140], fill=cream, outline=INK, width=3)
    d.rectangle([lx0 + 10, by + 10, lx1 - 10, H - 150], outline=INK, width=1)
    hf = font('Baskerville.ttc', 46, 3)
    d.text(((lx0 + lx1) / 2, by + 56), 'Legend', font=hf, fill=INK, anchor='mm')
    item = font('Hoefler Text.ttc', 29, 0)
    rows = [
        ('road', 'The Boulevard: the grid\'s own dual carriageway'),
        ('bridge', 'Bridge or viaduct where the land falls away'),
        ('tunnel', 'Tunnel under high ground'),
        ('junction', 'Interchange and light column'),
        ('heart', 'The Heart of the Grid (0, 0)'),
        ('gate', 'Shard gate: an edge entry off the Boulevard'),
        ('town', 'Town'),
        ('lair', 'Lair of a raid or world boss'),
        ('peak', 'Peak'),
        ('river', 'River'),
    ]
    yy = by + 122
    col2 = lx0 + 880
    for n_, (kind, text) in enumerate(rows):
        x = lx0 + 50 if n_ < 5 else col2
        y = yy + (n_ % 5) * 68
        legend_glyph(d, kind, x + 44, y)
        d.text((x + 104, y), text, font=item, fill=INK, anchor='lm')
    ky = yy + 5 * 68 + 14
    d.line([(lx0 + 40, ky - 14), (lx1 - 40, ky - 14)], fill=INK, width=1)
    spans = ['1–4', '5–16', '17–36', '37–64', '65–100']
    sw = (lx1 - lx0 - 80) / 5
    for r, (nm, sp) in enumerate(zip(RING_NAMES, spans)):
        x = lx0 + 40 + r * sw + sw / 2
        d.text((x, ky + 34), nm, font=font('Hoefler Text.ttc', 28, 2), fill=INK, anchor='mm')
        d.text((x, ky + 70), 'ranks ' + sp, font=font('Hoefler Text.ttc', 23, 0), fill=(110, 90, 72), anchor='mm')
    d.text(((lx0 + lx1) / 2, H - 200), 'Each season the most played shards move toward the Heart; quiet and unmaintained ones drift out to the Frontier,',
           font=font('Hoefler Text.ttc', 25, 2), fill=(110, 60, 40), anchor='mm')
    d.text(((lx0 + lx1) / 2, H - 168), 'and every seam is re-blended into its new neighbours.',
           font=font('Hoefler Text.ttc', 25, 2), fill=(110, 60, 40), anchor='mm')

    rx0, rx1 = 1960, W - 140
    d.rectangle([rx0, by, rx1, H - 140], fill=cream, outline=INK, width=3)
    d.rectangle([rx0 + 10, by + 10, rx1 - 10, H - 150], outline=INK, width=1)
    d.text(((rx0 + rx1) / 2, by + 56), 'The Most Played', font=hf, fill=INK, anchor='mm')
    nf = font('Copperplate.ttc', 30, 2)
    gf = font('Hoefler Text.ttc', 26, 2)
    for k in range(16):
        name, biome, ic, genre = SHARDS[k]
        x = rx0 + 60 + (k // 8) * ((rx1 - rx0 - 80) / 2)
        y = by + 124 + (k % 8) * 62
        d.text((x + 30, y - 9), f'{k + 1}.', font=font('Baskerville.ttc', 26, 1), fill=(120, 40, 30), anchor='rm')
        d.text((x + 44, y - 9), name.upper(), font=nf, fill=INK, anchor='lm')
        d.text((x + 44, y + 20), genre, font=gf, fill=(120, 40, 30), anchor='lm')
    km = 1000 * C / 500
    bx, byy = rx0 + 60, H - 214
    d.text((bx + km, byy - 36), 'Scale of kilometres', font=font('Hoefler Text.ttc', 26, 2), fill=INK, anchor='mm')
    for q in range(4):
        d.rectangle([bx + q * km / 2, byy, bx + (q + 1) * km / 2, byy + 16], fill=INK if q % 2 == 0 else cream, outline=INK, width=2)
    for q in range(5):
        d.text((bx + q * km / 2, byy + 40), f'{q * 0.5:g}', font=font('Hoefler Text.ttc', 24, 0), fill=INK, anchor='mm')
    d.text((bx + 2 * km + 50, byy + 10), 'km', font=font('Hoefler Text.ttc', 24, 2), fill=INK, anchor='lm')
    d.text((rx1 - 60, byy + 10), 'Every name on this chart is invented for the draft.', font=font('Hoefler Text.ttc', 24, 2), fill=(110, 90, 72), anchor='rm')


def legend_glyph(d, kind, x, y):
    if kind == 'road':
        d.line([(x - 44, y), (x + 44, y)], fill=(98, 68, 50), width=15)
        d.line([(x - 44, y), (x + 44, y)], fill=(240, 232, 208), width=11)
        dashed(d, [(x - 44, y), (x + 44, y)], (166, 66, 48), 1, 8, 5)
    elif kind == 'bridge':
        d.rectangle([x - 44, y - 16, x + 44, y + 16], fill=(120, 156, 176))
        for t in (-30, 0, 30):
            d.rectangle([x + t - 2, y - 11, x + t + 2, y + 11], fill=(120, 100, 86), outline=INK)
        d.line([(x - 44, y), (x + 44, y)], fill=INK, width=14)
        d.line([(x - 44, y), (x + 44, y)], fill=(226, 214, 190), width=10)
    elif kind == 'tunnel':
        for sgn in (-1, 1):
            dashed(d, [(x - 36, y + sgn * 6), (x + 36, y + sgn * 6)], INK, 2, 6, 5)
        d.arc([x - 48, y - 12, x - 24, y + 12], 0, 360, fill=INK, width=2)
        d.arc([x + 24, y - 12, x + 48, y + 12], 0, 360, fill=INK, width=2)
    elif kind == 'junction':
        d.ellipse([x - 18, y - 18, x + 18, y + 18], fill=(240, 232, 208), outline=(98, 68, 50), width=3)
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=(150, 170, 110), outline=(98, 68, 50), width=2)
        d.ellipse([x - 3.5, y - 3.5, x + 3.5, y + 3.5], fill=(255, 250, 226), outline=(150, 110, 40))
    elif kind == 'heart':
        star(d, x, y, 30, 9, 8, (232, 186, 70), (120, 80, 30))
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(196, 52, 44), outline=INK)
    elif kind == 'gate':
        d.line([(x - 44, y), (x - 10, y)], fill=(98, 68, 50), width=15)
        d.line([(x - 44, y), (x - 10, y)], fill=(240, 232, 208), width=11)
        d.line([(x - 18, y), (x + 40, y - 14)], fill=(104, 70, 52), width=9)
        d.line([(x - 18, y), (x + 40, y - 14)], fill=(236, 226, 200), width=6)
        d.line([(x - 2, y - 13), (x + 4, y + 5)], fill=(150, 56, 40), width=3)
    elif kind == 'town':
        for ox, oy in ((-14, 4), (0, -4), (14, 4), (4, 12)):
            house_glyph(d, x + ox, y + oy, 4)
    elif kind == 'lair':
        icon(d, 'lair', x, y, 30)
    elif kind == 'peak':
        peak_glyph(d, x, y + 6, 22)
    elif kind == 'river':
        pts = [(x - 44 + t * 8, y + 6 * math.sin(t)) for t in range(12)]
        d.line(pts, fill=(86, 124, 156), width=6)
        d.line(pts, fill=(126, 164, 188), width=3)


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
        l_ = (x + R * 0.14 * math.cos(a - math.pi / 2), y + R * 0.14 * math.sin(a - math.pi / 2))
        r_ = (x + R * 0.14 * math.cos(a + math.pi / 2), y + R * 0.14 * math.sin(a + math.pi / 2))
        d.polygon([tip, l_, (x, y)], fill=col, outline=INK)
        d.polygon([tip, r_, (x, y)], fill=(240, 232, 212), outline=INK)
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
    arr *= (0.975 + 0.05 * up(rng.random((H // 8, W // 8)), W, H))[..., None]
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(out, 'RGBA')
    m = 56
    for box in ([0, 0, W, m], [0, H - m, W, H], [0, 0, m, H], [W - m, 0, W, H]):
        d.rectangle(box, fill=(226, 214, 186))
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
