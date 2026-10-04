/**
 * The boulevard's look (SHARD-PLATFORM SF17b look, G80 / G81 / G93): the asphalt the deck's road band wears, its
 * markings, kerbs, turn-ins, roundabouts, streetlights and green distance signs, drawn over the generator's deck in the
 * home frame. A handful of draws for the whole grid: one asphalt mesh (one canvas texture), one junction mesh (one
 * canvas), one kerb / island mesh (vertex colours), two instanced meshes for the streetlights and one sign mesh (one
 * canvas atlas). No shadow casters (the 80 m rule) and no colliders: the deck's own trimesh stays the ground.
 *
 * The layout is `roadLayout.ts`; sign text comes from the catalogue's slugs through the shard registry.
 */
import {
  BufferAttribute, BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, Group, InstancedMesh, LinearMipmapLinearFilter, Matrix4, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, type Object3D, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3,
} from 'three';
import type { GridCell } from './assembly';
import {
  GAP_HALF, RING_ISLAND, RING_OUTER, ROAD_HALF, SEGMENT_HALF, TURN_IN_HALF, segmentPoint,
  type ArmSide, type LookScope, type RoadJunction, type RoadLayout, type RoadSign, type SignLine,
} from './roadLayout';

/** What the look draws into and how it hands its meshes to the frame (SF19a's neutral highway slot). */
export interface RoadLookInput {
  readonly layout: RoadLayout;
  readonly home: GridCell;
  readonly scene: Object3D;
  readonly scope: LookScope;
  /** SF19a: tag a mesh as highway (its grade is the neutral road grade, G75) */
  readonly tag?: (mesh: Mesh) => void;
}
/** The readout (tests, the board). */
export interface RoadLookState { readonly segments: number; readonly junctions: number; readonly roundabouts: number; readonly signs: number; readonly lights: number; readonly draws: number }

const LIFT = 0.02; // the overlay's height over the deck's road band (polygon offset does the rest)
const ASPHALT = '#3a3c40', YELLOW = '#e0b23a', WHITE = '#e9ebe6', KERB = new Color(0x9a9c98), ISLAND = new Color(0x4f6a35), SIGN_GREEN = '#0d6b3c';

/** A tiny triangle builder: positions, normals, uvs, colours, one index buffer. */
class Mesher {
  readonly p: number[] = []; readonly n: number[] = []; readonly uv: number[] = []; readonly c: number[] = []; readonly i: number[] = [];
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, u = 0, v = 0, colour?: Color): number {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(colour?.r ?? 1, colour?.g ?? 1, colour?.b ?? 1);
    return this.p.length / 3 - 1;
  }
  /** A triangle, wound so its face looks along vertex `a`'s normal (callers never think about winding). */
  tri(a: number, b: number, c: number): void {
    const p = this.p, at = (k: number, o: number): number => p[k * 3 + o] ?? 0;
    const ux = at(b, 0) - at(a, 0), uy = at(b, 1) - at(a, 1), uz = at(b, 2) - at(a, 2), vx = at(c, 0) - at(a, 0), vy = at(c, 1) - at(a, 1), vz = at(c, 2) - at(a, 2);
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, n = this.n;
    if (nx * (n[a * 3] ?? 0) + ny * (n[a * 3 + 1] ?? 0) + nz * (n[a * 3 + 2] ?? 0) < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
  }
  /** A quad a-b-c-d in order round its edge (either way round). */
  quad(a: number, b: number, c: number, d: number): void { this.tri(a, b, c); this.tri(a, c, d); }
  geometry(colours = false): BufferGeometry {
    const g = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(this.p), 3)).setAttribute('normal', new BufferAttribute(new Float32Array(this.n), 3))
      .setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2)).setIndex(new BufferAttribute(new Uint32Array(this.i), 1));
    if (colours) g.setAttribute('color', new BufferAttribute(new Float32Array(this.c), 3));
    g.computeBoundingSphere();
    return g;
  }
  /** A box from foot `a` to foot `b` on the ground at `y0`, `width` across and `height` tall (sides and top; no bottom). */
  beam(a: { x: number; z: number }, b: { x: number; z: number }, y0: number, width: number, height: number, colour: Color, uv?: readonly [number, number]): void {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    if (len < 1e-4) return;
    const ox = (-dz / len) * width / 2, oz = (dx / len) * width / 2, y1 = y0 + height, [u, v] = uv ?? [0, 0];
    const top = [this.vertex(a.x - ox, y1, a.z - oz, 0, 1, 0, u, v, colour), this.vertex(b.x - ox, y1, b.z - oz, 0, 1, 0, u, v, colour), this.vertex(b.x + ox, y1, b.z + oz, 0, 1, 0, u, v, colour), this.vertex(a.x + ox, y1, a.z + oz, 0, 1, 0, u, v, colour)] as const;
    this.quad(top[0], top[1], top[2], top[3]);
    const side = (p: { x: number; z: number }, q: { x: number; z: number }, nx: number, nz: number): void => {
      const s = [this.vertex(p.x, y0, p.z, nx, 0, nz, u, v, colour), this.vertex(q.x, y0, q.z, nx, 0, nz, u, v, colour), this.vertex(q.x, y1, q.z, nx, 0, nz, u, v, colour), this.vertex(p.x, y1, p.z, nx, 0, nz, u, v, colour)] as const;
      this.quad(s[0], s[1], s[2], s[3]);
    };
    const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
    side({ x: a.x + ox, z: a.z + oz }, { x: b.x + ox, z: b.z + oz }, nx, nz);
    side({ x: b.x - ox, z: b.z - oz }, { x: a.x - ox, z: a.z - oz }, -nx, -nz);
    side({ x: a.x - ox, z: a.z - oz }, { x: a.x + ox, z: a.z + oz }, -ux, -uz);
    side({ x: b.x + ox, z: b.z + oz }, { x: b.x - ox, z: b.z - oz }, ux, uz);
  }
}

