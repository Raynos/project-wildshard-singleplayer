// SHARD-PLATFORM M3 (look-family rows): models/cragRock.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what models/cragRock.ts passes (another module's GLSL, a number from the layout).
export const CRAG_GLSL = {
  CRAG_FRAG_PARS: /* glsl */`
uniform sampler2D tCragRock; uniform sampler2D tCragSnow;
uniform vec3 uCragRockMean; uniform vec2 uCragScale; // 1 / metres: rock, snow
varying vec3 vCragW; varying vec3 vCragN;
float cHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float cNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( cHash( i ), cHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( cHash( i + vec2( 0.0, 1.0 ) ), cHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
`,
  cragFragMain: /* glsl */`
#include <color_fragment>
{
  vec3 N = normalize( vCragN ), p = vCragW;
  vec3 w = pow( abs( N ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z );
  float s = uCragScale.x;
  vec3 r = ( texture2D( tCragRock, p.zy * s ).rgb * w.x + texture2D( tCragRock, p.xz * s ).rgb * w.y + texture2D( tCragRock, p.xy * s ).rgb * w.z ) / uCragRockMean;
  @{CRAG_DETAIL}
  float u = mix( p.x, p.z, w.x / max( w.x + w.z, 1e-3 ) );
  r *= mix( 0.55, 1.0, smoothstep( 0.0, 0.07, abs( cNoise( vec2( u * 0.16, p.y * 0.018 ) ) - 0.5 ) ) );
  r *= mix( 0.8, 1.12, cNoise( vec2( u * 0.012, p.y * 0.11 + cNoise( p.xz * 0.02 ) * 2.0 ) ) );
  vec3 g = diffuseColor.rgb * r * vec3( 0.34, 0.35, 0.39 ) / 0.36;
  // snow on every face that looks up, above the (ragged) snow line; blue in the shade
  float brk = cNoise( p.xz * 0.35 + p.y * 0.2 ) - 0.5;
  float hiK = smoothstep( 44.0, 84.0, p.y );
  float sn = smoothstep( 0.55 - hiK * 0.33, 0.75 - hiK * 0.33, N.y + brk * 0.3 ) * smoothstep( @{SNOW_LO}, @{SNOW_HI}, p.y + brk * 10.0 );
  // high up the snow also streaks down the steep faces' gullies (the round-8 peaks read white, ribbed with rock)
  sn = max( sn, smoothstep( 0.46, 0.6, cNoise( vec2( u * 0.07, p.y * 0.012 ) ) + brk * 0.25 + hiK * 0.12 ) * hiK * smoothstep( -0.3, 0.05, N.y ) * 0.94 );
  vec3 snow = texture2D( tCragSnow, p.xz * uCragScale.y ).rgb * vec3( 0.97, 1.0, 1.05 );
  snow *= mix( vec3( 0.84, 0.91, 1.08 ), vec3( 1.05, 1.02, 0.97 ), smoothstep( -0.05, 0.45, dot( N, normalize( uPSunDir ) ) ) );
  diffuseColor.rgb = mix( g, snow, sn );
}
`,
};
