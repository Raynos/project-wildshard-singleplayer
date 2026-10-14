import * as THREE from 'three';
import type { BowView, GripPose } from '@wildshard/engine/combat/view/bowProfile';
import type { FistOpts } from '@wildshard/engine/player/nalatiArms';
import type { ArmPaletteRow } from './gloveHands';
import { BAKED_BOW, handsPart } from '../../boot/handsGeometry';

/**
 * A stave bow in first person (SHARD-PLATFORM M3, the viewmodel system): one wooden stave that bends through its draw, its
 * string, a nocked arrow, two gloved fists and two sleeves, for the platform bow's view strategy (BowView). The shard's row
 * (StaveBowLook) holds the stave's proportions, its bend and its colours; the stave is painted as a self bow — a pale
 * sapwood back, a streaked heartwood belly with pin knots, a leather grip with an inlaid band, horn nocks. Every part is
 * baked (generators/handsPool.ts: the painted stave rings with the left fist, the right fist, the sleeves, the arrow);
 * this file borrows them from the preloaded pool and bends the stave and its string every draw.
 *
 *   arrowGeometry(look)            the baked arrow (TIP at the origin, +Z), borrowed
 *   new StaveBowMesh(look, rest)   the stave + string (rewritten by `shape(draw, nock)`) over the baked rest geometry
 *   staveBowView(look, material)   the whole BowView: the stave with the left fist on it, the nocked arrow, the right fist
 *                                  and both sleeves, in the look's hand palette
 *   bowPoses(rows)                 a look's grip poses (triples) as the platform's GripPose
 */

/** A stave bow's colours (sRGB hex): the sapwood back, the heartwood belly, horn nocks, the leather grip and its inlay, the string. */
export interface StaveBowPalette {
  readonly sap: number; readonly sapDark: number; readonly heart: number; readonly heartDark: number; readonly heartHi: number;
  readonly horn: number; readonly hornHi: number; readonly leather: number; readonly leatherHi: number; readonly amber: number;
  readonly string: number; readonly serving: number;
}
/** An arrow as data: its length and its colours (sRGB hex). */
export interface ArrowLook {
  readonly length: number;
  readonly shaft: number; readonly shaftDark: number; readonly binding: number; readonly head: number;
  readonly feather: number; readonly featherBar: number;
}
/** A fist on the bow: nalatiArms.gloveFist's options. */
export type StaveFist = Readonly<FistOpts>;
/** A stave bow as data. Bow-local frame: the grip centre at the origin, +Y up the bow, −Z where the arrow flies (the back),
 *  +Z toward the archer (the belly), +X the archer's right; the arrow rests left of the grip. */
export interface StaveBowLook {
  /** the stiff grip's half length, the working limb's length and the horn nock's (m) */
  readonly gripH: number; readonly limbW: number; readonly nockL: number;
  /** the limbs' bend (1/m) at rest and its rise at full draw */
  readonly kappaRest: number; readonly kappaDraw: number;
  /** the braced string's distance from the grip and the draw length (m) */
  readonly braceZ: number; readonly drawLen: number;
  /** the arrow's rest beside the grip (m) */
  readonly arrowX: number; readonly arrowY: number;
  /** segments round the stave and round the string, the string's radius and its served length at the nock (m) */
  readonly radial: number; readonly stringRadial: number; readonly stringR: number; readonly serving: number;
  readonly palette: StaveBowPalette;
  /** the arrow nocked on the string */
  readonly arrow: ArrowLook;
  /** the gloves' and sleeves' palette over the arm builder's */
  readonly hands: ArmPaletteRow;
  /** the left fist round the grip, the right fist on the string, and the right fist's roll about its wrist (rad) */
  readonly leftFist: StaveFist; readonly rightFist: StaveFist; readonly rightRoll: number;
  /** each sleeve's length (m) and fold seed (nalatiArms.riderArm) */
  readonly leftSleeve: readonly [number, number]; readonly rightSleeve: readonly [number, number];
}
/** A grip pose as data: the bow's place and aim point in rig space, its cant and pitch. */
export interface GripPoseRow { readonly pos: readonly [number, number, number]; readonly aim: readonly [number, number, number]; readonly cant: number; readonly pitch: number }

const STRING_RINGS = 4;

