"""gauntlet_parts.py — the Fei Zhua gauntlet's parts (lab P8 "viewmodel", E169), authored in GAUNTLET-local glTF.

Layout along +y (elbow → hand; the claw hub at the origin):
  -0.76 … -0.44  the dark sleeve (folds), its red trim + gold piping at the forearm end, a rolled hem
  -0.465 … -0.165  cream bandage wraps: one shingled helical strip (each turn over the last), two loose ends
  -0.455 … -0.19   the red two-strand cord spiralling over the wraps, three tight binding turns, a knot underneath,
                   a short tassel hanging toward view-down
  -0.178 … 0.0     the gauntlet: carbon sleeve, a brass rear rim, leather strap + buckle, a thin band, the engraved top
                   plate with the 龍 crest, the flank plate with the line drum, a band, a thin strap, the launcher
                   collar, the recessed front plate with bolts and the cyan muzzle ring
  claw (own node)  hub + three mechanical talons (clevis, arm, knuckle, ferrule, curved blade), folded forward
"""
import math

from gauntlet_geo import TAU, Acc, Section, V, circle, cyl, lerp, radial, round_rect, smoothstep, tangential

# view-down in GAUNTLET-local (the tassel hangs this way): −(the view's up vector)
DOWN = V(0.122, -0.546, -0.829).normalized()


def r_arm(y):
    """the bare forearm radius (under the wraps)"""
    t = min(1.0, max(0.0, (-0.03 - y) / 0.72))
    return 0.044 + 0.012 * t ** 0.8


# ─────────────────────────── the wraps' helix (shared with the maps script through `wrap_table`) ───────────────────────────
WRAP = dict(y0=-0.468, y1=-0.162, p=0.0205, w=0.0285, t=0.0021, th0=0.6)


def wrap_helix(steps_per_turn=40):
    """θ_total → (y centre, pitch) samples of the bandage's helix"""
    W = WRAP
    out = []
    th, y = 0.0, W['y0']
    dth = TAU / steps_per_turn
    while y < W['y1']:
        p = W['p'] * (1 + 0.09 * math.sin(th * 0.37 + 1.0) + 0.05 * math.sin(th * 1.13))
        out.append((th, y, p))
        y += p * dth / TAU
        th += dth
    return out


def wrap_surface_r(y):
    """outer radius of the wrapped forearm (for the cord to ride on)"""
    return r_arm(y) + 0.001 + 2 * WRAP['t']


def build_wraps(acc):
    W = WRAP
    w, t = W['w'], W['t']
    o = w - W['p']
    hel = wrap_helix(36)
    # across the strip (s from the lower edge −w/2 to the upper +w/2): (s, lift share, edge share)
    S = [(-w / 2, 1.0, 0.25), (-w / 2 + 0.0006, 1.0, 0.8), (-w / 2 + 0.0016, 1.0, 1.0), (-w / 2 + o * 0.6, 1.0, 1.0),
         (-w / 2 + o, 0.97, 1.0), (-w / 2 + o + 0.002, 0.55, 1.0), (-w / 2 + o + 0.0045, 0.08, 1.0),
         (0.0, 0.0, 1.0), (w / 2 - 0.004, 0.0, 1.0), (w / 2 - 0.0012, 0.0, 0.95), (w / 2, 0.0, 0.35)]
    rows = []
    for (th, yc, p) in hel:
        # the strip wanders a little: its width breathes, it tilts
        wob = 0.0012 * math.sin(th * 2.3) + 0.0008 * math.sin(th * 5.1 + 0.4)
        row = []
        for (s, lift, edge) in S:
            y = yc + s * (1 + 0.04 * math.sin(th * 0.9)) + wob * (s / (w / 2)) * 0.5
            r = r_arm(y) + 0.001 + t * lift + t * edge
            # soft cloth: a faint ripple along the strip
            r += 0.00018 * math.sin(th * 23.0 + s * 300.0) * edge
            row.append(cyl(th + W['th0'], y, r))
        rows.append(row)
    acc.grid(rows, 'wrap', flip=True, split=18)
    # the folded-under edges: a thin return at both edges so no gap reads from the side
    # (the rows above already drop to 25–35 % at the edges; the previous turn fills in beneath)

    # two figure-8 passes crossing the turns on the visible flank (steep strips over the helix)
    for (th_a, y_a, span, rise) in ((0.55, -0.418, 2.3, 0.07), (0.85, -0.318, 2.1, -0.062)):
        path = []
        n = 40
        for i in range(n + 1):
            u = i / n
            y = y_a + rise * u
            path.append(cyl(th_a + span * u, y, r_arm(y) + 0.001 + 2 * t + 0.0011 + 0.0003 * math.sin(u * 9)))
        ws = 0.024
        acc.sweep(path, Section([(0.00045, -ws / 2), (0.00045, ws / 2), (-0.00045, ws / 2), (-0.00045, -ws / 2)]), 'wrap', up0=radial(th_a))
    # two loose ends peeling off: a short strip lifting away from the surface, sagging toward view-down
    for (th_f, y_f, L, wf, curl) in ((1.35, -0.262, 0.055, 0.019, 1.0), (2.75, -0.395, 0.045, 0.017, -0.7)):
        path = []
        n = 14
        for i in range(n + 1):
            a = i / n * L
            lift = 0.0 if a < 0.018 else (a - 0.018) ** 1.6 * 2.2
            th = th_f - a / wrap_surface_r(y_f) * 0.9
            p = cyl(th, y_f + curl * a * 0.12, wrap_surface_r(y_f) + 0.0005 + lift)
            p += DOWN * max(0.0, a - 0.022) * 0.35
            path.append(p)
        sec = Section([(0.00045, -wf / 2), (0.00045, wf / 2), (-0.00045, wf / 2), (-0.00045, -wf / 2)],
                      lambda tt: (1.0, 1.0 - 0.25 * tt))
        # N = the surface normal at the start (sn is the thickness axis)
        acc.sweep(path, _sec_nb(sec), 'flap', up0=radial(th_f))


