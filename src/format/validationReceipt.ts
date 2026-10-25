import type { worstContentCost } from './budget';

declare const __SHARDFILE_VALIDATOR__: string;
declare const __SHARDFILE_VERDICTS__: unknown;
/** Build-owned verdict. It is never read from authored shardfile data or a network sidecar. */
export interface ValidationReceipt {
  revision: string; sourceHash: string; indexHash?: string; worst: ReturnType<typeof worstContentCost>;
}
/** Sorted JSON makes the build and browser hash exactly the same admitted declaration. */
export function validationSourceBytes(source: unknown): Uint8Array {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (typeof input === 'object' && input !== null) return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => [key, sort(value)]));
    return input;
  };
  return new TextEncoder().encode(`${JSON.stringify(sort(source))}\n`);
}
interface SourceSortFrame {
  readonly source: object;
  readonly target: Record<string, unknown> | unknown[];
  readonly entries?: readonly (readonly [string, unknown])[];
  readonly values?: readonly unknown[];
  at: number;
}

/** Exact receipt bytes with the caller's paint policy and wall clock between sorting slices.
 * Native JSON encoding and a single object's key enumeration remain atomic. */
export async function validationSourceBytesPaced(source: unknown, pause: () => Promise<void>, readClock: () => number): Promise<Uint8Array> {
  const stack: SourceSortFrame[] = [];
  const active = new Set<object>();
  const sorted = (value: unknown): unknown => {
    if (typeof value !== 'object' || value === null) return value;
    if (active.has(value)) throw new TypeError('Cannot serialize cyclic receipt source');
    active.add(value);
    const target: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
    if (Array.isArray(value) && Array.isArray(target)) { target.length = value.length; stack.push({ source: value, target, values: value, at: 0 }); }
    else stack.push({ source: value, target, entries: Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0), at: 0 });
    return target;
  };
  const result = sorted(source);
  let start = readClock(), visited = 0;
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame === undefined) break;
    const at = frame.at++;
    const entry = frame.values === undefined ? frame.entries?.[at]
      : at < frame.values.length ? [String(at), frame.values[at]] as const : undefined;
    if (entry === undefined) {
      stack.pop();
      active.delete(frame.source);
      continue;
    }
    const [key, value] = entry, child = sorted(value);
    if (Array.isArray(frame.target)) frame.target[Number(key)] = child;
    else if (key === '__proto__') Object.defineProperty(frame.target, key, { value: child, writable: true, enumerable: true, configurable: true });
    else frame.target[key] = child;
    if (++visited % 128 === 0 && readClock() - start >= 4) { await pause(); start = readClock(); }
  }
  // Do not join final native serialization to the last sorting slice.
  await pause();
  return new TextEncoder().encode(`${JSON.stringify(result)}\n`);
}
/** The build hashes the engine/game validator sources; unbundled clients always validate in full. */
export function validationRevision(): string | null { return typeof __SHARDFILE_VALIDATOR__ === 'string' ? __SHARDFILE_VALIDATOR__ : null; }
/** Cache metadata is trusted local storage, but stale or malformed verdicts are never accepted. */
export function readValidationReceipt(input: unknown, sourceHash: string): ValidationReceipt | null {
  if (typeof input !== 'object' || input === null || !('revision' in input) || typeof input.revision !== 'string' || input.revision !== validationRevision() || !('sourceHash' in input) || input.sourceHash !== sourceHash || !('worst' in input)) return null;
  const indexHash: unknown = 'indexHash' in input ? input.indexHash : undefined;
  if (indexHash !== undefined && (typeof indexHash !== 'string' || !/^[a-f0-9]{64}$/u.test(indexHash))) return null;
  const cost = input.worst;
  if (typeof cost !== 'object' || cost === null || !('playing' in cost) || !('loading' in cost) || !('accounted' in cost) || !('location' in cost)) return null;
  if (![cost.playing, cost.loading, cost.accounted].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || !Array.isArray(cost.location) || cost.location.length !== 2 || !cost.location.every(value => typeof value === 'number' && Number.isSafeInteger(value))) return null;
  // Explicit numeric narrowing preserves the defining cost type without accepting arbitrary metadata.
  if (typeof cost.playing !== 'number' || typeof cost.loading !== 'number' || typeof cost.accounted !== 'number' || typeof cost.location[0] !== 'number' || typeof cost.location[1] !== 'number') return null;
  return { revision: input.revision, sourceHash, ...(typeof indexHash === 'string' ? { indexHash } : {}), worst: { playing: cost.playing, loading: cost.loading, accounted: cost.accounted, location: [cost.location[0], cost.location[1]] } };
}
/** Only the client build's own validated first-party catalogue can skip a first asset-header validation. */
export function builtValidationReceipt(sourceHash: string, indexHash?: string): ValidationReceipt | null {
  const rows: unknown = typeof __SHARDFILE_VERDICTS__ === 'object' ? __SHARDFILE_VERDICTS__ : null;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) { const receipt = readValidationReceipt(row, sourceHash); if (receipt !== null && (indexHash === undefined || receipt.indexHash === indexHash)) return receipt; }
  return null;
}
