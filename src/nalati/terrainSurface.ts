/**
 * The painterly terrain's surface detail (Nalati look pass, lever 5 "ground surface"; world agent).
 *
 * The terrain mesh is a 2 m grid, so its vertex colours carry the macro painting (valley / plateau greens, gold and
 * olive patches, gravel, rock, snow — the def's `groundColor`). Everything finer is drawn here, per pixel, on top of
 * the shared painterly lighting (`painterlyMaterial` — this only patches the albedo after `color_fragment`, so the
 * look-director's light / shade / rim stays the one ramp):
 *
 *   · brush grain   two octaves of value noise, so no green is ever a flat sheet
 *   · roads         worn dirt: two wheel ruts, a grassy crown, stones along the edges, a ragged grassy verge
 *   · gravel bars   rounded pebbles (a voronoi) in greys and tans with dark gaps, wet and darker near the water
 *   · rock          strata bands and lichen spots on the steep faces
 *   · snow          a cool blue in the dips, bright on the crests
 *
 * The per-vertex masks come in one `surf` attribute (built by Terrain.ts):
 *   x = signed metres across the nearest road (±9 = none), y = gravel 0..1, z = snow 0..1, w = rock 0..1
 *
 *   applyTerrainSurface(mat)   // before sky.setupMaterial; the material gets its own program key 'painterly-terrain'
 */
import type * as THREE from 'three';

const VERT_PARS = /* glsl */`
attribute vec4 surf;
varying vec4 vSurf;
varying vec3 vTWorld;
`;
const VERT_MAIN = /* glsl */`
#include <worldpos_vertex>
vSurf = surf;
vTWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
`;

const FRAG_PARS = /* glsl */`
varying vec4 vSurf;
varying vec3 vTWorld;
float tHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float tNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( tHash( i ), tHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( tHash( i + vec2( 0.0, 1.0 ) ), tHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
// pebbles: x = distance to the cell's edge (0 at a gap), y = the cell's id hash
vec2 tPebbles( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for ( int y = -1; y <= 1; y++ ) for ( int x = -1; x <= 1; x++ ) {
    vec2 g = vec2( float( x ), float( y ) );
    float h = tHash( i + g );
    vec2 o = g + 0.5 + 0.38 * vec2( sin( h * 6.2831 ), cos( h * 4.1 ) ) - f;
    float d = dot( o, o );
    if ( d < d1 ) { d2 = d1; d1 = d; id = h; } else if ( d < d2 ) { d2 = d; }
  }
  return vec2( sqrt( d2 ) - sqrt( d1 ), id );
}
`;

const FRAG_MAIN = /* glsl */`
#include <color_fragment>
{
  vec2 wp = vTWorld.xz;
  float grain = tNoise( wp * 1.1 ) * 0.55 + tNoise( wp * 3.7 + 17.0 ) * 0.45;
  diffuseColor.rgb *= 0.88 + 0.24 * grain;
  vec3 ground = diffuseColor.rgb;

  // ── rock: strata + lichen ──
  if ( vSurf.w > 0.02 ) {
    float strata = 0.84 + 0.2 * sin( vTWorld.y * 2.1 + tNoise( wp * 0.35 ) * 4.0 ) * ( 0.6 + 0.4 * tNoise( wp * 1.7 ) );
    float lichen = smoothstep( 0.62, 0.8, tNoise( wp * 0.9 + vTWorld.y * 0.3 ) ) * 0.6;
    vec3 rock = ground * strata;
    rock = mix( rock, vec3( 0.42, 0.4, 0.16 ), lichen * ( 1.0 - vSurf.z ) );
    diffuseColor.rgb = mix( ground, rock, vSurf.w );
  }

  // ── gravel bars: rounded pebbles ──
  if ( vSurf.y > 0.02 ) {
    vec2 pb = tPebbles( wp * 3.2 );
    vec2 pb2 = tPebbles( wp * 7.5 + 3.1 );
    float h1 = pb.y, h2 = fract( pb.y * 7.13 );
    vec3 stone = mix( vec3( 0.46, 0.45, 0.42 ), vec3( 0.58, 0.5, 0.38 ), h1 );
    stone = mix( stone, vec3( 0.32, 0.33, 0.34 ), step( 0.8, h2 ) * 0.7 );
    stone *= 0.8 + 0.3 * h2;
    float gap = smoothstep( 0.02, 0.16, pb.x );
    float small = smoothstep( 0.03, 0.14, pb2.x );
    vec3 bar = mix( vec3( 0.2, 0.19, 0.17 ), stone, gap ) * mix( 0.8, 1.0, small );
    // the wet margin by the water: darker, a touch of green algae
    bar = mix( bar, bar * vec3( 0.62, 0.68, 0.64 ), smoothstep( -9.2, -9.9, vTWorld.y ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, bar, vSurf.y );
  }

  // ── roads: worn dirt, two ruts, a grassy crown, stones at the edges, a ragged verge ──
  float across = abs( vSurf.x );
  if ( across < 5.5 ) {
    float rag = tNoise( wp * 0.8 ) * 0.9 + tNoise( wp * 3.0 ) * 0.35;
    float road = 1.0 - smoothstep( 2.3 + rag, 3.1 + rag, across );
    vec3 dirt = mix( vec3( 0.43, 0.29, 0.13 ), vec3( 0.6, 0.45, 0.25 ), tNoise( wp * 1.6 + 5.0 ) );
    dirt *= 0.9 + 0.2 * tNoise( wp * 6.0 );
    float rut = smoothstep( 0.5, 0.05, abs( across - 1.05 ) );
    dirt = mix( dirt, dirt * vec3( 0.72, 0.68, 0.64 ), rut * 0.85 );
    dirt = mix( dirt, dirt * 1.12, smoothstep( 0.9, 1.4, across ) * ( 1.0 - smoothstep( 1.6, 2.2, across ) ) ); // the raised shoulder between rut and edge
    // stones: scattered on the shoulders and thick along the edge
    vec2 st = tPebbles( wp * 1.9 + 11.0 );
    float stoneMask = smoothstep( 0.2, 0.34, st.x ) * step( 0.72 - 0.35 * smoothstep( 1.5, 2.8, across ), st.y );
    vec3 stoneCol = mix( vec3( 0.6, 0.58, 0.53 ), vec3( 0.7, 0.66, 0.58 ), fract( st.y * 9.1 ) );
    dirt = mix( dirt, stoneCol, stoneMask * 0.9 );
    // the grassy crown between the ruts
    float crown = ( 1.0 - smoothstep( 0.25, 0.55, across ) ) * smoothstep( 0.35, 0.7, tNoise( wp * 1.3 + 2.0 ) );
    dirt = mix( dirt, ground * 1.05, crown * 0.85 );
    diffuseColor.rgb = mix( diffuseColor.rgb, dirt, road );
  }

  // ── snow: cool in the dips, bright on the crests ──
  if ( vSurf.z > 0.02 ) {
    vec3 snow = mix( vec3( 0.78, 0.86, 1.0 ), vec3( 1.0, 1.0, 1.02 ), smoothstep( 0.35, 0.75, tNoise( wp * 0.6 ) ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, snow * 0.95, vSurf.z * 0.85 );
  }
}
`;

/** Patch the terrain's painterly material with the surface detail (see the header). */
export function applyTerrainSurface(mat: THREE.Material): void {
  const base = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <worldpos_vertex>', VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', FRAG_MAIN);
  };
  mat.customProgramCacheKey = () => 'painterly-terrain';
}
