import type { MeshStandardMaterial } from 'three';
import { buildLashHold, lashWrapMaterial, type LashHoldParts } from '../runtime/items/lashHold';
import { HD_GLOVE_SIZE, WHIP_HOLD } from '../data/whip';
import { COIL_SURFACE } from '../data/surfaces';
import lash from '../data/lash.json' with { type: 'json' };
import { lastBakedWorld } from '../world/baked';
import { duneHd, heldSurface } from '../world/meshes';

/** The whip's built parts (the lash item's held view). */
export type WhipParts = LashHoldParts;
/** The lash's matte braid as a plain material (no vertex colours), for the pull's wrap coil. */
export const braidedMaterial = (): MeshStandardMaterial => lashWrapMaterial(WHIP_HOLD);
/** A braided leather bullwhip from its rows (data/whip.ts WHIP_HOLD) and its bake (`generators/lash.ts`): the hero glove holding its plaited coil. */
export const buildWhipModel = (): WhipParts => buildLashHold(WHIP_HOLD, { tip: [lash.tip[0] ?? 0, lash.tip[1] ?? 0, lash.tip[2] ?? 0], along: lash.along }, {
  // a copy; its index re-laid as the tube built it (16-bit: the bake writes 32)
  baked: (kind) => { const g = lastBakedWorld()?.get('lash')?.get(kind)?.geometry.clone() ?? null, index = g?.getIndex(); if (index) g?.setIndex(Array.from(index.array)); return g; },
  hd: () => duneHd('glove-hd4', { size: HD_GLOVE_SIZE, by: 'span' }), coilSurface: (m) => { heldSurface(m, COIL_SURFACE); },
});
