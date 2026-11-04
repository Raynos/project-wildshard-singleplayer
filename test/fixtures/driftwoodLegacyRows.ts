import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import * as v from 'valibot';
import { SECTIONS } from './driftwoodLegacySections';
import { ISLAND } from './driftwoodLegacyAssets';
import {DRIFTWOOD_CLIENT_SECTIONS} from './driftwoodLegacyLayouts';

const fixtureRows = new Map<string, unknown>(DRIFTWOOD_CLIENT_SECTIONS.map(row=>[row.name,deepFreeze(structuredClone(row.value))]));
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
/** Test-only original world oracle, separate from the platform product. */
export function admitDriftwoodRows(product: ShardProduct, rows: ReadonlyMap<string, unknown>): void {
  ISLAND.admit(product);
  fixtureRows.clear();
  for (const [name, value] of rows) fixtureRows.set(name, deepFreeze(structuredClone(value)));
}
/** Full original grammar checked after session admission; no shipping custom read. */
export function driftwoodRows<K extends keyof typeof SECTIONS>(name: K): v.InferInput<(typeof SECTIONS)[K]> {
  driftwoodProduct();
  const value=fixtureRows.get(name);v.assert(SECTIONS[name],value);
  return deepFreeze(value);
}
/** Native boot borrows the same session-admitted named bytes. */
export function driftwoodProduct(): ShardProduct { return ISLAND.product; }
