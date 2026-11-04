/** DL5 (download mini plan): pack the spawn manifests' files into shared, content-named parts.
 *
 * Parts are shared, never per manifest: the 112 manifests sum to 2.6 GB against 374 MB of distinct files. Files are
 * grouped by which public phone entries need them (client, and grid mode 000), so a part holds only bytes those
 * entries read together; files no public entry needs group by every manifest that lists them. While a public entry
 * still needs more than PART_TARGET parts, its two smallest groups merge, but only when no public entry's over-fetch
 * passes OVER_FETCH of its own bytes. Each group is cut into parts of at most PART_BYTES raw, never inside a file.
 * A part is the raw member bodies on 16-byte boundaries, named by its sha256; the offsets live in each manifest.
 * DL15: a part ships as q11 Brotli (`<name>.pack.br`): the packer writes each raw body at `<name>.pack` and
 * `encodeSpawnParts` replaces it with its encoding. */
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {once} from 'node:events';
import {availableParallelism, homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {Worker} from 'node:worker_threads';
import {brotliDecompressSync} from 'node:zlib';
import {SPAWN_PART_ALIGN, type SpawnFile, type SpawnPart} from '../../src/format/spawnManifest';

export const PART_BYTES = 12_000_000, PART_TARGET = 10, OVER_FETCH = 0.1;
export interface SpawnPartInput {readonly rows: readonly SpawnFile[]; readonly public: boolean}
interface Group {readonly key: string; readonly members: ReadonlySet<number>; readonly urls: string[]; bytes: number}

const align = (at: number): number => Math.ceil(at / SPAWN_PART_ALIGN) * SPAWN_PART_ALIGN;
/** Only files the page reads with fetch go in parts; the reader answers those. Shard images do (`fetchImage` reads
 * them with fetch); JS modules (`<script>`, `import()`) and the shell's `/assets/` images (DOM `<img>`) load past any
 * fetch layer, so on a first, uncontrolled visit they would download twice: they stay loose (DL14 decides code). */
export const packable = (url: string): boolean => !/\.(?:js|mjs|css)(?:\?|$)/u.test(url)
  && (url.startsWith('/shardfiles/') || !/\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?|$)/u.test(url))
  // A product's shard.json carries its build's validator stamp, so it changes every build: kept loose (one small
  // request), parts hold only content-named members and keep their names across builds (DL18).
  && !/\/shard\.json(?:\?|$)/u.test(url);
/** The groups after the steered merge (exported for the census and tests). */
export function spawnPartGroups(manifests: readonly SpawnPartInput[]): Group[] {
  const need = new Map<string, Set<number>>(), size = new Map<string, number>(), order: string[] = [];
  manifests.forEach((manifest, index) => {
    for (const row of manifest.rows) {
      if (!packable(row.url)) continue;
      const previous = size.get(row.url);
      if (previous !== undefined && previous !== row.bytes) throw new Error(`Spawn file sizes differ: ${row.url}`);
      if (previous === undefined) { size.set(row.url, row.bytes); order.push(row.url); }
      let set = need.get(row.url); if (set === undefined) { set = new Set(); need.set(row.url, set); } set.add(index);
    }
  });
  const isPublic = (index: number): boolean => manifests[index]?.public === true;
  const groups = new Map<string, Group>();
  for (const url of order) {
    const all = need.get(url) ?? new Set<number>(), wanted = [...all].filter(isPublic);
    const members = new Set(wanted.length > 0 ? wanted : all), key = `${wanted.length > 0 ? 'P' : 'X'}:${[...members].sort((a, b) => a - b).join(',')}`;
    let group = groups.get(key); if (group === undefined) { group = {key, members, urls: [], bytes: 0}; groups.set(key, group); }
    group.urls.push(url); group.bytes += size.get(url) ?? 0;
  }
  const publicIndices = manifests.flatMap((manifest, index) => manifest.public ? [index] : []);
  const own = new Map(publicIndices.map(index => [index, manifests[index]?.rows.reduce((sum, row) => sum + (packable(row.url) ? row.bytes : 0), 0) ?? 0]));
  const over = new Map(publicIndices.map(index => [index, 0]));
  const partsOf = (group: Group): number => Math.max(1, Math.ceil(group.bytes / PART_BYTES));
  const needs = (index: number): number => [...groups.values()].reduce((sum, group) => sum + (group.members.has(index) ? partsOf(group) : 0), 0);
  for (;;) {
    const worst = publicIndices.reduce<number | undefined>((best, index) => best === undefined || needs(index) > needs(best) ? index : best, undefined);
    if (worst === undefined || needs(worst) <= PART_TARGET) break;
    const mine = [...groups.values()].filter(group => group.key.startsWith('P:') && group.members.has(worst)).sort((a, b) => a.bytes - b.bytes);
    let merged = false;
    for (const small of mine) {
      for (const other of mine) {
        if (other === small) continue;
        const extra = new Map<number, number>();
        for (const index of small.members) if (!other.members.has(index)) extra.set(index, other.bytes);
        for (const index of other.members) if (!small.members.has(index)) extra.set(index, small.bytes);
        if (![...extra].every(([index, bytes]) => (over.get(index) ?? 0) + bytes <= OVER_FETCH * (own.get(index) ?? 0))) continue;
        for (const [index, bytes] of extra) over.set(index, (over.get(index) ?? 0) + bytes);
        const members = new Set([...small.members, ...other.members]), key = `P:${[...members].sort((a, b) => a - b).join(',')}`;
        groups.delete(small.key); groups.delete(other.key);
        const joined = groups.get(key) ?? {key, members, urls: [], bytes: 0};
        joined.urls.push(...small.urls, ...other.urls); joined.bytes += small.bytes + other.bytes; groups.set(key, joined);
        merged = true; break;
      }
      if (merged) break;
    }
    if (!merged) break;
  }
  return [...groups.values()];
}

