/**
 * Painterly material — the one lit material every `style: 'painterly'` mesh shares (Nalati Grasslands, style B).
 *
 *   import { painterlyMaterial, updatePainterly, setPainterlyLook } from '../world/painterly';
 *
 *   const mat = painterlyMaterial(sky, { color: '#c9b48a' });                  // plain colour
 *   const mat = painterlyMaterial(sky, { vertexColors: true, rim: 0.6 });      // geometry's `color` attribute
 *   const mat = painterlyMaterial(sky, { color: '#3f6b3a', sway: 0.02 });      // spruce: sways in the wind
 *   new THREE.Mesh(geo, mat);  new THREE.InstancedMesh(geo, mat, n);
 *
 * What it looks like (the style-B mockup): soft cel shading — the sun term goes through 2–3 soft bands instead of
 * a smooth Lambert falloff — shadows painted a cool sky tint instead of going black, and a warm rim light on the
 * silhouette (stronger when the surface is back-lit). No textures, no specular: colour comes from `color` ×
 * the geometry's per-vertex `color` attribute (× `instanceColor` on an InstancedMesh).
 *
 * ONE PROGRAM. Everything that differs between painterly materials is a per-material *uniform* (colour, rim,
 * bands, sway, emissive, opacity), and the program cache key is the constant `'painterly'` (+ Sky's `|csm`), so
 * every creature, yurt, rock and prop shares one compiled shader (a phone-perf rule: every extra program is a
 * ~150 ms Metal compile on the iPhone and a state switch per frame). To keep it that way:
 *   - vertex colours are ALWAYS on. A geometry without a `color` attribute gets a white one added the first time it
 *     is drawn with a painterly material (so `{ color }` alone works); paint per-vertex colour if you want variation.
 *   - three still forks a sibling program for things that are compile-time in three itself: InstancedMesh
 *     (USE_INSTANCING), `instanceColor` (USE_INSTANCING_COLOR), `side: DoubleSide`, `alphaTest > 0`, skinning,
 *     morph targets. Use them when you need them, but prefer the plain set (FrontSide, no alphaTest).
 *   - do NOT add your own `onBeforeCompile` / defines to a painterly material — that is a new program. If you need
 *     a new effect for many meshes, add it here behind a per-material uniform (the way `sway` is).
 *
 * API
 *   painterlyMaterial(sky, opts)  → THREE.MeshLambertMaterial (lit by the sun's CSM shadows + the hemisphere light,
 *                                    fogged by Atmosphere.ts, already passed through `sky.setupMaterial`). `sky = null`
 *                                    only where the caller passes it through `sky.setupMaterial` itself (the terrain,
 *                                    built before the sky is handed around; bootstrap does it). Options:
 *       color          base colour (default white; multiplies the vertex / instance colours)
 *       vertexColors   accepted for readability — vertex colours are always on (see above)
 *       rim            rim-light strength, 0 = none … 1 = strong (default 0.35)
 *       bands          cel strength, 0 = plain Lambert … 1 = full 3-band cel (default 0.8; terrain uses less)
 *       shade          how much of the painted shadow tint this surface takes, 0…1 (default 1)
 *       sway           wind sway in metres per (local metre above the origin)² — foliage / flags (default 0); leans
 *                      downwind in world space whatever the instance's rotation (Mesh / InstancedMesh / BatchedMesh)
 *       emissive       self-light colour (default black) — a lantern, embers
 *       map            a base-colour texture (sRGB) × colour × vertex colours — the generated GLB models' atlases
 *                      (src/world/nalati/glbPaint.ts). three forks a USE_MAP sibling program, shared by every mapped one
 *       side / transparent / opacity / depthWrite / alphaTest   passed through to the material
 *   syncPainterlySun(sky)         copy the sun's colour × intensity and direction into the shared uniforms
 *   updatePainterly(dt)           advance the shared sway clock (the shard's update hook calls it once a frame)
 *   setPainterlyLook(look)        the shard-wide look: shadow tint, rim colour, wind strength (all shared uniforms)
 *   painterlyUniforms.uPWarm / uPFloor   the warm terminator band, and the painted floor that keeps dark paint off black
 *   painterlyUniforms.uPWet       wetness 0..1 (the weather drives it): darker, glossier paint on what faces the sky; grass too
 *   painterlyUniforms             the shared uniform objects (read-only use: other shaders — grass — may sample the
 *                                 same shadow tint / rim colour / clock so they match)
 *
 * Shadows: meshes still need `castShadow` / `receiveShadow` set by the caller as usual. The shadow-depth pass does
 * not sway (a sub-metre sway reads fine without it).
 */
