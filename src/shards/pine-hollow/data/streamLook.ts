/**
 * Pine Hollow's running water as data (PH-L9; SHARD-PLATFORM M3): the waterfall's spray puffs — where they rise, how many,
 * how big — and their program. `@{fog}` is the atmosphere's fog GLSL, `@{windX}` / `@{windZ}` the world wind's
 * direction (3 decimals), spliced in by world/streams.ts.
 */

/** The spray's anchors: at the foot of the fall's face, and over the plunge (lifted `lift` m off the pond). */
export const SPRAY_ANCHORS = {
  faceFoot: { n: 5, size: 4.5, rise: 3.5 },
  plunge: { n: 6, size: 5.5, rise: 3, lift: 0.3 },
} as const;

/** The spray's program: billboard puffs rising and swelling over their own cycle, lit like the air round them. */
export const SPRAY_PROGRAMS = {
  spray: {
    vertex: /* glsl */`
        attribute vec4 spraySeed;   // phase, period (s), sideways drift, opacity
        uniform float uWindTime;
        varying vec2 vUv; varying vec3 vWorld; varying float vFade;
        void main() {
          vec3 anchor = instanceMatrix[3].xyz;
          vec2 size = vec2( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ) );
          float rise = length( instanceMatrix[2].xyz );
          float t = fract( uWindTime / spraySeed.y + spraySeed.x );
          vec3 centre = anchor + vec3( 0.0, rise * t, 0.0 ) + vec3( @{windX}, 0.0, @{windZ} ) * t * 2.2
            + vec3( spraySeed.z, 0.0, - spraySeed.z ) * t * 1.5;
          float grow = 0.55 + 0.75 * t;
          vec3 toCam = cameraPosition - centre;
          vec3 fwd = normalize( vec3( toCam.x, 0.0, toCam.z ) + 1e-4 );
          vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), fwd ) );
          vec3 w = centre + right * position.x * size.x * grow + vec3( 0.0, position.y * size.y * grow, 0.0 );
          vWorld = w;
          float ang = spraySeed.x * 6.283 + t * 0.8;
          vec2 c = uv - 0.5;
          vUv = vec2( c.x * cos( ang ) - c.y * sin( ang ), c.x * sin( ang ) + c.y * cos( ang ) ) + 0.5;
          vFade = sin( 3.14159 * t ) * spraySeed.w * smoothstep( 1.5, 5.0, length( toCam ) );
          gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
        }`,
    fragment: /* glsl */`
        @{fog}
        uniform sampler2D uTex; uniform vec3 uSunColor;
        varying vec2 vUv; varying vec3 vWorld; varying float vFade;
        void main() {
          float a = texture2D( uTex, vUv ).a * vFade * 0.55;
          // spray is lit like the air around it: the fog's colour, brighter toward the sun
          float sunAmt = max( dot( normalize( vWorld - cameraPosition ), fogSunDir ), 0.0 );
          vec3 col = mix( fogColor * 1.15, fogSunColor, 0.25 + 0.5 * pow( sunAmt, 3.0 ) ) + uSunColor * 0.04;
          col = mix( col, atmosFogColor( vWorld ), atmosFogFactor( vWorld ) );
          gl_FragColor = vec4( col, a );
        }`,
  },
} as const;
