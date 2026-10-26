import type { HookProduct } from './hookProduct';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { parseWorldSceneWeld, type WorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import castRows from '../data/casts.json' with { type: 'json' };
import crowdRows from '../data/crowdModels.json' with { type: 'json' };
import lodRows from '../data/lod.json' with { type: 'json' };
import hookRows from '../data/hookSpecimen.json' with { type: 'json' };

const crowd = Object.entries(crowdRows).flatMap(([key, row]) => row.variants.map(variant => `${key}-${variant.id}`));
export const CAST_NAMES: string[] = [...crowd, 'lion', ...castRows.FIXED_KITS, ...[10, 30].map(distance => `lion-mid${distance}`),
  ...hookRows.lods.map(distance => `dragon-hook-mid${distance}`),
  ...crowd.flatMap(name => lodRows.MID_FROM.map(distance => `${name}-mid${distance}`).concat(`${name}-far`))];
const names = CAST_NAMES;
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

/** The admitted pool files retain the existing rest reader and per-file channel declarations. */
export const CAST_SOURCES: { id: string; kind: string; files: { file: string; parts: string[]; channels: { name: string; source: string; width: number; }[]; }[]; }[] = Array.from({ length: Math.ceil(names.length / 16) }, (_, index) => ({
  id: `casts-${index}`, kind: 'pool',
  files: names.slice(index * 16, (index + 1) * 16).map(name => ({ file: `geometry/casts/${name}.glb`, parts: [name],
    channels: name.startsWith('dragon-hook-') ? [] : castRows.CAST_CHANNELS })),
}));
const libraries = new Map(names.map((name, index) => [name, `casts-${Math.floor(index / 16)}`]));
/** the cast pool library a cast's file is in */
export function castLibrary(name: string): string { const library = libraries.get(name); if (library === undefined) throw new Error(`Nine has no cast ${name}`); return library; }
export const CAST_LIBRARIES: ({ id: string; kind: string; files: { file: string; parts: string[]; channels: { name: string; source: string; width: number; }[]; }[]; } | { id: string; kind: string; models: { id: string; file: string; }[]; })[] = [...CAST_SOURCES,
  { id: 'cast-hook', kind: 'owned', models: [{ id: 'dragon-hook', file: 'geometry/dragon-hook.glb' }] },
];
export const CAST_WELD = { id: 'casts', file: 'world/casts.json' };
// the sculpt's file material (its decoded maps, two 1024² bitmaps of 4 MB each, on the GPU only after the first draw, E264)
// and the hook's brass over its colour and normal maps
type CastMaterialRows = [
  { id: string; kind: 'source'; url: string; anisotropyMaps: never[]; gpuOnlyMaps: true },
  { id: string; kind: 'mapped'; material: { kind: 'standard'; source: { material: string; maps: ('map' | 'normalMap')[] }; properties: HookProduct['material'] } },
];
export function castMaterials(material: HookProduct['material']): CastMaterialRows { return [{ id: 'hook-source', kind: 'source', url: '/assets/nine-dragon/lab/grapple/dragon-hook.glb', anisotropyMaps: [], gpuOnlyMaps: true },
  { id: 'casts.hook-brass', kind: 'mapped', material: { kind: 'standard', source: { material: 'hook-source', maps: ['map', 'normalMap'] }, properties: material } }]; }
/** a cast the world-scenes catalogue draws (the guardian lion, the crowd, the Fei Zhua hook), with its prepared levels */
const migrated = (name: string): boolean => name === 'lion' || name.startsWith('lion-') || name.startsWith('dragon-hook-') || crowd.some(key => name === key || name.startsWith(`${key}-`));
/** Cast and layout resources share one existing admitted scene file. */
export function castBlobs(extraResources: WorldSceneWeld['resources'] = []): NamedBlob[] {
  return [nameBlob('world/casts.json', 'json', json(parseWorldSceneWeld({ id: 'casts', root: 'dressing.root', nodes: [],
    // the lion's, the crowd's and the hook's casts are world-scenes catalogue sources (generators/worldScenes.ts), not weld handles
    resources: [...names.filter(name => !migrated(name)).map(name => ({ id: `casts.${name}`, kind: 'geometry', source: { library: libraries.get(name), model: name } })), ...extraResources] })))];
}
export const CAST_BLOBS: NamedBlob[] = castBlobs();
