import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { CustomSections } from '../productSections.generated.d.ts';

type RowSection = keyof CustomSections;
let admitted: ShardProduct | null = null;

/** The island's admitted product, for the model hooks that hold no product (Explorer cards, colliders, slot geometry):
 *  the resident world loader and the cold Explorer product load admit it before any of those builds. */
export function admitDriftwoodRows(product: ShardProduct): void { admitted = product; }

/** A body's admitted launch coefficients, available at the same pre-world product boundary as model rows. */
export function driftwoodLaunch(name: string): NonNullable<ShardProduct['shardfile']['items']['launches']>[string] {
  const row = admitted?.section('combat/items').items.launches?.[name];
  if (row === undefined) throw new Error(`Driftwood requires its admitted launch: ${name}`);
  return row;
}

/** A client row section of the admitted product (build-validated sections); throws before the product is admitted. */
export function driftwoodRows<K extends RowSection>(name: K): CustomSections[K] {
  if (admitted === null) throw new Error(`Driftwood reads ${name} before its product is admitted`);
  return admitted.section<CustomSections[K]>(name);
}

/** Only live view shadow choices remain; geometry counts and dimensions compile offline. */

/** Native boot consumers borrow the same session-admitted named bytes as their sections. */
export function driftwoodProduct(): ShardProduct {
  if (admitted === null) throw new Error('Driftwood reads its product before its product is admitted');
  return admitted;
}