/** The bake's Longbow rows, checked against `look` (a look the pool was not baked with refuses). */
function bakedBow(look: StaveBowLook): typeof BAKED_BOW {
  if (JSON.stringify(look) !== BAKED_BOW.look) throw new Error('[pine-hollow hands] this stave bow is not baked: run src/shards/pine-hollow/generators/bake-hands-pool.mjs');
  return BAKED_BOW;
}
/** The baked arrow for `look` (its loose copy, no uv): borrowed from the pool, never mutated or disposed. */
export function arrowGeometry(look: ArrowLook): THREE.BufferGeometry {
  if (JSON.stringify(look) !== BAKED_BOW.arrow) throw new Error('[pine-hollow hands] this arrow is not baked: run src/shards/pine-hollow/generators/bake-hands-pool.mjs');
  return handsPart('bow-arrow');
}

const _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3(), _b3 = new THREE.Vector3();
/** Baked rest geometries whose position / normal arrays a stave already bends (the next one bends its own copies). */
const taken = new WeakSet<THREE.BufferGeometry>();
const ownArray = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array => {
  if (!(a instanceof THREE.BufferAttribute) || !(a.array instanceof Float32Array)) throw new Error('[pine-hollow hands] the stave needs Float32 rest channels');
  return a.array;
};

/** The stave and its string over the baked rest geometry (its colours, uv, index and the static left fist after them; a
 *  copy of its positions and normals once another stave bends the first). The first `dynVerts` vertices (limbs + string)
 *  are rewritten by `shape(draw, nock)`. Each limb: the stiff grip, then a working limb of near-constant bend κ(p) toward
 *  the archer, then the horn nock. */
export class StaveBowMesh {
  readonly geometry: THREE.BufferGeometry;
  readonly dynVerts: number;
  readonly tipTop = new THREE.Vector3(); readonly tipBot = new THREE.Vector3(); readonly nock = new THREE.Vector3();
  private readonly look: StaveBowLook;
  private readonly bowLen: number;
  private readonly ringU: readonly number[];
  private readonly ringSign: readonly number[];
  private readonly pos: Float32Array; private readonly nrm: Float32Array;
  private readonly posAttr: THREE.BufferAttribute; private readonly nrmAttr: THREE.BufferAttribute;
  private readonly limbVerts: number;
  private lastP = -1; private lastNock = -1;

  constructor(look: StaveBowLook, rest: THREE.BufferGeometry, rows: { readonly ringU: readonly number[]; readonly ringSign: readonly number[]; readonly limbVerts: number; readonly dynVerts: number }) {
    this.look = look;
    this.bowLen = look.gripH + look.limbW + look.nockL;
    this.ringU = rows.ringU; this.ringSign = rows.ringSign; this.limbVerts = rows.limbVerts; this.dynVerts = rows.dynVerts;
    const restPos = ownArray(rest.getAttribute('position')), restNrm = ownArray(rest.getAttribute('normal'));
    if (taken.has(rest)) {
      this.pos = restPos.slice(); this.nrm = restNrm.slice();
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('color', rest.getAttribute('color'));
      this.geometry.setAttribute('uv', rest.getAttribute('uv'));
      this.geometry.setIndex(rest.getIndex());
    } else {
      taken.add(rest);
      this.geometry = rest; this.pos = restPos; this.nrm = restNrm;
    }
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.nrmAttr = new THREE.BufferAttribute(this.nrm, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage); this.nrmAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('normal', this.nrmAttr);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this.shape(0, 0);
  }

