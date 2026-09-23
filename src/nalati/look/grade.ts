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
import * as THREE from 'three';
import { Effect, BlendFunction, EffectComposer, RenderPass, EffectPass, BloomEffect } from 'postprocessing';
import { TIER, TIER_CONFIG } from '../../core/tier';

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
export const V2_GRADE_GLSL = /* glsl */`
uniform float uV2Exposure;
uniform float uV2Sat;
uniform float uV2LookSat;
const vec3 V2_LUM = vec3(0.2126, 0.7152, 0.0722);
const vec3 V2_SHADOW = vec3(${SHADOW.join(', ')});
const vec3 V2_LIGHT = vec3(${LIGHT.join(', ')});
vec3 v2Grade(vec3 x) {
  x = max(x, vec3(0.0)) * 1.12 * uV2Exposure;
  vec3 c = x * (1.0 + x / 9.0) / (1.0 + x);
  float l = dot(c, V2_LUM);
  c = mix(vec3(l), c, uV2Sat);
  c *= mix(V2_SHADOW, V2_LIGHT, smoothstep(0.05, 0.6, l));
  c = clamp(c, 0.0, 1.0);
  c = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65;
  return mix(vec3(dot(c, V2_LUM)), c, uV2LookSat);
}
vec3 v2Ungrade(vec3 y) {
  y = clamp(y, 0.0, 1.0);
  vec3 c = y;
  for (int i = 0; i < 3; i++) {
    vec3 f = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65 - y;
    c = clamp(c - f / (2.1 * c * (1.0 - c) + 0.65), 0.0, 1.0);
  }
  vec3 t = mix(V2_SHADOW, V2_LIGHT, smoothstep(0.05, 0.6, dot(c, V2_LUM)));
  vec3 b = c / t;
  t = mix(V2_SHADOW, V2_LIGHT, smoothstep(0.05, 0.6, dot(b, V2_LUM)));
  b = c / t;
  float l = dot(b, V2_LUM);
  b = max(vec3(l) + (b - vec3(l)) / uV2Sat, vec3(0.0));
  vec3 x = 4.5 * (-(1.0 - b) + sqrt((1.0 - b) * (1.0 - b) + 4.0 * b / 9.0));
  return x / (1.12 * uV2Exposure);
}
`;

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
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
  const split = (l: number, k: number): number => (SHADOW[k] ?? 1) + ((LIGHT[k] ?? 1) - (SHADOW[k] ?? 1)) * smooth(0.05, 0.6, l);
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
  constructor() {
    super('GradeV2Effect', /* glsl */`
      ${V2_GRADE_GLSL}
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(v2Grade(inputColor.rgb), inputColor.a);
      }`, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ['uV2Exposure', gradeUniforms.uV2Exposure as THREE.Uniform],
        ['uV2Sat', gradeUniforms.uV2Sat as THREE.Uniform],
        ['uV2LookSat', gradeUniforms.uV2LookSat as THREE.Uniform],
      ]),
    });
  }
}

/**
 * The v2 composer: RenderPass (MSAA ×4, phone ×2, unless the player turned anti-aliasing off) → one EffectPass (desktop: bloom,
 * then the grade; phone: the grade alone). `Game.buildComposer` returns this in v2 (one line).
 */
export function buildLookV2Chain(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): EffectComposer {
  // phone: MSAA ×2 (the fill rate of ×4 at DPR 1.5 on a tile GPU, for edges the grass hides anyway); desktop ×4
  const msaa = TIER_CONFIG.smaa === 'off' ? 0 : TIER === 'phone' ? 2 : 4;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: Math.min(msaa, renderer.capabilities.maxSamples) });
  composer.addPass(new RenderPass(scene, camera));
  const grade = new GradeV2Effect();
  if (TIER === 'desktop') {
    const bloom = new BloomEffect({ intensity: 0.28, luminanceThreshold: 0.95, luminanceSmoothing: 0.3, mipmapBlur: true, radius: 0.7, levels: TIER_CONFIG.bloomLevels });
    composer.addPass(new EffectPass(camera, bloom, grade));
  } else {
    composer.addPass(new EffectPass(camera, grade));
  }
  return composer;
}
