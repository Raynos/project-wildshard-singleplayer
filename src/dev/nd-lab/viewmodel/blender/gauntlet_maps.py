"""gauntlet_maps.py — the gauntlet's two maps from gauntlet.py's raw bake passes (lab P8 "viewmodel", E169).

  python3 gauntlet_maps.py <scratch dir> [<public dir>] [--q=90]

Every texel knows its 3D point (pass_pos), its smooth object-space normal (pass_nrm) and its part tag (pass_id), so
each pattern is a function of the 3D point in the GAUNTLET-local glTF frame, evaluated in numpy:
  h(p)  a height field in metres (engraving, weave, twill, grain) → the normal is bent by its gradient along the
        surface (two finite differences in the tangent plane) → gauntlet-nrm.webp (object space, Blender frame)
  d(p)  the albedo detail (0.5 neutral) → B of gauntlet-maps.webp
R = the Cycles AO; G = curvature from (1 − N·bevel(1.5 mm), 1 − AO(4 mm)): 0.5 flat, → 1 convex, → 0 in creases.
The engraving art (cloud scrolls, the 龍 crest, the 回 fret) is drawn with PIL into small tiles mapped by the
cylinder's (arc, y) coordinates.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ARGV = sys.argv[1:]
OPT = {a[2:].split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in ARGV if a.startswith('--')}
POS = [a for a in ARGV if not a.startswith('--')]
SCRATCH = POS[0]
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PUBLIC = POS[1] if len(POS) > 1 else os.path.join(REPO, 'public', 'assets', 'nine-dragon', 'lab', 'viewmodel')
Q = int(OPT.get('q', 90))
TAU = math.tau

# constants mirrored from gauntlet_parts.py
GR = 0.0565
TOP = dict(th0=math.radians(-40), th1=math.radians(40), y0=-0.1235, y1=-0.0675)
FLANK = dict(th0=math.radians(55), th1=math.radians(128), y0=-0.1235, y1=-0.0675)
CREST = dict(th=0.0, y=-0.095, ru=0.0165, ry=0.0205)
DRUM = dict(th=math.radians(91), y=-0.0955)
STRAPS = ((-0.1585, -0.1405), (-0.0535, -0.0435))
SLEEVE_Y1, SLEEVE_TRIM = -0.44, 0.034


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def g_r(y):
    return GR - 0.002 * smoothstep(-0.178, -0.036, y)


def hash3(p, seed=0.0):
    """a cheap value noise in 3D (vectorised), period-free enough for these scales"""
    i = np.floor(p)
    f = p - i
    f = f * f * (3 - 2 * f)

    def h(ix, iy, iz):
        n = np.sin(ix * 127.1 + iy * 311.7 + iz * 74.7 + seed * 19.3) * 43758.5453
        return n - np.floor(n)
    x0, y0, z0 = i[:, 0], i[:, 1], i[:, 2]
    fx, fy, fz = f[:, 0], f[:, 1], f[:, 2]
    c000, c100 = h(x0, y0, z0), h(x0 + 1, y0, z0)
    c010, c110 = h(x0, y0 + 1, z0), h(x0 + 1, y0 + 1, z0)
    c001, c101 = h(x0, y0, z0 + 1), h(x0 + 1, y0, z0 + 1)
    c011, c111 = h(x0, y0 + 1, z0 + 1), h(x0 + 1, y0 + 1, z0 + 1)
    x00 = c000 + (c100 - c000) * fx
    x10 = c010 + (c110 - c010) * fx
    x01 = c001 + (c101 - c001) * fx
    x11 = c011 + (c111 - c011) * fx
    y0_ = x00 + (x10 - x00) * fy
    y1_ = x01 + (x11 - x01) * fy
    return y0_ + (y1_ - y0_) * fz


def fbm(p, octaves=4, seed=0.0):
    a, s, tot = 0.5, 1.0, 0.0
    for o in range(octaves):
        tot = tot + a * hash3(p * s, seed + o)
        a *= 0.5
        s *= 2.03
    return tot / (1 - 0.5 ** octaves)


# ─────────────────────────── engraving art (PIL tiles) ───────────────────────────
def cloud(dr, x, y, s, w, flip=1):
    """a 祥云 scroll: a double curl on a tail, drawn as polylines"""
    def spiral(cx, cy, r0, turns, direction, start):
        pts = []
        n = 48
        for i in range(n + 1):
            u = i / n
            a = start + direction * u * turns * TAU
            r = r0 * (1 - 0.72 * u)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        return pts
    big = spiral(x, y, s, 0.85, flip, math.pi / 2)
    small = spiral(x + flip * s * 1.55, y + s * 0.25, s * 0.62, 0.8, -flip, math.pi / 2)
    tail = [(x - flip * s * 2.6, y + s), (x - flip * s * 1.2, y + s * 1.02), (x, y + s)]
    for poly in (big, small, tail):
        dr.line(poly, fill=255, width=w, joint='curve')
    dr.line([(x, y + s), (x + flip * s * 1.55, y + s * 0.87)], fill=255, width=w)


def tile_plate(W_m, L_m, kind, px_per_m=13000):
    """the engraving for a plate's panel: a double border, scrolls, (the crest's or the drum's clearance)"""
    Wp, Lp = int(W_m * px_per_m), int(L_m * px_per_m)
    im = Image.new('L', (Wp, Lp), 0)
    dr = ImageDraw.Draw(im)
    k = px_per_m
    inset = int(0.0068 * k)
    w = max(3, int(0.00042 * k))
    dr.rectangle([inset, inset, Wp - inset, Lp - inset], outline=255, width=w)
    dr.rectangle([inset + int(0.0014 * k), inset + int(0.0014 * k), Wp - inset - int(0.0014 * k), Lp - inset - int(0.0014 * k)], outline=255, width=max(2, w - 2))
    cx, cy = Wp / 2, Lp / 2
    s = 0.0036 * k
    if kind == 'top':
        # scrolls in the four quadrants round the crest, pointing inward; ruyi corners
        for (fx, fy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            cloud(dr, cx + fx * 0.0232 * k, cy + fy * 0.0118 * k, s, w, flip=-fx)
            ccx, ccy = cx + fx * (W_m / 2 - 0.0098) * k, cy + fy * (L_m / 2 - 0.0098) * k
            dr.arc([ccx - s * 0.7, ccy - s * 0.7, ccx + s * 0.7, ccy + s * 0.7], 0, 360, fill=255, width=w)
        # a clearance ring round the crest
        ru, ry = (CREST['ru'] + 0.0022) * k, (CREST['ry'] + 0.0022) * k
        dr.ellipse([cx - ru, cy - ry, cx + ru, cy + ry], outline=255, width=w)
    else:
        rr = 0.0252 * k
        dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=255, width=w)
        for (fx, fy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            cloud(dr, cx + fx * 0.0232 * k, cy + fy * 0.0155 * k, s * 0.8, w, flip=-fx)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255.0


def tile_glyph(ch='龍', px=512):
    im = Image.new('L', (px, px), 0)
    dr = ImageDraw.Draw(im)
    font = None
    for path, idx in (('/System/Library/Fonts/Supplemental/Songti.ttc', 1), ('/System/Library/Fonts/Supplemental/Songti.ttc', 0),
                      ('/System/Library/Fonts/Hiragino Sans GB.ttc', 1)):
        try:
            font = ImageFont.truetype(path, int(px * 0.78), index=idx)
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    bb = dr.textbbox((0, 0), ch, font=font)
    dr.text(((px - (bb[2] - bb[0])) / 2 - bb[0], (px - (bb[3] - bb[1])) / 2 - bb[1]), ch, fill=255, font=font)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(2.0)), np.float32) / 255.0


