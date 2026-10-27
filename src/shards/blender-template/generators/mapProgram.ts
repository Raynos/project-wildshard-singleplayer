import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { rasterSceneMap } from '@wildshard/sdk/bake/groundMap';
import settings from '../data/map.json' with { type: 'json' };

/** GR9: the map's one declared input, the authored world GLB its painter reads. */
export const BLENDER_MAP_INPUTS: string[] = ['assets/world.glb'];

/** GR9 (G783): Template 2's map lattice from its own world GLB, painted in the build; the SDK publishes the image. */
export async function blenderMap(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const files = await ctx.cached({ id: 'world-map', native: true, inputs: BLENDER_MAP_INPUTS }, async inputs => {
    const need = (name: string): Uint8Array => { const value = inputs.get(name); if (value === undefined) throw new Error(`Missing declared map input ${name}`); return value; };
    const result = await rasterSceneMap(settings, { input: need, bytes: need, json: name => { throw new Error(`Template 2's map reads no rows: ${name}`); } });
    return new Map([['map.rgba', result.pixels]]);
  });
  const pixels = files.get('map.rgba');
  if (files.size !== 1 || pixels?.byteLength !== 1000 * 1000 * 4) throw new Error('Map lattice cache inventory differs');
  return pixels;
}
