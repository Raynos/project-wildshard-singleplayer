import * as v from 'valibot';

export const CONTENT_CACHE_WIRE_CAP = 25_000_000;
const integer = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const id = { id: integer };
/** The page keeps this checked, detached pin snapshot until its request is posted. */
export const CachePinCommandSchema: v.StrictObjectSchema<{[Key in keyof BoundedCachePin]:v.GenericSchema<BoundedCachePinInput[Key],BoundedCachePin[Key]>},undefined> = v.strictObject({ ...id, op: v.literal('pin'), lease: integer, hashes: v.pipe(v.array(hash), v.maxLength(10_000)) });
/** Only existing cache operations cross the private worker channel. */
export const CacheCommandSchema: v.GenericSchema<BoundedCacheCommandInput,BoundedCacheCommand> = v.variant('op', [
  v.strictObject({ ...id, op: v.literal('get'), hash }),
  v.strictObject({ ...id, op: v.literal('has'), hash, bytes: v.pipe(integer, v.maxValue(CONTENT_CACHE_WIRE_CAP)) }),
  v.strictObject({ ...id, op: v.literal('holds'), hash, bytes: v.pipe(integer, v.maxValue(CONTENT_CACHE_WIRE_CAP)) }),
  v.strictObject({ ...id, op: v.literal('put'), hash, bytes: v.pipe(v.instance(Uint8Array), v.check(bytes => bytes.length <= CONTENT_CACHE_WIRE_CAP)), keep: v.optional(v.boolean()) }),
  CachePinCommandSchema,
  v.strictObject({ ...id, op: v.literal('release'), lease: integer }),
  v.strictObject({ ...id, op: v.literal('flush') }),
  v.strictObject({ ...id, op: v.literal('stats') }),
  // One same-origin file read off the page: `bytes` is its exact wire size, `reply` whether its body comes back.
  v.strictObject({ ...id, op: v.literal('fetch'), url: v.pipe(v.string(), v.url(), v.maxLength(2048)), hash,
    bytes: v.pipe(integer, v.maxValue(CONTENT_CACHE_WIRE_CAP)), reply: v.picklist(['bytes', 'stored']), keep: v.optional(v.boolean()), urlCache: v.optional(v.boolean()) }),
]);
export type CacheCommand = v.InferOutput<typeof CacheCommandSchema>;
export type CacheOperation = CacheCommand extends infer Command ? Command extends CacheCommand ? Omit<Command, 'id'> : never : never;
/** A worker read's network receipt, on the worker's clock (`origin`), for the page's download accounting. */
const FetchTimingSchema = v.strictObject({ name: v.string(), startTime: v.number(), responseEnd: v.number(), transferSize: integer, encodedBodySize: integer });
const FetchedSchema: v.GenericSchema<BoundedCacheFetchInput,BoundedCacheFetch> = v.strictObject({ fetched: v.nullable(v.pipe(v.instance(Uint8Array), v.check(bytes => bytes.length <= CONTENT_CACHE_WIRE_CAP))),
  stored: v.boolean(), cached: v.boolean(), origin: v.number(), timing: v.nullable(FetchTimingSchema) });
/** `cached`: the bytes came from the URL cache, not the network; `stored`: the content cache now holds them. */
export type FetchedContent = v.InferOutput<typeof FetchedSchema>;
export type CacheValue = Uint8Array | null | boolean | { bytes: number; entries: number } | FetchedContent;
const BytesSchema = v.pipe(v.instance(Uint8Array), v.check(bytes => bytes.length <= CONTENT_CACHE_WIRE_CAP));
const StatsSchema = v.strictObject({ bytes: integer, entries: integer });
const RefusalSchema = v.strictObject({ ...id, ok: v.literal(false), error: v.pipe(v.string(), v.maxLength(2048)) });
/** The pending command selects its value schema after this strict envelope is admitted. */
export const CacheReplyEnvelopeSchema: v.GenericSchema<BoundedCacheEnvelopeInput,BoundedCacheEnvelope> = v.variant('ok', [
  v.strictObject({ ...id, ok: v.literal(true), value: v.unknown() }), RefusalSchema,
]);
/** One exact result shape per operation; byte limits and nested receipt checks remain mandatory. */
export const CacheValueSchemas: {get:v.GenericSchema<BoundedCacheValue_getInput,BoundedCacheValue_get>;has:v.GenericSchema<BoundedCacheValue_hasInput,BoundedCacheValue_has>;holds:v.GenericSchema<BoundedCacheValue_holdsInput,BoundedCacheValue_holds>;put:v.GenericSchema<BoundedCacheValue_putInput,BoundedCacheValue_put>;stats:v.GenericSchema<BoundedCacheValue_statsInput,BoundedCacheValue_stats>;fetch:v.GenericSchema<BoundedCacheValue_fetchInput,BoundedCacheValue_fetch>;flush:v.GenericSchema<BoundedCacheValue_flushInput,BoundedCacheValue_flush>;pin:v.GenericSchema<BoundedCacheValue_pinInput,BoundedCacheValue_pin>;release:v.GenericSchema<BoundedCacheValue_releaseInput,BoundedCacheValue_release>} = {
  get: v.nullable(BytesSchema), has: v.boolean(), holds: v.boolean(), put: v.boolean(), stats: StatsSchema,
  fetch: FetchedSchema, flush: v.null(), pin: v.null(), release: v.null(),
} satisfies Record<CacheCommand['op'], v.GenericSchema<CacheValue>>;
export const CacheReplySchema: v.GenericSchema<BoundedCacheReplyInput,BoundedCacheReply> = v.variant('ok', [
  v.strictObject({ ...id, ok: v.literal(true), value: v.union([
    v.null(), v.boolean(), BytesSchema, StatsSchema, FetchedSchema,
  ]) }),
  RefusalSchema,
]);