def _sec_nb(sec):
    return sec


# ─────────────────────────── the sleeve ───────────────────────────
SLEEVE = dict(y0=-0.765, y1=-0.44, trim=0.034)


def sleeve_r(th, y):
    y1 = SLEEVE['y1']
    base = 0.0615 + 0.0065 * smoothstep(y1, -0.76, y)
    amp = 0.0042 * smoothstep(y1 - 0.045, y1 - 0.11, y)
    f = 0.0
    for (k, ph, dr, a) in ((4, 0.3, 21.0, 1.0), (7, 1.9, -33.0, 0.6), (11, 4.1, 47.0, 0.35)):
        s = 0.5 + 0.5 * math.sin(k * th + ph + dr * y + 0.6 * math.sin(y * 17.0 + k))
        f += a * s ** 3
    # compression bunching toward the cuff, a sag on the underside
    bunch = 0.0022 * smoothstep(y1 - 0.03, y1 - 0.07, y) * (1 - smoothstep(y1 - 0.12, y1 - 0.18, y))
    bunch *= (0.5 + 0.5 * math.sin((y - y1) / 0.021 * TAU + 0.8 * math.sin(3 * th)))
    sag = 0.0035 * max(0.0, -math.cos(th)) ** 2
    return base + amp * f * 0.55 + bunch + sag


def build_sleeve(acc):
    S = SLEEVE
    sides = 64
    ys = []
    y = S['y0']
    while y < S['y1'] - S['trim'] - 0.004:
        ys.append(y)
        y += 0.0078
    tr0 = S['y1'] - S['trim']
    ys += [tr0 - 0.002, tr0 - 0.0004, tr0 + 0.0004, tr0 + 0.003, tr0 + S['trim'] * 0.5, S['y1'] - 0.003, S['y1'] - 0.0006]
    rows_y = []
    for y in ys:
        in_trim = y > tr0
        row = []
        for i in range(sides):
            th = TAU * i / sides
            r = sleeve_r(th, min(y, tr0 - 0.004)) + (0.0014 if in_trim else 0.0)
            row.append(cyl(th, y, r))
        rows_y.append(row)
    # the rolled hem: over the lip and back inside
    rim = []
    for (dy, dr) in ((0.0008, -0.0012), (0.0, -0.0032), (-0.012, -0.0038), (-0.04, -0.004)):
        row = []
        for i in range(sides):
            th = TAU * i / sides
            r = sleeve_r(th, tr0 - 0.004) + 0.0014 + dr
            row.append(cyl(th, S['y1'] + dy, r))
        rim.append(row)
    rows = rows_y + rim
    ntr = len(rows_y)

    def tag(i, j):
        yj = rows[j][0].y
        if j >= ntr - 1 or yj >= tr0 - 1e-6:
            return 'trim'
        return 'sleeve'
    acc.grid(rows, tag, closed_u=True)
    # gold piping at both trim edges
    for (yp, rr) in ((tr0 + 0.0002, 0.0014), (S['y1'] - 0.0035, 0.0011)):
        path = [cyl(TAU * i / 64, yp, sleeve_r(TAU * i / 64, tr0 - 0.004) + 0.0014 + rr * 0.55) for i in range(64)]
        acc.sweep(path, Section(circle(5, rr)), 'piping', up0=V(0, 1, 0), caps=(False, False), closed_path=True, split=16)


