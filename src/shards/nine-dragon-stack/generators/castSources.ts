import hook from '../data/castHook.generated.json' with { type: 'json' };
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { parseWorldSceneWeld, type WorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import castRows from '../data/casts.json' with { type: 'json' };
import crowdRows from '../data/crowdModels.json' with { type: 'json' };
import lodRows from '../data/lod.json' with { type: 'json' };
import hookRows from '../data/hookSpecimen.json' with { type: 'json' };

const crowd = Object.entries(crowdRows).flatMap(([key, row]) => row.variants.map(variant => `${key}-${variant.id}`));
const names = [...crowd, 'lion', ...castRows.FIXED_KITS, ...[10, 30].map(distance => `lion-mid${distance}`),
  ...hookRows.lods.map(distance => `dragon-hook-mid${distance}`),
  ...crowd.flatMap(name => lodRows.MID_FROM.map(distance => `${name}-mid${distance}`).concat(`${name}-far`))];
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

/** The admitted pool files retain the existing rest reader and per-file channel declarations. */
export const CAST_SOURCES = Array.from({ length: Math.ceil(names.length / 16) }, (_, index) => ({
  id: `casts-${index}`, kind: 'pool',
  files: names.slice(index * 16, (index + 1) * 16).map(name => ({ file: `geometry/casts/${name}.glb`, parts: [name],
    channels: name.startsWith('dragon-hook-') ? [] : castRows.CAST_CHANNELS })),
}));
const libraries = new Map(names.map((name, index) => [name, `casts-${Math.floor(index / 16)}`]));
/** the cast pool library a cast's file is in */
export function castLibrary(name: string): string { const library = libraries.get(name); if (library === undefined) throw new Error(`Nine has no cast ${name}`); return library; }
export const CAST_LIBRARIES = [...CAST_SOURCES,
  { id: 'cast-hook', kind: 'owned', models: [{ id: 'dragon-hook', file: 'geometry/dragon-hook.glb' }] },
];
export const CAST_WELD = { id: 'casts', file: 'world/casts.json' };
export const CAST_MATERIALS = [{ id: 'hook-source', kind: 'source', url: '/assets/nine-dragon/lab/grapple/dragon-hook.glb', anisotropyMaps: [] }];
const hookBytes = Uint8Array.from(atob(hook.glb), value => value.codePointAt(0) ?? 0);
const bytes = new Map(hook.casts.map(row => [row.name, row.glb]));
const geometryBlobs = [...names.map(name => {
  const glb = bytes.get(name);
  if (glb === undefined) throw new Error(`Missing prepared Nine cast ${name}`);
  return nameBlob(`geometry/casts/${name}.glb`, 'glb', compressGlb(Uint8Array.from(atob(glb), value => value.codePointAt(0) ?? 0)));
}), nameBlob('geometry/dragon-hook.glb', 'glb', hookBytes)];
/** a cast the world-scenes catalogue draws (the guardian lion, the crowd), with its prepared levels */
const migrated = (name: string): boolean => name === 'lion' || name.startsWith('lion-') || crowd.some(key => name === key || name.startsWith(`${key}-`));
/** Cast and layout resources share one existing admitted scene file. */
export function castBlobs(extraResources: WorldSceneWeld['resources'] = []): NamedBlob[] {
  return [...geometryBlobs, nameBlob('world/casts.json', 'json', json(parseWorldSceneWeld({ id: 'casts', root: 'dressing.root', nodes: [],
    materials: [{ id: 'casts.hook-brass', kind: 'standard', source: { material: 'hook-source', maps: ['map', 'normalMap'] }, properties: hook.material }],
    // the lion's and the crowd's casts are world-scenes catalogue sources (generators/worldScenes.ts), not weld handles
    resources: [...names.filter(name => !migrated(name)).map(name => ({ id: `casts.${name}`, kind: 'geometry', source: { library: libraries.get(name), model: name } })),
      { id: 'casts.dragon-hook', kind: 'geometry', source: { library: 'cast-hook', model: 'dragon-hook' } }, ...extraResources] })))];
}
export const CAST_BLOBS = castBlobs();
