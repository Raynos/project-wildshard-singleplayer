import type * as v from 'valibot';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { SECTIONS } from '../sections';

type RowSection = keyof typeof SECTIONS;
let admitted: ShardProduct | null = null;

/** The island's admitted product, for the model hooks that hold no product (Explorer cards, colliders, slot geometry):
 *  the resident world loader and the cold Explorer product load admit it before any of those builds. */
export function admitDriftwoodRows(product: ShardProduct): void { admitted = product; }

/** A client row section of the admitted product (runtime/sections.ts); throws before the product is admitted. */
export function driftwoodRows<K extends RowSection>(name: K): v.InferOutput<(typeof SECTIONS)[K]> {
  if (admitted === null) throw new Error(`Driftwood reads ${name} before its product is admitted`);
  return admitted.section(name, SECTIONS);
}