/* js-heap H9: the page's hot per-message checks, written out. They accept and refuse exactly what the strict schemas above
 * do (test/content-cache-checks.test.ts runs both over every shape), without valibot's datasets or copied output: on the
 * Template's boot those were 2.1 MiB. The schemas stay the declaration and the failure path's message. */
const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const isNumber = (n: unknown): n is number => typeof n === 'number' && !Number.isNaN(n);
const HASH = /^[a-f0-9]{64}$/u;
const isHash = (s: unknown): boolean => typeof s === 'string' && HASH.test(s);
const isBytes = (b: unknown): b is Uint8Array => b instanceof Uint8Array && b.length <= CONTENT_CACHE_WIRE_CAP;
const isFlag = (b: unknown): boolean => b === undefined || typeof b === 'boolean';
const isWire = (n: unknown): boolean => isCount(n) && n <= CONTENT_CACHE_WIRE_CAP;
const isRecord = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null;
/** valibot's strict object: an object (arrays too) holding every required key (`in`) and no other enumerable key */
function strict(o: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
  if (!isRecord(o)) return null;
  for (const key of required) if (!(key in o)) return null;
  for (const key in o) if (!required.includes(key) && !optional.includes(key)) return null;
  return o;
}
/** `CacheReplyEnvelopeSchema`'s verdict */
export function isCacheReplyEnvelope(data: unknown): data is BoundedCacheEnvelope {
  if (!isRecord(data) || !('ok' in data)) return false;
  if (data['ok'] === true) { const o = strict(data, ['id', 'ok', 'value']); return o !== null && isCount(o['id']); }
  if (data['ok'] === false) {
    const o = strict(data, ['id', 'ok', 'error']), error = o?.['error'];
    return o !== null && isCount(o['id']) && typeof error === 'string' && error.length <= 2048;
  }
  return false;
}
function isTiming(t: unknown): boolean {
  if (t === null) return true;
  const o = strict(t, ['name', 'startTime', 'responseEnd', 'transferSize', 'encodedBodySize']);
  return o !== null && typeof o['name'] === 'string' && isNumber(o['startTime']) && isNumber(o['responseEnd']) && isCount(o['transferSize']) && isCount(o['encodedBodySize']);
}
/** `CacheValueSchemas[op]`'s verdict */
export function isCacheValue(op: CacheCommand['op'], value: unknown): value is CacheValue {
  switch (op) {
    case 'get': return value === null || isBytes(value);
    case 'has': case 'holds': case 'put': return typeof value === 'boolean';
    case 'stats': { const o = strict(value, ['bytes', 'entries']); return o !== null && isCount(o['bytes']) && isCount(o['entries']); }
    case 'fetch': {
      const o = strict(value, ['fetched', 'stored', 'cached', 'origin', 'timing']);
      return o !== null && (o['fetched'] === null || isBytes(o['fetched'])) && typeof o['stored'] === 'boolean' && typeof o['cached'] === 'boolean'
        && isNumber(o['origin']) && isTiming(o['timing']);
    }
    case 'flush': case 'pin': case 'release': return value === null;
    default: return false;
  }
}
/** `CacheCommandSchema`'s verdict */
export function isCacheCommand(command: unknown): command is CacheCommand {
  if (!isRecord(command) || !('op' in command)) return false;
  const c = (required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null => {
    const o = strict(command, required, optional); return o !== null && isCount(o['id']) ? o : null;
  };
  switch (command['op']) {
    case 'get': { const o = c(['id', 'op', 'hash']); return o !== null && isHash(o['hash']); }
    case 'has': case 'holds': { const o = c(['id', 'op', 'hash', 'bytes']); return o !== null && isHash(o['hash']) && isWire(o['bytes']); }
    case 'put': { const o = c(['id', 'op', 'hash', 'bytes'], ['keep']); return o !== null && isHash(o['hash']) && isBytes(o['bytes']) && isFlag(o['keep']); }
    case 'pin': {
      const o = c(['id', 'op', 'lease', 'hashes']), hashes = o?.['hashes'];
      return o !== null && isCount(o['lease']) && Array.isArray(hashes) && hashes.length <= 10_000 && hashes.every(isHash);
    }
    case 'release': { const o = c(['id', 'op', 'lease']); return o !== null && isCount(o['lease']); }
    case 'flush': case 'stats': return c(['id', 'op']) !== null;
    case 'fetch': {
      const o = c(['id', 'op', 'url', 'hash', 'bytes', 'reply'], ['keep', 'urlCache']), url = o?.['url'];
      return o !== null && typeof url === 'string' && URL.canParse(url) && url.length <= 2048 && isHash(o['hash']) && isWire(o['bytes'])
        && (o['reply'] === 'bytes' || o['reply'] === 'stored') && isFlag(o['keep']) && isFlag(o['urlCache']);
    }
    default: return false;
  }
}

type BoundedCachePinInput = BoundedCachePin;
interface BoundedCachePinFields {
    op: "pin";
    lease: number;
    hashes: string[];
    id: number;
}
type BoundedCachePin = { [Key in keyof BoundedCachePinFields]: BoundedCachePinFields[Key] };
type BoundedCacheCommandInput = BoundedCacheCommand;
type BoundedCacheCommand = {
    op: "pin";
    lease: number;
    hashes: string[];
    id: number;
} | {
    op: "get";
    hash: string;
    id: number;
} | {
    op: "has";
    hash: string;
    bytes: number;
    id: number;
} | {
    op: "holds";
    hash: string;
    bytes: number;
    id: number;
} | {
    op: "put";
    hash: string;
    bytes: Uint8Array<ArrayBuffer>;
    keep?: boolean | undefined;
    id: number;
} | {
    op: "release";
    lease: number;
    id: number;
} | {
    op: "flush";
    id: number;
} | {
    op: "stats";
    id: number;
} | {
    op: "fetch";
    url: string;
    hash: string;
    bytes: number;
    reply: "bytes" | "stored";
    keep?: boolean | undefined;
    urlCache?: boolean | undefined;
    id: number;
};
type BoundedCacheFetchInput = BoundedCacheFetch;
interface BoundedCacheFetchFields {
    fetched: Uint8Array<ArrayBuffer> | null;
    stored: boolean;
    cached: boolean;
    origin: number;
    timing: {
        name: string;
        startTime: number;
        responseEnd: number;
        transferSize: number;
        encodedBodySize: number;
    } | null;
}
type BoundedCacheFetch = { [Key in keyof BoundedCacheFetchFields]: BoundedCacheFetchFields[Key] };
type BoundedCacheEnvelopeInput = BoundedCacheEnvelope;
type BoundedCacheEnvelope = {
    ok: true;
    value: unknown;
    id: number;
} | {
    ok: false;
    error: string;
    id: number;
};
type BoundedCacheReplyInput = BoundedCacheReply;
type BoundedCacheReply = {
    ok: false;
    error: string;
    id: number;
} | {
    ok: true;
    value: boolean | Uint8Array<ArrayBuffer> | {
        fetched: Uint8Array<ArrayBuffer> | null;
        stored: boolean;
        cached: boolean;
        origin: number;
        timing: {
            name: string;
            startTime: number;
            responseEnd: number;
            transferSize: number;
            encodedBodySize: number;
        } | null;
    } | {
        bytes: number;
        entries: number;
    } | null;
    id: number;
};
type BoundedCacheValue_getInput = BoundedCacheValue_get;
type BoundedCacheValue_get = Uint8Array<ArrayBuffer> | null;
type BoundedCacheValue_hasInput = BoundedCacheValue_has;
type BoundedCacheValue_has = boolean;
type BoundedCacheValue_holdsInput = BoundedCacheValue_holds;
type BoundedCacheValue_holds = boolean;
type BoundedCacheValue_putInput = BoundedCacheValue_put;
type BoundedCacheValue_put = boolean;
type BoundedCacheValue_statsInput = BoundedCacheValue_stats;
interface BoundedCacheValue_statsFields {
    bytes: number;
    entries: number;
}
type BoundedCacheValue_stats = { [Key in keyof BoundedCacheValue_statsFields]: BoundedCacheValue_statsFields[Key] };
type BoundedCacheValue_fetchInput = BoundedCacheValue_fetch;
interface BoundedCacheValue_fetchFields {
    fetched: Uint8Array<ArrayBuffer> | null;
    stored: boolean;
    cached: boolean;
    origin: number;
    timing: {
        name: string;
        startTime: number;
        responseEnd: number;
        transferSize: number;
        encodedBodySize: number;
    } | null;
}
type BoundedCacheValue_fetch = { [Key in keyof BoundedCacheValue_fetchFields]: BoundedCacheValue_fetchFields[Key] };
type BoundedCacheValue_flushInput = BoundedCacheValue_flush;
type BoundedCacheValue_flush = null;
type BoundedCacheValue_pinInput = BoundedCacheValue_pin;
type BoundedCacheValue_pin = null;
type BoundedCacheValue_releaseInput = BoundedCacheValue_release;
type BoundedCacheValue_release = null;
