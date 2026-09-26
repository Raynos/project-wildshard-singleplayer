# hand_parts.py — lab P8 "viewmodel" (E169): the pieces of the first-person hands as numpy geometry (no bpy).
#
# A part is a dict: name, mat (the lab's shading class = the glTF material name), hv / hf (the HIGH mesh: verts in the
# hand frame, faces), hB (per-high-vertex albedo detail, 0.5 neutral), and either lv / lf (a hand-made game mesh,
# parametric parts) or tris (the triangle budget the high is decimated to). hand.py bakes and exports them.
import math
import numpy as np
import hand_lib as L
from hand_model import Hand

# ───────────────────────────── the glove body (SDF) ─────────────────────────────


def sdf_mesh(fn, lo, hi, h, log, label):
    vol, origin, hh = L.eval_grid(fn, lo, hi, h)
    verts, quads = L.mesh_volume(vol, origin, hh)
    log(f'{label}: grid {vol.shape} → {len(verts)} verts, {len(quads)} quads')
    return verts, quads


def orient_out(verts, faces, sdf_fn):
    """face winding pointing out of the solid (probe the SDF a little along the face normals)"""
    f = np.asarray(faces)
    a, b, c = verts[f[:, 0]], verts[f[:, 1]], verts[f[:, 2]]
    n = np.cross(b - a, c - a)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    cen = (a + b + c) / 3
    s = sdf_fn(cen + n * 0.0003) - sdf_fn(cen - n * 0.0003)
    if np.median(s) < 0:
        return f[:, ::-1].copy()
    return f


def detail_B(hand, v):
    """the glove leather: two octaves of grain, darker seam grooves, light stitches 1.2 mm beside each seam"""
    B = 0.5 + (L.hash3(v, 900.0) - 0.5) * 0.06 + (L.hash3(v, 2600.0) - 0.5) * 0.05
    for line in hand.seam_lines():
        lo = line.min(axis=0) - 0.004
        hi = line.max(axis=0) + 0.004
        m = np.all((v >= lo) & (v <= hi), axis=1)
        if not m.any():
            continue
        d, s, _ = L.seg_dist(v[m], line)
        seam = np.exp(-(d / 0.0005) ** 2)
        dash = (np.mod(s / 0.0028, 1.0) < 0.62).astype(np.float64)
        stitch = np.exp(-((d - 0.0012) / 0.00045) ** 2) * dash
        B[m] = B[m] - 0.22 * seam + 0.38 * stitch
    return np.clip(B, 0, 1)


def strip_B(hand, v):
    """the knuckle strip: grain + a stitch row 1.3 mm in from both long borders"""
    B = 0.5 + (L.hash3(v, 1100.0) - 0.5) * 0.07
    mid = hand.k_line.mean(axis=0)
    n_out = L.norm(L.v3(mid[0], 0, mid[2]))
    t_across = L.norm(np.cross(L.v3(0, 1, 0), n_out))
    x = (v - mid) @ t_across
    for edge in (-0.0052, 0.0052):
        near = np.exp(-((x - edge) / 0.00045) ** 2)
        dash = (np.mod(v[:, 1] / 0.0026, 1.0) < 0.6).astype(np.float64)
        B += 0.36 * near * dash
    return np.clip(B, 0, 1)


def dome(c, n, r, hgt, seg=20, rings=None):
    """a flattened stud dome at c, axis n; its base sits 1 mm under c"""
    n = L.norm(n)
    u = L.norm(np.cross(n, L.v3(0.3, 1.0, 0.2)))
    w = np.cross(n, u)
    rings = rings or seg // 2
    verts = []
    for i in range(rings + 1):
        th = (i / rings) * (math.pi / 2)
        for j in range(seg):
            a = 2 * math.pi * j / seg
            z = hgt * math.cos(th) - 0.001
            verts.append(c + n * z + (math.cos(a) * u + math.sin(a) * w) * (r * math.sin(th)))
    verts = np.array(verts)
    faces = []
    for i in range(rings):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            faces.append([a, a + seg, b + seg, b])
    base = rings * seg
    cidx = len(verts)
    verts = np.vstack([verts, (c - n * 0.001)[None, :]])
    for j in range(seg):
        faces.append([cidx, base + (j + 1) % seg, base + j])
    return verts, faces


