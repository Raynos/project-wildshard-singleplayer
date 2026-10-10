// Copied from the light lab (the dev labs (deleted in E357 F7), round-9-lab-light) into the clean room.
// Lab P6 "light" (E169): the COLOUR GRADE — a learned 33³ LUT fitted from the round-8 look loop (the 9 codex targets vs
// the lab's captures with the light pools and window glow on; neon excluded, greys held) and the blue-hour SKY + FOG
// ramp the LUT should not have to fix.
//  - LUT file: public/assets/nine-dragon/lab/grade-lut.bin — 33³ × RGBA8, index (b·33 + g)·33 + r, display sRGB in →
//    display sRGB out (scripts/fit-lut.py's format, fetched by the engine's one loader, `fetchLut`).
//  - GLSL (data/light.ts `GRADE_GLSL`): `vec3 gradeLut(vec3 srgb)`, the composite's LAST colour step (after toSRGB, before grain):
//    one trilinear texture3D fetch.
import { ClampToEdgeWrapping, type Color, Data3DTexture, LinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three';
import { LUT_SIZE, fetchLut } from '@wildshard/engine/render/lut';
import type { SkyRamp } from '../../data/light';
// SHARD-PLATFORM M3: the GLSL and the blue-hour ramp are data (data/light.ts: GRADE_GLSL, BLUE_HOUR).

export const LUT_N = LUT_SIZE;

function identity(): Data3DTexture {
  const d = new Uint8Array(LUT_N ** 3 * 4);
  for (let b = 0; b < LUT_N; b++) for (let g = 0; g < LUT_N; g++) for (let r = 0; r < LUT_N; r++) {
    const i = ((b * LUT_N + g) * LUT_N + r) * 4;
    d[i] = Math.round((r / (LUT_N - 1)) * 255);
    d[i + 1] = Math.round((g / (LUT_N - 1)) * 255);
    d[i + 2] = Math.round((b / (LUT_N - 1)) * 255);
    d[i + 3] = 255;
  }
  return lutTexture(d);
}

function lutTexture(data: Uint8Array): Data3DTexture {
  const t = new Data3DTexture(data, LUT_N, LUT_N, LUT_N);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.colorSpace = NoColorSpace;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

export function gradeUniforms(): { uLut: { value: Data3DTexture }; uLutAmt: { value: number } } {
  return { uLut: { value: identity() }, uLutAmt: { value: 0 } };
}

/** fetch a fitted LUT (the engine's one loader); null (and a warning) when it is missing or the wrong size */
export async function loadLut(url: string): Promise<Data3DTexture | null> {
  const data = await fetchLut(url);
  return data === null ? null : lutTexture(data);
}

/** the LUT's texel-centre mapping, spliced into data/light.ts' GRADE_GLSL (`@{lutScale}`, `@{lutBias}`) */
export const LUT_SPLICES: Readonly<Record<string, string>> = { lutScale: ((LUT_N - 1) / LUT_N).toFixed(6), lutBias: (0.5 / LUT_N).toFixed(6) };

export interface SkyTargets { uFogBase: { value: number }; uFogBaseCol: { value: Color }; uSkyTop: { value: Color }; uSkyHorizon: { value: Color }; uBandCols: { value: Color[] } }

export function applyRamp(u: SkyTargets, r: SkyRamp): void {
  u.uFogBaseCol.value.setHex(r.fog);
  u.uFogBase.value = r.fogDensity;
  u.uSkyTop.value.setHex(r.skyTop);
  u.uSkyHorizon.value.setHex(r.skyHorizon);
  r.bands.forEach((hex, i) => { u.uBandCols.value[i]?.setHex(hex); });
}
