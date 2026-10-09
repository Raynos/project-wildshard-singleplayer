/**
 * The trophy plaques (E314, project/archive/2026-09-30-driftwood-loot.md, Jake's pick board 4 A): two shield-shaped wooden plaques for
 * the back wall of Wendell's hut — the bear's plaque holds a hooked bear claw, the boar's a curved ivory tusk. An empty
 * plaque reads as "a fight is still out there": a bare mounting peg and the beast's print burnt into the wood (a bear's
 * paw, a boar's cloven hoof) where its trophy will hang. The Drowned Captain's hat is worn, not hung (board 4 C).
 *
 * One mesh, one draw on the island's shared low-poly material: both plaques, both prints and both trophies are in the
 * geometry and `setFilled(id, filled)` swaps a print for its trophy (src/engine/models/slots.ts: an index rewrite, no allocation,
 * only when a trophy is won). The claw and the tusk are swept along parallel-transport frames with a tapering round
 * section, darker at the root and pale at the tip.
 *
 * Own space: the wall is the plane z = 0 and the plaques stand out of it toward +z (their front); x along the wall, the
 * bear's plaque at −x, the boar's at +x (`gap` apart, centre to centre); y = 0 is the plaques' bottom points. No
 * colliders: they are ~6 cm deep on a wall.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext } from '@wildshard/engine/models/model';
import { SlotGeometry, SlotRecorder } from '@wildshard/engine/models/slots';
import { log, rock, tris } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';

export type TrophyId = 'bear' | 'boar';
export const TROPHIES: readonly TrophyId[] = ['bear', 'boar'];

/** the plaques' default spacing, centre to centre (m) */
export const PLAQUE_GAP = 0.8;
/** the plaque: width, height, board thickness */
const PW = 0.34, PH = 0.43, PT = 0.03;
/** where a trophy hangs on its plaque (the peg), from the plaque's bottom point */
const MOUNT_Y = 0.235;
/** the panel's front face (the prints sit on it, the trophies stand off it) */
const FRONT = PT + 0.018;

const C = {
  plaque: '#6a4429', plaqueEdge: '#553520', panel: '#8c5e38', peg: '#4a3222', burn: '#35251a', nail: '#3a3c42',
  clawRoot: '#5c4231', claw: '#2f2621', clawTip: '#d9cdb2', fur: '#4d3626', wrap: '#8a5a34',
  tuskRoot: '#b99b68', tusk: '#ece2c8', tuskTip: '#faf5e6', binding: '#5a3a24',
};

/** the shield outline, bottom point at the origin */
function shieldShape(s = 1, cy = 0): THREE.Shape {
  const w = (PW / 2) * s, h = PH * s, o = PH * 0.52 * (1 - s) + cy;
  const sh = new THREE.Shape();
  sh.moveTo(0, o);
  sh.quadraticCurveTo(w * 0.95, o + h * 0.12, w, o + h * 0.62);
  sh.lineTo(w, o + h * 0.86);
  sh.quadraticCurveTo(w * 0.62, o + h * 1.02, w * 0.3, o + h * 0.93);
  sh.quadraticCurveTo(0, o + h * 1.06, -w * 0.3, o + h * 0.93);
  sh.quadraticCurveTo(-w * 0.62, o + h * 1.02, -w, o + h * 0.86);
  sh.lineTo(-w, o + h * 0.62);
  sh.quadraticCurveTo(-w * 0.95, o + h * 0.12, 0, o);
  return sh;
}

/**
 * a tapering round sweep along `path` (parallel-transport frames, so the section never flips), each segment painted
 * `colour(t)`; the root end is capped, the tip closes to the path's last point when `radius(1)` is 0
 */
function sweep(kit: LowPolyKit, path: readonly THREE.Vector3[], radius: (t: number) => number, sides: number, colour: (t: number) => string): void {
  const n = path.length;
  const tangents = path.map((p, i) => new THREE.Vector3().subVectors(path[Math.min(n - 1, i + 1)] ?? p, path[Math.max(0, i - 1)] ?? p).normalize());
  const t0 = tangents[0] ?? new THREE.Vector3(0, 1, 0);
  let normal = new THREE.Vector3(0, 0, 1).cross(t0);
  if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(1, 0, 0).cross(t0);
  normal.normalize();
  const q = new THREE.Quaternion(), b = new THREE.Vector3();
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i < n; i++) {
    const t = tangents[i], p = path[i];
    if (t === undefined || p === undefined) continue;
    const prev = tangents[i - 1];
    if (prev !== undefined) normal.applyQuaternion(q.setFromUnitVectors(prev, t)).normalize();
    b.crossVectors(t, normal);
    const r = radius(i / (n - 1));
    const ring: THREE.Vector3[] = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      ring.push(p.clone().addScaledVector(normal, Math.cos(a) * r).addScaledVector(b, Math.sin(a) * r));
    }
    rings.push(ring);
  }
  const push = (out: number[], ...vs: THREE.Vector3[]): void => { for (const v of vs) out.push(v.x, v.y, v.z); };
  for (let i = 0; i + 1 < rings.length; i++) {
    const r0 = rings[i], r1 = rings[i + 1];
    if (r0 === undefined || r1 === undefined) continue;
    const v: number[] = [];
    for (let k = 0; k < sides; k++) {
      const a = r0[k], bb = r0[(k + 1) % sides], c = r1[(k + 1) % sides], d = r1[k];
      if (a === undefined || bb === undefined || c === undefined || d === undefined) continue;
      push(v, a, bb, c, a, c, d);
    }
    kit.add(tris(v), colour((i + 0.5) / (rings.length - 1)), { jitter: 0.05 });
  }
  const root = rings[0], p0 = path[0];
  if (root !== undefined && p0 !== undefined) {
    const v: number[] = [];
    for (let k = 0; k < sides; k++) { const a = root[k], c = root[(k + 1) % sides]; if (a !== undefined && c !== undefined) push(v, p0, c, a); }
    kit.add(tris(v), colour(0), { jitter: 0.05 });
  }
}

