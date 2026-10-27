import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { rasterSceneMap } from '@wildshard/sdk/bake/groundMap';
import settings from '../data/map.json' with { type: 'json' };

/** The map's inputs, as build inputs by project path: the map assembly's pack and rows (driftwood-map-assembly). */
export const DRIFTWOOD_MAP_INPUTS: readonly string[] = ['data/mapAssembly.generated.json', 'data/mapAssembly.generated.bin'];

/** The map's RGBA lattice from an exact input bank, painted with the island palette (the retired driftwood-data-map
 *  job's pixels). */
export async function driftwoodMapPixels(inputs: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const read = (file: string): Uint8Array => {
    const bytes = inputs.get(file);
    if (bytes === undefined) throw new Error(`Undeclared Driftwood map input ${file}`);
    return bytes;
  };
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