# ─────────────────────────── the red cord ───────────────────────────
def cord_path():
    """the cord's centreline: spiral up the wraps, three tight binding turns, then to the knot underneath"""
    pts = []
    th0 = 2.2
    turns = 2.6
    ya, yb = -0.452, -0.206
    n = int(turns * 48)
    for i in range(n + 1):
        u = i / n
        th = th0 + u * turns * TAU
        y = lerp(ya, yb, u)
        pts.append((th, y))
    th_b = pts[-1][0]
    # binding turns: tight (pitch 5.6 mm), ending underneath (θ ≡ π)
    nb = 2.5
    th_end = th_b + nb * TAU
    th_end += ((math.pi - th_end) % TAU)
    m = int((th_end - th_b) / TAU * 48)
    for i in range(1, m + 1):
        u = i / m
        pts.append((th_b + u * (th_end - th_b), yb + u * 0.0145))
    P = []
    for (th, y) in pts:
        P.append(cyl(th, y, wrap_surface_r(y) + 0.0036))
    return P


def build_cord(acc, rs=0.00215, rt=0.0019, lam=0.0165, sides=5):
    path = cord_path()
    # resample to ~3 mm steps for the twist
    from gauntlet_geo import transport
    fr = transport(path, radial(2.2))
    lens = [0.0]
    for i in range(1, len(path)):
        lens.append(lens[-1] + (path[i] - path[i - 1]).length)
    for strand in (0, 1):
        sp = []
        for i, (p, T, N, B) in enumerate(fr):
            psi = TAU * lens[i] / lam + strand * math.pi
            sp.append(p + (N * math.cos(psi) + B * math.sin(psi)) * rt)
        acc.sweep(sp, Section(circle(sides, rs)), 'cord', caps=(True, True), split=40)
    return path[-1]


def build_knot_tassel(acc, end):
    """the knot on the underside and a short tassel hanging view-down"""
    out = radial(math.pi)
    k0 = end + out * 0.002
    for (d, s) in ((V(0.0, 0.0, 0.0), 0.0052), (V(0.0035, 0.004, -0.001), 0.0042), (V(-0.0035, 0.0035, -0.001), 0.004), (V(0.0, -0.0045, -0.0015), 0.0038)):
        c = k0 + d
        _blob(acc, c, s, 'cord')
    # hanging cord → cap → strands
    top = k0 + out * 0.004
    c1 = top + DOWN * 0.016
    acc.sweep([top, top + DOWN * 0.006 + V(0.001, 0, 0), c1], Section(circle(6, 0.0017)), 'cord')
    from gauntlet_geo import perp_basis
    e0, e90 = perp_basis(DOWN, V(1, 0, 0))
    # the cap (a small brass bell) and a silk knob above it
    _blob(acc, c1 + DOWN * 0.001, 0.0038, 'cord')
    prof = [(0.0, 0.0), (0.0032, 0.0), (0.0042, 0.003), (0.0055, 0.008), (0.006, 0.0115), (0.0052, 0.013), (0.0, 0.013)]
    acc.lathe(prof, 'tassel_cap', sides=14, axis_frame=(c1 + DOWN * 0.003, DOWN, e0, e90))
    base = c1 + DOWN * 0.0155
    n = 16
    for i in range(n):
        a = TAU * i / n + 0.2 * math.sin(i * 2.7)
        rr = 0.0036 + 0.0012 * ((i * 7) % 3) / 2
        L = 0.058 + 0.012 * ((i * 5) % 4) / 3
        p0 = base + (e0 * math.cos(a) + e90 * math.sin(a)) * 0.0038
        path = []
        for j in range(8):
            u = j / 7
            spread = rr + 0.007 * u ** 1.3
            q = base + DOWN * (L * u) + (e0 * math.cos(a) + e90 * math.sin(a)) * spread
            q += V(0.0016, 0, 0) * math.sin(u * 3 + i)
            path.append(q if j else p0)
        acc.sweep(path, Section(circle(4, 0.00115), lambda tt: (1 - 0.35 * tt, 1 - 0.35 * tt)), 'tassel')
    # a binding band round the strands' neck
    acc.lathe([(0.0046, 0.0), (0.0052, 0.001), (0.0052, 0.004), (0.0046, 0.005)], 'cord', sides=14,
              axis_frame=(base + DOWN * 0.004, DOWN, e0, e90))


def _blob(acc, c, s, tag):
    rows = []
    rings, sides = 6, 10
    for j in range(rings + 1):
        a = -math.pi / 2 + math.pi * j / rings
        rows.append([c + V(math.cos(a) * math.sin(TAU * i / sides), math.sin(a), math.cos(a) * math.cos(TAU * i / sides)) * s for i in range(sides)])
    acc.grid(rows, tag, closed_u=True)


