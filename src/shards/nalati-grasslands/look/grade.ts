/**
 * Look v2 — the grade (port-v2.md step 3) and the v2 post chain.
 *
 * One function turns the scene's linear light into the displayed colour, the clean-room prototype's `grade()`: a gentle
 * filmic shoulder `x(1 + x/9)/(1 + x)` on 1.12 × exposure (painted albedos under ~1× light keep their painted value),
 * saturation 1.05, a cool-shadow / golden-light split and a mild S-curve. It runs once, as the only effect of the v2
 * composer (RenderPass with MSAA → one EffectPass; bloom joins it on desktop only). No AO, volumetrics, god rays or
 * SMAA: `game.post` stays null, so the day/night rig leaves the (unbuilt) default chain alone.
 *
 * The painted sky must display *as painted*, so the dome and the fog colour go through the exact inverse
 * (`V2_UNGRADE` in GLSL, `ungrade()` on the CPU): they write the scene-linear value the grade maps back onto the
 * painting. The dome and the fog share it, so 3D fades into the painting with no step.
 */
import type * as THREE from 'three';
import { Effect, BlendFunction, RenderPass, EffectPass, BloomEffect, type Pass } from 'postprocessing';
import { TIER_CONFIG, type Tier } from '@wildshard/engine/core/tier';
import type { EngineKnobs, LookReplaceContext } from '@wildshard/engine/render/look';
import { smoothstep } from '@wildshard/engine/core/noise';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { GRADE_GLSL } from '../data/gradeGlsl';

/** the GLSL below is data (data/gradeGlsl.ts); `@{name}` splices the fragments this module passes */
const GRADE_GLSL_FAMILY = new ShaderFamily(GRADE_GLSL, {});

/** the grade's live knobs (shared uniform objects: the grade effect and every inverse read them) */
export const gradeUniforms = {
  uV2Exposure: { value: 1.0 },
  uV2Sat: { value: 1.05 },
  /** the hour's saturation on top (the rig's keys: night greys out), applied last — outside what the inverse undoes, so it
   *  greys the painted sky with the world instead of being cancelled on it */
  uV2LookSat: { value: 1.0 },
};
if (typeof window !== 'undefined') Object.assign(window, { __gradeV2: gradeUniforms });

const SHADOW = [0.92, 0.96, 1.05] as const;
const LIGHT = [1.07, 0.99, 0.84] as const;
const LUM = [0.2126, 0.7152, 0.0722] as const;

/** GLSL: `vec3 v2Grade(vec3 sceneLinear)` → display-linear, `vec3 v2Ungrade(vec3 displayLinear)` → scene-linear */
export const V2_GRADE_GLSL = GRADE_GLSL_FAMILY.glsl(GRADE_GLSL.V2_GRADE_GLSL, { SHADOW_TONE: SHADOW.join(', '), LIGHT_TONE: LIGHT.join(', ') });

const lum = (c: readonly [number, number, number]): number => c[0] * LUM[0] + c[1] * LUM[1] + c[2] * LUM[2];

/** the CPU copy of `v2Ungrade` (display-linear → scene-linear), in place on a 3-tuple */
export function ungrade(y: [number, number, number]): [number, number, number] {
  const e = gradeUniforms.uV2Exposure.value, s = gradeUniforms.uV2Sat.value;
  const c: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const yk = Math.min(1, Math.max(0, y[k] ?? 0));
    let v = yk;
    for (let i = 0; i < 3; i++) v = Math.min(1, Math.max(0, v - (v * v * (3 - 2 * v) * 0.35 + v * 0.65 - yk) / (2.1 * v * (1 - v) + 0.65)));
    c[k] = v;
  }
  const split = (l: number, k: number): number => (SHADOW[k] ?? 1) + ((LIGHT[k] ?? 1) - (SHADOW[k] ?? 1)) * smoothstep(0.05, 0.6, l);
  let l = lum(c);
  let b: [number, number, number] = [c[0] / split(l, 0), c[1] / split(l, 1), c[2] / split(l, 2)];
  l = lum(b);
  b = [c[0] / split(l, 0), c[1] / split(l, 1), c[2] / split(l, 2)];
  l = lum(b);
  for (let k = 0; k < 3; k++) {
    const bk = Math.max(0, l + ((b[k] ?? 0) - l) / s);
    y[k] = (4.5 * (-(1 - bk) + Math.sqrt((1 - bk) * (1 - bk) + (4 * bk) / 9))) / (1.12 * e);
  }
  return y;
}

/** the grade as the v2 chain's one effect */
export class GradeV2Effect extends Effect {
  /** `blendFunction`: SRC in its own chain; NORMAL where another chain fades it in (`lookV2EngineKnobs`) */
  constructor(blendFunction: BlendFunction = BlendFunction.SRC) {
    super('GradeV2Effect', GRADE_GLSL_FAMILY.glsl(GRADE_GLSL.effect, { V2_GRADE_GLSL }), {
      blendFunction,
      uniforms: new Map<string, THREE.Uniform>([
        ['uV2Exposure', gradeUniforms.uV2Exposure as THREE.Uniform],
        ['uV2Sat', gradeUniforms.uV2Sat as THREE.Uniform],
        ['uV2LookSat', gradeUniforms.uV2LookSat as THREE.Uniform],
      ]),
    });
  }
}

/** the v2 chain's desktop bloom (the phone blooms nothing) */
const V2_BLOOM = { intensity: 0.28, threshold: 0.95, smoothing: 0.3 } as const;

/**
 * The v2 chain as engine knobs (SF63, `ReplaceLook.engineKnobs`): what a page's engine chain carries inside Nalati's grid
 * cell — the desktop bloom, no vignette, no god rays, no AO, and its own grade in place of the engine's tone mapping.
 */
export function lookV2EngineKnobs(tier: Tier): EngineKnobs {
  return { bloom: tier === 'desktop' ? V2_BLOOM : null, vignette: 0, rays: 0, ao: false, display: () => new GradeV2Effect(BlendFunction.NORMAL) };
}

/**
 * The v2 chain, the look's `mode: 'replace'` compose (render.ts): RenderPass → one EffectPass (desktop: bloom, then the
 * grade; phone: the grade alone). The engine's one composer holds them; its MSAA (×4, phone ×2 — the fill rate of ×4 at
 * DPR 1.5 on a tile GPU, for edges the grass hides anyway — none while the player turned anti-aliasing off) is the
 * manifest's `msaa` tier knob.
 */
export function lookV2Passes(c: Pick<LookReplaceContext, 'scene' | 'camera' | 'tier'>): Pass[] {
  const scene = new RenderPass(c.scene, c.camera);
  const grade = new GradeV2Effect();
  if (c.tier === 'desktop') {
    const bloom = new BloomEffect({ intensity: V2_BLOOM.intensity, luminanceThreshold: V2_BLOOM.threshold, luminanceSmoothing: V2_BLOOM.smoothing, mipmapBlur: true, radius: 0.7, levels: TIER_CONFIG.bloomLevels });
    return [scene, new EffectPass(c.camera, bloom, grade)];
  }
  return [scene, new EffectPass(c.camera, grade)];
}