import * as THREE from 'three';
import { attachFogUniforms } from './Atmosphere';
import type { Sky } from './Sky';

export interface PainterlyOpts {
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  rim?: number;
  bands?: number;
  shade?: number;
  sway?: number;
  emissive?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  alphaTest?: number;
}

export interface PainterlyLook {
  /** the colour painted into the shadow side (linear RGB, added × albedo where the sun doesn't reach) */
  shadeTint?: THREE.ColorRepresentation;
  /** rim light colour (linear, HDR allowed) */
  rimColor?: THREE.ColorRepresentation;
  /** world wind direction (x, z) and strength multiplier for `sway` */
  wind?: { x: number; z: number; strength: number };
}

/** Shared by every painterly material (one object per uniform — assigning into `.value` updates them all). */
export const painterlyUniforms = {
  /** the sun's unshadowed colour × intensity: lets the shader separate the shadow-map term from the light colour */
  uPSunRef: { value: new THREE.Color(3, 3, 3) },
  /** world-space direction TO the sun */
  uPSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
  uPShade: { value: new THREE.Color(0.1, 0.14, 0.3) },
  uPRimColor: { value: new THREE.Color(1.4, 1.2, 0.9) },
  uPTime: { value: 0 },
  /** xy = wind direction (x, z), z = strength */
  uPWind: { value: new THREE.Vector3(0.8, 0.6, 1) },
  /** the painted ramp's temperature: the band just past the terminator warms and saturates (a painter's warm edge), 0 = off */
  uPWarm: { value: 0.8 },
  /**
   * the painted floor: dark albedo channels are lifted toward 0.22 by the shade tint × this, everywhere the surface is lit
   * indirectly — a black horse, dark felt, the bow grip read as deep blue-violet in shade, never black (the mockups
   * never go near-black). Scales with `uPShade`, so night (a dim shade tint) keeps its darks. 0 = off.
   */
  uPFloor: { value: 3.0 },
  /**
   * wetness 0 (dry) … 1 (soaked) — the weather drives it (rain → up, the after-storm sun dries it). Up-facing paint
   * darkens and takes a glossy sun glint + a sky sheen; the painterly grass (GrassPainterly.ts) reads the same uniform.
   */
  uPWet: { value: 0 },
};

// live tuning / the parity harness: `window.__painterly.uPWet.value = 1`
if (typeof window !== 'undefined') Object.assign(window, { __painterly: painterlyUniforms });

/** Advance the shared clock that drives `sway`. */
export function updatePainterly(dt: number): void { painterlyUniforms.uPTime.value += dt; }

export function setPainterlyLook(look: PainterlyLook): void {
  if (look.shadeTint !== undefined) painterlyUniforms.uPShade.value.set(look.shadeTint);
  if (look.rimColor !== undefined) painterlyUniforms.uPRimColor.value.set(look.rimColor);
  if (look.wind) {
    const l = Math.hypot(look.wind.x, look.wind.z) || 1;
    painterlyUniforms.uPWind.value.set(look.wind.x / l, look.wind.z / l, look.wind.strength);
  }
}

/**
 * Read the sun off the sky rig into the shared uniforms (CSM lights all share the sun's colour and intensity).
 * `painterlyMaterial(sky, …)` does it; call it yourself after building materials with `sky = null`.
 */
export function syncPainterlySun(sky: Sky): void {
  const l = sky.csm.lights[0];
  if (l) painterlyUniforms.uPSunRef.value.copy(l.color).multiplyScalar(l.intensity);
  painterlyUniforms.uPSunDir.value.copy(sky.sunDir).normalize();
}

const VERT_PARS = /* glsl */`
uniform float uPSway;
uniform float uPTime;
uniform vec3 uPWind;
`;

