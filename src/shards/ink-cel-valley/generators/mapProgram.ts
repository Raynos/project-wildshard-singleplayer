import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { rasterSceneMap, type SceneMapBytes } from '@wildshard/sdk/bake/groundMap';
import settings from '../data/map.json' with { type: 'json' };
import terrain from '../data/terrain.json' with { type: 'json' };
import props from '../data/props.json' with { type: 'json' };

/** GR9: the map's declared inputs, the L0 terrain tiles and placed GLBs (tile files and visible panels) its painter reads. */
export const INK_MAP_INPUTS: string[] = ((): string[] => {
  const files = new Set<string>(['data/terrain.json', 'data/props.json']);
  for (const tile of terrain.terrain.tiles) if (tile.lod === 0) files.add(`assets/${tile.file}`);
  for (const tile of props.props.tiles) if (tile.lod === 0) files.add(`assets/${tile.file}`);
  for (const panel of props.props.panels) if (panel.visible) files.add(`assets/${panel.file}`);
  return [...files];
})();

/** The painter's reads of the declared inputs only (no file system, no public directory). */
function inkMapSources(inputs: ReadonlyMap<string, Uint8Array>): SceneMapBytes {
  const need = (name: string): Uint8Array => { const value = inputs.get(name); if (value === undefined) throw new Error(`Missing declared map input ${name}`); return value; };
  return { input: need, bytes: need, json(name) { const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(need(name))); return value; } };
}

/** GR9 (G783): the ink valley's map lattice from its own terrain and props, painted in the build; the SDK publishes the image. */
export async function inkMap(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const files = await ctx.cached({ id: 'world-map', native: true, inputs: INK_MAP_INPUTS }, async inputs => {
    const result = await rasterSceneMap(settings, inkMapSources(inputs));
    return new Map([['map.rgba', result.pixels]]);
  });
  const pixels = files.get('map.rgba');
  if (files.size !== 1 || pixels?.byteLength !== 1000 * 1000 * 4) throw new Error('Map lattice cache inventory differs');
  return pixels;
}
