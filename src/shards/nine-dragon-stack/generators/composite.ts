import bleed from '../data/composite.json' with { type: 'json' };

/** The Jiehua frame's authored rows: its bleed tuning and the uniforms its composite graph (compositeGraph.ts) reads. */
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
export function compositeRows(): { readonly bleed: typeof bleed; readonly uniforms: typeof uniforms } { return { bleed, uniforms }; }
