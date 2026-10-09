import type { CommonsPack } from '@wildshard/sdk/commons';
import rows from './rows.json' with { type: 'json' };

/** Emit the five unchanged starter status rows as immutable JSON with publisher-owned provenance. */
export function starterEffectsPack(provenance: { credit: string; licence: string }): CommonsPack {
  return { id: 'effects', version: '0.0.0', entries: [{ id: 'starter', kind: 'binary',
    bytes: new TextEncoder().encode(JSON.stringify(rows)), ...provenance }] };
}
