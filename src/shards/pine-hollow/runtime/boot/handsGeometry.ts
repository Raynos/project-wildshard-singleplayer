import { Vector3, type BufferGeometry } from 'three';
import { bakedHandRows, heldGeometry, type BakedHandRows } from './crossbowGeometry';
/** The Longbow's bake: its look and arrow keys, the stave's rings and the fists' points. */
export type BakedBow = BakedHandRows['bow'];
/** Borrow an admitted hand by its semantic part; a missing bake refuses before equipment is built. */
export function bakedHandGeometry(part: string): { geometry:BufferGeometry; sleeve:BufferGeometry|null; wrist:Vector3; dir:Vector3 } {
  const row = Object.values(bakedHandRows().hands).find(hand => hand.geometry === `hand-${part}`);
  if (row === undefined) throw new Error(`[pine-hollow hands] ${part} is not baked`);
  return { geometry: handsPart(row.geometry), sleeve: row.sleeve === null ? null : handsPart(row.sleeve), wrist: new Vector3().fromArray(row.wrist), dir: new Vector3().fromArray(row.dir) };
}
/** Client presentation authored beside the hand bake and read after the held pool is admitted. */
export function handsPresentation(): BakedHandRows['presentation'] { return bakedHandRows().presentation; }
/** The Longbow's bake rows, from the product the kit admitted. */
export function bakedBowRows(): BakedBow { return bakedHandRows().bow; }
/** A borrowed part of the hunter's baked hands and the Longbow (generators/handsPool.ts, a pool of the held library the kit
 *  preloads); a missing one refuses, it is never rebuilt here. */
export function handsPart(name: string): BufferGeometry {
  const geometry = heldGeometry().geometry(name, { borrow: true });
  if (geometry === null) throw new Error(`[pine-hollow hands pool] ${name} is not loaded`);
  return geometry;
}