const VERT_SWAY = /* glsl */`
#include <begin_vertex>
if ( uPSway > 0.0 ) {
  mat4 pM = modelMatrix;
  #ifdef USE_INSTANCING
    pM = pM * instanceMatrix;
  #endif
  #ifdef USE_BATCHING
    pM = pM * batchingMatrix;
  #endif
  vec3 pW = pM[ 3 ].xyz;                                   // the object's / instance's origin: its own sway phase
  float pPh = uPTime * 1.6 + pW.x * 0.13 + pW.z * 0.11;
  float pH = max( position.y, 0.0 );
  float pAmt = uPSway * uPWind.z * pH * pH * ( 0.65 + 0.35 * sin( pPh ) ) + uPSway * uPWind.z * pH * pH * 0.25 * sin( pPh * 2.3 + 1.7 );
  // the world wind direction in this object's model space (rotation + uniform scale undone), so every instance leans downwind
  vec3 pDir = transpose( mat3( pM ) ) * vec3( uPWind.x, 0.0, uPWind.y );
  pDir /= max( dot( pDir, pDir ), 1e-6 );
  transformed += pDir * pAmt;
}
`;

const FRAG_PARS = /* glsl */`
varying vec3 vViewPosition;
uniform vec3 uPSunRef;
uniform vec3 uPSunDir;
uniform vec3 uPShade;
uniform vec3 uPRimColor;
uniform float uPWarm;
uniform float uPFloor;
uniform float uPWet;
uniform float uPRim;
uniform float uPBands;
uniform float uPShadeAmt;
uniform float uPFloorAmt;

struct LambertMaterial {
  vec3 diffuseColor;
  float specularStrength;
};

// how wet this surface is: the weather's wetness, mostly on what faces the sky
float pWetAt( vec3 nView ) {
  if ( uPWet <= 0.0 ) return 0.0;
  vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  return uPWet * ( 0.3 + 0.7 * smoothstep( 0.1, 0.75, dot( nView, upV ) ) );
}

// the painted light ramp: a dark band, a mid band and the lit band with soft edges, blended with plain Lambert by uPBands
float pCel( float x ) {
  float c = 0.52 * smoothstep( 0.03, 0.13, x ) + 0.48 * smoothstep( 0.34, 0.5, x );
  return mix( x, c, uPBands );
}

void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
  // only the sun is painted: any other light (the gate lamps, a campfire) is plain Lambert and paints no shade
  vec3 pSunV = normalize( ( viewMatrix * vec4( uPSunDir, 0.0 ) ).xyz );
  if ( dot( directLight.direction, pSunV ) < 0.999 ) {
    reflectedLight.directDiffuse += dotNL * directLight.color * BRDF_Lambert( material.diffuseColor );
    return;
  }
  // shadow-map visibility: the light's colour arrives already multiplied by it (CSM); the sun's unshadowed colour is known
  float ref = max( dot( uPSunRef, vec3( 1.0 ) ), 1e-4 );
  float vis = clamp( dot( directLight.color, vec3( 1.0 ) ) / ref, 0.0, 1.0 );
  vec3 lightCol = directLight.color / max( vis, 1e-3 );
  float l = pCel( dotNL * vis );
  // lit side gets the light; the shade side is painted with the sky tint instead of going to black
  vec3 irradiance = lightCol * l + uPShade * ( 1.0 - l ) * uPShadeAmt;
  // the warm edge: where the light turns into the shade the paint runs warmer and richer (the terminator band)
  float pTerm = smoothstep( 0.02, 0.2, l ) * ( 1.0 - smoothstep( 0.45, 0.85, l ) );
  // (only a warm key paints a warm edge: the moon's blue light does not)
  float pWarmKey = clamp( ( uPSunRef.r - uPSunRef.b ) / max( uPSunRef.r, 1e-3 ) * 4.0, 0.0, 1.0 );
  irradiance *= mix( vec3( 1.0 ), vec3( 1.16, 0.98, 0.8 ), pTerm * uPWarm * pWarmKey );
  float pWet = pWetAt( geometryNormal );
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor * ( 1.0 - 0.38 * pWet ) );
  // wet: a soft glossy glint of the key light (not tinted by the paint)
  if ( pWet > 0.0 ) {
    vec3 pH = normalize( directLight.direction + geometryViewDir );
    reflectedLight.directDiffuse += lightCol * vis * pow( saturate( dot( geometryNormal, pH ) ), 120.0 ) * pWet * 0.6;
  }
}

void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
  float pWet = pWetAt( geometryNormal );
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor * ( 1.0 - 0.38 * pWet ) );
  // wet: the sky's sheen at grazing angles
  reflectedLight.indirectDiffuse += irradiance * pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 5.0 ) * pWet * 0.07;
  // the painted floor (see uPFloor): only the channels darker than 0.22 gain, so bright paint is untouched
  reflectedLight.indirectDiffuse += uPShade * uPFloor * uPFloorAmt * BRDF_Lambert( max( vec3( 0.22 ) - material.diffuseColor, vec3( 0.0 ) ) );
}

#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert
`;

