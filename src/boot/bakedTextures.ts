/**
 * Baked procedural textures (docs/plans/LOAD-PERF.md §P2). Fur, clouds, planet bands, blade atlases…
 * are drawn on a canvas or into a DataTexture at every launch — a few hundred ms of the phone's CPU
 * for images that never change. `bakedTexture(name, make)` returns the committed image under
 * public/assets/baked/<slug>/tex/<name>.{png,jpg} when the build has it (preloaded by
 * `preloadBakedTextures()` at the head of the terrain step, counted under the `baked` byte source),
 * else runs `make()` — and with `?bakeexport=1` also registers the result so
 * scripts/bake-textures.mjs can read it back through `window.__bakeExport`.
 *
 * Contract for `make()`: the texture's `image` must be a canvas, an ImageData-backed DataTexture or
 * anything drawImage accepts; filters / wrap / colorSpace / anisotropy set on it are copied onto the
 * baked one (the file only carries pixels). Names are per chunk; use `common/` for chunk-independent
 * ones via `commonTexture`.
 */
import * as THREE from 'three';
import { PUBLIC_BYTES } from './bytes.generated';
import { fetchImage } from './bytes';
import { getActiveChunk } from '../chunks/registry';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const BAKE_EXPORT = params.has('bakeexport');
const NOBAKE = params.has('nobake');

export interface BakeSpec { name: string; url: string; lossless: boolean; srgb: boolean }
const exported = new Map<string, { texture: THREE.Texture; lossless: boolean }>();
const loaded = new Map<string, ImageBitmap | HTMLImageElement>();
if (typeof window !== 'undefined') Object.defineProperty(window, '__bakeExport', { get: () => exportAll() });

const dir = (slug: string) => `/assets/baked/${slug}/tex/`;

/** Every baked texture file the build has for this chunk (declared in the boot manifest). */
export function bakedTextureUrls(slug: string): string[] {
  const p = dir(slug);
  return Object.keys(PUBLIC_BYTES).filter((k) => k.startsWith(p) && !k.includes('.phone.')); // phone copies: through tierUrl
}

function urlFor(slug: string, name: string): string | null {
  const p = dir(slug);
  for (const ext of ['png', 'jpg']) { const u = `${p}${name}.${ext}`; if (u in PUBLIC_BYTES) return u; }
  return null;
}

/** Fetch + decode every baked texture of the active chunk (one round of parallel fetches, ~ms from the SW cache). */
export async function preloadBakedTextures(): Promise<number> {
  if (NOBAKE) return 0;
  const slug = getActiveChunk().slug;
  const urls = bakedTextureUrls(slug);
  await Promise.all(urls.map(async (u) => {
    try { loaded.set(u, await fetchImage(u, Infinity, true)); }
    catch (e) { console.warn(`[baked] ${u}: ${(e as Error).message}`); }
  }));
  return urls.length;
}

/**
 * The baked image as a texture (settings copied from a throw-away `make()`-free template), or
 * `make()`'s result. `lossless` picks PNG over JPEG at export (normal maps, masks).
 */
export function bakedTexture(name: string, make: () => THREE.Texture, opts: { lossless?: boolean } = {}): THREE.Texture {
  const slug = getActiveChunk().slug;
  const url = NOBAKE ? null : urlFor(slug, name);
  const image = url ? loaded.get(url) : undefined;
  if (image) {
    // settings come from the procedural template: build it cheaply? No — `make` is the expensive part.
    // Callers set filters/wrap/colorSpace on the returned texture themselves (see the call sites).
    const t = new THREE.Texture(image);
    t.flipY = false; // fetchImage flips at decode (ImageBitmapLoader convention)
    t.needsUpdate = true;
    return t;
  }
  const t = make();
  if (BAKE_EXPORT) exported.set(name, { texture: t, lossless: Boolean(opts.lossless) });
  return t;
}

/** What the page baked this run, as data URLs — read by scripts/bake-textures.mjs. */
function exportAll(): Record<string, { dataUrl: string; lossless: boolean; width: number; height: number }> {
  const out: Record<string, { dataUrl: string; lossless: boolean; width: number; height: number }> = {};
  for (const [name, { texture, lossless }] of exported) {
    const img = texture.image as HTMLCanvasElement | ImageBitmap | { data: Uint8Array | Uint8ClampedArray; width: number; height: number };
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('bake export: no 2d canvas context');
    if ('data' in img && !(img instanceof HTMLCanvasElement)) {
      const id = ctx.createImageData(img.width, img.height);
      const src = img.data;
      // a DataTexture's rows start at the bottom (flipY false); a file's start at the top
      if (texture.flipY) id.data.set(src);
      else for (let y = 0; y < img.height; y++) id.data.set((src as Uint8Array).subarray((img.height - 1 - y) * img.width * 4, (img.height - y) * img.width * 4), y * img.width * 4);
      ctx.putImageData(id, 0, 0);
    } else {
      ctx.drawImage(img, 0, 0);
    }
    out[name] = { dataUrl: canvas.toDataURL(lossless ? 'image/png' : 'image/jpeg', 0.92), lossless, width: img.width, height: img.height };
  }
  return out;
}
