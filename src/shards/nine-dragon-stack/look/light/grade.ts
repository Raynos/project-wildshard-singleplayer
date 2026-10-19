// Copied from the light lab (the dev labs (deleted in E357 F7), round-9-lab-light) into the clean room.
// Lab P6 "light" (E169): the COLOUR GRADE — a learned 33³ LUT fitted from the round-8 look loop (the 9 codex targets vs
// the lab's captures with the light pools and window glow on; neon excluded, greys held) and the blue-hour SKY + FOG
// ramp the LUT should not have to fix.
//  - LUT file: public/assets/nine-dragon/lab/grade-lut.bin — 33³ × RGBA8, index (b·33 + g)·33 + r, display sRGB in →
//    display sRGB out (scripts/fit-lut.py's format, fetched by the engine's one loader, `fetchLut`).
//  - GLSL (data/light.ts `GRADE_GLSL`): `vec3 gradeLut(vec3 srgb)`, the composite's LAST colour step (after toSRGB, before grain):
//    one trilinear texture3D fetch.
import { type Data3DTexture, NoColorSpace } from 'three';
import { LookupTexture } from 'postprocessing';
import { loadCarriedLUT } from '@wildshard/engine/boot/bakedApi';
import { LUT_SIZE } from '@wildshard/engine/render/lut';
// SHARD-PLATFORM M3: the GLSL is data (data/light.ts: GRADE_GLSL).

export function gradeUniforms(): { uLut: { value: Data3DTexture }; uLutAmt: { value: number } } {
  const texture = LookupTexture.createNeutral(LUT_SIZE).convertToUint8(); texture.colorSpace = NoColorSpace;
  return { uLut: { value: texture }, uLutAmt: { value: 0 } };
}

/** Use the existing engine LUT reader; a missing shipped grade refuses the build. */
export async function loadLut(url: string): Promise<Data3DTexture> {
  const texture = await loadCarriedLUT(url, 'nine-grade');
  if (texture === null) throw new Error(`Missing Nine grade LUT: ${url}`);
  return texture;
}
