/**
 * A shard's learned colour LUT (DRIFTWOOD-REMASTER X1; per shard since PINE-HOLLOW-REMASTER PH-0.3): a 33³ RGB lookup
 * fitted by `scripts/fit-lut.py --shard <slug>` from the shard's mockup loop's capture ↔ mockup pairs, so the game's
 * palette lands on the mockups' (Driftwood: turquoise shallows, cobalt deep water, golden sand, saturated foliage)
 * without hand-tuning every def colour.
 *
 *   const lut = await loadLUT(slug);   // Sky: null when the shard has no LUT file, or `?nolut` (the fit's own captures)
 *   new LUT3DEffect(lut, { inputColorSpace: SRGBColorSpace })   // Game.buildComposer: the last grade step
 *
 * File: public/assets/lut/<slug>.bin — 33³ × RGBA8, index (b · 33 + g) · 33 + r, display sRGB in → display sRGB out.
 * Kept as raw bytes in a linear-colour-space texture so the sampler passes them through untouched. A shard without a
 * file (the build's byte table, bytes.generated.ts, does not list one) gets no LUT pass and no fetch. Pine Hollow's is PH-L4's
 * (art/pine-hollow/round-14-look-loop/, fitted over the three zones' 27 frames).
 */
import * as THREE from 'three';
import { LookupTexture } from 'postprocessing';
import { PUBLIC_BYTES } from '../boot/bytes.generated';

export const LUT_SIZE = 33;

/** the shard's LUT file when the build has one, else null */
export function lutUrl(slug: string): string | null {
  const url = `/assets/lut/${slug}.bin`;
  return url in PUBLIC_BYTES ? url : null;
}

export async function loadLUT(slug: string): Promise<LookupTexture | null> {
  if (new URLSearchParams(location.search).has('nolut')) return null;
  const url = lutUrl(slug);
  if (url === null) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length !== LUT_SIZE ** 3 * 4) { console.warn(`[lut] ${url}: ${data.length} bytes, expected ${LUT_SIZE ** 3 * 4}`); return null; }
    const lut = new LookupTexture(data, LUT_SIZE);
    lut.type = THREE.UnsignedByteType;
    lut.colorSpace = THREE.NoColorSpace;
    lut.name = `${slug}-lut`;
    lut.needsUpdate = true;
    return lut;
  } catch (e) {
    console.warn('[lut] not loaded:', e);
    return null;
  }
}
