import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { ColliderDesc } from '#engine';
import type { Isle, Span } from '../layout';
import type { IslandShape } from './islands';
import { box, Facets, type RGB, type V3 } from './facets';

/** Where a ray from the island's centre along (dx, dz) leaves its rim polygon (metres from the centre). */
export function rimDistance(shape: IslandShape, dx: number, dz: number): number {
  let best = 0;
  for (let i = 0; i < shape.rim.length; i++) {
    const a = shape.rim[i], b = shape.rim[(i + 1) % shape.rim.length]; if (!a || !b) continue;
    const ax = a[0] - shape.cx, az = a[1] - shape.cz, ex = b[0] - a[0], ez = b[1] - a[1];
    const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ez - az * ex) / den, u = (ax * dz - az * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
  }
  return best;
}

/** A span's frame: origin at the near end, +z along the deck to the far end (pitched), and its length. */
export interface Frame { origin: Vector3; quat: Quaternion; length: number; matrix: Matrix4; applyTo: (p: [number, number, number]) => V3 }
export function spanFrame(span: Span, shapes: ReadonlyMap<string, IslandShape>, mode: 'rope' | 'hover'): Frame {
  const a = span.from, b = span.to, dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const sa = shapes.get(a.id), sb = shapes.get(b.id);
  const ra = sa ? rimDistance(sa, ux, uz) : a.r, rb = sb ? rimDistance(sb, -ux, -uz) : b.r;
  // a rope deck reaches 0.8 m onto each island; a hover deck starts clear of the rim and its mossy lip (E364 board)
  const ea = mode === 'rope' ? ra - 0.8 : ra * 1.05 + 0.25, eb = mode === 'rope' ? rb - 0.8 : rb * 1.05 + 0.25;
  const p0 = new Vector3(a.x + ux * ea, a.top, a.z + uz * ea), p1 = new Vector3(b.x - ux * eb, b.top, b.z - uz * eb);
  const flat = Math.hypot(p1.x - p0.x, p1.z - p0.z), rise = p1.y - p0.y;
  const quat = new Quaternion().setFromEuler(new Euler(-Math.atan2(rise, flat), Math.atan2(ux, uz), 0, 'YXZ'));
  const matrix = new Matrix4().compose(p0, quat, new Vector3(1, 1, 1));
  return { origin: p0, quat, length: Math.hypot(flat, rise), matrix,
    applyTo: ([x, y, z]) => { const v = new Vector3(x, y, z).applyMatrix4(matrix); return [v.x, v.y, v.z]; } };
}
const LOCAL = { applyTo: (p: [number, number, number]): V3 => p };

/** A world-space box collider from a box in the span's frame. */
export function frameBox(frame: Frame, c: V3, hx: number, hy: number, hz: number, surface: 'planks' | 'stone'): ColliderDesc {
  const at = new Vector3(...c).applyMatrix4(frame.matrix), q = frame.quat;
  return { kind: 'box', x: at.x, y: at.y, z: at.z, hx, hy, hz, rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface };
}

const PLANK: RGB = [0.5, 0.33, 0.2], PLANK_B: RGB = [0.42, 0.27, 0.16], POST: RGB = [0.3, 0.2, 0.14], ROPE: RGB = [0.62, 0.5, 0.33];
/** A rope bridge in its own frame (draw it under a group posed at the frame): planks, end posts, sagging rope rails. */
export function ropeBridge(width: number, length: number): Facets {
  const f = new Facets(0.08), hw = width / 2;
  for (let z = 0.25, n = 0; z < length; z += 0.55, n++) box(f, LOCAL, [0, -0.05, z], hw, 0.05, 0.22, n % 2 ? PLANK : PLANK_B, POST);
  for (const s of [-1, 1]) {
    box(f, LOCAL, [s * hw * 0.55, -0.12, length / 2], 0.06, 0.04, length / 2, POST);
    for (const z of [0.1, length - 0.1]) box(f, LOCAL, [s * (hw + 0.1), 0.6, z], 0.09, 0.75, 0.09, POST);
    const sag = (t: number): number => 1.15 - Math.sin(t * Math.PI) * 0.35, steps = Math.max(4, Math.round(length / 1.5));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps, z0 = t0 * length, z1 = t1 * length, y0 = sag(t0), y1 = sag(t1);
      const len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0), cz = (z0 + z1) / 2, cy = (y0 + y1) / 2;
      const m = { applyTo: ([x, y, z]: [number, number, number]): V3 => { const dz = z - cz, dy = y - cy; return [x, cy + dy * Math.cos(ang) + dz * Math.sin(ang), cz + dz * Math.cos(ang) - dy * Math.sin(ang)]; } };
      box(f, m, [s * (hw + 0.1), cy, cz], 0.035, 0.035, len / 2, ROPE);
      box(f, LOCAL, [s * (hw + 0.05), y0 / 2, z0], 0.02, y0 / 2, 0.02, ROPE);
    }
  }
  return f;
}
/** The colliders of a rope bridge: its deck and two waist-high rails, so a walker stays on it. */
export function ropeColliders(frame: Frame, width: number): ColliderDesc[] {
  const hw = width / 2, half = frame.length / 2;
  return [frameBox(frame, [0, -0.08, half], hw + 0.15, 0.08, half, 'planks'),
    frameBox(frame, [-(hw + 0.12), 0.6, half], 0.06, 0.6, half, 'planks'), frameBox(frame, [hw + 0.12, 0.6, half], 0.06, 0.6, half, 'planks')];
}

/** A hover bridge's frame and rungs (the glass and the glow are separate materials, built by the caller). */
export function hoverRungs(width: number, length: number): Facets {
  const f = new Facets(0.02), hw = width / 2;
  for (let z = 1; z < length - 0.5; z += 2) box(f, LOCAL, [0, -0.02, z], hw, 0.04, 0.08, [0.85, 0.95, 1]);
  return f;
}
export function hoverEdges(width: number, length: number): Facets {
  const f = new Facets(0.02), hw = width / 2;
  for (const s of [-1, 1]) box(f, LOCAL, [s * hw, 0, length / 2], 0.06, 0.06, length / 2, [1, 0.78, 0.4]);
  return f;
}
/** Two pylons with crystals at each end, standing on the islands just inside their rims. */
export function pylons(frame: Frame, width: number, from: Isle, to: Isle): { posts: Facets; crystals: Facets } {
  const posts = new Facets(0.05), crystals = new Facets(0.02), hw = width / 2 + 0.45;
  for (const [z, isle] of [[-1.1, from], [frame.length + 1.1, to]] as const) {
    for (const s of [-1, 1]) {
      const base = frame.applyTo([s * hw, 0, z]), m = { applyTo: ([x, y, zz]: [number, number, number]): V3 => [x, y, zz] };
      const y0 = isle.top;
      box(posts, m, [base[0], y0 + 0.9, base[2]], 0.16, 0.9, 0.16, [0.24, 0.22, 0.26]);
      const c: V3 = [base[0], y0 + 2.2, base[2]], r = 0.32;
      const pts: V3[] = [[c[0] + r, c[1], c[2]], [c[0], c[1], c[2] + r], [c[0] - r, c[1], c[2]], [c[0], c[1], c[2] - r]];
      for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4]; if (!a || !b) continue;
        crystals.tri([c[0], c[1] + r * 1.6, c[2]], b, a, [0.75, 0.95, 1]); crystals.tri([c[0], c[1] - r * 1.4, c[2]], a, b, [0.5, 0.8, 1]); }
    }
  }
  return { posts, crystals };
}
