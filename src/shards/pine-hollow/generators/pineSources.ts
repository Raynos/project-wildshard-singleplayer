import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import declared from '../data/publicInputs.json' with { type: 'json' };
import bindings from '../data/terrainBindings.json' with { type: 'json' };
import codeParts from '../data/codeParts.json' with { type: 'json' };
import sky from '../data/sky.json' with { type: 'json' };
import inputs from '../data/sourceInputs.json' with { type: 'json' };
import { HERO_TABLES, heroMaterialCandidates, heroMaterialFolders, heroModelSources } from './heroMaterialFiles.mjs';
import { CABIN_MATERIAL_IDS, cabinMaterialFolders } from './cabinPropMaterials.mjs';

/** GR8 (D65): the committed files Pine's in-memory producers read (the baked terrain, the tree set, the crag kit, the
 *  prop scans, the native code parts, the sky keys, the authored trunk rows and the timber world with its GLBs), by
 *  their input key: a public URL (`/assets/…`) or a project-relative path (`data/…`, `assets/…`). The program reads
 *  them through `ctx.cached` (`readPineSources`), so nothing in the config closure touches the file system; Node
 *  scripts read them from disk (`pineSourcesFrom`). */
export interface PineSources {
  /** One declared input's bytes (a fresh copy, as a file read gives); an undeclared key refuses. */
  readonly bytes: (key: string) => Uint8Array;
  /** Whether an input exists (the hero material payloads are read where they exist). */
  readonly has: (key: string) => boolean;
  /** The inputs below a listed folder (`/assets/.../`), as the build inventory names them. */
  readonly list: (folder: string) => string[];
}

/** The retained terrain's URL (its public path under `/assets/`). */
export const TERRAIN_SOURCE = `/${bindings.terrain.replace(/^public\//u, '')}`;
/** The authored trunk rows (`shelterTrees`). */
export const PHYSICS_SOURCE = 'data/physicsRows.json';
/** The timber world's rows; its GLB files are `assets/<hash>`. */
export const TIMBER_SOURCE = 'data/timberWorld.generated.json';
/** One of the crag kit's files by name (data/sourceInputs.json). */
export function cragSource(file: string): string {
  const url = Object.entries(inputs.crags).find(([name]) => name === file)?.[1];
  if (url === undefined) throw new Error(`Undeclared Pine crag source ${file}`);
  return url;
}
/** A prop scan's LOD GLB (data/sourceInputs.json). */
export function propScanSource(id: string): string {
  const url = Object.entries(inputs.propScans).find(([name]) => name === id)?.[1];
  if (url === undefined) throw new Error(`Undeclared Pine prop scan ${id}`);
  return url;
}
/** A sky key's colour or gain plane. */
export const skyKeySource = (template: string, id: string): string => template.replaceAll('{id}', id);

const FIXED: readonly string[] = [
  TERRAIN_SOURCE, PHYSICS_SOURCE, TIMBER_SOURCE, ...HERO_TABLES, declared.trees.glb, declared.trees.sidecar, codeParts.url,
  ...Object.values(inputs.crags), ...Object.values(inputs.propScans),
  ...Object.values(sky.keys).flatMap(key => [skyKeySource(sky.keyFiles.color, key.id), skyKeySource(sky.keyFiles.gain, key.id)]),
];
/** The timber world's GLB inputs, named by the hashes its rows list. */
export function timberGlbSources(sources: PineSources): string[] {
  const rows = sourceJson(sources, TIMBER_SOURCE);
  const files = typeof rows === 'object' && rows !== null && 'shardfile' in rows && typeof rows.shardfile === 'object' && rows.shardfile !== null
    && 'files' in rows.shardfile && Array.isArray(rows.shardfile.files) ? rows.shardfile.files : undefined;
  if (files === undefined) throw new Error('Pine timber world has no files');
  return files.flatMap((row: unknown) => {
    if (typeof row !== 'object' || row === null || !('kind' in row) || !('hash' in row) || typeof row.hash !== 'string') throw new Error('Invalid Pine timber file row');
    return row.kind === 'glb' ? [`assets/${row.hash}`] : [];
  });
}

