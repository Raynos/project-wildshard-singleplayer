/// <reference types="node" />
import * as v from 'valibot';
import {existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync} from 'node:fs';
import {join, relative, resolve, sep} from 'node:path';
import {PickupCatalogueSchema} from '@wildshard/format/specimenCatalogue';
import {assetTableAddresses, readAssetTables} from './assetTables.mjs';
import {readGridSeams} from './gridSeams.mjs';
import {assembleOutputShardfile, parseOutputIndex} from '@wildshard/format/outputIndex';
import {entryReadSet} from './entryReadSet';
import {createHash} from 'node:crypto';
import {readSpawnManifest, type SpawnFile, type SpawnManifest, type SpawnManifestAddress} from '@wildshard/format/spawnManifest';
import {GPU_FILES} from '../../src/engine/client/boot/ktx2.generated';
import {assetIdentities, audioTableRefs, bundlerSources as manifestSources, identityFiles, joinRefs, standInRefs, packMembers, readFenceReads, resolveFenceReads, sectionRefs, type PackPart} from '@wildshard/format/fenceReads';
import {createPartEncoder, writeSpawnParts, type SpawnPartEncoding} from './spawnParts';
import {contentNamed} from './assetHashes';
import {homedir} from 'node:os';
import {BrotliSizeCache} from '../brotli-size-cache.mjs';
import {ASSET_CACHE_NAME} from '../../src/engine/client/pwa/cacheNames';

const size = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const files = v.array(v.tuple([v.string(), size]));
const schema = v.object({common: files, client: files, grid: files,
  selection: v.record(v.string(), files),
  optional: v.object({files, groups: v.record(v.string(), v.array(size))}),
  products: v.record(v.string(), v.union([v.strictTuple([size, size, size, size]), v.strictTuple([size, size])])),
  extras: v.record(v.string(), v.tuple([v.string(), size, size, v.string()])),
});
interface Address {readonly url: string; readonly bytes: number}
/** DL5: a shard's packs set, `src/shards/<slug>/packs-set.json` (`{"version": 1, "set": "fence"}`): 'fence' packs the
 *  default set (what the boot reads before control), absent packs the whole level. Anything else fails the build. */
export function readPacksSet(path: string): 'whole' | 'fence' {
  if (!existsSync(path)) return 'whole';
  return v.parse(v.strictObject({version: v.literal(1), set: v.literal('fence')}), JSON.parse(readFileSync(path, 'utf8'))).set;
}
export interface SpawnManifestBook {
  readonly cacheName: string;
  readonly client: Readonly<Record<string, Readonly<Record<'phone' | 'desktop', SpawnManifestAddress>>>>;
  readonly grid: Readonly<Record<string, Readonly<Record<string, Readonly<Record<'phone' | 'desktop', SpawnManifestAddress>>>>>>;
  /** DL16: the whole level with its parts, read only with Debug > Level download > Runtime packs. */
  readonly packs: {readonly client: SpawnManifestBook['client']; readonly grid: SpawnManifestBook['grid']};
}

/** Write the complete ordered spawn IO, rather than estimating a number from
 * a full product. This is the only list the new loader and bar consume. */
