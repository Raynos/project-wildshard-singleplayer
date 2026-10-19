import type { PostEffectRow } from '@wildshard/format/scaledPost';
import { LUT_SIZE } from '@wildshard/engine/render/lut';
import layout from '../data/layoutPlan.json' with { type: 'json' };
import bleed from '../data/composite.json' with { type: 'json' };
import { JIEHUA_FS } from './compositeProgram';

/** Compile the static post Effect source while authoring the existing boot rows. */
const B = bleed;
const uniforms = {
  uHasBleed: 0, uRainHaze: 6, uReflK: 0, uTexel: { v2: [0, 0] }, uLineScale: 1, uLines: 1,
  uSilPx: { v2: [2.1, 1.2] }, uSilFade: { v2: [60, 170] }, uSilGain: 0.35,
  uNF: { v2: [0.1, 1000] }, uSharp: 0,
  uBleed: { v4: [B.tight, B.wide / 4, B.stain, B.stainResponse] },
  uBleed2: { v4: [B.weave, B.warp, B.edge, B.exposure] },
  uRain: { v4: [B.rain, B.rainAngle, B.rainSpeed, 2] },
  uGrade: { v3: [B.vignette, B.grain, B.shadowBlue] }, uTone: { v4: [B.toe, B.toeEnd, B.vibrance, B.warm] },
} as const;
export function compositeRows(): { readonly bleed: typeof bleed; readonly uniforms: typeof uniforms; readonly effect: PostEffectRow } {
  const fragments: Readonly<Record<string, string>> = { y0: String(layout.Y0), lutScale: ((LUT_SIZE - 1) / LUT_SIZE).toFixed(6), lutBias: (0.5 / LUT_SIZE).toFixed(6) };
  const source = JIEHUA_FS.replaceAll(/@\{([a-zA-Z0-9_]+)\}/gu, (_token, name: string) => {
    const value = fragments[name];
    if (value === undefined) throw new Error(`Missing composite splice: ${name}`);
    return value;
  });
  return { bleed, uniforms, effect: { name: 'NdJiehuaEffect', source, depth: true } };
}
