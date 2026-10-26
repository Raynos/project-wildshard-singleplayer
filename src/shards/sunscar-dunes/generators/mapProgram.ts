import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { rasterSceneMap, type SceneMapBytes } from '@wildshard/sdk/bake/groundMap';
import { signalWorldFiles } from './worldProgram';
import { signalWorldMetadata } from './worldMetadata';
import { wellRest, oilRest, fireRest, placeBindings } from './restScene';
import { DUNE_HD_URLS } from './rows/files';
import { REST_URLS } from './rows/restFiles';
import settings from '../data/map.json' with { type: 'json' };
import tiles from '../data/tiles.json' with { type: 'json' };

const models = ['brazier-hd', 'crates-hd', 'horse-hd', 'sacks-hd', 'wagon-hd2'] as const;
/** The original L0 terrain and five model inputs, plus the well input binding the captured upstream world bake. */
export const SIGNAL_MAP_INPUTS: string[] = ['data/tiles.json', 'assets/models/dry-well.glb',
  ...tiles.terrain.tiles.filter(tile => tile.lod === 0).map(tile => `assets/${tile.file}`), ...models.map(model => DUNE_HD_URLS[model])];

/** Resolve the painter's existing logical addresses to actual bake results and explicit input bytes; never read a handoff. */
export function signalMapSources(world: ReadonlyMap<string, Uint8Array>, inputs: ReadonlyMap<string, Uint8Array>): SceneMapBytes {
  if (inputs.size !== SIGNAL_MAP_INPUTS.length || SIGNAL_MAP_INPUTS.some(name => (inputs.get(name)?.byteLength ?? 0) === 0)) throw new Error('Map input inventory differs');
  signalWorldMetadata(world);
  const bytes = new Map(inputs);
  for (const [name, value] of world) {
    if (name.endsWith('.json')) bytes.set(`data/${name}`, value);
    else if (name.endsWith('.glb')) bytes.set(`../../../public/assets/sunscar-dunes/baked/${name}`, value);
  }
  for (const [index, made] of [wellRest(), oilRest(), fireRest()].entries()) {
    const url = REST_URLS[index]; if (url === undefined) throw new Error('Missing original rest pool');
    bytes.set(`../../../public${url}`, made.glb);
  }
  const rest = { bindings: placeBindings() }, modelRows = { DUNE_HD_URLS };
  const need = (name: string): Uint8Array => {
    const value = bytes.get(name); if (value === undefined) throw new Error(`Missing declared map input ${name}`); return value;
  };
  return { input: need, bytes: need, model: need, json(name) {
    if (name === 'data/restScenes.generated.json') return rest;
    if (name === 'assets/models.generated.json') return modelRows;
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(need(name))); return value;
  } };
}

/** Cache the original map lattice from the real world/rest bakes and declared inputs; image publication belongs to the SDK. */
export async function signalMap(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<Uint8Array> {
  const world = await signalWorldFiles(ctx);
  const files = await ctx.cached({ id: 'world-map', native: true, inputs: SIGNAL_MAP_INPUTS }, async inputs => {
    const result = await rasterSceneMap(settings, signalMapSources(world, inputs));
    return new Map([['map.rgba', result.pixels]]);
  });
  const pixels = files.get('map.rgba');
  if (files.size !== 1 || pixels?.byteLength !== 1000 * 1000 * 4) throw new Error('Map lattice cache inventory differs');
  return pixels;
}
