/**
 * The painted snow range (Nalati, style B — look pass levers 1 + 3; look-director): the Tian Shan backdrop every mockup
 * is framed against — a massive jagged snow range across the south, ridge behind ridge stepping paler and bluer into
 * the haze, blue shadows in the snow, dark forested spurs in front. A matte painting, not geometry: three ridge layers
 * are painted ONCE at boot into an atlas on the GPU (u = compass azimuth, v = elevation) — per pixel the front-most
 * layer's face normal (a ridged relief with couloirs, falling back from the ridge line), its snow and its layer — and a
 * sphere band past the far horizon ring samples it and lights it every frame with the live key light, so the range
 * re-lights with the day clock (golden rock, rose snow at dusk, moonlit blue at night).
 *
 *   const range = buildPainterlyRange(renderer, cloudUniforms, hazeColor);   // → THREE.Mesh; Sky adds it to `sky.clouds`
 *
 * Opaque, at radius RANGE_R (between the far horizon ring at 2450 m and the cloud band at 2520 m): the horizon rings
 * stand in front of it as foothills, the cumulus bank and the planet behind it. One draw call; per pixel one texture
 * fetch + a few ALU (no noise at runtime).
 */
import * as THREE from 'three';
import type { CloudUniforms } from './PainterlySky';
import { onGpuRestored } from '../core/gpuOnly';

export const RANGE_R = 2485;
/** the atlas covers elevation EL_LO … EL_HI degrees */
const EL_LO = -2, EL_HI = 26;

