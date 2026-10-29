/// <reference types="node" />
import * as v from 'valibot';
import {existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {PickupCatalogueSchema} from '../../src/format/specimenCatalogue';
import {assetTableAddresses, readAssetTables} from './assetTables.mjs';
import {assembleOutputShardfile, parseOutputIndex} from '../../src/format/outputIndex';
import {entryReadSet} from './entryReadSet';
import {createHash} from 'node:crypto';
import {readSpawnManifest, type SpawnFile, type SpawnManifestAddress} from '../../src/format/spawnManifest';
import {contentNamed} from './assetHashes';
import {ASSET_CACHE_NAME} from '../../src/engine/pwa/cacheNames';

const size = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const files = v.array(v.tuple([v.string(), size]));
const schema = v.object({common: files, client: files, grid: files,
  selection: v.record(v.string(), files),
  optional: v.object({files, groups: v.record(v.string(), v.array(size))}),
  products: v.record(v.string(), v.union([v.strictTuple([size, size, size, size]), v.strictTuple([size, size])])),
  extras: v.record(v.string(), v.tuple([v.string(), size, size, v.string()])),
});
interface Address {readonly url: string; readonly bytes: number}
export interface SpawnManifestBook {
  readonly cacheName: string;
  readonly client: Readonly<Record<string, Readonly<Record<'phone' | 'desktop', SpawnManifestAddress>>>>;
  readonly grid: Readonly<Record<string, Readonly<Record<string, Readonly<Record<'phone' | 'desktop', SpawnManifestAddress>>>>>>;
}

/** Write the complete ordered spawn IO, rather than estimating a number from
 * a full product. This is the only list the new loader and bar consume. */
export function writeSpawnManifests(outDir: string, input: unknown,
  strips: Readonly<Record<string, Readonly<Record<string, readonly Address[]>>>>, root: string): SpawnManifestBook {
  const bank = v.parse(schema, input), publicRoot = resolve(root, 'public'), output = resolve(outDir), assets = new Map<string, SpawnFile>();
  const bytesFor = (url: string): Uint8Array => {
    if (!/^\/(?:assets|basis|fonts)\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/u.test(url) || url.split('/').includes('..')) throw new Error('Unsafe spawn asset URL');
    const emitted = join(output, url.slice(1)), authored = join(publicRoot, url.slice(1));
    return readFileSync(existsSync(emitted) ? emitted : authored);
  };
  const asset = (url: string, declared?: number): SpawnFile => {
    const previous = assets.get(url); if (previous !== undefined) {
      if (declared !== undefined && previous.bytes !== declared) throw new Error('Spawn asset size differs'); return previous;
    }
    const bytes = bytesFor(url), hash = createHash('sha256').update(bytes).digest('hex');
    if (declared !== undefined && declared !== bytes.length) throw new Error(`Spawn asset size differs: ${url}`);
    const versioned = contentNamed(url) || /[-_][a-zA-Z0-9_-]{8}\.(?:js|css)$/u.test(url) || url.startsWith('/basis/r');
    const row = {url: versioned ? url : `${url}?v=${hash.slice(0, 8)}`, bytes: bytes.length, hash};
    assets.set(url, row); return row;
  };
  const common: SpawnFile[] = [];
  if (existsSync(join(publicRoot, 'assets/physics/rapier.wasm'))) common.push(asset('/assets/physics/rapier.wasm'));
  if (existsSync(join(publicRoot, 'basis'))) for (const directory of readdirSync(join(publicRoot, 'basis'))) {
    if (!/^r[0-9]+$/u.test(directory)) continue;
    for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) if (existsSync(join(publicRoot, 'basis', directory, name))) common.push(asset(`/basis/${directory}/${name}`));
  }
  const pickupPath = join(root, 'src/game/data/pickupCatalogue.json');
  if (existsSync(pickupPath)) {
    const pickups = v.parse(PickupCatalogueSchema, JSON.parse(readFileSync(pickupPath, 'utf8')));
    const packed = new Set(pickups.banks?.flatMap(row => row.members.map(member => member.file)));
    for (const row of pickups.banks ?? []) common.push(asset(row.file));
    for (const row of pickups.geometries) if ('file' in row && !packed.has(row.file)) common.push(asset(row.file));
  }
  const tables = existsSync(join(root, 'out/.app/boot-tables.json')) ? assetTableAddresses(readAssetTables(root)) : undefined;
  const client: Record<string, Record<'phone' | 'desktop', SpawnManifestAddress>> = {}, grid: Record<string, Record<string, Record<'phone' | 'desktop', SpawnManifestAddress>>> = {};
  mkdirSync(join(output, 'assets/spawn'), {recursive: true});
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
    const productFile = (path: string, bytes: number, hash: string): SpawnFile => ({url: /\/[a-f0-9]{64}\.[a-z0-9]+$/u.test(path)
      ? `${prefix}${path}` : `${prefix}${path}?v=${hash.slice(0, 8)}`, bytes, hash});
    const write = (tier: 'phone' | 'desktop', flow: 'client' | 'grid', addresses: readonly Address[] = []): SpawnManifestAddress => {
      const selected = new Map<string, SpawnFile>(), add = (row: SpawnFile): void => {selected.set(row.url, row);};
      add({url: `${prefix}shard.json?v=${headerHash.slice(0, 8)}`, bytes: header.length, hash: headerHash});
      for (const row of [...index.sections, ...index.schemas]) add(productFile(row.path, row.bytes, row.hash));
      const wanted = entryReadSet(source, tier, index, sections);
      for (const row of index.files) if (wanted.has(row.hash)) add(productFile(row.path, row.compressed, row.hash));
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
      for (const row of addresses) add(asset(row.url, row.bytes));
      const extra = bank.extras[prefix];
      if (extra !== undefined) {
        const inventory = bytesFor(extra[0]);
        if (inventory.length !== extra[1] || createHash('sha256').update(inventory).digest('hex') !== extra[3]) throw new Error('Spawn public inventory differs');
        for (const [url, bytes] of v.parse(files, JSON.parse(new TextDecoder().decode(inventory)))) add(asset(url, bytes));
      }
      const rows = [...selected.values()], totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
      const manifest = readSpawnManifest({version: 1, shard: directory, tier, flow, files: rows, totalBytes});
      const text = JSON.stringify(manifest), hash = createHash('sha256').update(text).digest('hex'), name = `assets/spawn/${directory}-${flow}-${tier}-${hash.slice(0, 16)}.json`;
      writeFileSync(join(output, name), text); return {url: `/${name}`, bytes: Buffer.byteLength(text), totalBytes, files: rows.length};
    };
    client[directory] = {phone: write('phone', 'client'), desktop: write('desktop', 'client')};
    for (const [mode, homes] of Object.entries(strips)) (grid[mode] ??= {})[directory] = {
      phone: write('phone', 'grid', homes[directory]), desktop: write('desktop', 'grid', homes[directory]),
    };
  }
  return {cacheName: ASSET_CACHE_NAME, client, grid};
}

