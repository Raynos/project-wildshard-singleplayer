// SHARD-PLATFORM M3 (look-family rows): look/stylizedSky.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here, or what that module passes (another module's GLSL, a number from its layout).
export const SKY_GLSL = {
  domeVertex: /* glsl */`
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  domeFragment: /* glsl */`
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uBelow; uniform vec3 uSunGlow; uniform vec3 uSunDir; uniform float uNight;
        varying vec3 vDir;
        float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.75, h), 0.62));
          col = mix(col, uBelow, smoothstep(0.0, -0.08, h));
          col += uHorizon * 0.18 * smoothstep(0.06, 0.0, abs(h - 0.01));          // a thin bright band on the horizon
          float s = max(dot(d, uSunDir), 0.0);
          col += uSunGlow * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) * (1.0 - uNight * 0.7);
          if (uNight > 0.0 && h > 0.0) {                                             // stars: a hashed cell grid, twinkle-free
            vec3 c = floor(d * 180.0);
            float st = step(0.9965, h31(c)) * smoothstep(0.02, 0.25, h);
            col += vec3(0.9, 0.95, 1.1) * st * uNight * 1.6;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
  cloudVertex: /* glsl */`
        uniform float uTime;
        varying vec3 vN; varying vec3 vW; varying float vBelly;
        attribute float belly;
        void main() {
          // slow drift: the whole ring turns about the camera (a full turn in ~3 h)
          float a = uTime * 0.0006; float c = cos(a), s = sin(a);
          vec3 p = vec3(c * position.x - s * position.z, position.y, s * position.x + c * position.z);
          vN = vec3(c * normal.x - s * normal.z, normal.y, s * normal.x + c * normal.z);
          vBelly = belly;
          vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
  cloudFragment: /* glsl */`
        uniform vec3 uSunDir; uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uHorizon; uniform vec3 uSunGlow; uniform float uNight;
        varying vec3 vN; varying vec3 vW; varying float vBelly;
        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          float NdL = dot(N, uSunDir);
          float lit = smoothstep(-0.05, 0.2, NdL) * (0.82 + 0.18 * NdL);
          vec3 col = mix(uCloudShade, uCloudLit, lit);
          col = mix(col, uCloudShade * 0.82, vBelly * 0.55);                         // darker, flatter bellies
          // silver lining: rims facing away from the eye glow when the sun sits behind the cloud
          // clamped: a facet square to the eye rounds |N·V| past 1 (mediump on iOS), pow(negative) is NaN, and bloom's mip
          // chain smears that one NaN pixel into a flickering black square in the sky (E91)
          float fres = pow(clamp(1.0 - abs(dot(N, V)), 0.0, 1.0), 2.5);
          float behind = pow(max(dot(-V, uSunDir), 0.0), 3.0);
          col += uSunGlow * fres * (0.25 + 1.6 * behind);
          // the lowest puffs melt into the horizon haze
          vec3 dir = normalize(vW - cameraPosition);
          col = mix(col, uHorizon, smoothstep(0.1, 0.0, dir.y) * 0.7);
          gl_FragColor = vec4(col, 1.0);
        }`,
};