# ─────────────────────────── the gauntlet ───────────────────────────
GR = 0.0565  # the carbon shell radius at the back (tapers to GR − 0.002 at the front)


def g_r(y):
    return GR - 0.002 * smoothstep(-0.178, -0.036, y)


def band_profile(y0, y1, r_in, r_out, c=0.0009, groove=False, bead=False):
    ym = (y0 + y1) / 2
    prof = [(r_in, y0), (r_out - c, y0), (r_out, y0 + c)]
    if groove:
        prof += [(r_out, ym - 0.0011), (r_out - 0.0007, ym - 0.0004), (r_out - 0.0007, ym + 0.0004), (r_out, ym + 0.0011)]
    if bead:
        prof += [(r_out, ym - 0.0016), (r_out + 0.0009, ym - 0.0008), (r_out + 0.0011, ym), (r_out + 0.0009, ym + 0.0008), (r_out, ym + 0.0016)]
    prof += [(r_out, y1 - c), (r_out - c, y1), (r_in, y1)]
    return prof


def plate(acc, th0, th1, y0, y1, H, tag, R=None, c=0.0009, panel=0.0056, recess=0.0009, sub_u=24, sub_y=14):
    """an engraved plate on the shell: a chamfered slab with a recessed panel, bent round the cylinder"""
    Rb = (R or GR) - 0.0002
    W = (th1 - th0) * Rb
    L = y1 - y0
    eps = 0.00025

    def bps(total, sub):
        pts = [(0.0, 0.0, 0.0), (eps, H - c, 0.0), (c, H, 0.0), (panel, H, 0.0), (panel + 0.0006, H, 1.0)]
        inner0, inner1 = panel + 0.0006, total - panel - 0.0006
        for k in range(1, sub):
            pts.append((lerp(inner0, inner1, k / sub), H, 1.0))
        pts += [(total - panel - 0.0006, H, 1.0), (total - panel, H, 0.0), (total - c, H, 0.0), (total - eps, H - c, 0.0), (total, 0.0, 0.0)]
        return pts
    U = bps(W, sub_u)
    Y = bps(L, sub_y)
    rows = []
    for (yy, hy, py) in Y:
        row = []
        for (uu, hu, pu) in U:
            h = min(hu, hy) - (recess if min(pu, py) > 0.5 else 0.0)
            th = th0 + uu / Rb
            row.append(cyl(th, y0 + yy, Rb + h))
        rows.append(row)
    acc.grid(rows, tag)
    return Rb + H


def rivet_ring(acc, th, y, r, tag='rivet', rr=0.0017):
    acc.dome(cyl(th, y, r - 0.0003), radial(th), rr, tag, h=rr * 0.7, sides=10, rings=3)


