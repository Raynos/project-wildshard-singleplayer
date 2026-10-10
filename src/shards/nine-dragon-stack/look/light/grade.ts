// Copied from the light lab (the dev labs (deleted in E357 F7), round-9-lab-light) into the clean room.
// Lab P6 "light" (E169): the COLOUR GRADE — a learned 33³ LUT fitted from the round-8 look loop (the 9 codex targets vs
// the lab's captures with the light pools and window glow on; neon excluded, greys held) and the blue-hour SKY + FOG
// ramp the LUT should not have to fix.
//  - LUT file: public/assets/nine-dragon/lab/grade-lut.bin — 33³ × RGBA8, index (b·33 + g)·33 + r, display sRGB in →
//    display sRGB out (scripts/fit-lut.py's format, fetched by the engine's one loader, `fetchLut`).
//  - GLSL (data/light.ts `GRADE_GLSL`): `vec3 gradeLut(vec3 srgb)`, the composite's LAST colour step (after toSRGB, before grain):
//    one trilinear texture3D fetch.
import type { Color, Data3DTexture } from 'three';
import { LUT_TEXEL_SPLICES, identityLutTexture, loadLutTexture } from '@wildshard/sdk/looks/lutTexture';
import type { SkyRamp } from '../../data/light';
// SHARD-PLATFORM M3: the GLSL and the blue-hour ramp are data (data/light.ts: GRADE_GLSL, BLUE_HOUR).

export function gradeUniforms(): { uLut: { value: Data3DTexture }; uLutAmt: { value: number } } {
  return { uLut: { value: identityLutTexture() }, uLutAmt: { value: 0 } };
}

/** fetch a fitted LUT (the SDK's LUT texture over the engine's one loader); null (and a warning) when it is missing or the wrong size */
export const loadLut: typeof loadLutTexture = loadLutTexture;

/** the LUT's texel-centre mapping, spliced into data/light.ts' GRADE_GLSL (`@{lutScale}`, `@{lutBias}`) */
export const LUT_SPLICES: Readonly<Record<string, string>> = LUT_TEXEL_SPLICES;

export interface SkyTargets { uFogBase: { value: number }; uFogBaseCol: { value: Color }; uSkyTop: { value: Color }; uSkyHorizon: { value: Color }; uBandCols: { value: Color[] } }

export function applyRamp(u: SkyTargets, r: SkyRamp): void {
  u.uFogBaseCol.value.setHex(r.fog);
  u.uFogBase.value = r.fogDensity;
  u.uSkyTop.value.setHex(r.skyTop);
  u.uSkyHorizon.value.setHex(r.skyHorizon);
  r.bands.forEach((hex, i) => { u.uBandCols.value[i]?.setHex(hex); });
}
