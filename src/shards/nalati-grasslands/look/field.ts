import { GrassPresentation, GrassPresentationProfile } from '@wildshard/game/looks/grassPresentation';
import rows from '../boot/grass.generated.json' with { type: 'json' };
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import { bakeUniforms } from './capture';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { Forest } from '@wildshard/engine/world/forest/Forest';

const profile = new GrassPresentationProfile(rows);
/** the grass's presentation (its mood and sun follow the painterly world) */
export const grassProfile = profile;
export const reseedGrassV2 = (): void => { profile.reseed(); };
export async function prepareGrassV2(yieldTask: () => Promise<void>): Promise<void> { profile.heightTexture(); await yieldTask(); }
export const createGrass = (sky: SkyRig, forest: Forest): GrassPresentation => new GrassPresentation(profile,sky,forest,bakeUniforms,paintedTextures.cards).build();
