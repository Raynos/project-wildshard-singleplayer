import * as THREE from 'three';
import { ResourceMemo } from '@wildshard/engine/app/cachedAssets';
import { loadTexture } from '@wildshard/engine/core/assets';
import baked from '../../data/paintedTextures.generated.json' with { type: 'json' };

/** One of Pine's painted textures, baked offline (generators/bake-pine-painted.mjs): log ends, lamp glow, coat, chalk. */
export type PaintedKey = keyof typeof baked.textures;
/** The trophy wall's chalk atlas layout, in pixels. */
export const CHALK_LAYOUT = baked.chalk;

const textures = new ResourceMemo<PaintedKey, THREE.Texture>();

/** Load a painted texture once and share it; a missing file refuses (there is no runtime painter). */
export function loadPainted(key: PaintedKey): Promise<THREE.Texture> {
  const row = baked.textures[key];
  return textures.load(key, () => loadTexture(row.url, row.srgb, 1, undefined, (t) => { if (!row.repeat) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }));
}

/** A painted texture `loadPainted` already loaded; refuses before then. */
export function painted(key: PaintedKey): THREE.Texture {
  const t = textures.peek(key);
  if (t === undefined) throw new Error(`[pine-hollow] painted texture ${key} is not loaded`);
  return t;
}
