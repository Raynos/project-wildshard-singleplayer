/**
 * FROZEN for the legacy copies (pine-hollow-legacy): the live pond is dressed by its shard's graph look, and its ripple
 * map and skyline probe live in water/ripples.ts.
 *
 * The photoreal water shading Pine Hollow's pond, creek and waterfall share (PINE-HOLLOW-REMASTER PH-L9). One program
 * ('ph-water') for all three — what differs is per-vertex data and per-material uniforms — and no extra render pass:
 *
 *   · REFLECTION = the scene's environment (PineDayNight's PMREM of the clock's sky, so the water follows dawn / noon /
 *     night on its own) through MeshPhysicalMaterial's own IBL, ior 1.333 (F0 0.02). Where the reflected ray would hit the
 *     shore instead of the sky, the radiance is swapped for the forest's: on the pond an analytic SKYLINE probe (a 1-D
 *     texture round the pond's centre: per azimuth, the height and distance of the tallest thing on the horizon — the
 *     pines' crowns from `forest.trees`, the Ridge from the terrain — intersected per pixel as a cylinder, so the treeline
 *     sits where it should from anywhere on the water); on running water a plain elevation cutoff (the gully's banks).
 *     The forest's colour is its albedo under the same environment's irradiance + the sun on the crowns.
 *   · RIPPLES from the shared wind (wind.ts): three scales of one tiling normal map drift downwind, their strength and the
 *     surface's roughness follow `windGustAt` — the gust fronts visibly cross the pond. On running water the same map
 *     rides the flow: the ribbon's uv.y is TRAVEL TIME (s × 1 m/s), so the pattern scrolls downstream at one rate
 *     everywhere and stretches into streaks where the water is fast (no flow-map phase reset, no shear over time).
 *   · BODY: the depth (per vertex) gives the water's opacity (Beer–Lambert, `kAbs` per metre) and tint (peaty shallow →
 *     dark deep), so clear shallows show the bed; blended as `a = F + aBody − F·aBody` so the Fresnel reflection is never
 *     scaled away by the alpha (the colour written is (spec + body·aBody) / a, bounded because a ≥ F).
 *   · FOAM: a noise channel thresholded by a per-vertex foam amount (the dam's face, the waterfall, the plunge ring) plus a
 *     thin broken scum line at the shore; lit as a white diffuse layer by the same light.
 *   · WET LINE: vertices draped onto the bank just above the water (depth < 0) draw a dark glossy film instead.
 *
 * Vertex data: `uv` (still water: world x / z in metres; running water: across metres, travel seconds), `aWater` vec4 =
 * (depth m — < 0 the wet film, flowing 0 | 1, foam 0..1, kAbs per m — < 0 a foam-only overlay).
 * NaN guards (E67 / E91 class): every pow base clamped, every divide max()'d, the derivative tangent frame and atan fall back.
 */
import * as THREE from 'three';
import { patchWindField, windUniforms, WIND_DIR } from './wind';
import type { SkyRig as Sky } from './skyRig';
import { PATCH_ORDER, patchShader } from '../render/shaderPatches';
import { waterView } from './water/view';
import { BANK_MAX, SKY_DIST, SKY_TOP, waterTexture } from './water/ripples';


export interface WaterMaterialOptions {
  /** the pond's skyline probe (null: running water, the elevation cutoff instead) */
  skyline: { tex: THREE.Texture; x: number; z: number; level: number } | null;
  /** sin(elevation) below which a reflection sees the banks / trees when there is no skyline */
  forestSinEl?: number;
  /** × the water's alpha (the rain's puddles fade in and out, PH-L10); default 1 */
  fade?: { value: number };
}

/** the rain on the water (PH-L10, src/shards/pine-hollow/world/weather.ts): 0 … 1 rings on every water surface (pond, creek, puddles) */
export const waterWeather = { uRainRings: { value: 0 } };

export interface WaterMaterial { material: THREE.MeshPhysicalMaterial }

let blank: THREE.DataTexture | null = null;

const WX = WIND_DIR.x.toFixed(3), WZ = WIND_DIR.z.toFixed(3);