def build_gauntlet(acc):
    # the carbon shell
    rows = []
    sides = 80
    ys = [-0.178 + k * (0.144 / 14) for k in range(15)]
    for y in ys:
        rows.append([cyl(TAU * i / sides, y, g_r(y)) for i in range(sides)])
    acc.grid(rows, 'carbon', closed_u=True)
    # a stitched seam on the lower visible flank (θ 140°): two rows of red stitches
    th_s = math.radians(140)
    for dth in (-0.035, 0.035):
        for k in range(22):
            y = -0.126 + k * 0.0027
            p = cyl(th_s + dth, y, g_r(y) + 0.0002)
            q = cyl(th_s + dth * 0.2, y + 0.0019, g_r(y) + 0.0002)
            acc.sweep([p, q], Section(circle(4, 0.00055)), 'stitch', up0=radial(th_s))

    # rear rim (thick, beaded), a thin band, the band before the collar
    acc.lathe(band_profile(-0.1805, -0.1655, GR - 0.004, GR + 0.0052, bead=True), 'band', sides=sides)
    acc.lathe(band_profile(-0.1318, -0.1262, g_r(-0.13) - 0.001, g_r(-0.13) + 0.0032, groove=False), 'band', sides=sides)
    acc.lathe(band_profile(-0.0645, -0.0565, g_r(-0.06) - 0.001, g_r(-0.06) + 0.0036, groove=True), 'band', sides=sides)

    # strap A (leather) with a buckle on the visible flank, strap B (thin) with a riveted end
    for (y0, y1, th_b, buckle) in ((-0.1585, -0.1405, math.radians(104), True), (-0.0535, -0.0435, math.radians(96), False)):
        rs = g_r((y0 + y1) / 2) + 0.0019
        acc.lathe([(rs - 0.0022, y0), (rs - 0.0004, y0), (rs, y0 + 0.0006), (rs, y1 - 0.0006), (rs - 0.0004, y1), (rs - 0.0022, y1)], 'strap', sides=sides)
        # stitches along both edges on the visible half
        for ye in (y0 + 0.0022, y1 - 0.0022):
            for k in range(46 if buckle else 0):
                th = math.radians(-35) + k * 0.052
                acc.sweep([cyl(th, ye, rs + 0.0001), cyl(th + 0.028, ye, rs + 0.0001)], Section(circle(3, 0.00055)), 'stitch', up0=V(0, 1, 0))
        if buckle:
            _buckle(acc, th_b, (y0 + y1) / 2, rs, (y1 - y0))
        else:
            acc.dome(cyl(th_b, (y0 + y1) / 2, rs), radial(th_b), 0.0028, 'rivet', h=0.0016)

    # the top plate (engraved) and the flank plate (carries the line drum)
    top_r = plate(acc, math.radians(-40), math.radians(40), -0.1235, -0.0675, 0.0042, 'plate_top', R=g_r(-0.095))
    fl_r = plate(acc, math.radians(55), math.radians(128), -0.1235, -0.0675, 0.0036, 'plate_flank', R=g_r(-0.095))
    for (th, y) in ((-0.64, -0.1205), (0.64, -0.1205), (-0.64, -0.0705), (0.64, -0.0705), (-0.21, -0.1205), (0.21, -0.1205),
                    (-0.21, -0.0705), (0.21, -0.0705), (-0.64, -0.0955), (0.64, -0.0955)):
        rivet_ring(acc, th, y, top_r, rr=0.0015)
    for (th, y) in ((math.radians(59), -0.1195), (math.radians(124), -0.1195), (math.radians(59), -0.0715), (math.radians(124), -0.0715)):
        rivet_ring(acc, th, y, fl_r)
    _crest(acc, 0.0, -0.095, top_r)
    _drum(acc, math.radians(91), -0.0955, fl_r)

    # the launcher collar + the recessed front plate + the muzzle ring
    # the launcher collar: brass ring · a dark knurled band carrying six lugs · a beaded brass ring · the front taper
    acc.lathe([(g_r(-0.05) - 0.002, -0.0425), (g_r(-0.05) + 0.0018, -0.0425), (0.0598, -0.0405), (0.0603, -0.0352),
               (0.0596, -0.0342), (0.0588, -0.0342)], 'collar', sides=sides)
    acc.lathe([(0.0588, -0.0342), (0.0588, -0.0186)], 'collar_band', sides=sides)
    acc.lathe([(0.0588, -0.0186), (0.0604, -0.0184), (0.0612, -0.0174), (0.0612, -0.0162), (0.0618, -0.0152),
               (0.0612, -0.0142), (0.0612, -0.0128), (0.0598, -0.0118), (0.0572, -0.0086), (0.0552, -0.0052),
               (0.0538, -0.0026), (0.0532, -0.0006), (0.0515, 0.0008), (0.0492, 0.0008)], 'collar', sides=sides)
    # a ring of small rivets on the front taper
    for k in range(16):
        a = TAU * (k + 0.5) / 16
        acc.dome(cyl(a, -0.0098, 0.0584), (radial(a) * 0.8 + V(0, 0.6, 0)).normalized(), 0.0011, 'rivet', h=0.0007, sides=8, rings=2)
    # six lugs on the dark band, a rivet in each
    for k in range(6):
        a = math.radians(15) + TAU * k / 6
        c = cyl(a, -0.0264, 0.0596)
        acc.box(c, tangential(a), V(0, 1, 0), radial(a), 0.0052, 0.0058, 0.0013, 'lug', bevel=0.0007, segs=2)
        acc.dome(cyl(a, -0.0264, 0.0608), radial(a), 0.0015, 'rivet', h=0.001)
    front = [(0.0492, 0.0008), (0.0478, -0.0012), (0.0462, -0.0026), (0.0292, -0.0034), (0.0286, -0.0038)]
    acc.lathe(front, 'front', sides=sides)
    acc.lathe([(0.0286, -0.0038), (0.0262, -0.0024), (0.0232, -0.0024), (0.0214, -0.0038)], 'glow', sides=sides)
    acc.lathe([(0.0214, -0.0038), (0.0206, -0.008), (0.0206, -0.03), (0.0, -0.03)], 'front', sides=48)
    # six hex bolts on the front plate
    for k in range(6):
        a = TAU * k / 6 + math.pi / 6
        c = V(math.sin(a) * 0.0378, -0.0032, math.cos(a) * 0.0378)
        acc.cylinder(c, c + V(0, 0.0017, 0), 0.0024, 'bolt', sides=6, bevel=0.0003)

    # a hydraulic ram on the lower flank: cylinder + rod + end eyes (the launcher's recoil damper)
    th_r = math.radians(126)
    ra, rb = cyl(th_r, -0.121, g_r(-0.121) + 0.0062), cyl(th_r, -0.047, g_r(-0.047) + 0.0062)
    dr_ = (rb - ra).normalized()
    acc.cylinder(ra + dr_ * 0.004, ra + dr_ * 0.046, 0.0047, 'ram', sides=16, bevel=0.0007)
    acc.cylinder(ra + dr_ * 0.046, rb - dr_ * 0.004, 0.0022, 'rod', sides=12, bevel=0.0003)
    acc.lathe([(0.0049, 0.0), (0.0055, 0.001), (0.0055, 0.004), (0.0049, 0.005)], 'band', sides=16,
              axis_frame=(ra + dr_ * 0.02, dr_, *_pb(dr_)))
    for (p, s_) in ((ra, 1), (rb, -1)):
        acc.box(p, tangential(th_r), dr_, radial(th_r), 0.0036, 0.0048, 0.0028, 'lug', bevel=0.0009, segs=2)
        acc.cylinder(p - tangential(th_r) * 0.0046, p + tangential(th_r) * 0.0046, 0.0016, 'pin', sides=10, bevel=0.0003)
    # a line guide pipe from the drum to the collar, two clamps
    th_p = math.radians(70)
    pa, pb = cyl(th_p, -0.083, fl_r + 0.0018), cyl(th_p, -0.047, g_r(-0.047) + 0.0052)
    mid = (pa + pb) * 0.5 + radial(th_p) * 0.0012
    acc.sweep([pa, mid, pb], Section(circle(8, 0.0023)), 'pipe', up0=radial(th_p))
    for y in (-0.052,):
        acc.cylinder(cyl(th_p, y - 0.002, g_r(y) + 0.0046), cyl(th_p, y + 0.002, g_r(y) + 0.0046), 0.0034, 'buckle', sides=10, bevel=0.0004)


