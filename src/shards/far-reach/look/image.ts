import { LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';

/** Drop a borrowed sampler assignment when its owning texture retires, without touching a newer assignment. */
export function onPaintedDispose(texture: Texture | null, forget: () => void): void {
  if (texture === null) return;
  cacheUntilDisposed(texture, forget);
}

/**
 * A painted image as an sRGB texture, fetched and decoded off the main thread (an ImageBitmap, flipped at decode as the
 * engine's own loader does, so its v runs up like a TextureLoader image's), or null when it cannot be had (offline, a
 * test page): the caller keeps its stand-in. A plain fetch fails fast where an <img> would hang a headless test.
 */
export async function loadPainted(url: string, name: string, tile = false): Promise<Texture | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
    const tex = new Texture(bitmap); tex.colorSpace = SRGBColorSpace; tex.name = name;
    onPaintedDispose(tex, () => { bitmap.close(); });
    if (tile) { tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.generateMipmaps = true; tex.minFilter = LinearMipmapLinearFilter; tex.anisotropy = 4; }
    tex.needsUpdate = true;
    return tex;
  } catch (error: unknown) {
    console.warn(`[far-reach] ${name} not loaded:`, error);
    return null;
  }
}