/** A deterministic hash in [0, 1) (the look must be identical every run: no Math.random). */
function hash(n: number): number { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function canvas(w: number, h: number): { el: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const el = document.createElement('canvas'); el.width = w; el.height = h;
  const g = el.getContext('2d'); if (g === null) throw new Error('No 2D canvas for the road look');
  return { el, g };
}
/** Fine asphalt grain over a filled rectangle. */
function grain(g: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  g.fillStyle = ASPHALT; g.fillRect(0, 0, w, h);
  const count = Math.round(w * h / 18);
  for (let k = 0; k < count; k++) {
    const r = hash(seed + k * 3.1), x = hash(seed + k * 7.7) * w, y = hash(seed + k * 1.3) * h, l = r < 0.5 ? 30 + r * 30 : 70 + r * 40;
    g.fillStyle = `rgba(${String(l)},${String(l + 2)},${String(l + 6)},0.55)`; g.fillRect(x, y, 1 + (r > 0.92 ? 1 : 0), 1);
  }
}
function texture(el: HTMLCanvasElement, repeat: boolean): CanvasTexture {
  const t = new CanvasTexture(el); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; t.minFilter = LinearMipmapLinearFilter;
  if (repeat) { t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping; }
  return t;
}

/** The road canvas: u [0, 0.5) the normal section, [0.5, 1) the turn-in section; v one 12 m period of dashes. */
const ROAD_PERIOD = 12;
function roadTexture(): CanvasTexture {
  const W = 1024, H = 512, { el, g } = canvas(W, H);
  grain(g, W, H, 1);
  const half = W / 2, px = (t: number, base: number): number => base + (t + ROAD_HALF) / (2 * ROAD_HALF) * half, pm = half / (2 * ROAD_HALF);
  for (const base of [0, half]) {
    const turnIn = base > 0;
    // wheel paths: faint darker wear in each lane
    g.fillStyle = 'rgba(20,22,26,0.18)';
    for (const t of [-5.9, -4.3, -2.6, -1.0, 1.0, 2.6, 4.3, 5.9]) g.fillRect(px(t, base) - 0.35 * pm, 0, 0.7 * pm, H);
    g.fillStyle = YELLOW; // the double yellow centre line (G80)
    for (const t of [-0.17, 0.17]) g.fillRect(px(t, base) - 0.06 * pm, 0, 0.12 * pm, H);
    g.fillStyle = WHITE; // lane dividers: 3 m dash in a 12 m period
    for (const t of [-3.55, 3.55]) g.fillRect(px(t, base) - 0.06 * pm, 0, 0.12 * pm, H * 3 / ROAD_PERIOD);
    for (const t of [-7.0, 7.0]) { // edge lines; at a turn-in, short dashes so the opening reads
      if (!turnIn) g.fillRect(px(t, base) - 0.075 * pm, 0, 0.15 * pm, H);
      else for (let k = 0; k < 6; k++) g.fillRect(px(t, base) - 0.075 * pm, k * H / 6, 0.15 * pm, H / 12);
    }
  }
  return texture(el, true);
}

/** The junction canvas: 55 m square; the roundabout's markings in the middle, plain asphalt in the corners. */
function junctionTexture(): CanvasTexture {
  const W = 1024, { el, g } = canvas(W, W), k = W / (2 * GAP_HALF);
  grain(g, W, W, 2);
  const P = (x: number, z: number): [number, number] => [(x + GAP_HALF) * k, (GAP_HALF - z) * k];
  const arc = (r: number, a0: number, a1: number, width: number, colour: string, dash?: readonly [number, number]): void => {
    g.strokeStyle = colour; g.lineWidth = width * k; g.setLineDash(dash === undefined ? [] : [dash[0] * k, dash[1] * k]);
    const [cx, cy] = P(0, 0); g.beginPath(); g.arc(cx, cy, r * k, -a1, -a0); g.stroke(); g.setLineDash([]);
  };
  const open = Math.asin((ROAD_HALF + 0.3) / (RING_OUTER - 0.5));
  for (let q = 0; q < 4; q++) arc(RING_OUTER - 0.5, q * Math.PI / 2 + open, (q + 1) * Math.PI / 2 - open, 0.15, WHITE); // outer edge line between the arms
  arc(RING_ISLAND + 0.45, 0, Math.PI * 2, 0.15, WHITE); // inner edge line
  arc((RING_ISLAND + RING_OUTER) / 2, 0, Math.PI * 2, 0.12, WHITE, [3, 3]); // the circulating lane divider
  const sides: readonly { x: number; z: number }[] = [{ x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
  for (const d of sides) {
    const rx = -d.z, rz = d.x; // across unit (left of outward)
    const line = (t: number, r0: number, r1: number, width: number, colour: string, dash = 0): void => {
      g.fillStyle = colour;
      for (let r = r0; r < r1; r += dash > 0 ? dash * 4 : r1 - r0) {
        const e = Math.min(r1, r + (dash > 0 ? dash : r1 - r0)), [ax, ay] = P(d.x * r + rx * (t - width / 2), d.z * r + rz * (t - width / 2)), [bx, by] = P(d.x * e + rx * (t + width / 2), d.z * e + rz * (t + width / 2));
        g.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      }
    };
    for (const t of [-0.17, 0.17]) line(t, RING_OUTER + 3, GAP_HALF, 0.12, YELLOW);
    for (const t of [-3.55, 3.55]) line(t, RING_OUTER + 3, GAP_HALF, 0.12, WHITE, 3);
    for (const t of [-7.0, 7.0]) line(t, RING_OUTER + 0.5, GAP_HALF, 0.15, WHITE);
    // give way: the entry half is on the inbound traveller's right (the outward unit's left), dashed, with a triangle per lane
    const entry = 1;
    for (let t = 0.4; t < 6.9; t += 0.9) line(entry * (t + 0.3), RING_OUTER + 0.9, RING_OUTER + 1.2, 0.6, WHITE);
    for (const t of [1.8, 5.3]) {
      const tip = RING_OUTER + 2.2, base = tip + 2.6, [ax, ay] = P(d.x * tip + rx * t * entry, d.z * tip + rz * t * entry);
      const [bx, by] = P(d.x * base + rx * (t * entry + 0.7), d.z * base + rz * (t * entry + 0.7)), [cx, cy] = P(d.x * base + rx * (t * entry - 0.7), d.z * base + rz * (t * entry - 0.7));
      g.strokeStyle = WHITE; g.lineWidth = 0.15 * k; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.stroke();
    }
  }
  return texture(el, false);
}

/** The asphalt over every segment: three quads each (the middle one the turn-in section), UVs into the road canvas. */
function asphalt(layout: RoadLayout, home: GridCell): BufferGeometry {
  const m = new Mesher();
  for (const segment of layout.segments) {
    for (const [s0, s1, base] of [[-SEGMENT_HALF, -TURN_IN_HALF, 0], [-TURN_IN_HALF, TURN_IN_HALF, 0.5], [TURN_IN_HALF, SEGMENT_HALF, 0]] as const) {
      const corner = (s: number, t: number): number => {
        const p = segmentPoint(segment, s, t);
        return m.vertex(p.x - home.origin.x, LIFT, p.z - home.origin.z, 0, 1, 0, base + (t + ROAD_HALF) / (2 * ROAD_HALF) * 0.5 * 0.998 + 0.0005, s / ROAD_PERIOD);
      };
      const a = corner(s0, -ROAD_HALF), b = corner(s1, -ROAD_HALF), c = corner(s1, ROAD_HALF), d = corner(s0, ROAD_HALF);
      m.quad(a, b, c, d);
    }
    // turn-in aprons (G93): asphalt from the road edge to the cell edge on each side with a cell
    for (const [cell, t] of [[segment.low, -1], [segment.high, 1]] as const) {
      if (cell === undefined) continue;
      const v = (s: number, tt: number): number => { const p = segmentPoint(segment, s, tt); return m.vertex(p.x - home.origin.x, LIFT, p.z - home.origin.z, 0, 1, 0, 0.5 + 0.0005, s / ROAD_PERIOD); };
      const a = v(-TURN_IN_HALF, t * ROAD_HALF), b = v(TURN_IN_HALF, t * ROAD_HALF), c = v(TURN_IN_HALF, t * GAP_HALF), d = v(-TURN_IN_HALF, t * GAP_HALF);
      m.quad(a, b, c, d);
    }
  }
  return m.geometry();
}

const RETURN = 6; // a plain junction's kerb-return radius
const ARM_UNIT: Readonly<Record<ArmSide, { x: number; z: number }>> = { east: { x: 1, z: 0 }, west: { x: -1, z: 0 }, north: { x: 0, z: 1 }, south: { x: 0, z: -1 } };
/** The junctions' asphalt: a roundabout's disc and arms with planar UVs into the junction canvas; a plain junction's square,
 *  arms and kerb-return fillets mapped into the canvas's plain corner. */
function junctionAsphalt(layout: RoadLayout, home: GridCell): BufferGeometry {
  const m = new Mesher(), span = 2 * GAP_HALF;
  for (const j of layout.junctions) {
    const ox = j.centre.x - home.origin.x, oz = j.centre.z - home.origin.z;
    const ring = j.roundabout;
    const uvOf = (x: number, z: number): [number, number] => ring ? [(x + GAP_HALF) / span, (z + GAP_HALF) / span] : [(2 + (x + GAP_HALF) * 0.45) / span, (2 + (z + GAP_HALF) * 0.45) / span];
    const v = (x: number, z: number): number => { const [u, w] = uvOf(x, z); return m.vertex(ox + x, LIFT, oz + z, 0, 1, 0, u, w); };
    const rect = (x0: number, z0: number, x1: number, z1: number): void => { m.quad(v(x0, z0), v(x0, z1), v(x1, z1), v(x1, z0)); };
    if (ring) { // the disc
      const centre = v(0, 0), n = 48, rim: number[] = [];
      for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2; rim.push(v(Math.cos(a) * RING_OUTER, Math.sin(a) * RING_OUTER)); }
      for (let k = 0; k < n; k++) m.tri(centre, rim[k] ?? centre, rim[k + 1] ?? centre);
    } else rect(-ROAD_HALF, -ROAD_HALF, ROAD_HALF, ROAD_HALF);
    for (const side of ['east', 'west', 'north', 'south'] as const) {
      if (!j.arms[side]) continue;
      const d = ARM_UNIT[side], r0 = ring ? RING_OUTER - 2 : ROAD_HALF;
      const xs = [d.x * r0, d.x * GAP_HALF], zs = [d.z * r0, d.z * GAP_HALF];
      if (d.x !== 0) rect(Math.min(xs[0] ?? 0, xs[1] ?? 0), -ROAD_HALF, Math.max(xs[0] ?? 0, xs[1] ?? 0), ROAD_HALF);
      else rect(-ROAD_HALF, Math.min(zs[0] ?? 0, zs[1] ?? 0), ROAD_HALF, Math.max(zs[0] ?? 0, zs[1] ?? 0));
    }
    if (!ring) for (const [qx, qz, a, b] of quadrants(j)) if (a && b) { // kerb-return fillets
      const cx = qx * (ROAD_HALF + RETURN), cz = qz * (ROAD_HALF + RETURN), corner = v(qx * ROAD_HALF, qz * ROAD_HALF), pts: number[] = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8 * Math.PI / 2; pts.push(v(cx - qx * RETURN * Math.cos(t), cz - qz * RETURN * Math.sin(t))); }
      for (let k = 0; k < 8; k++) m.tri(corner, pts[k] ?? corner, pts[k + 1] ?? corner);
    }
  }
  return m.geometry();
}
/** Each quadrant (qx, qz) with whether its x-arm and z-arm exist. */
function quadrants(j: RoadJunction): [1 | -1, 1 | -1, boolean, boolean][] {
  const out: [1 | -1, 1 | -1, boolean, boolean][] = [];
  for (const qx of [1, -1] as const) for (const qz of [1, -1] as const) out.push([qx, qz, qx > 0 ? j.arms.east : j.arms.west, qz > 0 ? j.arms.north : j.arms.south]);
  return out;
}

/** Kerbs along every segment (open at the turn-ins), round each junction, and the roundabouts' raised islands. */
function kerbs(layout: RoadLayout, home: GridCell): BufferGeometry {
  const m = new Mesher(), W = 0.25, H = 0.15, at = (p: { x: number; z: number }): { x: number; z: number } => ({ x: p.x - home.origin.x, z: p.z - home.origin.z });
  const kt = ROAD_HALF + W / 2;
  for (const segment of layout.segments) for (const [cell, t] of [[segment.low, -1], [segment.high, 1]] as const) {
    const runs: readonly (readonly [number, number])[] = cell === undefined ? [[-SEGMENT_HALF, SEGMENT_HALF]] : [[-SEGMENT_HALF, -TURN_IN_HALF], [TURN_IN_HALF, SEGMENT_HALF]];
    for (const [s0, s1] of runs) m.beam(at(segmentPoint(segment, s0, t * kt)), at(segmentPoint(segment, s1, t * kt)), 0, W, H, KERB);
    if (cell !== undefined) for (const s of [-TURN_IN_HALF, TURN_IN_HALF]) { // the turn-in's kerbs run out to the cell edge
      m.beam(at(segmentPoint(segment, s, t * kt)), at(segmentPoint(segment, s, t * (GAP_HALF - 0.5))), 0, W, H, KERB);
    }
  }
  const polyline = (o: { x: number; z: number }, pts: readonly { x: number; z: number }[]): void => {
    for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k]; if (a !== undefined && b !== undefined) m.beam({ x: o.x + a.x, z: o.z + a.z }, { x: o.x + b.x, z: o.z + b.z }, 0, W, H, KERB); }
  };
  const arcPts = (cx: number, cz: number, r: number, a0: number, a1: number, n: number): { x: number; z: number }[] => Array.from({ length: n + 1 }, (_, k) => {
    const a = a0 + (a1 - a0) * k / n; return { x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r };
  });
  for (const j of layout.junctions) {
    const o = at(j.centre);
    for (const [qx, qz, ex, ez] of quadrants(j)) {
      if (j.roundabout) { // the ring's outer kerb between two arms, and each arm's edge out to the corridor
        const r = RING_OUTER + W / 2, a = Math.asin(kt / r), base = Math.atan2(qz, qx) - Math.PI / 4;
        polyline(o, arcPts(0, 0, r, base + a, base + Math.PI / 2 - a, 10));
        const reach = Math.sqrt(r * r - kt * kt);
        polyline(o, [{ x: qx * reach, z: qz * kt }, { x: qx * GAP_HALF, z: qz * kt }]);
        polyline(o, [{ x: qx * kt, z: qz * reach }, { x: qx * kt, z: qz * GAP_HALF }]);
      } else if (ex && ez) { // a kerb return
        const cx = qx * (ROAD_HALF + RETURN), cz = qz * (ROAD_HALF + RETURN), r = RETURN - W / 2, a0 = Math.atan2(-qz, 0), a1 = Math.atan2(0, -qx);
        let turn = a1 - a0; if (turn > Math.PI) turn -= 2 * Math.PI; if (turn < -Math.PI) turn += 2 * Math.PI;
        polyline(o, [{ x: qx * GAP_HALF, z: qz * kt }, ...arcPts(cx, cz, r, a0, a0 + turn, 8), { x: qx * kt, z: qz * GAP_HALF }]);
      } else if (ex) polyline(o, [{ x: 0, z: qz * kt }, { x: qx * GAP_HALF, z: qz * kt }]);
      else if (ez) polyline(o, [{ x: qx * kt, z: 0 }, { x: qx * kt, z: qz * GAP_HALF }]);
      else polyline(o, [{ x: qx * kt, z: 0 }, { x: qx * kt, z: qz * kt }, { x: 0, z: qz * kt }]);
    }
    if (j.roundabout) { // the island: a kerb ring and a planted top
      const ring = arcPts(0, 0, RING_ISLAND - W / 2, 0, Math.PI * 2, 32);
      polyline(o, ring);
      const centre = m.vertex(o.x, H * 1.2, o.z, 0, 1, 0, 0, 0, ISLAND), rim = ring.map((p) => m.vertex(o.x + p.x, H, o.z + p.z, 0, 1, 0, 0, 0, ISLAND));
      for (let k = 0; k < rim.length - 1; k++) m.tri(centre, rim[k] ?? centre, rim[k + 1] ?? centre);
    }
  }
  return m.geometry(true);
}

