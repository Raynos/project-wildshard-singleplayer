import type { CommonsPack } from '@wildshard/sdk/commons';
import items from './items.json' with { type: 'json' };

/** Emit the starter harvest rows as owned immutable JSON; provenance is supplied by the pack publisher. */
export function starterBagPack(provenance: { credit: string; licence: string }): CommonsPack {
  return { id: 'bag', version: '0.0.0', entries: [{ id: 'starter-items', kind: 'binary',
    bytes: new TextEncoder().encode(JSON.stringify(items)), ...provenance }] };
}
