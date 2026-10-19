// The existing Effect boundary still owns the city's final ink composite.
import { FOG_GLSL, NOISE_GLSL } from './look';
import { GLOW_COMP_GLSL, GRADE_GLSL } from './light';

const VM_SLICE = 0.3;

export const JIEHUA_FS = /* glsl */ `
uniform sampler2D tTight;
uniform sampler2D tWide;
uniform float uHasBleed;
uniform sampler2D tHaze;
uniform float uRainHaze;
uniform sampler2D tRefl;
uniform float uReflK;
uniform sampler2D uSilk;
uniform vec2 uTexel;
uniform float uTime;
uniform float uLineScale;
uniform float uLines;
uniform vec3 uInk;
uniform vec4 uBleed;   // x: tight light, y: wide light, z: stain (pigment glaze), w: stain response
uniform vec4 uBleed2;  // x: weave soak, y: fibre warp (uv), z: edge darkening, w: exposure
uniform vec4 uRain;    // x: strength, y: angle (rad), z: speed (px/s), w: px scale (DPR)
uniform vec3 uGrade;   // x: vignette, y: grain, z: shadow lift toward ink-blue
uniform vec4 uTone;    // (render, E281) x: the toe's floor (a black's scale), y: the luminance where the toe ends, z: vibrance, w: the lit side's warmth
uniform float uDpr;
uniform vec2 uSilPx;   // silhouette width near, at 60 m (px at 3×)
uniform vec2 uSilFade; // silhouettes gone between these distances (m)
uniform float uSilGain;
uniform float uInkMid;
uniform vec3 uInk1;
uniform float uLineFog;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec2 uNF;      // camera near, far
uniform float uSharp;
${NOISE_GLSL}
${FOG_GLSL}
${GLOW_COMP_GLSL}
${GRADE_GLSL}
// inverse depth (1/m) from the depth texture: linear across a plane in screen space, so its Laplacian is 0 on flat faces
// and only folds toward the eye survive (the ink lab's). The sky / far plane is 0; a viewmodel's near slice a flat 0.5 m
float wAt(vec2 p) {
  float d = texture(depthBuffer, p).r;
  if (d >= 1.0) return 0.0;
  if (d < ${VM_SLICE.toFixed(2)}) return 2.0;
  float z = (uNF.x * uNF.y) / ((uNF.y - uNF.x) * d - uNF.y);
  return 1.0 / max(-z, uNF.x);
}
float fold(vec2 p, float wc, float r) {
  vec2 o1 = vec2(r, 0.0) * uTexel, o2 = vec2(0.0, r) * uTexel, o3 = vec2(r, r) * uTexel * 0.7071, o4 = vec2(r, -r) * uTexel * 0.7071;
  float l1 = (wAt(p + o1) + wAt(p - o1) - 2.0 * wc) / wc;
  float l2 = (wAt(p + o2) + wAt(p - o2) - 2.0 * wc) / wc;
  float l3 = (wAt(p + o3) + wAt(p - o3) - 2.0 * wc) / wc;
  float l4 = (wAt(p + o4) + wAt(p - o4) - 2.0 * wc) / wc;
  return -min(min(l1, l2), min(l3, l4));
}
vec3 shoulderHP(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  float t = m < 0.72 ? m : 0.72 + 0.28 * (1.0 - exp(-(m - 0.72) / 0.28));
  return c * (t / max(m, 1e-5));
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 fromSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
float rainLayer(vec2 fc, float scale, float speed, float dens, float seed) {
  float a = uRain.y;
  vec2 p = mat2(cos(a), -sin(a), sin(a), cos(a)) * fc / uRain.w;
  p.y += uTime * speed;
  vec2 cell = vec2(7.0, 70.0) * scale;
  vec2 id = floor(p / cell);
  vec2 f = p - id * cell;
  if (h12(id + seed) > dens) return 0.0;
  float x0 = (0.15 + 0.7 * h12(id + seed + 3.1)) * cell.x;
  float len = cell.y * (0.25 + 0.45 * h12(id + seed + 7.7));
  float y0 = h12(id + seed + 1.3) * (cell.y - len);
  float t = (f.y - y0) / len;
  float along = step(0.0, t) * step(t, 1.0) * sin(clamp(t, 0.0, 1.0) * 3.14159);
  float dx = abs(f.x - x0) * uRain.w;
  return along * (1.0 - smoothstep(0.35, 1.1, dx));
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  // (render) the wet floor's streaked screen-space reflection (render/reflect.ts; 0 off the floor)
  if (uReflK > 0.0) c += texture(tRefl, uv).rgb * uReflK;
  // (render) a light unsharp mask: the phone draws at 2× and the screen is 3×; the upscale softened the ruled ink and
  // the calligraphy the clean room drew at 3×
  if (uSharp > 0.0) {
    vec3 nb = texture(inputBuffer, uv + vec2(uTexel.x, 0.0)).rgb + texture(inputBuffer, uv - vec2(uTexel.x, 0.0)).rgb
            + texture(inputBuffer, uv + vec2(0.0, uTexel.y)).rgb + texture(inputBuffer, uv - vec2(0.0, uTexel.y)).rgb;
    c = max(c + (c - nb * 0.25) * uSharp, 0.0);
  }
  float edge = 0.0;
  float wc = wAt(uv);
  if (wc > 1e-5 && uLines > 0.5) {
    float z = 1.0 / wc;
    float r = mix(uSilPx.x, uSilPx.y, smoothstep(4.0, 60.0, z)) * uDpr * (z < 1.6 ? 1.6 : 1.0) * uLineScale;
    float e = 0.5 * (clamp(fold(uv, wc, r - 0.5) / uSilGain, 0.0, 1.0) + clamp(fold(uv, wc, r + 0.5) / uSilGain, 0.0, 1.0));
    e = max(e, clamp(fold(uv, wc, max(r * 0.5, 1.0)) / uSilGain, 0.0, 1.0));
    e *= 1.0 - smoothstep(uSilFade.x, uSilFade.y, z);
    if (e > 0.002) {
      vec4 vr = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
      vec3 pv = vr.xyz / vr.w;
      pv *= z / max(-pv.z, 1e-4);
      vec3 wp = (uCamWorld * vec4(pv, 1.0)).xyz;
      vec4 fg = silkFog(wp, z < 1.6 ? 0.0 : 1.0);
      vec3 ink = mix(uInk, uInk1, smoothstep(4.0, uInkMid, z));
      vec3 lineC = ink * fg.a + fg.rgb;
      edge = e * pow(max(fg.a, 1e-4), uLineFog - 1.0);
      c = mix(c, lineC, edge);
    }
  }
  vec2 warp = (vec2(vnoise(uv * vec2(9.0, 18.0)), vnoise(uv * vec2(9.0, 18.0) + 5.3)) - 0.5) * uBleed2.y;
  vec4 tight4 = vec4(0.0);
  vec4 wide4 = vec4(0.0);
  if (uHasBleed > 0.5) {
    tight4 = texture(tTight, uv + warp * 0.5);
    wide4 = texture(tWide, uv + warp);
  }
  vec3 tight = tight4.rgb;
  vec3 wide = wide4.rgb;
  float weave = texture(uSilk, gl_FragCoord.xy / (300.0 * uRain.w / 3.0)).r;
  float soak = 1.0 + (weave - 0.5) * uBleed2.x;
  float wl = max(wide.r, max(wide.g, wide.b));
  vec3 hue = wide / max(wl, 1e-4);
  float amt = (1.0 - exp(-wl * uBleed.w)) * uBleed.z * soak;
  float front = smoothstep(0.05, 0.25, amt) * (1.0 - smoothstep(0.25, 0.6, amt));
  amt += front * uBleed2.z;
  float paper = smoothstep(0.04, 0.35, lum(c));
  c *= mix(vec3(1.0), mix(vec3(1.0), hue, clamp(amt, 0.0, 1.0)), paper);
  c += (tight * uBleed.x + wide * uBleed.y) * soak;
  c += glowAdd(tight4.a, wide4.a * 0.25, wc > 1e-5 ? 1.0 / wc : 1e4) * soak;
  if (uRain.x > 0.0) {
    float rn = rainLayer(gl_FragCoord.xy, 1.0, uRain.z, 0.28, 0.0) + 0.6 * rainLayer(gl_FragCoord.xy + 37.0, 0.55, uRain.z * 0.7, 0.3, 11.0);
    vec3 rc = vec3(0.86, 0.9, 0.97) * 0.55 + (tight + wide) * 1.6;
    // (render) a drop crossing a light's halo catches it: the haze march's in-scatter lights the drizzle
    if (uRainHaze > 0.0) rc += texture(tHaze, uv).rgb * uRainHaze;
    c = mix(c, rc, clamp(rn * uRain.x, 0.0, 1.0) * 0.55);
  }
  c *= uBleed2.w;
  c = shoulderHP(c);
  float l = lum(c);
  // (render, E281) the blue-hour toe: the targets' darks sit ~10 L* under ours (p10 L* 16 against 23–40) while their
  // lights match — the shadows, eaves and gaps go deep and the pale silk stays pale, so the depth reads in layers; and
  // the targets' colour is richer (mean saturation 0.3 against 0.2): vibrance, the dull washes lifted most and the
  // cinnabar and neon (already saturated) left alone. Hue-preserving
  float tk = mix(uTone.x, 1.0, smoothstep(0.0, uTone.y, l));
  c *= tk;
  l *= tk;
  float cmx = max(c.r, max(c.g, c.b)), sat0 = (cmx - min(c.r, min(c.g, c.b))) / max(cmx, 1e-5);
  c = max(mix(vec3(l), c, 1.0 + uTone.z * (1.0 - sat0)), 0.0);
  // the split: the targets' lit mids and lights are warm (mean r > g > b) over cool ink-blue shadows (the lift below)
  c *= mix(vec3(1.0), vec3(1.0 + uTone.w, 1.0, 1.0 - uTone.w), smoothstep(0.06, 0.4, l));
  c = mix(c, c * vec3(0.9, 0.96, 1.1), (1.0 - smoothstep(0.02, 0.25, l)) * uGrade.z);
  c *= 1.0 + (weave - 0.5) * 0.035;
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * uGrade.x;
  if (uLines > 1.5) c = mix(vec3(1.0), vec3(0.0), edge);
  vec3 o = gradeLut(toSRGB(c));
  o += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) * uGrade.y / 255.0;
  outputColor = vec4(fromSRGB(o), inputColor.a);
}
`;

export const BLEED = {
  threshold: 1.0, knee: 0.08, tight: 0.16, wide: 0.4, stain: 0.5, stainResponse: 2.2, weave: 0.5, warp: 0.004, edge: 0.12,
  exposure: 1, rain: 0.55, rainAngle: 0.14, rainSpeed: 520, vignette: 0.3, grain: 2.5, shadowBlue: 0.12,
  /** (render, E281) the toe (see the composite), the vibrance and the lit side's warmth. Pass 1's toe (0.5 to 0.32) sank
   *  the mockup cameras into a purple night: the mockups are high key, so only the deepest darks take a light toe */
  toe: 0.8, toeEnd: 0.22, vibrance: 0.15, warm: 0.06,
};