const FRAG_PARS = /* glsl */`
  uniform float uWindTime;
  uniform sampler2D uSkyline; uniform vec4 uSkyC; uniform float uForestSinEl; uniform vec3 uForestAlbedo;
  uniform vec3 uShallow; uniform vec3 uDeep; uniform float uRainRings; uniform float uFade; uniform float uTopDown;
  varying vec4 vWaterA; varying vec3 vWaterW; varying float vGust;
  /** the occluder's albedo where the reflected ray meets the shore (waterOcclusion sets it): the trees', or the bank's */
  vec3 waterShoreAlb = vec3( 0.0 );
  vec3 waterSkyAt( vec2 p ) {
    float az = atan( p.y, p.x ) * 0.1591549 + 0.5;
    return texture2D( uSkyline, vec2( az, 0.5 ) ).rgb * vec3( ${SKY_TOP.toFixed(1)}, ${SKY_DIST.toFixed(1)}, ${BANK_MAX.toFixed(2)} );
  }
  /** 0 = the reflected ray sees the sky, 1 = it hits the shore's trees / the Ridge / the gully's banks */
  float waterOcclusion( vec3 P, vec3 R ) {
    float horiz = length( R.xz );
    if ( uSkyC.w > 0.5 ) {
      vec2 o = P.xz - uSkyC.xy;
      vec2 d = horiz > 1e-4 ? R.xz / horiz : vec2( 1.0, 0.0 );
      vec3 s = waterSkyAt( d );
      float t = 0.0;
      for ( int i = 0; i < 2; i ++ ) {
        float b = dot( o, d ), c = dot( o, o ) - s.y * s.y;
        t = max( 0.0, - b + sqrt( max( b * b - c, 0.0 ) ) );
        vec2 hit = o + d * t;
        s = waterSkyAt( dot( hit, hit ) > 1e-6 ? hit : d );
      }
      float yAt = ( P.y - uSkyC.z ) + R.y / max( horiz, 1e-3 ) * t;
      // the Ridge's rock and the banks' earth mirror at their own brightness, not the pines' (E401: the grey cliff came
      // back near-black in the pond from low angles); the bins' linear filter blends the two at a crown's edge
      waterShoreAlb = max( uForestAlbedo, vec3( 1.0, 0.95, 0.88 ) * s.z );
      return smoothstep( s.x + 1.6, s.x - 1.2, yAt );
    }
    waterShoreAlb = uForestAlbedo;
    return smoothstep( uForestSinEl + 0.07, uForestSinEl - 0.07, R.y );
  }
  float waterFoamMask = 0.0;
  float waterEdgeN = 0.5;
  float waterHash( vec2 c ) { return fract( sin( dot( c, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
  /** rain rings: two offset lattices of ~0.5 m cells, each a drop at a random time and spot; the slope of the ring's wave */
  vec2 waterRainSlope( vec2 p, float T, float amt ) {
    vec2 s = vec2( 0.0 );
    for ( int k = 0; k < 2; k ++ ) {
      vec2 q = p * 2.1 + float( k ) * vec2( 0.37, 0.61 );
      vec2 cell = floor( q ), f = fract( q ) - 0.5;
      float h = waterHash( cell + float( k ) * 17.0 );
      float t = fract( T * 0.85 + h );
      vec2 d = f - ( vec2( waterHash( cell + 3.1 ), waterHash( cell + 7.7 ) ) - 0.5 ) * 0.4;
      float r = length( d ), R = t * 0.42;
      float e = ( r - R ) * 26.0;   // (no pow of a negative base: NaN on some GPUs)
      float w = exp( - e * e ) * sin( ( r - R ) * 45.0 ) * ( 1.0 - t ) * ( 1.0 - t );
      s += d / max( r, 1e-3 ) * w * step( h * 0.999, amt );
    }
    return s;
  }
`;

