// The bake page of scripts/bake-textures.mjs (SF87, G320): bundled on its own and run on a blank page, it paints the
// sky's procedural textures with the engine's pure painters (src/engine/world/skyTextures.ts) and encodes each the way the
// game's old `?bakeexport=1` export did (drawn onto a fresh canvas, JPEG at 0.92 or lossless PNG). No game, no level, no
// shard runtime or legacy code is loaded.
import type { CanvasTexture } from 'three';
import { cloudFieldPixels } from '../../src/engine/world/cloudField';
import { cloudTexture, giantTexture, planetTexture } from '../../src/engine/world/skyTextures';

/** One encoded texture, as scripts/bake-textures.mjs reads it back. */
export interface SkyBake { dataUrl: string; lossless: boolean; width: number; height: number }

const PAINTERS = new Map<string, () => CanvasTexture>([
  ['clouds', () => cloudTexture(cloudFieldPixels())],
  ['planet', planetTexture],
  ['giant', giantTexture],
]);

/** Paint and encode the named sky textures (all lossy JPEG today, as their game call sites asked). */
export function bakeSkyTextures(names: readonly string[]): Record<string, SkyBake> {
  const out: Record<string, SkyBake> = {};
  for (const name of names) {
    const paint = PAINTERS.get(name);
    if (paint === undefined) throw new Error(`sky bake: no painter for ${name} (${[...PAINTERS.keys()].join(', ')})`);
    const img = paint().image;
    if (!(img instanceof HTMLCanvasElement)) throw new Error(`sky bake: ${name} is not a canvas`);
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('sky bake: no 2d canvas context');
    ctx.drawImage(img, 0, 0);
    out[name] = { dataUrl: canvas.toDataURL('image/jpeg', 0.92), lossless: false, width: img.width, height: img.height };
  }
  return out;
}

Object.assign(window, { bakeSkyTextures });