def _pb(n):
    from gauntlet_geo import perp_basis
    return perp_basis(n, None)


def _buckle(acc, th, yc, rs, width):
    e_n, e_t, e_y = radial(th), tangential(th), V(0, 1, 0)
    c = cyl(th, yc, rs + 0.0012)
    hw = width / 2 + 0.0028  # the frame is wider than the strap
    bw = 0.0019
    L = 0.021
    # two bars across the strap and two side bars
    for s in (-1, 1):
        acc.box(c + e_t * (s * (L / 2 - bw / 2)), e_t, e_y, e_n, bw / 2, hw, 0.0011, 'buckle', bevel=0.00045)
        acc.box(c + e_y * (s * (hw - bw / 2)), e_t, e_y, e_n, L / 2, bw / 2, 0.0011, 'buckle', bevel=0.00045)
    # the centre bar and the prong
    acc.box(c, e_t, e_y, e_n, 0.0009, hw, 0.001, 'buckle', bevel=0.0003)
    acc.box(c + e_t * 0.0055 + e_n * 0.0006, e_t, e_y, e_n, 0.0055, 0.0007, 0.0006, 'buckle', bevel=0.00025)
    # the strap's tail through the buckle, lying on top (a pointed end), and a keeper loop
    tail = []
    for k in range(10):
        a = k / 9
        tail.append(cyl(th + 0.12 + a * 0.36, yc, rs + 0.0021 + 0.0004 * math.sin(a * math.pi)))
    tw = (width - 0.002) / 2
    acc.sweep(tail, Section([(0.0009, -tw), (0.0009, tw), (-0.0009, tw), (-0.0009, -tw)], lambda t: (1.0, 1.0 if t < 0.85 else max(0.15, 1 - (t - 0.85) * 5.5))), 'strap', up0=radial(th + 0.12))
    kc = cyl(th + 0.33, yc, rs + 0.0026)
    acc.box(kc, tangential(th + 0.33), e_y, radial(th + 0.33), 0.0022, hw - 0.0012, 0.0013, 'strap', bevel=0.0006)


def _crest(acc, th, yc, R):
    """the dragon crest: an oval brass boss with a rim, on the top plate (the 龍 relief is baked into the maps)"""
    ru, ry = 0.0165, 0.0205
    rings = [(0.0, 0.0028), (0.62, 0.0028), (0.72, 0.0026), (0.78, 0.0034), (0.86, 0.0036), (0.93, 0.0031), (0.975, 0.0012), (1.0, 0.0)]
    sides = 40
    rows = []
    for (f, h) in rings:
        row = []
        for i in range(sides):
            a = TAU * i / sides
            u = math.sin(a) * ru * max(f, 0.004)
            y = yc + math.cos(a) * ry * max(f, 0.004)
            row.append(cyl(th + u / R, y, R + h))
        rows.append(row)
    acc.grid(rows, 'crest', closed_u=True)


