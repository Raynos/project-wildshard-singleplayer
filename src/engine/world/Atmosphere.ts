// Global atmospheric fog: exponential height fog + distance fog with sun in-scatter.
// Implemented by overriding three's fog shader chunks so *every* fogged material
// (terrain, instanced trees, glTF props, animals) gets it for free.
import * as THREE from 'three';
import { setInheritedPatch } from '../render/shaderPatches';
import { FOG_SLOT, installFogPatch } from '../render/fogPatches';

export const fogUniforms = {
  fogSunDir: { value: new THREE.Vector3(0, 1, 0) },
  fogSunColor: { value: new THREE.Color(1.0, 0.72, 0.42) },
  fogHeight: { value: -14.0 },          // metres; fog is densest below this
  fogHeightFalloff: { value: 0.12 },
  fogHeightDensity: { value: 0.005 },
  fogDistDensity: { value: 0.00045 },
  /**
   * The slab's edge dissolving into the horizon's haze (Pine Hollow PH-L5, after Nalati N19's method): x = strength (0 =
   * off, the other shards), y / z = where it starts / is full (m from the slab centre, the larger of
   * |x| |z|), w = how far below the eye the ground must lie for it (looking down over the edge from the lookout, not along
   * the ground). Compiled into the fog chunk on Pine Hollow only, so no other shard's program source changes.
   */
  fogEdge: { value: new THREE.Vector4(0, 236, 252, 10) },
};

/**
 * Pine Hollow's weather (PH-L10, src/shards/pine-hollow/world/weather.ts drives them), compiled into Pine Hollow's shaders only — every
 * other shard's program source stays byte-for-byte:
 *   uWet        0 dry … 1 soaked: every lit PBR surface (MeshStandard / Physical, the terrain's splat) darkens where it is
 *               porous and turns glossy, up-facing surfaces most (appended to `normal_fragment_begin`, which every
 *               standard program includes and none of the shard's custom materials replace; the water overrides it after)
 *   fogBlob     a local fog bank (xyz, radius) of strength fogBlobAmt: the dawn fog closing round the Ghost Stag (PH-C7)
 */
export const weatherUniforms = {
  uWet: { value: 0 },
  fogBlob: { value: new THREE.Vector4(0, -1e4, 0, 1) },
  fogBlobAmt: { value: 0 },
};
let pineWeather = false;

/**
 * Weather fog (E390, a storm closing in): a second exponential fog laid over the level's own, `fogWeather` = (distance
 * density, height density, strength 0..1, unused) in `fogWeatherColor`. It composes with whatever else drives the fog (a
 * backdrop's clock, the underwater blend), since it never writes their uniforms. Compiled only into a level that sets
 * `atmosphere.weather`, so every other level's program source stays byte-for-byte. Drive it with `weatherFog()`.
 */
export const weatherFogUniforms = {
  fogWeather: { value: new THREE.Vector4(0, 0, 0, 0) },
  fogWeatherColor: { value: new THREE.Color(1, 1, 1) },
};
let weatherFogOn = false;
let edgeHazeOn = false;

/** which optional terms the installed fog chunk compiled in (the TSL back-end's fog, render/nodes/engineFog.ts, follows) */
export function atmosphereTerms(): { edgeHaze: boolean; weather: boolean; wetSurfaces: boolean } {
  return { edgeHaze: edgeHazeOn, weather: weatherFogOn, wetSurfaces: pineWeather };
}

export interface WeatherFogSpec {
  /** distance density per metre at full strength (exponential: about 3 / dist m is where far things are gone) */
  dist: number;
  /** height-fog density at full strength, on the level's own height falloff; omitted = 0 */
  height?: number;
  /** the fog's colour (sRGB hex or a THREE colour) */
  color: THREE.ColorRepresentation;
}
export interface WeatherFog { set: (strength: number) => void }

/**
 * A level's weather fog: `set(strength)` (0 = clear … 1 = the spec) every time it changes; the level eases it. The fog
 * clears when `scope` is disposed. Needs `atmosphere.weather: true` in the level (the shader term is compiled only then).
 */
export function weatherFog(scope: { onDispose: (fn: () => void) => void }, spec: WeatherFogSpec): WeatherFog {
  if (!weatherFogOn) throw new Error('weatherFog: this level has no weather fog (set atmosphere.weather: true)');
  const u = weatherFogUniforms;
  u.fogWeatherColor.value.set(spec.color);
  u.fogWeather.value.set(spec.dist, spec.height ?? 0, 0, 0);
  scope.onDispose(() => { u.fogWeather.value.z = 0; });
  return { set: (strength) => { u.fogWeather.value.set(spec.dist, spec.height ?? 0, Math.min(1, Math.max(0, strength)), 0); } };
}
/**
 * The volumetric shafts' own height fog (core/Volumetrics.ts reads it before `fogUniforms`): null = follow the geometry
 * fog. Pine Hollow's dawn fog (PH-L10) lifts the geometry fog's floor into the bowl, which the march — tuned for a thin
 * haze — would turn into a white-out; the weather keeps the march on the clear-sky floor.
 */
export const volumetricFog: { height: number | null; falloff: number | null } = { height: null, falloff: null };

