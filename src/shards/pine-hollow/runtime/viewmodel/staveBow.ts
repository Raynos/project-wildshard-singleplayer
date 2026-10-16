import * as THREE from 'three';
import { BowShape, type BowView, type GripPose } from '@wildshard/engine/combat/view/bowProfile';
import * as v from 'valibot';
import { bakedBowRows, handsPart, type BakedBow } from '../boot/handsGeometry';

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

const finite = v.pipe(v.number(), v.finite()), pair = v.tuple([finite, finite]);
/** The arrow's exact authored length and palette. */
const ArrowLookSchema = v.strictObject({ length: finite, shaft: finite, shaftDark: finite, binding: finite, head: finite, feather: finite, featherBar: finite });
const optional = v.exactOptional(finite);
const fist = v.strictObject({ R: finite, mirror: v.exactOptional(v.boolean()), thumbRing: v.exactOptional(v.boolean()), span: v.exactOptional(finite),
  yaw: v.exactOptional(finite), curl: v.exactOptional(finite), thumbCurl: v.exactOptional(finite) });
/** Exact client look from the admitted hand bake, including the serialised input-key order. */
export const StaveBowLookSchema = v.strictObject({ gripH: finite, limbW: finite, nockL: finite, kappaRest: finite, kappaDraw: finite,
  braceZ: finite, drawLen: finite, arrowX: finite, arrowY: finite, radial: finite, stringRadial: finite, stringR: finite, serving: finite,
  palette: v.strictObject({ sap: finite, sapDark: finite, heart: finite, heartDark: finite, heartHi: finite, horn: finite, hornHi: finite,
    leather: finite, leatherHi: finite, amber: finite, string: finite, serving: finite }),
  arrow: ArrowLookSchema, hands: v.strictObject({ leather: optional, leatherLight: optional, leatherDark: optional, leatherEdge: optional,
    thread: optional, fleece: optional, fleeceShade: optional, fleeceDeep: optional, wool: optional, woolShade: optional, red: optional, redDeep: optional, redLine: optional,
    gold: optional, jade: optional, jadeDark: optional }),
  leftFist: fist, rightFist: fist, rightRoll: finite, leftSleeve: pair, rightSleeve: pair });
export type ArrowLook = v.InferOutput<typeof ArrowLookSchema>;
export type StaveBowLook = v.InferOutput<typeof StaveBowLookSchema>;
/** Only read after held-pool admission; the bake remains the single owner of its look. */
export function longbowLook(): StaveBowLook { return v.parse(StaveBowLookSchema, JSON.parse(bakedBowRows().look)); }
/** A grip pose as data: the bow's place and aim point in rig space, its cant and pitch. */
export interface GripPoseRow { readonly pos: readonly [number, number, number]; readonly aim: readonly [number, number, number]; readonly cant: number; readonly pitch: number }

/** The bake's Longbow rows, checked against `look` (a look the pool was not baked with refuses). */
function bakedBow(look: StaveBowLook): BakedBow {
  const rows = bakedBowRows();
  if (JSON.stringify(look) !== rows.look) throw new Error('[pine-hollow hands] this stave bow is not baked: run src/shards/pine-hollow/generators/bake-hands-pool.mjs');
  return rows;
}
/** The baked arrow for `look` (its loose copy, no uv): borrowed from the pool, never mutated or disposed. */
export function arrowGeometry(look: ArrowLook): THREE.BufferGeometry {
  if (JSON.stringify(look) !== bakedBowRows().arrow) throw new Error('[pine-hollow hands] this arrow is not baked: run src/shards/pine-hollow/generators/bake-hands-pool.mjs');
  return handsPart('bow-arrow');
}

/** The stave and its string over the baked rest geometry (its colours, uv, index and the static left fist after them; a
 *  copy of its positions and normals once another stave bends the first). The first `dynVerts` vertices (limbs + string)
 *  are rewritten by `shape(draw, nock)`. Each limb: the stiff grip, then a working limb of near-constant bend κ(p) toward
 *  the archer, then the horn nock. */
export class StaveBowMesh {
  readonly geometry: THREE.BufferGeometry;
  readonly dynVerts: number;
  readonly tipTop = new THREE.Vector3(); readonly tipBot = new THREE.Vector3(); readonly nock = new THREE.Vector3();
  private readonly shapeOwner: BowShape;

  constructor(look: StaveBowLook, rest: THREE.BufferGeometry, rows: Pick<BakedBow, 'ringU' | 'ringSign' | 'limbVerts' | 'dynVerts' | 'sectionSamples'>) {
    this.dynVerts = rows.dynVerts;
    const { geometry, position, normal } = BowShape.prepareGeometry(rest);
    this.geometry = geometry;
    this.shapeOwner = new BowShape({ ...rows, curve: look, radial: look.radial, backScale: 0.55,
      tipArc: look.gripH + look.limbW + look.nockL - 0.014, tipOffset: 0.004,
      nockX: look.arrowX * 0.3, nockY: look.arrowY - 0.004, drawZ: look.braceZ + look.drawLen,
      stringRadial: look.stringRadial, stringRadius: look.stringR, serving: look.serving }, {
      position, normal, tipTop: this.tipTop, tipBot: this.tipBot, nock: this.nock,
    });
    this.shape(0, 0);
  }

  /** The common traversal borrows this stave's dynamic channels and baked section samples. */
  shape(p: number, nockDraw: number): void { this.shapeOwner.shape(p, nockDraw); }

}

/** The braced stave with the left glove on it (the bow's one mesh) in the look's hand palette: a display card's geometry. */
export function staveBowSpecimen(look: StaveBowLook): THREE.BufferGeometry {
  return new StaveBowMesh(look, handsPart('bow-stave'), bakedBow(look)).geometry;
}

/** The platform bow's view strategy for a stave bow, every part on `mat` (the viewmodels' shared lit program, vertex
 *  colours × the 1×1 fillers): the stave with the left fist, the nocked arrow, the right fist and both sleeves. */
export function staveBowView(look: StaveBowLook, mat: THREE.Material): BowView {
  const b = bakedBow(look), vector = (t: readonly number[]): THREE.Vector3 => new THREE.Vector3().fromArray(t);
  const rWristDir = vector(b.rWristDir);
  const roll = new THREE.Quaternion().setFromAxisAngle(rWristDir, look.rightRoll);
  const mesh = new StaveBowMesh(look, handsPart('bow-stave'), b);
  const nocked = new THREE.Mesh(handsPart('bow-arrow-nocked'), mat);
  const rHand = new THREE.Mesh(handsPart('bow-right-fist'), mat);
  const lSleeve = new THREE.Mesh(handsPart('bow-left-sleeve'), mat);
  const rSleeve = new THREE.Mesh(handsPart('bow-right-sleeve'), mat);
  return { mat, mesh, nocked, rHand, lSleeve, rSleeve, lWrist: vector(b.lWrist), rWrist: vector(b.rWrist), rHook: vector(b.rHook), rWristDir, roll };
}

/** A look's grip poses (triples) as the platform bow's GripPose, keys kept. */
export function bowPoses<K extends string>(rows: Readonly<Record<K, GripPoseRow>>): Record<K, GripPose> {
  const out = {} as Record<K, GripPose>;
  for (const k of Object.keys(rows) as K[]) { const r = rows[k]; out[k] = { pos: new THREE.Vector3(...r.pos), aim: new THREE.Vector3(...r.aim), cant: r.cant, pitch: r.pitch }; }
  return out;
}
