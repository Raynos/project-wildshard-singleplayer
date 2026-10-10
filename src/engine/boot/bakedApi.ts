/** Fetch after level selection; the public data API must not load the content registry. */
import type { DataTexture } from 'three';
import type { LookupTexture } from 'postprocessing';
import { setting } from '../ui/Settings';

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
/**
 * A look's declared LUT file (`ExtendLook.lut`) for an engine chain that carries the look without running its compose, as
 * `loadLUT`'s texture named `name`. Loaded only while pause ▸ Settings ▸ Debug ▸ Look ▸ the declared-LUT row
 * (`gridDeclaredLut`) is on, default off (op-lut20); else, or without a readable file, null.
 */
export async function loadCarriedLUT(url: string | undefined, name: string): Promise<LookupTexture | null> {
  if (url === undefined || setting('gridDeclaredLut') !== 'on') return null;
  return (await import('../world/lut')).loadLUTFile(url, name);
}
