import { declaredSceneBake } from '@wildshard/game/shardfile/sceneSources';
import { setIslePack } from './isle';

/** Original kind bake and material rows, selected through the declared source. */
export const WORLD = declaredSceneBake('far-reach', 'bakes');
/** Load every baked piece, the islands and the meadow's blades (the plugin's `world` hook, before the world is built); a piece that fails to load is empty. */
export async function loadSkyBaked(): Promise<void> {
  await WORLD.load(); setIslePack(WORLD.bytes('isles'));
}

/** The meadow's baked blades (generators/meadowBlades.ts → baked/meadow-blades.bin, inflated); undefined when they did not load. */
export const skyMeadowBlades = (): Uint8Array | undefined => WORLD.bytes('blades') ?? undefined;

