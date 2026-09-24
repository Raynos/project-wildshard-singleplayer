/**
 * The painterly terrain's surface detail (Nalati look pass, lever 5 "ground surface"; world agent).
 *
 * The terrain mesh is a 2 m grid, so its vertex colours carry the macro painting (valley / plateau greens, gold and
 * olive patches, gravel, rock, snow — the def's `groundColor`). Everything finer comes from the painted tileable
 * textures (src/world/nalatiTextures.ts), per pixel, on top of the shared painterly lighting (`painterlyMaterial` —
 * this only patches the albedo after `color_fragment`, so the look-director's light / shade / rim stays the one ramp):
 *
 *   · meadow   painted grass detail, luminance-preserving over the macro colour (the vertex colour keeps the hue),
 *              two taps (the second at 0.37×, turned 30°) blended by a low-frequency noise so the tiling never reads
 *   · roads    the painted dirt track, laid ALONG the road (uv = across × along the nearest trail, so the painted ruts
 *              follow it), darker wheel ruts, a grassy crown, a ragged grassy verge
 *   · gravel   the painted river stones on the bars, darker and greener at the wet margin
 *   · rock     the painted granite, triplanar (XZ / XY / ZY by |normal|⁴) on the steep faces and the slab walls
 *   · snow     the painted snow above the snow line
 *
 * The per-vertex masks come in two attributes (built by Terrain.ts):
 *   surf = (signed metres across the nearest road (±9 = none), gravel 0..1, snow 0..1, rock 0..1)
 *   rdir = the nearest road's direction (unit xz)
 *
 *   applyTerrainSurface(mat, textures)   // before sky.setupMaterial; the material's program key is 'painterly-terrain'
 */
import * as THREE from 'three';
import { TEX_METRES, TEX_MEAN, isPhoneTier, type NalatiTexName } from '../world/nalatiTextures';
import { LOOK_V2 } from './look/flag';
import { V2_OLIVE_GLSL } from './look/light';
import { LOOK_BAKE_GLSL, bakeUniforms, PHONE_STATIC_OFF_CSM } from './look/bake';
import { SNOW_LINE } from '../chunks/nalatiLayout';

export type TerrainTextures = Record<'meadow' | 'path' | 'gravel' | 'rock' | 'snow', THREE.Texture>;

const VERT_PARS = /* glsl */`
attribute vec4 surf;
attribute vec2 rdir;
${LOOK_V2 ? 'attribute vec3 zone;\nvarying vec3 vZone;' : ''}
varying vec4 vSurf;
varying vec2 vRdir;
varying vec3 vTWorld;
varying vec3 vTNormal;
`;
const VERT_MAIN = /* glsl */`
#include <worldpos_vertex>
vSurf = surf;
vRdir = rdir;
${LOOK_V2 ? 'vZone = zone;' : ''}
vTWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vTNormal = normalize( mat3( modelMatrix ) * objectNormal );
`;

/**
 * look v2, the snow ring's granite: the painted rock triplanar at two scales (the big tap, stretched down the fall
 * line on the side projections, breaks a 60 m face into blocks and streaks; desktop only), vertical fractures and
 * tilted strata bands across the faces (along-face coordinate: x on the faces that look ±z, z on those that look ±x),
 * dark and cool so the snow reads against it.
 */
const CRAG_ROCK_GLSL = /* glsl */`
vec3 cragRock( vec3 p, vec3 N ) {
  vec3 w = pow( abs( N ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z );
  float s = uTexScale.w;
  vec3 r = ( texture2D( tRock, p.zy * s ).rgb * w.x + texture2D( tRock, p.xz * s ).rgb * w.y + texture2D( tRock, p.xy * s ).rgb * w.z ) / uMeanRock;
  ${isPhoneTier() ? '' : `vec2 st = vec2( 1.0, 0.45 ) * s * 0.21;
  vec3 b = texture2D( tRock, p.zy * st ).rgb * w.x + texture2D( tRock, p.xz * s * 0.21 ).rgb * w.y + texture2D( tRock, p.xy * st ).rgb * w.z;
  r *= mix( vec3( 1.0 ), b / uMeanRock, 0.6 );`}
  float u = mix( p.x, p.z, w.x / max( w.x + w.z, 1e-3 ) );
  float frac = smoothstep( 0.0, 0.07, abs( tNoise( vec2( u * 0.16, p.y * 0.018 ) ) - 0.5 ) );
  float band = tNoise( vec2( u * 0.012, p.y * 0.11 + tNoise( p.xz * 0.02 ) * 2.0 ) );
  r *= mix( 0.5, 1.0, frac ) * mix( 0.78, 1.14, band );
  return r * vec3( 0.34, 0.35, 0.39 );
}
`;

