import { LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three';

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
    if (tile) { tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.generateMipmaps = true; tex.minFilter = LinearMipmapLinearFilter; tex.anisotropy = 4; }
    tex.needsUpdate = true;
    return tex;
  } catch (error: unknown) {
    console.warn(`[far-reach] ${name} not loaded:`, error);
    return null;
  }
}

const shared = new Map<string, Promise<Texture | null>>();
/**
 * One decode of a painted image for every caller (E399: the painted maelstrom is the sea's vortex under the crown and the
 * storm's underside over it). Each caller owns it in its scope (a second dispose is harmless); the shard's scope forgets
 * it on unload (`forgetPaintedShared`), so the next load decodes it afresh.
 */
export function loadPaintedShared(url: string, name: string, tile = false): Promise<Texture | null> {
  const key = `${url}|${tile ? 't' : ''}`;
  let p = shared.get(key);
  if (p === undefined) {
    p = loadPainted(url, name, tile);
    shared.set(key, p);
  }
  return p;
}
export function forgetPaintedShared(url: string, tile = false): void { shared.delete(`${url}|${tile ? 't' : ''}`); }
