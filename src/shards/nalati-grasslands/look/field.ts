import type { DataTexture } from 'three';
import { GrassPresentation, GrassPresentationProfile } from '@wildshard/game/looks/grassPresentation';
import rows from '../boot/grass.generated.json' with { type: 'json' };
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import { bakeUniforms } from './capture';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { Forest } from '@wildshard/engine/world/forest/Forest';

const profile = new GrassPresentationProfile(rows);
export const grassV2Uniforms = profile.uniforms;
export const grassMood = (night: number, dusk: number, storm: number): void => { profile.mood(night,dusk,storm); };
export const terrainHeightTexture = (): DataTexture => profile.heightTexture();
export const reseedGrassV2 = (): void => { profile.reseed(); };
export async function prepareGrassV2(yieldTask: () => Promise<void>): Promise<void> { profile.heightTexture(); await yieldTask(); }
export const createGrass = (sky: SkyRig, forest: Forest): GrassPresentation => new GrassPresentation(profile,sky,forest,bakeUniforms,paintedTextures.cards).build();
