import * as v from 'valibot';

export const CONTENT_CACHE_WIRE_CAP = 25_000_000;
const integer = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const id = { id: integer };
/** Only existing cache operations cross the private worker channel. */
export const CacheCommandSchema = v.variant('op', [
  v.strictObject({ ...id, op: v.literal('get'), hash }),
  v.strictObject({ ...id, op: v.literal('has'), hash, bytes: v.pipe(integer, v.maxValue(CONTENT_CACHE_WIRE_CAP)) }),
  v.strictObject({ ...id, op: v.literal('put'), hash, bytes: v.pipe(v.instance(Uint8Array), v.check(bytes => bytes.length <= CONTENT_CACHE_WIRE_CAP)) }),
  v.strictObject({ ...id, op: v.literal('pin'), lease: integer, hashes: v.pipe(v.array(hash), v.maxLength(10_000)) }),
  v.strictObject({ ...id, op: v.literal('release'), lease: integer }),
  v.strictObject({ ...id, op: v.literal('flush') }),
  v.strictObject({ ...id, op: v.literal('stats') }),
]);
export type CacheCommand = v.InferOutput<typeof CacheCommandSchema>;
export type CacheOperation = CacheCommand extends infer Command ? Command extends CacheCommand ? Omit<Command, 'id'> : never : never;
export type CacheValue = Uint8Array | null | boolean | { bytes: number; entries: number };
export const CacheReplySchema = v.variant('ok', [
  v.strictObject({ ...id, ok: v.literal(true), value: v.union([
    v.null(), v.boolean(), v.pipe(v.instance(Uint8Array), v.check(bytes => bytes.length <= CONTENT_CACHE_WIRE_CAP)),
    v.strictObject({ bytes: integer, entries: integer }),
  ]) }),
  v.strictObject({ ...id, ok: v.literal(false), error: v.pipe(v.string(), v.maxLength(2048)) }),
]);
/** Check operation-specific results before callers receive bytes or success. */
export function validCacheValue(op: CacheCommand['op'], value: CacheValue): boolean {
  if (op === 'get') return value === null || value instanceof Uint8Array;
  if (op === 'put' || op === 'has') return typeof value === 'boolean';
  if (op === 'stats') return typeof value === 'object' && value !== null && !(value instanceof Uint8Array);
  return value === null;
}
