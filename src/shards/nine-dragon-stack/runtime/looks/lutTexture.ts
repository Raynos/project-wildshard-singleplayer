// lutTexture — a colour grade's 3D lookup table as a texture (SHARD-PLATFORM M3, ex Nine Dragon's look/light/grade.ts):
// the engine's LUT_SIZE³ RGBA8 table as a linear-filtered, edge-clamped Data3DTexture with no colour space; the identity
// table (the grade off) until a fitted one loads through the engine's one loader; and the texel-centre mapping a grade
// shader splices in (`@{lutScale}`, `@{lutBias}`: uvw = c · scale + bias).
//
//   const u = { uLut: { value: identityLutTexture() } };   const t = await loadLutTexture(url); if (t !== null) u.uLut.value = t;
import { ClampToEdgeWrapping, Data3DTexture, LinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three';
import { LUT_SIZE, fetchLut } from '@wildshard/engine/render/lut';

const LUT_N = LUT_SIZE;

/** A LUT_SIZE³ RGBA8 table as a linear, edge-clamped 3D texture with no colour space. */
export function lutTexture(data: Uint8Array): Data3DTexture {
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

/** The identity table (every colour maps to itself) as a LUT texture. */
export function identityLutTexture(): Data3DTexture {
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

/** Fetch a fitted LUT (the engine's one loader) as a texture; null (and a warning) when it is missing or the wrong size. */
export async function loadLutTexture(url: string): Promise<Data3DTexture | null> {
  const data = await fetchLut(url);
  return data === null ? null : lutTexture(data);
}

/** The LUT's texel-centre mapping for a shader splice: `lutScale` = (n − 1) / n, `lutBias` = 0.5 / n (six decimals). */
export const LUT_TEXEL_SPLICES: Readonly<Record<string, string>> = { lutScale: ((LUT_N - 1) / LUT_N).toFixed(6), lutBias: (0.5 / LUT_N).toFixed(6) };
