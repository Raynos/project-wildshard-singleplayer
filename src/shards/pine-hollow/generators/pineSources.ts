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
 *  them through `ctx.cached` (programSources.ts `readPineSources`), so nothing in the config closure touches the file system; Node
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
/** The timber world's rows (baked by the program, bake-timber-world.mjs); its hash-named assets are `assets/<hash>`. */
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
  TERRAIN_SOURCE, PHYSICS_SOURCE, ...HERO_TABLES, declared.trees.glb, declared.trees.sidecar, codeParts.url,
  ...Object.values(inputs.crags), ...Object.values(inputs.propScans), ...inputs.cabinModels,
  ...Object.values(sky.keys).flatMap(key => [skyKeySource(sky.keyFiles.color, key.id), skyKeySource(sky.keyFiles.gain, key.id)]),
];
/** The folders the timber world's material payloads and cabin prop scans are listed from. */
const TIMBER_FOLDERS: readonly string[] = ['rock_moss_set_01', 'tree_stump_01', 'dead_tree_trunk', ...CABIN_MATERIAL_IDS].flatMap(cabinMaterialFolders);
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

/** Sources over files already read (the program's files by key). */
export function sourcesOf(files: ReadonlyMap<string, Uint8Array>): PineSources {
  return { has: key => files.has(key), list: folder => [...files.keys()].filter(key => key.startsWith(folder)).sort(), bytes: key => {
    const bytes = files.get(key);
    if (bytes === undefined) throw new Error(`Undeclared Pine source ${key}`);
    return bytes.slice();
  } };
}

/** GR8 (D65, G37): every committed Pine source, read through `ctx.cached`: the fixed inputs, the hero GLBs and the hero
 *  material payloads the declared folders hold, and the timber world's material payloads and cabin prop scans (listed).
 *  programSources.ts adds the timber world the program bakes over them. */
export async function readFileSources(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<Map<string, Uint8Array>> {
  const inventory = ctx.inputFiles;
  if (inventory === undefined) throw new Error('Pine sources need the build inventory (ctx.inputFiles)');
  const listing = (folders: readonly string[]): string[] => {
    const files: string[] = [];
    for (let at = 0; at < folders.length; at += 8) files.push(...inventory(folders.slice(at, at + 8)));
    return files;
  };
  const fixed = await cachedSources(ctx, 'pine-sources', FIXED);
  const tables = sourcesOf(fixed), listed = new Set(listing(heroMaterialFolders(tables)));
  const heroes = [...new Set([...heroModelSources(), ...heroMaterialCandidates(tables).filter(url => listed.has(url))])];
  const taken = new Set([...fixed.keys(), ...heroes]), materials = listing(TIMBER_FOLDERS).filter(url => LISTED.test(url) && !taken.has(url));
  return new Map([...fixed, ...await cachedSources(ctx, 'pine-hero-sources', heroes), ...await cachedSources(ctx, 'pine-material-sources', materials)]);
}

/** Pine's sources for a Node script: `read` takes a repo-relative path (public URLs live under `public/`). */
export function pineSourcesFrom(read: (path: string) => Uint8Array): PineSources {
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
  }, list: folder => { throw new Error(`A Node script's Pine sources list no folder (${folder}); read them through readPineSources`); } };
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