def glove_parts(hand, voxel, log, lo, hi, body_tris, cuff=None):
    """the glove body + knuckle strip + studs (+ the cuff dressing) as parts"""
    body_fn = lambda p: hand.body_sdf(p)  # noqa: E731
    vb, qb = sdf_mesh(body_fn, lo, hi, voxel, log, 'glove body')
    qb = orient_out(vb, qb, body_fn)
    body_plain = lambda p: hand.body_sdf(p, details=False)  # noqa: E731
    slo = hand.k_line.min(axis=0) - 0.03
    shi = hand.k_line.max(axis=0) + 0.03
    strip_fn = lambda p: hand.strip_sdf(p, body_plain(p))  # noqa: E731
    vs, qs = sdf_mesh(strip_fn, slo, shi, voxel * 0.8, log, 'knuckle strip')
    qs = orient_out(vs, qs, strip_fn)
    parts = [
        dict(name='glove_body', mat='glove', hv=vb, hf=qb, hB=detail_B(hand, vb), tris=body_tris),
        dict(name='knuckle_strip', mat='leather', hv=vs, hf=qs, hB=strip_B(hand, vs), tris=1600),
    ]
    for i, (c, n) in enumerate(hand.stud_points()):
        hv, hf = dome(c, n, 0.0029, 0.0019, 32, 12)
        lv, lf = dome(c, n, 0.0029, 0.0019, 12, 4)
        parts.append(dict(name=f'stud{i}', mat='brass', hv=hv, hf=hf, hB=np.full(len(hv), 0.55), lv=lv, lf=lf))
    parts += cuff_parts(hand, **(cuff or {}))
    return parts


# ───────────────────────────── the glove cuff ─────────────────────────────

def cuff_frame(hand):
    a = hand.fore
    w = L.norm(L.v3(0, 1, 0) - a * a[1])
    if np.cross(a, w)[0] < 0:
        w = -w  # keep (w, t, a) right-handed so the tubes wind outward, and t = the dorsal side (+X)
    t = L.norm(np.cross(a, w))
    return a, w, t


class Cuff:
    """a flared leather gauntlet cuff along the forearm from the wrist: s = metres along the forearm from W"""

    def __init__(self, s0=-0.012, end=0.072, trim=0.014, w0=0.0305, t0=0.0228, dw=0.0095, dt=0.0125, strap=(0.021, 0.033)):
        self.s0, self.end, self.trim0 = s0, end, end - trim
        self.w0, self.t0, self.dw, self.dt = w0, t0, dw, dt
        self.strap = strap

    def radii(self, s):
        u = min(1.0, max(0.0, (s - self.s0) / (self.end + 0.012 - self.s0)))
        fl = u ** 1.35
        return self.w0 + self.dw * fl, self.t0 + self.dt * fl


