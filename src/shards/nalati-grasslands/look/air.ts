/**
 * Nalati's painted air (E357 S3.2, 07 §6.2 steps 1 + 5; it was `Atmosphere.ts`'s `installAtmosphere(painterly)` and
 * `paintedAir`): the painterly fog pars replace the engine's — the cloud-shadow function (`pCloudShadow`, P_CLOUDS) the
 * sun loop calls; fog.ts's panorama fog replaces the fog maths (its v1 aerial perspective was overwritten there, so cut).
 * The uniforms (`paintedAir`) reach every fogged material through `addFogUniforms`. Installed by the look's
 * `fog.install` (render.ts), right after the engine's `installAtmosphere`, before anything compiles.
 *
 * The sky dressing (`NALATI_SKY`, render.ts `sky`): the panorama dome is the sky, so the engine builds no cloud layer;
 * its cloud fbm drives the cloud shadows, which drift downwind with the steppe's one Wind.
 */
import * as THREE from 'three';
import type { SkyDressing } from '@wildshard/engine/render/look';
import { addFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { wind } from '@wildshard/engine/world/steppeWind';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { AIR_GLSL } from '../runtime/looks/airGlsl';

/** the GLSL below is trusted custom code (runtime/looks/airGlsl.ts); `@{name}` splices the fragments this module passes */
const AIR_GLSL_FAMILY = new ShaderFamily(AIR_GLSL, {});

/**
 * Cloud shadows: the sun's light (every CSM-lit material: terrain, grass, props, spruce, creatures) is multiplied by
 * a drifting cloud-cover field sampled at the fragment's world XZ (`fogCloud*`, advanced by the sky dressing along the
 * wind) — painted soft-edged shadows sliding over the grassland. The fog colour itself is fog.ts's.
 */
export const paintedAir = {
  /** the cloud-cover field (a tileable fbm, R) */
  fogCloudTex: { value: null as THREE.Texture | null },
  /** x = 1 / tile size (1/m), y = coverage threshold (higher = fewer clouds), z = shadow strength 0..1, w = edge softness */
  fogCloud: { value: new THREE.Vector4(1 / 520, 0.53, 0.66, 0.06) },
  /** the field's drift (uv), advanced along the wind */
  fogCloudOff: { value: new THREE.Vector2(0, 0) },
};

let airInstalled = false;

/**
 * The cloud shadows reach every CSM-lit material through the sun loop: CSM installs its own `lights_fragment_begin`
 * (three/examples CSM.js) and Sky patches it; this multiplies each directional light's colour by `pCloudShadow()`
 * after its info is read, so the shadow-map term, the painterly cel bands and the grass relight all see it.
 * Call after the CSM exists (the sky dressing's `build`).
 */
export function patchCloudShadows(): void {
  if (!airInstalled) return;
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (chunk.includes('pCloudShadow')) return;
  const hook = (call: string): string => `${call}\n\t\t#ifdef P_CLOUDS\n\t\tdirectLight.color *= pCloudShadow();\n\t\t#endif`;
  THREE.ShaderChunk.lights_fragment_begin = chunk
    .replaceAll('getDirectionalLightInfo( directionalLight, directLight );', hook('getDirectionalLightInfo( directionalLight, directLight );'))
    .replaceAll('getDirectionalLightInfo( directionalLights[0], directLight );', hook('getDirectionalLightInfo( directionalLights[0], directLight );'));
}

/** the sky dressing: no engine cloud layer and no planet (the dome paints the sky); the engine's cloud fbm drives the cloud shadows.
 *  The panorama dome is its world's own sky (`ownSky`): inside its grid cell it owns the horizon (G321) */
export const NALATI_SKY: SkyDressing = {
  clouds: false,
  planet: false,
  ownSky: true,
  build: (_sky, cloudField) => {
    patchCloudShadows();
    paintedAir.fogCloudTex.value = cloudField;
  },
  update: (dt) => {
    // the cloud shadows on the ground drift downwind (at ~1.6× the wind, as clouds aloft do)
    const s = (wind.speed * 1.6 + 2) * dt;
    const k = paintedAir.fogCloud.value.x;
    paintedAir.fogCloudOff.value.x -= wind.dirX * s * k; paintedAir.fogCloudOff.value.y -= wind.dirZ * s * k;
  },
};

/** the painterly fog pars (the cloud-shadow function the sun loop calls — see `paintedAir`); fog.ts installs the fog itself */
export function installPaintedAir(): void {
  airInstalled = true;
  addFogUniforms(paintedAir); // attachFogUniforms hands them to every fogged material from here on
  THREE.ShaderChunk.fog_pars_fragment = AIR_GLSL_FAMILY.glsl(AIR_GLSL.fog_pars_fragment);
}
