import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { readProductDownloadIndex } from './bootProducts';
import { PickupCatalogueSchema } from '../src/format/specimenCatalogue';

interface Asset { readonly type: string; readonly originalFileNames?: readonly string[]; readonly source?: string | Uint8Array }
type Bundle = Readonly<Record<string, Asset | undefined>>;
type Files = readonly (readonly [string, number])[];
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Missing boot source object');
  return v.parse(v.record(v.string(), v.unknown()), value);
};
const field = (record: Record<string, unknown>, key: string): unknown => record[key];
const array = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value) || value.length > 8192) throw new Error('Invalid boot source list');
  return value;
};
const text = (value: unknown): string => { if (typeof value !== 'string') throw new Error('Invalid boot source URL'); return value; };

/** The exact eagerly preloaded members of the existing model and bake readers.
 * Unselected mapping entries, specimen metadata and native callbacks add no files. */
export function sceneSourceUrls(kind: 'models' | 'baked', input: unknown): readonly string[] {
  const source = object(input), rows = object(field(source, 'rows')), urls: string[] = [];
  if (kind === 'models') {
    for (const [names, mapping] of [['meshes', 'meshUrls'], ['hd', 'hdUrls']] as const) {
      const values = object(rows[mapping]);
      for (const name of array(rows[names])) urls.push(text(values[text(name)]));
    }
    for (const row of array(field(rows, 'geometryPools') ?? [])) urls.push(text(field(object(row), 'url')));
    for (const row of array(field(rows, 'paintedModels') ?? [])) urls.push(text(field(object(row), 'url')));
    if (field(rows, 'rigs') !== undefined) {
      const bodies = object(field(object(field(rows, 'rigs')), 'bodies')), values = object(field(bodies, 'urls'));
      for (const name of array(field(bodies, 'creatures'))) urls.push(text(values[text(name)]));
    }
  } else {
    const values = object(field(source, 'urls'));
    for (const name of Object.keys(rows)) urls.push(text(values[name]));
    for (const row of array(field(source, 'resources') ?? [])) urls.push(text(field(object(row), 'url')));
  }
  return [...new Set(urls)];
}

/** Shipped, data-only page inventory. The full bank is a per-home asset, never
 * all shards' file lists in the document. Original runtime admission is unchanged. */
export function homeExtraFiles(root: string, directory: string, bundle: Bundle, inlineLimit = 4096): Files | null {
  const product = resolve(root, 'out', directory), indexPath = resolve(product, 'shard.json');
  const index = readProductDownloadIndex(JSON.parse(readFileSync(indexPath, 'utf8')));
  if (index.runtime !== null) return null;
  const section = (name: string): unknown => {
    const sectionRow = index.sections.find(candidate => candidate.name === name);
    if (sectionRow === undefined) return undefined;
    const bytes = readFileSync(resolve(product, sectionRow.path));
    if (bytes.length !== sectionRow.bytes || createHash('sha256').update(bytes).digest('hex') !== sectionRow.hash) throw new Error('Boot section differs from its index');
    return JSON.parse(bytes.toString('utf8'));
  };
  const host = section('quests/host');
  if (host === undefined) return null;
  const quest = field(object(host), 'questHost');
  if (quest === undefined || quest === null || field(object(quest), 'page') === undefined) return null;
  const manifestPath = resolve(root, 'src/shards', directory, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = object(JSON.parse(readFileSync(manifestPath, 'utf8'))), urls: string[] = [];
  // Entry prepares these shared sources on every playable boot, before control.
  // Inline legacy geometry has no separate body; shared file URLs count once.
  const pickups = resolve(root, 'src/game/data/pickupCatalogue.json');
  if (existsSync(pickups)) {
    const rows = v.parse(PickupCatalogueSchema, JSON.parse(readFileSync(pickups, 'utf8')));
    for (const row of rows.geometries) if ('file' in row) urls.push(row.file);
  }
  for (const url of Object.values(object(field(manifest, 'card')))) urls.push(text(url));
  if (field(manifest, 'explore') !== undefined) for (const url of Object.values(object(field(object(field(manifest, 'explore')), 'art') ?? {}))) urls.push(text(url));
  const boot = object(field(manifest, 'boot') ?? {});
  for (const url of array(field(boot, 'precache') ?? [])) urls.push(text(url));
  const painted = section('look/painted');
  if (painted !== undefined) {
    const sky = object(field(object(field(object(painted), 'look')), 'sky'));
    if (field(sky, 'kind') === 'strips') {
      for (const strip of array(field(object(field(sky, 'row')), 'strips'))) urls.push(text(field(object(strip), 'url')));
    }
  }
  const scenes = section('world/scenes');
  if (scenes !== undefined) for (const value of array(field(object(scenes), 'libraries'))) {
    const row = object(value);
    const kind = field(row, 'kind');
    if (kind !== 'models' && kind !== 'baked') continue;
    const file = index.files.find(candidate => candidate.name === field(row, 'file'));
    if (file === undefined) throw new Error('Missing boot model source');
    const bytes = readFileSync(resolve(product, file.path));
    if (bytes.length !== file.compressed || createHash('sha256').update(bytes).digest('hex') !== file.hash) throw new Error('Boot model source differs from its index');
    urls.push(...sceneSourceUrls(kind, JSON.parse(bytes.toString('utf8'))));
  }
  // Every playable page instantiates this same binary; it is outside the product.
  urls.push('/assets/physics/rapier.wasm');
  const files = new Map<string, number>();
  for (const input of urls) {
    if (input.startsWith('data:')) continue;
    if (input.startsWith('/src/')) {
      const original = resolve(root, input.slice(1));
      const matches = Object.entries(bundle).filter(([, asset]) => asset?.type === 'asset'
        && asset.originalFileNames?.some(name => resolve(root, name) === original));
      if (matches.length === 0 && statSync(original).size < inlineLimit) continue;
      if (matches.length !== 1) throw new Error(`Missing emitted boot art: ${input}`);
      for (const [name, asset] of matches) {
        if (asset?.source === undefined) throw new Error('Missing emitted boot art bytes');
        files.set(`/${name}`, typeof asset.source === 'string' ? Buffer.byteLength(asset.source) : asset.source.byteLength);
      }
    } else {
      if (!/^\/assets\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/u.test(input) || input.split('/').some(part => part === '.' || part === '..')) throw new Error('Unsafe boot source URL');
      files.set(input, statSync(resolve(root, 'public', input.slice(1))).size);
    }
  }
  return [...files].sort(([left], [right]) => left.localeCompare(right));
}
