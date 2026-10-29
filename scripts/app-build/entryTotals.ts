/// <reference types="node" />
import * as v from 'valibot';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {PickupCatalogueSchema} from '../../src/format/specimenCatalogue';
import {assetTableAddresses, readAssetTables} from './assetTables.mjs';
import {readGridSeams} from './gridSeams.mjs';
import {assembleOutputShardfile, parseOutputIndex} from '../../src/format/outputIndex';
import {entryReadSet} from './entryReadSet';
import {createHash} from 'node:crypto';

const size = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const files = v.array(v.tuple([v.string(), size]));
const schema = v.object({common: files, client: files, grid: files,
  selection: v.record(v.string(), files),
  optional: v.object({files, groups: v.record(v.string(), v.array(size))}),
  products: v.record(v.string(), v.union([v.strictTuple([size, size, size, size]), v.strictTuple([size, size])])),
  extras: v.record(v.string(), v.tuple([v.string(), size, size, v.string()])),
  code: v.object({entries: v.record(v.string(), v.tuple([v.string(), size, size, v.array(size)]))}),
});
interface Address {readonly url: string; readonly bytes: number}
type Pair = readonly [phone: number, desktop: number];
export interface EntryTotals {
  readonly client: Readonly<Record<string, Pair>>;
  readonly grid: Readonly<Record<string, Readonly<Record<string, Pair>>>>;
}

/** Compile fixed content-read totals from the same selected module/product
 * banks the entry consumes. Neither a measured run nor a wire estimate is an
 * input. Transport receipts remain the sole completion authority. */
export function entryTotals(input: unknown, strips: Readonly<Record<string, Readonly<Record<string, readonly Address[]>>>>,
  root: string): EntryTotals {
  const bank = v.parse(schema, input), shared = new Map<string, number>(), entrySizes = new Map<string, number>();
  const addPublic = (url: string): void => {
    if (!url.startsWith('/assets/') || url.split('/').some(part => part === '..')) throw new Error('Invalid entry public file');
    shared.set(url, statSync(join(root, 'public', url)).size);
  };
  if (existsSync(join(root, 'public/assets/physics/rapier.wasm'))) addPublic('/assets/physics/rapier.wasm');
  const pickups = join(root, 'src/game/data/pickupCatalogue.json');
  if (existsSync(pickups)) {
    const rows = v.parse(PickupCatalogueSchema, JSON.parse(readFileSync(pickups, 'utf8')));
    const packed = new Set(rows.banks?.flatMap(row => row.members.map(member => member.file)));
    for (const row of rows.banks ?? []) addPublic(row.file);
    for (const row of rows.geometries) if ('file' in row && !packed.has(row.file)) addPublic(row.file);
  }
  const tables = existsSync(join(root, 'out/.app/boot-tables.json')) ? assetTableAddresses(readAssetTables(root)) : undefined;
  const seams = existsSync(join(root, 'out/.app/grid-seams.json')) ? readGridSeams(root).address : undefined;
  const total = (slug: string, flow: 'client' | 'grid', tier: 0 | 1, addresses: readonly Address[] = []): number => {
    const prefix = `/shardfiles/${slug}/`, product = bank.products[prefix];
    if (product === undefined) throw new Error('Missing entry product total');
    const selected = new Map(shared);
    const add = (rows: readonly (readonly [string, number])[]): void => { for (const [url, bytes] of rows) selected.set(url, bytes); };
    add(bank.common); add(bank[flow]);
    if (flow === 'grid') for (const rows of Object.values(bank.selection)) add(rows);
    else add(bank.selection[slug] ?? []);
    for (const index of bank.optional.groups[`home:${prefix}`] ?? []) {
      const row = bank.optional.files[index]; if (row === undefined) throw new Error('Invalid entry module index'); add([row]);
    }
    // Code packs transport the module bodies above; they are not a second
    // content payload. Their actual compressed transfer stays visible in IO.
    if (tables !== undefined) {
      selected.set(tables.common.url, tables.common.bytes);
      const table = flow === 'grid' || tier === 1 ? tables.all : tables.packs[slug];
      if (table !== undefined) selected.set(table.url, table.bytes);
    }
    if (flow === 'grid' && seams !== undefined) selected.set(seams.url, seams.bytes);
    for (const row of addresses) selected.set(row.url, row.bytes);
    // An extras catalogue is not a demand for every art/model it can name.
    const extra = flow === 'client' ? bank.extras[prefix] : undefined;
    if (extra !== undefined) selected.set(extra[0], extra[1]);
    const path = join(root, 'out', slug, 'shard.json'), key = `${slug}:${tier}`;
    let entryBytes = entrySizes.get(key);
    if (entryBytes === undefined) {
    entryBytes = product.length === 4 ? product[tier + 2] ?? product[1] : product[1];
    if (existsSync(path)) {
      const bytes = readFileSync(path), productInput: unknown = JSON.parse(bytes.toString('utf8')), index = parseOutputIndex(productInput);
      const sections = new Map<string, unknown>();
      for (const row of index.sections) {
        const body = readFileSync(join(root, 'out', slug, row.path));
        if (body.length !== row.bytes || createHash('sha256').update(body).digest('hex') !== row.hash) throw new Error('Entry total section differs from index');
        sections.set(row.name, JSON.parse(body.toString('utf8')));
      }
      const wanted = entryReadSet(assembleOutputShardfile(productInput, sections), tier === 0 ? 'phone' : 'desktop', index, sections);
      entryBytes = bytes.length + [...index.sections, ...index.schemas].reduce((sum, row) => sum + row.bytes, 0)
        + index.files.reduce((sum, row) => sum + (wanted.has(row.hash) ? row.compressed : 0), 0);
    }
    entrySizes.set(key, entryBytes);
    }
    return entryBytes
      + [...selected.values()].reduce((sum, bytes) => sum + bytes, 0);
  };
  const client: Record<string, Pair> = {}, grid: Record<string, Record<string, Pair>> = {};
  for (const prefix of Object.keys(bank.products)) {
    const slug = v.parse(v.string(), prefix.split('/')[2]);
    client[slug] = [total(slug, 'client', 0), total(slug, 'client', 1)];
    for (const [mode, homes] of Object.entries(strips)) {
      const addresses = homes[slug] ?? [];
      (grid[mode] ??= {})[slug] = [total(slug, 'grid', 0, addresses), total(slug, 'grid', 1, addresses)];
    }
  }
  return {client, grid};
}