  private limbAt(u: number, sign: number, p: number, pos: THREE.Vector3, tan: THREE.Vector3): void {
    const { gripH: GRIP_H, limbW: LIMB_W } = this.look;
    const k = this.look.kappaRest + this.look.kappaDraw * p;
    if (u <= GRIP_H) { pos.set(0, sign * u, 0); tan.set(0, sign, 0); return; }
    // the bend grows along the limb (a stave bends through the handle's ends and the mid-limb most, the tips least)
    const w = Math.min(u - GRIP_H, LIMB_W);
    const th = k * w;
    let y = GRIP_H + Math.sin(th) / k, z = (1 - Math.cos(th)) / k;
    let a = th;
    if (u > GRIP_H + LIMB_W) { a = k * LIMB_W; const s = u - GRIP_H - LIMB_W; y += Math.cos(a) * s; z += Math.sin(a) * s; }
    pos.set(0, sign * y, z); tan.set(0, sign * Math.cos(a), Math.sin(a));
  }
  /** half width (x) and half thickness (belly-back) at u — a D section: deep at the handle, tapering to the nocks */
  private limbSection(u: number): [number, number] {
    const { gripH: GRIP_H, limbW: LIMB_W, nockL: NOCK_L } = this.look;
    if (u <= GRIP_H) return [0.0145, 0.019];
    const w = u - GRIP_H;
    if (w <= LIMB_W) { const t = w / LIMB_W, fade = Math.exp(-((w / 0.035) ** 2)); return [0.0145 - 0.0065 * t + 0.001 * fade, 0.0155 - 0.008 * t + 0.0035 * fade]; }
    const t = (w - LIMB_W) / NOCK_L;
    return [0.0075 - 0.0025 * t + 0.0012 * Math.sin(t * Math.PI), 0.0072 - 0.002 * t + 0.0012 * Math.sin(t * Math.PI)];
  }
  private gripWrap(u: number, ph: number, sign: number): number { return u < this.look.gripH ? 1 + 0.06 * Math.max(0, Math.sin(u * 300 * sign + ph * 2)) ** 3 : 1; }

