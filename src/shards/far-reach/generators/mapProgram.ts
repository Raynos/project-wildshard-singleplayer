import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { rasterSceneMap } from '@wildshard/sdk/bake/groundMap';
import { skyMapSources, SKY_MAP_INPUTS } from './bake-map.mjs';
import settings from '../data/map.json' with { type: 'json' };
import lookGraphs from '../data/lookGraphs.json' with { type: 'json' };

/** Every model is declared by the pure source constructor; all other rows are committed source values. */
export async function skyMapPixels(inputs: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const sources = await skyMapSources(inputs);
  sources.set('data/lookGraphs.json', new TextEncoder().encode(JSON.stringify(lookGraphs)));
  const read = (file: string): Uint8Array => {
    const bytes = sources.get(file);
    if (bytes === undefined) throw new Error(`Undeclared Sky map source ${file}`);
    return bytes;
  };
  const json = (file: string): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(read(file)));
  const model = (url: string): Uint8Array => {
    const bytes = inputs.get(url);
    if (bytes === undefined) throw new Error(`Undeclared Sky map model ${url}`);
    return bytes;
  };
  return (await rasterSceneMap(settings, { input: read, bytes: read, json, model })).pixels;
}

/** Publish the exact original RGBA lattice through the existing bounded native cache. */
export async function skyMapProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<{ pixels: Uint8Array; name: string }> {
  const files = await ctx.cached({ id: 'world-map', native: true, inputs: SKY_MAP_INPUTS }, async inputs =>
    new Map([['map.rgba', await skyMapPixels(inputs)]]));
  const pixels = files.get('map.rgba');
  if (files.size !== 1 || pixels?.byteLength !== 1000 * 1000 * 4) throw new Error('Sky map lattice cache inventory differs');
  return { pixels: Uint8Array.from(pixels), name: 'ui/images/map' };
}
