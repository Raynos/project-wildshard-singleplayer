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


def walk(start, lens, radii, rg, sign=1.0, y_drift=0.0):
    """
    Wrap a digit round the grip: each phalanx leaves its joint along the tangent to the circle it may not enter
    (rg + its radius), toward increasing ψ (sign +1) or decreasing (−1). Returns the joint points (len(lens)+1).
    """
    pts = [start.copy()]
    for i, L in enumerate(lens):
        p = pts[-1]
        r_seg = 0.5 * (radii[i] + radii[i + 1])
        rc = rg + r_seg + 0.0003
        q = v3(p[0], 0.0, p[2])
        rho = np.linalg.norm(q)
        ap = psi_of(q)
        if rho > rc + 1e-5:
            at = ap + sign * np.arccos(rc / rho) / D2R
            T = P(at, rc, 0.0)
            d = norm(T - q)
        else:
            a = ap * D2R
            d = sign * v3(-np.sin(a), 0.0, -np.cos(a))
        nxt = q + d * L
        nxt[1] = p[1] + y_drift
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

    def __init__(self, rg=0.019, grip=True, curl=1.0, mcp_in=0.0):
        self.rg = rg
        self.grip = grip
        self.fingers = []
        for f in FINGERS:
            mcp = P(f['psi'], f['rm'] - mcp_in, f['y'])
            joints = walk(mcp, f['L'], f['r'], rg, +1.0, y_drift=0.0012 * curl)
            self.fingers.append(dict(f, joints=joints, mcp=mcp))
        # the wrist and the carpal row (the metacarpals converge toward the wrist, which sits lower: the grip crosses
        # the palm diagonally, so the wrist only needs ~18° of ulnar deviation to the forearm)
        self.W = v3(0.017, -0.199, 0.066)
        self.carpals = [v3(0.031, -0.184 + dy, 0.047) for dy in (0.0095, 0.0032, -0.0032, -0.0095)]
        # the thumb: CMC deep in the thenar, MCP at the back-right, the proximal phalanx across the back of the grip,
        # the distal phalanx lying ON the index finger's middle / distal phalanges at the left-back (a hammer grip)
        self.t_cmc = v3(0.026, -0.160, 0.052)
        self.t_mcp = v3(0.010, -0.1245, 0.0405)
        ip = P(-128.0, 0.0342 - (0.019 - rg), -0.1215)
        tip = P(190.0, 0.0410 - (0.019 - rg), -0.1255)
        self.t_joints = [self.t_mcp, ip, tip]
        # the forearm direction in the hand frame (JIAN d rotated back: (0, −0.655, 0.756))
        self.fore = norm(v3(0.0, -0.655, 0.756))
        # knuckle strip: across the MCP heads, its band direction ≈ the finger direction at the MCP
        heads = [self.knuckle_head(f) for f in self.fingers]
        self.k_line = np.array(heads)

    def knuckle_head(self, f):
        """the outer apex of the MCP knuckle (radially out from the grip axis)"""
        m = f['mcp']
        out = norm(v3(m[0], 0.0, m[2]))
        return m + out * (f['r'][0] + 0.0012)

    # ─── the body ───
    def finger_sdf(self, p, f):
        J = f['joints']
        r = f['r']
        # flatten the finger dorsal-palmar (radially about the grip axis) so the fist's finger band reads flat-fronted
        rc = 0.5 * (np.hypot(J[1][0], J[1][2]) + np.hypot(J[2][0], J[2][2]))
        rho = np.maximum(np.hypot(p[:, 0], p[:, 2]), 1e-9)
        k = 0.8
        rho2 = rc + (rho - rc) / k
        q = p.copy()
        q[:, 0] = p[:, 0] * rho2 / rho
        q[:, 2] = p[:, 2] * rho2 / rho
        d = None
        for i in range(3):
            seg = sd_round_cone(q, J[i], J[i + 1], r[i], r[i + 1])
            d = seg if d is None else smin(d, seg, 0.005)
        # the PIP / DIP knuckle caps: a bony bump on the outside of each bend (0.5 mm proud)
        for i, (sz, off) in ((1, (0.62, 0.45)), (2, (0.55, 0.47))):
            out = norm(v3(J[i][0], 0.0, J[i][2]))
            d = smin(d, sd_sphere(q, J[i] + out * r[i] * off, r[i] * sz), 0.0035)
        return d * (0.5 + 0.5 * k)

    def palm_sdf(self, p):
        d = None
        for f, c in zip(self.fingers, self.carpals):
            m = f['mcp']
            meta = sd_round_cone(p, c, m, 0.0098, f['r'][0] * 0.98)
            out = norm(v3(m[0], 0.0, m[2]))
            head = sd_sphere(p, m + out * 0.0010, f['r'][0] * 1.0)
            meta = smin(meta, head, 0.004)
            d = meta if d is None else smin(d, meta, 0.007)
        # palm pad between the metacarpals and the grip (the grip is subtracted afterward)
        pad = sd_round_cone(p, v3(0.020, -0.128, 0.020), v3(0.020, -0.200, 0.024), 0.019, 0.019)
        d = smin(d, pad, 0.01)
        hypo = sd_ellipsoid(p, v3(0.013, -0.196, 0.030), np.eye(3), (0.017, 0.016, 0.02))
        d = smin(d, hypo, 0.008)
        thenar = sd_ellipsoid(p, v3(0.012, -0.137, 0.040), np.eye(3), (0.018, 0.019, 0.017))
        d = smin(d, thenar, 0.008)
        # the palm's floor behind the grip, where the fingertips press (ψ ≈ −100°…−130°)
        floor = sd_round_cone(p, v3(-0.004, -0.140, 0.036), v3(0.000, -0.198, 0.036), 0.0125, 0.0125)
        d = smin(d, floor, 0.012)
        # the carpus and the wrist, flattened dorsal-palmar (X) — a gloved wrist ~56 × 40 mm
        wrist0 = self.W - self.fore * 0.012
        wrist1 = self.W + self.fore * 0.035
        q = p.copy()
        # squash about the wrist axis: X distances ×1/0.72
        q[:, 0] = self.W[0] + (p[:, 0] - self.W[0]) / 0.72
        wr = sd_round_cone(q, wrist0, wrist1, 0.0275, 0.0265) * 0.72
        d = smin(d, wr, 0.012)
        carp = sd_ellipsoid(p, v3(0.024, -0.188, 0.055), np.eye(3), (0.018, 0.028, 0.02))
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

    def grip_sdf(self, p):
        return np.sqrt(p[:, 0] ** 2 + p[:, 2] ** 2) - self.rg

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
            out = norm(v3(a[0], 0, a[2]))
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
            n = norm(v3(0.5 * (J[0][0] + J[1][0]), 0, 0.5 * (J[0][2] + J[1][2])))
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
        d_line, _, _ = seg_dist(p, catmull([heads[0] + v3(0, 0.006, 0)] + list(heads) + [heads[-1] - v3(0, 0.006, 0)], 6))
        # across-band axis ≈ the finger direction at the MCP (front-left), the band is |dot| < 6.5 mm
        mid = heads.mean(axis=0)
        n_out = norm(v3(mid[0], 0, mid[2]))
        t_across = norm(np.cross(v3(0, 1, 0), n_out))
        slab = np.abs((p - mid) @ t_across) - 0.0065
        yb = np.maximum(p[:, 1] - (heads[0][1] + 0.0085), (heads[-1][1] - 0.0075) - p[:, 1])
        d = smax(body - 0.0022, slab, 0.0014)
        d = smax(d, yb, 0.002)
        d = smax(d, d_line - 0.022, 0.002)
        return d

    def stud_points(self):
        """the 4 brass studs: (centre, outward normal) on the strip over each MCP head"""
        mid = self.k_line.mean(axis=0)
        n_out = norm(v3(mid[0], 0, mid[2]))
        out = []
        for h in self.k_line:
            nh = norm(v3(h[0], 0, h[2]))
            n = norm(nh * 0.7 + n_out * 0.3)
            out.append((h + n * 0.0026, n))
        return out