export async function writeSpawnManifests(outDir: string, input: unknown,
  strips: Readonly<Record<string, Readonly<Record<string, readonly Address[]>>>>, root: string,
  report?: (parts: SpawnPartEncoding) => void): Promise<SpawnManifestBook> {
  const bank = v.parse(schema, input), publicRoot = resolve(root, 'public'), output = resolve(outDir), assets = new Map<string, SpawnFile>();
  const encoded = new BrotliSizeCache(process.env['WILDSHARD_WIRE_SIZE_CACHE'] ?? resolve(homedir(), '.cache/wildshard/gen/served-bytes/1'));
  const precompressed = new BrotliSizeCache(process.env['WILDSHARD_WIRE_SIZE_CACHE'] ?? resolve(homedir(), '.cache/wildshard/gen/served-bytes/1'), 'precompressed');
  const wireSizes = new Map<string, number>();
  const wireBytes = (url: string, bytes: Uint8Array, hash: string): number => {
    const key = `${hash}:${url}`, previous = wireSizes.get(key); if (previous !== undefined) return previous;
    // Match the deployed/preview representation; Rapier retains its precompressed native body.
    const length = bytes.length < 1024 || /\.(?:png|jpe?g|webp|avif|gif|ico|woff2?|ttf|mp4|webm|mp3|ogg|m4a|wav)$/iu.test(url) ? bytes.length
      : url === '/assets/physics/rapier.wasm' ? precompressed.bytes(bytes) : encoded.bytes(bytes);
    wireSizes.set(key, length); return length;
  };
  const bytesFor = (url: string): Uint8Array => {
    if (!/^\/(?:assets|basis|fonts)\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/u.test(url) || url.split('/').includes('..')) throw new Error('Unsafe spawn asset URL');
    const emitted = join(output, url.slice(1)), authored = join(publicRoot, url.slice(1));
    return readFileSync(existsSync(emitted) ? emitted : authored);
  };
  // DL5: each listed URL's own bytes, read again only when its part is written.
  const sources = new Map<string, () => Uint8Array>();
  // DL5: a product file's stable name (model or section), so an edit keeps its part placement.
  const stableKeys = new Map<string, string>();
  const asset = (url: string, declared?: number): SpawnFile => {
    const previous = assets.get(url); if (previous !== undefined) {
      if (declared !== undefined && previous.bytes !== declared) throw new Error('Spawn asset size differs'); return previous;
    }
    const bytes = bytesFor(url), hash = createHash('sha256').update(bytes).digest('hex');
    if (declared !== undefined && declared !== bytes.length) throw new Error(`Spawn asset size differs: ${url}`);
    const versioned = contentNamed(url) || /[-_][a-zA-Z0-9_-]{8}\.(?:js|css)$/u.test(url) || url.startsWith('/basis/r');
    const row = {url: versioned ? url : `${url}?v=${hash.slice(0, 8)}`, bytes: bytes.length, hash, wireBytes: wireBytes(url, bytes, hash)};
    assets.set(url, row); sources.set(row.url, () => bytesFor(url)); return row;
  };
  // DL22: this build's /assets files (emitted and authored) and its pack parts, for the fence lists' /assets entries.
  let assetsSeen: readonly string[] | undefined, partsSeen: ReadonlyMap<string, PackPart> | undefined;
  const publicAssets = (): readonly string[] => {
    if (assetsSeen !== undefined) return assetsSeen;
    const urls = new Set<string>();
    for (const base of [output, publicRoot]) {
      const folder = join(base, 'assets');
      if (!existsSync(folder)) continue;
      for (const entry of readdirSync(folder, {recursive: true, withFileTypes: true})) {
        if (entry.isFile()) urls.add(`/${relative(base, join(entry.parentPath, entry.name)).split(sep).join('/')}`);
      }
    }
    assetsSeen = [...urls]; return assetsSeen;
  };
  // A name's hash is stripped only when the file's bytes match it (sha1 or sha256): `forest-2` is a name (sp-x1).
  const digestsSeen = new Map<string, readonly string[]>();
  const assetDigests = (path: string): readonly string[] => {
    const seen = digestsSeen.get(path); if (seen !== undefined) return seen;
    let found: readonly string[] = [];
    try { const bytes = bytesFor(path); found = [createHash('sha1').update(bytes).digest('hex'), createHash('sha256').update(bytes).digest('hex')]; }
    catch { /* not a file of this build: nothing is stripped */ }
    digestsSeen.set(path, found); return found;
  };
  // The bundler's own /assets files by their source module (its manifest: source -> emitted file).
  let sourcesSeen: ReadonlyMap<string, readonly string[]> | undefined;
  const bundlerSources = (): ReadonlyMap<string, readonly string[]> => {
    if (sourcesSeen !== undefined) return sourcesSeen;
    const manifest = join(output, '.vite/manifest.json');
    sourcesSeen = existsSync(manifest) ? manifestSources(JSON.parse(readFileSync(manifest, 'utf8'))) : new Map(); return sourcesSeen;
  };
  const packParts = (): ReadonlyMap<string, PackPart> => {
    if (partsSeen !== undefined) return partsSeen;
    const banks = readAssetTables(root), parts = new Map<string, PackPart>();
    for (const table of [banks.all, ...Object.values(banks.packs)]) for (const [url, part] of packMembers((JSON.parse(table.source) as {packs?: unknown}).packs)) parts.set(url, part);
    partsSeen = parts; return parts;
  };
  const common: SpawnFile[] = [];
  if (existsSync(join(publicRoot, 'assets/physics/rapier.wasm'))) common.push(asset('/assets/physics/rapier.wasm'));
  if (existsSync(join(publicRoot, 'basis'))) for (const directory of readdirSync(join(publicRoot, 'basis'))) {
    if (!/^r[0-9]+$/u.test(directory)) continue;
    for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) if (existsSync(join(publicRoot, 'basis', directory, name))) common.push(asset(`/basis/${directory}/${name}`));
  }
  const pickupPath = join(root, 'src/game/client/data/pickupCatalogue.json');
  if (existsSync(pickupPath)) {
    const pickups = v.parse(PickupCatalogueSchema, JSON.parse(readFileSync(pickupPath, 'utf8')));
    const packed = new Set(pickups.banks?.flatMap(row => row.members.map(member => member.file)));
    for (const row of pickups.banks ?? []) common.push(asset(row.file));
    for (const row of pickups.geometries) if ('file' in row && !packed.has(row.file)) common.push(asset(row.file));
  }
  const tables = existsSync(join(root, 'out/.app/boot-tables.json')) ? assetTableAddresses(readAssetTables(root)) : undefined;
  const seams = existsSync(join(root, 'out/.app/grid-seams.json')) ? readGridSeams(root).address : undefined;
  const client: Record<string, Record<'phone' | 'desktop', SpawnManifestAddress>> = {}, grid: Record<string, Record<string, Record<'phone' | 'desktop', SpawnManifestAddress>>> = {};
  mkdirSync(join(output, 'assets/spawn'), {recursive: true});
  const pending: {manifest: Omit<SpawnManifest, 'parts'>; public: boolean; packed: boolean}[] = [];
  const clientAt: Record<string, {phone: number; desktop: number}> = {}, gridAt: Record<string, Record<string, {phone: number; desktop: number}>> = {};
  const packsClientAt: typeof clientAt = {}, packsGridAt: typeof gridAt = {};
  for (const prefix of Object.keys(bank.products)) {
    const directory = prefix.split('/')[2]; if (directory === undefined || !/^[a-z0-9_-]+$/u.test(directory)) throw new Error('Invalid spawn shard');
    const product = join(root, 'out', directory), header = readFileSync(join(product, 'shard.json')), raw: unknown = JSON.parse(header.toString('utf8')), index = parseOutputIndex(raw);
    if (index.runtime !== null && (!('kind' in index.runtime) || index.runtime.kind !== 'client-plan')) continue;
    const sections = new Map<string, unknown>();
    for (const row of index.sections) {
      const bytes = readFileSync(join(product, row.path));
      if (bytes.length !== row.bytes || createHash('sha256').update(bytes).digest('hex') !== row.hash) throw new Error('Spawn section differs from index');
      sections.set(row.name, JSON.parse(bytes.toString('utf8')));
    }
    const source = assembleOutputShardfile(raw, sections), headerHash = createHash('sha256').update(header).digest('hex');
    // DL22: the shard's recorded pre-control reads (scripts/record-fence-reads.mjs), mapped to this product's hashes.
    const fencePath = join(root, 'src/shards', directory, 'fence-reads.json');
    let fence: ReadonlySet<string> = new Set(), fenceAssets: readonly string[] = [];
    if (existsSync(fencePath)) {
      const reads = readFenceReads(JSON.parse(readFileSync(fencePath, 'utf8')));
      const resolved = resolveFenceReads({version: 1, files: reads.files.filter(row => !row.startsWith('asset'))}, index.files, sections);
      // `/assets` entries, and a section reference that names an /assets file rather than a product file.
      const shell = [...reads.files.filter(row => row.startsWith('asset')), ...resolved.unresolved.filter(row => row.startsWith('ref:'))];
      // `/assets` reads (Pine's asset packs, gpu models, sfx, music): this build's emitted files and pack tables.
      const urls = publicAssets(), members = [...packParts().values()].flatMap(part => part.members);
      // Section references, then the boot tables' audio slots (Pine's colliding sfx revisions).
      const refs = joinRefs(sectionRefs(sections, new Set([...urls, ...members].map(url => url.split('?')[0] ?? url))),
        audioTableRefs(JSON.parse(readAssetTables(root).common.source) as {sfx?: unknown; music?: unknown}), standInRefs(GPU_FILES));
      // An identity is one file or none: one naming two distinct files (two vendor versions, sp-x9) refuses, never the first.
      const owners = identityFiles(assetIdentities(urls, packParts(), refs, {digests: assetDigests, sources: bundlerSources()}));
      const ambiguous = shell.filter(identity => (owners.get(identity)?.length ?? 0) > 1);
      if (ambiguous.length > 0) throw new Error(`${fencePath} lists ${ambiguous.length} identities naming more than one file of this build `
        + `(${ambiguous.slice(0, 3).join(', ')}); re-record with scripts/record-fence-reads.mjs`);
      const byIdentity = new Map<string, string>();
      for (const [identity, named] of owners) { const only = named[0]; if (named.length === 1 && only !== undefined) byIdentity.set(identity, only); }
      fenceAssets = [...new Set(shell.flatMap(identity => { const url = byIdentity.get(identity); return url === undefined ? [] : [url]; }))];
      const unresolved = [...resolved.unresolved.filter(row => !row.startsWith('ref:')), ...shell.filter(identity => !byIdentity.has(identity))];
      // A stale entry fails the build (sp-x8's review): skipping it would quietly bring back an on-demand fetch.
      if (unresolved.length > 0) throw new Error(`${fencePath} lists ${unresolved.length} files this build no longer has `
        + `(${unresolved.slice(0, 3).join(', ')}); re-record with scripts/record-fence-reads.mjs`);
      fence = resolved.hashes;
    }
    // DL5 (wildshard-new, G1012): a shard whose packs-on recording is slower than Shardfile (Pine: 122 vs 101 MB before
    // control) packs only what its boot reads before control, the default set (entry set + fence reads), not the whole
    // level; the rest loads on demand from its loose files, as on the Shardfile path. Per shard, in its own folder.
    const packsFence = readPacksSet(join(root, 'src/shards', directory, 'packs-set.json')) === 'fence';
    // Each string's first place in the sections (`world/scenes:libraries.24.tiles.0.files.3.file`), in section order.
    const namedAt = new Map<string, string>();
    const walk = (value: unknown, at: string): void => {
      if (typeof value === 'string') { if (!namedAt.has(value)) namedAt.set(value, at); return; }
      if (Array.isArray(value)) { value.forEach((item: unknown, row) => { walk(item, `${at}.${row}`); }); return; }
      if (typeof value === 'object' && value !== null) for (const [key, item] of Object.entries(value)) walk(item, `${at}.${key}`);
    };
    for (const [name, value] of sections) walk(value, `${name}:`);
    const productFile = (path: string, bytes: number, hash: string, name?: string): SpawnFile => {
      let wire = wireSizes.get(`${hash}:${path}`);
      if (wire === undefined) {
        const body = readFileSync(join(product, path));
        if (body.length !== bytes || createHash('sha256').update(body).digest('hex') !== hash) throw new Error('Spawn file differs from index');
        wire = wireBytes(path, body, hash);
      }
      const url = /\/[a-f0-9]{64}\.[a-z0-9]+$/u.test(path) ? `${prefix}${path}` : `${prefix}${path}?v=${hash.slice(0, 8)}`;
      sources.set(url, () => readFileSync(join(product, path)));
      // DL18: an unnamed blob keeps its place by where a section names it (its rewritten version takes the same key).
      const at = name ?? namedAt.get(hash) ?? namedAt.get(path);
      if (at !== undefined) stableKeys.set(url, `${prefix}${at}`);
      return {url, bytes, hash, wireBytes: wire};
    };
    const headerURL = `${prefix}shard.json?v=${headerHash.slice(0, 8)}`; sources.set(headerURL, () => header);
    const write = (tier: 'phone' | 'desktop', flow: 'client' | 'grid', addresses: readonly Address[] = [], mode = '000', whole = false): number => {
      const selected = new Map<string, SpawnFile>(), add = (row: SpawnFile): void => {selected.set(row.url, row);};
      add({url: headerURL, bytes: header.length, hash: headerHash, wireBytes: wireBytes(`${prefix}shard.json`, header, headerHash)});
      for (const row of index.sections) add(productFile(row.path, row.bytes, row.hash, `section:${row.name}`));
      for (const row of index.schemas) add(productFile(row.path, row.bytes, row.hash, `schema:${row.path}`));
      const wanted = entryReadSet(source, tier, index, sections, whole && !packsFence, fence);
      for (const row of index.files) if (wanted.has(row.hash)) add(productFile(row.path, row.compressed, row.hash, row.name));
      for (const url of fenceAssets) add(asset(url));
      for (const row of common) add(row);
      for (const [url, bytes] of [...bank.common, ...bank[flow]]) add(asset(url, bytes));
      const selections = flow === 'grid' ? Object.values(bank.selection) : [bank.selection[directory] ?? []];
      for (const rows of selections) for (const [url, bytes] of rows) add(asset(url, bytes));
      for (const member of bank.optional.groups[`home:${prefix}`] ?? []) {
        const row = bank.optional.files[member]; if (row === undefined) throw new Error('Invalid spawn module index'); add(asset(row[0], row[1]));
      }
      if (tables !== undefined) {
        add(asset(tables.common.url, tables.common.bytes));
        const table = flow === 'grid' || tier === 'desktop' ? tables.all : tables.packs[directory];
        if (table !== undefined) add(asset(table.url, table.bytes));
      }
      if (flow === 'grid' && seams !== undefined) {
        add(asset(seams.url, seams.bytes));
        // The compiled page owns its plans; only native fallback reads the
        // separate plan wire. Neither path declares the other one's payload.
        if (addresses.length === 0 && seams.plans !== undefined) add(asset(seams.plans.url, seams.plans.bytes));
      }
      for (const row of addresses) add(asset(row.url, row.bytes));
      const extra = bank.extras[prefix];
      if (extra !== undefined) {
        const inventory = bytesFor(extra[0]);
        if (inventory.length !== extra[1] || createHash('sha256').update(inventory).digest('hex') !== extra[3]) throw new Error('Spawn public inventory differs');
        for (const [url, bytes] of v.parse(files, JSON.parse(new TextDecoder().decode(inventory)))) add(asset(url, bytes));
      }
      // Required code can resolve while bulk content downloads. Keep each
      // partition's original order, every row and the full download barrier.
      const original = [...selected.values()], code = (row: SpawnFile): boolean => /\.(?:js|wasm)(?:\?|$)/u.test(row.url);
      const rows = [...original.filter(code), ...original.filter(row => !code(row))];
      const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0), wire = rows.reduce((sum, row) => {if (row.wireBytes === undefined) throw new Error('Missing spawn wire size'); return sum + row.wireBytes;}, 0);
      // The public phone entries (client, and grid mode 000) steer how files share parts.
      pending.push({manifest: {version: 1, shard: directory, tier, flow, files: rows, totalBytes, wireBytes: wire}, public: tier === 'phone' && (flow === 'client' || mode === '000'), packed: whole});
      return pending.length - 1;
    };
    // DL16: the default book is today's entry set (Shardfile, what every player gets); the packs book is the whole
    // level in parts, read only with Debug > Level download > Runtime packs until a memory reading backs it.
    clientAt[directory] = {phone: write('phone', 'client'), desktop: write('desktop', 'client')};
    packsClientAt[directory] = {phone: write('phone', 'client', [], '000', true), desktop: write('desktop', 'client', [], '000', true)};
    for (const [mode, homes] of Object.entries(strips)) {
      (gridAt[mode] ??= {})[directory] = {phone: write('phone', 'grid', homes[directory], mode), desktop: write('desktop', 'grid', homes[directory], mode)};
      (packsGridAt[mode] ??= {})[directory] = {phone: write('phone', 'grid', homes[directory], mode, true), desktop: write('desktop', 'grid', homes[directory], mode, true)};
    }
  }
  // DL5: every manifest is known, so pack their files into shared parts, then write each manifest with its own table.
  const packed = pending.flatMap((row, index) => row.packed ? [index] : []);
  const encoder = createPartEncoder();
  const packedTables = await writeSpawnParts(output, packed.map(index => ({rows: pending[index]?.manifest.files ?? [], public: pending[index]?.public === true})), url => {
    const read = sources.get(url); if (read === undefined) throw new Error(`Spawn file has no source: ${url}`); return read();
  }, url => stableKeys.get(url), encoder);
  // DL15: each part's q11 body is written before the manifests, so every part row carries its exact wire size.
  report?.(encoder.stats());
  const written: SpawnManifestAddress[] = [];
  for (const [index, {manifest: base}] of pending.entries()) {
    const at = packed.indexOf(index);
    const manifest = readSpawnManifest(at === -1 ? base : {...base, parts: packedTables[at] ?? []});
    const text = JSON.stringify(manifest), hash = createHash('sha256').update(text).digest('hex'), name = `assets/spawn/${base.shard}-${base.flow}-${base.tier}-${hash.slice(0, 16)}.json`;
    writeFileSync(join(output, name), text);
    written.push({url: `/${name}`, bytes: Buffer.byteLength(text), totalBytes: base.totalBytes, files: base.files.length, ...(base.wireBytes === undefined ? {} : {wireBytes: base.wireBytes})});
  }
  const at = (index: number): SpawnManifestAddress => { const address = written[index]; if (address === undefined) throw new Error('Missing spawn manifest'); return address; };
  for (const [directory, pair] of Object.entries(clientAt)) client[directory] = {phone: at(pair.phone), desktop: at(pair.desktop)};
  for (const [mode, shards] of Object.entries(gridAt)) for (const [directory, pair] of Object.entries(shards)) (grid[mode] ??= {})[directory] = {phone: at(pair.phone), desktop: at(pair.desktop)};
  const packs: {client: typeof client; grid: typeof grid} = {client: {}, grid: {}};
  for (const [directory, pair] of Object.entries(packsClientAt)) packs.client[directory] = {phone: at(pair.phone), desktop: at(pair.desktop)};
  for (const [mode, shards] of Object.entries(packsGridAt)) for (const [directory, pair] of Object.entries(shards)) (packs.grid[mode] ??= {})[directory] = {phone: at(pair.phone), desktop: at(pair.desktop)};
  return {cacheName: ASSET_CACHE_NAME, client, grid, packs};
}

