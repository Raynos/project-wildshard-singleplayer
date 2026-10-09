import { fogGLSL } from '@wildshard/game/systems/looks/fogProgram';

export const RAIN_PROGRAM = {
vertexShader: /* glsl */`
        attribute vec4 seed; attribute vec2 corner;
        uniform vec3 uOffset; uniform float uR; uniform vec3 uVel; uniform float uLen; uniform float uWidth;
        uniform sampler2D uCover; uniform float uCoverK; uniform vec4 uCave; uniform vec4 uCaveBox;
        varying float vA; varying vec3 vW; varying float vDrip;
        void main() {
          float R = uR;
          vec3 p = seed.xyz * 2.0 * R + uOffset * seed.w;
          vec3 c = cameraPosition + vec3( 0.0, 2.0, 0.0 );
          vec3 w = mod( p - c + R, 2.0 * R ) - R + c;
          // the cover over this drop: a roof stops it; the crowns catch most of it and let the rest through as drips
          vec4 cv = texture2D( uCover, w.xz * uCoverK + 0.5 );
          float drip = smoothstep( 0.25, 0.8, cv.r );
          float keep = step( drip * 0.86, fract( seed.x * 91.7 + seed.z * 13.3 ) ) * ( 1.0 - step( 0.5, cv.g ) );
          // the cave's hood (E322 F-L5): no rain in the mouth or under the arch, below its ceiling
          vec2 cd = w.xz - uCave.xy;
          float clx = cd.x * uCave.z - cd.y * uCave.w, clz = cd.x * uCave.w + cd.y * uCave.z;
          keep *= 1.0 - step( abs( clx ), uCaveBox.x ) * step( uCaveBox.y, clz ) * step( clz, uCaveBox.z ) * step( w.y, uCaveBox.w );
          vDrip = drip;
          vec3 v = normalize( uVel + vec3( 0.0, -3.0 * drip, 0.0 ) );   // drips fall straight: the canopy breaks the wind
          float len = mix( uLen, 0.28, drip ) * seed.w;
          vec3 a = w + v * ( corner.y * len );
          vW = a;
          vec4 mv = viewMatrix * vec4( a, 1.0 );
          vec3 vv = ( viewMatrix * vec4( v, 0.0 ) ).xyz;
          vec2 side = normalize( vec2( - vv.y, vv.x ) + 1e-5 );
          float dist = length( mv.xyz );
          mv.xy += side * corner.x * uWidth * mix( 1.0, 2.2, drip ) * max( dist, 1.0 ) * 0.12 * ( 0.6 + 0.4 * seed.w );
          vec3 off = abs( w - c );
          float edge = 1.0 - smoothstep( R * 0.65, R * 0.98, max( max( off.x, off.y ), off.z ) );
          vA = keep * edge * smoothstep( 0.5, 2.2, dist ) * ( corner.y > 0.5 ? 1.0 : 0.15 ) * mix( 1.0, 1.4, drip );
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        ${fogGLSL}
        uniform vec3 uCol; uniform float uAlpha;
        varying float vA; varying vec3 vW; varying float vDrip;
        void main() {
          float a = vA * uAlpha;
          if ( a < 0.002 ) discard;
          vec3 col = mix( uCol, atmosFogColor( vW ), atmosFogFactor( vW ) * 0.6 ) * mix( 1.0, 1.15, vDrip );
          gl_FragColor = vec4( col, a );
        }`,
};
