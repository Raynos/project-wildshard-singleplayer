import * as THREE from 'three';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { loadTexture } from '@wildshard/engine/core/assets';
import baked from '../../data/paintedTextures.generated.json' with { type: 'json' };

/** One of Pine's painted textures, baked offline (generators/bake-pine-painted.mjs): log ends, lamp glow, coat, chalk. */
export type PaintedKey = keyof typeof baked.textures;
/** The trophy wall's chalk atlas layout, in pixels. */
export const CHALK_LAYOUT = baked.chalk;

const loads = new Map<PaintedKey, Promise<THREE.Texture>>(), ready = new Map<PaintedKey, THREE.Texture>();

/** Load a painted texture once and share it; a missing file refuses (there is no runtime painter). */
export function loadPainted(key: PaintedKey): Promise<THREE.Texture> {
  let load = loads.get(key);
  if (load === undefined) {
    const row = baked.textures[key];
    load = loadTexture(row.url, row.srgb, 1, undefined, (t) => { if (!row.repeat) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }).then((t) => { ready.set(key, t); return t; });
    loads.set(key, cacheUntilDisposed(load, () => { loads.delete(key); ready.delete(key); }));
  }
  return load;
}

/** A painted texture `loadPainted` already loaded; refuses before then. */
export function painted(key: PaintedKey): THREE.Texture {
  const t = ready.get(key);
  if (t === undefined) throw new Error(`[pine-hollow] painted texture ${key} is not loaded`);
  return t;
}
