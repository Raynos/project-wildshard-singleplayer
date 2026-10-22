import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type * as v from 'valibot';
import { SECTIONS } from './driftwoodLegacySections';
type CustomSections = { [K in keyof typeof SECTIONS]: v.InferOutput<(typeof SECTIONS)[K]> };
import { ISLAND } from './driftwoodLegacyAssets';

type RowSection = keyof CustomSections;

/** The island's admitted product, for the model hooks that hold no product (Explorer cards, colliders, slot geometry):
 *  the resident world loader and the cold Explorer product load admit it before any of those builds. */
export function admitDriftwoodRows(product: ShardProduct): void { ISLAND.admit(product); }

/** A client row section of the admitted product (build-validated sections); throws before the product is admitted. */
export function driftwoodRows<K extends RowSection>(name: K): CustomSections[K] { return driftwoodProduct().section<CustomSections[K]>(name); }

/** Native boot consumers borrow the same session-admitted named bytes as their sections. */
export function driftwoodProduct(): ShardProduct { return ISLAND.product; }