/** DL5 (sp-x2's review): a member's part depends on its own stable key (the sha256 of its name), never on what
 * precedes it, so an edited or resized file changes only its own part. A group of B bytes is cut into
 * ceil(B / PART_TARGET_BYTES) buckets by that key;
 * a bucket that skews past PART_BYTES splits again on the next hash bits. Members sit in hash order inside a part.
 * (The bucket count moves only when the group crosses a multiple of the target.) */
export const PART_TARGET_BYTES = 9_000_000;
export function placeByContent(urls: readonly string[], size: (url: string) => number, hash: (url: string) => string, depth = 0): string[][] {
  const total = urls.reduce((sum, url) => align(sum) + size(url), 0);
  if (total <= PART_BYTES && (depth > 0 || total <= PART_TARGET_BYTES) || urls.length <= 1 || depth >= 7) {
    return urls.length === 0 ? [] : [[...urls].sort((a, b) => hash(a).localeCompare(hash(b)))];
  }
  const count = depth === 0 ? Math.ceil(total / PART_TARGET_BYTES) : Math.ceil(total / PART_TARGET_BYTES) + 1;
  const buckets: string[][] = Array.from({length: count}, () => []);
  for (const url of urls) buckets[Number.parseInt(hash(url).slice(depth * 8, depth * 8 + 8), 16) % count]?.push(url);
  return buckets.flatMap(bucket => placeByContent(bucket, size, hash, depth + 1));
}
/** Write every part under `outDir/assets/spawn/parts/` and return each manifest's part table (same order as input). */
export function writeSpawnParts(outDir: string, manifests: readonly SpawnPartInput[], read: (url: string) => Uint8Array,
  stableKey: (url: string) => string | undefined = () => undefined): SpawnPart[][] {
  const placed = new Map<string, {url: string; bytes: number; hash: string; offset: number}>(), written: {url: string; bytes: number; hash: string}[] = [];
  mkdirSync(join(outDir, 'assets/spawn/parts'), {recursive: true});
  const sizes = new Map(manifests.flatMap(manifest => manifest.rows.map(row => [row.url, row.bytes] as const)));
  // A file's placement follows its stable name (a model's or section's name; else its URL), so an edit that
  // renames its content-named blob still lands in the same part.
  const keys = new Map<string, string>();
  const placementKey = (url: string): string => {
    let key = keys.get(url);
    if (key === undefined) { key = createHash('sha256').update(stableKey(url) ?? url).digest('hex'); keys.set(url, key); }
    return key;
  };
  const write = (batch: readonly string[]): void => {
    const length = batch.reduce((at, url) => align(at) + (sizes.get(url) ?? 0), 0);
    const body = new Uint8Array(length), offsets = new Map<string, number>(); let cursor = 0;
    for (const url of batch) {
      cursor = align(cursor); const bytes = read(url);
      if (bytes.length !== sizes.get(url)) throw new Error(`Spawn part member size differs: ${url}`);
      body.set(bytes, cursor); offsets.set(url, cursor); cursor += bytes.length;
    }
    const hash = createHash('sha256').update(body).digest('hex'), url = `/assets/spawn/parts/${hash.slice(0, 16)}.pack.br`;
    writeFileSync(join(outDir, `assets/spawn/parts/${hash.slice(0, 16)}.pack`), body); // encodeSpawnParts publishes `url`
    for (const [member, offset] of offsets) placed.set(member, {url, bytes: body.length, hash, offset});
    written.push({url, bytes: body.length, hash});
  };
  for (const group of spawnPartGroups(manifests)) {
    for (const url of group.urls) {
      const bytes = sizes.get(url) ?? 0;
      if (bytes > PART_BYTES) throw new Error(`Spawn file larger than a part (${bytes} > ${PART_BYTES}): ${url}`);
    }
    for (const batch of placeByContent(group.urls, url => sizes.get(url) ?? 0, placementKey)) write(batch);
  }
  return manifests.map(manifest => {
    const parts = new Map<string, {url: string; bytes: number; hash: string; members: [number, number][]}>();
    manifest.rows.forEach((row, index) => {
      if (!packable(row.url)) return;
      const at = placed.get(row.url); if (at === undefined) throw new Error(`Spawn file outside every part: ${row.url}`);
      let part = parts.get(at.url); if (part === undefined) { part = {url: at.url, bytes: at.bytes, hash: at.hash, members: []}; parts.set(at.url, part); }
      part.members.push([index, at.offset]);
    });
    for (const part of parts.values()) part.members.sort((a, b) => a[1] - b[1]);
    return [...parts.values()];
  });
}