const FRAG_PARS = /* glsl */`
${LOOK_V2 ? 'varying vec3 vZone;' : ''}
varying vec4 vSurf;
varying vec2 vRdir;
varying vec3 vTWorld;
varying vec3 vTNormal;
uniform sampler2D tMeadow; uniform sampler2D tPath; uniform sampler2D tGravel; uniform sampler2D tRock; uniform sampler2D tSnow;
uniform vec3 uMeanMeadow; uniform vec3 uMeanRock;
uniform vec4 uTexScale; // 1 / metres: meadow, path, gravel, rock
uniform float uSnowScale;
float tHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float tNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( tHash( i ), tHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( tHash( i + vec2( 0.0, 1.0 ) ), tHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
// a tiled texture with its repeat broken: a second tap at 0.37× turned 30°, blended by a slow noise
vec3 tTiled( sampler2D t, vec2 p ) {
  vec3 a = texture2D( t, p ).rgb;
  vec2 q = mat2( 0.866, 0.5, -0.5, 0.866 ) * p * 0.37 + 0.31;
  vec3 b = texture2D( t, q ).rgb;
  return mix( a, b, smoothstep( 0.3, 0.7, tNoise( p * 0.21 ) ) );
}
${LOOK_V2 ? V2_OLIVE_GLSL + LOOK_BAKE_GLSL : ''}
vec3 tTriplanar( sampler2D t, vec3 p, vec3 n, float s ) {
  vec3 w = pow( abs( n ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z );
  return texture2D( t, p.zy * s ).rgb * w.x + texture2D( t, p.xz * s ).rgb * w.y + texture2D( t, p.xy * s ).rgb * w.z;
}
${LOOK_V2 ? CRAG_ROCK_GLSL : ''}
`;

/**
 * look v2: the three zones of layout v2 (src/nalati/look/zones.ts → the per-vertex `zone` weights) — the valley a lush
 * fresh green, the bowl gold, the snow ring cold: blue-grey scree on the gentle ground, granite on the steep, snowfields
 * lying in the hollows and on the flats (a slow noise), all on the painted textures. The slab's walls carry no zone.
 */
const ZONES_V2 = /* glsl */`
  {
    vec3 zw = vZone;
    float n = normalize( vTNormal ).y;
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.86, 1.1, 0.8 ), zw.x * 0.55 );     // valley: lush, fresh green
    diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 1.2, 1.02, 0.6 ), zw.y * 0.65 );      // the bowl: gold
    if ( zw.z > 0.01 ) {
      // the snow ring (the def's ringGround in the surface channels: y scree, w rock, z snow): the thin turf of the
      // vertex colour → grey scree → granite on the steep → snow, each edge broken per pixel
      float brk = tNoise( wp * 0.31 ) - 0.5;
      vec3 N = normalize( vTNormal );
      vec3 scree = tTiled( tGravel, wp * uTexScale.z * 0.6 ) * vec3( 0.84, 0.9, 1.0 );
      vec3 snow = tTiled( tSnow, wp * uSnowScale ) * vec3( 0.97, 1.0, 1.05 );
      // snow in the shade goes blue, in the sun a touch warm
      snow *= mix( vec3( 0.66, 0.77, 1.02 ), vec3( 1.03, 1.0, 0.96 ), smoothstep( -0.05, 0.45, dot( N, normalize( uPSunDir ) ) ) );
      vec3 g = mix( diffuseColor.rgb, scree, smoothstep( 0.3, 0.6, vSurf.y + brk * 0.4 ) );
      g = mix( g, cragRock( vTWorld, N ), smoothstep( 0.3, 0.6, vSurf.w + brk * 0.3 ) );
      // snow: the def's fields, and above the line the flatter facets of a face catch a dusting of their own
      float sn = max( smoothstep( 0.35, 0.6, vSurf.z + brk * 0.5 ), smoothstep( 0.8 - 0.16 * smoothstep( 65.0, 100.0, vTWorld.y ), 0.9 - 0.16 * smoothstep( 65.0, 100.0, vTWorld.y ), n ) * smoothstep( ${SNOW_LINE.toFixed(1)}, ${(SNOW_LINE + 10).toFixed(1)}, vTWorld.y + brk * 12.0 ) * 0.9 );
      g = mix( g, snow, sn );
      diffuseColor.rgb = mix( diffuseColor.rgb, g, zw.z );
    }
  }
`;