/** Streetlights: an instanced pole + arm and an instanced lamp head. */
function streetlights(layout: RoadLayout, home: GridCell): { poles: InstancedMesh; heads: InstancedMesh } {
  const pole = new Mesher(), head = new Mesher(), grey = new Color(0x5d6166);
  const HEIGHT = 8.2, REACH = 1.9;
  // a square-section pole (cheap), an arm toward +x, the head under the arm's tip
  pole.beam({ x: -0.07, z: 0 }, { x: 0.07, z: 0 }, 0, 0.14, HEIGHT, grey);
  pole.beam({ x: 0, z: 0 }, { x: REACH, z: 0 }, HEIGHT - 0.12, 0.09, 0.09, grey);
  head.beam({ x: REACH - 0.45, z: 0 }, { x: REACH + 0.15, z: 0 }, HEIGHT - 0.24, 0.26, 0.14, new Color(1, 1, 1));
  const poles = new InstancedMesh(pole.geometry(true), new MeshLambertMaterial({ vertexColors: true }), layout.lights.length);
  const heads = new InstancedMesh(head.geometry(), new MeshBasicMaterial({ color: 0xfff0c8 }), layout.lights.length);
  const matrix = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), pos = new Vector3(), one = new Vector3(1, 1, 1);
  layout.lights.forEach((light, k) => {
    q.setFromAxisAngle(up, Math.atan2(-light.reach.z, light.reach.x));
    matrix.compose(pos.set(light.at.x - home.origin.x, 0, light.at.z - home.origin.z), q, one);
    poles.setMatrixAt(k, matrix); heads.setMatrixAt(k, matrix);
  });
  for (const mesh of [poles, heads]) { mesh.instanceMatrix.setUsage(DynamicDrawUsage); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.castShadow = false; mesh.receiveShadow = false; }
  poles.name = 'grid-streetlights'; heads.name = 'grid-streetlight-heads';
  return { poles, heads };
}

