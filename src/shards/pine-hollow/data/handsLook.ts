// Pine Hollow's first-person hands as data (SHARD-PLATFORM M3, the viewmodel system @wildshard/sdk/viewmodel/gloveHands):
// the hunter's gloves on the Longbow, the crossbow and the lever-action (E322 F-M6, Jake's pick B: always on).
import type { GloveHandsLook } from '@wildshard/sdk/viewmodel/gloveHands';

/** The hunter's dark-tan leather gloves, a grey knit cuff, the sleeve of a waxed-canvas coat with leather patches (sRGB hex
 *  over nalatiArms' palette); the coat cuff's worn lip and its stitches. */
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
