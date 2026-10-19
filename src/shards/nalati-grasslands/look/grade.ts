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
import type { Pass } from 'postprocessing';
import type { EngineKnobs, LookReplaceContext } from '@wildshard/engine/render/look';
import type { Tier } from '@wildshard/engine/core/tier';
import { smoothstep } from '@wildshard/engine/core/noise';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { PostRowEffect, postChainPasses } from '@wildshard/game/looks/scaledPost';
import metadata from '../bootMetadata.generated.json' with { type: 'json' };

const rows = metadata.postChain;
export const gradeUniforms = uniformsFrom(rows.uniforms);
if (typeof window !== 'undefined') Object.assign(window, { __gradeV2: gradeUniforms });
const { shadow: SHADOW, light: LIGHT, lum: LUM } = rows;

const lum = (c: readonly [number, number, number]): number => c[0] * (LUM[0] ?? 0) + c[1] * (LUM[1] ?? 0) + c[2] * (LUM[2] ?? 0);

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

/** Grid cells retain the same engine knobs and live display uniforms. */
export function lookV2EngineKnobs(tier: Tier): EngineKnobs {
  return { bloom: rows.chain.bloom.tiers.includes(tier) ? rows.chain.bloom : null, vignette: 0, rays: 0, ao: false,
    display: () => new PostRowEffect({ ...rows.chain.effect, blend: 'normal' }, gradeUniforms) };
}

/** Native view context and observations bind to the authored post schedule. */
export const lookV2Passes = (c: Pick<LookReplaceContext, 'scene' | 'camera' | 'tier'>): Pass[] => postChainPasses(rows.chain, c, gradeUniforms);
