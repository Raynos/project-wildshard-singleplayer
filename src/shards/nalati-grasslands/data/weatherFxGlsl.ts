// SHARD-PLATFORM M3 (look-family rows): world/WeatherFX.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what world/WeatherFX.ts passes (another module's GLSL, a number from the layout).
export const WEATHER_FX_GLSL = {
  STORM_GLSL: /* glsl */`
uniform vec2 uFrom; uniform float uFront; uniform float uTime; uniform sampler2D tNoise;
// P: a point on the cloud plane, in cloud heights (d.xz / (d.y + 0.12)); returns 0..1 storm cover, edge = distance past the lead
float stormCover( vec2 P, out float edge ) {
  float s = dot( P, uFrom );
  float n = texture2D( tNoise, P * 0.055 + vec2( uTime * 0.0035, uTime * 0.002 ) ).r;
  float n2 = texture2D( tNoise, P * 0.19 - vec2( uTime * 0.004, 0.0 ) ).r;
  float lead = mix( 9.0, -9.0, clamp( uFront, 0.0, 1.0 ) );
  float back = mix( 16.0, -9.5, clamp( ( uFront - 1.0 ) * 2.0, 0.0, 1.0 ) );
  edge = s - lead + ( n - 0.5 ) * 4.0 + ( n2 - 0.5 ) * 1.2;
  float c = smoothstep( -0.4, 1.2, edge );
  c *= 1.0 - smoothstep( -1.2, 0.4, s - back + ( n - 0.5 ) * 4.0 );
  return c;
}
`,
  FOG_GLSL: /* glsl */`
  uniform vec3 fogColor; uniform vec3 fogSunDir; uniform vec3 fogSunColor;
  uniform float fogHeight; uniform float fogHeightFalloff; uniform float fogHeightDensity; uniform float fogDistDensity;
  float atmosFogFactor( vec3 wp ) {
    vec3 ray = wp - cameraPosition; float rayLen = length( ray );
    float dy = wp.y - cameraPosition.y;
    float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
    float t = fogHeightFalloff * dy;
    float integ = abs( t ) > 1e-3 ? ( 1.0 - exp( - t ) ) / t : 1.0;
    return clamp( 1.0 - exp( - ( fogHeightDensity * camF * integ * rayLen + fogDistDensity * rayLen ) ), 0.0, 1.0 );
  }`,
  deckFragment: /* glsl */`
        @{STORM_GLSL}
        uniform float uOvercast; uniform vec3 uLight; uniform vec3 uSunDir; uniform vec3 uSunCol;
        uniform float uFlash; uniform vec3 uFlashDir; uniform float uFade; uniform float uRainbow;
        varying vec3 vDir;
        vec3 spectrum(float t) { // 0 violet … 1 red
          return clamp(vec3(abs(t * 6.0 - 3.0) - 1.0, 2.0 - abs(t * 6.0 - 2.0), 2.0 - abs(t * 6.0 - 4.0)), 0.0, 1.0).bgr;
        }
        void main() {
          vec3 d = normalize(vDir);
          if (d.y < -0.08) discard;
          vec3 outc = vec3(0.0);
          // the rainbow: 40.5°–42.5° round the anti-solar point, a faint secondary at 50–53° (colours reversed)
          if (uRainbow > 0.0) {
            vec3 anti = -uSunDir;
            float ang = degrees(acos(clamp(dot(d, anti), -1.0, 1.0)));
            float p = smoothstep(40.2, 41.0, ang) * smoothstep(42.9, 42.1, ang);
            float s = smoothstep(50.0, 50.8, ang) * smoothstep(53.4, 52.6, ang);
            vec3 bow = spectrum(clamp((ang - 40.4) / 2.3, 0.0, 1.0)) * p + spectrum(clamp((53.2 - ang) / 3.0, 0.0, 1.0)) * s * 0.16;
            // brighter inside the bow (the classic lighter sky within), fading into the ground and at the top
            float inside = smoothstep(41.0, 30.0, ang) * 0.05;
            float fadeY = smoothstep(-0.02, 0.06, d.y);
            outc += (bow * 0.55 + vec3(inside)) * uRainbow * fadeY;
          }
          if (uFade <= 0.0) { gl_FragColor = vec4(outc, 0.0); return; }
          // the storm is a towering wall, not a flat deck: its coverage reads a plane 3.5× flatter (it stands taller
          // over the horizon), the billow shading keeps the true plane
          vec2 P = d.xz / (max(d.y, 0.0) + 0.12);
          vec2 Pt = d.xz / (max(d.y, 0.0) / 3.5 + 0.12);
          float edge;
          float c = stormCover(Pt, edge);
          // billows: two octaves of the noise shade the underside; the lead edge is the lighter shelf lip
          float b1 = texture2D(tNoise, P * 0.11 + vec2(uTime * 0.006, 0.0)).r;
          float b2 = texture2D(tNoise, P * 0.43 + vec2(0.0, uTime * 0.01)).r;
          float bill = b1 * 0.65 + b2 * 0.35;
          vec3 belly = mix(vec3(0.07, 0.08, 0.12), vec3(0.2, 0.21, 0.28), smoothstep(0.3, 0.75, bill));
          // the top of the wall (just past the lead edge) is the billowing sunlit crown; below it the body darkens to
          // the rain-dark base (storm-1: bright piled tops over a slate-violet body)
          float lip = smoothstep(3.0, 0.1, edge) * smoothstep(-0.3, 0.4, edge);
          float crown = lip * smoothstep(0.35, 0.7, bill + 0.25 * b2);
          vec3 col = mix(belly, vec3(0.42, 0.44, 0.52) * (0.85 + 0.3 * b2), lip * 0.55);
          col = mix(col, vec3(0.78, 0.78, 0.82), crown * 0.6);
          float sunSide = 0.35 + 0.65 * max(dot(normalize(d.xz + 1e-4), normalize(uSunDir.xz + 1e-4)), 0.0);
          col += uSunCol * 0.22 * crown * sunSide * smoothstep(-0.05, 0.3, uSunDir.y);
          // the base under the wall is darkest (rain falling out of it)
          col *= mix(1.0, 0.65, smoothstep(0.12, 0.0, d.y) * c);
          col *= uLight;
          // in-cloud lightning: a soft blob round the flash's bearing + the whole deck lifts a little
          float fl = pow(max(dot(d, uFlashDir), 0.0), 10.0);
          col += vec3(0.75, 0.72, 1.0) * uFlash * (0.25 + 2.2 * fl) * c;
          // the overcast greys the rest of the sky too (a thin veil beyond the body)
          // the veil beyond the body thickens toward it (clear sky stays clear on the far side until it is overhead)
          float a = max(c * 0.97, uOvercast * 0.6 * smoothstep(-9.0, 0.0, edge)) * smoothstep(-0.08, 0.02, d.y) * uFade;
          gl_FragColor = vec4(col * a + outc * (1.0 - a), a);
        }`,
  curtainsFragment: /* glsl */`
        @{STORM_GLSL}
        uniform float uRain; uniform vec3 uLight; uniform vec2 uWind; uniform float uStorm;
        varying vec3 vDir; varying float vH;
        void main() {
          vec3 d = normalize(vDir);
          vec2 h = normalize(d.xz + 1e-5);
          // the storm body over the hills this way, ~2 cloud heights out
          float edge;
          float c = stormCover(h * 7.0, edge);
          float az = atan(h.y, h.x);
          // streaks: slanted by the wind, falling
          float slant = dot(vec2(-h.y, h.x), uWind) * 0.05;
          vec2 q = vec2(az * 38.0 + d.y * slant * 40.0, d.y * 4.0 + uTime * 0.9);
          float s1 = texture2D(tNoise, q * vec2(1.0, 0.08)).r;
          float s2 = texture2D(tNoise, q * vec2(2.3, 0.05) + 0.37).r;
          float streak = smoothstep(0.35, 0.8, s1 * 0.6 + s2 * 0.4);
          // the curtain hangs from the cloud (top) to the ground (bottom), densest low
          float veil = c * (0.3 + 0.7 * streak) * smoothstep(1.0, 0.6, vH) * smoothstep(0.0, 0.25, vH);
          float a = veil * 0.62 * (1.0 - 0.6 * uStorm);
          vec3 col = vec3(0.16, 0.17, 0.22) * uLight;
          vec3 outc = col * a;
          gl_FragColor = vec4(outc, a);
        }`,
  boltVertex: /* glsl */`
        attribute vec3 bEnd; attribute float bW; attribute vec2 corner;
        uniform float uWidth;
        varying float vEdge; varying float vW;
        void main() {
          vec3 p = mix(position, bEnd, corner.y);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vec4 a = viewMatrix * vec4(position, 1.0), b = viewMatrix * vec4(bEnd, 1.0);
          vec2 dir = normalize(b.xy / max(-b.z, 0.1) - a.xy / max(-a.z, 0.1) + 1e-5);
          vec2 side = vec2(-dir.y, dir.x);
          float dist = max(-mv.z, 1.0);
          // at least ~1.6 px wide however far, a bit wider than the real channel so it reads
          mv.xy += side * corner.x * bW * uWidth * (0.6 + dist * 0.0022);
          vEdge = corner.x; vW = bW;
          gl_Position = projectionMatrix * mv;
        }`,
  boltFragment: /* glsl */`
        uniform float uAlpha;
        varying float vEdge; varying float vW;
        void main() {
          // a white-hot channel in the middle third, a violet glow round it (storm-2)
          float d = abs(vEdge);
          float core = 1.0 - smoothstep(0.1, 0.3, d);
          float glow = exp(-d * 3.5) * (1.0 - d);
          vec3 col = vec3(1.0, 0.97, 1.0) * core * (2.5 + 5.0 * vW) + vec3(0.55, 0.38, 1.0) * glow * (0.9 + 1.2 * vW);
          gl_FragColor = vec4(col * uAlpha, 1.0);
        }`,
  smokeVertex: /* glsl */`
        attribute vec4 seed;
        uniform float uTime; uniform vec3 uOrigin; uniform vec2 uWind;
        varying float vA;
        void main() {
          float life = fract(uTime * 0.09 * seed.w + seed.x);
          vec3 p = uOrigin + vec3(seed.y * 0.6, life * 16.0, seed.z * 0.6);
          p.xz += uWind * life * life * 5.0;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.5, 1.0, life));
          gl_PointSize = (2.0 + life * 7.0) * 320.0 / max(-mv.z, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
  smokeFragment: /* glsl */`
        uniform float uAmt; uniform vec3 uLight;
        varying float vA;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q);
          float a = smoothstep(0.5, 0.1, r) * vA * uAmt * 0.45;
          gl_FragColor = vec4(vec3(0.3, 0.3, 0.32) * uLight, a);
        }`,
  puddlesVertex: /* glsl */`
        varying vec3 vW; varying vec2 vL; varying float vSeed;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = w.xyz; vL = position.xz; vSeed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.071);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
  puddlesFragment: /* glsl */`
        @{FOG_GLSL}
        uniform float uWet; uniform float uRain; uniform vec3 uSky; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTime;
        varying vec3 vW; varying vec2 vL; varying float vSeed;
        void main() {
          // an irregular soft edge
          float ang = atan(vL.y, vL.x);
          float rim = 0.78 + 0.12 * sin(ang * 3.0 + vSeed * 20.0) + 0.08 * sin(ang * 5.0 + vSeed * 7.0);
          float r = length(vL);
          float shape = smoothstep(rim, rim - 0.2, r);
          if (shape <= 0.0) discard;
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(V.y, 0.0), 3.0);
          vec3 N = vec3(0.0, 1.0, 0.0);
          // rain rings
          if (uRain > 0.0) {
            vec2 cell = floor(vW.xz * 2.5); vec2 f = fract(vW.xz * 2.5) - 0.5;
            float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            float t = fract(uTime * 1.3 + h);
            float ring = smoothstep(0.06, 0.0, abs(length(f) - t * 0.45)) * (1.0 - t) * uRain;
            N = normalize(N + vec3(f.x, 0.0, f.y) * ring * 1.5);
          }
          vec3 R = reflect(-V, N);
          vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.6, R.y));
          float glint = pow(max(dot(R, uSunDir), 0.0), 180.0) * 6.0;
          vec3 col = mix(vec3(0.05, 0.045, 0.04), sky, 0.35 + 0.55 * fres) + uSunCol * glint;
          float a = shape * uWet * (0.55 + 0.4 * fres);
          col = mix(col, fogColor, atmosFogFactor(vW));
          gl_FragColor = vec4(col, a);
        }`,
};