const NORMAL_GLSL = /* glsl */`
  {
    float flowK = vWaterA.y;
    float T = uWindTime;
    vec2 wd = vec2( ${WX}, ${WZ} );
    float gust = clamp( vGust, 0.0, 1.2 );
    // still water: three scales drift downwind; running water: all ride the flow (uv.y = travel time × 1 m/s)
    vec2 uvm = vNormalMapUv;
    vec2 sA = mix( wd * T * 0.09, vec2( 0.0, T ), flowK );
    vec2 sB = mix( vec2( -wd.y, wd.x ) * T * 0.03 + wd * T * 0.05, vec2( 0.0, T * 0.8 ), flowK );
    vec2 sC = mix( wd * T * 0.22, vec2( 0.0, T * 1.15 ), flowK );
    vec4 tA = texture2D( normalMap, ( uvm - sA ) / 4.7 );
    vec4 tB = texture2D( normalMap, ( uvm - sB ) / 11.3 + 0.37 );
    vec4 tC = texture2D( normalMap, ( uvm - sC ) / 1.63 + 0.71 );
    vec2 slope = ( tA.xy * 2.0 - 1.0 ) + ( tB.xy * 2.0 - 1.0 ) * 0.9 + ( tC.xy * 2.0 - 1.0 ) * 0.45;
    float dist = length( vWaterW - cameraPosition );
    float strength = mix( 0.025 + 0.3 * gust * gust, 0.26, flowK ) / ( 1.0 + dist * 0.012 );
    // the rings up close (past ~25 m they are sub-pixel: there the rain is a rougher surface instead, below)
    float ringNear = uRainRings * ( 1.0 - smoothstep( 4.0, 15.0, dist ) );
    vec2 rainS = ringNear > 0.0 ? waterRainSlope( vWaterW.xz, T, uRainRings ) * ( 1.0 - 0.6 * flowK ) * 0.4 * ringNear / max( uRainRings, 1e-3 ) : vec2( 0.0 );
    vec3 mapN = normalize( vec3( slope * strength + rainS, 1.0 ) );
    vec3 nN = normalize( tbn * mapN );
    // a degenerate uv frame (the ring's centre) or a NaN falls back to the geometry normal
    normal = dot( nN, nN ) > 0.5 ? nN : normal;
    // gusts roughen still water (the reflection blurs under a front); running water is always a little rough
    roughnessFactor = mix( 0.025 + 0.09 * gust, 0.08, flowK ) + uRainRings * ( 0.03 + 0.07 * smoothstep( 4.0, 15.0, dist ) );
    // foam: a noise channel thresholded by the vertex's amount, plus the shore's broken scum line on still water
    // on running water a finer, faster layer breaks the foam into streaks and clumps
    float fS = texture2D( normalMap, vec2( uvm.x / 1.1, ( uvm.y - T ) / 0.32 ) + 0.53 ).a;
    float fN = mix( tA.a * 0.6 + tC.a * 0.4, tA.a * 0.35 + tC.a * 0.25 + fS * 0.4, flowK );
    float foam = clamp( vWaterA.z, 0.0, 1.0 );
    float shore = ( 1.0 - flowK ) * smoothstep( 0.3, 0.04, vWaterA.x ) * step( 0.0, vWaterA.x ) * 0.45;
    waterFoamMask = smoothstep( 1.0 - foam, 1.0 - foam + 0.3, fN ) * step( 0.001, foam ) * 0.92 + smoothstep( 0.62, 0.8, fN ) * shore;
    waterFoamMask = clamp( waterFoamMask, 0.0, 1.0 );
    waterEdgeN = fS;
    // the water body's scatter colour: peaty in the shallows, near-black green in the deep
    diffuseColor.rgb = mix( uShallow, uDeep, smoothstep( 0.2, 3.0, vWaterA.x ) );
  }
`;

const SKYLINE_GLSL = /* glsl */`
  #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
  {
    vec3 Rw = normalize( transformDirectionByInverseViewMatrix( reflect( - geometryViewDir, geometryNormal ), viewMatrix ) );
    float occ = waterOcclusion( vWaterW, Rw );
    // the trees facing the water: lit by the same sky (irradiance from over the pond) and the sun on their crowns
    vec3 nTw = normalize( vec3( - Rw.x, 0.35, - Rw.z ) );
    vec3 nTv = normalize( ( viewMatrix * vec4( nTw, 0.0 ) ).xyz );
    vec3 forest = waterShoreAlb * getIBLIrradiance( nTv ) * RECIPROCAL_PI;
    #if NUM_DIR_LIGHTS > 0
      forest += waterShoreAlb * RECIPROCAL_PI * directionalLights[ 0 ].color * max( dot( nTv, directionalLights[ 0 ].direction ), 0.0 ) * 0.6;
    #endif
    radiance = mix( radiance, forest, occ );
  }
  #endif
`;

