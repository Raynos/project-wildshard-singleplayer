// Pine Hollow's first-person hands as data (SHARD-PLATFORM M3, the viewmodel system ../runtime/viewmodel/gloveHands):
// the hunter's gloves on the Longbow, the crossbow and the lever-action (E322 F-M6, Jake's pick B: always on).
import type { ArmStyle } from '@wildshard/engine/player/firstPersonArms';

/** A palette key of the engine's arm builder (firstPersonArms). */
export type ArmPaletteKey = keyof ArmStyle;
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

/** A per-channel triple (a tint, a point). */
export type V3 = [number, number, number];
/** One hand as data: the fist's grip, curl and wrist, its forearm and its tints. */
export interface HandSpec {
  /** radius of what the fist closes on (firstPersonArms.gloveFist) */
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




/** The hunter's dark-tan leather gloves, a grey knit cuff, the sleeve of a waxed-canvas coat with leather patches (sRGB hex
 *  over the arm builder's palette); the coat cuff's worn lip and its stitches. */
export const HUNTER_HANDS: GloveHandsLook = {
  palette: {
    leather: 0x6a4a30, leatherLight: 0x8a6646, leatherDark: 0x3a281a, leatherEdge: 0x4a3424, thread: 0xa89878,
    fleece: 0x6e685e, fleeceShade: 0x524c44, fleeceDeep: 0x3a352f,
    wool: 0x5e5038, woolShade: 0x3e3424, red: 0x4a3422, redDeep: 0x33251a, redLine: 0x2a1e14,
  },
  coatLip: 0x8a7650,
  coatStitch: 0x2e2618,
};
/** The gloves' tint over the hunter palette (linear, per channel): a pale buckskin that reads against the walnut stocks. */
export const BUCKSKIN: [number, number, number] = [3.2, 4.2, 6.0];
/** The hands' material parameters (the Longbow's: the viewmodels' shared lit program, vertex colours × the 1×1 fillers). */
export const HANDS_MATERIAL = { roughness: 0.62, metalness: 0, envMapIntensity: 0.55, specularIntensity: 0.5 };
/** The coat sleeve's material (a ViewmodelMaterialRow): the waxed canvas's baked maps (`coat`: runtime/viewmodel/gloveHands.ts coatSet). */
export const COAT_MATERIAL = { set: 'coat', normalScale: [0.8, 0.8], roughness: 1, metalness: 0, envMapIntensity: 0.5, specularIntensity: 0.5 } as const;