def cuff_parts(hand, eye_h=None, **kw):
    C = Cuff(**kw)
    a, w, t = cuff_frame(hand)
    W = hand.W
    parts = []
    center = lambda s: W + a * s  # noqa: E731
    fw = lambda s: w  # noqa: E731
    ft = lambda s: t  # noqa: E731
    wob = lambda s, ang: 0.0006 * math.sin(3 * ang + 1.3) * min(1.0, max(0.0, (s - C.s0) / 0.08))  # noqa: E731
    rw = lambda s, ang: C.radii(s)[0]  # noqa: E731
    rt = lambda s, ang: C.radii(s)[1]  # noqa: E731

    def leather_B(v, scale=1000.0):
        return np.clip(0.5 + (L.hash3(v, scale) - 0.5) * 0.06, 0, 1)

    def dash_rows(v, rows, pitch=0.0028):
        s_of = (v - W) @ a
        ang = np.arctan2((v - W) @ t, (v - W) @ w)
        out = np.zeros(len(v))
        for e in rows:
            out += np.exp(-((s_of - e) / 0.0005) ** 2) * (np.mod(ang * 0.04 / pitch, 1.0) < 0.6)
        return out

    def pair(fn, n_hi, n_lo):
        hv, hf = fn(n_hi, True)
        lv, lf = fn(n_lo, False)
        return hv, hf, lv, lf

    # the cuff shell
    def shell(n_ar, hi):
        s_vals = np.linspace(C.s0, C.trim0 + 0.0005, 40 if hi else 12)
        return L.tube(center, fw, ft, rw, rt, s_vals, n_ar, offset=wob)
    hv, hf, lv, lf = pair(shell, 128, 40)
    B = leather_B(hv)
    # a stitched seam down the palm side of the cuff (−t) with its groove darkened
    ang = np.arctan2((hv - W) @ t, (hv - W) @ w)
    dseam = np.abs(np.angle(np.exp(1j * (ang + np.pi / 2)))) * 0.03
    s_of = (hv - W) @ a
    B = B - 0.12 * np.exp(-(dseam / 0.0006) ** 2) + 0.3 * np.exp(-((dseam - 0.0013) / 0.0004) ** 2) * (np.mod(s_of / 0.0028, 1) < 0.6)
    parts.append(dict(name='cuff', mat='glove', hv=hv, hf=hf, hB=np.clip(B, 0, 1), lv=lv, lf=lf))

    # the red trim over the last 14 mm (+0.6 mm proud) with the rolled lip and a short lining inside
    def trim(n_ar, hi):
        s_vals = np.linspace(C.trim0 - 0.0004, C.end, 16 if hi else 4)
        v, f = L.tube(center, fw, ft, lambda s, g: C.radii(s)[0] + 0.0006, lambda s, g: C.radii(s)[1] + 0.0006, s_vals, n_ar, offset=wob)
        v2, f2 = lip(center, w, t, C, n_ar, 7 if hi else 3)
        base = len(v)
        return np.vstack([v, v2]), f + [[i + base for i in q] for q in f2]
    hv, hf, lv, lf = pair(trim, 128, 40)
    B = np.clip(leather_B(hv, 1400.0) + 0.35 * dash_rows(hv, [C.trim0 + 0.0022]), 0, 1)
    parts.append(dict(name='trim', mat='trim_red', hv=hv, hf=hf, hB=B, lv=lv, lf=lf))

    # gold piping cord at the edge
    def piping(n_ar, hi):
        ring = []
        for j in range(n_ar):
            g = 2 * math.pi * j / n_ar
            r_w, r_t = C.radii(C.end)
            ring.append(center(C.end - 0.0004) + (math.cos(g) * w * (r_w + 0.0012) + math.sin(g) * t * (r_t + 0.0012)))
        return L.sweep_circle(np.array(ring), 0.0014, 10 if hi else 5, closed=True)
    hv, hf, lv, lf = pair(piping, 128, 40)
    # a twisted cord: light / dark bands spiralling round the piping
    twist = 0.5 + 0.22 * np.sin(np.arange(len(hv)) % 10 / 10 * 2 * np.pi + (np.arange(len(hv)) // 10) * 1.1)
    parts.append(dict(name='piping', mat='gold_thread', hv=hv, hf=hf, hB=twist, lv=lv, lf=lf))

    # the strap (leather, 12 mm wide, 1.8 mm proud) + side walls
    s_a, s_b = C.strap

    def strap(n_ar, hi):
        s_vals = np.linspace(s_a, s_b, 8 if hi else 3)
        v, f = L.tube(center, fw, ft, lambda s, g: C.radii(s)[0] + 0.0018, lambda s, g: C.radii(s)[1] + 0.0018, s_vals, n_ar, offset=wob)
        for s_e, flip in ((s_a, False), (s_b, True)):
            ve, fe = band_wall(center, w, t, C, s_e, n_ar, 0.0018, flip)
            base = len(v)
            v = np.vstack([v, ve])
            f = f + [[i + base for i in q] for q in fe]
        return v, f
    hv, hf, lv, lf = pair(strap, 128, 40)
    B = np.clip(leather_B(hv, 1300.0) + 0.33 * dash_rows(hv, [s_a + 0.0012, s_b - 0.0012], 0.0026), 0, 1)
    parts.append(dict(name='strap', mat='leather', hv=hv, hf=hf, hB=B, lv=lv, lf=lf))

    # the buckle on the eye's side of the strap
    if eye_h is not None:
        g = math.atan2(eye_h @ t, eye_h @ w)
        sc = 0.5 * (s_a + s_b)
        hv, hf = buckle(center(sc), w, t, a, g, C.radii(sc), 10, 12)
        lv, lf = buckle(center(sc), w, t, a, g, C.radii(sc), 6, 6)
        parts.append(dict(name='buckle', mat='brass_dark', hv=hv, hf=hf, hB=np.full(len(hv), 0.55), lv=lv, lf=lf))
    return parts


def lip(center, w, t, C, n_ar, k):
    """the rolled edge at the cuff's open end (2.4 mm thick) and 12 mm of lining inside"""
    verts = []
    r_w0, r_t0 = C.radii(C.end)
    for i in range(k + 1):
        th = math.pi * i / k
        for j in range(n_ar):
            g = 2 * math.pi * j / n_ar
            dr = 0.0006 - 0.0012 * (1 - math.cos(th))
            ds = 0.0012 * math.sin(th)
            verts.append(center(C.end + ds) + math.cos(g) * w * (r_w0 + dr) + math.sin(g) * t * (r_t0 + dr))
    for i in range(1, 4):
        s = C.end - 0.004 * i
        r_w, r_t = C.radii(s)
        for j in range(n_ar):
            g = 2 * math.pi * j / n_ar
            verts.append(center(s) + math.cos(g) * w * (r_w - 0.0018) + math.sin(g) * t * (r_t - 0.0018))
    verts = np.array(verts)
    rows = k + 1 + 3
    faces = []
    for i in range(rows - 1):
        for j in range(n_ar):
            a0 = i * n_ar + j
            b0 = i * n_ar + (j + 1) % n_ar
            faces.append([a0, b0, b0 + n_ar, a0 + n_ar])
    return verts, faces


def band_wall(center, w, t, C, s, n_ar, height, flip):
    verts = []
    r_w, r_t = C.radii(s)
    for hgt in (-0.0004, height):
        for j in range(n_ar):
            g = 2 * math.pi * j / n_ar
            verts.append(center(s) + math.cos(g) * w * (r_w + hgt) + math.sin(g) * t * (r_t + hgt))
    faces = []
    for j in range(n_ar):
        a0, b0 = j, (j + 1) % n_ar
        q = [a0, b0, b0 + n_ar, a0 + n_ar]
        faces.append(q[::-1] if flip else q)
    return np.array(verts), faces


def buckle(c, w, t, a, ang, radii, k, n_ring):
    """a small brass buckle frame (17 × 13.6 mm, 2.2 mm bar) + prong lying on the strap at angle `ang`"""
    rw_, rt_ = radii
    n = L.norm(math.cos(ang) * w / rw_ + math.sin(ang) * t / rt_)
    pos = c + math.cos(ang) * w * (rw_ + 0.0018) + math.sin(ang) * t * (rt_ + 0.0018) + n * 0.0011
    along = L.norm(a)
    side = L.norm(np.cross(n, along))
    hw, hh = 0.0085, 0.0068
    path = []
    corners = [(hw, hh), (-hw, hh), (-hw, -hh), (hw, -hh)]
    for ci in range(4):
        x0, y0 = corners[ci]
        x1, y1 = corners[(ci + 1) % 4]
        for j in range(k):
            u = j / k
            path.append(pos + side * (x0 + (x1 - x0) * u) + along * (y0 + (y1 - y0) * u))
    sm = np.array(path)
    for _ in range(3):
        sm = 0.25 * np.roll(sm, 1, axis=0) + 0.5 * sm + 0.25 * np.roll(sm, -1, axis=0)
    v, f = L.sweep_circle(sm, 0.0011, n_ring // 1 if n_ring < 9 else 8, closed=True)
    pr = np.array([pos - side * hw * 0.9 + n * 0.0003, pos + side * hw * 0.35 + n * 0.0009])
    v2, f2 = L.sweep_circle(pr, 0.00075, 6)
    base = len(v)
    return np.vstack([v, v2]), f + [[i + base for i in q] for q in f2]


# ───────────────────────────── the right sleeve (arm-r, its own frame) ─────────────────────────────
# SLEEVE frame: +y from the elbow (y = −0.36) toward the wrist (y = 0); +z = the dorsal side (the back of the forearm);
# +x = the ulnar side (for the right arm in the jian: x = y × z). Half extents x / z grow from the wrist to the elbow.

SLEEVE_LEN = 0.36


def sleeve_radii(y):
    u = min(1.0, max(0.0, -y / SLEEVE_LEN))
    return 0.0310 + 0.0190 * u ** 0.9, 0.0252 + 0.0198 * u ** 0.9


def sleeve_fold(y, g):
    """radial displacement (m) of the cloth: bunched compression rings where the sleeve leaves the glove cuff, two long
    diagonal folds with a sharp crease each, a slack belly on the underside, slow lumps"""
    off = 0.0
    # compression bunching (y −0.04 … −0.13): uneven rings, each a soft ridge with a tight valley behind it
    for yc, amp, ph in ((-0.047, 0.0044, 0.3), (-0.062, 0.0052, 1.7), (-0.078, 0.0046, 2.9), (-0.095, 0.0036, 4.1), (-0.112, 0.0024, 0.9), (-0.128, 0.0014, 2.2)):
        tilt = 0.004 * math.cos(g + ph) + 0.0035 * math.cos(3 * g + 2 * ph)
        dy = y - (yc + tilt)
        ridge = math.exp(-(dy / 0.0058) ** 2) - 0.35 * math.exp(-((dy + 0.0075) / 0.0024) ** 2)
        off += amp * ridge * (0.6 + 0.4 * math.cos(2 * g + ph) + 0.18 * math.cos(5 * g + ph * 2))
    # two long diagonal folds (a loose sleeve twisting down the forearm) with a crease on one side
    for g0, pitch, amp in ((0.6, 1.8, 0.0046), (3.5, -1.4, 0.0038), (1.9, 0.7, 0.0026)):
        if -0.35 < y < -0.06:
            fade = math.sin(math.pi * (-(y + 0.06)) / 0.29) ** 0.7
            gc = g0 + pitch * (-y)
            dg = math.atan2(math.sin(g - gc), math.cos(g - gc))
            off += amp * fade * math.exp(-(dg / 0.34) ** 2)
            off -= 0.0016 * fade * math.exp(-((dg - 0.46) / 0.1) ** 2)
    # the slack belly under the forearm (−z) near the elbow
    belly = math.exp(-((g + math.pi / 2) / 0.9) ** 2) * max(0.0, min(1.0, (-y - 0.15) / 0.15))
    off += 0.004 * belly
    # slow lumps
    off += 0.0011 * math.sin(3 * g + 9 * y) * math.sin(1.7 * g - 14 * y + 0.5)
    return off


def sleeve_parts():
    parts = []
    Y = lambda y: L.v3(0, y, 0)  # noqa: E731
    fx = lambda y: L.v3(1, 0, 0)  # noqa: E731
    fz = lambda y: L.v3(0, 0, 1)  # noqa: E731
    rw = lambda y, g: sleeve_radii(y)[0]  # noqa: E731
    rt = lambda y, g: sleeve_radii(y)[1]  # noqa: E731

    def body(n_ar, n_len):
        ys = np.linspace(-0.0195, -SLEEVE_LEN, n_len)
        return L.tube(Y, fx, fz, rw, rt, ys, n_ar, offset=sleeve_fold, closed_end=True)
    hv, hf = body(192, 320)
    lv, lf = body(44, 58)
    # B: a fine twill (diagonal ribs 1.1 mm), a stitched seam down the underside (−z), darker fold valleys
    g = np.arctan2(hv[:, 2] / np.maximum(np.array([sleeve_radii(y)[1] for y in hv[:, 1]]), 1e-6), hv[:, 0] / np.maximum(np.array([sleeve_radii(y)[0] for y in hv[:, 1]]), 1e-6))
    arc = g * 0.04
    tw = 0.5 + 0.05 * np.sin((arc + hv[:, 1]) / 0.0011 * 2 * np.pi)
    dseam = np.abs(np.angle(np.exp(1j * (g + np.pi / 2)))) * 0.04
    tw = tw - 0.18 * np.exp(-(dseam / 0.0007) ** 2) + 0.25 * np.exp(-((dseam - 0.0015) / 0.00045) ** 2) * (np.mod(hv[:, 1] / 0.003, 1) < 0.55)
    tw += (L.hash3(hv, 300.0) - 0.5) * 0.06
    parts.append(dict(name='sleeve', mat='sleeve', hv=hv, hf=hf, hB=np.clip(tw, 0, 1), lv=lv, lf=lf))

    # the red trim at the wrist end (y 0 … −0.02), 1.2 mm proud, a rolled edge at y = 0
    def trim(n_ar, n_len):
        ys = np.linspace(0.0, -0.0205, n_len)
        v, f = L.tube(Y, fx, fz, lambda y, gg: sleeve_radii(y)[0] + 0.0012, lambda y, gg: sleeve_radii(y)[1] + 0.0012, ys, n_ar)
        # the edge: roll inward at y = 0
        ring = []
        for j in range(n_ar):
            gg = 2 * math.pi * j / n_ar
            ring.append(L.v3(math.cos(gg) * (sleeve_radii(0)[0] - 0.0004), 0.0, math.sin(gg) * (sleeve_radii(0)[1] - 0.0004)))
        v = np.vstack([v, np.array(ring)])
        base = len(v) - n_ar
        for j in range(n_ar):
            j2 = (j + 1) % n_ar
            f.append([j, base + j, base + j2, j2])
        return v, f
    hv, hf = trim(160, 12)
    lv, lf = trim(48, 3)
    satin = 0.5 + 0.04 * np.sin(hv[:, 1] / 0.0009 * 2 * np.pi) + (L.hash3(hv, 800.0) - 0.5) * 0.04
    parts.append(dict(name='sleeve_trim', mat='trim_red', hv=hv, hf=hf, hB=np.clip(satin, 0, 1), lv=lv, lf=lf))

    # gold piping at both edges of the trim
    for k, yp in enumerate((-0.0006, -0.0205)):
        def pip(n_ar, rs):
            ring = [L.v3(math.cos(2 * math.pi * j / n_ar) * (sleeve_radii(yp)[0] + 0.0014), yp, math.sin(2 * math.pi * j / n_ar) * (sleeve_radii(yp)[1] + 0.0014)) for j in range(n_ar)]
            return L.sweep_circle(np.array(ring), 0.0012, rs, closed=True)
        hv, hf = pip(160, 10)
        lv, lf = pip(48, 5)
        tw = 0.5 + 0.22 * np.sin(np.arange(len(hv)) % 10 / 10 * 2 * np.pi + (np.arange(len(hv)) // 10) * 1.1)
        parts.append(dict(name=f'sleeve_piping{k}', mat='gold_thread', hv=hv, hf=hf, hB=tw, lv=lv, lf=lf))

    # red cords: a criss-cross binding over the forearm (two opposite helices + a wrap ring at each end)
    def surf(y, g, lift):
        r_w, r_t = sleeve_radii(y)
        o = sleeve_fold(y, g) + lift
        n = L.norm(L.v3(math.cos(g) / r_w, 0, math.sin(g) / r_t))
        return L.v3(math.cos(g) * r_w, y, math.sin(g) * r_t) + n * o

    cords = []
    y_a, y_b = -0.085, -0.235
    for sgn, g0 in ((1.0, 0.2), (-1.0, 0.2 + math.pi)):
        path = [surf(y_a + (y_b - y_a) * u, g0 + sgn * u * 2.0 * 2 * math.pi, 0.0026) for u in np.linspace(0, 1, 260)]
        cords.append(np.array(path))
    for yr in (y_a + 0.002, y_b - 0.002):
        for dy in (-0.0028, 0.0028):
            ring = [surf(yr + dy, g, 0.0024) for g in np.linspace(0, 2 * math.pi, 97)[:-1]]
            cords.append((np.array(ring), True))
    for k, c in enumerate(cords):
        closed = isinstance(c, tuple)
        path = c[0] if closed else c
        hv, hf = L.sweep_circle(path, 0.0022, 12, closed=closed)
        lv, lf = L.sweep_circle(path[::4], 0.0022, 5, closed=closed)
        # a twisted silk cord: diagonal strand lines
        idx = np.arange(len(hv))
        ring_i, around = idx // 12, idx % 12
        tw = 0.5 + 0.2 * np.sin(around / 12 * 2 * np.pi * 2 + ring_i * 0.9)
        parts.append(dict(name=f'cord{k}', mat='silk_red', hv=hv, hf=hf, hB=np.clip(tw, 0, 1), lv=lv, lf=lf))
    return parts


# ───────────────────────────── the left fist (fist-l) ─────────────────────────────

def fist_hand():
    """a loose fist: the same hand closed round an empty 7 mm 'grip' (a small tunnel), the forearm straight on"""
    h = Hand(rg=0.0072, grip=False, curl=1.0, mcp_in=0.0105)
    return h
