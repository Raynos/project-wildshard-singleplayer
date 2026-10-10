# hand_lib.py — lab P8 "viewmodel" (E169): numpy signed-distance modelling for the first-person hands.
#
# Everything here is plain numpy (Blender's bundled python has numpy and openvdb; nothing else is needed):
# - SDF primitives on (N, 3) point arrays: round cones (IQ), ellipsoids, capsules, tori, boxes;
# - smooth / hard unions, subtraction, grooves along polylines (seams, wrinkles);
# - `mesh_sdf`: evaluate an SDF on a regular grid in slabs and mesh the zero level set with OpenVDB's volumeToMesh;
# - parametric tubes (cuffs, sleeves, straps, cords, piping) as quad grids;
# - per-vertex curvature (discrete mean curvature, convex > 0) and one-ring smoothing for the bake attributes.
import numpy as np

F = np.float32


def v3(x, y, z):
    return np.array([x, y, z], dtype=np.float64)


def norm(a):
    return a / max(np.linalg.norm(a), 1e-12)


# ───────────────────────────── SDF primitives (p: (N, 3)) ─────────────────────────────

def dot(a, b):
    return np.einsum('ij,ij->i', a, b)


def sd_sphere(p, c, r):
    return np.linalg.norm(p - c, axis=1) - r


def sd_capsule(p, a, b, r):
    pa = p - a
    ba = (b - a)[None, :]
    h = np.clip(dot(pa, np.broadcast_to(ba, pa.shape)) / float(ba @ ba.T), 0.0, 1.0)
    return np.linalg.norm(pa - ba * h[:, None], axis=1) - r


def sd_round_cone(p, a, b, r1, r2):
    """IQ's exact round cone: spheres r1 at a, r2 at b, joined by their tangent cone."""
    ba = b - a
    l2 = float(ba @ ba)
    rr = r1 - r2
    a2 = l2 - rr * rr
    il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba
    z = y - l2
    xv = pa * l2 - np.outer(y, ba)
    x2 = np.einsum('ij,ij->i', xv, xv)
    y2 = y * y * l2
    z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    d_mid = (np.sqrt(np.maximum(x2 * a2 * il2, 0.0)) + y * rr) * il2 - r1
    d_b = np.sqrt(x2 + z2) * il2 - r2
    d_a = np.sqrt(x2 + y2) * il2 - r1
    out = np.where(np.sign(y) * a2 * y2 < k, d_a, d_mid)
    out = np.where(np.sign(z) * a2 * z2 > k, d_b, out)
    return out