def _drum(acc, th, yc, R):
    """the line drum on the flank: a toothed ratchet ring, the housing, a bolted cap, a hex nut, a crank"""
    n, t, b = radial(th), tangential(th), V(0, 1, 0)
    o = cyl(th, yc, R - 0.0004)
    # the mounting disc
    acc.lathe([(0.0, 0.0), (0.0205, 0.0), (0.0212, 0.0008), (0.0212, 0.0016), (0.0196, 0.0022), (0.0, 0.0022)], 'drum', sides=48, axis_frame=(o, n, t, b))
    # ratchet teeth round the housing's foot
    teeth = 24
    for k in range(teeth):
        a = TAU * k / teeth
        d0 = b * math.cos(a) + t * math.sin(a)
        d1 = b * math.cos(a + TAU / teeth * 0.55) + t * math.sin(a + TAU / teeth * 0.55)
        acc.box(o + n * 0.0038 + d0 * 0.0182 + (d1 - d0) * 0.0, d0.cross(n).normalized(), d0, n, 0.0014, 0.0016, 0.0014, 'drum', bevel=0.0003)
    # the housing drum
    prof = [(0.0, 0.0018), (0.0172, 0.0018), (0.0172, 0.0078), (0.0166, 0.0086), (0.0158, 0.0092), (0.0152, 0.0092),
            (0.0148, 0.0098), (0.0118, 0.0102), (0.0112, 0.0112), (0.0, 0.0112)]
    acc.lathe(prof, 'drum', sides=48, axis_frame=(o, n, t, b))
    # a groove band of line wound on the drum (a dark coil, seen through a window)
    acc.lathe([(0.0174, 0.0036), (0.0178, 0.0039), (0.0178, 0.0061), (0.0174, 0.0064)], 'line', sides=48, axis_frame=(o, n, t, b))
    # cap bolts + the centre hex nut
    for k in range(6):
        a = TAU * k / 6
        c = o + n * 0.0098 + (b * math.cos(a) + t * math.sin(a)) * 0.0133
        acc.cylinder(c, c + n * 0.0014, 0.0013, 'bolt', sides=6, bevel=0.0002)
    acc.cylinder(o + n * 0.0108, o + n * 0.0132, 0.0045, 'bolt', sides=6, bevel=0.0004)
    acc.cylinder(o + n * 0.0132, o + n * 0.0142, 0.0022, 'bolt', sides=12, bevel=0.0003)
    # the crank lever folded along the arm
    acc.box(o + n * 0.0146 + b * -0.0075, t, b, n, 0.0016, 0.0085, 0.0008, 'buckle', bevel=0.0004)
    acc.cylinder(o + n * 0.0146 + b * -0.0155, o + n * 0.0196 + b * -0.0155, 0.0019, 'buckle', sides=10, bevel=0.0004)


# ─────────────────────────── the claw ───────────────────────────
# (φ round the axis, ρ scale of the arc, length scale): graded so the three read as nested crescents from the eye
TALONS = ((math.radians(-24), 1.1, 1.1), (math.radians(2), 1.0, 1.0), (math.radians(28), 0.86, 0.87))
CROWN_R = 0.047


def talon_curve(k=1.0, rs=1.0):
    """(ρ, y) points of the blade's spine from the knuckle to the tip"""
    P = [(0.066, 0.034), (0.0745, 0.049), (0.0842, 0.0705), (0.091, 0.0955), (0.0932, 0.1215), (0.0902, 0.1465),
         (0.0815, 0.1672), (0.0688, 0.1815), (0.0556, 0.1885), (0.0448, 0.1905)]
    return [(0.066 + (p[0] - 0.066) * rs, p[1] * k) for p in P]


def _smooth_curve(P, n):
    """Catmull-Rom through P, n samples"""
    out = []
    m = len(P)
    for i in range(n):
        u = i / (n - 1) * (m - 1)
        k = min(int(u), m - 2)
        f = u - k
        p0, p1, p2, p3 = P[max(0, k - 1)], P[k], P[k + 1], P[min(m - 1, k + 2)]
        f2, f3 = f * f, f * f * f
        out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * f3) for j in range(2)))
    return out