/** The folders the prop and cabin material payloads and cabin prop scans are listed from. */
const SCAN_FOLDERS: readonly string[] = ['rock_moss_set_01', 'tree_stump_01', 'dead_tree_trunk', ...CABIN_MATERIAL_IDS].flatMap(cabinMaterialFolders);
const LISTED = /\.(?:glb|gltf|bin)$/u;

/** One input's bytes parsed as JSON. */
export function sourceJson(sources: PineSources, key: string): unknown {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sources.bytes(key)));
}

async function cachedSources(ctx: Pick<ProjectGenerationContext, 'cached'>, id: string, keys: readonly string[]): Promise<Map<string, Uint8Array>> {
  const files = await ctx.cached({ id, inputs: keys }, read => new Map(keys.map((key, index) => {
    const bytes = read.get(key);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing declared Pine source ${key}`);
    return [`${String(index)}.bin`, bytes];
  })));
  return new Map(keys.map((key, index) => {
    const bytes = files.get(`${String(index)}.bin`);
    if (bytes === undefined) throw new Error(`Missing cached Pine source ${key}`);
    return [key, bytes];
  }));
}

function fromMap(files: ReadonlyMap<string, Uint8Array>): PineSources {
  return { has: key => files.has(key), list: folder => [...files.keys()].filter(key => key.startsWith(folder)).sort(), bytes: key => {
    const bytes = files.get(key);
    if (bytes === undefined) throw new Error(`Undeclared Pine source ${key}`);
    return bytes.slice();
  } };
}

/** GR8 (D65): every Pine source, read through `ctx.cached`: the fixed inputs, then the timber GLBs their rows name, then
 *  the hero GLBs and the hero material payloads the declared folders hold, then the prop and cabin material payloads and
 *  cabin prop scans their folders hold (listed: `list`). */
export async function readPineSources(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<PineSources> {
  const inventory = ctx.inputFiles;
  if (inventory === undefined) throw new Error('Pine sources need the build inventory (ctx.inputFiles)');
  const listing = (folders: readonly string[]): string[] => {
    const files: string[] = [];
    for (let at = 0; at < folders.length; at += 8) files.push(...inventory(folders.slice(at, at + 8)));
    return files;
  };
  const fixed = await cachedSources(ctx, 'pine-sources', FIXED);
  const timbers = await cachedSources(ctx, 'pine-timber-sources', timberGlbSources(fromMap(fixed)));
  const tables = fromMap(fixed), listed = new Set(listing(heroMaterialFolders(tables)));
  const heroes = [...new Set([...heroModelSources(), ...heroMaterialCandidates(tables).filter(url => listed.has(url))])];
  const taken = new Set([...fixed.keys(), ...heroes]), scans = listing(SCAN_FOLDERS).filter(url => LISTED.test(url) && !taken.has(url));
  return fromMap(new Map([...fixed, ...timbers, ...await cachedSources(ctx, 'pine-hero-sources', heroes), ...await cachedSources(ctx, 'pine-material-sources', scans)]));
}

/** Pine's sources for a Node script: `read` takes a repo-relative path (public URLs live under `public/`); `list`, when
 *  given, names a public folder's files (`/assets/.../name`). */
export function pineSourcesFrom(read: (path: string) => Uint8Array, list?: (folder: string) => string[]): PineSources {
  const files = new Map<string, Uint8Array>();
  const bytes = (key: string): Uint8Array => {
    let file = files.get(key);
    if (file === undefined) {
      // an owned copy: a Node Buffer may be a view into a shared pool
      file = new Uint8Array(read(key.startsWith('/') ? `public${key}` : `src/shards/pine-hollow/${key}`));
      files.set(key, file);
    }
    return file.slice();
  };
  return { bytes, has: key => {
    try { bytes(key); return true; } catch { return false; }
  }, list: folder => {
    if (list === undefined) throw new Error(`This script's Pine sources list no folder (${folder})`);
    return list(folder).sort();
  } };
}

/** One value per sources object, made on first use (each producer bakes once per program run). */
export function perSources<T>(make: (sources: PineSources) => T): (sources: PineSources) => T {
  const made = new WeakMap<PineSources, { value: T }>();
  return sources => {
    let entry = made.get(sources);
    if (entry === undefined) { entry = { value: make(sources) }; made.set(sources, entry); }
    return entry.value;
  };
}
