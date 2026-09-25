/**
 * Wreck — the two-master in Wreck Cove (Driftwood Isle, remaster M2 / D6): heeled toward the beach and half sunk on the
 * reef, stern in the water, bow run up the sand. Lapstrake hull planked strake by strake with the ribs showing where the
 * planks are stove in, a broken midships deck open to the sky, a leaning mainmast with a crow's nest, a torn sail and
 * ratlined shrouds, a snapped foremast. A **hull breach** on the beach side (starboard) opens into the **hold** — a level
 * plank floor you walk in on (a fallen hatch cover is the ramp from the shallows), barrels, crates, a net, a weapon rack,
 * a stair up to the bow deck and three lanterns whose warm light is baked into the vertex colours (no runtime lights).
 * Around it: driftwood-log piles, barrels, crates, a net, rope coils, reef rocks with mossy tops, planks in the shallows.
 *
 * Two draws: the hull + everything (one LowPolyKit mesh on `lowPolyMaterial`, voxel AO + baked lantern light) and the
 * lantern flames (unlit, HDR vertex colour for the bloom).
 *
 *   const wreck = new Wreck(sky, WRECK).build();
 *   scene.add(wreck.group); player.colliders.push(...wreck.colliders);
 *   player.platforms.push((x, z) => wreck.floorHeightAt(x, z));   // hold floor, ramp, stair, bow deck, quarterdeck
 *
 * Frames: hull local x = starboard, z = stern, y up; world = spec origin + R_y(heading) · local (the frame Enemies.ts,
 * IronSword.ts and the adventure's fallbacks use). The hold floor sits at y = `floorY` at the origin, level across (no
 * roll) and pitched with the hull (`pitch`, stern down); the hull itself also carries the `roll` (negative = heeled to
 * starboard, toward the beach).
 *
 * `anchors` (world coords, y = the floor there, yaw = world facing, 0 = +Z) — for the adventure / sound agents:
 *   holdDoor   the breach sill, facing out of the hull (a 1.4 × 1.9 grate fits the opening)
 *   holdFloor  the middle of the hold floor
 *   leverA     port side aft (the bilge pump), facing into the hold
 *   leverB     starboard side aft (the cargo winch), facing into the hold
 *   strongbox  the aft end, centre, facing forward (toward the breach)
 *   swordRack  the weapon rack on the port wall, opposite the breach, facing into the hold; its pegs are 1.05 m up
 * `holdBounds` = { x, z, r, yMin, yMax } — a cylinder around the hold (the hold reverb zone).
 */
import * as THREE from 'three';
import { heightAt } from './Heightfield';
import { SEED } from '../core/config';
import { LowPolyKit, log, beam, plank, rock, rope, sagLine, tris, bakeLight, lowPolyMaterial, type BakedLight } from './lowpolyKit';
import { swayDepthMaterial } from './wind';
import { rockGeometry, rockMaterial, REEF_ROCK } from './rockKit';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';
import { boxDesc, type ColliderDesc } from './registry';
import { addDriftLog, DRIFT } from './driftwood';

/** a world-height plane over the hull-aligned horizontal local (lx, lz): y = a + bx·lx + bz·lz */
interface Plane { a: number; bx: number; bz: number }
/** half the thickness of a floor slab (m) */
const SLAB = 0.15;

export interface WreckSpec {
  x: number; z: number; heading: number;
  /** radians of heel (negative = starboard down, the deck tilted toward the beach) */
  roll?: number;
  /** radians of trim (positive = stern down) */
  pitch?: number;
  /** world y of the hold floor at the origin (default: 0.4 m over the terrain there) */
  floorY?: number;
}
export interface WreckAnchor { x: number; y: number; z: number; yaw: number }
export interface HoldBounds { x: number; z: number; r: number; yMin: number; yMax: number }

const C = {
  hull: '#6f5339', hullB: '#7d5f41', hullDark: '#4b3727', hullGrey: '#8b7d68', wale: '#3f2e21', rib: '#4f3a27',
  weed: '#4e6b37', weedDark: '#3a5230', moss: '#6f9a3e', mossLight: '#8ab44c', barnacle: '#a8a08a',
  deck: '#9a7a52', deckB: '#8a6b47', rail: '#5d442e', mast: '#5a4230', sail: '#e3d9c1', sailB: '#cdbf9f', sailStain: '#b3a585',
  rope: '#b99d6c', ropeDark: '#8d7650', barrel: '#8a5a34', barrelB: '#76492a', band: '#3b3b3f', crate: '#a47b4b', crateB: '#8b6538',
  driftDark: '#a39277', net: '#8c7650',
  rock: '#4f545c', rockB: '#454a52', rockDark: '#383c43', brass: '#b08a3a', iron: '#3a3c42', floor: '#7f6444', floorB: '#6c5439',
  door: '#4a3526', flame: '#ffc46a',
};

// hull dimensions (local metres)
const L = 19, W = 2.95, KEEL = -1.1, N = 18, ROWS = 9;
const HOLD_Z0 = -4.2, HOLD_Z1 = 5.3;                 // the hold: the forward and aft bulkheads
const BREACH_Z0 = -2.5, BREACH_Z1 = -0.3, BREACH_Y0 = 0.3, BREACH_Y1 = 2.3;   // starboard, hull frame
const BOW_DECK = 2.6, QUARTER_DECK = 2.75, BEAM_Y = 2.45;
const STAIR = { x0: -1.45, x1: -0.55, z0: -1.5, z1: -4.2 };  // floor frame: foot at z0, top (bow-deck level) at z1
const RAMP = 2.2;                                    // m the hatch-cover ramp runs out from the breach sill

const tOf = (z: number): number => (z + L / 2) / L;
const zOf = (t: number): number => -L / 2 + t * L;
function halfBeam(t: number): number {
  if (t < 0.35) return Math.max(0.06, W * Math.sin((t / 0.35) * Math.PI / 2) ** 0.62);
  return W * (1 - 0.24 * ((t - 0.35) / 0.65) ** 2);
}
function topOf(t: number): number { return 2.75 + 0.9 * Math.max(0, (0.3 - t) / 0.3) ** 2 + 0.85 * Math.max(0, (t - 0.72) / 0.28) ** 1.5; }
function keelOf(t: number): number { return KEEL + 2.6 * Math.max(0, (0.16 - t) / 0.16) ** 2; }
/** the outer hull surface in the hull frame: t bow → stern, u gunwale (0) → keel (1) */
function hullPt(t: number, u: number, side: number): THREE.Vector3 {
  const top = topOf(t), k = keelOf(t);
  const w = Math.max(0.05, halfBeam(t) * Math.max(0, 1 - u ** 2.4) ** 0.5);
  return new THREE.Vector3(side * w, top - (top - k) * u, zOf(t));
}
/** hull half-width at hull-frame height y (0 above the gunwale / below the keel) */
function halfWidthAt(t: number, y: number): number {
  const top = topOf(t), k = keelOf(t);
  if (y > top || y < k) return 0;
  const u = (top - y) / (top - k);
  return halfBeam(t) * Math.max(0, 1 - u ** 2.4) ** 0.5;
}

export class Wreck {
  group = new THREE.Group();
  mesh!: THREE.Mesh;
  glow!: THREE.Mesh;
  colliders: Collider[] = [];
  anchors: Record<string, WreckAnchor> = {};
  holdBounds: HoldBounds = { x: 0, z: 0, r: 0, yMin: 0, yMax: 0 };

  private roll: number;
  private pitch: number;
  private floorY: number;
  /** floor frame (no roll) and hull frame (with roll) → world */
  private mf = new THREE.Matrix4();
  private mh = new THREE.Matrix4();
  private cs: number;
  private sn: number;
  /** floor half-widths (floor frame) per 0.25 m of z across the hold: [port, starboard] */
  private floorW: [number, number][] = [];
  /** world heights of the two deck planes: y = a + bx·lx + bz·lz over hull-aligned local x / z */
  private bowPlane = { a: 0, bx: 0, bz: 0 };
  private quarterPlane = { a: 0, bx: 0, bz: 0 };
  private floorPlane = { a: 0, bx: 0, bz: 0 };
  /** the breach ramp: from the floor's starboard edge (floor-frame x) out `rampLen` m, down to `rampGround` (relative to the floor) */
  private rampLen = 0;
  private rampX0 = 0;
  private rampGround = 0;

