// Copied from the light lab (the dev labs (deleted in E357 F7), round-9-lab-light) into the clean room.
// Lab P6 "light" (E169): WINDOW GLOW — lit windows (and shop fronts, lanterns) bleeding warm light into the silk fog
// around them at distance, without blowing out. Zero extra passes: it rides in the ALPHA channel of the clean room's
// existing bloom pyramid (post.ts), which carried a constant 1.0 until now.
//  1. prefilter (½ res): alpha = the warm-glow source: how far a pixel's brightest channel sits over a low threshold,
//     × its warmth ((r − b) / r), × its distance (the colour target's alpha is near / viewZ, so no depth read). Near
//     things never glow (the fog between you and them is thin); neon keeps its own RGB bloom untouched.
//  2. down / up chains carry alpha like rgb (their shaders only change `1.0` → the sampled alpha).
//  3. composite: warm amber × (tight.a · halo + wide.a · veil), kept off anything nearer than the glow's own
//     distance (a dark pillar in front of a lit facade stays dark), before the shoulder.
// SHARD-PLATFORM M3: the uniforms' rows and both GLSL pieces are data (data/light.ts: GLOW_UNIFORMS, GLOW_PRE_GLSL,
// GLOW_COMP_GLSL).
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { GLOW_UNIFORMS } from '../../data/light';

/** the glow's live uniforms (data/light.ts GLOW_UNIFORMS) */
export function glowUniforms(): UniformsOf<typeof GLOW_UNIFORMS> { return uniformsFrom(GLOW_UNIFORMS); }
