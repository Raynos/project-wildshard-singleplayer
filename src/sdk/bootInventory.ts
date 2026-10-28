import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import { CLOUD_FIELD_URL } from '@wildshard/engine/boot/bakedApi';

/** Authoring inputs are explicit presence/byte tables, never a live download service. */
export type BootInventory = Readonly<Record<string, number | true>>;
/** One concrete output tier. */
export type BootTier = 'phone' | 'desktop';
/** A declared texture encoding. */
export type BootTextures = 'img' | 'ktx2';
/** Ordered reads by loading phase. */
export type BootSources = Readonly<Record<'sky' | 'baked' | 'terrain' | 'trees' | 'physics' | 'cabins' | 'props' | 'art' | 'music' | 'sfx', readonly string[]>>;
/** A resolved value for each output tier and texture mode. */
export interface BootModes<T> { readonly modes: Readonly<Record<BootTier, Readonly<Record<BootTextures, T>>>> }
/** Explicit per-tier GPU aliases, with author aliases overriding shared assets. */
export type BootGpuFiles = Readonly<Record<BootTier, Readonly<Record<string, string>>>>;

/** Resolve phone fallbacks and GPU aliases using only the supplied inventory.
 * Ordering and duplicate handling remain the caller's responsibility. */
export function bootFilePolicy(tier: BootTier, mode: BootTextures, table: BootGpuFiles, inventory: BootInventory): { phone: (url: string) => string; gpu: (url: string) => string } {
  if (inventory === undefined || inventory === null) throw new Error('Boot authoring requires an explicit inventory');
  const { phone, gpu } = filePolicy(tier, mode, table, inventory);
  return { phone, gpu };
}

/** Shared sky bytes participate only when explicitly present in the author inventory. */
export function sharedBootTextures(inventory: BootInventory): string[] {
  return CLOUD_FIELD_URL in inventory ? [CLOUD_FIELD_URL] : [];
}

export interface BootRecipe {
  readonly source: { readonly urls: readonly string[] | Readonly<Record<BootTier, readonly string[]>> }
    | { readonly concat: readonly string[] } | { readonly publicPrefix: string }
    | { readonly pbr: readonly string[] } | { readonly gltf: readonly string[] }
    | { readonly tablePrefix: string } | { readonly pages: string }
    | { readonly available: readonly string[]; readonly fallback: readonly string[] };
  readonly map?: readonly ('gpu' | 'layer')[];
  readonly present?: boolean;
  readonly unique?: boolean;
  readonly excludeParts?: readonly string[];
  readonly excludeBasenamePrefix?: string;
  readonly except?: string;
  readonly aliases?: string;
}
/** External immutable inventories and aliases, supplied by the same build/runtime owner as the GPU table. */
export interface BootRecipeInputs {
  /** Offline presence facts: retained file sizes or guaranteed declared build outputs. */
  readonly inventory: BootInventory;
  readonly pages?: Readonly<Record<string, Readonly<Record<BootTier, Readonly<Record<string, { readonly image: string }>>>>>>;
  readonly aliases?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
export type BootRecipes = Readonly<Record<string, BootRecipe>>;
const isUrlList = (value: readonly string[] | Readonly<Record<BootTier, readonly string[]>>): value is readonly string[] => Array.isArray(value);
/** Resolve an ordered author recipe against explicit immutable inventory facts.
 * Keeps native recursion/file limits, transform order and strict metadata refusals; never borrows the page inventory. */
export function bootRecipeFiles(recipes: BootRecipes, name: string, tier: BootTier, tex: BootTextures,
  table: BootGpuFiles, inputs: BootRecipeInputs): string[] {
  if (inputs === undefined || inputs.inventory === undefined || inputs.inventory === null) throw new Error('Boot authoring requires an explicit inventory');
  const inventory = inputs.inventory, policy = filePolicy(tier, tex, table, inventory);
  let visits = 0;
  const run = (id: string, chain: readonly string[]): string[] => {
    if (chain.includes(id) || chain.length >= 16 || ++visits > 256) throw new Error('Boot recipe cycle or bound exceeded');
    const row = recipes[id];
    if (row === undefined) throw new Error(`Missing boot recipe ${id}`);
    const src = row.source, next = [...chain, id];
    let urls: string[];
    if ('urls' in src) urls = [...(isUrlList(src.urls) ? src.urls : src.urls[tier])];
    else if ('concat' in src) urls = src.concat.flatMap(ref => run(ref, next));
    else if ('publicPrefix' in src) urls = Object.keys(inventory).filter(url => url.startsWith(src.publicPrefix));
    else if ('pbr' in src) urls = src.pbr.flatMap(policy.pbr);
    else if ('gltf' in src) urls = src.gltf.flatMap(assetId => [`/assets/models/${assetId}/${assetId}.gltf`, `/assets/models/${assetId}/${assetId}.bin`, ...['diff', 'nor_gl', 'arm'].map(kind => `/assets/models/${assetId}/textures/${assetId}_${kind}_1k.jpg`)]);
    else if ('tablePrefix' in src) urls = tex === 'ktx2' ? Object.keys(table[tier]).filter(url => url.startsWith(src.tablePrefix)).sort().flatMap(url => table[tier][url] ?? []) : [];
    else if ('pages' in src) {
      const pages = inputs.pages?.[src.pages]?.[tier];
      if (pages === undefined) throw new Error(`Missing boot pages ${src.pages}`);
      urls = Object.keys(pages).sort().map(key => {
        const page = pages[key], mapped = table[tier][key];
        if (tex === 'ktx2' && mapped === undefined) throw new Error(`Missing boot page stand-in ${key}`);
        if (page === undefined) throw new Error(`Missing boot page ${key}`);
        return tex === 'ktx2' ? mapped ?? page.image : page.image;
      });
    } else urls = src.available.every(url => url in inventory) ? [...src.available] : [...src.fallback];
    if (row.excludeParts !== undefined) urls = urls.filter(url => !row.excludeParts?.some(part => url.includes(part)));
    if (row.excludeBasenamePrefix !== undefined) urls = urls.filter(url => !url.slice(url.lastIndexOf('/') + 1).startsWith(row.excludeBasenamePrefix ?? ''));
    if (row.unique === true) urls = [...new Set(urls)];
    for (const transform of row.map ?? []) urls = urls.map(policy[transform]);
    if (row.present === true) urls = urls.filter(url => url in inventory);
    if (row.except !== undefined) { const excluded = new Set(run(row.except, next)); urls = urls.filter(url => !excluded.has(url)); }
    if (row.aliases !== undefined) {
      const aliases = inputs.aliases?.[row.aliases];
      if (aliases === undefined) throw new Error(`Missing boot aliases ${row.aliases}`);
      urls = urls.map(url => aliases[url] ?? url);
    }
    if (urls.length > 4096) throw new Error('Boot recipe file bound exceeded');
    return urls;
  };
  return run(name, []);
}
/** Resolve every byte category through the same ordered recipe interpreter. */
export function bootRecipeSources(recipes: BootRecipes, sources: Readonly<Record<keyof BootSources, string>>,
  tier: BootTier, tex: BootTextures, table: BootGpuFiles, inputs: BootRecipeInputs): BootSources {
  const files = (key: keyof BootSources): readonly string[] => bootRecipeFiles(recipes, sources[key], tier, tex, table, inputs);
  return { sky: files('sky'), baked: files('baked'), terrain: files('terrain'), trees: files('trees'), physics: files('physics'),
    cabins: files('cabins'), props: files('props'), art: files('art'), music: files('music'), sfx: files('sfx') };
}
