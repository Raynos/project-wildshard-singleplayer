// Global atmospheric fog: exponential height fog + distance fog with sun in-scatter.
// Implemented by overriding three's fog shader chunks so *every* fogged material
// (terrain, instanced trees, glTF props, animals) gets it for free.
import * as THREE from 'three';
import { isStylized, toonUniforms } from './stylize';

export const fogUniforms = {
  fogSunDir: { value: new THREE.Vector3(0, 1, 0) },
  fogSunColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
  fogHeight: { value: -14.0 },          // metres; fog is densest below this
  fogHeightFalloff: { value: 0.12 },
  fogHeightDensity: { value: 0.005 },
  fogDistDensity: { value: 0.00045 },
};

/**
 * The painterly shard's extra air (`style: 'painterly'`, Nalati — look pass levers 1 + 3; look-director).
 *
 * Aerial perspective: the painter's distance cue. Past `fogAerial.x` metres everything first loses saturation, then
 * dissolves toward the luminous horizon haze (`fog.color`, warmed by `fogSunColor` toward the sun), in layers:
 * `fogAerial.y × (1 − e^(−d·fogDistDensity))` — so ridge after ridge steps paler and bluer, the snow range stays
 * readable. The valley's height haze (`fogHeight*`) adds on top. A storm's thick `fogDistDensity` lifts the cap to 1.
 * All uniforms, all lerpable: the day/night rig (DayNight.ts) drives `fog.color`, `fogSunColor`, `fogDistDensity`.
 *
 * Cloud shadows: the sun's light (every CSM-lit material: terrain, grass, props, spruce, creatures) is multiplied by
 * a drifting cloud-cover field sampled at the fragment's world XZ (`paintedAir.fogCloud*`, advanced by Sky.update
 * along the wind) — painted soft-edged shadows sliding over the grassland. `setCloudCover()` retunes it (weather).
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
let painted = false;

/** cloud cover 0 (clear) … 1 (overcast) and shadow strength — the weather's knob (defaults ≈ 0.4, 0.66) */
export function setCloudCover(cover: number, strength = paintedAir.fogCloud.value.z): void {
  const v = paintedAir.fogCloud.value;
  v.y = 0.78 - Math.min(1, Math.max(0, cover)) * 0.62;
  v.z = strength;
}

let installed = false;
/** `painterly` (the active chunk's `style === 'painterly'`): the painted air below replaces the default fog maths */
export function installAtmosphere(painterly = false): void {
  if (installed) return;
  installed = true;
  painted = painterly;

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
    #ifdef USE_FOG
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
    #endif`;

  THREE.ShaderChunk.fog_vertex = /* glsl */`
    #ifdef USE_FOG
      vFogDepth = - mvPosition.z;
      vec4 fogWP = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        fogWP = instanceMatrix * fogWP;
      #endif
      #ifdef USE_BATCHING
        fogWP = batchingMatrix * fogWP;
      #endif
      vFogWorldPos = ( modelMatrix * fogWP ).xyz;
    #endif`;

  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
    #ifdef USE_FOG
      uniform vec3 fogColor;
      uniform vec3 fogSunDir;
      uniform vec3 fogSunColor;
      uniform float fogHeight;
      uniform float fogHeightFalloff;
      uniform float fogHeightDensity;
      uniform float fogDistDensity;
      varying float vFogDepth;
      varying vec3 vFogWorldPos;
    #endif`;

  THREE.ShaderChunk.fog_fragment = /* glsl */`
    #ifdef USE_FOG
      {
        vec3 ray = vFogWorldPos - cameraPosition;
        float rayLen = length( ray );
        vec3 viewDir = ray / max( rayLen, 1e-3 );
        // exponential height fog integrated along the view ray (Unreal-style)
        float dy = vFogWorldPos.y - cameraPosition.y;
        float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
        float t = fogHeightFalloff * dy;
        float integ = abs( t ) > 1e-3 ? ( 1.0 - exp( - t ) ) / t : 1.0;
        float heightAmt = fogHeightDensity * camF * integ * rayLen;
        float distAmt = fogDistDensity * rayLen;
        float fogFactor = 1.0 - exp( - ( heightAmt + distAmt ) );
        fogFactor = clamp( fogFactor, 0.0, 1.0 );
        float sunAmt = max( dot( viewDir, fogSunDir ), 0.0 );
        vec3 fogCol = mix( fogColor, fogSunColor, pow( sunAmt, 6.0 ) * 0.7 );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
      }
    #endif`;

  if (painterly) installPaintedAir();

  // Inject the shared uniform objects into every material that compiles with fog.
  const proto = THREE.Material.prototype as unknown as { onBeforeCompile: (s: THREE.WebGLProgramParametersWithUniforms) => void };
  proto.onBeforeCompile = function onBeforeCompile(shader) { attachFogUniforms(shader); };
}

