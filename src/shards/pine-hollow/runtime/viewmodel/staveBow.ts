import * as THREE from 'three';
import { BowShape, type BowView, type GripPose } from '@wildshard/engine/combat/view/bowProfile';
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
  private readonly pos: Float32Array; private readonly nrm: Float32Array;
  private readonly posAttr: THREE.BufferAttribute; private readonly nrmAttr: THREE.BufferAttribute;
  private readonly shapeOwner: BowShape;

  constructor(look: StaveBowLook, rest: THREE.BufferGeometry, rows: { readonly ringU: readonly number[]; readonly ringSign: readonly number[]; readonly limbVerts: number; readonly dynVerts: number }) {
    this.look = look;
    this.dynVerts = rows.dynVerts;
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
    this.shapeOwner = new BowShape({ ...rows, curve: look, radial: look.radial, backScale: 0.55,
      tipArc: look.gripH + look.limbW + look.nockL - 0.014, tipOffset: 0.004,
      nockX: look.arrowX * 0.3, nockY: look.arrowY - 0.004, drawZ: look.braceZ + look.drawLen,
      stringRadial: look.stringRadial, stringRadius: look.stringR, serving: look.serving }, {
      position: this.posAttr, normal: this.nrmAttr, tipTop: this.tipTop, tipBot: this.tipBot, nock: this.nock,
      section: u => this.limbSection(u), ridge: (u, angle, sign) => this.gripWrap(u, angle, sign),
    });
    this.shape(0, 0);
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

  /** The common traversal borrows this stave's owned dynamic channels and local section laws. */
  shape(p: number, nockDraw: number): void { this.shapeOwner.shape(p, nockDraw); }

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