/** Sign text atlas: one cell per unique line (white on sign green), plus green / grey / white swatches for boards and posts. */
const LINE_W = 512, LINE_H = 64;
function lineKey(line: SignLine): string { return `${line.arrow}|${line.names.join(' · ')}|${String(line.metres)}`; }
function signAtlas(signs: readonly RoadSign[]): { texture: CanvasTexture; cell: (line: SignLine) => readonly [number, number, number, number]; swatch: Readonly<Record<'green' | 'grey' | 'white', readonly [number, number]>> } {
  const keys = [...new Set(signs.flatMap((s) => s.lines.map(lineKey)))], lines = new Map<string, SignLine>();
  for (const s of signs) for (const l of s.lines) lines.set(lineKey(l), l);
  const W = 1024, perRow = W / LINE_W, rows = Math.ceil((keys.length + 1) / perRow), H = 2 ** Math.ceil(Math.log2(Math.max(64, rows * LINE_H)));
  const { el, g } = canvas(W, H);
  g.fillStyle = SIGN_GREEN; g.fillRect(0, 0, W, H);
  const slot = (k: number): [number, number] => [(k % perRow) * LINE_W, Math.floor(k / perRow) * LINE_H];
  keys.forEach((key, k) => {
    const line = lines.get(key); if (line === undefined) return;
    const [x, y] = slot(k), mid = y + LINE_H / 2;
    g.fillStyle = WHITE; g.strokeStyle = WHITE; g.lineWidth = 6;
    const ax = line.arrow === 'right' ? x + LINE_W - 40 : x + 28; // the arrow: left / right at that edge, ahead on the left
    g.beginPath();
    if (line.arrow === 'ahead') { g.moveTo(ax, mid + 18); g.lineTo(ax, mid - 14); g.moveTo(ax - 12, mid - 4); g.lineTo(ax, mid - 18); g.lineTo(ax + 12, mid - 4); }
    else { const s = line.arrow === 'left' ? -1 : 1; g.moveTo(ax - s * 16, mid); g.lineTo(ax + s * 16, mid); g.moveTo(ax + s * 4, mid - 12); g.lineTo(ax + s * 18, mid); g.lineTo(ax + s * 4, mid + 12); }
    g.stroke();
    const text = line.names.join(' · ').toUpperCase(), dist = `${String(line.metres)} M`, left = line.arrow === 'right' ? x + 18 : x + 64, right = line.arrow === 'right' ? x + LINE_W - 72 : x + LINE_W - 18;
    g.font = '600 34px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle';
    const dw = g.measureText(dist).width, room = right - left - dw - 22, tw = g.measureText(text).width;
    g.save(); g.translate(left, mid); g.scale(Math.min(1, room / Math.max(1, tw)), 1); g.textAlign = 'left'; g.fillText(text, 0, 2); g.restore();
    g.textAlign = 'right'; g.fillText(dist, right, 2);
  });
  const [sx, sy] = slot(keys.length); // swatches in the last cell
  g.fillStyle = '#6f7378'; g.fillRect(sx + 64, sy, 64, LINE_H); g.fillStyle = WHITE; g.fillRect(sx + 128, sy, 64, LINE_H);
  const uv = (px: number, py: number): readonly [number, number] => [px / W, 1 - py / H];
  const index = new Map(keys.map((k, i) => [k, i]));
  return {
    texture: texture(el, false),
    cell: (line) => { const [x, y] = slot(index.get(lineKey(line)) ?? 0); return [x / W, 1 - (y + LINE_H) / H, (x + LINE_W) / W, 1 - y / H]; },
    swatch: { green: uv(sx + 32, sy + LINE_H / 2), grey: uv(sx + 96, sy + LINE_H / 2), white: uv(sx + 160, sy + LINE_H / 2) },
  };
}
/** Every sign: two posts, a white-rimmed green board, a quad per line on its face. One mesh, one material. */
function signMesh(signs: readonly RoadSign[], home: GridCell): Mesh {
  const atlas = signAtlas(signs), m = new Mesher(), BOARD_W = 3.6, LINE = 0.42, BOTTOM = 2.3;
  for (const sign of signs) {
    const fx = sign.facing.x, fz = sign.facing.z, rx = -fz, rz = fx; // the board's right (seen from the front: facing toward the viewer)
    const ox = sign.at.x - home.origin.x, oz = sign.at.z - home.origin.z, h = sign.lines.length * LINE + 0.3, top = BOTTOM + h;
    for (const side of [-1, 1]) {
      const px = ox + rx * side * (BOARD_W / 2 - 0.4), pz = oz + rz * side * (BOARD_W / 2 - 0.4);
      m.beam({ x: px - fx * 0.05, z: pz - fz * 0.05 }, { x: px + fx * 0.05, z: pz + fz * 0.05 }, 0, 0.1, top, new Color(1, 1, 1), atlas.swatch.grey);
    }
    const panel = (w: number, y0: number, y1: number, ahead: number, uvRect: readonly [number, number, number, number] | readonly [number, number], back = false): void => {
      const n = back ? -1 : 1, cx = ox + fx * ahead * n, cz = oz + fz * ahead * n, hw = w / 2 * n;
      const [u0, v0, u1, v1] = uvRect.length === 4 ? uvRect : [uvRect[0], uvRect[1], uvRect[0], uvRect[1]];
      const a = m.vertex(cx - rx * hw, y0, cz - rz * hw, fx * n, 0, fz * n, u0, v0), b = m.vertex(cx + rx * hw, y0, cz + rz * hw, fx * n, 0, fz * n, u1, v0);
      const c = m.vertex(cx + rx * hw, y1, cz + rz * hw, fx * n, 0, fz * n, u1, v1), d = m.vertex(cx - rx * hw, y1, cz - rz * hw, fx * n, 0, fz * n, u0, v1);
      m.quad(a, b, c, d);
    };
    panel(BOARD_W + 0.12, BOTTOM - 0.06, top + 0.06, 0.06, atlas.swatch.white);
    panel(BOARD_W, BOTTOM, top, 0.07, atlas.swatch.green);
    panel(BOARD_W + 0.12, BOTTOM - 0.06, top + 0.06, -0.06, atlas.swatch.grey, true);
    sign.lines.forEach((line, k) => { const y1 = top - 0.15 - k * LINE; panel(BOARD_W - 0.2, y1 - LINE, y1, 0.08, atlas.cell(line)); });
  }
  const mesh = new Mesh(m.geometry(), new MeshLambertMaterial({ map: atlas.texture }));
  mesh.name = 'grid-signs';
  return mesh;
}