/**
 * A level's own fog uniforms (its `LookStrategy.fog` install adds them): `attachFogUniforms` hands
 * every set to every fogged material, by reference (a set filled in later still reaches the programs compiled after).
 */
const fogExtras: Record<string, THREE.IUniform>[] = [];
export function addFogUniforms(set: Record<string, THREE.IUniform>): void { if (!fogExtras.includes(set)) fogExtras.push(set); }

/** the engine's fog chunks (slot 100, once a page: render/fogPatches.ts); a level's own fog (`LookStrategy.fog`) is installed after it (Game.buildSky) */
export function installAtmosphere(policy: { edgeHaze?: boolean; wetSurfaces?: boolean; weather?: boolean } = {}): void {
  installFogPatch('engine.fog', FOG_SLOT.engine, () => { writeAtmosphere(policy); });
}

function writeAtmosphere(policy: { edgeHaze?: boolean; wetSurfaces?: boolean; weather?: boolean }): void {
  const weather = policy.weather === true;
  weatherFogOn = weather;
  // Pine Hollow's slab edge haze (fogEdge): only its fog chunk carries it, every other shard's source stays byte-for-byte
  const edge = policy.edgeHaze === true;
  edgeHazeOn = edge;
  pineWeather = policy.wetSurfaces === true;

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
      uniform float fogDistDensity;${edge ? '\n      uniform vec4 fogEdge;\n      uniform vec4 fogBlob;\n      uniform float fogBlobAmt;' : ''}${weather ? '\n      uniform vec4 fogWeather;\n      uniform vec3 fogWeatherColor;' : ''}
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
        fogFactor = clamp( fogFactor, 0.0, 1.0 );${edge ? `
        // the slab's last metres thicken into the painted horizon's haze, seen from above (PH-L5)
        float edgeD = max( abs( vFogWorldPos.x ), abs( vFogWorldPos.z ) );
        float fogE = fogEdge.x * smoothstep( fogEdge.y, fogEdge.z, edgeD ) * smoothstep( fogEdge.w, fogEdge.w * 4.0, cameraPosition.y - vFogWorldPos.y );
        fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - fogE );
        // the Ghost Stag's fog bank (PH-C7): thick round it, thin up close (you can walk into it and see)
        float fogB = fogBlobAmt * ( 1.0 - smoothstep( 0.1, 1.0, length( vFogWorldPos - fogBlob.xyz ) / fogBlob.w ) ) * smoothstep( 5.0, 24.0, rayLen );
        fogFactor = 1.0 - ( 1.0 - fogFactor ) * ( 1.0 - fogB );` : ''}
        float sunAmt = max( dot( viewDir, fogSunDir ), 0.0 );
        vec3 fogCol = mix( fogColor, fogSunColor, pow( sunAmt, 6.0 ) * 0.7 );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );${weather ? `
        // the weather fog (E390), over the level's own fog
        float wAmt = ( fogWeather.x + fogWeather.y * camF * integ ) * rayLen;
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogWeatherColor, clamp( ( 1.0 - exp( - wAmt ) ) * fogWeather.z, 0.0, 1.0 ) );` : ''}
      }
    #endif`;

  if (edge) {
    // the rain's wet PBR (PH-L10): after the geometry normal exists, before the normal map and the lighting read the surface
    THREE.ShaderChunk.normal_fragment_begin = `${THREE.ShaderChunk.normal_fragment_begin}
      #if defined( STANDARD ) && defined( USE_FOG )
      {
        float wetUp = ( vec4( normal, 0.0 ) * viewMatrix ).y;   // the face's world up-ness (view → world: the transpose)
        float wetK = uWet * mix( 0.4, 1.0, smoothstep( -0.3, 0.6, wetUp ) ) * ( 1.0 - metalnessFactor );
        diffuseColor.rgb *= 1.0 - 0.42 * wetK * smoothstep( 0.3, 0.85, roughnessFactor );
        roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.5 + 0.12, wetK );
      }
      #endif`;
    THREE.ShaderChunk.fog_pars_fragment += /* glsl */`
    #if defined( STANDARD ) && defined( USE_FOG )
      uniform float uWet;
    #endif`;
  }

  // Inject the shared uniform objects into every material that compiles with fog.
  setInheritedPatch((shader) => { attachFogUniforms(shader); });
}

export function attachFogUniforms(shader: { uniforms: Record<string, THREE.IUniform> }): void {
  for (const k of Object.keys(fogUniforms) as (keyof typeof fogUniforms)[]) shader.uniforms[k] = fogUniforms[k];
  if (pineWeather) for (const k of Object.keys(weatherUniforms) as (keyof typeof weatherUniforms)[]) shader.uniforms[k] = weatherUniforms[k];
  if (weatherFogOn) for (const k of Object.keys(weatherFogUniforms) as (keyof typeof weatherFogUniforms)[]) shader.uniforms[k] = weatherFogUniforms[k];
  for (const set of fogExtras) for (const k of Object.keys(set)) { const u = set[k]; if (u !== undefined) shader.uniforms[k] = u; }
}

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
/** is the eye under? (Pine Hollow's clock reads it: PineDayNight keeps the underwater fog while diving) */
export function isUnderwater(): boolean { return underTarget === 1; }

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
