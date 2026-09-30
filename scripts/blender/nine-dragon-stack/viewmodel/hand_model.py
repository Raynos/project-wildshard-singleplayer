# hand_model.py — lab P8 "viewmodel" (E169): the gloved hand as signed distances, in the HAND frame.
#
# HAND frame (metres): +Y = the grip axis toward the thumb / blade, the grip centre line is the Y axis;
# +X = the direction the back of the hand faces; +Z = toward the wrist (in the plane across the grip).
# The fist is the handshake / hammer grip: palm on the grip's +X side, MCP knuckles at the front-right (ψ ≈ 42°),
# proximal phalanges across the front (−Z), middle phalanges down the left (−X), distal phalanges across the back
# (+Z) with the tips pressed against the palm; the thumb wraps across the back above the index finger and rests on
# the index's middle phalanx. A right hand in the jian: HAND → JIAN is a rotation about Y (hand.py, `R_HAND_TO_JIAN`).
#
# ψ is measured in the XZ plane from +X toward −Z: point(ψ, r, y) = (r cos ψ, y, −r sin ψ).
import numpy as np
from hand_lib import (catmull, groove, norm, sd_ellipsoid, sd_round_cone, sd_sphere, seg_dist, smax, smin, v3)

D2R = np.pi / 180.0


def P(psi_deg, r, y):
    a = psi_deg * D2R
    return v3(r * np.cos(a), y, -r * np.sin(a))


def psi_of(p):
    return np.arctan2(-p[2], p[0]) / D2R


def walk(start, lens, radii, rg, sign=1.0, y_drift=0.0, zc=0.0, cb=1.0, p1_dy=0.0):
    """
    Wrap a digit round the grip: each phalanx leaves its joint along the tangent to the curve it may not enter (the
    points of its plane at rg + its radius from the grip axis), toward increasing ψ (sign +1) or decreasing (−1).
    The grip may be tilted in the palm plane (about +X, cos = cb): the plane then cuts it in an ellipse centred at
    z = zc, semi-axes R (x) and R / cb (z). The walk runs in the scaled space z' = cb (z − zc), where it is a circle
    (tangency survives the affine map); the steps are taken at true length. Returns the joint points.
    """
    pts = [start.copy()]
    for i, L in enumerate(lens):
        p = pts[-1]
        r_seg = 0.5 * (radii[i] + radii[i + 1])
        rc = rg + r_seg + 0.0003
        q = v3(p[0], 0.0, cb * (p[2] - zc))
        rho = np.linalg.norm(q)
        ap = psi_of(q)
        if rho > rc + 1e-5:
            at = ap + sign * np.arccos(rc / rho) / D2R
            Ts = P(at, rc, 0.0)
            T = v3(Ts[0], 0.0, zc + Ts[2] / cb)
            d = norm(T - v3(p[0], 0.0, p[2]))
        else:
            a = ap * D2R
            ts = sign * v3(-np.sin(a), 0.0, -np.cos(a))
            d = norm(v3(ts[0], 0.0, ts[2] / cb))
        dy = p1_dy if i == 0 else y_drift
        L_xz = np.sqrt(max(L * L - dy * dy, (0.35 * L) ** 2))
        nxt = v3(p[0], 0.0, p[2]) + d * L_xz
        nxt[1] = p[1] + dy
        pts.append(nxt)
    return pts


# ───────────────────────────── the proportions (a gloved adult hand) ─────────────────────────────

FINGERS = [
    # name, y, radii at MCP / PIP / DIP / tip, lengths P1 / P2 / P3, MCP ψ, MCP r
    dict(name='index', y=-0.1315, r=[0.0104, 0.0098, 0.0091, 0.0085], L=[0.042, 0.026, 0.021], psi=44.0, rm=0.0375),
    dict(name='middle', y=-0.1527, r=[0.0108, 0.0102, 0.0094, 0.0087], L=[0.046, 0.029, 0.022], psi=40.0, rm=0.0385),
    dict(name='ring', y=-0.1737, r=[0.0103, 0.0097, 0.0090, 0.0083], L=[0.043, 0.027, 0.021], psi=40.0, rm=0.0378),
    dict(name='pinky', y=-0.1937, r=[0.0091, 0.0086, 0.0080, 0.0074], L=[0.034, 0.021, 0.019], psi=43.0, rm=0.0355),
]


