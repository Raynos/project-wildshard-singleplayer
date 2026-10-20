import type { PostChainRow } from '@wildshard/format/scaledPost';
import * as THREE from 'three';
import { GRADE_GLSL } from './gradeProgram';
import { PANO_FOG_SRGB } from './panoramaData';

/** Author the painted grade and the desktop bloom; the client only binds uniforms. */
export function postChainRows(): { readonly chain: PostChainRow & { readonly bloom: NonNullable<PostChainRow['bloom']> }; readonly shadow: readonly number[]; readonly light: readonly number[]; readonly lum: readonly number[]; readonly uniforms: { readonly uV2Exposure: number; readonly uV2Sat: number; readonly uV2LookSat: number }; readonly fogLut: readonly number[] } {
  const shadow = [0.92, 0.96, 1.05], light = [1.07, 0.99, 0.84], lum = [0.2126, 0.7152, 0.0722];
  const grade = GRADE_GLSL.V2_GRADE_GLSL.replaceAll('@{SHADOW_TONE}', shadow.join(', ')).replaceAll('@{LIGHT_TONE}', light.join(', '));
  const chain = { scene: true, effect: { name: 'GradeV2Effect', source: GRADE_GLSL.effect.replaceAll('@{V2_GRADE_GLSL}', grade) },
    bloom: { tiers: ['desktop'], intensity: 0.28, threshold: 0.95, smoothing: 0.3, radius: 0.7 } } satisfies PostChainRow;
  const uniforms = { uV2Exposure: 1, uV2Sat: 1.05, uV2LookSat: 1 };
  return { chain, shadow, light, lum, uniforms, fogLut: ungradedFog(shadow, light, lum, uniforms.uV2Exposure, uniforms.uV2Sat) };
}

/**
 * The painted fog LUT (panoramaData.ts) taken back through the grade's exact inverse (`v2Ungrade`), so the fog writes the
 * scene-linear value the grade maps back onto the painting. Stored as sRGB again: the page's heading texture decodes sRGB.
 */
function ungradedFog(shadow: readonly number[], light: readonly number[], lum: readonly number[], e: number, s: number): number[] {
  const luma = (c: readonly number[]): number => (c[0] ?? 0) * (lum[0] ?? 0) + (c[1] ?? 0) * (lum[1] ?? 0) + (c[2] ?? 0) * (lum[2] ?? 0);
  const smoothstep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const split = (l: number, k: number): number => (shadow[k] ?? 1) + ((light[k] ?? 1) - (shadow[k] ?? 1)) * smoothstep(0.05, 0.6, l);
  const colour = new THREE.Color(), out: number[] = [];
  for (let i = 0; i < PANO_FOG_SRGB.length; i += 3) {
    colour.setRGB(PANO_FOG_SRGB[i] ?? 0, PANO_FOG_SRGB[i + 1] ?? 0, PANO_FOG_SRGB[i + 2] ?? 0, THREE.SRGBColorSpace);
    const c = [colour.r, colour.g, colour.b].map(y => {
      const yk = Math.min(1, Math.max(0, y)); let v = yk;
      for (let n = 0; n < 3; n++) v = Math.min(1, Math.max(0, v - (v * v * (3 - 2 * v) * 0.35 + v * 0.65 - yk) / (2.1 * v * (1 - v) + 0.65)));
      return v;
    });
    let l = luma(c), b = c.map((ck, k) => ck / split(l, k));
    l = luma(b); b = c.map((ck, k) => ck / split(l, k)); l = luma(b);
    const x = b.map(bk => { const d = Math.max(0, l + (bk - l) / s); return (4.5 * (-(1 - d) + Math.sqrt((1 - d) * (1 - d) + (4 * d) / 9))) / (1.12 * e); });
    colour.setRGB(x[0] ?? 0, x[1] ?? 0, x[2] ?? 0);
    const srgb = colour.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    out.push(...[srgb.r, srgb.g, srgb.b].map(value => Math.round(value * 1e6) / 1e6));
  }
  return out;
}
