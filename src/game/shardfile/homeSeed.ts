/** DL7 P3 (G1008): the home build cache's own snapshots, written at build time as one cold seed per shard × tier.
 * A seed is a u32 header length, a JSON header (the snapshots with each typed `words` replaced by a block reference)
 * and 16-byte aligned raw blocks. Every decoded entry is checked by the IndexedDB record's own schema. */
import * as v from 'valibot';
import type { TypedArray } from 'three';
import { HomeGeometrySnapshotSchema, type HomeGeometrySnapshot } from './homeGeometrySnapshot';

/** The seed's URL path beside the app's other emitted assets; listed only in the grid packs manifests of its home. */
export function homeSeedPath(slug: string, tier: 'phone' | 'desktop'): string {
  if (!/^[a-z0-9_-]+$/u.test(slug)) throw new Error('Invalid home seed shard');
  return `/assets/home-seed/${slug}-${tier}.bin`;
}

/** A runtime cache key without its page origin, the seed's one key form (any home build cache key; extend it here for
 * a new key kind): an owned key's URLs become their path (`/shardfiles/<slug>/blobs/…`); whole keys name content hashes
 * only, and any other key, stay as they are. A key that does not parse is returned unchanged. */
export function homeSeedKey(runtimeKey: string): string {
  if (!runtimeKey.startsWith('owned:')) return runtimeKey;
  let parts: unknown;
  try { parts = JSON.parse(runtimeKey.slice('owned:'.length)); } catch { return runtimeKey; }
  if (!Array.isArray(parts) || typeof parts[0] !== 'string' || !Array.isArray(parts[1])) return runtimeKey;
  const path = (url: unknown): unknown => {
    if (typeof url !== 'string') return url;
    try { return new URL(url, 'http://seed.invalid/').pathname; } catch { return url; }
  };
  const segments: unknown[] = parts[1];
  return `owned:${JSON.stringify([path(parts[0]), segments.map(path), ...parts.slice(2)])}`;
}

const SCALARS = ['f32', 'f64', 'u32', 'i32', 'u16', 'i16', 'u8', 'u8c', 'i8'] as const;
type Scalar = typeof SCALARS[number];
function scalarOf(words: TypedArray): Scalar | null {
  if (words instanceof Float32Array) return 'f32';
  if (words instanceof Float64Array) return 'f64';
  if (words instanceof Uint32Array) return 'u32';
  if (words instanceof Int32Array) return 'i32';
  if (words instanceof Uint16Array) return 'u16';
  if (words instanceof Int16Array) return 'i16';
  if (words instanceof Uint8ClampedArray) return 'u8c';
  if (words instanceof Uint8Array) return 'u8';
  if (words instanceof Int8Array) return 'i8';
  return null;
}
function scalarBytes(scalar: Scalar): number {
  switch (scalar) {
    case 'f64': return 8;
    case 'f32': case 'u32': case 'i32': return 4;
    case 'u16': case 'i16': return 2;
    case 'u8': case 'u8c': case 'i8': return 1;
    default: throw new Error('Unsupported home seed scalar');
  }
}
function wordsOf(scalar: Scalar, buffer: ArrayBuffer): TypedArray {
  switch (scalar) {
    case 'f32': return new Float32Array(buffer);
    case 'f64': return new Float64Array(buffer);
    case 'u32': return new Uint32Array(buffer);
    case 'i32': return new Int32Array(buffer);
    case 'u16': return new Uint16Array(buffer);
    case 'i16': return new Int16Array(buffer);
    case 'u8': return new Uint8Array(buffer);
    case 'u8c': return new Uint8ClampedArray(buffer);
    case 'i8': return new Int8Array(buffer);
    default: throw new Error('Unsupported home seed scalar');
  }
}

