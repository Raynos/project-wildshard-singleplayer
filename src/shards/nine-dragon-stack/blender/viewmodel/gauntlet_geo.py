"""gauntlet_geo.py — geometry helpers for gauntlet.py (lab P8 "viewmodel", E169).

Everything is authored in the GAUNTLET-local glTF frame (metres, +y from the elbow toward the hand, +z the back of the
forearm, +x the thumb side the eye sees) and converted to Blender (x, -z, y) only when a mesh is made, so the glTF
exporter's Y-up conversion lands it back in the lab's frame exactly.

An `Acc` accumulates vertices + faces for ONE Blender object; every face carries a TAG (a part name: 'wrap', 'band',
'talon_blade' …). The tag decides the bake material (so the maps script knows which pattern a texel gets) and, at
export, the shading class (the material name the lab reads).

Winding rules (outward normals):
- grids: rows along the part's "length" (v), columns around / across (u); u × v must point outward — for a surface of
  revolution u = θ increasing (θ from +z toward +x) and v = y increasing is outward. Pass flip=True otherwise.
- sweeps: the section is given counter-clockwise in the frame's (N, B) plane, B = T × N — outward for any path.
- lathe profiles run from the back-inner edge, outward, forward, inward (see `lathe`).
"""
import math

import bmesh
from mathutils import Matrix, Vector

TAU = math.tau


def V(x, y, z):
    return Vector((x, y, z))


def cyl(th, y, r):
    """a point on a cylinder about +y (glTF): θ = 0 at +z, θ = 90° at +x"""
    return V(r * math.sin(th), y, r * math.cos(th))


def radial(th):
    return V(math.sin(th), 0.0, math.cos(th))


def tangential(th):
    """d/dθ of radial: the direction of increasing θ"""
    return V(math.cos(th), 0.0, -math.sin(th))


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def to_blender(p):
    return (p.x, -p.z, p.y)


