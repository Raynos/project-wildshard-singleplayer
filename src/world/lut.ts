/**
 * The learned colour LUT of the low-poly shard (DRIFTWOOD-REMASTER X1): a 33³ RGB lookup fitted by
 * `scripts/fit-lut.py` from the E43 mockup loop's capture ↔ mockup pairs, so the game's palette lands on the mockups'
 * (turquoise shallows, cobalt deep water, golden sand, saturated foliage) without hand-tuning every def colour.
 *
 *   const lut = await loadStylizedLUT();   // Sky.setupStylized; null when missing or `?nolut` (the fit's own captures)
 *   new LUT3DEffect(lut, { inputColorSpace: SRGBColorSpace })   // Game.buildComposer: the last grade step
 *
 * File: public/assets/lut/driftwood-isle.bin — 33³ × RGBA8, index (b · 33 + g) · 33 + r, display sRGB in → display
 * sRGB out. Kept as raw bytes in a linear-colour-space texture so the sampler passes them through untouched.
 */
import * as THREE from 'three';
import { LookupTexture } from 'postprocessing';

export const LUT_SIZE = 33;
const URL_LUT = '/assets/lut/driftwood-isle.bin';

export async function loadStylizedLUT(): Promise<LookupTexture | null> {
  if (new URLSearchParams(location.search).has('nolut')) return null;
  try {
    const res = await fetch(URL_LUT);
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length !== LUT_SIZE ** 3 * 4) { console.warn(`[lut] ${URL_LUT}: ${data.length} bytes, expected ${LUT_SIZE ** 3 * 4}`); return null; }
    const lut = new LookupTexture(data, LUT_SIZE);
    lut.type = THREE.UnsignedByteType;
    lut.colorSpace = THREE.NoColorSpace;
    lut.name = 'driftwood-isle-lut';
    lut.needsUpdate = true;
    return lut;
  } catch (e) {
    console.warn('[lut] not loaded:', e);
    return null;
  }
}
