import * as THREE from 'three';
import type { ARM_PAL } from '@wildshard/engine/player/nalatiArms';
import type { ViewmodelSet } from '@wildshard/engine/combat/view/ranged';
import { bakedHand, handsPart } from '../boot/handsGeometry';
import { loadPainted, painted } from '../looks/paintedTextures';

/**
 * Gloved first-person hands on a held weapon (SHARD-PLATFORM M3, the viewmodel system): the engine's gloved fist
 * (nalatiArms.gloveFist) in a shard's palette, with a forearm, under the weapon's model. The hands are baked
 * (generators/handsPool.ts, one rest-geometry pool the kit preloads); this file borrows them by their HandSpec, and the
 * held hosts (heldFirearm / heldLauncher `hands`) place and aim them.
 *
 *   handGeometry(look, spec)                     a gloved fist + a light forearm (gauntlet → knit cuff → canvas sleeve),
 *        in GRIP SPACE (nalatiArms': the grip along +Y through the origin, the back of a right hand toward +X, the forearm
 *        leaving toward +Z); one borrowed geometry, vertex-coloured, for the viewmodels' shared lit program
 *
 * The shard's look row (GloveHandsLook) holds the colours; the shapes are the system's.
 */

/** A palette key of the engine's arm builder (nalatiArms.ARM_PAL). */
export type ArmPaletteKey = keyof typeof ARM_PAL;
/** A palette row over the arm builder's: each key's colour as sRGB hex (linearised when it builds). */
export type ArmPaletteRow = Readonly<Partial<Record<ArmPaletteKey, number>>>;
/** A shard's gloved hands as data: the arm palette, the coat cuff's worn lip and its stitches (sRGB hex). */
export interface GloveHandsLook {
  /** the gloves, the knit cuff and the sleeve's colours over the arm builder's palette */
  readonly palette: ArmPaletteRow;
  /** the coat sleeve's turned-back lip, worn pale */
  readonly coatLip: number;
  /** the coat cuff's stitched seams */
  readonly coatStitch: number;
}

/** The coat's waxed-canvas maps (generators/coatCanvas.ts, baked offline), loaded ahead of `coatSet`. */
export function loadCoatTextures(): Promise<unknown> {
  return Promise.all([loadPainted('coatMap'), loadPainted('coatNormal'), loadPainted('coatArm')]);
}
/** The coat sleeve's texture set (data/handsLook.ts COAT_MATERIAL's `coat`: its five map slots all filled by the canvas). */
export function coatSet(): ViewmodelSet { return { map: painted('coatMap'), normalMap: painted('coatNormal'), armMap: painted('coatArm') }; }

// ───────────────────────────── a hand ─────────────────────────────

/** A per-channel triple (a tint, a point). */
export type V3 = [number, number, number];
/** One hand as data: the fist's grip, curl and wrist, its forearm and its tints. */
export interface HandSpec {
  /** radius of what the fist closes on (nalatiArms.gloveFist) */
  R: number;
  /** the left hand */
  mirror?: boolean;
  /** the finger stack's length (1 = 8.5 cm) */
  span?: number;
  /** how far the fingers close (1 = a fist, less = a cradle) */
  curl?: number;
  /** the thumb's (default: `curl`) */
  thumbCurl?: number;
  /** the wrist's bend: the forearm heads along +Z + bend[0]·(the back of the hand) + bend[1]·(+Y, toward the index) */
  bend?: readonly [number, number];
  /** the forearm's length from the wrist (m) */
  armLen?: number;
  /** × the palette (the viewmodel sits in the weapon's shade: 1 = the palette as it is) */
  tint?: number;
  /** the glove's own tint per channel (linear), over `tint` for the fist and gauntlet */
  gloveTint?: V3;
  /** a free sleeve: the forearm is its own mesh, aimed every frame from the wrist at this point in CAMERA space (an elbow
   *  below the frame), so it keeps coming in from the bottom of the screen whatever the weapon's pose does */
  elbow?: V3;
  /** the coat sleeve (coatSleeve, its own mesh on the coat's textured material) over a short gauntlet, instead of the
   *  plain merged forearm */
  coat?: boolean;
}


/** A hand's geometry: `geometry` = the gloved fist in grip space, with its forearm merged in along the bent wrist — or,
 *  with a separate sleeve (`free`: aimed every frame; `spec.coat`: the coat, on its own material), the fist (+ the coat's
 *  gauntlet) and `sleeve` = the forearm along +Y from its origin, `wrist` = where that origin sits in grip space and `dir`
 *  = the wrist's bend there (grip space). Borrowed from the baked pool: never mutate or dispose it. */
export interface HandGeometry { geometry: THREE.BufferGeometry; sleeve: THREE.BufferGeometry | null; wrist: THREE.Vector3; dir: THREE.Vector3 }
/** A hand's bake key (generators/handsPool.ts): the look, the spec as the weapon passes it, and whether its sleeve is free. */
const handKey = (look: GloveHandsLook, spec: HandSpec, free: boolean): string => JSON.stringify([look, spec, free]);
/** One hand's baked geometry in `look`'s colours (see HandGeometry); a hand the pool was not baked with refuses. */
export function handGeometry(look: GloveHandsLook, spec: HandSpec, free = false): HandGeometry {
  const row = bakedHand(handKey(look, spec, free));
  if (row === undefined) throw new Error('[pine-hollow hands] this hand is not baked: run src/shards/pine-hollow/generators/bake-hands-pool.mjs');
  return { geometry: handsPart(row.geometry), sleeve: row.sleeve === null ? null : handsPart(row.sleeve), wrist: new THREE.Vector3().fromArray(row.wrist), dir: new THREE.Vector3().fromArray(row.dir) };
}

/** A hold as a weapon declares it: the hand's spec, where its fist closes (model space), the grip's direction toward the
 *  index / thumb end of the finger stack and the palm's facing; the held hosts place it (`HeldHandRow`, heldFirearm). */
export interface HandHold { spec: HandSpec; at: V3; axis: V3; palm: V3 }