  constructor(private sky: Sky, private spec: WreckSpec) {
    this.roll = spec.roll ?? -0.2;
    this.pitch = spec.pitch ?? 0.05;
    this.floorY = spec.floorY ?? heightAt(spec.x, spec.z) + 0.4;
    this.cs = Math.cos(spec.heading); this.sn = Math.sin(spec.heading);
    const pos = new THREE.Vector3(spec.x, this.floorY, spec.z), one = new THREE.Vector3(1, 1, 1);
    this.mf.compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, spec.heading, 0, 'YXZ')), one);
    this.mh.compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, spec.heading, this.roll, 'YXZ')), one);
  }

  /** hull-frame point → world */
  private H(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).applyMatrix4(this.mh); }
  /** floor-frame point → world */
  private F(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).applyMatrix4(this.mf); }
  /** world (x, z) → hull-aligned horizontal local (x, z) (heading only) */
  private local(x: number, z: number): [number, number] {
    const dx = x - this.spec.x, dz = z - this.spec.z;
    return [dx * this.cs - dz * this.sn, dx * this.sn + dz * this.cs];
  }
  /** fit y = a + bx·lx + bz·lz through three world points given in a frame */
  private plane(p: THREE.Vector3[]): { a: number; bx: number; bz: number } {
    const q = p.map((v) => { const [lx, lz] = this.local(v.x, v.z); return [lx, v.y, lz] as const; });
    const [a0, a1, a2] = q;
    if (a0 === undefined || a1 === undefined || a2 === undefined) return { a: 0, bx: 0, bz: 0 };
    // solve [lx lz 1] · [bx bz a] = y
    const m = new THREE.Matrix3().set(a0[0], a0[2], 1, a1[0], a1[2], 1, a2[0], a2[2], 1).invert();
    const v = new THREE.Vector3(a0[1], a1[1], a2[1]).applyMatrix3(m);
    return { bx: v.x, bz: v.y, a: v.z };
  }
  private floorHalf(z: number): [number, number] {
    const i = Math.round((z - HOLD_Z0) / 0.25);
    return this.floorW[Math.max(0, Math.min(this.floorW.length - 1, i))] ?? [1.5, 1.5];
  }

  build(): this {
    const kit = new LowPolyKit(SEED ^ 0x3ec4);
    const rng = kit.rng;
    const glow = new LowPolyKit(SEED ^ 0x3ec5);
    const lamps: BakedLight[] = [];
    const mh = this.mh, mf = this.mf;
    const sea = 0.8;
    const cr = Math.cos(this.roll), sr = Math.sin(this.roll);

    // floor half-widths: the level floor meets the rolled hull (hull-frame y = −x·sin(roll))
    for (let z = HOLD_Z0; z <= HOLD_Z1 + 1e-6; z += 0.25) {
      const t = tOf(z), wOf = (side: number): number => {
        let x = 0;
        while (x < 3.5 && Math.abs(x * cr) < halfWidthAt(t, -side * x * sr) - 0.12) x += 0.02;
        return x;
      };
      this.floorW.push([wOf(-1), wOf(1)]);
    }

    // ── the hull: lapstrake planks between stations, holes stove in (the breach, a port-quarter hole, a bow gash) ──
    const inBreach = (z: number, y: number, side: number): boolean => side > 0 && z > BREACH_Z0 && z < BREACH_Z1 && y > BREACH_Y0 && y < BREACH_Y1;
    const tint = new THREE.Color(), cA = new THREE.Color();
    const plankCol = (r: number, mid: THREE.Vector3): THREE.Color => {
      const wy = mid.clone().applyMatrix4(mh).y;
      const base = r === 0 ? C.wale : rng.next() < 0.2 ? C.hullGrey : rng.next() < 0.5 ? C.hull : C.hullB;
      tint.set(base);
      // the weed / barnacle band at the water line, darker below it
      if (wy < sea + 0.9) tint.lerp(cA.set(wy < sea + 0.25 ? C.weedDark : C.weed), THREE.MathUtils.clamp((sea + 0.9 - wy) / 0.7, 0, 0.85));
      if (wy < sea - 0.2) tint.multiplyScalar(0.8);
      return tint.clone();
    };
    const TH = 0.08;
    const inner = (p: THREE.Vector3, side: number): THREE.Vector3 => new THREE.Vector3(p.x - side * Math.min(TH, Math.abs(p.x)), p.y, p.z);
    const plankPiece = (t0: number, t1: number, r: number, side: number, col: THREE.Color): void => {
      const u0 = r / ROWS, u1 = (r + 1) / ROWS;
      const a = hullPt(t0, u0, side), b = hullPt(t1, u0, side), c = hullPt(t1, u1, side), d = hullPt(t0, u1, side);
      c.x += side * 0.035; d.x += side * 0.035;                  // lapstrake: each strake's lower edge laps out over the next
      const ai = inner(a, side), bi = inner(b, side), ci = inner(c, side), di = inner(d, side);
      const v: number[] = [];
      const q = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => v.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
      if (side > 0) { q(a, d, c, b); q(ai, bi, ci, di); } else { q(a, b, c, d); q(ai, di, ci, bi); }
      q(a, b, bi, ai); q(d, di, ci, c);                          // top + bottom edges (thickness)
      q(a, ai, di, d); q(b, c, ci, bi);                          // end grain
      kit.add(tris(v), col, { matrix: mh, jitter: 0.05 });
    };
    for (let i = 0; i < N; i++) for (let r = 0; r < ROWS; r++) for (const side of [-1, 1]) {
      const t0 = i / N, t1 = (i + 1) / N, tm = (t0 + t1) / 2;
      const mid = hullPt(tm, (r + 0.5) / ROWS, side);
      if (side < 0 && tm > 0.6 && tm < 0.74 && r >= 2 && r <= 5 && rng.next() < 0.85) continue;      // port quarter stove in
      if (side > 0 && tm > 0.12 && tm < 0.2 && r >= 3 && r <= 4) continue;                           // the bow gash
      if (side < 0 && r >= 1 && r <= 6 && rng.next() < 0.05) continue;                               // a loose plank here and there
      const col = plankCol(r, mid);
      const z0 = zOf(t0), z1 = zOf(t1);
      if (inBreach(mid.z, mid.y, side) || (side > 0 && mid.y > BREACH_Y0 && mid.y < BREACH_Y1 && z1 > BREACH_Z0 && z0 < BREACH_Z1)) {
        // clip the plank around the breach with a ragged, per-strake edge
        const jag0 = BREACH_Z0 + rng.range(-0.45, 0.25), jag1 = BREACH_Z1 + rng.range(-0.25, 0.45);
        if (z0 < jag0) plankPiece(t0, tOf(Math.min(z1, jag0)), r, side, col);
        if (z1 > jag1) plankPiece(tOf(Math.max(z0, jag1)), t1, r, side, col);
        continue;
      }
      plankPiece(t0, t1, r, side, col);
    }
    // transom (stern) planks with two dark stern windows, the stem + keel timbers
    {
      const t = 1, rowsT = 8;
      for (let r = 0; r < rowsT; r++) {
        const y0 = topOf(t) - (r / rowsT) * (topOf(t) - keelOf(t)), y1 = topOf(t) - ((r + 1) / rowsT) * (topOf(t) - keelOf(t));
        const w0 = halfWidthAt(t, y0 - 0.01), w1 = halfWidthAt(t, y1 + 0.01), z = zOf(t);
        const v = [-w0, y0, z, w0, y0, z, w1, y1, z, -w0, y0, z, w1, y1, z, -w1, y1, z];
        kit.add(tris(v), r === 0 ? C.wale : r % 2 ? C.hull : C.hullB, { matrix: mh, jitter: 0.05 });
      }
      for (const x of [-0.9, 0.9]) kit.add(new THREE.BoxGeometry(0.55, 0.45, 0.06), '#2a211b', { matrix: new THREE.Matrix4().makeTranslation(x, topOf(1) - 0.75, zOf(1) + 0.03).premultiply(mh) });
    }
    for (let i = 0; i < 10; i++) {
      const t0 = i / 10 * 0.2, t1 = (i + 1) / 10 * 0.2;
      kit.add(beam(new THREE.Vector3(0, keelOf(t0) + (i === 0 ? topOf(0) - keelOf(0) : 0), zOf(t0) - 0.05), new THREE.Vector3(0, keelOf(t1), zOf(t1)), 0.24, 0.26), C.hullDark, { matrix: mh });
    }
    kit.add(beam(new THREE.Vector3(0, KEEL - 0.05, zOf(0.2)), new THREE.Vector3(0, KEEL - 0.05, zOf(1) + 0.1), 0.28, 0.3), C.hullDark, { matrix: mh });
    // the stem head and a snapped bowsprit
    kit.add(log(new THREE.Vector3(0, topOf(0) - 0.2, zOf(0) + 0.1), new THREE.Vector3(0, topOf(0) + 1.0, zOf(0) - 2.4), 0.2, 0.15, 6), C.mast, { matrix: mh, jitter: 0.05 });

    // ── ribs: a frame at every station, inside the planking; broken off across the breach ──
    for (let i = 2; i < N; i++) {
      const t = i / N;
      for (const side of [-1, 1]) {
        const us = [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1];
        for (let k = 0; k + 1 < us.length; k++) {
          const a = hullPt(t, us[k] ?? 0, side), b = hullPt(t, us[k + 1] ?? 1, side);
          a.x -= side * 0.13; b.x -= side * 0.13;
          if (Math.abs(a.x) < 0.1 && Math.abs(b.x) < 0.1) continue;
          const midY = (a.y + b.y) / 2;
          if (inBreach(a.z, midY, side)) {
            // a splintered stub hanging from the rib above / standing on the one below
            if (rng.next() < 0.5) { const s = a.clone().lerp(b, rng.range(0.2, 0.45)); kit.add(beam(a, s, 0.12, 0.15), C.rib, { matrix: mh }); }
            continue;
          }
          kit.add(beam(a, b, 0.12, 0.15), C.rib, { matrix: mh, jitter: 0.05 });
        }
        // broken frame heads sticking up over the smashed rail amidships (starboard, over the breach) and on the port quarter
        const brokenTop = (side > 0 && zOf(t) > BREACH_Z0 - 1 && zOf(t) < BREACH_Z1 + 1.2) || (side < 0 && t > 0.6 && t < 0.74);
        if (brokenTop) {
          const a = hullPt(t, 0, side); a.x -= side * 0.13;
          kit.add(beam(a, a.clone().add(new THREE.Vector3(side * 0.08, rng.range(0.35, 0.9), rng.range(-0.1, 0.1))), 0.12, 0.15), C.rib, { matrix: mh });
        }
      }
    }

    // ── bulwark: posts + a cap rail (a baluster rail on the quarterdeck); smashed over the breach, gaps to port ──
    for (const side of [-1, 1]) {
      for (let i = 1; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N, z0 = zOf(t0);
        const smashed = (side > 0 && z0 > BREACH_Z0 - 1.2 && z0 < BREACH_Z1 + 1) || (side < 0 && t0 > 0.58 && t0 < 0.72);
        if (smashed) continue;
        const a = hullPt(t0, 0, side), b = hullPt(t1, 0, side);
        const h = 0.8;
        kit.add(beam(a.clone().setY(a.y - 0.05), a.clone().setY(a.y + h), 0.12, 0.12), C.rail, { matrix: mh });
        if (side < 0 && rng.next() < 0.15) continue;                                          // a missing rail length to port
        kit.add(beam(a.clone().setY(a.y + h), b.clone().setY(b.y + h), 0.16, 0.08), C.rail, { matrix: mh });
        kit.add(beam(a.clone().setY(a.y + h * 0.45), b.clone().setY(b.y + h * 0.45), 0.1, 0.06), C.hullDark, { matrix: mh });
        if (t0 > 0.78) for (let k = 1; k < 3; k++) {                                          // balusters on the quarterdeck rail
          const p = a.clone().lerp(b, k / 3);
          kit.add(new THREE.CylinderGeometry(0.035, 0.045, h * 0.9, 5).translate(p.x, p.y + h * 0.45, p.z), C.rail, { matrix: mh, jitter: 0.04 });
        }
      }
    }
    // the rail across the break of the quarterdeck (the hold's aft end)
    {
      const w = halfWidthAt(tOf(HOLD_Z1), QUARTER_DECK) - 0.1;
      for (let k = 0; k <= 8; k++) { const x = -w + (2 * w * k) / 8; kit.add(new THREE.CylinderGeometry(0.035, 0.045, 0.75, 5).translate(x, QUARTER_DECK + 0.38, HOLD_Z1 + 0.05), C.rail, { matrix: mh, jitter: 0.04 }); }
      kit.add(beam(new THREE.Vector3(-w, QUARTER_DECK + 0.8, HOLD_Z1 + 0.05), new THREE.Vector3(w, QUARTER_DECK + 0.8, HOLD_Z1 + 0.05), 0.14, 0.08), C.rail, { matrix: mh });
    }

    // ── decks: the forecastle and the quarterdeck planked over beams; amidships only the waterways and a few hanging planks ──
    const deckStrip = (tA: number, tB: number, y: number, nP: number, missing: number): void => {
      const steps = Math.max(1, Math.round((tB - tA) * N));
      for (let s = 0; s < steps; s++) {
        const t0 = tA + ((tB - tA) * s) / steps, t1 = tA + ((tB - tA) * (s + 1)) / steps;
        const w0 = halfWidthAt(t0, y) - 0.06, w1 = halfWidthAt(t1, y) - 0.06;
        if (w0 <= 0.1 && w1 <= 0.1) continue;
        for (let k = 0; k < nP; k++) {
          if (rng.next() < missing) continue;
          const f0 = -1 + (2 * k) / nP, f1 = -1 + (2 * (k + 1)) / nP - 0.03;
          const z0 = zOf(t0), z1 = zOf(t1);
          const v = [f0 * w0, y, z0, f0 * w1, y, z1, f1 * w1, y, z1, f0 * w0, y, z0, f1 * w1, y, z1, f1 * w0, y, z0];
          // thickness: the two long edges
          const e = 0.06;
          v.push(f0 * w0, y, z0, f0 * w0, y - e, z0, f0 * w1, y - e, z1, f0 * w0, y, z0, f0 * w1, y - e, z1, f0 * w1, y, z1);
          v.push(f1 * w0, y, z0, f1 * w1, y, z1, f1 * w1, y - e, z1, f1 * w0, y, z0, f1 * w1, y - e, z1, f1 * w0, y - e, z0);
          kit.add(tris(v), k % 2 ? C.deck : C.deckB, { matrix: mh, jitter: 0.07 });
        }
      }
    };
    deckStrip(0.035, tOf(HOLD_Z0), BOW_DECK, 9, 0.03);
    deckStrip(tOf(HOLD_Z1), 0.99, QUARTER_DECK, 9, 0.02);
    // the aft end of the forecastle deck: an edge board so the drop into the hold reads
    { const w = halfWidthAt(tOf(HOLD_Z0), BOW_DECK) - 0.06; kit.add(new THREE.BoxGeometry(2 * w, 0.14, 0.12).translate(0, BOW_DECK - 0.06, HOLD_Z0), C.hullDark, { matrix: mh }); }
    // deck beams across the open hold (some gone, one fallen in), the waterway planks along each side
    for (let i = 0; i <= N; i++) {
      const t = i / N, z = zOf(t);
      if (z < HOLD_Z0 + 0.3 || z > HOLD_Z1 - 0.3) continue;
      const w = halfWidthAt(t, BEAM_Y) - 0.1;
      const r = rng.next();
      if (r < 0.3) continue;
      if (r < 0.42) {                                                                           // snapped: one end fell to the floor
        const side = rng.next() < 0.5 ? -1 : 1;
        kit.add(beam(new THREE.Vector3(side * w, BEAM_Y, z), new THREE.Vector3(-side * w * 0.2, 0.25, z + rng.range(-0.4, 0.4)), 0.2, 0.22), C.rib, { matrix: mh });
        continue;
      }
      kit.add(beam(new THREE.Vector3(-w, BEAM_Y, z), new THREE.Vector3(w, BEAM_Y, z), 0.2, 0.22), C.rib, { matrix: mh, jitter: 0.05 });
    }
    for (const side of [-1, 1]) {
      const tA = tOf(HOLD_Z0), tB = tOf(HOLD_Z1), steps = Math.round((tB - tA) * N);
      for (let s = 0; s < steps; s++) {
        const t0 = tA + ((tB - tA) * s) / steps, t1 = tA + ((tB - tA) * (s + 1)) / steps;
        if (rng.next() < 0.25) continue;
        const w0 = halfWidthAt(t0, BOW_DECK) - 0.06, w1 = halfWidthAt(t1, BOW_DECK) - 0.06, y = BOW_DECK, z0 = zOf(t0), z1 = zOf(t1);
        const i0 = w0 - 0.45 - rng.range(0, 0.25), i1 = w1 - 0.45 - rng.range(0, 0.25);
        const v = side > 0
          ? [i0, y, z0, i1, y, z1, w1, y, z1, i0, y, z0, w1, y, z1, w0, y, z0]
          : [-w0, y, z0, -w1, y, z1, -i1, y, z1, -w0, y, z0, -i1, y, z1, -i0, y, z0];
        kit.add(tris(v), C.deckB, { matrix: mh, jitter: 0.07 });
      }
    }
    for (let k = 0; k < 3; k++) {                                                               // deck planks hanging into the hold
      const z = HOLD_Z0 + 1.6 + k * 2.6, side = k % 2 ? 1 : -1, w = halfWidthAt(tOf(z), BOW_DECK) - 0.5;
      const top = new THREE.Vector3(side * w, BOW_DECK - 0.02, z), bot = new THREE.Vector3(side * (w - 0.9), 0.4 + rng.range(0, 0.5), z + rng.range(-0.8, 0.8));
      kit.add(beam(top, bot, 0.26, 0.05, rng.range(-0.2, 0.2)), C.deck, { matrix: mh });
    }

    // ── the hold: a level plank floor, the two bulkheads, a stair to the bow deck ──
    for (let zi = 0; zi < Math.ceil((HOLD_Z1 - HOLD_Z0) / 1.2); zi++) {
      const z0 = HOLD_Z0 + zi * 1.2, z1 = Math.min(HOLD_Z1, z0 + 1.2);
      const [p0, s0] = this.floorHalf(z0), [p1, s1] = this.floorHalf(z1);
      const pw = Math.min(p0, p1), sw = Math.min(s0, s1);
      const nP = 10;
      for (let k = 0; k < nP; k++) {
        const x0 = -pw + ((pw + sw) * k) / nP, x1 = -pw + ((pw + sw) * (k + 1)) / nP - 0.03;
        const len = z1 - z0 - 0.02, g = plank(len, x1 - x0, 0.07, rng, 0.01).rotateY(Math.PI / 2);
        kit.add(g, (k + zi) % 3 === 0 ? C.floorB : C.floor, { matrix: new THREE.Matrix4().makeTranslation((x0 + x1) / 2, -0.035, (z0 + z1) / 2).premultiply(mf), jitter: 0.07 });
      }
    }
    const bulkhead = (z: number, yTo: number, door: boolean): void => {
      for (let y = -0.2; y < yTo - 0.05; y += 0.32) {
        const yc = y + 0.15, w = Math.max(halfWidthAt(tOf(z), yc - 0.15), halfWidthAt(tOf(z), yc + 0.15)) - 0.06;
        if (w <= 0.1) continue;
        kit.add(plank(2 * w, 0.3, 0.07, rng, 0.01).rotateX(Math.PI / 2).translate(0, yc, z), rng.next() < 0.3 ? C.hullGrey : C.hullB, { matrix: mh, jitter: 0.05 });
      }
      for (const x of [-1.6, -0.5, 0.5, 1.6]) kit.add(new THREE.BoxGeometry(0.14, yTo + 0.2, 0.14).translate(x, yTo / 2 - 0.1, z + (z < 0 ? 0.08 : -0.08)), C.rib, { matrix: mh });
      if (door) {
        kit.add(new THREE.BoxGeometry(0.95, 1.85, 0.08).translate(0.3, 0.95, z - 0.06), C.door, { matrix: mh, jitter: 0.04 });
        kit.add(new THREE.BoxGeometry(1.15, 0.12, 0.12).translate(0.3, 1.92, z - 0.08), C.rib, { matrix: mh });
        for (const y of [0.5, 1.4]) kit.add(new THREE.BoxGeometry(0.85, 0.06, 0.03).translate(0.3, y, z - 0.11), C.iron, { matrix: mh });
        kit.add(new THREE.BoxGeometry(0.06, 0.12, 0.06).translate(0.66, 1.0, z - 0.13), C.brass, { matrix: mh });
      }
    };
    bulkhead(HOLD_Z0, BOW_DECK, false);
    bulkhead(HOLD_Z1, QUARTER_DECK, true);
    {
      const steps = 8, { x0, x1, z0, z1 } = STAIR;
      for (let k = 0; k < steps; k++) {
        const f = (k + 1) / steps, z = z0 + (z1 - z0) * (k + 0.5) / steps, y = BOW_DECK * f;
        kit.add(plank(x1 - x0, 0.3, 0.06, rng, 0.01), C.deck, { matrix: new THREE.Matrix4().makeTranslation((x0 + x1) / 2, y - 0.03, z).premultiply(mf) });
      }
      for (const x of [x0 + 0.05, x1 - 0.05]) kit.add(beam(new THREE.Vector3(x, 0, z0 + 0.1), new THREE.Vector3(x, BOW_DECK, z1), 0.08, 0.24), C.rib, { matrix: mf });
      kit.add(rope(sagLine(new THREE.Vector3(x1, 1.0, z0), new THREE.Vector3(x1, BOW_DECK + 0.9, z1), 0.12, 4), 0.03), C.rope, { matrix: mf });
    }

    // ── masts: the mainmast from the keel through the open hold, leaning aft + to starboard; a crow's nest, a yard, the sail ──
    const inv = new THREE.Quaternion().setFromRotationMatrix(mh).invert();
    const downH = new THREE.Vector3(0, -1, 0).applyQuaternion(inv);
    const mBase = new THREE.Vector3(0.05, KEEL, 1.3), mDir = new THREE.Vector3(0.1, 1, 0.3).normalize(), mLen = 14.5;
    const mAt = (s: number) => mBase.clone().addScaledVector(mDir, s);
    kit.add(log(mBase, mAt(mLen), 0.26, 0.13, 8), C.mast, { matrix: mh, jitter: 0.05 });
    for (const s of [3.8, 6.5, 9]) kit.add(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), mDir)).translate(mAt(s).x, mAt(s).y, mAt(s).z), C.band, { matrix: mh, jitter: 0.04 });
    {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), mDir), c = mAt(11.4);
      const nest = new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)).premultiply(mh);
      kit.add(new THREE.CylinderGeometry(0.95, 0.8, 0.22, 8), C.deckB, { matrix: nest, jitter: 0.05 });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, p = new THREE.Vector3(Math.cos(a) * 0.88, 0.45, Math.sin(a) * 0.88);
        kit.add(new THREE.BoxGeometry(0.07, 0.7, 0.07).translate(p.x, p.y, p.z), C.rail, { matrix: nest });
      }
      kit.add(new THREE.TorusGeometry(0.9, 0.05, 3, 8).rotateX(Math.PI / 2).translate(0, 0.8, 0), C.rail, { matrix: nest });
    }
    // the yard: one arm snapped at the sling and hanging down along the mast
    const yc = mAt(9.6), yDir = new THREE.Vector3(1, 0, -0.12).normalize();
    const yArm = yc.clone().addScaledVector(yDir, 3.3);
    kit.add(log(yc.clone().addScaledVector(yDir, -0.2), yArm, 0.11, 0.07, 6), C.mast, { matrix: mh });
    const yFall = yc.clone().addScaledVector(downH, 3.6).add(new THREE.Vector3(-0.9, 0, 0.4));
    kit.add(log(yc.clone().add(new THREE.Vector3(-0.1, 0, 0)), yFall, 0.1, 0.07, 6), C.mast, { matrix: mh });
    // the torn sail hanging from the surviving arm (bellied, ragged foot, a rip, a hole)
    {
      const cols = 7, rowsS = 6, drop = 5.2;
      const pt = (c: number, f: number): THREE.Vector3 => {
        const along = yc.clone().lerp(yArm, 0.05 + 0.95 * (c / cols));
        return along.addScaledVector(downH, f * drop).add(new THREE.Vector3(0, 0, 0.45 * Math.sin(f * Math.PI) * (0.6 + 0.4 * Math.sin(c * 0.9)) + f * 0.5));
      };
      const rag = (c: number): number => 0.5 + 0.5 * Math.abs(Math.sin(c * 2.3 + 0.7));
      // the sail hangs from the yard: no sway at the yard, full flutter at the foot (world heights)
      const yardW = yc.clone().applyMatrix4(mh).y, sailSpan: [number, number] = [yardW, yardW - drop];
      for (let c = 0; c < cols; c++) for (let r = 0; r < rowsS; r++) {
        const f0 = r / rowsS, f1 = (r + 1) / rowsS;
        const lim0 = rag(c), lim1 = rag(c + 1);
        if (f0 > Math.min(lim0, lim1)) continue;
        if (c === 3 && r >= 2) continue;                                           // the rip
        if (c === 5 && r === 2) continue;                                          // a hole
        const a = pt(c, f0), b = pt(c + 1, f0), cc = pt(c + 1, Math.min(f1, lim1)), d = pt(c, Math.min(f1, lim0));
        const col = rng.next() < 0.15 ? C.sailStain : r % 2 ? C.sail : C.sailB;
        kit.add(tris([a.x, a.y, a.z, b.x, b.y, b.z, cc.x, cc.y, cc.z, a.x, a.y, a.z, cc.x, cc.y, cc.z, d.x, d.y, d.z]), col, { matrix: mh, jitter: 0.04, sway: { w: 1.1, phase: 0.7, span: sailSpan } });
      }
    }
    // shrouds with ratlines to each rail, a forestay to the stem, a parted backstay hanging
    for (const side of [-1, 1]) {
      const top = mAt(10.8), feet = [-0.6, 0.6, 1.8].map((z) => { const t = tOf(z + 1.3); const p = hullPt(t, 0, side); p.x += side * 0.12; return p; });
      if (side > 0) feet.splice(0, 1);                                               // the forward shroud parted with the rail
      for (const f of feet) kit.add(rope([top, f], 0.03), C.ropeDark, { matrix: mh });
      for (let k = 0; k + 1 < feet.length; k++) {
        const fa = feet[k], fb = feet[k + 1];
        if (fa === undefined || fb === undefined) continue;
        for (let s = 0.08; s < 0.75; s += 0.055) kit.add(rope([fa.clone().lerp(top, s), fb.clone().lerp(top, s)], 0.018), C.rope, { matrix: mh });
      }
    }
    kit.add(rope(sagLine(mAt(12.5), hullPt(0.02, 0, 1).setY(topOf(0) + 0.6), 0.5, 8), 0.035), C.ropeDark, { matrix: mh });
    kit.add(rope([mAt(12.8), mAt(12.8).add(new THREE.Vector3(0.3, -2.5, 1.4)), mAt(12.8).add(new THREE.Vector3(0.5, -5.8, 2.3))], 0.03), C.ropeDark, { matrix: mh });
    // the foremast: snapped 3 m over the forecastle, the top lying across the port rail into the water
    {
      const fz = -6.1, fb = new THREE.Vector3(0, BOW_DECK, fz), ft = new THREE.Vector3(0.1, BOW_DECK + 3.1, fz + 0.2);
      kit.add(log(fb, ft, 0.22, 0.2, 7), C.mast, { matrix: mh });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4, bx = ft.x + Math.cos(a) * 0.12, bz = ft.z + Math.sin(a) * 0.12;
        const h = rng.range(0.25, 0.7), w = 0.07;
        kit.add(tris([bx - w * Math.sin(a), ft.y - 0.05, bz + w * Math.cos(a), bx + w * Math.sin(a), ft.y - 0.05, bz - w * Math.cos(a), bx * 0.9, ft.y + h, bz * 0.98]), C.driftDark, { matrix: mh });
      }
      kit.add(log(new THREE.Vector3(-0.4, BOW_DECK + 0.25, fz + 0.9), new THREE.Vector3(-5.6, -0.4, fz + 4.3), 0.19, 0.13, 7), C.mast, { matrix: mh, jitter: 0.05 });
    }
    // weed hanging off the beach-side rail and down the planks
    for (let k = 0; k < 34; k++) {
      const side = k < 26 ? 1 : -1, t = rng.range(0.14, 0.9), z = zOf(t);
      if (side > 0 && z > BREACH_Z0 - 0.3 && z < BREACH_Z1 + 0.3) continue;
      const u1 = rng.range(0.2, 0.55), segs = 4, w = rng.range(0.08, 0.16), v: number[] = [];
      for (let s = 0; s < segs; s++) {
        const a = hullPt(t, (u1 * s) / segs, side), b = hullPt(t, (u1 * (s + 1)) / segs, side);
        a.x += side * 0.07; b.x += side * 0.07;
        const wa = w * (1 - s / segs), wb = w * (1 - (s + 1) / segs);
        v.push(a.x, a.y, a.z - wa, a.x, a.y, a.z + wa, b.x, b.y, b.z + wb, a.x, a.y, a.z - wa, b.x, b.y, b.z + wb, b.x, b.y, b.z - wb);
      }
      kit.add(tris(v), rng.next() < 0.5 ? C.moss : C.mossLight, { matrix: mh, jitter: 0.1, sway: { w: 0.35, hang: true } });
    }

    // ── hold dressing: barrels, crates, a net, rope coils, the weapon rack, lanterns ──
    const fm = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)).premultiply(mf);
    const barrel = (m: THREE.Matrix4, lying = false): void => {
      const g = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 9);
      const bulge = g.getAttribute('position');
      for (let i = 0; i < bulge.count; i++) { const y = bulge.getY(i); const k = 1 + 0.12 * (1 - (y / 0.45) ** 2); bulge.setX(i, bulge.getX(i) * k); bulge.setZ(i, bulge.getZ(i) * k); }
      const r = lying ? new THREE.Matrix4().makeRotationZ(Math.PI / 2) : new THREE.Matrix4();
      kit.add(g.applyMatrix4(r), rng.next() < 0.5 ? C.barrel : C.barrelB, { matrix: m, jitter: 0.08 });
      for (const y of [-0.3, 0.3]) kit.add(new THREE.CylinderGeometry(0.37, 0.37, 0.06, 9).translate(0, y, 0).applyMatrix4(r), C.band, { matrix: m, jitter: 0.03 });
    };
    const crate = (m: THREE.Matrix4, s: number, broken = false): void => {
      const faces: [number, number, number, number, number, number][] = [[0, s / 2, 0, s, s, s]];
      for (const f of faces) {
        if (!broken) kit.add(new THREE.BoxGeometry(f[3], f[4], f[5]).translate(f[0], f[1], f[2]), rng.next() < 0.5 ? C.crate : C.crateB, { matrix: m, jitter: 0.07 });
        else for (let k = 0; k < 4; k++) if (k !== 2) kit.add(new THREE.BoxGeometry(s, s / 4 - 0.02, 0.05).translate(0, s / 8 + (k * s) / 4, s / 2 - 0.025), C.crate, { matrix: m, jitter: 0.07 });
      }
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) kit.add(new THREE.BoxGeometry(0.07, s + 0.02, 0.07).translate((x * (s - 0.05)) / 2, s / 2, (z * (s - 0.05)) / 2), C.crateB, { matrix: m });
      if (broken) { kit.add(new THREE.BoxGeometry(s, 0.05, s).translate(0, 0.025, 0), C.crateB, { matrix: m }); kit.add(new THREE.BoxGeometry(0.05, s, s).translate(-s / 2 + 0.025, s / 2, 0), C.crate, { matrix: m }); }
    };
    const coil = (m: THREE.Matrix4, r = 0.3): void => { for (let k = 0; k < 3; k++) kit.add(new THREE.TorusGeometry(r - k * 0.06, 0.035, 4, 10).rotateX(Math.PI / 2).translate(0, 0.035 + k * 0.05, 0), C.rope, { matrix: m, jitter: 0.05 }); };
    const lantern = (m: THREE.Matrix4, hang: number): THREE.Vector3 => {
      kit.add(new THREE.CylinderGeometry(0.12, 0.14, 0.05, 6).translate(0, 0.02, 0), C.brass, { matrix: m });
      kit.add(new THREE.CylinderGeometry(0.06, 0.13, 0.12, 6).translate(0, 0.36, 0), C.brass, { matrix: m });
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; kit.add(new THREE.BoxGeometry(0.025, 0.3, 0.025).translate(Math.cos(a) * 0.11, 0.18, Math.sin(a) * 0.11), C.brass, { matrix: m }); }
      if (hang > 0) kit.add(rope([new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0, 0.42 + hang, 0)], 0.015), C.iron, { matrix: m });
      glow.add(new THREE.OctahedronGeometry(0.08, 0).scale(1, 1.6, 1).translate(0, 0.17, 0), C.flame, { matrix: m, jitter: 0 });
      glow.add(new THREE.OctahedronGeometry(0.1, 0).scale(1, 1.2, 1).translate(0, 0.16, 0), '#ff8a2a', { matrix: m, jitter: 0 });
      return new THREE.Vector3(0, 0.18, 0).applyMatrix4(m);
    };
    // barrels stacked in the forward-starboard corner, one toppled
    {
      const [, sw] = this.floorHalf(-3.6), bx = sw - 0.45;
      for (const [x, z] of [[bx, -3.75], [bx - 0.72, -3.75], [bx, -3.05]] as const) barrel(fm(x, 0.45, z));
      barrel(fm(bx - 0.36, 1.35, -3.75));
      barrel(fm(bx - 1.5, 0.34, -3.35, 0.6), true);
      const p = lantern(fm(bx - 0.36, 1.8, -3.75), 0);
      lamps.push({ x: p.x, y: p.y, z: p.z, color: '#ffb561', range: 5.2, intensity: 1.2 });
      this.colliders.push(this.box(bx - 0.36, -3.4, 0.75, 0.7, 2.0));
    }
    // crates in the aft corners (the levers go in front of them, the strongbox between)
    {
      const [pw, sw] = this.floorHalf(4.7);
      crate(fm(sw - 0.45, 0, 4.75, 0.1), 0.8); crate(fm(sw - 0.5, 0.8, 4.8, -0.2), 0.6); crate(fm(sw - 1.35, 0, 4.85, 0.3), 0.55, true);
      crate(fm(-pw + 0.45, 0, 4.75, -0.15), 0.8); crate(fm(-pw + 0.5, 0.8, 4.75, 0.25), 0.5);
      coil(fm(-pw + 1.3, 0, 4.9));
      this.colliders.push(this.box(sw - 0.6, 4.8, 0.9, 0.5, 1.4), this.box(-pw + 0.45, 4.8, 0.5, 0.5, 1.4));
      const p = lantern(fm(0.2, 1.75, HOLD_Z1 - 0.2), 0);
      lamps.push({ x: p.x, y: p.y, z: p.z, color: '#ffae55', range: 4.2, intensity: 1.0 });
    }
    // the weapon rack on the port wall opposite the breach; an oar and a boat hook on it, a lantern hung over it
    const rackZ = -1.2;
    {
      const [pw] = this.floorHalf(rackZ), x = -pw + 0.18;
      for (const dz of [-0.55, 0.55]) kit.add(beam(new THREE.Vector3(x, 0, rackZ + dz), new THREE.Vector3(x - 0.12, 1.75, rackZ + dz), 0.1, 0.12), C.rib, { matrix: mf });
      for (const y of [0.55, 1.05, 1.5]) {
        kit.add(new THREE.BoxGeometry(0.08, 0.1, 1.35).translate(x - 0.04 * y, y, rackZ), C.rail, { matrix: mf });
        if (y > 0.6) for (const dz of [-0.35, 0, 0.35]) kit.add(new THREE.BoxGeometry(0.2, 0.05, 0.05).translate(x + 0.08, y + 0.06, rackZ + dz), C.rib, { matrix: mf });
      }
      kit.add(log(new THREE.Vector3(x + 0.12, 0.05, rackZ + 0.45), new THREE.Vector3(x + 0.02, 1.9, rackZ + 0.35), 0.04, 0.035, 5), C.driftDark, { matrix: mf });
      kit.add(new THREE.BoxGeometry(0.04, 0.5, 0.16).translate(x + 0.12, 0.3, rackZ + 0.45), C.driftDark, { matrix: mf });
      kit.add(log(new THREE.Vector3(x + 0.14, 0.05, rackZ - 0.45), new THREE.Vector3(x + 0.02, 2.0, rackZ - 0.5), 0.03, 0.03, 5), C.mast, { matrix: mf });
      kit.add(new THREE.TorusGeometry(0.08, 0.02, 3, 6, Math.PI * 1.3).translate(x + 0.02, 2.02, rackZ - 0.5), C.iron, { matrix: mf });
      const p = lantern(fm(x + 0.75, 1.72, rackZ + 0.1), BEAM_Y - 1.72 - 0.42);
      lamps.push({ x: p.x, y: p.y, z: p.z, color: '#ffbb66', range: 5.5, intensity: 1.35 });
      this.anchors['swordRack'] = this.anchor(x + 0.3, rackZ, Math.PI / 2);
    }
    // the net hung from a deck beam, spilling onto the floor to starboard; rope coils
    {
      const [, sw] = this.floorHalf(2.6), cols = 7, rowsN = 7, x0 = sw - 0.3;
      const P = (c: number, r: number): THREE.Vector3 => {
        const f = r / (rowsN - 1), zc = 1.9 + (c / (cols - 1)) * 1.5;
        const y = BEAM_Y - 0.1 - f * 2.2 + Math.max(0, f - 0.9) * 0;
        return new THREE.Vector3(x0 - 0.1 - f * 0.35 - Math.sin(c * 1.3) * 0.05 * f, Math.max(0.04, y), zc + Math.sin(f * 3 + c) * 0.06);
      };
      for (let c = 0; c < cols; c++) for (let r = 0; r + 1 < rowsN; r++) kit.add(rope([P(c, r), P(c, r + 1)], 0.014, 3), C.net, { matrix: mf, jitter: 0.05 });
      for (let r = 0; r < rowsN; r++) for (let c = 0; c + 1 < cols; c++) kit.add(rope([P(c, r), P(c + 1, r)], 0.014, 3), C.net, { matrix: mf, jitter: 0.05 });
      coil(fm(sw - 0.9, 0, 0.9), 0.34);
      coil(fm(-1.0, 0, 2.1), 0.26);
    }
    // the stair collider (you can't walk under its high end) and the mainmast through the floor
    this.colliders.push(this.box((STAIR.x0 + STAIR.x1) / 2, -3.55, (STAIR.x1 - STAIR.x0) / 2, 0.65, 1.1));
    {
      const s = (0 - KEEL) / mDir.y, p = mBase.clone().addScaledVector(mDir, s);
      const f = new THREE.Vector3(p.x, 0, p.z).applyEuler(new THREE.Euler(0, 0, this.roll));
      this.colliders.push(this.box(f.x, f.z, 0.3, 0.3, 3.0));
    }

    // ── the hatch cover fallen out of the breach: the ramp up from the shallows ──
    const [, swB] = this.floorHalf((BREACH_Z0 + BREACH_Z1) / 2);
    const bzC = (BREACH_Z0 + BREACH_Z1) / 2;
    {
      const outX = swB + RAMP, gw = this.F(outX, 0, bzC), gy = heightAt(gw.x, gw.z) - this.floorY;
      const a = new THREE.Vector3(swB - 0.1, -0.02, bzC), b = new THREE.Vector3(outX, gy - 0.02, bzC);
      for (let k = -2; k <= 2; k++) kit.add(beam(a.clone().setZ(bzC + k * 0.3), b.clone().setZ(bzC + k * 0.3 + rng.range(-0.05, 0.05)), 0.07, 0.28, Math.PI / 2), k % 2 ? C.deck : C.deckB, { matrix: mf, jitter: 0.06 });
      for (const dz of [-0.62, 0.62]) kit.add(beam(a.clone().setZ(bzC + dz).setY(-0.1), b.clone().setZ(bzC + dz).setY(gy - 0.1), 0.12, 0.1), C.rib, { matrix: mf });
      this.rampLen = RAMP; this.rampX0 = swB; this.rampGround = gy;
    }
    this.anchors['holdDoor'] = this.anchor(swB - 0.05, bzC, Math.PI / 2);
    this.anchors['holdFloor'] = this.anchor(0, 0.4, 0);
    this.anchors['leverA'] = this.anchor(-this.floorHalf(3.5)[0] + 0.45, 3.5, Math.PI / 2);
    this.anchors['leverB'] = this.anchor(this.floorHalf(3.7)[1] - 0.45, 3.7, -Math.PI / 2);
    this.anchors['strongbox'] = this.anchor(0, 4.55, Math.PI);

    // ── around the wreck (world space): driftwood piles on the beach, barrels, crates, a net, reef rocks, flotsam ──
    const W0 = new THREE.Matrix4();
    const wm = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): THREE.Matrix4 =>
      W0.clone().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const hw = (lx: number, lz: number): [number, number] => [this.spec.x + lx * this.cs + lz * this.sn, this.spec.z - lx * this.sn + lz * this.cs];
    const pile = (px: number, pz: number, n: number, spread: number, seedYaw: number): void => {
      let layer = 0;
      for (let k = 0; k < n; k++) {
        const len = rng.range(2.4, 5.2), r = rng.range(0.14, 0.32), yaw = seedYaw + (k % 2 ? 1.2 : 0) + rng.range(-0.35, 0.35);
        const ox = px + rng.range(-spread, spread), oz = pz + rng.range(-spread, spread);
        const dx = Math.cos(yaw) * len / 2, dz = Math.sin(yaw) * len / 2;
        const ya = heightAt(ox - dx, oz - dz), yb = heightAt(ox + dx, oz + dz), lift = layer * 0.28 + r * 0.8;
        const a = new THREE.Vector3(ox - dx, ya + lift + rng.range(0, 0.15), oz - dz), b = new THREE.Vector3(ox + dx, yb + lift + rng.range(0, 0.15), oz + dz);
        addDriftLog(kit, a, b, r, r * rng.range(0.6, 0.85), { sides: 7, twist: rng.range(0, 1), tone: k, wobble: 0.03 });
        if (rng.next() < 0.45) {                                          // a snapped branch stub
          const m = a.clone().lerp(b, rng.range(0.3, 0.7));
          kit.add(log(m, m.clone().add(new THREE.Vector3(rng.range(-0.4, 0.4), rng.range(0.3, 0.6), rng.range(-0.4, 0.4))), r * 0.35, r * 0.2, 5), DRIFT.stub);
        }
        if (rng.next() < 0.3) {                                           // a rope lashed round it
          const m = a.clone().lerp(b, rng.range(0.2, 0.8)), dir = b.clone().sub(a).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
          for (let j = 0; j < 3; j++) kit.add(new THREE.TorusGeometry(r + 0.03, 0.03, 3, 8), C.rope, { matrix: new THREE.Matrix4().compose(m.clone().addScaledVector(dir, (j - 1) * 0.08), q, new THREE.Vector3(1, 1, 1)) });
        }
        if (k % 2 === 1) layer++;
      }
      this.colliders.push({ x: px, z: pz, hw: spread + 0.9, hd: spread + 0.9, rot: 0, yTop: heightAt(px, pz) + 0.6 + layer * 0.28, yBottom: heightAt(px, pz) - 2 });
    };
    // the piles sit on the cove beach west / south-west of the hull (between the path's end and the water)
    // (hull-local x / z: +x = starboard = WSW, the beach; −z = the bow = NNW, toward the crag)
    const piles: [number, number, number, number, number][] = [[9, -9, 7, 1.1, 0.4], [14, 4.5, 6, 1.0, 1.9], [16, -7.5, 5, 0.9, 1.1], [6, -13, 4, 0.8, 0.2]];
    const pileAt: [number, number][] = [];
    for (const [lx, lz, n, s, yw] of piles) { const [x, z] = hw(lx, lz); pile(x, z, n, s, yw); pileAt.push([x, z]); }
    // a net draped over the first pile, a coil and a lantern-less barrel beside it
    {
      const [px, pz] = pileAt[0] ?? [0, 0], cols = 8, rowsN = 6;
      const P = (c: number, r: number): THREE.Vector3 => {
        const x = px - 1.4 + (c / (cols - 1)) * 2.8, z = pz - 1.0 + (r / (rowsN - 1)) * 2.0;
        const cx = (c / (cols - 1)) * 2 - 1, cz = (r / (rowsN - 1)) * 2 - 1;
        return new THREE.Vector3(x, heightAt(x, z) + 0.05 + Math.max(0, 1 - cx * cx) * Math.max(0, 1 - cz * cz * 0.8) * 0.75 + 0.05, z);
      };
      for (let c = 0; c < cols; c++) for (let r = 0; r + 1 < rowsN; r++) kit.add(rope([P(c, r), P(c, r + 1)], 0.02, 3), C.net, { jitter: 0.05 });
      for (let r = 0; r < rowsN; r++) for (let c = 0; c + 1 < cols; c++) kit.add(rope([P(c, r), P(c + 1, r)], 0.02, 3), C.net, { jitter: 0.05 });
    }
    const loose: [number, number, 'barrel' | 'lying' | 'crate' | 'broken' | 'coil', number][] = [
      [10.8, -6.2, 'barrel', 0], [11.6, -5.4, 'lying', 0.8], [12.2, 2.6, 'crate', 0.4], [13.1, 1.8, 'broken', -0.3],
      [14.4, -4.6, 'coil', 0], [7.2, -10.2, 'barrel', 0], [8.8, -11.6, 'coil', 0], [17.8, -10.4, 'lying', 2.2],
    ];
    for (const [lx, lz, kind, yaw] of loose) {
      const [x, z] = hw(lx, lz), y = heightAt(x, z);
      if (kind === 'barrel') barrel(wm(x, y + 0.42, z, yaw, rng.range(-0.08, 0.08)));
      else if (kind === 'lying') barrel(wm(x, y + 0.3, z, yaw), true);
      else if (kind === 'crate') crate(wm(x, y - 0.05, z, yaw, 0.05), 0.75);
      else if (kind === 'broken') crate(wm(x, y - 0.04, z, yaw), 0.7, true);
      else coil(wm(x, y, z, yaw), 0.34);
      if (kind !== 'coil') this.colliders.push({ x, z, hw: 0.45, hd: 0.45, rot: -yaw, yTop: y + 0.9, yBottom: y - 1 });
    }
    // reef rocks around the hull in the water (mossy tops), a few in the shallows toward the beach
    const rocks: [number, number, number][] = [
      [-4.2, 3, 1.4], [-4.0, 6, 1.1], [-3.2, 9.4, 1.6], [0.5, 10.6, 1.3], [3.8, 8.5, 1.2], [4.4, 5.2, 0.9], [4.8, 2.5, 1.0],
      [-4.4, -1.5, 0.9], [-3.8, -6.5, 1.2], [4.3, -5.8, 0.8], [6.8, 4, 0.7], [-6.3, 7.5, 0.8], [6.2, 10.5, 1.4], [-2.0, 12.4, 1.1],
      [7.5, -3.8, 0.6], [6.2, 3.2, 0.5], [8.5, 7.0, 0.9],
    ];
    // E114: the reef rocks are rockKit rocks (smooth painted). The draws the old flat-shaded rocks took (the rock, its
    // side colour, one per face) are still burnt, so everything after the rocks is placed as it always was
    const rockRng = new Rng(SEED ^ 0x70c5), reef: THREE.BufferGeometry[] = [];
    for (const [lx, lz, r] of rocks) {
      const [x, z] = hw(lx, lz), y = heightAt(x, z);
      const old = rock(r, 1, rng, 0.62, 0.3);
      rng.next();
      const mossy = rng.next() < 0.6, m = wm(x, y + r * 0.2, z, rng.range(0, 6));
      for (let i = old.getAttribute('position').count / 3; i > 0; i--) rng.next();
      old.dispose();
      const g = rockGeometry(r, rockRng, { squash: 0.62, palette: REEF_ROCK, moss: mossy ? 0.9 : 0.5, ground: -0.2 * r });
      g.applyMatrix4(m); reef.push(g);
      if (r > 0.9) this.colliders.push({ x, z, hw: r * 0.8, hd: r * 0.8, rot: 0, yTop: y + r * 0.7, yBottom: y - 2 });
    }
    if (reef.length > 0) {
      // their own smooth normals can't join the flat-shaded kit: all the rocks are one more draw
      const rm = new THREE.Mesh(mergeGeometries(reef, false), rockMaterial(this.sky));
      for (const s of reef) s.dispose();
      rm.name = 'wreck-rocks'; rm.castShadow = true; rm.receiveShadow = true;
      this.group.add(rm);
    }
    // flotsam: planks lying in the shallows by the stern, a spar leaning on the hull
    for (let k = 0; k < 6; k++) {
      const [x, z] = hw(rng.range(2, 7), rng.range(4, 13)), yaw = rng.range(0, Math.PI);
      kit.add(plank(rng.range(1.2, 2.4), rng.range(0.22, 0.3), 0.06, rng, 0.02), rng.next() < 0.5 ? C.hullGrey : C.hull, { matrix: wm(x, Math.max(heightAt(x, z) + 0.04, sea + 0.01), z, yaw, 0, rng.range(-0.1, 0.1)) });
    }
    {
      const [x0, z0] = hw(4.6, 7.2), [x1, z1] = hw(2.4, 3.2);
      kit.add(log(new THREE.Vector3(x0, heightAt(x0, z0) + 0.1, z0), new THREE.Vector3(x1, this.floorY + 1.6, z1), 0.16, 0.12, 6), C.mast);
    }

    // ── finish: merge, AO (fine cells so the hold shades), the lanterns baked in ──
    const geo = kit.finish({ ao: { ground: heightAt, cell: 0.22, strength: 0.7 } });
    bakeLight(geo, lamps);
    this.mesh = new THREE.Mesh(geo, lowPolyMaterial(this.sky));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = swayDepthMaterial();   // the torn sail's shadow flutters with it (M5)
    this.group.add(this.mesh);
    const gGeo = glow.finish({ ao: false });
    const cols = gGeo.getAttribute('color');
    for (let i = 0; i < cols.count; i++) cols.setXYZ(i, cols.getX(i) * 3.2, cols.getY(i) * 3.2, cols.getZ(i) * 3.2);
    this.glow = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.glow.name = 'wreck-lanterns';
    this.group.add(this.glow);

    // ── colliders: hull walls around the hold (a gap at the breach), the bow + stern blocks, the deck rails ──
    const fl = this.floorY;
    this.floorPlane = this.plane([this.F(0, 0, 0), this.F(1, 0, 0), this.F(0, 0, 1)]);
    this.bowPlane = this.plane([this.H(0, BOW_DECK, -6), this.H(1, BOW_DECK, -6), this.H(0, BOW_DECK, -5)]);
    this.quarterPlane = this.plane([this.H(0, QUARTER_DECK, 7), this.H(1, QUARTER_DECK, 7), this.H(0, QUARTER_DECK, 8)]);
    const wall = (za: number, zb: number, side: number): void => {
      const [p0, s0] = this.floorHalf(za), [p1, s1] = this.floorHalf(zb), w = side > 0 ? Math.min(s0, s1) : Math.min(p0, p1);
      this.colliders.push(this.box(side * (w + 0.5), (za + zb) / 2, 0.45, (zb - za) / 2, 3.1));
    };
    for (let z = HOLD_Z0; z < HOLD_Z1 - 0.01; z += 1.9) wall(z, Math.min(HOLD_Z1, z + 1.9), -1);
    wall(HOLD_Z0, BREACH_Z0, 1); wall(BREACH_Z1, BREACH_Z1 + 1.9, 1); wall(BREACH_Z1 + 1.9, HOLD_Z1, 1);
    const deckLow = (pl: { a: number; bx: number; bz: number }, z: number, w: number): number => Math.min(pl.a + pl.bx * w + pl.bz * z, pl.a - pl.bx * w + pl.bz * z);
    const bowTop = Math.min(deckLow(this.bowPlane, HOLD_Z0, 2.4), deckLow(this.bowPlane, -L / 2, 1));
    const aftTop = Math.min(deckLow(this.quarterPlane, HOLD_Z1, 2.6), deckLow(this.quarterPlane, L / 2, 2.2));
    this.colliders.push({ ...this.boxW(0, (HOLD_Z0 - L / 2 + 0.6) / 2, 2.3, (HOLD_Z0 + L / 2 - 0.6) / 2), yTop: bowTop - 0.35, yBottom: fl - 4 });
    this.colliders.push({ ...this.boxW(0, (HOLD_Z1 + L / 2) / 2, 2.5, (L / 2 - HOLD_Z1) / 2), yTop: aftTop - 0.35, yBottom: fl - 4 });
    for (const side of [-1, 1]) {
      this.colliders.push({ ...this.boxW(side * 2.25, (HOLD_Z0 - 7.5) / 2, 0.15, (HOLD_Z0 + 7.5) / 2 * -1), yTop: bowTop + 3.2, yBottom: bowTop - 0.1 });
      this.colliders.push({ ...this.boxW(side * 2.5, (HOLD_Z1 + 9) / 2, 0.15, (9 - HOLD_Z1) / 2), yTop: aftTop + 3.2, yBottom: aftTop - 0.1 });
    }
    this.colliders.push({ ...this.boxW(0, L / 2 - 0.1, 2.4, 0.15), yTop: aftTop + 3.2, yBottom: aftTop - 0.1 });

    // the hold as a cylinder for the reverb zone
    const hc = this.F(0, 0, (HOLD_Z0 + HOLD_Z1) / 2);
    this.holdBounds = { x: hc.x, z: hc.z, r: (HOLD_Z1 - HOLD_Z0) / 2 + 0.3, yMin: fl - 0.6, yMax: fl + 2.9 };
    return this;
  }

  /** a hull-aligned box collider from floor-frame centre (x, z), half sizes, height over the floor */
  private box(x: number, z: number, hwx: number, hdz: number, h: number): Collider {
    const c = this.F(x, 0, z);
    return { x: c.x, z: c.z, hw: hwx, hd: hdz, rot: -this.spec.heading, yTop: c.y + h, yBottom: c.y - 1.5 };
  }
  /** a hull-aligned box footprint (no heights) from hull-aligned local (x, z) */
  private boxW(x: number, z: number, hwx: number, hdz: number): { x: number; z: number; hw: number; hd: number; rot: number } {
    return { x: this.spec.x + x * this.cs + z * this.sn, z: this.spec.z - x * this.sn + z * this.cs, hw: hwx, hd: Math.abs(hdz), rot: -this.spec.heading };
  }
  /** an anchor at floor-frame (x, z) facing local yaw */
  private anchor(x: number, z: number, yaw: number): WreckAnchor {
    const p = this.F(x, 0, z);
    return { x: p.x, y: p.y, z: p.z, yaw: this.spec.heading + yaw };
  }

  /** PHYSICS P4: this builder's static collision in world space — its walls / posts (the legacy boxes) and every floor
   *  `floorHeightAt` describes, as real geometry. src/physics/pieces.ts turns it into Rapier colliders.
   *
   *  Every floor is a slab whose top lies in the plane `floorHeightAt` uses there (the pitched hold floor, the heeled
   *  bow / quarter decks, the hatch-cover ramp), over the same hull-aligned footprint: the hold one row per `floorW`
   *  row, the decks one strip per 0.25 m of hull length. The hold stair is treads, never a ramp (see below). */
  colliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = this.colliders.map((c) => boxDesc(c));
    const fp = this.floorPlane;
    // the hold floor: one slab per run of equal-width 0.25 m rows (floorHalf rounds z to the nearest row)
    const rows = this.floorW.length;
    for (let i = 0; i < rows;) {
      const w = this.floorW[i] ?? [1.5, 1.5];
      let j = i + 1;
      while (j < rows && this.floorW[j]?.[0] === w[0] && this.floorW[j]?.[1] === w[1]) j++;
      const z0 = Math.max(HOLD_Z0, HOLD_Z0 + (i - 0.5) * 0.25), z1 = Math.min(HOLD_Z1, HOLD_Z0 + (j - 0.5) * 0.25);
      out.push(this.planeBox(fp, -w[0], w[1], z0, z1));
      i = j;
    }
    // the stair up the port side to the forecastle, as treads from the floor at its foot
    {
      const xc = (STAIR.x0 + STAIR.x1) / 2, at = (lz: number): number => fp.a + fp.bx * xc + fp.bz * lz;
      // the mesh's 8 planks rise 0.325 m in the floor frame, 0.342 m in the world once the hull's pitch is added: a step
      // the character (0.35 m autostep less its 0.02 m skin) stalls on. So the treads rise 0.325 m in the world, and a
      // 9th tread of the same run carries the stair on under the forecastle's aft edge (it hides in the deck there)
      const count = 9, rise = BOW_DECK / 8, run = (STAIR.z0 - STAIR.z1) / 8, zTop = STAIR.z0 - run * count;
      out.push({ kind: 'treads', from: this.world(xc, at(STAIR.z0), STAIR.z0), to: this.world(xc, at(STAIR.z0) + rise * count, zTop), width: STAIR.x1 - STAIR.x0, count });
    }
    // the hatch-cover ramp out of the breach: level floor out to the ramp's head where a row stops short of it, then
    // the slope down to the sand
    {
      const rz0 = BREACH_Z0 + 0.25, rz1 = BREACH_Z1 - 0.25;
      for (let i = 0; i < rows; i++) {
        const z0 = Math.max(rz0, HOLD_Z0 + (i - 0.5) * 0.25), z1 = Math.min(rz1, HOLD_Z0 + (i + 0.5) * 0.25), sw = this.floorW[i]?.[1] ?? 1.5;
        if (z1 > z0 && sw < this.rampX0 - 0.005) out.push(this.planeBox(fp, sw, this.rampX0, z0, z1));
      }
      const g = this.rampGround / this.rampLen;
      out.push(this.planeBox({ a: fp.a - g * this.rampX0, bx: fp.bx + g, bz: fp.bz }, this.rampX0, this.rampX0 + this.rampLen, rz0, rz1));
    }
    // the forecastle and the quarterdeck: strips as wide as the deck gets across each (so no floor point is missed)
    const decks: [Plane, number, number, number][] = [[this.bowPlane, -L / 2 + 1.2, HOLD_Z0, BOW_DECK], [this.quarterPlane, HOLD_Z1, L / 2 - 0.2, QUARTER_DECK]];
    for (const [pl, za, zb, y] of decks) {
      for (let z0 = za; z0 < zb - 1e-6; z0 += 0.25) {
        const z1 = Math.min(zb, z0 + 0.25), w = Math.max(halfWidthAt(tOf(z0), y), halfWidthAt(tOf(z1), y)) - 0.3;
        if (w > 0) out.push(this.planeBox(pl, -w, w, z0, z1));
      }
    }
    return out;
  }

  /** hull-aligned horizontal local (lx, y, lz) → world */
  private world(lx: number, y: number, lz: number): { x: number; y: number; z: number } {
    return { x: this.spec.x + lx * this.cs + lz * this.sn, y, z: this.spec.z - lx * this.sn + lz * this.cs };
  }

  /** a SLAB-thick box whose top lies in the plane `pl` over the local footprint lx0‥lx1 × lz0‥lz1 */
  private planeBox(pl: Plane, lx0: number, lx1: number, lz0: number, lz1: number): ColliderDesc {
    // the slab's axes in the hull-aligned frame: e1 along lx in the plane, n its normal, e3 = e1 × n (≈ along lz)
    const e1 = new THREE.Vector3(1, pl.bx, 0).normalize();
    const n = new THREE.Vector3(-pl.bx, 1, -pl.bz).normalize();
    const e3 = new THREE.Vector3().crossVectors(e1, n);
    const lxc = (lx0 + lx1) / 2, lzc = (lz0 + lz1) / 2;
    const c = new THREE.Vector3(lxc, pl.a + pl.bx * lxc + pl.bz * lzc, lzc).addScaledVector(n, -SLAB);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(e1, n, e3).premultiply(new THREE.Matrix4().makeRotationY(this.spec.heading)));
    const w = this.world(c.x, c.y, c.z);
    return { kind: 'box', ...w, hx: (lx1 - lx0) / 2 / e1.x, hy: SLAB, hz: (lz1 - lz0) / 2 / e3.z, rot: { x: q.x, y: q.y, z: q.z, w: q.w } };
  }

  /** the walkable wood under (x, z): the hold floor, the stair, the breach ramp, the forecastle and the quarterdeck */
  floorHeightAt(x: number, z: number): number | undefined {
    const [lx, lz] = this.local(x, z);
    const at = (p: { a: number; bx: number; bz: number }): number => p.a + p.bx * lx + p.bz * lz;
    if (lz >= HOLD_Z0 && lz <= HOLD_Z1) {
      const [pw, sw] = this.floorHalf(lz);
      if (lx >= -pw && lx <= sw) {
        // the stair up the port side to the forecastle
        if (lx >= STAIR.x0 && lx <= STAIR.x1 && lz <= STAIR.z0) return at(this.floorPlane) + BOW_DECK * Math.min(1, (STAIR.z0 - lz) / (STAIR.z0 - STAIR.z1));
        return at(this.floorPlane);
      }
      // the hatch-cover ramp out of the breach
      if (lz > BREACH_Z0 + 0.25 && lz < BREACH_Z1 - 0.25 && lx > sw && lx < this.rampX0 + this.rampLen) {
        const f = (lx - this.rampX0) / this.rampLen;
        return at(this.floorPlane) + this.rampGround * Math.max(0, f);
      }
      return undefined;
    }
    if (lz < HOLD_Z0 && lz > -L / 2 + 1.2) {
      const t = tOf(lz), w = halfWidthAt(t, BOW_DECK) - 0.3;
      return Math.abs(lx) < w ? at(this.bowPlane) : undefined;
    }
    if (lz > HOLD_Z1 && lz < L / 2 - 0.2) {
      const t = tOf(lz), w = halfWidthAt(t, QUARTER_DECK) - 0.3;
      return Math.abs(lx) < w ? at(this.quarterPlane) : undefined;
    }
    return undefined;
  }
}
