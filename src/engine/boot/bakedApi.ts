/** Fetch after level selection; the public data API must not load the content registry. */
import type { DataTexture } from 'three';
import type { LookupTexture } from 'postprocessing';

export async function preloadBakedTextures(): Promise<number> {
  return (await import('./bakedTextures')).preloadBakedTextures();
}
export async function loadBakedSky(urls: { color: string; gain: string }): Promise<DataTexture> {
  return (await import('../world/BakedSky')).loadBakedSky(urls);
}
export async function loadLUT(id: string): Promise<LookupTexture | null> {
  return (await import('../world/lut')).loadLUT(id);
}