/** points on an arc about (cx, cy) in the plaque's plane, from angle a0 to a1 (radians), the radius easing r0 → r1, z bulging */
function arc(cx: number, cy: number, a0: number, a1: number, r0: number, r1: number, z: number, bulge: number, steps: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = a0 + (a1 - a0) * t, r = r0 + (r1 - r0) * t;
    out.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z + Math.sin(Math.PI * t) * bulge));
  }
  return out;
}

/** a flat disc (a print in the wood) facing +z */
function dot(x: number, y: number, rx: number, ry: number, sides = 7): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(1, 1, 0.004, sides).rotateX(Math.PI / 2).scale(rx, ry, 1).translate(x, y, FRONT + 0.001);
}

/** the plaques' geometry: slot 0 the plaques, then per trophy [its empty print, the trophy] */
function plaquesGeometry(gap: number): { slots: SlotGeometry; empty: Record<TrophyId, number>; full: Record<TrophyId, number> } {
  const kit = new LowPolyKit(0x7a0f1e5);
  const rec = new SlotRecorder(kit);
  const xs: Record<TrophyId, number> = { bear: -gap / 2, boar: gap / 2 };
  const extrude = (shape: THREE.Shape, depth: number, bevel: number): THREE.ExtrudeGeometry => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });

  // ── slot 0: the two plaques (board, lighter inset panel, two nails) and their bare pegs ──
  for (const id of TROPHIES) {
    const x = xs[id];
    const board = extrude(shieldShape(), PT - 0.012, 0.006);
    board.translate(x, 0, 0.006);
    kit.add(board, C.plaque, { jitter: 0.05, wobble: 0.002 });
    const panel = extrude(shieldShape(0.8), 0.012, 0);
    panel.translate(x, 0, PT + 0.006);
    kit.add(panel, C.panel, { jitter: 0.07 });
    for (const nx of [-0.085, 0.085]) kit.add(dot(x + nx, PH * 0.84, 0.009, 0.009, 5), C.nail, { jitter: 0.02 });
    kit.add(log(new THREE.Vector3(x, MOUNT_Y, FRONT - 0.004), new THREE.Vector3(x, MOUNT_Y + 0.004, FRONT + 0.03), 0.016, 0.013, 6), C.peg);
  }
  rec.mark();

  const empty = { bear: 0, boar: 0 }, full = { bear: 0, boar: 0 };
  for (const id of TROPHIES) {
    const x = xs[id];
    if (id === 'bear') {
      // the empty plaque: a bear's paw print burnt round the peg (a broad pad, four toes)
      kit.add(dot(x, MOUNT_Y - 0.075, 0.048, 0.036), C.burn, { jitter: 0.03 });
      for (const [tx, ty] of [[-0.058, 0.02], [-0.021, 0.042], [0.021, 0.042], [0.058, 0.02]] as const) kit.add(dot(x + tx, MOUNT_Y + 0.045 + ty, 0.017, 0.021, 6), C.burn, { jitter: 0.03 });
      empty.bear = rec.mark();
      // the trophy: a hooked claw off the peg, curling over the top and down to the right, its root in a tuft of fur
      // bound with leather
      const path = arc(x + 0.015, MOUNT_Y + 0.01, Math.PI * 1.12, -0.3, 0.118, 0.095, FRONT + 0.04, 0.035, 14);
      sweep(kit, path, (t) => 0.046 * (1 - t) ** 0.7, 6, (t) => (t < 0.16 ? C.clawRoot : t > 0.72 ? C.clawTip : C.claw));
      const root = path[0];
      if (root !== undefined) {
        kit.add(rock(0.042, 0, kit.rng, 0.8, 0.3).translate(root.x - 0.006, root.y - 0.012, root.z - 0.008), C.fur, { jitter: 0.1 });
        kit.add(new THREE.TorusGeometry(0.036, 0.009, 4, 7).rotateX(Math.PI / 2).rotateZ(-0.5).translate(root.x + 0.012, root.y + 0.012, root.z), C.wrap, { jitter: 0.05 });
      }
      full.bear = rec.mark();
    } else {
      // the empty plaque: a boar's cloven hoof print (two long toes, two dew claws behind)
      for (const s of [-1, 1]) {
        kit.add(dot(x + s * 0.024, MOUNT_Y - 0.05, 0.02, 0.045, 7), C.burn, { jitter: 0.03 });
        kit.add(dot(x + s * 0.05, MOUNT_Y - 0.13, 0.009, 0.013, 5), C.burn, { jitter: 0.03 });
      }
      empty.boar = rec.mark();
      // the trophy: an ivory tusk curving up from the peg to a point at the top right, its yellowed root bound twice
      const path = arc(x + 0.005, MOUNT_Y + 0.13, Math.PI * 1.2, Math.PI * 2.08, 0.14, 0.125, FRONT + 0.03, 0.025, 12);
      sweep(kit, path, (t) => 0.004 + 0.03 * (1 - t) ** 0.7, 6, (t) => (t < 0.14 ? C.tuskRoot : t > 0.75 ? C.tuskTip : C.tusk));
      const [p0, p1] = path;
      if (p0 !== undefined && p1 !== undefined) {
        for (const f of [0.35, 1.1]) {
          const at = p0.clone().lerp(p1, f), dir = new THREE.Vector3().subVectors(p1, p0).normalize();
          const ring = new THREE.TorusGeometry(0.033, 0.006, 3, 7);
          ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)).translate(at.x, at.y, at.z);
          kit.add(ring, C.binding, { jitter: 0.04 });
        }
      }
      full.boar = rec.mark();
    }
  }
  return { slots: new SlotGeometry(kit.finish({ ao: false }), rec.ranges), empty, full };
}