  /** bend the limbs for draw `p` (0..1) and pull the string to `nockDraw` (0 = braced, 1 = full, < 0 overshoot) */
  shape(p: number, nockDraw: number): void {
    const pc = Math.max(0, Math.min(1.08, p));
    if (Math.abs(pc - this.lastP) < 0.0015 && Math.abs(nockDraw - this.lastNock) < 0.0015) return;
    this.lastP = pc; this.lastNock = nockDraw;
    const RADIAL = this.look.radial, BOW_LEN = this.bowLen;
    const P = this.pos, N = this.nrm;
    const c = _b1, t = _b2, n = _b3;
    const rings = this.ringU.length;
    for (let r = 0; r < rings; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      this.limbAt(u, sign, pc, c, t);
      n.set(0, -t.z * sign, t.y * sign);
      const [hw, ht] = this.limbSection(u);
      for (let k = 0; k <= RADIAL; k++) {
        const ph = (k / RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        // a D section: the back (sp < 0) flat-ish, the belly rounded
        const flat = sp < 0 ? 0.55 : 1;
        const j = (r * (RADIAL + 1) + k) * 3;
        const rr = this.gripWrap(u, ph, sign);
        P[j] = cp * hw * rr; P[j + 1] = c.y + n.y * sp * ht * flat * rr; P[j + 2] = c.z + n.z * sp * ht * flat * rr;
        const ex = cp / hw, en = sp / (ht * flat), l = Math.hypot(ex, en) || 1;
        N[j] = ex / l; N[j + 1] = (n.y * en) / l; N[j + 2] = (n.z * en) / l;
      }
      if (r === 0 || r === rings - 1) {
        const j = (rings * (RADIAL + 1) + (r === 0 ? 0 : 1)) * 3;
        P[j] = 0; P[j + 1] = c.y + t.y * 0.004; P[j + 2] = c.z + t.z * 0.004;
        N[j] = 0; N[j + 1] = t.y; N[j + 2] = t.z;
      }
    }
    this.limbAt(BOW_LEN - 0.014, 1, pc, this.tipTop, t); this.tipTop.z += 0.004;
    this.limbAt(BOW_LEN - 0.014, -1, pc, this.tipBot, t); this.tipBot.z += 0.004;
    const braceZ = (this.tipTop.z + this.tipBot.z) / 2;
    this.nock.set(this.look.arrowX * 0.3, this.look.arrowY - 0.004, braceZ + (this.look.braceZ + this.look.drawLen - braceZ) * Math.max(-0.12, nockDraw));
    this.nock.z = Math.max(this.nock.z, braceZ - 0.03);
    this.writeLeg(0, this.tipBot, this.nock);
    this.writeLeg(1, this.tipTop, this.nock);
    this.posAttr.clearUpdateRanges(); this.posAttr.addUpdateRange(0, this.dynVerts * 3); this.posAttr.needsUpdate = true;
    this.nrmAttr.clearUpdateRanges(); this.nrmAttr.addUpdateRange(0, this.dynVerts * 3); this.nrmAttr.needsUpdate = true;
  }

  private writeLeg(leg: number, a: THREE.Vector3, b: THREE.Vector3): void {
    const STRING_RADIAL = this.look.stringRadial, STRING_R = this.look.stringR;
    const d = _b1.subVectors(b, a).normalize();
    const e1 = _b2.set(1, 0, 0); e1.addScaledVector(d, -e1.dot(d)).normalize();
    const e2 = _b3.crossVectors(d, e1);
    const o = this.limbVerts + leg * STRING_RINGS * STRING_RADIAL;
    const len = a.distanceTo(b), sv = Math.max(0, 1 - this.look.serving / Math.max(len, 1e-3));
    const at = [0, Math.max(0, sv - 0.004), sv, 1];
    for (let ring = 0; ring < STRING_RINGS; ring++) {
      const f = at[ring] ?? 1, rad = STRING_R * (ring >= 2 ? 1.3 : 1);
      const cx = a.x + (b.x - a.x) * f, cy = a.y + (b.y - a.y) * f, cz = a.z + (b.z - a.z) * f;
      for (let k = 0; k < STRING_RADIAL; k++) {
        const ph = (k / STRING_RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        const j = (o + ring * STRING_RADIAL + k) * 3;
        const nx = e1.x * cp + e2.x * sp, ny = e1.y * cp + e2.y * sp, nz = e1.z * cp + e2.z * sp;
        this.pos[j] = cx + nx * rad; this.pos[j + 1] = cy + ny * rad; this.pos[j + 2] = cz + nz * rad;
        this.nrm[j] = nx; this.nrm[j + 1] = ny; this.nrm[j + 2] = nz;
      }
    }
  }
}

/** The braced stave with the left glove on it (the bow's one mesh) in the look's hand palette: a display card's geometry. */
export function staveBowSpecimen(look: StaveBowLook): THREE.BufferGeometry {
  return new StaveBowMesh(look, handsPart('bow-stave'), bakedBow(look)).geometry;
}

/** The platform bow's view strategy for a stave bow, every part on `mat` (the viewmodels' shared lit program, vertex
 *  colours × the 1×1 fillers): the stave with the left fist, the nocked arrow, the right fist and both sleeves. */
export function staveBowView(look: StaveBowLook, mat: THREE.Material): BowView {
  const b = bakedBow(look), v = (t: readonly number[]): THREE.Vector3 => new THREE.Vector3().fromArray(t);
  const rWristDir = v(b.rWristDir);
  const roll = new THREE.Quaternion().setFromAxisAngle(rWristDir, look.rightRoll);
  const mesh = new StaveBowMesh(look, handsPart('bow-stave'), b);
  const nocked = new THREE.Mesh(handsPart('bow-arrow-nocked'), mat);
  const rHand = new THREE.Mesh(handsPart('bow-right-fist'), mat);
  const lSleeve = new THREE.Mesh(handsPart('bow-left-sleeve'), mat);
  const rSleeve = new THREE.Mesh(handsPart('bow-right-sleeve'), mat);
  return { mat, mesh, nocked, rHand, lSleeve, rSleeve, lWrist: v(b.lWrist), rWrist: v(b.rWrist), rHook: v(b.rHook), rWristDir, roll };
}

/** The Longbow's baked parts are borrowed from the preloaded pool: a missing bake refuses here, before the view is built
 *  (`due` is kept for callers; there is nothing left to slice). */
export function prepareStaveBowHands(look: StaveBowLook, due?: () => Promise<void> | null): Promise<void> {
  void due;
  bakedBow(look);
  for (const part of ['bow-stave', 'bow-arrow-nocked', 'bow-right-fist', 'bow-left-sleeve', 'bow-right-sleeve']) handsPart(part);
  return Promise.resolve();
}

/** A look's grip poses (triples) as the platform bow's GripPose, keys kept. */
export function bowPoses<K extends string>(rows: Readonly<Record<K, GripPoseRow>>): Record<K, GripPose> {
  const out = {} as Record<K, GripPose>;
  for (const k of Object.keys(rows) as K[]) { const r = rows[k]; out[k] = { pos: new THREE.Vector3(...r.pos), aim: new THREE.Vector3(...r.aim), cant: r.cant, pitch: r.pitch }; }
  return out;
}
