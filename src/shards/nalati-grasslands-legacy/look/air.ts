/**
 * Nalati's painted air (E357 S3.2, 07 §6.2 steps 1 + 5; it was `Atmosphere.ts`'s `installAtmosphere(painterly)` and
 * `paintedAir`): the painterly fog chunks replace the engine's fog maths — aerial perspective (clear air, then layered
 * haze that takes the saturation first) and the cloud-shadow function (`pCloudShadow`, P_CLOUDS) the sun loop calls.
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

/**
 * Aerial perspective: the painter's distance cue. Past `fogAerial.x` metres everything first loses saturation, then
 * dissolves toward the luminous horizon haze (`fog.color`, warmed by `fogSunColor` toward the sun), in layers:
 * `fogAerial.y × (1 − e^(−d·fogDistDensity))` — so ridge after ridge steps paler and bluer, the snow range stays
 * readable. The valley's height haze (`fogHeight*`) adds on top. A storm's thick `fogDistDensity` lifts the cap to 1.
 *
 * Cloud shadows: the sun's light (every CSM-lit material: terrain, grass, props, spruce, creatures) is multiplied by
 * a drifting cloud-cover field sampled at the fragment's world XZ (`fogCloud*`, advanced by the sky dressing along the
 * wind) — painted soft-edged shadows sliding over the grassland. `setCloudCover()` retunes it (weather).
 */
export const paintedAir = {
  /** x = metres of clear air before the haze starts, y = the haze cap (0..1), z = desaturation share, w = sun-side warmth */
  fogAerial: { value: new THREE.Vector4(30, 0.72, 0.5, 0.65) },
  /** the cloud-cover field (a tileable fbm, R) */
  fogCloudTex: { value: null as THREE.Texture | null },
  /** x = 1 / tile size (1/m), y = coverage threshold (higher = fewer clouds), z = shadow strength 0..1, w = edge softness */
  fogCloud: { value: new THREE.Vector4(1 / 520, 0.53, 0.66, 0.06) },
  /** the field's drift (uv), advanced along the wind */
  fogCloudOff: { value: new THREE.Vector2(0, 0) },
};

/** cloud cover 0 (clear) … 1 (overcast) and shadow strength — the weather's knob (defaults ≈ 0.4, 0.66) */
export function setCloudCover(cover: number, strength = paintedAir.fogCloud.value.z): void {
  const v = paintedAir.fogCloud.value;
  v.y = 0.78 - Math.min(1, Math.max(0, cover)) * 0.62;
  v.z = strength;
}

let airInstalled = false;
/** the painted air is installed (the look's fog install ran) */
export function isPaintedAir(): boolean { return airInstalled; }

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

/** the sky dressing: no engine cloud layer and no planet (the dome paints the sky); the engine's cloud fbm drives the cloud shadows */
export const NALATI_SKY: SkyDressing = {
  clouds: false,
  planet: false,
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

/** the painterly fog chunks (aerial perspective + the cloud-shadow function the sun loop calls — see `paintedAir`) */
export function installPaintedAir(): void {
  airInstalled = true;
  addFogUniforms(paintedAir); // attachFogUniforms hands them to every fogged material from here on
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
    #ifdef USE_FOG
      uniform vec3 fogColor;
      uniform vec3 fogSunDir;
      uniform vec3 fogSunColor;
      uniform float fogHeight;
      uniform float fogHeightFalloff;
      uniform float fogHeightDensity;
      uniform float fogDistDensity;
      uniform vec4 fogAerial;
      uniform sampler2D fogCloudTex;
      uniform vec4 fogCloud;
      uniform vec2 fogCloudOff;
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
      #define P_CLOUDS 1
      // the sun's share left by the drifting cloud cover at this fragment (1 = clear sky above)
      float pCloudShadow() {
        vec2 uv = vFogWorldPos.xz * fogCloud.x + fogCloudOff;
        float c = texture2D( fogCloudTex, uv ).r * 0.72 + texture2D( fogCloudTex, uv * 2.3 + vec2( 0.37, 0.61 ) ).r * 0.28;
        return 1.0 - fogCloud.z * smoothstep( fogCloud.y - fogCloud.w, fogCloud.y + fogCloud.w, c );
      }
    #endif`;

  THREE.ShaderChunk.fog_fragment = /* glsl */`
    #ifdef USE_FOG
      {
        vec3 ray = vFogWorldPos - cameraPosition;
        float rayLen = length( ray );
        vec3 viewDir = ray / max( rayLen, 1e-3 );
        // the valley's height haze, integrated along the ray (as the default fog)
        float dy = vFogWorldPos.y - cameraPosition.y;
        float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
        float ht = fogHeightFalloff * dy;
        float integ = abs( ht ) > 1e-3 ? ( 1.0 - exp( - ht ) ) / ht : 1.0;
        float heightAmt = fogHeightDensity * camF * integ * rayLen;
        // aerial perspective: clear air for fogAerial.x m, then layered haze up to the cap (a storm lifts the cap)
        float cap = mix( fogAerial.y, 1.0, smoothstep( 0.0025, 0.012, fogDistDensity ) );
        float aer = cap * ( 1.0 - exp( - max( rayLen - fogAerial.x, 0.0 ) * fogDistDensity ) );
        float f = clamp( 1.0 - ( 1.0 - aer ) * exp( - heightAmt ), 0.0, 1.0 );
        float sunAmt = max( dot( viewDir, fogSunDir ), 0.0 );
        vec3 haze = mix( fogColor, fogSunColor * dot( fogColor, vec3( 0.3333 ) ) * 1.15, pow( sunAmt, 5.0 ) * fogAerial.w );
        // the painter's order: distance takes the saturation first, then the value dissolves into the sky
        float lum = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( lum ), min( 1.0, f * 1.6 ) * fogAerial.z );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, haze, f );
      }
    #endif`;
}