/** the two plaques: one mesh; `setFilled(id, filled)` hangs a trophy or leaves its print */
export class TrophyPlaques extends THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  private readonly slots: SlotGeometry;
  private readonly empty: Record<TrophyId, number>;
  private readonly full: Record<TrophyId, number>;
  constructor(gap: number, material: THREE.Material, filled: Partial<Record<TrophyId, boolean>>) {
    const g = plaquesGeometry(gap);
    super(g.slots.geometry, material);
    this.slots = g.slots; this.empty = g.empty; this.full = g.full;
    this.name = 'trophy-plaques';
    this.castShadow = true;
    this.receiveShadow = true;
    for (const id of TROPHIES) this.setFilled(id, filled[id] ?? false);
  }
  /** is this trophy hung */
  filled(id: TrophyId): boolean { return this.slots.shown(this.full[id]); }
  /** hang the trophy (true) or leave the plaque empty with the beast's print (false) */
  setFilled(id: TrophyId, filled: boolean): void {
    this.slots.set(this.full[id], filled);
    this.slots.set(this.empty[id], !filled);
  }
  /** the trophy alone, no plaques or prints (the loose drop a kill leaves, src/shards/driftwood-isle/loot/keepsakes.ts) */
  trophyOnly(id: TrophyId): void {
    this.slots.set(0, false);
    for (const t of TROPHIES) { this.slots.set(this.empty[t], false); this.slots.set(this.full[t], t === id); }
  }
}

export function buildTrophyPlaques(ctx: ModelContext, filled: Partial<Record<TrophyId, boolean>> = {}, gap = PLAQUE_GAP): TrophyPlaques {
  return new TrophyPlaques(gap, lowPolyMaterial(ctx.sky), filled);
}

/**
 * a loose trophy (the bear's claw, the boar's tusk) as the drop a kill leaves: the plaques' own claw / tusk alone, centred
 * on its origin (it hangs off the peg in the plaques' space), facing +z. One mesh, one draw, the island's material.
 */
export function buildTrophy(ctx: ModelContext, id: TrophyId): THREE.Group {
  const m = new TrophyPlaques(0, lowPolyMaterial(ctx.sky), {});
  m.trophyOnly(id);
  m.position.set(0, -(MOUNT_Y + (id === 'boar' ? 0.13 : 0.01)), -FRONT - 0.04);
  const g = new THREE.Group();
  g.name = `trophy-${id}`;
  g.add(m);
  return g;
}


export interface TrophyPlaquesParams {
  readonly bear: boolean;
  readonly boar: boolean;
  /** centre to centre, metres */
  readonly gap: number;
}

export const trophyPlaques = defineModel<TrophyPlaquesParams>({
  id: 'driftwood-isle/trophy-plaques', name: 'Trophy plaques', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trophyPlaques.ts', surface: 'wood',
  defaults: { bear: true, boar: true, gap: PLAQUE_GAP },
  variants: [
    { id: 'both', label: 'Both', params: {} },
    { id: 'empty', label: 'Empty', params: { bear: false, boar: false } },
    { id: 'bear', label: 'Bear', params: { boar: false } },
    { id: 'boar', label: 'Boar', params: { bear: false } },
  ],
  build: (ctx, p) => buildTrophyPlaques(ctx, { bear: p.bear, boar: p.boar }, p.gap),
});