def tile_fret(px=256):
    """one period of a 回 key-fret meander on a band (x along, y across)"""
    im = Image.new('L', (px, px), 0)
    dr = ImageDraw.Draw(im)
    w = px // 14
    m = px * 0.14
    pts = [(0, px - m), (px * 0.72, px - m), (px * 0.72, m), (px * 0.28, m), (px * 0.28, px * 0.62), (px * 0.52, px * 0.62),
           (px * 0.52, px * 0.4)]
    dr.line(pts, fill=255, width=w, joint='curve')
    dr.line([(px * 0.72, px - m), (px, px - m)], fill=255, width=w)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(1.0)), np.float32) / 255.0


def sample(tile, u, v, wrap=False):
    """bilinear lookup of a tile at (u, v) ∈ [0, 1] (v = 0 at the top row)"""
    H, W = tile.shape
    if wrap:
        u = u % 1.0
        v = v % 1.0
    x = np.clip(u * (W - 1), 0, W - 1.001)
    y = np.clip(v * (H - 1), 0, H - 1.001)
    x0, y0 = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
    fx, fy = x - x0, y - y0
    a = tile[y0, x0] * (1 - fx) + tile[y0, x0 + 1] * fx
    b = tile[y0 + 1, x0] * (1 - fx) + tile[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


# ─────────────────────────── patterns ───────────────────────────
class Ctx:
    def __init__(self):
        wrap = json.load(open(os.path.join(SCRATCH, 'wrap.json')))
        self.W = wrap['WRAP']
        hel = np.array(wrap['helix'], np.float64)
        self.hel_th, self.hel_y = hel[:, 0], hel[:, 1]
        rb_top = g_r(-0.095) - 0.0002
        self.top_W = (TOP['th1'] - TOP['th0']) * rb_top
        self.flank_W = (FLANK['th1'] - FLANK['th0']) * rb_top
        self.rb = rb_top
        L = TOP['y1'] - TOP['y0']
        self.t_top = tile_plate(self.top_W, L, 'top')
        self.t_flank = tile_plate(self.flank_W, L, 'flank')
        self.t_glyph = tile_glyph()
        self.t_fret = tile_fret()
        # the talons' spines, for the blade coordinates
        claw = json.load(open(os.path.join(SCRATCH, 'claw.json')))
        self.talons = [t[0] for t in claw['talons']]
        self.spines = [np.array(sp) for sp in claw['spines']]
        # engraving lines also go to the curvature channel (the lab inks G < ~0.3): a per-texel ink request
        self.ink = None


def cylc(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    th = np.arctan2(x, z)
    r = np.sqrt(x * x + z * z)
    return th, y, r


def wrap_s(ctx, th, y):
    """the visible strip's across-coordinate s at (θ, y): the newest turn covering the point"""
    th_rel = (th - ctx.W['th0']) % TAU
    best_s = np.full(th.shape, 1e3)
    n_turns = int(ctx.hel_th[-1] / TAU) + 2
    w = ctx.W['w']
    for k in range(n_turns):
        tt = th_rel + k * TAU
        yc = np.interp(tt, ctx.hel_th, ctx.hel_y, left=np.nan, right=np.nan)
        s = y - yc
        ok = np.isfinite(s) & (s > -w / 2) & (s < w / 2)
        best_s = np.where(ok, s, best_s)  # later turns overwrite: the newest on top
    return best_s


def pattern(ctx, tag, P, need_d=True):
    """(h metres, d detail, ink 0..1) for points P (N, 3) in GAUNTLET-local glTF; `ink` = an engraved line the lab
    should draw (it lowers the curvature channel)"""
    th, y, r = cylc(P)
    u = th * r
    n = P.shape[0]
    h = np.zeros(n)
    d = np.full(n, 0.5)
    ink = np.zeros(n)
    if tag in ('sleeve',):
        h = 0.00005 * np.sin(TAU * (u / 0.0022 + y / 0.0022)) + 0.00003 * np.sin(TAU * (u / 0.0022 - y / 0.0044))
        if need_d:
            d = 0.5 + 0.06 * (fbm(P * 90.0, 3, 1.0) - 0.5) - 0.05 * np.clip(np.sin(TAU * (u / 0.0022 + y / 0.0022)), 0, 1)
    elif tag == 'trim':
        v = (y - (SLEEVE_Y1 - SLEEVE_TRIM)) / SLEEVE_TRIM
        vv = (v - 0.22) / 0.56
        f = sample(ctx.t_fret, u / 0.0135, np.clip(vv, 0, 1), wrap=True) * ((vv > 0) & (vv < 1))
        h = 0.00012 * f + 0.00003 * np.sin(TAU * y / 0.0012)
        if need_d:
            d = 0.46 + 0.28 * f
    elif tag == 'piping':
        h = 0.00012 * np.sin(TAU * (u / 0.0024 + y / 0.0017))
        if need_d:
            d = 0.5 + 0.1 * np.sin(TAU * (u / 0.0024 + y / 0.0017))
    elif tag in ('wrap', 'flap'):
        h = 0.00005 * (np.sin(TAU * u / 0.0015) * np.sin(TAU * y / 0.0015))
        if need_d:
            dirt = fbm(P * 70.0, 4, 2.0)
            d = 0.54 - 0.16 * smoothstep(0.52, 0.78, dirt) + 0.03 * np.sin(TAU * u / 0.0015) * np.sin(TAU * y / 0.0015)
            if tag == 'wrap':
                s = wrap_s(ctx, th, y)
                w = ctx.W['w']
                edge = np.where(np.abs(s) < w, 1 - smoothstep(0.0, 0.0028, s + w / 2), 0.0)
                d = d - 0.1 * edge
                # fraying: short light threads at the lower edge
                d = d + 0.08 * edge * (np.sin(u * 2400.0) > 0.7)
    elif tag in ('cord', 'tassel', 'stitch'):
        h = 0.00002 * np.sin(TAU * (u + y) / 0.0007)
        if need_d:
            d = 0.5 + 0.04 * (fbm(P * 300.0, 2, 3.0) - 0.5)
    elif tag == 'carbon':
        tw = 0.0031
        i = np.floor(u / tw)
        j = np.floor(y / tw)
        over = ((i + j) % 4) < 2
        fu, fy = u / tw - i, y / tw - j
        h = 0.00013 * np.where(over, np.sin(np.pi * fy), np.sin(np.pi * fu))
        if need_d:
            d = np.where(over, 0.57, 0.43) + 0.04 * np.where(over, np.sin(np.pi * fy), np.sin(np.pi * fu))
    elif tag == 'strap':
        e = np.full(n, 1.0)
        for (a, b) in STRAPS:
            inside = (y > a - 0.001) & (y < b + 0.001)
            e = np.where(inside, np.minimum(np.abs(y - a), np.abs(y - b)), e)
        h = 0.00003 * (fbm(P * 1800.0, 2, 4.0) - 0.5) - 0.00009 * np.exp(-((e - 0.0022) / 0.0005) ** 2)
        if need_d:
            d = 0.48 + 0.2 * (1 - smoothstep(0.0, 0.0012, e)) + 0.05 * (fbm(P * 250.0, 3, 5.0) - 0.5)
    elif tag in ('plate_top', 'plate_flank'):
        D = TOP if tag == 'plate_top' else FLANK
        tile = ctx.t_top if tag == 'plate_top' else ctx.t_flank
        Wm = ctx.top_W if tag == 'plate_top' else ctx.flank_W
        uu = (th - D['th0']) * ctx.rb / Wm
        vv = (y - D['y0']) / (D['y1'] - D['y0'])
        e = sample(tile, uu, 1 - vv)
        ink = np.clip(e * 1.3 - 0.15, 0, 1)
        h = -0.00016 * e + 0.00001 * (fbm(P * 900.0, 2, 6.0) - 0.5)
        if need_d:
            d = 0.56 - 0.34 * e + 0.08 * (fbm(P * 160.0, 3, 7.0) - 0.5)
            # scratches: thin anisotropic streaks
            d = d + 0.06 * (np.sin(u * 5200.0 + 40 * np.sin(y * 300.0)) > 0.985)
    elif tag == 'crest':
        du = (th - CREST['th']) * r
        dy = y - CREST['y']
        uu = du / (CREST['ru'] * 0.6) * 0.5 + 0.5
        vv = 0.5 - dy / (CREST['ry'] * 0.6) * 0.5
        rad = np.sqrt((du / CREST['ru']) ** 2 + (dy / CREST['ry']) ** 2)
        g = sample(ctx.t_glyph, uu, vv) * (rad < 0.62)
        # a ring of beads round the rim
        ang = np.arctan2(du / CREST['ru'], dy / CREST['ry'])
        bead = (np.abs(rad - 0.82) < 0.05) * (np.cos(ang * 28) > 0.2)
        ink = np.clip(1.0 - np.abs(rad - 0.66) / 0.035, 0, 1)
        h = 0.0008 * g + 0.0003 * bead
        if need_d:
            d = 0.22 + 0.58 * g + 0.3 * bead + 0.16 * (rad > 0.7)
    elif tag in ('band', 'collar', 'crown', 'collar_band'):
        # a running fret on the collar's dark band, fine turned rings elsewhere
        base = 0.00002 * np.sin(TAU * y / 0.0006)
        f = np.zeros(n)
        if tag == 'collar_band':
            vv = (y + 0.0332) / 0.0136
            f = sample(ctx.t_fret, u / 0.012, np.clip(vv, 0, 1), wrap=True) * ((vv > 0) & (vv < 1))
        ink = np.clip(f * 1.3 - 0.15, 0, 1)
        h = base - 0.00014 * f
        if need_d:
            d = 0.55 - 0.3 * f + 0.07 * (fbm(P * 140.0, 3, 8.0) - 0.5)
            d = d + 0.05 * (np.sin(u * 4800.0 + 30 * np.sin(y * 500.0)) > 0.985)
    elif tag == 'hub':
        a = np.arctan2(P[:, 0], P[:, 2])
        rr = np.sqrt(P[:, 0] ** 2 + P[:, 2] ** 2)
        f = (np.sin(a * 6 + rr * 900.0) > 0.86).astype(np.float64)
        ink = f * (rr > 0.004)
        h = -0.0001 * f
        if need_d:
            d = 0.55 - 0.25 * f
    elif tag == 'blade':
        # the blade: engraved double line along the flat, polished spine (lighter), a patina toward the root
        phi = np.arctan2(P[:, 0], P[:, 2])
        best = np.full(n, 1e9)
        tpar = np.zeros(n)
        sn = np.zeros(n)
        for k, tal in enumerate(ctx.talons):
            dphi = np.abs(((phi - tal + np.pi) % TAU) - np.pi)
            rho = P[:, 0] * math.sin(tal) + P[:, 2] * math.cos(tal)
            sp = ctx.spines[k]
            dense = np.stack([np.interp(np.linspace(0, len(sp) - 1, 200), np.arange(len(sp)), sp[:, c]) for c in (0, 1)], -1)
            dd = (rho[:, None] - dense[None, :, 0]) ** 2 + (P[:, 1][:, None] - dense[None, :, 1]) ** 2
            idx = np.argmin(dd, axis=1)
            dist = np.sqrt(dd[np.arange(n), idx]) + dphi * 0.2
            upd = dist < best
            best = np.where(upd, dist, best)
            tpar = np.where(upd, idx / 199.0, tpar)
            sn = np.where(upd, rho - dense[idx, 0], sn)
        line = np.exp(-((np.abs(sn) - 0.0038 * (1 - tpar)) / 0.00045) ** 2) * (tpar > 0.08) * (tpar < 0.8)
        ink = np.clip(line * 1.4 - 0.2, 0, 1)
        h = -0.00012 * line
        if need_d:
            d = 0.52 - 0.3 * line + 0.1 * tpar + 0.05 * (fbm(P * 200.0, 3, 9.0) - 0.5)
    elif tag in ('buckle', 'drum', 'bolt', 'rivet', 'pin', 'clevis', 'knuckle', 'ferrule', 'pipe', 'tassel_cap', 'front', 'lug', 'arm', 'line', 'ram', 'rod'):
        h = 0.000008 * (fbm(P * 1500.0, 2, 10.0) - 0.5)
        if need_d:
            d = 0.5 + 0.08 * (fbm(P * 180.0, 3, 11.0) - 0.5)
            if tag == 'front':
                a = np.arctan2(P[:, 0], P[:, 2])
                d = d - 0.08 * (np.cos(a * 36) > 0.8)
            if tag == 'drum':
                d = d + 0.06 * (np.sin(P[:, 1] * 2600.0) > 0.6)
    return h, d, ink


# ─────────────────────────── assemble ───────────────────────────
def load(kind):
    return np.load(os.path.join(SCRATCH, f'pass_{kind}.npy'))


def dilate_ids(ids, mask, iters=14):
    ids = ids.copy()
    m = mask.copy()
    for _ in range(iters):
        grow = np.zeros_like(m)
        cand = ids.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh_m = np.roll(np.roll(m, dy, 0), dx, 1)
            sh_i = np.roll(np.roll(ids, dy, 0), dx, 1)
            take = (~m) & sh_m & (~grow)
            cand = np.where(take, sh_i, cand)
            grow |= take
        ids = cand
        m = m | grow
    return ids, m


def main():
    tags = json.load(open(os.path.join(SCRATCH, 'tags.json')))['tags']
    nrm = load('nrm')
    pos = load('pos')
    idp = load('id')
    cv = load('cv')
    ao = load('ao')
    S = nrm.shape[0]
    mask = idp[..., 3] > 0.5
    ids = np.floor(idp[..., 0] * 64.0).astype(np.int32)
    ids, cover = dilate_ids(ids, mask, 14)
    cover = cover & (pos[..., 3] > 0.5)
    print('[maps] coverage', round(mask.mean() * 100, 1), '% (+margin', round(cover.mean() * 100, 1), '%)', flush=True)

    Pb = (pos[..., :3] - 0.5) * 2.0
    Nb = nrm[..., :3] * 2.0 - 1.0
    # Blender → glTF
    Pg = np.stack([Pb[..., 0], Pb[..., 2], -Pb[..., 1]], -1)
    Ng = np.stack([Nb[..., 0], Nb[..., 2], -Nb[..., 1]], -1)
    Ng /= np.maximum(np.linalg.norm(Ng, axis=-1, keepdims=True), 1e-6)

    out_n = Ng.copy()
    out_d = np.full((S, S), 0.5)
    out_i = np.zeros((S, S))
    ctx = Ctx()
    eps = 0.00012
    for ti, tag in enumerate(tags):
        sel = cover & (ids == ti)
        if not sel.any():
            continue
        P = Pg[sel].astype(np.float64)
        N = Ng[sel].astype(np.float64)
        a = np.where(np.abs(N[:, 1:2]) < 0.9, np.array([[0, 1, 0]]), np.array([[1, 0, 0]]))
        t1 = np.cross(N, a)
        t1 /= np.maximum(np.linalg.norm(t1, axis=1, keepdims=True), 1e-9)
        t2 = np.cross(N, t1)
        h0, d0, i0 = pattern(ctx, tag, P)
        h1, _, _ = pattern(ctx, tag, P + t1 * eps, need_d=False)
        h2, _, _ = pattern(ctx, tag, P + t2 * eps, need_d=False)
        g1 = (h1 - h0) / eps
        g2 = (h2 - h0) / eps
        n2 = N - t1 * g1[:, None] - t2 * g2[:, None]
        n2 /= np.maximum(np.linalg.norm(n2, axis=1, keepdims=True), 1e-9)
        out_n[sel] = n2
        out_d[sel] = d0
        out_i[sel] = i0
        print(f'[maps] {tag:12s} {sel.sum():8d} texels  h ±{np.abs(h0).max() * 1000:.3f} mm  d {d0.min():.2f}…{d0.max():.2f}', flush=True)

    # R: AO, G: curvature, B: detail
    edge = np.clip(cv[..., 0] * 4.0, 0, 1)
    crease = np.clip(cv[..., 1] * 2.2 - 0.08, 0, 1)
    # thin tubes (cord, tassel, stitches, piping) sit in their own 4 mm occlusion: halve it so they don't ink solid
    thin = np.isin(ids, [tags.index(t) for t in ('cord', 'tassel', 'stitch', 'piping') if t in tags])
    crease = np.where(thin, crease * 0.45, crease)
    G = np.clip(0.5 + 0.5 * edge * (1 - crease) - 0.5 * crease, 0, 1)
    G = np.minimum(G, 0.5 - 0.42 * out_i)
    R = np.clip(0.22 + 0.78 * ao[..., 0], 0, 1)
    Bc = np.clip(out_d, 0, 1)
    R = np.where(cover, R, 1.0)
    G = np.where(cover, G, 0.5)
    Bc = np.where(cover, Bc, 0.5)
    maps = np.stack([R, G, Bc], -1)
    Nout_b = np.stack([out_n[..., 0], -out_n[..., 2], out_n[..., 1]], -1)
    nenc = np.where(cover[..., None], Nout_b * 0.5 + 0.5, 0.5)
    # Blender pixels are bottom-up; image files top-down
    maps8 = (np.flipud(maps) * 255 + 0.5).astype(np.uint8)
    n8 = (np.flipud(np.clip(nenc, 0, 1)) * 255 + 0.5).astype(np.uint8)
    os.makedirs(PUBLIC, exist_ok=True)
    pm, pn = os.path.join(PUBLIC, 'gauntlet-maps.webp'), os.path.join(PUBLIC, 'gauntlet-nrm.webp')
    Image.fromarray(maps8, 'RGB').save(pm, 'WEBP', quality=Q, method=6)
    Image.fromarray(n8, 'RGB').save(pn, 'WEBP', quality=Q, method=6)
    # debug views
    Image.fromarray(maps8, 'RGB').resize((1024, 1024)).save(os.path.join(SCRATCH, 'maps-preview.png'))
    Image.fromarray(n8, 'RGB').resize((1024, 1024)).save(os.path.join(SCRATCH, 'nrm-preview.png'))
    print('[maps] G stats (covered): mean', round(float(G[cover].mean()), 3), 'p5', round(float(np.percentile(G[cover], 5)), 3), 'p95', round(float(np.percentile(G[cover], 95)), 3))
    print('[maps] wrote', pm, os.path.getsize(pm) // 1024, 'KB;', pn, os.path.getsize(pn) // 1024, 'KB', flush=True)


main()