export function attachFogUniforms(shader: { uniforms: Record<string, THREE.IUniform> }): void {
  for (const k of Object.keys(fogUniforms) as (keyof typeof fogUniforms)[]) shader.uniforms[k] = fogUniforms[k];
  if (painted) for (const k of Object.keys(paintedAir) as (keyof typeof paintedAir)[]) shader.uniforms[k] = paintedAir[k];
  // the low-poly shard's toon lighting (stylize.ts) rides the same hook: every fogged material already calls this
  if (isStylized()) for (const k of Object.keys(toonUniforms) as (keyof typeof toonUniforms)[]) shader.uniforms[k] = toonUniforms[k];
}

/** the painterly fog chunks (aerial perspective + the cloud-shadow function the sun loop calls — see `paintedAir`) */
function installPaintedAir(): void {
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

/**
 * The cloud shadows reach every CSM-lit material through the sun loop: CSM installs its own `lights_fragment_begin`
 * (three/examples CSM.js) and Sky patches it; this multiplies each directional light's colour by `pCloudShadow()`
 * after its info is read, so the shadow-map term, the painterly cel bands and the grass relight all see it.
 * Call after the CSM exists (Sky.build). Painterly shards only.
 */
export function patchCloudShadows(): void {
  if (!painted) return;
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (chunk.includes('pCloudShadow')) return;
  const hook = (call: string): string => `${call}\n\t\t#ifdef P_CLOUDS\n\t\tdirectLight.color *= pCloudShadow();\n\t\t#endif`;
  THREE.ShaderChunk.lights_fragment_begin = chunk
    .replaceAll('getDirectionalLightInfo( directionalLight, directLight );', hook('getDirectionalLightInfo( directionalLight, directLight );'))
    .replaceAll('getDirectionalLightInfo( directionalLights[0], directLight );', hook('getDirectionalLightInfo( directionalLights[0], directLight );'));
}

/** a painterly shard's air is installed (the chunk's style decided it at boot) */
export function isPaintedAir(): boolean { return painted; }

// ─── underwater (the eye below the sea surface — Player.submerged) ───
// The same fog, retuned: no height term, a dense distance term (half the light gone by ~12 m), a deep teal-green
// colour and no orange sun in-scatter. `setUnderwater(on)` picks the target, `updateUnderwater(dt, scene.fog)` lerps
// the uniforms and the scene fog colour there over ~0.3 s; the dry values are captured on the way in and restored.
const UNDER_COLOR = new THREE.Color(0.08, 0.78, 0.9); // linear HDR: the scene's sun + sky sit near 3×, so the fog must be bright to read as turquoise, not grey
const UNDER_SUN = new THREE.Color(0.4, 1.2, 1.2);
const UNDER_DIST_DENSITY = 0.024;
const UNDER_BLEND_RATE = 1 / 0.3;
let underTarget = 0, underBlend = 0;
const dry = { color: new THREE.Color(), sun: new THREE.Color(), dist: 0, height: 0, captured: false };
const _c = new THREE.Color();

/** the eye went under (true) / came back up (false) */
export function setUnderwater(on: boolean): void { underTarget = on ? 1 : 0; }

/** every frame (Player.update does it): lerps the fog uniforms + `fog.color` toward the underwater / dry set */
export function updateUnderwater(dt: number, fog: THREE.Fog | THREE.FogExp2 | null): void {
  if (underBlend === underTarget) return;
  if (!dry.captured) {
    // the dry set is whatever the sky installed (Sky.ts); read it the first time the water asks for a change
    dry.captured = true;
    dry.sun.copy(fogUniforms.fogSunColor.value); dry.dist = fogUniforms.fogDistDensity.value; dry.height = fogUniforms.fogHeightDensity.value;
    if (fog) dry.color.copy(fog.color);
  }
  const step = Math.min(1, dt * UNDER_BLEND_RATE);
  underBlend = underTarget > underBlend ? Math.min(underTarget, underBlend + step) : Math.max(underTarget, underBlend - step);
  const t = underBlend * underBlend * (3 - 2 * underBlend);
  fogUniforms.fogSunColor.value.copy(dry.sun).lerp(UNDER_SUN, t);
  fogUniforms.fogDistDensity.value = dry.dist + (UNDER_DIST_DENSITY - dry.dist) * t;
  fogUniforms.fogHeightDensity.value = dry.height * (1 - t);
  if (fog) fog.color.copy(dry.color).lerp(_c.copy(UNDER_COLOR), t);
}
