/**
 * Driftwood's toon lighting, day light and colour-ramp fog (DRIFTWOOD-REMASTER L1, the user's pick D1: "toon two-band
 * ramp + coloured shadows + rim", BotW / Wind Waker / Rime). Moved from the engine's stylize.ts (E357 S4.3); the look declares
 *
 *   lighting: { install: installToonLighting }   // Sky.build runs it first, before anything compiles
 *   fog: rampFog.model(200)                      // the engine's colour ramp, after its own fog (slot 100), before the sky
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
 * The trusted runtime owns the light model (GLSL in runtime/looks/toonGlsl.ts); starting values are data in
 * data/toonLook.ts. The day / night clock turns `dayLight`; the graph toon looks follow it once a frame (`followToon`) and
 * the classic light model reads the same uniforms, which reach every material through
 * `attachFogUniforms` (the light's install adds them with `addFogUniforms`). A material that never attaches them gets
 * zeros: no rim, no lift, no cloud shadow.
 */
import * as THREE from 'three';
import { ColourRampFog } from '@wildshard/engine/world/Atmosphere';
import { ToonLight } from '../runtime/looks/toonLight';
import { TOON_GLSL } from '../runtime/looks/toonGlsl';
import { DAY_LIGHT, RAMP_FOG, TOON_TUNE } from '../data/toonLook';
import type { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';

/** the day light the clock turns (look/backdrop.ts); the sea sets its caustics' level */
export const dayLight = {
  uToonLift: { value: new THREE.Color(...DAY_LIGHT.uToonLift) }, uToonRim: { value: new THREE.Color(...DAY_LIGHT.uToonRim) },
  uCloudShadow: { value: DAY_LIGHT.uCloudShadow }, uToonNight: { value: DAY_LIGHT.uToonNight }, uSeaLevel: { value: DAY_LIGHT.uSeaLevel }, uCloudTime: { value: DAY_LIGHT.uCloudTime },
};

/**
 * L3 — colour-ramp fog (Firewatch): distance × height. Before its start the island is crisp; out to its end the colour
 * ramps from a cool aerial blue-violet into the sky dome's own gradient in that direction (so the sea's horizon dissolves
 * into the sky seamlessly), warmer toward the sun; high ground keeps more contrast than the water line. The engine's
 * exponential terms still run (with Driftwood's thin dry densities) so the underwater blend in Atmosphere.ts works.
 */
export const rampFog = new ColourRampFog(RAMP_FOG);

const TOON = new ToonLight(TOON_GLSL, TOON_TUNE, dayLight);

/** The catalogue's live toon look (the graph toon materials', data/reefLook.ts) as it follows the day light, once a frame. */
export function followToon(look: Awaited<ReturnType<typeof runtimeLookMaterials>>['toon']): () => void {
  const u = dayLight, t = look.uniforms;
  return () => { t.famToonLift.value.copy(u.uToonLift.value); t.famToonRim.value.copy(u.uToonRim.value); t.famToonCloud.value.x = u.uCloudShadow.value; t.famToonWater.value.x = u.uSeaLevel.value; t.famToonTime.value = u.uCloudTime.value; };
}

/** the toon light model: one patch of three's `lights_physical_pars_fragment` (the look's `lighting`) */
export function installToonLighting(): void { TOON.installLighting(); }