class Hand:
    """the right fist round a grip of radius rg on the Y axis (hand frame); `grip=False` = a loose empty fist"""

    def __init__(self, rg=0.019, grip=True, curl=1.0, mcp_in=0.0, tilt=0.0, pivot=-0.1315, mcp_shift=None):
        """
        tilt (rad): the grip crosses the palm diagonally — its axis turned about +X (the back-of-hand normal) from +Y
        toward −Z (distal), through (0, pivot, 0). 0 = the old hammer grip (grip ⊥ the metacarpals).
        """
        self.rg = rg
        self.grip = grip
        self.tilt = tilt
        self.cb, self.sb = np.cos(tilt), np.sin(tilt)
        self.C = v3(0.0, pivot, 0.0)
        self.g = v3(0.0, self.cb, -self.sb)
        self.k = v3(0.0, self.sb, self.cb)
        self.fingers = []
        for i, f in enumerate(FINGERS):
            mcp = P(f['psi'], f['rm'] - mcp_in, f['y'])
            if mcp_shift is not None:
                mcp = mcp + np.asarray(mcp_shift[i], dtype=np.float64)
            zc = self.zc(f['y'])
            joints = walk(mcp, f['L'], f['r'], rg, +1.0, y_drift=0.0012 * curl, zc=zc, cb=self.cb)
            self.fingers.append(dict(f, joints=joints, mcp=mcp, zc=zc))
        # the wrist and the carpal row (the metacarpals converge toward the wrist, which sits lower: the grip crosses
        # the palm diagonally, so the wrist only needs ~18° of ulnar deviation to the forearm)
        self.W = v3(0.017, -0.199, 0.066)
        self.carpals = [v3(0.031, -0.184 + dy, 0.047) for dy in (0.0095, 0.0032, -0.0032, -0.0095)]
        # the thumb: CMC deep in the thenar, MCP at the back-right, the proximal phalanx across the back of the grip,
        # the distal phalanx lying ON the index finger's middle / distal phalanges at the left-back (a hammer grip)
        self.t_cmc = v3(0.026, -0.160, 0.052 + 0.35 * self.zc(-0.160))
        self.t_mcp = v3(0.010, -0.1245, 0.0405 + self.zc(-0.1245))
        ip = P(-128.0, 0.0342 - (0.019 - rg), -0.1215) + v3(0, 0, self.zc(-0.1215))
        tip = P(190.0, 0.0410 - (0.019 - rg), -0.1255) + v3(0, 0, self.zc(-0.1255))
        self.t_joints = [self.t_mcp, ip, tip]
        self.carp_c = v3(0.024, -0.188, 0.055)
        # the forearm direction in the hand frame (JIAN d rotated back: (0, −0.655, 0.756))
        self.fore = norm(v3(0.0, -0.655, 0.756))
        # knuckle strip: across the MCP heads, its band direction ≈ the finger direction at the MCP
        heads = [self.knuckle_head(f) for f in self.fingers]
        self.k_line = np.array(heads)

    def knuckle_head(self, f):
        """the outer apex of the MCP knuckle (radially out from the grip axis)"""
        m = f['mcp']
        return m + self.out_dir(m) * (f['r'][0] + 0.0012)

    def out_dir(self, pt):
        """unit vector from the grip axis out to pt (perpendicular to the axis)"""
        rel = pt - self.C
        return norm(rel - self.g * (rel @ self.g))

    def axis_dist(self, pt):
        rel = pt - self.C
        return float(np.linalg.norm(rel - self.g * (rel @ self.g)))

    # ─── the body ───
    def finger_sdf(self, p, f):
        J = f['joints']
        r = f['r']
        # flatten the finger dorsal-palmar (radially about the grip axis) so the fist's finger band reads flat-fronted
        rc = 0.5 * (self.axis_dist(J[1]) + self.axis_dist(J[2]))
        rel = p - self.C
        foot = np.outer(rel @ self.g, self.g)
        perp = rel - foot
        rho = np.maximum(np.linalg.norm(perp, axis=1), 1e-9)
        k = 0.8
        rho2 = rc + (rho - rc) / k
        q = self.C + foot + perp * (rho2 / rho)[:, None]
        d = None
        for i in range(3):
            seg = sd_round_cone(q, J[i], J[i + 1], r[i], r[i + 1])
            d = seg if d is None else smin(d, seg, 0.005)
        # the PIP / DIP knuckle caps: a bony bump on the outside of each bend (0.5 mm proud)
        for i, (sz, off) in ((1, (0.62, 0.45)), (2, (0.55, 0.47))):
            out = self.out_dir(J[i])
            d = smin(d, sd_sphere(q, J[i] + out * r[i] * off, r[i] * sz), 0.0035)
        return d * (0.5 + 0.5 * k)

    def palm_sdf(self, p):
        d = None
        for f, c in zip(self.fingers, self.carpals):
            m = f['mcp']
            meta = sd_round_cone(p, c, m, 0.0098, f['r'][0] * 0.98)
            out = self.out_dir(m)
            head = sd_sphere(p, m + out * 0.0010, f['r'][0] * 1.0)
            meta = smin(meta, head, 0.004)
            d = meta if d is None else smin(d, meta, 0.007)
        # palm pad between the metacarpals and the grip, laid along the grip (it is subtracted afterward): with a
        # diagonal grip the pads follow the grip, the metacarpals / carpus / wrist stay with the hand
        t_of = lambda y: (y - self.C[1]) / self.cb  # noqa: E731
        pad = sd_round_cone(p, self.grip_point(t_of(-0.128), 0.020, 0.020), self.grip_point(t_of(-0.200), 0.020, 0.024), 0.019, 0.019)
        d = smin(d, pad, 0.01)
        hypo = sd_ellipsoid(p, self.grip_point(t_of(-0.196), 0.013, 0.030), np.eye(3), (0.017, 0.016, 0.02))
        d = smin(d, hypo, 0.008)
        thenar = sd_ellipsoid(p, v3(0.012, -0.137, 0.040 + 0.6 * self.zc(-0.137)), np.eye(3), (0.018, 0.019, 0.017))
        d = smin(d, thenar, 0.008)
        # the palm's floor behind the grip, where the fingertips press (ψ ≈ −100°…−130°)
        floor = sd_round_cone(p, self.grip_point(t_of(-0.140), -0.004, 0.036), self.grip_point(t_of(-0.198), 0.0, 0.036), 0.0125, 0.0125)
        d = smin(d, floor, 0.012)
        # the carpus and the wrist, flattened dorsal-palmar (X) — a gloved wrist ~56 × 40 mm
        wrist0 = self.W - self.fore * 0.012
        wrist1 = self.W + self.fore * 0.035
        q = p.copy()
        # squash about the wrist axis: X distances ×1/0.72
        q[:, 0] = self.W[0] + (p[:, 0] - self.W[0]) / 0.72
        wr = sd_round_cone(q, wrist0, wrist1, 0.0275, 0.0265) * 0.72
        d = smin(d, wr, 0.012)
        carp = sd_ellipsoid(p, self.carp_c, np.eye(3), (0.018, 0.028, 0.02))
        d = smin(d, carp, 0.01)
        return d

    def thumb_meta_sdf(self, p):
        return sd_round_cone(p, self.t_cmc, self.t_mcp, 0.0155, 0.0128)

    def thumb_sdf(self, p):
        J = self.t_joints
        r = [0.0124, 0.0114, 0.0098]
        d = None
        for i in range(2):
            seg = sd_round_cone(p, J[i], J[i + 1], r[i], r[i + 1])
            d = seg if d is None else smin(d, seg, 0.006)
        return d

    def move_wrist(self, delta):
        """move the wrist centre by delta, the carpus and the metacarpal bases with it (by half)"""
        delta = np.asarray(delta, dtype=np.float64)
        self.W = self.W + delta
        self.carp_c = self.carp_c + delta * 0.6
        self.carpals = [c + delta * 0.45 for c in self.carpals]

    def zc(self, y):
        """z of the grip axis in the plane Y = y"""
        return -np.tan(self.tilt) * (y - self.C[1])

    def grip_point(self, t, x=0.0, w=0.0):
        """a point in the grip's own frame: t along the axis from the pivot, x toward the back of the hand, w along k"""
        return self.C + self.g * t + v3(1.0, 0.0, 0.0) * x + self.k * w

    def grip_sdf(self, p):
        q = p - self.C
        along = q @ self.g
        perp = q - np.outer(along, self.g)
        return np.linalg.norm(perp, axis=1) - self.rg

    def body_sdf(self, p, details=True, thumb_on=True):
        fingers = None
        for f in self.fingers:
            df = self.finger_sdf(p, f)
            fingers = df if fingers is None else np.minimum(fingers, df)
        thumb = self.thumb_sdf(p)
        palm = self.palm_sdf(p)
        palm = smin(palm, self.thumb_meta_sdf(p), 0.01)
        d = smin(palm, fingers, 0.006)
        # the thumb meets the index side with a crease, the thenar blends
        if thumb_on:
            # the thumb's proximal phalanx blends out of its MCP, the rest presses on the index with a crease
            d = smin(d, thumb, 0.003)
        if self.grip:
            d = smax(d, -(self.grip_sdf(p) - 0.0002), 0.0015)
        if details:
            d = d + self.detail_sdf(p)
        return d

    # ─── seams, wrinkles (dents added to the SDF) and the stitch lines (B channel) ───
    def seam_lines(self):
        """polylines of the stitched panel seams (grooves)"""
        lines = []
        # the outer side seam of the pinky and the top side of the index (the fourchettes between fingers sit in
        # the creases already)
        for f, side in ((self.fingers[3], -1.0), (self.fingers[0], 1.0)):
            J = f['joints']
            pts = []
            for i in range(len(J)):
                pts.append(J[i] + v3(0, side * f['r'][min(i, 3)] * 0.93, 0))
            lines.append(catmull(pts, 6))
        # the Bolton thumb: a seam loop round the thumb base
        c = self.t_cmc * 0.35 + self.t_mcp * 0.65
        ax = norm(self.t_mcp - self.t_cmc)
        u = norm(np.cross(ax, v3(0, 1, 0)))
        w = np.cross(ax, u)
        loop = [c + (np.cos(a) * u + np.sin(a) * w) * 0.0148 for a in np.linspace(0, 2 * np.pi, 33)]
        lines.append(np.array(loop))
        # three 'points' on the back of the hand (decorative stitched lines from each finger valley to the wrist)
        for k in range(3):
            a = 0.5 * (self.fingers[k]['mcp'] + self.fingers[k + 1]['mcp'])
            out = self.out_dir(a)
            s0 = a + out * 0.012 + v3(0, 0, 0.012)
            s1 = self.carpals[k] * 0.5 + self.carpals[k + 1] * 0.5 + v3(0.012, 0, 0.0)
            lines.append(catmull([s0, 0.5 * (s0 + s1) + v3(0.004, 0, 0), s1], 8))
        return lines

    def wrinkle_lines(self):
        """short dents: dorsal wrinkles before each PIP knuckle, compression wrinkles at the ulnar side of the wrist"""
        out = []
        for f in self.fingers:
            J = f['joints']
            t = norm(J[1] - J[0])
            n = self.out_dir(0.5 * (J[0] + J[1]))
            r = f['r'][1]
            for k, back in enumerate((0.0065, 0.0105)):
                c = J[1] - t * back
                pts = []
                for a in np.linspace(-0.85, 0.85, 9):
                    bow = 0.0012 * (1 - a * a) * (1 if k == 0 else -1)
                    pts.append(c + v3(0, a * r * 0.95, 0) + n * (r * np.sqrt(max(0.0, 1 - (0.95 * a) ** 2)) + 0.0006) + t * bow)
                out.append((np.array(pts), 0.0009, 0.0008))
            # the proximal phalanx near the MCP: one faint stretch line
            c = J[0] + t * 0.012
            pts = [c + v3(0, a * f['r'][0] * 0.9, 0) + n * (f['r'][0] * np.sqrt(max(0.0, 1 - (0.9 * a) ** 2)) + 0.0005) for a in np.linspace(-0.8, 0.8, 7)]
            out.append((np.array(pts), 0.0008, 0.0006))
        # ulnar-side wrist compression folds (the pinky side of the wrist, the side the eye looks at)
        W = self.W
        a = self.fore
        wv = norm(v3(0, 1, 0) - a * a[1])
        for k, s in enumerate((-0.004, 0.006, 0.016)):
            c = W + a * s - wv * 0.0265
            pts = []
            for u in np.linspace(-1, 1, 9):
                pts.append(c + v3(u * 0.018, 0, 0) + wv * (0.004 * u * u) + a * (0.003 * u * (1 if k % 2 == 0 else -1)))
            out.append((np.array(pts), 0.0013, 0.0011))
        return out

    def detail_sdf(self, p):
        g = np.zeros(len(p))
        # only evaluate grooves near their curves (cheap reject by bounding box)
        for line in self.seam_lines():
            g += self._near(p, line, 0.004, lambda q, ln=line: groove(q, ln, 0.0008, 0.0007))
        for line, w, dep in self.wrinkle_lines():
            g += self._near(p, line, 0.004, lambda q, ln=line, w=w, dep=dep: groove(q, ln, w, dep))
        return g

    @staticmethod
    def _near(p, line, pad, fn):
        lo = line.min(axis=0) - pad
        hi = line.max(axis=0) + pad
        m = np.all((p >= lo) & (p <= hi), axis=1)
        out = np.zeros(len(p))
        if m.any():
            out[m] = fn(p[m])
        return out

    def stitch_lines(self):
        """stitch rows (offset 1.1 mm beside each seam) for the B channel"""
        rows = []
        for line in self.seam_lines():
            rows.append(line)
        return rows

    # ─── the knuckle strip (leather pad over the MCP row) ───
    def strip_sdf(self, p, body):
        """a 2.2 mm pad over the MCP heads, 13 mm across, following the knuckles; `body` = the body SDF at p"""
        heads = self.k_line
        rw = norm(heads[0] - heads[-1])
        d_line, _, _ = seg_dist(p, catmull([heads[0] + rw * 0.006] + list(heads) + [heads[-1] - rw * 0.006], 6))
        # across-band axis ≈ the finger direction at the MCP (front-left), the band is |dot| < 6.5 mm
        mid = heads.mean(axis=0)
        n_out = self.out_dir(mid)
        row = norm(heads[0] - heads[-1])
        t_across = norm(np.cross(row, n_out))
        slab = np.abs((p - mid) @ t_across) - 0.0065
        s_row = (p - mid) @ row
        half = 0.5 * float(np.linalg.norm(heads[0] - heads[-1]))
        yb = np.maximum(s_row - (half + 0.0085), -(half + 0.0075) - s_row)
        d = smax(body - 0.0022, slab, 0.0014)
        d = smax(d, yb, 0.002)
        d = smax(d, d_line - 0.022, 0.002)
        return d

    def stud_points(self):
        """the 4 brass studs: (centre, outward normal) on the strip over each MCP head"""
        mid = self.k_line.mean(axis=0)
        n_out = self.out_dir(mid)
        out = []
        for h in self.k_line:
            nh = self.out_dir(h)
            n = norm(nh * 0.7 + n_out * 0.3)
            out.append((h + n * 0.0026, n))
        return out


