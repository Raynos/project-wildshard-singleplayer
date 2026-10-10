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
 * Tunables are `toonUniforms` (the day / night clock drives them); they reach every material through
 * `attachFogUniforms` (the ramp fog's install adds them with `addFogUniforms`), which every fogged material already calls. A material that never attaches them gets zeros: no rim, no lift,
 * no cloud shadow — still the ramp.
 */
import * as THREE from 'three';
import { addFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { TOON_GLSL_ROWS } from '../data/toonGlsl';

export const toonUniforms = {
  /** added to the shade band (linear, ×albedo): the blue-violet of Rime's shadows */
  uToonLift: { value: new THREE.Color(0.07, 0.035, 0.2) },
  /** rim colour × strength (linear) */
  uToonRim: { value: new THREE.Color(1.3, 0.95, 0.6) },
  /** terminator band colour × strength (×albedo²-ish saturated) */
  uToonTerm: { value: new THREE.Color(0.4, 0.16, 0.06) },
  /** 0..1 how much the shade band keeps of the sun's facet grade (0 = flat toon shade) */
  uToonShadeGrade: { value: 0.0 },
  /** cloud shadows (L4): strength 0..1, scroll time (s), wind (m/s xz), feature size (m) */
  uCloudShadow: { value: 0.6 },
  /** 0 = day … 1 = night (DayNight): the sea darkens its lagoon tint by it */
  uToonNight: { value: 0 },
  /** W4 caustics: the sea's still level (m; −1e4 = no sea) and their strength */
  uSeaLevel: { value: -1e4 },
  uCaustics: { value: 0.5 },
  uCloudTime: { value: 0 },
  uCloudWind: { value: new THREE.Vector2(3.2, 1.4) },
  uCloudScale: { value: 60 },
  /** L3 colour-ramp fog: the sky's zenith (the far ramp is the dome's own gradient), the mid-distance aerial tint, and
   *  the distance ramp in metres (crisp before `start`, fully the sky by `end`) */
  uFogZenith: { value: new THREE.Color(0.055, 0.2, 0.78) },
  uFogNear: { value: new THREE.Color(0.5, 0.6, 0.98) },
  uFogStart: { value: 180 },
  uFogEnd: { value: 1700 },
};

/** the GLSL is data (data/toonGlsl.ts); `@{name}` splices the fragments this module passes */
const TOON_FAMILY = new ShaderFamily(TOON_GLSL_ROWS, {});

const TOON_GLSL = TOON_FAMILY.glsl(TOON_GLSL_ROWS.toon);

/**
 * L3 — colour-ramp fog (Firewatch): distance × height. Before `uFogStart` the island is crisp; out to `uFogEnd` the
 * colour ramps from a cool aerial blue-violet into the sky dome's own gradient in that direction (so the sea's horizon
 * dissolves into the sky seamlessly), warmer toward the sun; high ground keeps more contrast than the water line. The
 * old exponential terms still run (with Driftwood's thin dry densities) so the underwater blend in Atmosphere.ts works.
 */
const RAMP_FOG_PARS = TOON_FAMILY.glsl(TOON_GLSL_ROWS.rampFogPars);

const RAMP_FOG = TOON_FAMILY.glsl(TOON_GLSL_ROWS.rampFog);

let lit = false, fogged = false;

/** the toon light model: one patch of three's `lights_physical_pars_fragment` (the look's `lighting`) */
export function installToonLighting(): void {
  if (lit) return;
  lit = true;
  const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
  const defs = '#define RE_Direct				RE_Direct_Physical';
  if (!chunk.includes(defs)) { console.warn('[stylize] three chunk changed: lights_physical_pars_fragment has no RE_Direct define; toon lighting off'); return; }
  THREE.ShaderChunk.lights_physical_pars_fragment = chunk.replace('#define RE_IndirectSpecular		RE_IndirectSpecular_Physical', `#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
${TOON_GLSL}`);
}

/**
 * L3: the colour-ramp fog replaces Atmosphere's exponential fog (installAtmosphere ran first, in Game), and the toon
 * uniforms ride every fogged material's `attachFogUniforms` (the look's `fog`, slot 200)
 */
export function installRampFog(): void {
  if (fogged) return;
  fogged = true;
  THREE.ShaderChunk.fog_pars_fragment += RAMP_FOG_PARS;
  THREE.ShaderChunk.fog_fragment = RAMP_FOG;
  addFogUniforms(toonUniforms);
}

/** Explore's overhead map: the ramp haze off for the shot, then back (the look's `fogControl`) */
const held = { start: 0, end: 0 };
export function suspendRampFog(): void {
  held.start = toonUniforms.uFogStart.value; held.end = toonUniforms.uFogEnd.value;
  toonUniforms.uFogStart.value = 1e6; toonUniforms.uFogEnd.value = 2e6;
}
export function resumeRampFog(): void { toonUniforms.uFogStart.value = held.start; toonUniforms.uFogEnd.value = held.end; }
