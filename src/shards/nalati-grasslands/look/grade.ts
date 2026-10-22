/**
 * Look v2 — the grade (port-v2.md step 3): its live uniforms. The grade itself is a post graph on the post-graph look
 * (generators/postChain.ts, game/looks/postGraphLook), reading these as the world's lent 'nalati-grade' set.
 *
 * One function turns the scene's linear light into the displayed colour, the clean-room prototype's `grade()`: a gentle
 * filmic shoulder `x(1 + x/9)/(1 + x)` on 1.12 × exposure (painted albedos under ~1× light keep their painted value),
 * saturation 1.05, a cool-shadow / golden-light split and a mild S-curve. It runs once, after the scene pass (bloom before
 * it on desktop only). No AO, volumetrics, god rays or SMAA: `game.post` stays null, so the day/night rig leaves the
 * (unbuilt) default chain alone.
 *
 * The painted sky must display *as painted*, so the dome and the fog colour go through the exact inverse (the fog LUT is
 * un-graded at build time, generators/postChain.ts): they write the scene-linear value the grade maps back onto the
 * painting. The dome and the fog share it, so 3D fades into the painting with no step.
 */
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import metadata from '../bootMetadata.generated.json' with { type: 'json' };

export const gradeUniforms = uniformsFrom(metadata.postChain.uniforms);
if (typeof window !== 'undefined') Object.assign(window, { __gradeV2: gradeUniforms });