const COMPOSE_GLSL = /* glsl */`
  {
    float depthW = vWaterA.x, kAbs = vWaterA.w;
    float NdotV = clamp( dot( normal, geometryViewDir ), 0.0, 1.0 );
    float F = 0.02 + 0.98 * pow( clamp( 1.0 - NdotV, 0.0, 1.0 ), 5.0 );
    vec3 spec = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    // the map's top-down shot (waterView): most of the sky, as a map reads water (spec already carries the 2 % Fresnel)
    float Fm = mix( F, 0.7, uTopDown );
    spec = mix( spec, min( spec * ( Fm / max( F, 1e-3 ) ), vec3( 2.0 ) ), uTopDown );
    F = Fm;
    vec3 body = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    // the light falling on the surface (irradiance / pi): what lights the foam, a white diffuse layer
    vec3 lightIn = body / max( diffuseColor.rgb, vec3( 1e-3 ) );
    vec3 foamCol = lightIn * 0.55;
    float aBody = 1.0 - exp( - max( depthW, 0.0 ) * max( kAbs, 0.0 ) );
    float a = F + aBody - F * aBody;
    vec3 col = ( spec + body * aBody ) / max( a, 1e-3 );
    // foam over the water (straight-alpha over)
    float wf = waterFoamMask;
    float aF = wf + a * ( 1.0 - wf );
    col = ( foamCol * wf + col * a * ( 1.0 - wf ) ) / max( aF, 1e-3 );
    // the water's edge: soft on still water, ragged on running water (the fall's sides, the creek's riffles)
    a = aF * smoothstep( 0.0, 0.05, depthW - vWaterA.y * 0.1 * ( 1.0 - waterEdgeN ) );
    // a foam-only overlay (the plunge ring on the pond): no second reflection
    if ( kAbs < -0.5 ) { col = foamCol; a = wf * clamp( depthW, 0.0, 1.0 ); }
    // the wet film on the bank just above the water: darker, glossy
    if ( depthW < 0.0 ) {
      float wet = smoothstep( 0.0, -0.05, depthW ) * ( 1.0 - smoothstep( -0.4, -0.12, depthW ) );
      col = spec * 1.4; a = 0.35 * wet;
    }
    gl_FragColor = vec4( col, clamp( a * uFade, 0.0, 1.0 ) );
  }
`;

/** create a water material (the shared 'ph-water' program; `sky.setupMaterial` wires the CSM shadows) */
export function createWaterMaterial(sky: Sky, opts: WaterMaterialOptions): WaterMaterial {
  const tex = waterTexture();
  const u = {
    uSkyline: { value: opts.skyline?.tex ?? blankTexture() },
    uSkyC: { value: new THREE.Vector4(opts.skyline?.x ?? 0, opts.skyline?.z ?? 0, opts.skyline?.level ?? 0, opts.skyline ? 1 : 0) },
    uForestSinEl: { value: opts.forestSinEl ?? 0.22 },
    uForestAlbedo: { value: new THREE.Color(0.035, 0.052, 0.03) },
    uShallow: { value: new THREE.Color(0.042, 0.04, 0.02) },
    uDeep: { value: new THREE.Color(0.005, 0.01, 0.008) },
    uRainRings: waterWeather.uRainRings,
    uTopDown: waterView.uTopDown,
    uFade: opts.fade ?? { value: 1 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.04, metalness: 0, ior: 1.333, transparent: true, depthWrite: false,
    normalMap: tex, normalScale: new THREE.Vector2(1, 1),
  });
  patchShader(mat, 'engine.pond-water', PATCH_ORDER.material, (shader) => {
    patchWindField(shader);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWater;\nvarying vec4 vWaterA;\nvarying vec3 vWaterW;\nvarying float vGust;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWaterA = aWater;
        vWaterW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        vGust = windGustAt( vWaterW.xz );`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        ${FRAG_PARS}`)
      .replace('#include <normal_fragment_maps>', NORMAL_GLSL)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        ${SKYLINE_GLSL}`)
      .replace('#include <opaque_fragment>', COMPOSE_GLSL)
      // the water's surface is fogged a little less than the air (the old pond kept 65 % unfogged; the clock's fog is
      // thinner, so half)
      .replace('#include <fog_fragment>', `vec3 preFog = gl_FragColor.rgb;
        #include <fog_fragment>
        gl_FragColor.rgb = mix( preFog, gl_FragColor.rgb, 0.5 );`);
  }, { mode: 'replace', key: 'ph-water' });
  sky.setupMaterial(mat);
  return { material: mat };
}


function blankTexture(): THREE.DataTexture {
  if (blank) return blank;
  blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  return blank;
}

/** the wind clock the water scrolls on (wind.ts, advanced by Forest.update) — for callers that animate on the CPU */
export function waterTime(): number { return windUniforms.uWindTime.value; }
