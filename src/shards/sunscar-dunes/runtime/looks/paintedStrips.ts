/**
 * Painted sky strips (SHARD-PLATFORM M3; ex a dune shard's painted dusk): seamless 360° strips (x = heading) loaded as sRGB
 * textures decoded off the main thread (the game's `loadPaintedTexture`), wrapping in heading, clamped in elevation,
 * magnified so unmipped, for a sky family to blend. All or nothing: when any strip cannot be had (offline, a test page)
 * the loaded ones are freed and the caller keeps its procedural sky. Nothing here knows a shard.
 */
import { ClampToEdgeWrapping, LinearFilter, RepeatWrapping, type Texture } from 'three';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';

/** the heading wraps (no seam at heading 0); the sky is magnified, so no mips */
const STRIP = { wrapS: RepeatWrapping, wrapT: ClampToEdgeWrapping, mips: false, minFilter: LinearFilter, magFilter: LinearFilter } as const;

/** Every strip of `keys` in order (each named `${tag}.${key}`), or null if any is missing (the ones that loaded are disposed). */
export async function loadPaintedStrips<K extends string>(keys: readonly K[], urls: Readonly<Record<K, string>>, tag: string, fault: string): Promise<readonly Texture[] | null> {
  const strips = await Promise.all(keys.map(key => loadPaintedTexture(urls[key], `${tag}.${key}`, `${fault} ${key} not loaded:`, STRIP)));
  const loaded = strips.filter((t): t is Texture => t !== null);
  if (loaded.length === strips.length) return loaded;
  for (const t of loaded) t.dispose();
  return null;
}
