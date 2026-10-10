// SHARD-PLATFORM M3 (look-family rows): terrainSurface.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what terrainSurface.ts passes (another module's GLSL, a number from the layout).
export const TERRAIN_GLSL = {
  VERT_PARS: /* glsl */`
attribute vec4 surf;
attribute vec2 rdir;
attribute vec3 zone;
varying vec3 vZone;
varying vec4 vSurf;
varying vec2 vRdir;
varying vec3 vTWorld;
varying vec3 vTNormal;
`,
  VERT_MAIN: /* glsl */`
#include <worldpos_vertex>
vSurf = surf;
vRdir = rdir;
vZone = zone;
vTWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
vTNormal = normalize( mat3( modelMatrix ) * objectNormal );
`,
  CRAG_ROCK_GLSL: /* glsl */`
vec3 cragRock( vec3 p, vec3 N, vec3 sunDir ) {
  vec3 w = pow( abs( N ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z );
  float s = uTexScale.w;
  vec3 r = ( texture2D( tRock, p.zy * s ).rgb * w.x + texture2D( tRock, p.xz * s ).rgb * w.y + texture2D( tRock, p.xy * s ).rgb * w.z ) / uMeanRock;
  @{CRAG_DETAIL}
  float u = mix( p.x, p.z, w.x / max( w.x + w.z, 1e-3 ) );
  float frac = smoothstep( 0.0, 0.07, abs( tNoise( vec2( u * 0.16, p.y * 0.018 ) ) - 0.5 ) );
  float band = tNoise( vec2( u * 0.012, p.y * 0.11 + tNoise( p.xz * 0.02 ) * 2.0 ) );
  r *= mix( 0.5, 1.0, frac ) * mix( 0.78, 1.14, band );
  // (E302, NALATI-FINISH B9: the grey cone by the summer camp read as one tiled grey) big soft value patches at two scales
  // and a cool blue-grey ↔ warm grey drift across the faces break the 4 m repeat; the sunlit faces a touch warm
  r *= mix( 0.7, 1.2, tNoise( p.xz * 0.06 + p.y * 0.045 ) ) * mix( 0.84, 1.12, tNoise( p.xz * 0.21 - p.y * 0.13 + 7.0 ) );
  vec3 tint = mix( vec3( 0.32, 0.34, 0.39 ), vec3( 0.4, 0.37, 0.34 ), smoothstep( 0.3, 0.8, tNoise( p.xz * 0.028 - p.y * 0.02 + 3.0 ) ) );
  return r * tint * mix( vec3( 0.92, 0.95, 1.04 ), vec3( 1.06, 1.02, 0.95 ), smoothstep( -0.1, 0.5, dot( N, sunDir ) ) );
}
`,
  FRAG_PARS: /* glsl */`
varying vec3 vZone;
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
@{V2_OLIVE_GLSL}@{LOOK_BAKE_GLSL}
vec3 tTriplanar( sampler2D t, vec3 p, vec3 n, float s ) {
  vec3 w = pow( abs( n ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z );
  return texture2D( t, p.zy * s ).rgb * w.x + texture2D( t, p.xz * s ).rgb * w.y + texture2D( t, p.xy * s ).rgb * w.z;
}
// the rock at 0.37×, turned 30°, on the face's dominant projection only (one tap): mixed by a slow noise over the
// 4 m triplanar it breaks the repeat that read as a tiled grey cone (E302, NALATI-FINISH B9)
vec3 tRockBig( vec3 p, vec3 N, float s ) {
  vec3 a = abs( N );
  vec2 uv = a.y > max( a.x, a.z ) ? p.xz : ( a.x > a.z ? p.zy : p.xy );
  return texture2D( tRock, mat2( 0.866, 0.5, -0.5, 0.866 ) * uv * s * 0.37 + 0.43 ).rgb / uMeanRock;
}
@{CRAG_ROCK_GLSL}
`,
  ZONES_V2: /* glsl */`
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
      snow *= mix( vec3( 0.84, 0.91, 1.08 ), vec3( 1.05, 1.02, 0.97 ), smoothstep( -0.05, 0.45, dot( N, normalize( uPSunDir ) ) ) );
      vec3 g = mix( diffuseColor.rgb, scree, smoothstep( 0.3, 0.6, vSurf.y + brk * 0.4 ) );
      g = mix( g, cragRock( vTWorld, N, normalize( uPSunDir ) ), smoothstep( 0.3, 0.6, vSurf.w + brk * 0.3 ) );
      // snow: the def's fields, and above the line the flatter facets of a face catch a dusting of their own
      float hiS = smoothstep( 44.0, 84.0, vTWorld.y );
      float sn = max( smoothstep( 0.35, 0.6, vSurf.z + brk * 0.5 ), smoothstep( 0.8 - 0.3 * hiS, 0.9 - 0.3 * hiS, n ) * smoothstep( @{SNOW_LO}, @{SNOW_HI}, vTWorld.y + brk * 12.0 ) * 0.9 );
      // high up the snow also streaks down the steep faces' gullies (the round-8 peaks read white, ribbed with rock)
      float fu = mix( vTWorld.x, vTWorld.z, abs( N.x ) / ( abs( N.x ) + abs( N.z ) + 1e-3 ) );
      sn = max( sn, smoothstep( 0.46, 0.6, tNoise( vec2( fu * 0.07, vTWorld.y * 0.012 ) ) + brk * 0.25 + hiS * 0.12 ) * hiS * 0.94 );
      g = mix( g, snow, sn );
      // the glacier tongue (GLACIER), per pixel: the snow going blue-white down the flow, crevasse bands across it
      // (bowed downstream in the middle, where the ice flows fastest; sparse up top), grey moraine along both edges.
      // Its snout's ice cliff and portal are Bowl.ts's mesh.
      {
        vec2 ga = vec2( @{GLACIER_X0}, @{GLACIER_Z0} ), gb = vec2( @{GLACIER_DX}, @{GLACIER_DZ} );
        float gt = dot( wp - ga, gb ) / dot( gb, gb );
        float gv = length( wp - ( ga + gb * gt ) ) / @{GLACIER_HALF} + ( tNoise( wp * 0.09 ) - 0.5 ) * 0.14;
        float gm = smoothstep( 1.02, 0.86, gv ) * smoothstep( -0.1, 0.04, gt ) * smoothstep( 1.03, 0.97, gt );
        if ( gm > 0.001 ) {
          vec3 ice = snow * mix( vec3( 0.93, 0.98, 1.04 ), vec3( 0.72, 0.86, 1.03 ), smoothstep( 0.15, 1.0, gt ) );
          float cs = gt * @{GLACIER_LEN} / 7.0 + ( 1.0 - gv * gv ) * 0.9 + ( tNoise( wp * 0.13 ) - 0.5 ) * 0.45;
          float crev = smoothstep( 0.84, 0.96, 1.0 - abs( fract( cs ) - 0.5 ) * 2.0 ) * smoothstep( 0.3, 0.55, tNoise( vec2( cs * 2.3, gv * 5.0 ) ) );
          crev *= 0.35 + 0.65 * min( 1.0, gt * 1.6 );
          ice = mix( ice, vec3( 0.2, 0.36, 0.52 ), crev * 0.85 );
          ice = mix( ice, scree * 0.92, smoothstep( 0.72, 0.97, gv ) * 0.8 );
          g = mix( g, ice, gm );
        }
      }
      diffuseColor.rgb = mix( diffuseColor.rgb, g, zw.z );
    }
  }
`,
  FRAG_MAIN: /* glsl */`
#include <color_fragment>
{
  vec2 wp = vTWorld.xz;
  float ringK = vZone.z; // the snow ring is painted by ZONES_V2: the generic rock / gravel / snow keep out
  float dist = length( vTWorld - cameraPosition );
  vec3 ground = diffuseColor.rgb;
  ground = v2Olive( ground ); // the olive / golden values (src/shards/nalati-grasslands/look/light.ts)
  // the painter's big soft patches — sunlit gold-green meadows and cooler hollows, read from far and high
  ground *= mix( vec3( 0.8, 0.86, 0.92 ), vec3( 1.14, 1.08, 0.86 ), smoothstep( 0.3, 0.72, tNoise( wp * 0.021 + 3.0 ) * 0.62 + tNoise( wp * 0.057 - 1.7 ) * 0.38 ) );
  diffuseColor.rgb = ground;

  // ── meadow: the painted grass detail over the macro colour (its hue stays the vertex colour's) ──
  vec3 tN = normalize( vTNormal );
  vec3 meadow = tTiled( tMeadow, wp * uTexScale.x ) / uMeanMeadow;
  // steep banks: the top-down tap smears down the slope (E302 B9 "stretched and blurry") — blend the side projections in
  float steepK = 1.0 - smoothstep( 0.62, 0.86, tN.y );
  if ( steepK > 0.01 ) {
    float sx = abs( tN.x ) / ( abs( tN.x ) + abs( tN.z ) + 1e-4 );
    vec3 side = mix( texture2D( tMeadow, vTWorld.xy * uTexScale.x ).rgb, texture2D( tMeadow, vTWorld.zy * uTexScale.x ).rgb, sx ) / uMeanMeadow;
    meadow = mix( meadow, side, steepK );
  }
  float detailAmt = 0.9 - 0.45 * smoothstep( 60.0, 260.0, dist );
  diffuseColor.rgb = ground * mix( vec3( 1.0 ), meadow, detailAmt );
  ground = diffuseColor.rgb;

  @{ZONES_V2}

  // ── rock: painted granite, triplanar, tinted by the macro colour ──
  // (E302, NALATI-FINISH B2: the escarpment read as flat grey tiled patches) — the repeat broken by a larger turned tap,
  // big soft value / hue patches (ochre ↔ cool blue-grey), strata, warm on the sunlit faces and cool on the shade side,
  // and moss / turf on the ledges that look up; all ALU apart from the one extra tap
  if ( vSurf.w * ( 1.0 - ringK ) > 0.02 ) {
    vec3 rock = tTriplanar( tRock, vTWorld, tN, uTexScale.w ) / uMeanRock;
    rock = mix( rock, tRockBig( vTWorld, tN, uTexScale.w ), smoothstep( 0.25, 0.75, tNoise( wp * 0.05 + vTWorld.y * 0.04 ) ) );
    float rp = tNoise( wp * 0.035 + vTWorld.y * 0.02 ), rq = tNoise( wp * 0.11 - vTWorld.y * 0.07 + 5.0 );
    vec3 tint = mix( vec3( 0.34, 0.33, 0.33 ), vec3( 0.46, 0.37, 0.27 ), smoothstep( 0.25, 0.75, rp ) );   // cool grey ↔ warm ochre
    tint *= mix( 0.8, 1.16, rq ) * mix( 0.86, 1.1, tNoise( vec2( wp.x * 0.02 + wp.y * 0.02, vTWorld.y * 0.35 ) ) ); // patches + strata
    tint *= mix( vec3( 0.86, 0.9, 1.06 ), vec3( 1.08, 1.02, 0.92 ), smoothstep( -0.2, 0.5, dot( tN, normalize( uPSunDir ) ) ) );
    vec3 rc = mix( tint, ground, 0.3 ) * rock;
    float ledge = smoothstep( 0.5, 0.75, tN.y + ( tNoise( wp * 0.6 ) - 0.5 ) * 0.35 );
    rc = mix( rc, ground * mix( vec3( 0.92, 1.0, 0.8 ), vec3( 1.0 ), rq ), ledge * 0.75 );              // turf / moss on the ledges
    diffuseColor.rgb = mix( diffuseColor.rgb, rc, vSurf.w * ( 1.0 - ringK ) );
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
    // not up the cut banks of a graded road: there the verge's dirt smeared up the wall as a ribbon (E302, NALATI-FINISH B9).
    // The bed itself (the middle ~3 m) always keeps its dirt, so a switchback still reads as a road from below
    road *= mix( 1.0, smoothstep( 0.66, 0.86, tN.y + ( rag - 0.6 ) * 0.08 ), smoothstep( 1.3, 2.3, across ) );
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

  diffuseColor.rgb *= bakedContact( vTWorld ); // the contact shade round the yurts / rocks / trunks (look/bake.ts)

  // ── snow ──
  if ( vSurf.z * ( 1.0 - ringK ) > 0.02 ) {
    vec3 snow = tTiled( tSnow, wp * uSnowScale ) * 1.05;
    diffuseColor.rgb = mix( diffuseColor.rgb, snow, vSurf.z * 0.9 * ( 1.0 - ringK ) );
  }
}
`,
};
