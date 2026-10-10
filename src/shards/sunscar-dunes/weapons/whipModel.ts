import type { MeshStandardMaterial } from 'three';
import { buildLashHold, lashWrapMaterial, type LashHoldParts } from '@wildshard/sdk/items/lashHold';
import { HD_GLOVE_SIZE, WHIP_HOLD } from '../data/whip';
import { COIL_SURFACE } from '../data/surfaces';
import { duneHd, duneMesh, heldSurface } from '../world/meshes';

/** The whip's built parts (the lash item's held view). */
export type WhipParts = LashHoldParts;
/** The lash's matte braid as a plain material (no vertex colours), for the pull's wrap coil. */
export const braidedMaterial = (): MeshStandardMaterial => lashWrapMaterial(WHIP_HOLD);
/** A braided leather bullwhip in a gloved fist from its rows (data/whip.ts WHIP_HOLD): the code fist, the generated glove or the hero glove, whichever loaded last. */
export const buildWhipModel = (): WhipParts => buildLashHold(WHIP_HOLD, {
  glove: () => duneMesh('whip-glove'), hd: () => duneHd('glove-hd4', { size: HD_GLOVE_SIZE, by: 'span' }), coilSurface: (m) => { heldSurface(m, COIL_SURFACE); },
});
