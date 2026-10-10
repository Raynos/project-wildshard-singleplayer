/**
 * Driftwood's toon lighting and colour-ramp fog (DRIFTWOOD-REMASTER L1, the user's pick D1: "toon two-band ramp +
 * coloured shadows + rim", BotW / Wind Waker / Rime). Moved from the engine's stylize.ts (E357 S4.3); the look declares
 *
 *   lighting: { install: installToonLighting }   // Sky.build runs it first, before anything compiles
 *   fog: { order: 200, install: installRampFog } // Game.buildSky runs it after the engine fog (slot 100), before the sky
 *
 * One patch of three's `lights_physical_pars_fragment` chunk, so EVERY MeshStandard / MeshPhysical material on the
 * shard — lowpolyKit models, the terrain, animals, enemies, the viewmodel — is lit the same way with no per-material
 * call and no extra program (a shard switch is a page reload, so Pine Hollow never sees the patched chunk: D8).
 * A material opts out with `defines: { NO_TOON: '' }` (the define is in the program key, so it is its own program).
 *
 * The model, per fragment:
 * - **sun** (the CSM directional light — recognised by its direction; its unshadowed colour is the
 *   `directionalLights[0]` uniform, so the cast shadow is recovered as a ratio): a two-band smoothstep ramp on
 *   N·L × shadow. The lit band keeps a soft Lambert grade so flat facets still read as facets; the shade band is
 *   the ambient alone. A thin warm, saturated terminator band rides a turning facet's edge (not a cast shadow's, E145).
 * - **rim**: a sun-coloured fresnel rim on the lit side of vertical-ish faces (props, creatures, trunks) — never on
 *   the ground, where every distant facet is grazing.
 * - **ambient** (shade): the scene's HemisphereLight (sky = blue-violet fill, ground = warm sand bounce) plus a
 *   violet lift, so shadow is coloured, never black. The IBL's diffuse term is dropped (the sky dome is the
 *   environment; its diffuse would wash the two bands back into a gradient); IBL specular stays (metals).
 * - **point lights** (lanterns, glyph glows) keep three's physical path.
 * - **specular** from the sun: three's GGX times the lit band, skipped on rough materials (roughness > 0.72,
 *   which is every lowpolyKit model) — the phone pays a Lambert, not a GGX, for the island.
 *
 * SHARD-PLATFORM M3: the light model and the ramp fog are the SDK toon light (@wildshard/sdk/looks/toonLight); the GLSL is
 * data (data/toonGlsl.ts), the tunables' starting values too (data/toonLook.ts).
 *
 * Tunables are `toonUniforms` (the day / night clock drives them); they reach every material through
 * `attachFogUniforms` (the ramp fog's install adds them with `addFogUniforms`), which every fogged material already calls. A material that never attaches them gets zeros: no rim, no lift,
 * no cloud shadow — still the ramp.
 */
import { ToonLight, type ToonLightUniforms } from '@wildshard/sdk/looks/toonLight';
import { TOON_GLSL_ROWS } from '../data/toonGlsl';
import { TOON_TUNE } from '../data/toonLook';

/**
 * L3 — colour-ramp fog (Firewatch): distance × height. Before `uFogStart` the island is crisp; out to `uFogEnd` the
 * colour ramps from a cool aerial blue-violet into the sky dome's own gradient in that direction (so the sea's horizon
 * dissolves into the sky seamlessly), warmer toward the sun; high ground keeps more contrast than the water line. The
 * old exponential terms still run (with Driftwood's thin dry densities) so the underwater blend in Atmosphere.ts works.
 */
const TOON = new ToonLight(TOON_GLSL_ROWS, TOON_TUNE);

export const toonUniforms: ToonLightUniforms = TOON.uniforms;

/** the toon light model: one patch of three's `lights_physical_pars_fragment` (the look's `lighting`) */
export function installToonLighting(): void { TOON.installLighting(); }

/** L3: the colour-ramp fog replaces Atmosphere's exponential fog (installAtmosphere ran first, in Game), and the toon
 *  uniforms ride every fogged material's `attachFogUniforms` (the look's `fog`, slot 200) */
export function installRampFog(): void { TOON.installRampFog(); }

/** Explore's overhead map: the ramp haze off for the shot, then back (the look's `fogControl`) */
export function suspendRampFog(): void { TOON.suspendRampFog(); }
export function resumeRampFog(): void { TOON.resumeRampFog(); }