const MAX_HEADER = 64 * 1024 * 1024, MAX_ENTRIES = 4096, ALIGN = 16;
const natural = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const block = v.strictObject({ type: v.picklist(SCALARS), offset: v.pipe(natural, v.multipleOf(ALIGN)), length: natural });
type Block = v.InferOutput<typeof block>;
// The header names only what the codec reads; the full snapshot shape is checked after the words are back.
const headerSchema = v.strictObject({ version: v.literal(1), data: natural, entries: v.pipe(v.array(v.strictObject({
  key: v.pipe(v.string(), v.minLength(1), v.maxLength(16384)),
  snapshot: v.pipe(v.array(v.looseObject({ shape: v.looseObject({
    attributes: v.pipe(v.array(v.looseObject({ words: block })), v.maxLength(32)), index: v.nullable(v.looseObject({ words: block })),
  }) })), v.maxLength(2048)),
})), v.maxLength(MAX_ENTRIES)) });
type Header = v.InferOutput<typeof headerSchema>;

// JSON has no ±Infinity, NaN or -0 (a default draw range is [0, Infinity]); they travel as tagged objects.
const SPECIAL = '$num';
function replacer(_key: string, value: unknown): unknown {
  if (typeof value !== 'number') return value;
  if (Number.isNaN(value)) return { [SPECIAL]: 'NaN' };
  if (value === Infinity) return { [SPECIAL]: 'Infinity' };
  if (value === -Infinity) return { [SPECIAL]: '-Infinity' };
  if (Object.is(value, -0)) return { [SPECIAL]: '-0' };
  return value;
}
function reviver(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const keys = Object.keys(value); if (keys.length !== 1 || keys[0] !== SPECIAL) return value;
  switch (Reflect.get(value, SPECIAL)) {
    case 'NaN': return Number.NaN;
    case 'Infinity': return Infinity;
    case '-Infinity': return -Infinity;
    case '-0': return -0;
    default: return value;
  }
}

interface WordsView<W> { readonly shape: { readonly attributes: readonly { readonly words: W }[]; readonly index: { readonly words: W } | null } }
/** The views with every channel's `words` swapped (typed words <-> block references); every other field is copied as is. */
function swapWords<W>(views: readonly WordsView<W>[], swap: (words: W) => unknown): unknown[] {
  const result: unknown[] = [];
  for (const view of views) {
    const attributes: unknown[] = [];
    for (const attribute of view.shape.attributes) attributes.push({ ...attribute, words: swap(attribute.words) });
    const index = view.shape.index === null ? null : { ...view.shape.index, words: swap(view.shape.index.words) };
    result.push({ ...view, shape: { ...view.shape, attributes, index } });
  }
  return result;
}

/** Pack the snapshots under their seed keys. Each view's own byte range is written once (identical views share a
 * block); views of one buffer at different ranges get their own blocks. */
export function encodeHomeSeed(entries: ReadonlyMap<string, HomeGeometrySnapshot>): Uint8Array<ArrayBuffer> {
  if (entries.size > MAX_ENTRIES) throw new Error('Home seed has too many entries');
  const blocks: Uint8Array[] = [], seen = new Map<ArrayBufferLike, Map<string, Block>>();
  let data = 0;
  const reference = (words: TypedArray): Block => {
    const type = scalarOf(words); if (type === null) throw new Error('Unsupported home seed words');
    const ranges = seen.get(words.buffer) ?? new Map<string, Block>(); seen.set(words.buffer, ranges);
    const id = `${type}:${String(words.byteOffset)}:${String(words.length)}`, prior = ranges.get(id);
    if (prior !== undefined) return prior;
    const row = { type, offset: data, length: words.length };
    blocks.push(new Uint8Array(words.buffer, words.byteOffset, words.byteLength));
    data += Math.ceil(words.byteLength / ALIGN) * ALIGN; ranges.set(id, row); return row;
  };
  const rows: { key: string; snapshot: unknown[] }[] = [];
  for (const [key, snapshot] of entries) {
    if (!v.is(HomeGeometrySnapshotSchema, snapshot)) throw new Error(`Invalid home seed snapshot: ${key}`);
    rows.push({ key, snapshot: swapWords(snapshot, reference) });
  }
  const header = new TextEncoder().encode(JSON.stringify({ version: 1, data, entries: rows }, replacer));
  if (header.length > MAX_HEADER) throw new Error('Home seed header exceeds its bound');
  const start = Math.ceil((4 + header.length) / ALIGN) * ALIGN, packed = new Uint8Array(start + data);
  new DataView(packed.buffer).setUint32(0, header.length, true); packed.set(header, 4);
  let at = start;
  for (const bytes of blocks) { packed.set(bytes, at); at += Math.ceil(bytes.length / ALIGN) * ALIGN; }
  return packed;
}