/** One q11 Brotli encoder thread; compression runs off the build's main thread, several parts at once. Its source runs
 * as CommonJS or as a module (an eval worker takes the parent's --input-type), hence getBuiltinModule. */
const ENCODER = `const {parentPort} = process.getBuiltinModule('node:worker_threads'), zlib = process.getBuiltinModule('node:zlib');
parentPort.on('message', body => parentPort.postMessage(zlib.brotliCompressSync(body, {params: {[zlib.constants.BROTLI_PARAM_QUALITY]: 11,
  [zlib.constants.BROTLI_PARAM_LGWIN]: 24, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length}})));`;
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
/** DL15 (BP6 / DS5): replace every raw `<name>.pack` the packer wrote with its q11 Brotli `<name>.pack.br`, which
 * vercel.json and the preview server serve as-is with `Content-Encoding: br`. On 40bc516d5c that is 1.0 to 6.2 MB less
 * on the wire per Runtime packs entry than Vercel's on-the-fly q3 (sp-x2), at about 1 MB/s of encoder time cold; parts
 * keep their names across builds (DL18), so each encoding is kept by its body's sha256 in `cacheDir`, and a kept one is
 * used only after it decodes to that body. */
export interface SpawnPartEncoding {
  readonly parts: number; readonly rawBytes: number; readonly wireBytes: number; readonly encoded: number;
  /** Each part's served URL (`/assets/spawn/parts/<name>.pack.br`) → its q11 body's length. */
  readonly wire: ReadonlyMap<string, number>;
}
export async function encodeSpawnParts(outDir: string, cacheDir = process.env['WILDSHARD_SPAWN_PART_CACHE']
  ?? resolve(homedir(), '.cache/wildshard/gen/spawn-parts-br/1')): Promise<SpawnPartEncoding> {
  const directory = join(outDir, 'assets/spawn/parts');
  const names = existsSync(directory) ? readdirSync(directory).filter(name => name.endsWith('.pack')).sort() : [];
  const workers: Worker[] = [], sizes = new Map<string, number>();
  let cursor = 0, rawBytes = 0, wireBytes = 0, encoded = 0;
  const encode = async (worker: Worker, body: Uint8Array): Promise<Uint8Array> => {
    const reply = once(worker, 'message'); // rejects on the worker's 'error'
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port has no origin.
    worker.postMessage(body);
    const [wire]: unknown[] = await reply;
    if (!(wire instanceof Uint8Array)) throw new Error('Spawn part encoder returned no bytes');
    return wire;
  };
  const lane = async (): Promise<void> => {
    let worker: Worker | undefined;
    for (let at = cursor++; at < names.length; at = cursor++) {
      const name = names[at] ?? '', path = join(directory, name), body = readFileSync(path), hash = sha256(body);
      const kept = join(cacheDir, `${hash}.br`);
      let wire: Uint8Array | undefined;
      // Decoding is bounded by the body's own length: a kept file that would decode larger is refused, not inflated.
      try { const saved = readFileSync(kept); if (sha256(brotliDecompressSync(saved, {maxOutputLength: body.length})) === hash) wire = saved; } catch { /* not kept yet */ }
      if (wire === undefined) {
        if (worker === undefined) { worker = new Worker(ENCODER, {eval: true}); workers.push(worker); }
        wire = await encode(worker, body); encoded++;
        const temporary = `${kept}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
        try { mkdirSync(cacheDir, {recursive: true}); writeFileSync(temporary, wire, {flag: 'wx'}); renameSync(temporary, kept); }
        catch { rmSync(temporary, {force: true}); /* an unwritable cache only costs the next build its encode */ }
      }
      writeFileSync(`${path}.br`, wire); rmSync(path);
      rawBytes += body.length; wireBytes += wire.length; sizes.set(`/assets/spawn/parts/${name}.br`, wire.length);
    }
  };
  try { await Promise.all(Array.from({length: Math.min(names.length, Math.max(1, availableParallelism() - 2))}, lane)); }
  finally { await Promise.all(workers.map(worker => worker.terminate())); }
  return {parts: names.length, rawBytes, wireBytes, encoded, wire: sizes};
}
