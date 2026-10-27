import type { worstContentCost } from './budget';

declare const __SHARDFILE_VALIDATOR__: string;
declare const __SHARDFILE_VERDICTS__: unknown;
/** Build-owned verdict. It is never read from authored shardfile data or a network sidecar. */
export interface ValidationReceipt {
  revision: string; sourceHash: string; indexHash?: string; worst: ReturnType<typeof worstContentCost>;
}
/** An array index key (canonical uint32 below 2^32 - 1): a plain object enumerates these first, in numeric order. */
const indexKey = (key: string): boolean => /^(?:0|[1-9]\d{0,9})$/u.test(key) && Number(key) < 4294967295;
const byCodeUnit = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
/** Sorted JSON makes the build and browser hash exactly the same admitted declaration. js-heap H9: written directly, in
 *  the order JSON.stringify gives the key-sorted copy this used to build (index keys first, numerically, then the rest
 *  by code unit; arrays in place, holes and non-JSON values as JSON.stringify writes them), without building that copy. */
export function validationSourceBytes(source: unknown): Uint8Array {
  const active = new Set<object>();
  const write = (value: unknown): string | undefined => {
    if (value === null) return 'null';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return JSON.stringify(value);
    if (typeof value !== 'object') return undefined;
    if (active.has(value)) throw new TypeError('Cannot serialize cyclic receipt source');
    active.add(value);
    let out: string;
    if (Array.isArray(value)) {
      out = '[';
      for (let i = 0; i < value.length; i++) out += (i > 0 ? ',' : '') + (write(value[i]) ?? 'null');
      out += ']';
    } else {
      out = '{'; let first = true;
      for (const key of orderedKeys(value)) {
        const text = write(Reflect.get(value, key));
        if (text === undefined) continue;
        out += `${first ? '' : ','}${JSON.stringify(key)}:${text}`; first = false;
      }
      out += '}';
    }
    active.delete(value);
    return out;
  };
  return new TextEncoder().encode(`${write(source) ?? 'undefined'}\n`);
}
/** An object's keys in the order JSON.stringify writes its key-sorted copy: index keys numerically, then the rest by code
 *  unit. One fresh key array; it is split only when an index key is present. */
function orderedKeys(value: object): string[] {
  const keys = Object.keys(value);
  let indexed = false; for (const key of keys) if (indexKey(key)) { indexed = true; break; }
  if (!indexed) return keys.sort(byCodeUnit);
  return [...keys.filter(indexKey).sort((a, b) => Number(a) - Number(b)), ...keys.filter(key => !indexKey(key)).sort(byCodeUnit)];
}
/** A value JSON.stringify writes (objects included); anything else is omitted from an object and null in an array. */
function written(value: unknown): boolean {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || typeof value === 'object';
}
interface SourceWriteFrame { readonly source: object; readonly items: readonly unknown[] | undefined; readonly keys: readonly string[]; at: number; first: boolean }

/** Exact receipt bytes (validationSourceBytes') with the caller's paint policy and wall clock between slices of at most
 *  128 visited values. js-heap H9: written directly, without the sorted copy and its per-key entry pairs. A single
 *  object's key enumeration and the final encoding remain atomic. */
export async function validationSourceBytesPaced(source: unknown, pause: () => Promise<void>, readClock: () => number): Promise<Uint8Array> {
  const stack: SourceWriteFrame[] = [], active = new Set<object>(), none: readonly string[] = [];
  let out = '';
  // A leaf's text, or a container's bracket with its frame pushed.
  const open = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) { out += JSON.stringify(value) ?? 'null'; return; }
    if (active.has(value)) throw new TypeError('Cannot serialize cyclic receipt source');
    active.add(value);
    if (Array.isArray(value)) { const items: readonly unknown[] = value; out += '['; stack.push({ source: value, items, keys: none, at: 0, first: true }); }
    else { out += '{'; stack.push({ source: value, items: undefined, keys: orderedKeys(value), at: 0, first: true }); }
  };
  if (written(source)) open(source); else out = 'undefined';
  let start = readClock(), visited = 0;
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame === undefined) break;
    const at = frame.at++, items = frame.items;
    if (at >= (items === undefined ? frame.keys.length : items.length)) {
      stack.pop(); active.delete(frame.source); out += items === undefined ? '}' : ']';
      continue;
    }
    if (items !== undefined) {
      const value = items[at];
      out += frame.first ? '' : ','; frame.first = false;
      if (written(value)) open(value); else out += 'null';
    } else {
      const key = frame.keys[at] ?? '', value: unknown = Reflect.get(frame.source, key);
      if (written(value)) { out += `${frame.first ? '' : ','}${JSON.stringify(key)}:`; frame.first = false; open(value); }
    }
    if (++visited % 128 === 0 && readClock() - start >= 4) { await pause(); start = readClock(); }
  }
  // Do not join the final encoding to the last writing slice.
  await pause();
  return new TextEncoder().encode(`${out}\n`);
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