/** Draw the boulevard; everything is disposed with the scope. */
export function installRoadLook(input: RoadLookInput): RoadLookState {
  const { layout, home, scene, scope } = input, group = new Group();
  group.name = 'grid-boulevard';
  const overlay = (geometry: BufferGeometry, map: CanvasTexture, name: string): Mesh => {
    const mesh = new Mesh(geometry, new MeshLambertMaterial({ map, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mesh.name = name; mesh.receiveShadow = true; return mesh;
  };
  const road = overlay(asphalt(layout, home), roadTexture(), 'grid-asphalt');
  const junctions = overlay(junctionAsphalt(layout, home), junctionTexture(), 'grid-junctions');
  const kerb = new Mesh(kerbs(layout, home), new MeshLambertMaterial({ vertexColors: true }));
  kerb.name = 'grid-kerbs'; kerb.receiveShadow = true;
  const { poles, heads } = streetlights(layout, home);
  const signs = signMesh(layout.signs, home);
  const meshes: Mesh[] = [road, junctions, kerb, poles, heads, signs];
  for (const mesh of meshes) { mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); input.tag?.(mesh); group.add(mesh); }
  scene.add(group);
  scope.onDispose(() => {
    group.removeFromParent();
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      const material = mesh.material;
      for (const mat of Array.isArray(material) ? material : [material]) {
        if (mat instanceof MeshLambertMaterial) mat.map?.dispose();
        mat.dispose();
      }
    }
  });
  return { segments: layout.segments.length, junctions: layout.junctions.length, roundabouts: layout.junctions.filter((j) => j.roundabout).length, signs: layout.signs.length, lights: layout.lights.length, draws: meshes.length };
}