const BAKE_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  const float TAU = 6.28318530718;
  float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // ridged multifractal: sharp crests
  float ridged(vec2 p, int oct) {
    float s = 0.0, a = 0.5, n = 0.0, prev = 1.0;
    for (int o = 0; o < 7; o++) {
      if (o >= oct) break;
      float r = 1.0 - abs(vn(p) * 2.0 - 1.0);
      r *= r;
      s += r * a * (0.6 + 0.4 * prev); n += a; prev = r;
      a *= 0.5; p = p * 2.07 + vec2(17.1, 3.3);
    }
    return s / n;
  }
  // the compass envelope: the Nalati range towers across the south, lower ranges round the rest, the west opens flat
  float envelope(float azDeg, float k) {
    float d = abs(mod(azDeg - 180.0 + 540.0, 360.0) - 180.0);             // degrees off due south
    float south = 1.0 - smoothstep(40.0, 115.0, d);
    float west = 1.0 - smoothstep(10.0, 45.0, abs(mod(azDeg - 270.0 + 540.0, 360.0) - 180.0));
    return mix(0.36 + 0.14 * k, 1.0, south) * (1.0 - 0.72 * west);
  }
  // silhouette height (elevation degrees) of layer k at azimuth a (0..1 turns)
  float ridgeLine(float a, float k) {
    vec2 c = vec2(cos(a * TAU), sin(a * TAU));
    float base = k < 0.5 ? 5.0 : k < 1.5 ? 2.5 : 0.6;
    float amp = k < 0.5 ? 15.0 : k < 1.5 ? 21.0 : 6.5;
    // broad massifs (few, big, pyramidal) carrying the crest detail — not a comb of needles
    float big = ridged(c * (0.9 + k * 0.5) + vec2(k * 7.3, k * 2.9), 3);
    float crest = ridged(c * (6.0 + k * 2.0) + vec2(k * 3.1, 9.7), 5);
    float massif = vn(c * 0.8 + vec2(k * 5.0, 1.0));
    float h = big * 0.85 + crest * 0.2;
    return base + amp * envelope(a * 360.0, k) * (0.18 + 0.9 * h) * (0.6 + 0.55 * massif);
  }
  // the face relief below the ridge: spurs + couloirs running down the fall line
  float relief(float azDeg, float el, float k) {
    return ridged(vec2(azDeg * 0.55, el * 0.28) + vec2(k * 13.0, 0.0), 6);
  }
  void main() {
    float a = vUv.x;
    float azDeg = a * 360.0;
    float el = mix(${EL_LO.toFixed(1)}, ${EL_HI.toFixed(1)}, vUv.y);
    float dA = 1.0 / 4096.0;
    for (float kk = 2.0; kk >= -0.5; kk -= 1.0) {                      // front → back: the first layer that covers wins
      float H = ridgeLine(a, kk);
      if (el > H) continue;
      // the face as a height field toward the viewer: it falls back from the ridge line, spurs stand out
      float dr = H - el;
      float Hl = ridgeLine(a - dA * 2.0, kk), Hr = ridgeLine(a + dA * 2.0, kk);
      float r0 = relief(azDeg, el, kk);
      float rx = relief(azDeg + 0.18, el, kk), ry = relief(azDeg, el + 0.18, kk);
      float face = -dr * 0.55;
      float gx = ((Hr - Hl) / (dA * 4.0 * 360.0)) * 0.55 + (rx - r0) / 0.18 * 1.6;
      float gy = -0.55 + (ry - r0) / 0.18 * 1.6;
      vec3 n = normalize(vec3(-gx, -gy, 1.0));
      // snow: above a wavy line two-thirds up the layer, clinging to the couloirs lower down, thin on the steepest rock
      float peakH = ridgeLine(a, kk);
      float line = mix(peakH, 0.0, kk < 1.5 ? 0.55 : 0.2) + (r0 - 0.5) * 3.5 + (vn(vec2(azDeg * 0.9, 3.0)) - 0.5) * 2.0;
      float snow = smoothstep(line - 0.6, line + 0.6, el) * (1.0 - 0.75 * smoothstep(1.1, 2.2, length(vec2(gx, gy))));
      snow = max(snow, smoothstep(0.35, 0.15, r0) * smoothstep(line - 4.0, line - 1.0, el));   // couloirs
      if (kk > 1.5) snow *= smoothstep(4.0, 6.0, el);                                           // the front spurs are green below
      float edge = clamp((H - el) * 11.0, 0.0, 1.0);                                            // ~1 px anti-aliased crest
      gl_FragColor = vec4(n.xy * 0.5 + 0.5, kk * 0.25 + clamp(snow, 0.0, 1.0) * 0.24, edge);
      return;
    }
    gl_FragColor = vec4(0.5, 0.5, 0.0, 0.0);
  }`;

export function buildPainterlyRange(renderer: THREE.WebGLRenderer, u: CloudUniforms, haze: THREE.Color): THREE.Mesh {
  // ── paint the atlas once ──
  const W = 4096, H = 448;
  const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });
  const paint = (): void => {
    const bake = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: BAKE_FRAG, depthTest: false, depthWrite: false,
    }));
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.render(bake, cam);
    renderer.setRenderTarget(prev);
    bake.geometry.dispose(); bake.material.dispose();
  };
  paint();
  onGpuRestored(paint); // the atlas lives only on the GPU: an in-place WebGL restore paints it again (E54)

  // ── the band that shows it ──
  const d2r = Math.PI / 180;
  const geo = new THREE.SphereGeometry(RANGE_R, 128, 12, 0, Math.PI * 2, (90 - EL_HI) * d2r, (EL_HI - EL_LO) * d2r);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: u.uSunDir, uSunColor: u.uSunColor, uLight: u.uLight, tRange: { value: rt.texture }, uHaze: { value: haze }, uElLo: { value: EL_LO * d2r }, uElHi: { value: EL_HI * d2r } },
    side: THREE.BackSide, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tRange; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uLight; uniform vec3 uHaze;
      uniform float uElLo; uniform float uElHi;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float el = asin(clamp(d.y, -1.0, 1.0));
        float az = atan(-d.x, d.z) / 6.2831853;
        vec4 t = texture2D(tRange, vec2(fract(az), (el - uElLo) / (uElHi - uElLo)));
        if (t.a < 0.5) discard;
        float layer = floor(t.b * 4.0 + 0.02);                   // 0 back · 1 the range · 2 the front spurs
        float snow = clamp((t.b - layer * 0.25) / 0.24, 0.0, 1.0);
        vec2 nxy = t.rg * 2.0 - 1.0;
        vec3 T = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
        vec3 U = cross(T, d);
        vec3 N = normalize(T * nxy.x + U * nxy.y - d * sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
        // painted light: soft two-band ramp, warm key, cool sky-blue shade
        float l = dot(N, uSunDir);
        float band = 0.4 * smoothstep(-0.05, 0.1, l) + 0.6 * smoothstep(0.25, 0.45, l);
        vec3 key = uSunColor;
        vec3 snowLit = vec3(1.08, 1.04, 0.98) * mix(vec3(1.0), key, 0.55);
        vec3 snowShade = vec3(0.56, 0.68, 0.94);
        vec3 rockLit = vec3(0.5, 0.45, 0.41) * mix(vec3(1.0), key, 0.6);
        vec3 rockShade = vec3(0.2, 0.25, 0.37);
        vec3 greenLit = vec3(0.2, 0.3, 0.14) * mix(vec3(1.0), key, 0.5);
        vec3 greenShade = vec3(0.08, 0.13, 0.17);
        vec3 bare = layer > 1.5 ? mix(greenShade, greenLit, band) : mix(rockShade, rockLit, band);
        vec3 col = mix(bare, mix(snowShade, snowLit, band), snow);
        // aerial perspective: each layer back steps paler and bluer; every foot sinks into the valley haze
        float hz = layer > 1.5 ? 0.24 : layer > 0.5 ? 0.36 : 0.56;
        hz += (1.0 - hz) * 0.45 * (1.0 - smoothstep(0.0, 0.12, el));
        float sunSide = pow(max(dot(d, uSunDir), 0.0), 3.0);
        vec3 hazeCol = mix(uHaze, uHaze * mix(vec3(1.0), key, 0.35), sunSide);
        col = mix(col, hazeCol, hz);
        gl_FragColor = vec4(col * uLight, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'painted-range';
  mesh.frustumCulled = false;
  mesh.renderOrder = -8;
  return mesh;
}
