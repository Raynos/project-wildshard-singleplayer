/** Fetch after level selection; the public data API must not load the content registry. */
import type { DataTexture } from 'three';
import type { LookupTexture } from 'postprocessing';

/**
 * The engine's tileable cloud fbm baked at build (world/cloudField.ts, scripts/bake-cloud-field.mjs): raw grey bytes. A level
 * that lists it among its boot's `baked` files gets the sky's cloud texture without marching it (boot/bakedTextures.ts bakedBytes).
 */
export const CLOUD_FIELD_URL = '/assets/baked/common/cloud-field.bin';

export async function preloadBakedTextures(): Promise<number> {
  return (await import('./bakedTextures')).preloadBakedTextures();
}
export async function loadBakedSky(urls: { color: string; gain: string }): Promise<DataTexture> {
  return (await import('../world/BakedSky')).loadBakedSky(urls);
}
export async function loadLUT(id: string): Promise<LookupTexture | null> {
  return (await import('../world/lut')).loadLUT(id);
}
