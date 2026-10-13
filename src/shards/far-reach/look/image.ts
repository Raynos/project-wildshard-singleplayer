import { LinearMipmapLinearFilter, RepeatWrapping, type Texture } from 'three';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { releaseOnUpload } from '@wildshard/engine/render/memorySaver';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';

/** Drop a borrowed sampler assignment when its owning texture retires, without touching a newer assignment. */
export function onPaintedDispose(texture: Texture | null, forget: () => void): void {
  if (texture === null) return;
  cacheUntilDisposed(texture, forget);
}

/** Memory saver: a decoded image nothing on the CPU reads again goes at its upload (the engine's `releaseOnUpload`). */
export function releaseDecodedOnUpload(texture: Texture, close: () => void): void { releaseOnUpload(texture.source, close); }

/** Memory saver (on with Developer, so wherever Sky Reach is reachable): every decoded copy goes at its upload; nothing
 * reads these pixels on the CPU and every clone keeps the sampler key (the mill's bump channel is not in it). A tiled
 * image repeats with trilinear mips and 4x anisotropy. */
const PAINTED = { release: true } as const;
const PAINTED_TILE = { release: true, wrapS: RepeatWrapping, wrapT: RepeatWrapping, mips: true, minFilter: LinearMipmapLinearFilter, anisotropy: 4 } as const;

/** A painted image as an sRGB texture (the game's `loadPaintedTexture`), tiled or not; null when it cannot be had: the
 * caller keeps its stand-in. */
export const loadPainted = (url: string, name: string, tile = false): Promise<Texture | null> =>
  loadPaintedTexture(url, name, `[far-reach] ${name} not loaded:`, tile ? PAINTED_TILE : PAINTED);
