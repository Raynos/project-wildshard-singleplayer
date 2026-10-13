import { BufferGeometry, Mesh } from 'three';
import { buildLashHold, lashWrapMaterial, type LashHoldParts } from '../runtime/items/lashHold';
import { HD_GLOVE_SIZE, WHIP_HOLD } from '../data/whip';
import { COIL_SURFACE } from '../data/surfaces';
import lash from '../data/lash.json' with { type: 'json' };
import { lastBakedWorld, lastPlait } from '../world/baked';
import { duneHd, heldSurface } from '../world/meshes';

/** The whip's built parts (the lash item's held view). */
export type WhipParts = LashHoldParts;
/** A copy of one of the lash's baked kinds (`generators/lash.ts`), its index re-laid as the tube built it (16-bit: the bake writes 32); null before the bake loads. */
const bakedLash = (kind: 'coil' | 'loop' | 'cord' | 'wrap'): BufferGeometry | null => { const g = lastBakedWorld()?.get('lash')?.get(kind)?.geometry.clone() ?? null, index = g?.getIndex(); if (index) g?.setIndex(Array.from(index.array)); return g; };
/** The pull's wrap coil: the baked helix in the lash's matte braid (a plain material, no vertex colours). */
export const braidedCoil = (): Mesh => new Mesh(bakedLash('wrap') ?? new BufferGeometry(), lashWrapMaterial(WHIP_HOLD));
/** A braided leather bullwhip from its rows (data/whip.ts WHIP_HOLD) and its bake (`generators/lash.ts`): the hero glove holding its plaited coil. */
export const buildWhipModel = (): WhipParts => buildLashHold(WHIP_HOLD, { tip: [lash.tip[0] ?? 0, lash.tip[1] ?? 0, lash.tip[2] ?? 0], along: lash.along }, {
  baked: bakedLash, plait: lastPlait, hd: () => duneHd('glove-hd4', { size: HD_GLOVE_SIZE, by: 'span' }), coilSurface: (m) => { heldSurface(m, COIL_SURFACE); },
});
