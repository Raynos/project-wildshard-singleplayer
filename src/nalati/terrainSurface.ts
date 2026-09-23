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
import { TEX_METRES, TEX_MEAN, type NalatiTexName } from '../world/nalatiTextures';
import { LOOK_V2 } from './look/flag';
import { V2_OLIVE_GLSL } from './look/light';
import { LOOK_BAKE_GLSL, bakeUniforms } from './look/bake';

export type TerrainTextures = Record<'meadow' | 'path' | 'gravel' | 'rock' | 'snow', THREE.Texture>;

const VERT_PARS = /* glsl */`
attribute vec4 surf;
attribute vec2 rdir;
varying vec4 vSurf;
varying vec2 vRdir;
varying vec3 vTWorld;
varying vec3 vTNormal;
`;
const VERT_MAIN = /* glsl */`
#include <worldpos_vertex>
vSurf = surf;
vRdir = rdir;
vTWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vTNormal = normalize( mat3( modelMatrix ) * objectNormal );
`;

const FRAG_PARS = /* glsl */`
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
`;

const FRAG_MAIN = /* glsl */`
#include <color_fragment>
{
  vec2 wp = vTWorld.xz;
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

  // ── rock: painted granite, triplanar, tinted by the macro colour ──
  if ( vSurf.w > 0.02 ) {
    vec3 rock = tTriplanar( tRock, vTWorld, normalize( vTNormal ), uTexScale.w ) / uMeanRock;
    diffuseColor.rgb = mix( diffuseColor.rgb, mix( vec3( 0.36, 0.33, 0.29 ), ground, 0.35 ) * rock, vSurf.w );
  }

  // ── gravel bars: the painted river stones, darker and greener where wet ──
  if ( vSurf.y > 0.02 ) {
    vec3 bar = tTiled( tGravel, wp * uTexScale.z ) * 1.15;
    bar = mix( bar, bar * vec3( 0.62, 0.68, 0.66 ), smoothstep( -9.2, -9.9, vTWorld.y ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, bar, vSurf.y );
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
  if ( vSurf.z > 0.02 ) {
    vec3 snow = tTiled( tSnow, wp * uSnowScale ) * 1.05;
    diffuseColor.rgb = mix( diffuseColor.rgb, snow, vSurf.z * 0.9 );
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
  };
  mat.customProgramCacheKey = () => (LOOK_V2 ? 'painterly-terrain-v2' : 'painterly-terrain');
}
