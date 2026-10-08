import { LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { releaseOnUpload } from '@wildshard/engine/render/memorySaver';

/** Drop a borrowed sampler assignment when its owning texture retires, without touching a newer assignment. */
export function onPaintedDispose(texture: Texture | null, forget: () => void): void {
  if (texture === null) return;
  cacheUntilDisposed(texture, forget);
}

/** Memory saver: a decoded image nothing on the CPU reads again goes at its upload (the engine's `releaseOnUpload`). */
export function releaseDecodedOnUpload(texture: Texture, close: () => void): void { releaseOnUpload(texture.source, close); }

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
    // Memory saver (on with Developer, so wherever Sky Reach is reachable): the decoded RGBA copy goes at its upload.
    // Nothing reads these pixels on the CPU and every clone keeps the sampler key (the mill's bump channel is not in it).
    releaseDecodedOnUpload(tex, () => { bitmap.close(); });
    if (tile) { tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.generateMipmaps = true; tex.minFilter = LinearMipmapLinearFilter; tex.anisotropy = 4; }
    tex.needsUpdate = true;
    return tex;
  } catch (error: unknown) {
    console.warn(`[far-reach] ${name} not loaded:`, error);
    return null;
  }
}
