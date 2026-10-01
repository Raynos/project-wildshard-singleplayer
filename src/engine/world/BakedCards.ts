/**
 * Baked branch cards (project/archive/2026-09-22-load-perf.md §P2.2). TreeFactory.bakeBranchCard renders the twig
 * atlas into three 2048×1024 render targets (albedo · normal · ARM) at every launch — two shader
 * programs (~300 ms of Metal compile on the iPhone, cold) plus the draws. `scripts/bake-cards.mjs`
 * runs that bake once, headless, and commits the three images under
 * public/assets/baked/<slug>/card-{albedo,normal,arm}.{png,jpg}; at launch they are ordinary
 * textures (counted under the `trees` byte source) and the runtime bake is the fallback when the
 * files are missing or `?nobake=1`.
 *
 * Orientation: a render target's rows start at the bottom; the export writes them top-down so the
 * file is a normal image, and `loadTexture` (bitmap flipped at decode, flipY false) maps uv (0,0)
 * to the same bottom-left texel the runtime bake did.
 */
import * as THREE from 'three';
import { PUBLIC_BYTES } from '../boot/bytes.generated';
import { loadTexture } from '../core/assets';

export interface CardTextures { albedo: THREE.Texture; normal: THREE.Texture; arm: THREE.Texture }

const FILES = { albedo: 'card-albedo.png', normal: 'card-normal.jpg', arm: 'card-arm.jpg' } as const;

/** The three baked card files of a chunk, or null when the build has none. */
export function bakedCardUrls(slug: string): Record<keyof typeof FILES, string> | null {
  const out = {} as Record<keyof typeof FILES, string>;
  for (const k of Object.keys(FILES) as (keyof typeof FILES)[]) {
    const url = `/assets/baked/${slug}/${FILES[k]}`;
    if (!(url in PUBLIC_BYTES)) return null;
    out[k] = url;
  }
  return out;
}

export async function loadBakedCards(slug: string): Promise<CardTextures | null> {
  const urls = bakedCardUrls(slug);
  if (!urls || new URLSearchParams(location.search).has('nobake')) return null;
  try {
    const [albedo, normal, arm] = await Promise.all([loadTexture(urls.albedo, true), loadTexture(urls.normal), loadTexture(urls.arm)]);
    for (const t of [albedo, normal, arm]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; }
    return { albedo, normal, arm };
  } catch (e) {
    console.warn(`[baked] branch cards for ${slug} not used (${(e as Error).message}); baking at launch`);
    return null;
  }
}

/**
 * `?bakecards=1`: read the runtime bake's render targets back and publish them on `window.__cardBake`
 * as data URLs for scripts/bake-cards.mjs (PNG for the albedo — its alpha is the card's cut-out —
 * JPEG for the normal and ARM planes).
 */
export function exportCardTextures(renderer: THREE.WebGLRenderer, card: CardTextures): void {
  const toDataUrl = (tex: THREE.Texture, mime: string, quality?: number): string => {
    const rt = (tex as THREE.Texture & { __rt?: THREE.WebGLRenderTarget }).__rt;
    const { width, height } = tex.image as { width: number; height: number };
    const px = new Uint8Array(width * height * 4);
    if (rt) renderer.readRenderTargetPixels(rt, 0, 0, width, height, px);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('[baked-cards] no 2d canvas context');
    const img = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) img.data.set(px.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4); // bottom-up → top-down
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL(mime, quality);
  };
  (window as unknown as { __cardBake: unknown }).__cardBake = {
    albedo: toDataUrl(card.albedo, 'image/png'),
    normal: toDataUrl(card.normal, 'image/jpeg', 0.92),
    arm: toDataUrl(card.arm, 'image/jpeg', 0.9),
  };
}
