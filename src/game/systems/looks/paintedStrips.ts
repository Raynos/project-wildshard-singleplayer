/**
 * Painted sky strips (SHARD-PLATFORM M3; ex a dune shard's painted dusk): seamless 360° strips (x = heading) loaded as sRGB
 * textures decoded off the main thread, wrapping in heading, clamped in elevation, magnified so unmipped, for a sky family
 * to blend. All or nothing: when any strip cannot be had (offline, a test page) the loaded ones are freed and the caller
 * keeps its procedural sky. Nothing here knows a shard.
 */
import { ClampToEdgeWrapping, LinearFilter, RepeatWrapping, SRGBColorSpace, Texture } from 'three';

/** One strip as an sRGB texture named `${tag}.${key}`; null (and a warning opened by `fault`) when it cannot be had. */
async function loadStrip(key: string, url: string, tag: string, fault: string): Promise<Texture | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    const bitmap = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY' });
    const tex = new Texture(bitmap); tex.colorSpace = SRGBColorSpace; tex.name = `${tag}.${key}`;
    // the heading wraps (no seam at heading 0); the sky is magnified, so no mips
    tex.wrapS = RepeatWrapping; tex.wrapT = ClampToEdgeWrapping; tex.generateMipmaps = false;
    tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.needsUpdate = true;
    return tex;
  } catch (error: unknown) {
    console.warn(`${fault} ${key} not loaded:`, error);
    return null;
  }
}

/** Every strip of `keys` in order, or null if any is missing (the ones that loaded are disposed). */
export async function loadPaintedStrips<K extends string>(keys: readonly K[], urls: Readonly<Record<K, string>>, tag: string, fault: string): Promise<readonly Texture[] | null> {
  const strips = await Promise.all(keys.map(key => loadStrip(key, urls[key], tag, fault)));
  const loaded = strips.filter((t): t is Texture => t !== null);
  if (loaded.length === strips.length) return loaded;
  for (const t of loaded) t.dispose();
  return null;
}