const FRAG_RIM = /* glsl */`
#include <aomap_fragment>
if ( uPRim > 0.0 ) {
  vec3 pN = normalize( normal );
  vec3 pV = normalize( vViewPosition );
  float pFres = pow( 1.0 - saturate( dot( pN, pV ) ), 3.0 );
  vec3 pSunV = normalize( ( viewMatrix * vec4( uPSunDir, 0.0 ) ).xyz );
  float pBack = saturate( dot( -pV, pSunV ) );                  // looking toward the sun: the edge glows
  float pSide = saturate( dot( pN, pSunV ) * 0.5 + 0.5 );       // and it stays on the sun's side of the silhouette
  float pRim = smoothstep( 0.25, 0.75, pFres ) * ( 0.35 + 0.65 * pBack ) * pSide * uPRim;
  totalEmissiveRadiance += uPRimColor * mix( diffuseColor.rgb, vec3( 1.0 ), 0.5 ) * pRim;
}
`;

const _white = new WeakMap<THREE.BufferGeometry, true>();
/** a geometry drawn with a painterly material must carry `color` (vertex colours are always on): add a white one */
function ensureColor(geo: THREE.BufferGeometry): void {
  if (_white.has(geo)) return;
  _white.set(geo, true);
  if (geo.hasAttribute('color')) return;
  const pos = geo.getAttribute('position');
  const white = new Uint8Array(pos.count * 3).fill(255);
  geo.setAttribute('color', new THREE.BufferAttribute(white, 3, true));
}

/** a painterly material's own knobs (typed): the uniforms that differ per material */
export interface PainterlyKnobs { uPRim: { value: number }; uPBands: { value: number }; uPShadeAmt: { value: number }; uPSway: { value: number }; uPFloorAmt: { value: number } }
const knobs = new WeakMap<THREE.Material, PainterlyKnobs>();
export function painterlyKnobs(mat: THREE.Material): PainterlyKnobs | undefined { return knobs.get(mat); }

/** The shared painterly lit material (see the file header). */
export function painterlyMaterial(sky: Sky | null, opts: PainterlyOpts = {}): THREE.MeshLambertMaterial {
  if (sky) syncPainterlySun(sky);
  const mat = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xffffff,
    vertexColors: true,
    emissive: opts.emissive ?? 0x000000,
    map: opts.map ?? null,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    depthWrite: opts.depthWrite ?? true,
    alphaTest: opts.alphaTest ?? 0,
  });
  const own = {
    uPRim: { value: opts.rim ?? 0.35 },
    uPBands: { value: opts.bands ?? 0.8 },
    uPShadeAmt: { value: opts.shade ?? 1 },
    uPSway: { value: opts.sway ?? 0 },
    /** this material's share of the painted floor (uPFloor): 1, less on the generated models under the Look Lab's model shading */
    uPFloorAmt: { value: 1 },
  };
  mat.userData['painterly'] = own; // per-material knobs: `mat.userData.painterly.uPRim.value = …` retunes live
  knobs.set(mat, own);
  mat.onBeforeCompile = (shader) => {
    attachFogUniforms(shader);
    Object.assign(shader.uniforms, own, painterlyUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', VERT_SWAY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_lambert_pars_fragment>', FRAG_PARS)
      .replace('#include <aomap_fragment>', FRAG_RIM)
      .replace('#include <envmap_fragment>', ''); // no sky reflection: the painted look is diffuse only
  };
  mat.customProgramCacheKey = () => 'painterly';
  mat.onBeforeRender = (_r, _s, _c, geometry) => { ensureColor(geometry); };
  sky?.setupMaterial(mat);
  return mat;
}

/** The colour setter shared by the painterly modules: paint a whole geometry one colour (× jitter per vertex, seeded). */
export function paintGeometry(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0, seed = 1): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const out = new Float32Array(n * 3);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const k = 1 - jitter + (s / 4294967296) * jitter * 2;
    out[i * 3] = c.r * k; out[i * 3 + 1] = c.g * k; out[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  _white.set(geo, true);
  return geo;
}