def sd_ellipsoid(p, c, R, radii):
    """ellipsoid centred at c, local axes = columns of R, semi-axes radii (IQ's bound-ish approximation)"""
    q = (p - c) @ R
    r = np.asarray(radii, dtype=np.float64)
    k0 = np.linalg.norm(q / r, axis=1)
    k1 = np.linalg.norm(q / (r * r), axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sd_torus(p, c, axis, R, r):
    q = p - c
    ax = norm(axis)
    h = q @ ax
    radial = np.linalg.norm(q - np.outer(h, ax), axis=1)
    return np.sqrt((radial - R) ** 2 + h * h) - r


def sd_round_box(p, c, R, half, rad):
    q = np.abs((p - c) @ R) - (np.asarray(half) - rad)
    return np.linalg.norm(np.maximum(q, 0.0), axis=1) + np.minimum(q.max(axis=1), 0.0) - rad


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def smax(a, b, k):
    return -smin(-a, -b, k)


def seg_dist(p, pts):
    """distance from p to a polyline (pts: (M, 3)), plus the arc length s at the closest point and the total length"""
    best = np.full(len(p), 1e9)
    best_s = np.zeros(len(p))
    acc = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        ba = b - a
        L = float(np.linalg.norm(ba))
        if L < 1e-9:
            continue
        t = np.clip((p - a) @ ba / (L * L), 0.0, 1.0)
        d = np.linalg.norm(p - a - np.outer(t, ba), axis=1)
        m = d < best
        best = np.where(m, d, best)
        best_s = np.where(m, acc + t * L, best_s)
        acc += L
    return best, best_s, acc


def groove(p, pts, width, depth):
    """a seam / wrinkle groove: a smooth dent of `depth` (m) and gaussian `width` along the polyline (add to the SDF)"""
    d, _, _ = seg_dist(p, pts)
    return depth * np.exp(-(d / width) ** 2)


def catmull(points, n):
    """a Catmull-Rom curve through the control points, n samples per span"""
    P = [np.asarray(q, dtype=np.float64) for q in points]
    P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return np.array(out)


# ───────────────────────────── grid → mesh ─────────────────────────────

def eval_grid(sdf, lo, hi, h, slab=24):
    """evaluate sdf((N,3)) on a grid with voxel h over [lo, hi]; returns (vol float32 [i,j,k], origin, shape)"""
    lo = np.asarray(lo, dtype=np.float64)
    hi = np.asarray(hi, dtype=np.float64)
    n = np.ceil((hi - lo) / h).astype(int) + 1
    xs = lo[0] + np.arange(n[0]) * h
    ys = lo[1] + np.arange(n[1]) * h
    zs = lo[2] + np.arange(n[2]) * h
    vol = np.empty((n[0], n[1], n[2]), dtype=F)
    Y, Z = np.meshgrid(ys, zs, indexing='ij')
    for i0 in range(0, n[0], slab):
        i1 = min(n[0], i0 + slab)
        X = xs[i0:i1]
        P = np.empty((len(X), Y.size, 3))
        P[:, :, 0] = X[:, None]
        P[:, :, 1] = Y.reshape(-1)[None, :]
        P[:, :, 2] = Z.reshape(-1)[None, :]
        d = sdf(P.reshape(-1, 3))
        vol[i0:i1] = d.reshape(len(X), n[1], n[2]).astype(F)
    return vol, lo, h


def mesh_volume(vol, origin, h, adaptivity=0.0):
    """zero level set of a sampled SDF → (verts (N,3) world, faces (M,4) quads) via OpenVDB volumeToMesh"""
    import openvdb as vdb
    g = vdb.FloatGrid()
    g.copyFromArray(np.ascontiguousarray(vol))
    g.background = float(np.max(vol))
    pts, quads = g.convertToQuads(0.0)
    if adaptivity > 0:
        pts, tris, quads = g.convertToPolygons(0.0, adaptivity)
    verts = origin[None, :] + np.asarray(pts, dtype=np.float64) * h
    return verts, np.asarray(quads, dtype=np.int64)


def sample_vol(vol, origin, h, p):
    """trilinear sample of the grid at world points p (clamped)"""
    q = (p - origin[None, :]) / h
    n = np.array(vol.shape) - 1
    q = np.clip(q, 0, n - 1e-4)
    i = np.floor(q).astype(int)
    f = q - i
    out = np.zeros(len(p))
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out += w * vol[i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz]
    return out


# ───────────────────────────── parametric tubes ─────────────────────────────

def tube(center, frame_w, frame_t, rw, rt, s_vals, n_around, offset=None, closed_start=False, closed_end=False):
    """
    A tube along a sampled centre line. center(s) → (3,), frame_w(s)/frame_t(s) → unit axes of the cross-section,
    rw(s, a)/rt(s, a) → half extents (a = angle), offset(s, a) → radial displacement (m). Returns verts, quads.
    """
    verts = []
    for s in s_vals:
        c = center(s)
        w = frame_w(s)
        t = frame_t(s)
        for j in range(n_around):
            a = 2 * np.pi * j / n_around
            r_w = rw(s, a)
            r_t = rt(s, a)
            off = 0.0 if offset is None else offset(s, a)
            dirv = np.cos(a) * w * r_w + np.sin(a) * t * r_t
            nrm = norm(np.cos(a) * w / max(r_w, 1e-9) + np.sin(a) * t / max(r_t, 1e-9))
            verts.append(c + dirv + nrm * off)
    verts = np.array(verts)
    quads = []
    m = len(s_vals)
    for i in range(m - 1):
        for j in range(n_around):
            a = i * n_around + j
            b = i * n_around + (j + 1) % n_around
            quads.append((a, b, b + n_around, a + n_around))
    faces = [list(q) for q in quads]
    if closed_start:
        c = len(verts)
        verts = np.vstack([verts, center(s_vals[0])[None, :]])
        for j in range(n_around):
            faces.append([c, (j + 1) % n_around, j])
    if closed_end:
        c = len(verts)
        verts = np.vstack([verts, center(s_vals[-1])[None, :]])
        base = (m - 1) * n_around
        for j in range(n_around):
            faces.append([c, base + j, base + (j + 1) % n_around])
    return verts, faces


def sweep_circle(path, radius, n_around, closed=False):
    """a round tube (cord / piping) along a polyline path (M, 3); radius float or (M,) array; closed = a ring"""
    M = len(path)
    r = np.broadcast_to(np.asarray(radius, dtype=np.float64), (M,))
    tang = []
    for i in range(M):
        if closed:
            a, b = path[(i - 1) % M], path[(i + 1) % M]
        else:
            a, b = path[max(0, i - 1)], path[min(M - 1, i + 1)]
        tang.append(norm(b - a))
    tang = np.array(tang)
    up = np.array([0.0, 0.0, 1.0]) if abs(tang[0][2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    s = norm(np.cross(tang[0], up))
    verts = []
    for i in range(M):
        t = tang[i]
        s = norm(s - t * (s @ t))
        b = np.cross(t, s)
        for j in range(n_around):
            a = 2 * np.pi * j / n_around
            verts.append(path[i] + (np.cos(a) * s + np.sin(a) * b) * r[i])
    faces = []
    rings = M if closed else M - 1
    for i in range(rings):
        i2 = (i + 1) % M
        for j in range(n_around):
            j2 = (j + 1) % n_around
            faces.append([i * n_around + j, i * n_around + j2, i2 * n_around + j2, i2 * n_around + j])
    if not closed:
        c0 = len(verts)
        verts.append(path[0])
        for j in range(n_around):
            faces.append([c0, (j + 1) % n_around, j])
        c1 = len(verts)
        verts.append(path[-1])
        base = (M - 1) * n_around
        for j in range(n_around):
            faces.append([c1, base + j, base + (j + 1) % n_around])
    return np.array(verts), faces


# ───────────────────────────── mesh attributes ─────────────────────────────

def vertex_normals(verts, faces):
    n = np.zeros_like(verts)
    for f in faces:
        k = len(f)
        for i in range(k):
            a, b, c = verts[f[i]], verts[f[(i + 1) % k]], verts[f[(i - 1) % k]]
            n[f[i]] += np.cross(b - a, c - a)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.maximum(ln, 1e-12)


def edges_of(faces):
    e = set()
    for f in faces:
        k = len(f)
        for i in range(k):
            a, b = f[i], f[(i + 1) % k]
            e.add((a, b) if a < b else (b, a))
    return np.array(sorted(e), dtype=np.int64)


def mean_curvature(verts, normals, edges):
    """discrete mean curvature per vertex: mean over the one ring of (n_i − n_j)·(p_i − p_j) / |p_i − p_j|² (1/m; convex > 0)"""
    a, b = edges[:, 0], edges[:, 1]
    dp = verts[a] - verts[b]
    dn = normals[a] - normals[b]
    k = np.einsum('ij,ij->i', dn, dp) / np.maximum(np.einsum('ij,ij->i', dp, dp), 1e-14)
    acc = np.zeros(len(verts))
    cnt = np.zeros(len(verts))
    np.add.at(acc, a, k)
    np.add.at(acc, b, k)
    np.add.at(cnt, a, 1)
    np.add.at(cnt, b, 1)
    return acc / np.maximum(cnt, 1)


def ring_smooth(values, edges, n_iter=2):
    v = values.copy()
    a, b = edges[:, 0], edges[:, 1]
    for _ in range(n_iter):
        acc = v.copy()
        cnt = np.ones(len(v))
        np.add.at(acc, a, v[b])
        np.add.at(acc, b, v[a])
        np.add.at(cnt, a, 1)
        np.add.at(cnt, b, 1)
        v = acc / cnt
    return v


def hash3(p, scale):
    """cheap value noise in [0, 1] at world points (for leather grain / wear)"""
    q = p * scale
    i = np.floor(q)
    f = q - i
    f = f * f * (3 - 2 * f)

    def h(ix, iy, iz):
        s = np.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453
        return s - np.floor(s)
    out = np.zeros(len(p))
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (f[:, 0] if dx else 1 - f[:, 0]) * (f[:, 1] if dy else 1 - f[:, 1]) * (f[:, 2] if dz else 1 - f[:, 2])
                out += w * h(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz)
    return out
