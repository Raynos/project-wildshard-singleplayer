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
