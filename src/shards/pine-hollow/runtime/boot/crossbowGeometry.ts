import type { InferOutput } from 'valibot';
import { createModelLibrary, type ModelLibrary } from '@wildshard/game/plugin/geometry';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import hands from '../../data/handsPool.generated.json' with {type:'json'};
import { SECTIONS } from '../sections';

/** The crossbow's private scene: its part hierarchy over the held pool (`custom/crossbowPool`). */
export type CrossbowHierarchy = InferOutput<(typeof SECTIONS)['custom/crossbowPool']>['hierarchy'];

/** Immutable templates; weapon meshes borrow these without cloning or changing their channels: the crossbow's parts (the
 *  product's `custom/crossbowPool`, a named blob) and the hunter's baked hands with the Longbow's (boot/handsGeometry.ts). */
function heldPool(product: ShardProduct): { readonly library: ModelLibrary<never, never>; readonly hierarchy: CrossbowHierarchy } {
  const { pool, hierarchy } = product.section('custom/crossbowPool', SECTIONS);
  return { hierarchy, library: createModelLibrary({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, aoFloor: 1, hdLooks: {},
    geometryPools: [{ url: product.url(pool.url), parts: pool.parts }, hands.pool] }, '[pine-hollow held pool]') };
}
/** Made once from the first admitted product. */
let admitted: ReturnType<typeof heldPool> | null = null;

/** Make the held library from the product (once) and fetch it; the kit awaits this before building any held weapon. */
export function preloadHeldGeometry(product: ShardProduct): Promise<void> {
  const made = admitted ?? heldPool(product);
  admitted = made;
  return made.library.preload();
}

function held(): ReturnType<typeof heldPool> {
  if (admitted === null) throw new Error('[pine-hollow held pool] is not admitted');
  return admitted;
}
/** The admitted held library; refuses before `preloadHeldGeometry`. */
export function heldGeometry(): ReturnType<typeof heldPool>['library'] { return held().library; }
/** The crossbow's admitted part hierarchy; refuses before `preloadHeldGeometry`. */
export function crossbowHierarchy(): CrossbowHierarchy { return held().hierarchy; }