/** A checked seed: its keys and a reader that returns each entry with fresh, independent words. */
export interface HomeSeed {
  readonly keys: ReadonlySet<string>;
  /** The entry's snapshot (its own copies of the words), or null when the seed has no such key. Throws on a bad entry. */
  readonly read: (key: string) => HomeGeometrySnapshot | null;
}

/** Check the header and every block's range once; entries are rebuilt on read. Malformed bytes throw. */
export function openHomeSeed(input: Uint8Array): HomeSeed {
  if (input.length < 4) throw new Error('Invalid home seed length');
  const length = new DataView(input.buffer, input.byteOffset, input.byteLength).getUint32(0, true);
  if (length === 0 || length > MAX_HEADER || 4 + length > input.length) throw new Error('Invalid home seed header length');
  const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(4, 4 + length)), reviver);
  const header: Header = v.parse(headerSchema, json), start = Math.ceil((4 + length) / ALIGN) * ALIGN;
  if (start + header.data !== input.length) throw new Error('Home seed size mismatch');
  const byKey = new Map<string, Header['entries'][number]>();
  for (const entry of header.entries) {
    if (byKey.has(entry.key)) throw new Error('Duplicate home seed key');
    for (const view of entry.snapshot) for (const attribute of [...view.shape.attributes, ...view.shape.index === null ? [] : [view.shape.index]]) {
      const ref = attribute.words;
      if (ref.offset + ref.length * scalarBytes(ref.type) > header.data) throw new Error('Home seed block outside its data');
    }
    byKey.set(entry.key, entry);
  }
  const read = (key: string): HomeGeometrySnapshot | null => {
    const entry = byKey.get(key); if (entry === undefined) return null;
    const copies = new Map<string, TypedArray>();
    const words = (ref: Block): TypedArray => {
      const id = `${ref.type}:${String(ref.offset)}:${String(ref.length)}`, prior = copies.get(id); if (prior !== undefined) return prior;
      const at = start + ref.offset, bytes = ref.length * scalarBytes(ref.type);
      const copy = wordsOf(ref.type, input.slice(at, at + bytes).buffer); copies.set(id, copy); return copy;
    };
    return v.parse(HomeGeometrySnapshotSchema, swapWords(entry.snapshot, words));
  };
  return { keys: new Set(byKey.keys()), read };
}

/** Every entry of a seed, each checked against the IndexedDB record's schema. Malformed bytes throw. */
export function decodeHomeSeed(bytes: Uint8Array): Map<string, HomeGeometrySnapshot> {
  const seed = openHomeSeed(bytes), result = new Map<string, HomeGeometrySnapshot>();
  for (const key of seed.keys) { const snapshot = seed.read(key); if (snapshot !== null) result.set(key, snapshot); }
  return result;
}

/** `src/shards/<slug>/home-seed-keys.json`: the seed keys a cold grid entry of that home read, per tier
 * (scripts/record-home-seed-keys.mjs writes it; scripts/app-build/homeSeed.ts bakes them). */
export interface HomeSeedKeys { version: 1; tiers: { phone?: string[] | undefined; desktop?: string[] | undefined } }
const seedKeys = v.optional(v.pipe(v.array(v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*:./u), v.maxLength(16384))), v.maxLength(MAX_ENTRIES)));
export const HomeSeedKeysSchema: v.GenericSchema<unknown, HomeSeedKeys> = v.strictObject({ version: v.literal(1), tiers: v.strictObject({ phone: seedKeys, desktop: seedKeys }) });
/** A committed keys list, checked; every key is already origin-free, unique and sorted. */
export function readHomeSeedKeys(input: unknown): HomeSeedKeys {
  const keys = v.parse(HomeSeedKeysSchema, input);
  for (const list of [keys.tiers.phone, keys.tiers.desktop]) {
    if (list === undefined) continue;
    if (list.some((key, i) => homeSeedKey(key) !== key || i > 0 && (list[i - 1] ?? '') >= key)) throw new Error('Home seed keys must be normalised, unique and sorted');
  }
  return keys;
}
