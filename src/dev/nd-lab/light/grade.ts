// Lab P6 "light" (E169): the COLOUR GRADE — a learned 33³ LUT fitted from the round-8 look loop (the 9 codex targets vs
// the lab's captures with the light pools and window glow on; neon excluded, greys held) and the blue-hour SKY + FOG
// ramp the LUT should not have to fix.
//  - LUT file: public/assets/nine-dragon/lab/grade-lut.bin — 33³ × RGBA8, index (b·33 + g)·33 + r, display sRGB in →
//    display sRGB out (scripts/fit-lut.py's format, the game's src/world/lut.ts reads the same bytes).
//  - GLSL (`GRADE_GLSL`): `vec3 gradeLut(vec3 srgb)`, the composite's LAST colour step (after toSRGB, before grain):
//    one trilinear texture3D fetch.
import { ClampToEdgeWrapping, type Color, Data3DTexture, LinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three';

export const LUT_N = 33;

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

/** fetch a fitted LUT; null (and a warning) when it is missing or the wrong size */
export async function loadLut(url: string): Promise<Data3DTexture | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length !== LUT_N ** 3 * 4) { console.warn(`[grade] ${url}: ${data.length} bytes, expected ${LUT_N ** 3 * 4}`); return null; }
    return lutTexture(data);
  } catch (e: unknown) {
    console.warn('[grade] LUT not loaded', e);
    return null;
  }
}

export const GRADE_GLSL = /* glsl */ `
uniform highp sampler3D uLut;
uniform float uLutAmt;
vec3 gradeLut(vec3 srgb) {
  if (uLutAmt <= 0.0) return srgb;
  vec3 g = texture(uLut, clamp(srgb, 0.0, 1.0) * ${((LUT_N - 1) / LUT_N).toFixed(6)} + ${(0.5 / LUT_N).toFixed(6)}).rgb;
  return mix(srgb, g, uLutAmt);
}
`;

/**
 * The blue-hour ramp, tuned on the round-8 loop-2 clean room (whose LOOKS.jiehua sky read #707c93 against the targets'
 * #7d93af, ΔE 8.4 → 1.1 with this ramp): a lighter, bluer zenith and horizon, a denser, darker blue fog, and the Well's
 * +101 / +36 m bands darkened so the shaft reads deep. HEAD 3c39b36f retuned LOOKS.jiehua itself (sky ΔE 1.6 with its
 * height fog), so the lab leaves this OFF there (`sky: 0`); keep it for a look that has not been retuned.
 */
export interface SkyRamp { fog: number; fogDensity: number; skyTop: number; skyHorizon: number; bands: readonly number[] }
export const BLUE_HOUR: SkyRamp = {
  fog: 0x7585a0,
  fogDensity: 0.009,
  skyTop: 0x7890ae,
  skyHorizon: 0x98acc0,
  /** the four top fog bands (+212, +152, +101, +36 m): the +101 band sits under the square and was a pale #c4c7cc */
  bands: [0xb8c4d4, 0xa3afc1, 0x56617a, 0x4a5670],
};

export interface SkyTargets { uFogBase: { value: number }; uFogBaseCol: { value: Color }; uSkyTop: { value: Color }; uSkyHorizon: { value: Color }; uBandCols: { value: Color[] } }

export function applyRamp(u: SkyTargets, r: SkyRamp): void {
  u.uFogBaseCol.value.setHex(r.fog);
  u.uFogBase.value = r.fogDensity;
  u.uSkyTop.value.setHex(r.skyTop);
  u.uSkyHorizon.value.setHex(r.skyHorizon);
  r.bands.forEach((hex, i) => { u.uBandCols.value[i]?.setHex(hex); });
}
