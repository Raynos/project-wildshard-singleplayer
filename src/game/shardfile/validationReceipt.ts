import type { Shardfile } from './schema';
import type { worstContentCost } from './budget';

declare const __SHARDFILE_VALIDATOR__: string;
declare const __SHARDFILE_VERDICTS__: unknown;
/** Build-owned verdict. It is never read from authored shardfile data or a network sidecar. */
export interface ValidationReceipt {
  revision: string; sourceHash: string; worst: ReturnType<typeof worstContentCost>;
}
/** Sorted JSON makes the build and browser hash exactly the same admitted declaration. */
export function validationSourceBytes(source: Shardfile): Uint8Array {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (typeof input === 'object' && input !== null) return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => [key, sort(value)]));
    return input;
  };
  return new TextEncoder().encode(`${JSON.stringify(sort(source))}\n`);
}
/** The build hashes the engine/game validator sources; unbundled clients always validate in full. */
export function validationRevision(): string | null { return typeof __SHARDFILE_VALIDATOR__ === 'string' ? __SHARDFILE_VALIDATOR__ : null; }
/** Cache metadata is trusted local storage, but stale or malformed verdicts are never accepted. */
export function readValidationReceipt(input: unknown, sourceHash: string): ValidationReceipt | null {
  if (typeof input !== 'object' || input === null || !('revision' in input) || typeof input.revision !== 'string' || input.revision !== validationRevision() || !('sourceHash' in input) || input.sourceHash !== sourceHash || !('worst' in input)) return null;
  const cost = input.worst;
  if (typeof cost !== 'object' || cost === null || !('playing' in cost) || !('loading' in cost) || !('accounted' in cost) || !('location' in cost)) return null;
  if (![cost.playing, cost.loading, cost.accounted].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) || !Array.isArray(cost.location) || cost.location.length !== 2 || !cost.location.every(value => typeof value === 'number' && Number.isFinite(value))) return null;
  // Explicit numeric narrowing preserves the defining cost type without accepting arbitrary metadata.
  if (typeof cost.playing !== 'number' || typeof cost.loading !== 'number' || typeof cost.accounted !== 'number' || typeof cost.location[0] !== 'number' || typeof cost.location[1] !== 'number') return null;
  return { revision: input.revision, sourceHash, worst: { playing: cost.playing, loading: cost.loading, accounted: cost.accounted, location: [cost.location[0], cost.location[1]] } };
}
/** Only the client build's own validated first-party catalogue can skip a first asset-header validation. */
export function builtValidationReceipt(sourceHash: string): ValidationReceipt | null {
  const rows: unknown = typeof __SHARDFILE_VERDICTS__ === 'object' ? __SHARDFILE_VERDICTS__ : null;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) { const receipt = readValidationReceipt(row, sourceHash); if (receipt !== null) return receipt; }
  return null;
}
