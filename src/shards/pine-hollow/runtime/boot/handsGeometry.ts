import type { BufferGeometry } from 'three';
import rows from '../../data/handsPool.generated.json' with {type:'json'};
import { CROSSBOW_GEOMETRY } from './crossbowGeometry';
/** A baked hand: its part names, its sleeve's start in grip space and the wrist's bend there. */
export interface BakedHand { readonly geometry: string; readonly sleeve: string | null; readonly wrist: readonly number[]; readonly dir: readonly number[] }
/** The hands by bake key (gloveHands.handKey). */
export const BAKED_HANDS: Readonly<Record<string, BakedHand | undefined>> = rows.hands;
/** The Longbow's bake: its look and arrow keys, the stave's rings and the fists' points. */
export const BAKED_BOW = rows.bow;
/** A borrowed part of the hunter's baked hands and the Longbow (generators/handsPool.ts, a pool of the held library the kit
 *  preloads); a missing one refuses, it is never rebuilt here. */
export function handsPart(name: string): BufferGeometry {
  const geometry = CROSSBOW_GEOMETRY.geometry(name, { borrow: true });
  if (geometry === null) throw new Error(`[pine-hollow hands pool] ${name} is not loaded`);
  return geometry;
}