class Acc:
    """vertices (glTF frame) + faces with a tag each; `build` makes the Blender object"""

    def __init__(self, name):
        self.name = name
        self.v = []
        self.f = []
        self.tags = []
        self.uv = []  # per face: one (u, v) per corner, in metres (packed later)

    # ── primitives ──
    def grid(self, rows, tag, closed_u=False, flip=False, split=None):
        """rows: a list (v) of lists (u) of points. `tag` is a string or fn(i, j) → string.
        UVs are metric: u = arc length along each row, v = arc length along each column; with `split`, v restarts
        every `split` rows (long strips become several islands the packer can fit)."""
        nv, nu = len(rows), len(rows[0])
        base = len(self.v)
        for row in rows:
            assert len(row) == nu
            self.v.extend(row)
        ncol = nu + 1 if closed_u else nu
        U = []
        for j in range(nv):
            acc_u = [0.0]
            for i in range(ncol - 1):
                acc_u.append(acc_u[-1] + (rows[j][(i + 1) % nu] - rows[j][i]).length)
            U.append(acc_u)
        Vv = [[0.0] * ncol]
        for j in range(1, nv):
            Vv.append([Vv[j - 1][i] + (rows[j][i % nu] - rows[j - 1][i % nu]).length for i in range(ncol)])
        uu = nu if closed_u else nu - 1
        for j in range(nv - 1):
            j0 = (j // split) * split if split else 0
            for i in range(uu):
                i1 = (i + 1) % nu
                a, b = base + j * nu + i, base + j * nu + i1
                c, d = base + (j + 1) * nu + i1, base + (j + 1) * nu + i
                ua = (U[j][i], Vv[j][i] - Vv[j0][i])
                ub = (U[j][i + 1], Vv[j][i + 1] - Vv[j0][i + 1])
                uc = (U[j + 1][i + 1], Vv[j + 1][i + 1] - Vv[j0][i + 1])
                ud = (U[j + 1][i], Vv[j + 1][i] - Vv[j0][i])
                if flip:
                    self.f.append((a, d, c, b))
                    self.uv.append((ua, ud, uc, ub))
                else:
                    self.f.append((a, b, c, d))
                    self.uv.append((ua, ub, uc, ud))
                self.tags.append(tag(i, j) if callable(tag) else tag)
        return base

    def fan(self, center, ring, tag, flip=False):
        """close a ring (a list of vertex indices) with a fan to `center` (planar UVs)"""
        c = len(self.v)
        self.v.append(center)
        n = len(ring)
        p0 = self.v[ring[0]] - center
        nrm = (self.v[ring[0]] - center).cross(self.v[ring[n // 4 if n >= 4 else 1]] - center)
        e0 = p0.normalized() if p0.length > 1e-9 else V(1, 0, 0)
        e1 = nrm.normalized().cross(e0) if nrm.length > 1e-12 else V(0, 1, 0)

        def uvp(p):
            q = p - center
            return (q.dot(e0), q.dot(e1))
        for k in range(n):
            a, b = ring[k], ring[(k + 1) % n]
            if flip:
                self.f.append((c, b, a))
                self.uv.append(((0.0, 0.0), uvp(self.v[b]), uvp(self.v[a])))
            else:
                self.f.append((c, a, b))
                self.uv.append(((0.0, 0.0), uvp(self.v[a]), uvp(self.v[b])))
            self.tags.append(tag)

    def lathe(self, profile, tag, sides=72, th0=0.0, th1=TAU, center=None, axis_frame=None):
        """surface of revolution about +y (or about `axis_frame` = (origin, e_axis, e_zero, e_ninety)).
        profile = [(r, y), …] from the back-inner edge, outward, forward, inward. tag: str or fn(profile segment j)"""
        closed = abs((th1 - th0) - TAU) < 1e-6
        n = sides if closed else sides + 1
        rows = []
        for (r, y) in profile:
            row = []
            for i in range(n):
                th = th0 + (th1 - th0) * i / sides
                if axis_frame is None:
                    row.append(cyl(th, y, r))
                else:
                    o, ea, e0, e90 = axis_frame
                    row.append(o + ea * y + (e0 * math.cos(th) + e90 * math.sin(th)) * r)
            rows.append(row)
        return self.grid(rows, (lambda i, j: tag(j)) if callable(tag) else tag, closed_u=closed)

    def sweep(self, path, section, tag, up0=None, caps=(True, True), closed_path=False, split=None):
        """a tube along `path` (glTF points). section(t, k) → (sn, sb) for k in range(ns) (ns = section.n) given
        counter-clockwise in (N, B). Returns the ring start indices."""
        frames = transport(path, up0, closed_path)
        m = len(path)
        lens = [0.0]
        for i in range(1, m):
            lens.append(lens[-1] + (path[i] - path[i - 1]).length)
        total = max(lens[-1], 1e-9)
        ns = section.n
        rows = []
        for i, (p, T, N, B) in enumerate(frames):
            t = lens[i] / total
            row = []
            for k in range(ns):
                sn, sb = section(t, k)
                row.append(p + N * sn + B * sb)
            rows.append(row)
        if closed_path:
            rows.append([q.copy() for q in rows[0]])
        base = self.grid(rows, tag, closed_u=True, split=split)
        if caps[0] and not closed_path:
            self.fan(path[0].copy(), [base + k for k in range(ns)], tag, flip=True)
        if caps[1] and not closed_path:
            self.fan(path[-1].copy(), [base + (m - 1) * ns + k for k in range(ns)], tag)
        return frames

    def box(self, center, ex, ey, ez, hx, hy, hz, tag, bevel=0.0006, segs=1):
        """a chamfered box: half sizes along the orthonormal axes ex, ey, ez"""
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=2.0)
        for v in bm.verts:
            v.co = Vector((v.co.x * hx, v.co.y * hy, v.co.z * hz))
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, 0.45 * min(hx, hy, hz)), segments=segs,
                            profile=0.5, affect='EDGES', clamp_overlap=True)
        self.add_bm(bm, lambda co: center + ex * co.x + ey * co.y + ez * co.z, tag)
        bm.free()

    def cylinder(self, a, b, r, tag, sides=16, up=None, bevel=0.0):
        """a closed cylinder from a to b (optionally chamfered ends)"""
        d = (b - a)
        L = d.length
        ax = d.normalized()
        if bevel > 0 and L > 2 * bevel:
            prof = [(0.0, 0.0), (r - bevel, 0.0), (r, bevel), (r, L - bevel), (r - bevel, L), (0.0, L)]
        else:
            prof = [(0.0, 0.0), (r, 0.0), (r, L), (0.0, L)]
        e0, e90 = perp_basis(ax, up)
        rows = []
        for (rr, yy) in prof:
            rows.append([a + ax * yy + (e0 * math.cos(TAU * i / sides) + e90 * math.sin(TAU * i / sides)) * rr for i in range(sides)])
        # (e0, e90, ax) right-handed → u = angle increasing, v = along ax is outward
        self.grid(rows, tag, closed_u=True)

    def dome(self, center, n, r, tag, h=None, sides=10, rings=4):
        """a rivet: a spherical cap of radius r and height h on the plane through `center` with normal n"""
        h = r * 0.6 if h is None else h
        e0, e90 = perp_basis(n, None)
        rows = []
        for j in range(rings + 1):
            a = (j / rings) * (math.pi / 2)
            rr, hh = r * math.cos(a), h * math.sin(a)
            if j == rings:
                rr = r * 0.02
            rows.append([center + n * hh + (e0 * math.cos(TAU * i / sides) + e90 * math.sin(TAU * i / sides)) * rr for i in range(sides)])
        base = self.grid(rows, tag, closed_u=True)
        self.fan(center + n * h, [base + rings * sides + k for k in range(sides)], tag)

    def add_bm(self, bm, xf, tag):
        """a bmesh in LOCAL metric coordinates → xf → here; UVs box-projected per dominant local axis"""
        base = len(self.v)
        bm.verts.index_update()
        for v in bm.verts:
            self.v.append(xf(v.co))
        bm.normal_update()
        for f in bm.faces:
            n = f.normal
            k = max(range(3), key=lambda a: abs(n[a]))
            a1, a2 = [a for a in range(3) if a != k]
            sgn = 1.0 if n[k] >= 0 else -1.0
            self.f.append(tuple(base + v.index for v in f.verts))
            # an offset per axis-side keeps the six projections apart before packing
            off = (k * 2 + (0 if sgn > 0 else 1)) * 10.0
            self.uv.append(tuple((v.co[a1] * sgn + off, v.co[a2]) for v in f.verts))
            self.tags.append(tag)

    def extend(self, other):
        base = len(self.v)
        self.v.extend(other.v)
        self.f.extend(tuple(base + i for i in f) for f in other.f)
        self.tags.extend(other.tags)
        self.uv.extend(other.uv)


def perp_basis(n, up):
    n = n.normalized()
    ref = up if up is not None else (V(0, 1, 0) if abs(n.y) < 0.9 else V(1, 0, 0))
    e0 = (ref - n * ref.dot(n)).normalized()
    e90 = n.cross(e0)
    return e0, e90


def transport(path, up0=None, closed=False):
    """parallel-transport frames (p, T, N, B) along a polyline; B = T × N"""
    m = len(path)
    Ts = []
    for i in range(m):
        if closed:
            a, b = path[(i - 1) % m], path[(i + 1) % m]
        else:
            a, b = path[max(0, i - 1)], path[min(m - 1, i + 1)]
        Ts.append((b - a).normalized())
    T0 = Ts[0]
    ref = up0 if up0 is not None else (V(0, 1, 0) if abs(T0.y) < 0.9 else V(1, 0, 0))
    N = (ref - T0 * ref.dot(T0)).normalized()
    out = []
    for i in range(m):
        T = Ts[i]
        if i > 0:
            Tp = Ts[i - 1]
            ax = Tp.cross(T)
            s = ax.length
            if s > 1e-9:
                ang = math.atan2(s, Tp.dot(T))
                N = (Matrix.Rotation(ang, 3, ax.normalized()) @ N)
            N = (N - T * N.dot(T)).normalized()
        B = T.cross(N)
        out.append((path[i], T, N, B))
    return out


class Section:
    """a closed section: pts(t) → list of (sn, sb) counter-clockwise; scaled per t"""

    def __init__(self, pts, scale=None):
        self.pts = pts
        self.n = len(pts)
        self.scale = scale or (lambda t: (1.0, 1.0))

    def __call__(self, t, k):
        sn, sb = self.pts[k]
        a, b = self.scale(t)
        return sn * a, sb * b


def circle(n, r=1.0):
    return [(r * math.cos(TAU * k / n), r * math.sin(TAU * k / n)) for k in range(n)]


def round_rect(hn, hb, c, per_corner=2):
    """a rounded rectangle, half sizes hn × hb, corner radius c, counter-clockwise from +N"""
    pts = []
    corners = [(hn - c, hb - c, 0.0), (-hn + c, hb - c, math.pi / 2), (-hn + c, -hb + c, math.pi), (hn - c, -hb + c, 1.5 * math.pi)]
    for (cn, cb, a0) in corners:
        for k in range(per_corner + 1):
            a = a0 + (math.pi / 2) * k / per_corner
            pts.append((cn + c * math.cos(a), cb + c * math.sin(a)))
    return pts