const FRAG_MAIN = /* glsl */`
#include <color_fragment>
{
  vec2 wp = vTWorld.xz;
  float ringK = ${LOOK_V2 ? 'vZone.z' : '0.0'}; // look v2 paints the snow ring itself (ZONES_V2): the generic rock / gravel / snow keep out
  float dist = length( vTWorld - cameraPosition );
  vec3 ground = diffuseColor.rgb;
  ${LOOK_V2 ? `ground = v2Olive( ground ); // look v2: the olive / golden values (src/nalati/look/light.ts)
  // look v2: the painter's big soft patches — sunlit gold-green meadows and cooler hollows, read from far and high
  ground *= mix( vec3( 0.8, 0.86, 0.92 ), vec3( 1.14, 1.08, 0.86 ), smoothstep( 0.3, 0.72, tNoise( wp * 0.021 + 3.0 ) * 0.62 + tNoise( wp * 0.057 - 1.7 ) * 0.38 ) );
  diffuseColor.rgb = ground;` : ''}

  // ── meadow: the painted grass detail over the macro colour (its hue stays the vertex colour's) ──
  vec3 meadow = tTiled( tMeadow, wp * uTexScale.x ) / uMeanMeadow;
  float detailAmt = 0.9 - 0.45 * smoothstep( 60.0, 260.0, dist );
  diffuseColor.rgb = ground * mix( vec3( 1.0 ), meadow, detailAmt );
  ground = diffuseColor.rgb;

  ${LOOK_V2 ? ZONES_V2 : ''}

  // ── rock: painted granite, triplanar, tinted by the macro colour ──
  if ( vSurf.w * ( 1.0 - ringK ) > 0.02 ) {
    vec3 rock = tTriplanar( tRock, vTWorld, normalize( vTNormal ), uTexScale.w ) / uMeanRock;
    diffuseColor.rgb = mix( diffuseColor.rgb, mix( vec3( 0.36, 0.33, 0.29 ), ground, 0.35 ) * rock, vSurf.w * ( 1.0 - ringK ) );
  }

  // ── gravel bars: the painted river stones, darker and greener where wet ──
  if ( vSurf.y * ( 1.0 - ringK ) > 0.02 ) {
    vec3 bar = tTiled( tGravel, wp * uTexScale.z ) * 1.15;
    bar = mix( bar, bar * vec3( 0.62, 0.68, 0.66 ), smoothstep( -9.2, -9.9, vTWorld.y ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, bar, vSurf.y * ( 1.0 - ringK ) );
  }

  // ── roads: the painted dirt track laid along the road, wheel ruts, a grassy crown, a ragged verge ──
  float across = abs( vSurf.x );
  if ( across < 5.5 ) {
    float rag = tNoise( wp * 0.8 ) * 0.9 + tNoise( wp * 3.0 ) * 0.35;
    float road = 1.0 - smoothstep( 2.2 + rag, 3.2 + rag, across );
    vec2 rd = normalize( vRdir + vec2( 1e-4 ) );
    vec2 ruv = vec2( vSurf.x, dot( wp, rd ) ) * uTexScale.y;
    ruv = mat2( 0.7071, 0.7071, -0.7071, 0.7071 ) * ruv;          // the painted ruts run diagonally in the tile
    vec3 dirt = texture2D( tPath, ruv ).rgb;
    float rut = smoothstep( 0.45, 0.05, abs( across - 1.05 ) );
    dirt = mix( dirt, dirt * vec3( 0.74, 0.7, 0.66 ), rut * 0.7 );
    float crown = ( 1.0 - smoothstep( 0.25, 0.55, across ) ) * smoothstep( 0.35, 0.7, tNoise( wp * 1.3 + 2.0 ) );
    dirt = mix( dirt, ground * 1.05, crown * 0.8 );
    diffuseColor.rgb = mix( diffuseColor.rgb, dirt, road );
  }

  ${LOOK_V2 ? 'diffuseColor.rgb *= bakedContact( vTWorld ); // look v2: the contact shade round the yurts / rocks / trunks (look/bake.ts)' : ''}

  // ── snow ──
  if ( vSurf.z * ( 1.0 - ringK ) > 0.02 ) {
    vec3 snow = tTiled( tSnow, wp * uSnowScale ) * 1.05;
    diffuseColor.rgb = mix( diffuseColor.rgb, snow, vSurf.z * 0.9 * ( 1.0 - ringK ) );
  }
}
`;

const mean = (n: NalatiTexName): THREE.Vector3 => new THREE.Vector3(...TEX_MEAN[n]);

/** Patch the terrain's painterly material with the painted surface detail (see the header). */
export function applyTerrainSurface(mat: THREE.Material, tex: TerrainTextures): void {
  const uniforms = {
    tMeadow: { value: tex.meadow }, tPath: { value: tex.path }, tGravel: { value: tex.gravel }, tRock: { value: tex.rock }, tSnow: { value: tex.snow },
    uMeanMeadow: { value: mean('meadow') }, uMeanRock: { value: mean('rock') },
    uTexScale: { value: new THREE.Vector4(1 / TEX_METRES.meadow, 1 / TEX_METRES.path, 1 / TEX_METRES.gravel, 1 / TEX_METRES.rock) },
    uSnowScale: { value: 1 / TEX_METRES.snow },
  };
  const base = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    if (LOOK_V2) Object.assign(shader.uniforms, bakeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <worldpos_vertex>', VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', FRAG_MAIN);
    // look v2, phone: the static casters are out of the realtime shadow map (look/bake.ts) — the key light on the
    // ground is shadowed by the bake instead (CSM still adds what moves)
    if (LOOK_V2 && PHONE_STATIC_OFF_CSM) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replaceAll('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\t\tdirectLight.color *= bakedShadow( vTWorld );')
        .replaceAll('getDirectionalLightInfo( directionalLights[0], directLight );', 'getDirectionalLightInfo( directionalLights[0], directLight );\n\t\tdirectLight.color *= bakedShadow( vTWorld );'));
    }
  };
  mat.customProgramCacheKey = () => (LOOK_V2 ? 'painterly-terrain-v2' : 'painterly-terrain');
}