# the blade section, counter-clockwise in (N = the convex / spine side, B = the side): a rounded spine, a fuller
# groove on each flat, a keen inner edge
BLADE_SEC = [(1.0, 0.0), (0.9, 0.42), (0.66, 0.8), (0.42, 0.93), (0.3, 0.78), (0.16, 0.93), (-0.2, 0.72),
             (-0.6, 0.36), (-0.88, 0.1), (-1.0, 0.0), (-0.88, -0.1), (-0.6, -0.36), (-0.2, -0.72), (0.16, -0.93),
             (0.3, -0.78), (0.42, -0.93), (0.66, -0.8), (0.9, -0.42)]


def build_claw(acc):
    # the hub: seated in the bore, a domed grapple nose
    prof = [(0.0, -0.028), (0.0188, -0.028), (0.0188, -0.006), (0.0196, -0.0045), (0.0202, 0.002), (0.0194, 0.0062),
            (0.0172, 0.0094), (0.0138, 0.0118), (0.0098, 0.0132), (0.0062, 0.0142), (0.0046, 0.0156), (0.0022, 0.0198),
            (0.0, 0.0212)]
    acc.lathe(prof, 'hub', sides=48)
    # the crown: a flanged ring round the hub that carries the three clevises (it flies with the claw)
    crown = [(0.0196, 0.0012), (0.0425, 0.0012), (0.0462, 0.0022), (0.0482, 0.0042), (0.0482, 0.0072),
             (0.0462, 0.0094), (0.0405, 0.0106), (0.0262, 0.0108), (0.0198, 0.0098)]
    acc.lathe(crown, 'crown', sides=64)
    for k in range(3):
        a = TALONS[k][0] + math.radians(180)
        c = cyl(a, 0.0058, 0.0452)
        acc.dome(c, radial(a), 0.0026, 'rivet', h=0.0015)
    for idx, (phi, rs, k) in enumerate(TALONS):
        e_r, e_s, e_y = radial(phi), tangential(phi), V(0, 1, 0)

        def P(rho, y):
            return e_r * rho + e_y * y
        # the clevis on the crown: two cheek plates astride the arm, a pin through
        for s in (-1, 1):
            acc.box(P(CROWN_R + 0.0005, 0.0125) + e_s * (s * 0.0058), e_y, e_r, e_s, 0.0068, 0.0062, 0.0014, 'clevis', bevel=0.0006)
        j1 = P(CROWN_R + 0.002, 0.0135)
        acc.cylinder(j1 - e_s * 0.0081, j1 + e_s * 0.0081, 0.0024, 'pin', sides=12, bevel=0.0004)
        # the arm: knuckle 1 → knuckle 2 (a bevelled bar)
        a1 = P(0.066, 0.034 * k)
        d = (a1 - j1).normalized()
        n_arm = e_r - d * e_r.dot(d)
        acc.sweep([j1 - d * 0.004, j1 + d * 0.008, a1 - d * 0.007, a1], Section(round_rect(0.0052, 0.0043, 0.0015, 2)), 'arm', up0=n_arm.normalized())
        # knuckle 2: a barrel across, pin caps
        acc.cylinder(a1 - e_s * 0.0074, a1 + e_s * 0.0074, 0.0074, 'knuckle', sides=18, bevel=0.0009)
        acc.cylinder(a1 - e_s * 0.0093, a1 + e_s * 0.0093, 0.0031, 'pin', sides=10, bevel=0.0004)
        # the blade: the spine curve, the lens section tapering to a hooked point
        curve = _smooth_curve(talon_curve(k, rs), 48)
        path = [P(r, y) for (r, y) in curve]
        T0 = (path[1] - path[0]).normalized()
        conv = (e_r * 0.83 - e_y * 0.55)
        up0 = (conv - T0 * conv.dot(T0)).normalized()

        def scale(t):
            h = 0.0126 * (1 - t) ** 0.8 + 0.0005
            w = 0.0071 * (1 - t) ** 0.9 + 0.0003
            if t < 0.05:
                h *= 0.88 + 2.4 * t
            return (h, w)
        acc.sweep(path, Section(BLADE_SEC, scale), 'blade', up0=up0)
        # a ferrule collar round the blade's root
        fr0, fr1 = path[1], path[4]
        acc.sweep([fr0, (fr0 + fr1) * 0.5, fr1], Section(circle(16, 1.0), lambda t: (0.0134, 0.0086)), 'ferrule', up0=up0)
        # a small back spur off knuckle 2 (a raptor's hallux), for the silhouette
        sp = [a1 - e_r * 0.002 - e_y * 0.002, a1 - e_y * 0.011 + e_r * 0.006, a1 - e_y * 0.018 + e_r * 0.014]
        acc.sweep(sp, Section(circle(8, 1.0), lambda t: (0.0034 * (1 - t) + 0.0003, 0.0027 * (1 - t) + 0.0003)), 'blade', up0=e_s)
