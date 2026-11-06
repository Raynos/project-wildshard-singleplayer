/// <reference types="node" />
/** C1 (J28, J83, J84): `cook <shardfile> → <packs>`. A shard's half of the spawn download, from its tarball alone: no
 * bundle, no `src/shards`, no `public/`. The engine half (code, common files, boot tables) is per build and stays with
 * the app build, which calls this once per product and keeps today's grouping for what is left.
 *
 * What comes out: one manifest per tier and set (`entry`, what every player gets; `whole`, the level with its parts), the
 * q11 parts, and each mount at its public URL when it can't go in a part. Part bodies follow `placeByKey`, so a product's
 * sections and level files fall in the same parts whether one shard cooks or twenty-eight do (DL18). */
// oxlint-disable-next-line import/no-nodejs-modules -- The cook is a Node process (J28).
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The cook is a Node process (J28).
import {mkdirSync, writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The cook is a Node process (J28).
import {dirname, join} from 'node:path';
import {assetIdentities, identityFiles, resolveFenceReads, sectionRefs} from '@wildshard/format/fenceReads';
import {COOK_DATA_PATH, readCookData, type CookData} from '@wildshard/format/cookData';
import {assembleOutputShardfile, parseOutputIndex, type OutputIndex} from '@wildshard/format/outputIndex';
import {SPAWN_PART_ALIGN, readSpawnManifest, type SpawnFile, type SpawnManifest, type SpawnPart} from '@wildshard/format/spawnManifest';
import type {Shardfile} from '@wildshard/format/shardSchema';
import {readTar} from '@wildshard/format/tar';
import type {ServerPack} from '../shared/shardfile/serverPack';
import {entryReadSet} from './entryReadSet';
import {createPartEncoder, packable, writeSpawnParts, type CookedMember, type PartEncoder} from './spawnParts';

export type CookTier = 'phone' | 'desktop';
export type CookSet = 'entry' | 'whole';
export const COOK_TIERS: readonly CookTier[] = ['phone', 'desktop'];
export const COOK_SETS: readonly CookSet[] = ['entry', 'whole'];
/** The size a served file has on the wire; the cook has no opinion on how a host compresses a loose file. */
export type WireBytes = (url: string, bytes: Uint8Array, hash: string) => number;

/** Bytes a host serves as they are: small files and formats that are already compressed (J84). */
export const servedAsIs = (url: string, bytes: Uint8Array): boolean => bytes.length < 1024 || /\.(?:png|jpe?g|webp|avif|gif|ico|woff2?|ttf|mp4|webm|mp3|ogg|m4a|wav)$/iu.test(url);

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const CONTENT_NAMED = /\/[a-f0-9]{64}\.[a-z0-9]+$/u;

/** A shardfile opened from its tarball, every read checked against its index. */
export interface OpenShardfile {
  readonly slug: string;
  readonly index: OutputIndex;
  readonly source: Shardfile;
  readonly sections: ReadonlyMap<string, unknown>;
  readonly cook: CookData | undefined;
  readonly header: Uint8Array;
  readonly read: (path: string) => Uint8Array;
}

export function openShardfile(tarball: Uint8Array): OpenShardfile {
  const files = readTar(tarball);
  const read = (path: string): Uint8Array => { const bytes = files.get(path); if (bytes === undefined) throw new Error(`No ${path} in the shardfile`); return bytes; };
  const header = read('shard.json'), raw: unknown = JSON.parse(new TextDecoder().decode(header)), index = parseOutputIndex(raw);
  const sections = new Map<string, unknown>();
  for (const row of index.sections) {
    const bytes = read(row.path);
    if (bytes.length !== row.bytes || sha256(bytes) !== row.hash) throw new Error('Spawn section differs from index');
    sections.set(row.name, JSON.parse(new TextDecoder().decode(bytes)));
  }
  const cook = index.cook === undefined ? undefined : readCookData(JSON.parse(new TextDecoder().decode(read(COOK_DATA_PATH))));
  return {slug: index.identity.slug, index, source: assembleOutputShardfile(raw, sections), sections, cook, header, read};
}

/** Each string's first place in the sections (`world/scenes:libraries.24.tiles.0.files.3.file`), in section order: a
 * blob with no name keeps its part by where a section names it, so an edit that renames it stays put (DL18). */
function namedPlaces(sections: ReadonlyMap<string, unknown>): ReadonlyMap<string, string> {
  const named = new Map<string, string>();
  const walk = (value: unknown, at: string): void => {
    if (typeof value === 'string') { if (!named.has(value)) named.set(value, at); return; }
    if (Array.isArray(value)) { value.forEach((item: unknown, row) => { walk(item, `${at}.${row}`); }); return; }
    if (typeof value === 'object' && value !== null) for (const [key, item] of Object.entries(value)) walk(item, `${at}.${key}`);
  };
  for (const [name, value] of sections) walk(value, `${name}:`);
  return named;
}

/** D5: a stale hint warns and costs seconds; it never refuses a cook. Asset identities here name only this shard's
 *  mounts: one that names an engine file belongs to the app build's half. */
function fenceHints(shard: OpenShardfile, warn: (line: string) => void): {readonly hashes: ReadonlySet<string>; readonly mounts: readonly string[]} {
  const reads = shard.cook?.fence;
  if (reads === undefined) return {hashes: new Set(), mounts: []};
  const resolved = resolveFenceReads({version: 1, files: reads.filter(row => !row.startsWith('asset'))}, shard.index.files, shard.sections);
  const stale = resolved.unresolved.filter(row => !row.startsWith('ref:'));
  if (stale.length > 0) warn(`${shard.slug}: ${stale.length} fence reads this revision no longer has (${stale.slice(0, 3).join(', ')})`);
  const hashOf = new Map((shard.cook?.mounts ?? []).map(row => [row.url, row.hash]));
  const owners = identityFiles(assetIdentities([...hashOf.keys()], new Map(), sectionRefs(shard.sections, new Set(hashOf.keys())),
    {digests: url => { const hash = hashOf.get(url); return hash === undefined ? [] : [hash]; }, sources: new Map()}));
  const shell = [...reads.filter(row => row.startsWith('asset')), ...resolved.unresolved.filter(row => row.startsWith('ref:'))];
  return {hashes: resolved.hashes, mounts: [...new Set(shell.flatMap(identity => { const named = owners.get(identity); return named?.length === 1 && named[0] !== undefined ? [named[0]] : []; }))]};
}

/** A mount's tier by its name: `.desktop` and `.phone` say so, and a file with a `.phone` sibling is the desktop's. */
function mountTiers(urls: ReadonlySet<string>): (url: string, tier: CookTier) => boolean {
  return (url, tier) => {
    if (/\.phone[.-]/u.test(url)) return tier === 'phone';
    if (/\.desktop[.-]/u.test(url)) return tier === 'desktop';
    const dot = url.lastIndexOf('.');
    return tier === 'desktop' || !urls.has(`${url.slice(0, dot)}.phone${url.slice(dot)}`);
  };
}

export interface ShardHalf {
  readonly shard: OpenShardfile;
  /** The header row, kept loose: it carries the build's validator stamp, so it changes every build (DL18). */
  readonly header: SpawnFile;
  /** The product's rows of one manifest, in manifest order. */
  readonly productRows: (tier: CookTier, set: CookSet) => readonly SpawnFile[];
  /** The mounts of one manifest. */
  readonly mountRows: (tier: CookTier, set: CookSet) => readonly SpawnFile[];
  readonly read: (url: string) => Uint8Array;
  readonly stableKey: (url: string) => string | undefined;
}

/** The shard half of every manifest: what the app build's `write` and the standalone cook share. `folder` is where the
 *  product is served; a catalogue names it by slug, and today's `_template` folder is the one that differs (`template`). */
export function shardHalf(shard: OpenShardfile, wireBytes: WireBytes, warn: (line: string) => void = () => undefined, folder: string = shard.slug): ShardHalf {
  const prefix = `/shardfiles/${folder}/`, {index, source, sections} = shard, named = namedPlaces(sections);
  const fence = fenceHints(shard, warn), wholeSet = shard.cook?.packs !== 'fence';
  const sources = new Map<string, () => Uint8Array>(), stableKeys = new Map<string, string>(), rows = new Map<string, SpawnFile>();
  const productFile = (path: string, bytes: number, hash: string, name?: string): SpawnFile => {
    const url = CONTENT_NAMED.test(path) ? `${prefix}${path}` : `${prefix}${path}?v=${hash.slice(0, 8)}`;
    const kept = rows.get(url); if (kept !== undefined) return kept;
    const body = shard.read(path);
    if (body.length !== bytes || sha256(body) !== hash) throw new Error('Spawn file differs from index');
    sources.set(url, () => shard.read(path));
    // DL18: an unnamed blob keeps its place by where a section names it (its rewritten version takes the same key).
    const at = name ?? named.get(hash) ?? named.get(path);
    if (at !== undefined) stableKeys.set(url, `${prefix}${at}`);
    const row = {url, bytes, hash, wireBytes: wireBytes(path, body, hash)}; rows.set(url, row); return row;
  };
  const headerHash = sha256(shard.header), headerURL = `${prefix}shard.json?v=${headerHash.slice(0, 8)}`;
  sources.set(headerURL, () => shard.header);
  const header = {url: headerURL, bytes: shard.header.length, hash: headerHash, wireBytes: wireBytes(`${prefix}shard.json`, shard.header, headerHash)};
  const mounts = shard.cook?.mounts ?? [], mountURLs = new Set(mounts.map(row => row.url)), onTier = mountTiers(mountURLs);
  const mountRow = new Map(mounts.map(row => {
    const url = CONTENT_NAMED.test(row.url) || /-[a-f0-9]{8}\.[a-z0-9]+$/u.test(row.url) ? row.url : `${row.url}?v=${row.hash.slice(0, 8)}`;
    sources.set(url, () => shard.read(row.path));
    return [row.url, () => ({url, bytes: row.bytes, hash: row.hash, wireBytes: wireBytes(row.url, shard.read(row.path), row.hash)})] as const;
  }));
  return {shard, header, read: url => { const read = sources.get(url); if (read === undefined) throw new Error(`Spawn file has no source: ${url}`); return read(); },
    stableKey: url => stableKeys.get(url),
    productRows: (tier, set) => {
      const selected: SpawnFile[] = [header];
      for (const row of index.sections) selected.push(productFile(row.path, row.bytes, row.hash, `section:${row.name}`));
      for (const row of index.schemas) selected.push(productFile(row.path, row.bytes, row.hash, `schema:${row.path}`));
      const wanted = entryReadSet(source, tier, index, sections, set === 'whole' && wholeSet, fence.hashes);
      for (const row of index.files) if (wanted.has(row.hash)) selected.push(productFile(row.path, row.compressed, row.hash, row.name));
      return selected;
    },
    mountRows: (tier, set) => {
      const urls = set === 'whole' && wholeSet ? mounts.map(row => row.url).filter(url => onTier(url, tier)) : fence.mounts;
      return urls.flatMap(url => { const row = mountRow.get(url); return row === undefined ? [] : [row()]; });
    }};
}

/** Cook the parts of a set of manifests and say where each packable URL landed, for the app build's own parts table. */
export async function cookParts(out: string, half: ShardHalf, tables: readonly {readonly tier: CookTier; readonly rows: readonly SpawnFile[]}[], encoder: PartEncoder): Promise<ReadonlyMap<string, CookedMember>> {
  const parts = await writeSpawnParts(out, tables.map(row => ({rows: row.rows, public: row.tier === 'phone'})), half.read, half.stableKey, encoder);
  const placed = new Map<string, CookedMember>();
  parts.forEach((table, at) => {
    const rows = tables[at]?.rows ?? [];
    for (const part of table) for (const [member, offset] of part.members) {
      const row = rows[member]; if (row !== undefined) placed.set(row.url, {url: part.url, bytes: part.bytes, hash: part.hash, offset, wireBytes: part.wireBytes ?? 0});
    }
  });
  return placed;
}

/** C2: the server class as one part, in its own folder: the download gates tell a server's reads from a page's by path. A
 *  product with no server files has none. */
export async function cookServerPack(rows: readonly {readonly path: string; readonly hash: string; readonly bytes: number}[], read: (path: string) => Uint8Array, out: string, encoder: PartEncoder): Promise<ServerPack | undefined> {
  if (rows.length === 0) return undefined;
  const align = (at: number): number => Math.ceil(at / SPAWN_PART_ALIGN) * SPAWN_PART_ALIGN;
  const sorted = [...rows].sort((left, right) => left.path < right.path ? -1 : 1);
  const length = sorted.reduce((at, row) => align(at) + row.bytes, 0), body = new Uint8Array(length), files: [string, number, number][] = [];
  let cursor = 0;
  for (const row of sorted) {
    const bytes = read(row.path);
    if (bytes.length !== row.bytes || sha256(bytes) !== row.hash) throw new Error('Server file differs from its index');
    cursor = align(cursor); body.set(bytes, cursor); files.push([row.path, cursor, bytes.length]); cursor += bytes.length;
  }
  const hash = sha256(body), wire = await encoder.encode(body, hash), url = `/assets/spawn/server/${hash.slice(0, 16)}.pack.br`;
  mkdirSync(join(out, 'assets/spawn/server'), {recursive: true}); writeFileSync(join(out, url.slice(1)), wire);
  return {url, bytes: body.length, hash, wireBytes: wire.length, files};
}

export interface CookReport {
  readonly slug: string;
  readonly seconds: number;
  readonly manifests: readonly {readonly url: string; readonly tier: CookTier; readonly set: CookSet; readonly files: number; readonly totalBytes: number; readonly wireBytes: number}[];
  readonly loose: readonly string[];
  readonly parts: {readonly count: number; readonly rawBytes: number; readonly wireBytes: number};
  readonly server: {readonly url: string; readonly wireBytes: number; readonly files: number} | undefined;
}

/** `cook <shardfile> → <packs>`: the shard's half of every manifest, its parts, and its loose mounts at their URLs. */
export async function cookShard(tarball: Uint8Array, out: string, options: {readonly wireBytes: WireBytes; readonly now: () => number; readonly encoder?: PartEncoder; readonly warn?: (line: string) => void}): Promise<CookReport> {
  const started = options.now(), half = shardHalf(openShardfile(tarball), options.wireBytes, options.warn);
  const encoder = options.encoder ?? createPartEncoder();
  const before = encoder.stats();
  const table = COOK_TIERS.flatMap(tier => COOK_SETS.map(set => ({tier, set, rows: [...half.productRows(tier, set), ...half.mountRows(tier, set)]})));
  const whole = table.filter(row => row.set === 'whole');
  const parts = await writeSpawnParts(out, whole.map(row => ({rows: row.rows, public: row.tier === 'phone'})), half.read, half.stableKey, encoder);
  const after = encoder.stats(), manifests: CookReport['manifests'][number][] = [];
  mkdirSync(join(out, 'assets/spawn'), {recursive: true});
  for (const row of table) {
    const at = whole.indexOf(row), partRows: readonly SpawnPart[] | undefined = at === -1 ? undefined : parts[at];
    const totalBytes = row.rows.reduce((sum, file) => sum + file.bytes, 0), wire = row.rows.reduce((sum, file) => sum + (file.wireBytes ?? 0), 0);
    const base: Omit<SpawnManifest, 'parts'> = {version: 1, shard: half.shard.slug, tier: row.tier, flow: 'client', files: row.rows, totalBytes, wireBytes: wire};
    const manifest = readSpawnManifest(partRows === undefined ? base : {...base, parts: partRows}), text = JSON.stringify(manifest);
    const name = `assets/spawn/${half.shard.slug}-${row.set}-${row.tier}-${sha256(new TextEncoder().encode(text)).slice(0, 16)}.json`;
    writeFileSync(join(out, name), text);
    manifests.push({url: `/${name}`, tier: row.tier, set: row.set, files: row.rows.length, totalBytes, wireBytes: wire});
  }
  const server = await cookServerPack(half.shard.index.admission.server ?? [], half.shard.read, out, encoder);
  if (server !== undefined) writeFileSync(join(out, `assets/spawn/server-${half.shard.slug}.json`), JSON.stringify(server));
  // What no part may hold still serves at its URL (DL14: `<img>` and module loads pass any fetch layer).
  const loose = (half.shard.cook?.mounts ?? []).filter(row => !packable(row.url));
  for (const row of loose) {
    const file = join(out, row.url.slice(1));
    mkdirSync(dirname(file), {recursive: true}); writeFileSync(file, half.shard.read(row.path));
  }
  return {slug: half.shard.slug, seconds: (options.now() - started) / 1000, manifests, loose: loose.map(row => row.url), server: server === undefined ? undefined : {url: server.url, wireBytes: server.wireBytes, files: server.files.length},
    parts: {count: after.parts - before.parts, rawBytes: after.rawBytes - before.rawBytes, wireBytes: after.wireBytes - before.wireBytes}};
}
