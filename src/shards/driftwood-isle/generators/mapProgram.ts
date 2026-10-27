import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { rasterSceneMap } from '@wildshard/sdk/bake/groundMap';
import { driftwoodMapFiles } from './mapAssembly.mjs';
import { DRIFTWOOD_FIXED_INPUTS } from './fixedProgram';
import { DRIFTWOOD_SCENE_BANK_INPUTS } from './sceneBanks';
import { ISLAND_PROTO_INPUTS } from './islandProtoProgram';
import settings from '../data/map.json' with { type: 'json' };

/** The shard's own files the map assembly reads (by project path). */
const MAP_DATA = ['data/cascadeScene.json', 'data/coveScene.json', 'data/fixedGeometry.json', 'data/groundCover.json', 'data/trailScene.json', 'data/wreckScene.json'];
/** Every committed input the map reads, as build inputs: the pure map producer's public files by URL (the fixed program's,
 *  the scene banks' and the island prototypes'), the shard's own files by project path. */
export const DRIFTWOOD_MAP_INPUTS: readonly string[] = [...[...new Set([...DRIFTWOOD_FIXED_INPUTS, ...DRIFTWOOD_SCENE_BANK_INPUTS, ...ISLAND_PROTO_INPUTS])].sort(), ...MAP_DATA];
const SHARD = 'src/shards/driftwood-isle/';

/** The map's RGBA lattice from an exact input bank: the map assembly (GR7: the retired driftwood-map-assembly job's pack),
 *  painted with the island palette (the retired driftwood-data-map job's pixels). */
export async function driftwoodMapPixels(inputs: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  // the pure producer names repository paths; the bank holds build-input names
  const repo = (path: string): Uint8Array => {
    const name = path.startsWith('public/') ? path.slice('public'.length) : path.startsWith(SHARD) ? path.slice(SHARD.length) : path;
    const bytes = inputs.get(name);
    if (bytes === undefined) throw new Error(`Undeclared Driftwood map input ${path}`);
    return bytes;
  };
  const files = await driftwoodMapFiles(repo);
  const read = (file: string): Uint8Array => files.get(file) ?? repo(`${SHARD}${file}`);
  const json = (file: string): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read(file)));
  return (await rasterSceneMap(settings, { input: read, bytes: read, json })).pixels;
}

/** GR7: the map lattice through the build cache (the source-owned map, published by the SDK as the product map). */
export async function driftwoodMap(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const files = await ctx.cached({ id: 'world-map', inputs: DRIFTWOOD_MAP_INPUTS }, async inputs =>
    new Map([['map.rgba', await driftwoodMapPixels(inputs)]]));
  const pixels = files.get('map.rgba');
  if (files.size !== 1 || pixels?.byteLength !== 1000 * 1000 * 4) throw new Error('Driftwood map lattice cache inventory differs');
  return pixels;
}
