import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { bakeWholeSlabs, readSlabLibrary } from '@wildshard/sdk/bake/slabs';
import { nameBlob } from '@wildshard/sdk/blobs';
import { worldSceneRows } from '@wildshard/sdk/worldScenes';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import type { NineSourceWorld } from './worldProgram';
import type { NineWorldScenes } from './worldScenes';

export type NineSlabScenes = NineWorldScenes & { readonly NINE_REFINEMENT_SOURCE: Parameters<typeof bakeWholeSlabs>[0]['library'] };

/** Bake against complete native bodies; publish only slab-backed fine identities. */
export async function nineSlabScenes(ctx: Pick<ProjectGenerationContext, 'cached'>, world: NineSourceWorld, scenes: NineWorldScenes): Promise<NineSlabScenes> {
  const source = scenes.NINE_WORLD_SCENES.libraries.find(row => row.kind === 'whole' && row.load === 'refine');
  const fabric = scenes.LAYOUT_PLACEMENT_BLOBS.find(row => row.file.name === 'world/fabric.json');
  if (source?.kind !== 'whole' || 'storage' in source || fabric === undefined) throw new Error('Nine slabs need their original fine library and fabric');
  const weld: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fabric.bytes));
  const shardfile = { ...world.metadata.shardfile, ring: 'cell' as const };
  const tiles = shardfile.tiles.filter(row => row.lod === 0);
  const identity = hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson([source, weld, tiles, shardfile.ring])));
  const cached = await ctx.cached({ id: `nine-slabs-${identity}` }, async () => {
    const baked = await bakeWholeSlabs({ id: 'native-slabs', library: source, weld, shardfile, assets: world.assets });
    return new Map([['slabs.json', new TextEncoder().encode(JSON.stringify(baked.library))], ...baked.assets]);
  });
  const metadata = cached.get('slabs.json'); if (metadata === undefined) throw new Error('Nine slab cache omits its library');
  const staged = readSlabLibrary(metadata), sourceFiles = new Set(source.models.flatMap(model => model.files));
  const covers = tiles.filter(tile => tile.files.some(hash => sourceFiles.has(hash))).map(tile => tile.z * 8 + tile.x);
  if (covers.length === 0) throw new Error('Nine slabs omit original logical coverage');
  const covered: typeof staged.tiles = [];
  for (const tile of staged.tiles) covered.push({ ...tile, covers });
  const library = { ...staged, tiles: covered };
  if (library.id !== 'native-slabs' || library.of !== source.id) throw new Error('Nine slab cache has another owner');
  const files = library.tiles.flatMap(tile => tile.files.map((file, index) => ({ file, name: `world/slabs/${tile.tile}-${index}.glb` })));
  if (cached.size !== files.length + 1) throw new Error('Nine slab cache inventory differs');
  const blobs = files.map(({ file, name }) => {
    const bytes = cached.get(file.file); if (bytes === undefined || hashImmutableBytes(bytes) !== file.file) throw new Error('Nine slab cached bytes differ');
    return nameBlob(name, 'glb', bytes);
  });
  const rows = worldSceneRows({ ...scenes.NINE_WORLD_SCENES, libraries: [...scenes.NINE_WORLD_SCENES.libraries.map(row => row.id === source.id
    ? { id: source.id, kind: 'whole' as const, load: 'refine' as const, storage: 'slabs' as const, models: source.models.map(model => ({ id: model.id })) } : row), library] });
  return { ...scenes, NINE_REFINEMENT_SOURCE: source, NINE_WORLD_SCENES: rows, NINE_SCENE_BLOBS: [...scenes.NINE_SCENE_BLOBS, ...blobs] };
}
