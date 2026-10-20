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
 * (`V2_UNGRADE` in GLSL; the fog LUT is un-graded at build time, generators/postChain.ts): they write the scene-linear
 * value the grade maps back onto the painting. The dome and the fog share it, so 3D fades into the painting with no step.
 */
import type { Pass } from 'postprocessing';
import type { EngineKnobs, LookReplaceContext } from '@wildshard/engine/render/look';
import type { Tier } from '@wildshard/engine/core/tier';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import { PostRowEffect, postChainPasses } from '@wildshard/game/looks/scaledPost';
import metadata from '../bootMetadata.generated.json' with { type: 'json' };

const rows = metadata.postChain;
export const gradeUniforms = uniformsFrom(rows.uniforms);
if (typeof window !== 'undefined') Object.assign(window, { __gradeV2: gradeUniforms });
/** Grid cells retain the same engine knobs and live display uniforms. */
export function lookV2EngineKnobs(tier: Tier): EngineKnobs {
  return { bloom: rows.chain.bloom.tiers.includes(tier) ? rows.chain.bloom : null, vignette: 0, rays: 0, ao: false,
    display: () => new PostRowEffect({ ...rows.chain.effect, blend: 'normal' }, gradeUniforms) };
}

/** Native view context and observations bind to the authored post schedule. */
export const lookV2Passes = (c: Pick<LookReplaceContext, 'scene' | 'camera' | 'tier'>): Pass[] => postChainPasses(rows.chain, c, gradeUniforms);
