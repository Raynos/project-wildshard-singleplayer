// SHARD-PLATFORM M3 (look-family rows): world/dressing/life.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what world/dressing/life.ts passes (another module's GLSL, a number from the layout).
export const MOTES_GLSL = {
  MOTE_VERT: /* glsl */`
uniform float uTime;
uniform vec2 uDrift;       // metres the wind has carried the cloud (x, z)
uniform vec3 uBox;
uniform float uPx;         // pixels per metre at 1 m
uniform vec3 uSunDir;
attribute vec4 aSeed;      // xyz in [0,1), w = random
varying float vAlpha;
varying float vGlow;
varying float vFluff;
void main() {
  float r = aSeed.w;
  vec3 p = aSeed.xyz * uBox;
  float sp = 0.6 + r * 0.8;
  p.xz += uDrift * sp;
  p += vec3( sin( uTime * 0.6 + r * 41.0 ) * 0.7, sin( uTime * ( 0.5 + r ) + r * 17.0 ) * 0.35 + uTime * 0.05 * ( r - 0.3 ), cos( uTime * 0.45 + r * 29.0 ) * 0.7 );
  vec3 c = cameraPosition + vec3( 0.0, uBox.y * 0.25, 0.0 );
  vec3 rel = mod( p - c + uBox * 0.5, uBox ) - uBox * 0.5;
  vec3 world = c + rel;
  vec4 mv = viewMatrix * vec4( world, 1.0 );
  gl_Position = projectionMatrix * mv;
  vec3 e = abs( rel ) / ( uBox * 0.5 );
  float edge = 1.0 - smoothstep( 0.7, 1.0, max( e.x, max( e.y, e.z ) ) );
  float d = length( rel );
  vAlpha = edge * smoothstep( 0.4, 1.6, d );
  vFluff = step( 0.72, fract( r * 7.31 ) );
  vec3 V = normalize( world - cameraPosition );
  vGlow = pow( max( dot( V, uSunDir ), 0.0 ), 5.0 );
  float size = mix( 0.018, 0.05, vFluff ) * ( 0.7 + r * 0.6 );
  gl_PointSize = clamp( size * uPx / max( -mv.z, 0.1 ), 1.0, 14.0 );
}
`,
  MOTE_FRAG: /* glsl */`
uniform vec3 uSunCol;
uniform float uOpacity;
varying float vAlpha;
varying float vGlow;
varying float vFluff;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length( q );
  float a = smoothstep( 0.5, 0.05, d );
  // fluff: a soft star of hairs round a bright seed
  if ( vFluff > 0.5 ) a = max( smoothstep( 0.5, 0.0, d ) * 0.35, smoothstep( 0.14, 0.0, d ) ) * ( 0.75 + 0.25 * abs( sin( atan( q.y, q.x ) * 6.0 ) ) );
  vec3 col = mix( vec3( 1.0, 0.86, 0.45 ), vec3( 1.0, 0.98, 0.92 ), vFluff );
  col *= uSunCol * ( 0.55 + 1.8 * vGlow );
  gl_FragColor = vec4( col, a * vAlpha * uOpacity * ( 0.35 + 0.9 * vGlow ) );
}
`,
};