class DiagonalHand(Hand):
    """
    The jian grip of the first-person pose (lab P8 round 13): the grip crosses the palm DIAGONALLY, from the index MCP
    to the heel, so the blade nearly continues the forearm. HAND frame as above (+Y the grip, +X the back of the hand);
    the landmarks are set explicitly:
    - the metacarpals lie in the back plane (X ≈ 0.034) along m = (0, cos α, −sin α), α = 22° off the grip;
    - the knuckle row runs along r = X × m (the thumb side), i.e. round the grip: index MCP at ψ ≈ 4°, pinky ≈ 56°;
    - each finger's proximal phalanx fans from its knuckle to its wrap plane (index y −0.126 … pinky −0.191), the rest
      wraps the grip perpendicular to it (the tangent walk);
    - the wrist W = middle MCP − 0.078 m sits ~3.5 cm off the grip axis on the back / ulnar side, above the pommel;
    - the thumb comes off the thenar and wraps across the back of the grip onto the index finger.
    """

    ALPHA = np.radians(22.0)
    MCP_MID = v3(0.034, -0.1435, -0.022)
    ROW = ((0.020, -0.003), (0.0, 0.0), (-0.019, -0.004), (-0.036, -0.012))   # along r, along m from the middle MCP
    WRAP_Y = (-0.126, -0.148, -0.170, -0.191)

    def __init__(self, rg=0.019, fore=None):
        self.rg = rg
        self.grip = True
        self.tilt = 0.0
        self.cb, self.sb = 1.0, 0.0
        self.C = v3(0.0, -0.1435, 0.0)
        self.g = v3(0.0, 1.0, 0.0)
        self.k = v3(0.0, 0.0, 1.0)
        a = self.ALPHA
        self.m = v3(0.0, np.cos(a), -np.sin(a))
        self.r = v3(0.0, np.sin(a), np.cos(a))
        self.fingers = []
        for f, (dr, dm), yw in zip(FINGERS, self.ROW, self.WRAP_Y):
            mcp = self.MCP_MID + self.r * dr + self.m * dm
            joints = walk(mcp, f['L'], f['r'], rg, +1.0, y_drift=0.0008, p1_dy=yw - mcp[1])
            self.fingers.append(dict(f, y=yw, joints=joints, mcp=mcp, zc=0.0))
        self.W = self.MCP_MID - self.m * 0.078
        self.carpals = [self.W + self.m * 0.02 + self.r * (dr * 0.55) + v3(-0.003, 0, 0) for dr, _ in self.ROW]
        self.carp_c = self.W + self.m * 0.012 + v3(-0.008, 0, 0)
        # the thumb: CMC in the thenar (radial side of the wrist), MCP behind the grip, the proximal phalanx across the
        # back of the grip, the distal phalanx lying on the index finger's middle phalanx
        self.t_cmc = self.W + self.r * 0.022 + self.m * 0.012 + v3(-0.006, 0, 0)
        self.t_mcp = v3(0.017, -0.152, 0.034)
        self.t_joints = [self.t_mcp, P(-116.0, 0.0335, -0.1335), P(190.0, 0.0365, -0.127)]
        self.fore = fore if fore is not None else norm(v3(0.052, -0.99, -0.014))
        self.k_line = np.array([self.knuckle_head(fg) for fg in self.fingers])

    def palm_sdf(self, p):
        d = None
        for f, c in zip(self.fingers, self.carpals):
            mc = f['mcp']
            meta = sd_round_cone(p, c, mc, 0.0098, f['r'][0] * 0.98)
            head = sd_sphere(p, mc + self.out_dir(mc) * 0.0010, f['r'][0] * 1.0)
            meta = smin(meta, head, 0.004)
            d = meta if d is None else smin(d, meta, 0.007)
        # the palm between the metacarpals and the grip, down to the heel (the grip is subtracted afterward)
        pad = sd_round_cone(p, v3(0.022, -0.128, 0.006), v3(0.024, -0.222, 0.012), 0.019, 0.02)
        d = smin(d, pad, 0.01)
        # the heel (hypothenar) that the pommel tucks against, and the thenar under the thumb
        hypo = sd_ellipsoid(p, v3(0.022, -0.212, -0.004), np.eye(3), (0.018, 0.02, 0.02))
        d = smin(d, hypo, 0.01)
        thenar = sd_ellipsoid(p, self.t_cmc * 0.5 + self.t_mcp * 0.5 + v3(-0.004, 0, 0), np.eye(3), (0.017, 0.022, 0.016))
        d = smin(d, thenar, 0.009)
        # the palm's radial half wraps the back of the grip (ψ ≈ −50°…−100°) between the thenar and the heel: a flat
        # pad, not a finger (the grip is subtracted, so its inside is the grip's own surface)
        palm2 = sd_ellipsoid(p, v3(0.010, -0.168, 0.026), np.eye(3), (0.017, 0.036, 0.013))
        d = smin(d, palm2, 0.012)
        # the carpus and the wrist, flattened dorsal-palmar (X)
        wrist0 = self.W - self.fore * 0.012
        wrist1 = self.W + self.fore * 0.035
        q = p.copy()
        q[:, 0] = self.W[0] + (p[:, 0] - self.W[0]) / 0.72
        wr = sd_round_cone(q, wrist0, wrist1, 0.0275, 0.0265) * 0.72
        d = smin(d, wr, 0.012)
        carp = sd_ellipsoid(p, self.carp_c, np.eye(3), (0.018, 0.026, 0.024))
        d = smin(d, carp, 0.01)
        return d

    def seam_lines(self):
        lines = super().seam_lines()
        # the 'points' on the back of the hand run from the finger valleys toward the wrist along m
        out = lines[:-3]
        for kk in range(3):
            a = 0.5 * (self.fingers[kk]['mcp'] + self.fingers[kk + 1]['mcp'])
            s0 = a + v3(0.012, 0, 0) - self.m * 0.012
            s1 = a + v3(0.011, 0, 0) - self.m * 0.05
            out.append(catmull([s0, 0.5 * (s0 + s1) + v3(0.002, 0, 0), s1], 8))
        return out
