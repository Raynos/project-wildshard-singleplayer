/**
 * Pine Hollow's rain as data (PH-L10, E322 F-L5; SHARD-PLATFORM M3): the sizes of the SDK rain system's pieces
 * (@wildshard/sdk/looks/rainFx — the curtain with the canopy's drips, the puddles, the splashes at the feet, the drops on
 * the lens) and its three programs. `@{fog}` is the atmosphere's fog GLSL, spliced in by the system. The cave's hood is
 * the bear cave's mouth in its own frame (lx across, lz into the rock; the mouth faces −lz): half width, from, to, height
 * over the mouth's ground — the arch's opening is 2.6 × 4.8 m (caveArch.ts `openCaveArch`); the cover map takes over at
 * lz ≈ 1.5.
 */

/** The rain's sizes per tier: the cover map's texels, the streaks, the splash and lens-drop slots, the puddles. */
export const PINE_RAIN = {
  coverN: 256,
  streaks: { phone: 3200, desktop: 6000 },
  splashes: { phone: 64, desktop: 96 },
  lensDrops: { phone: 14, desktop: 20 },
  puddles: { trail: { phone: 55, desktop: 90 }, open: { phone: 36, desktop: 60 }, seg: 14, rings: [[0, 0.05], [0.55, 0.04], [1.0, 0.004], [1.12, -0.1], [1.35, -0.42]] },
} as const;

/** The bear cave's hood, where no rain falls (its frame is the layout's BEAR_CAVE). */
export const PINE_CAVE_HOOD = { hw: 3.2, lz0: -1.4, lz1: 4.5, up: 5.6 } as const;

/** The rain's programs: the curtain (the cover map's crowns and roofs, the cave's hood), the splashes, the lens drops. */
export const PINE_RAIN_PROGRAMS = {
  rain: {
    vertex: /* glsl */`
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
    fragment: /* glsl */`
        @{fog}
        uniform vec3 uCol; uniform float uAlpha;
        varying float vA; varying vec3 vW; varying float vDrip;
        void main() {
          float a = vA * uAlpha;
          if ( a < 0.002 ) discard;
          vec3 col = mix( uCol, atmosFogColor( vW ), atmosFogFactor( vW ) * 0.6 ) * mix( 1.0, 1.15, vDrip );
          gl_FragColor = vec4( col, a );
        }`,
  },
  splash: {
    transparent: true, depthWrite: false, side: 'double',
    vertex: /* glsl */`
        attribute vec4 aSplash;
        uniform float uTime;
        varying vec2 vUv; varying float vAge; varying float vKind; varying float vSeed;
        void main() {
          float age = ( uTime - aSplash.w ) / 0.42;
          vUv = position.xy; vKind = position.z; vAge = age;
          vSeed = fract( sin( dot( aSplash.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
          if ( age < 0.0 || age > 1.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
          vec3 p = aSplash.xyz;
          if ( position.z < 0.5 ) {
            float r = mix( 0.02, 0.17, sqrt( age ) ) * ( 0.7 + 0.6 * vSeed );
            p += vec3( position.x * r, 0.012, position.y * r );
          } else {
            vec3 toEye = cameraPosition - p; toEye.y = 0.0;
            vec3 side = normalize( vec3( - toEye.z, 0.0, toEye.x ) + 1e-4 );
            float w = 0.045 + 0.035 * age, h = 0.07 * ( 0.7 + 0.6 * vSeed );
            p += side * position.x * w + vec3( 0.0, position.y * h, 0.0 );
          }
          gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
        }`,
    fragment: /* glsl */`
        uniform vec3 uCol; uniform float uAlpha;
        varying vec2 vUv; varying float vAge; varying float vKind; varying float vSeed;
        void main() {
          float a;
          if ( vKind < 0.5 ) {
            // a ripple ring widening and thinning out
            float d = length( vUv );
            a = smoothstep( 0.14, 0.0, abs( d - 0.85 ) ) * ( 1.0 - vAge ) * 0.55;
          } else {
            // the crown: five droplets thrown up and out on arcs, falling back
            a = 0.0;
            for ( int i = 0; i < 5; i++ ) {
              float fi = float( i ), s = ( fi - 2.0 ) / 2.0 + ( vSeed - 0.5 ) * 0.3;
              vec2 c = vec2( s * 0.75 * vAge, 4.0 * vAge * ( 1.0 - vAge ) * ( 0.95 - 0.35 * abs( s ) ) * 1.9 - 0.9 );
              a += smoothstep( 0.16, 0.06, length( ( vUv - c ) * vec2( 1.0, 0.8 ) ) );
            }
            a *= 1.0 - vAge * vAge;
          }
          a *= uAlpha;
          if ( a < 0.01 ) discard;
          gl_FragColor = vec4( uCol, a );
        }`,
  },
  lens: {
    transparent: true, depthTest: false, depthWrite: false,
    vertex: /* glsl */`
        attribute vec4 aDrop;
        uniform float uAspect;
        varying vec2 vUv; varying float vA; varying float vSeed;
        void main() {
          vUv = position.xy; vA = aDrop.w;
          vSeed = fract( sin( aDrop.x * 91.3 + aDrop.y * 47.1 ) * 1753.1 );
          // a bead is a little taller than wide once it runs
          gl_Position = vec4( aDrop.xy + position.xy * aDrop.z * vec2( 1.0 / uAspect, 1.15 ), 0.0, 1.0 );
        }`,
    fragment: /* glsl */`
        uniform vec3 uSky; uniform vec3 uGround;
        varying vec2 vUv; varying float vA; varying float vSeed;
        void main() {
          // an uneven outline (a bead is never a circle)
          float ang = atan( vUv.y, vUv.x );
          float r = length( vUv ) * ( 1.0 + 0.07 * sin( ang * 3.0 + vSeed * 6.3 ) + 0.04 * sin( ang * 5.0 - vSeed * 4.0 ) );
          if ( r > 1.0 ) discard;
          // the lens a drop makes shows the world upside down and small: the bright sky pooled low, the dark ground high
          float body = smoothstep( 1.0, 0.0, r );
          vec3 col = mix( uGround, uSky, smoothstep( 0.5, -0.6, vUv.y ) );
          float rim = smoothstep( 0.72, 0.95, r ) * smoothstep( 1.0, 0.95, r );
          col = mix( col, uGround * 0.35, rim * 0.8 );
          float glint = smoothstep( 0.22, 0.0, length( vUv - vec2( -0.32, 0.4 ) ) );
          col += glint * 0.9;
          float a = ( 0.28 + 0.4 * rim + 0.5 * glint ) * smoothstep( 1.0, 0.9, r ) * vA * mix( 0.8, 1.0, body );
          gl_FragColor = vec4( col, a );
        }`,
  },
} as const;

/** C7: in the rain the grazing herds drift in under the nearest big trees (the bear sits it out), and back out after. */
export const PINE_HERD_SHELTER = { kinds: ['deer', 'elk', 'boar'], bigTree: 20, reach: 90, homeHold: 90, clear: 2.2, spotR: 3.5, homeR: 10, wet: 0.3, dry: 0.05 } as const;
