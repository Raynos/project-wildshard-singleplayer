// Nine Dragon's post passes as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily), SHARD-PLATFORM M3:
// the bleed pyramid (look/render/bleed.ts), the wet-stone reflection trace and its streak (reflect.ts), the lantern haze
// march and its add (haze.ts) and the Jiehua composite's fragment (jiehua.ts). `@{name}` splices what the shard passes
// (look/render/family.ts): the window glow's and the grade's GLSL, the light volume's, the flagstones'; a trace's or a
// march's step count (`steps`, `stepsF`) comes from its pass, one program per count.
import type { ShaderProgramRow } from '@wildshard/sdk/looks/shaderFamily';
import { FOG_GLSL, NOISE_GLSL, STONES_GLSL } from './look';

/** window depth below this is a viewmodel's near slice (core/worldDepth.ts DEPTH_SLICES), not the world */
export const VM_SLICE = 0.3;

export const PASS_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

/** `float invDepth(sampler, uv, near, far)`: 1 / viewZ (1/m) from a perspective depth texture; 0 = sky / far plane,
 *  a viewmodel's slice a flat 0.5 m */
export const INV_DEPTH_GLSL = /* glsl */ `
float invDepthAt(highp sampler2D dt, vec2 uv, float n, float f) {
  float d = texture(dt, uv).r;
  if (d >= 1.0) return 0.0;
  if (d < ${VM_SLICE.toFixed(2)}) return 2.0;
  float z = (n * f) / ((f - n) * d - f);
  return 1.0 / max(-z, n);
}
`;

export const BLEED_PRE = /* glsl */ `
uniform sampler2D tSrc;
uniform highp sampler2D tDepth;
uniform vec2 uTexel;
uniform vec2 uPre; // x: threshold, y: knee
uniform float uNearP;
uniform float uFarP;
varying vec2 vUv;
@{glowPre}
${INV_DEPTH_GLSL}
vec3 pick(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uPre.x + uPre.y, 0.0, 2.0 * uPre.y);
  soft = soft * soft / (4.0 * uPre.y + 1e-4);
  return c * max(soft, br - uPre.x) / max(br, 1e-4);
}
vec4 tap(vec2 o) {
  vec2 p = vUv + uTexel * o;
  // the clean room's alpha: near / viewZ
  return vec4(texture(tSrc, p).rgb, invDepthAt(tDepth, p, uNearP, uFarP) * uNearP);
}
void main() {
  vec4 ta = tap(vec2(-1.0, -1.0));
  vec4 tb = tap(vec2(1.0, -1.0));
  vec4 tc = tap(vec2(-1.0, 1.0));
  vec4 td = tap(vec2(1.0, 1.0));
  float glow = 0.25 * (glowSrc(ta, uNearP) + glowSrc(tb, uNearP) + glowSrc(tc, uNearP) + glowSrc(td, uNearP));
  vec3 a = pick(ta.rgb);
  vec3 b = pick(tb.rgb);
  vec3 c = pick(tc.rgb);
  vec3 d = pick(td.rgb);
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b)));
  float wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
  float wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 o = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  gl_FragColor = vec4(min(o, vec3(64.0)), glow);
}
`;

export const BLEED_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec4 s = texture(tSrc, vUv) * 4.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0));
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0));
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0));
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0));
  gl_FragColor = s / 8.0;
}
`;

export const BLEED_UP = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec4 s = vec4(0.0);
  s += texture(tSrc, vUv + uTexel * vec2(-2.0, 0.0));
  s += texture(tSrc, vUv + uTexel * vec2(2.0, 0.0));
  s += texture(tSrc, vUv + uTexel * vec2(0.0, -2.0));
  s += texture(tSrc, vUv + uTexel * vec2(0.0, 2.0));
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)) * 2.0;
  gl_FragColor = s / 12.0 + texture(tAdd, vUv);
}
`;

export const REFLECT_TRACE = /* glsl */ `
uniform sampler2D tColor;
uniform highp sampler2D tDepth;
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform mat4 uView;
uniform mat4 uCamWorld;
uniform vec2 uNF;
uniform vec4 uRect;   // the wet floor's x0, z0, x1, z1 (m)
uniform vec4 uRect2;  // a second wet rect (the stair-street), any floor height in it
uniform vec4 uK;      // x: floor y, y: gain, z: wobble, w: rings
uniform vec2 uMarch;  // x: max distance (m), y: first step (m)
uniform float uTime;
varying vec2 vUv;
${NOISE_GLSL}
@{flag}
${STONES_GLSL}
float linZ(float d) { return (uNF.x * uNF.y) / ((uNF.y - uNF.x) * d - uNF.y); } // view z (negative)
vec3 viewAt(vec2 uv, float d) {
  vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}
void main() {
  gl_FragColor = vec4(0.0);
  float d = texture(tDepth, vUv).r;
  if (d >= 1.0 || d < ${VM_SLICE.toFixed(2)} || uK.y <= 0.0) return;
  vec3 P = viewAt(vUv, d);
  vec3 W = (uCamWorld * vec4(P, 1.0)).xyz;
  bool inSquare = abs(W.y - uK.x) <= 0.05 && W.x >= uRect.x && W.x <= uRect.z && W.z >= uRect.y && W.z <= uRect.w;
  bool inStair = W.x >= uRect2.x && W.x <= uRect2.z && W.z >= uRect2.y && W.z <= uRect2.w;
  if (!inSquare && !inStair) return;
  if (!inSquare) {
    // (dome C2) any up-facing wet surface in the stair rect: the treads and landings, found by the depth's own normal —
    // the smaller of the two one-texel differences each way, so an edge's far side never tilts it
    vec2 tx = 1.0 / vec2(textureSize(tDepth, 0));
    vec3 Pr = viewAt(vUv + vec2(tx.x, 0.0), texture(tDepth, vUv + vec2(tx.x, 0.0)).r) - P;
    vec3 Pl = P - viewAt(vUv - vec2(tx.x, 0.0), texture(tDepth, vUv - vec2(tx.x, 0.0)).r);
    vec3 Pu = viewAt(vUv + vec2(0.0, tx.y), texture(tDepth, vUv + vec2(0.0, tx.y)).r) - P;
    vec3 Pd = P - viewAt(vUv - vec2(0.0, tx.y), texture(tDepth, vUv - vec2(0.0, tx.y)).r);
    vec3 dx = dot(Pr, Pr) < dot(Pl, Pl) ? Pr : Pl, dy = dot(Pu, Pu) < dot(Pd, Pd) ? Pu : Pd;
    vec3 nw = normalize(mat3(uCamWorld) * normalize(cross(dx, dy)));
    if (abs(nw.y) < 0.95) return;
  }
  // the ground's own wet film (style.ts kind 3): puddles wetter, the joints dry
  vec4 st = stone(W.xz, 1.1);
  float wet = mix(0.55, 1.0, st.z) * (1.0 - st.x);
  if (wet <= 0.01) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // the film's normal: a slow wobble (longer across the view than along it) and the drizzle's expanding rings
  vec2 p = W.xz;
  vec2 wob = vec2(vnoise(p * vec2(1.7, 0.6) + uTime * 0.21), vnoise(p * vec2(0.6, 1.7) - uTime * 0.17 + 9.1)) - 0.5;
  vec2 rc = floor(p / 1.1);
  float rp = fract(uTime * 0.7 + h12(rc + 5.0));
  vec2 ctr = (rc + 0.2 + 0.6 * vec2(h12(rc + 1.0), h12(rc + 2.0))) * 1.1;
  vec2 dv = p - ctr;
  float rr = length(dv);
  // (E337) squared by hand: pow() of a negative base is NaN under HLSL / D3D (Chrome on Windows)
  float rz = (rr - rp * 0.3) / 0.03;
  float ring = exp(-rz * rz) * (1.0 - rp);
  vec2 tilt = wob * uK.z + (dv / max(rr, 1e-3)) * ring * uK.w;
  vec3 nW = normalize(vec3(tilt.x, 1.0, tilt.y));
  vec3 nV = normalize(mat3(uView) * nW);
  vec3 Vv = normalize(P);
  vec3 Rv = reflect(Vv, nV);
  float cosT = clamp(-dot(Vv, nV), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  // march in screen space (McGuire & Mara's perspective-correct DDA, simplified): the reflected segment P → P1 (clipped
  // to the near plane) projected; view z / w and 1 / w are linear in screen space. Steps bunch near P ((i / N)^1.6):
  // the near reflections (posts, people, lanterns) are thin in screen, the far ones are wide
  vec3 P1 = P + Rv * uMarch.x;
  if (P1.z > -uNF.x * 2.0) P1 = P + Rv * ((-uNF.x * 2.0 - P.z) / max(Rv.z, 1e-4));
  vec4 H0 = uProj * vec4(P, 1.0), H1 = uProj * vec4(P1, 1.0);
  float k0 = 1.0 / H0.w, k1 = 1.0 / H1.w;
  vec2 S0 = H0.xy * k0, dS = H1.xy * k1 - S0;
  float z0 = P.z * k0, z1 = P1.z * k1;
  float fmax = 1.0;
  if (dS.x > 1e-6) fmax = min(fmax, (1.0 - S0.x) / dS.x); else if (dS.x < -1e-6) fmax = min(fmax, (-1.0 - S0.x) / dS.x);
  if (dS.y > 1e-6) fmax = min(fmax, (1.0 - S0.y) / dS.y); else if (dS.y < -1e-6) fmax = min(fmax, (-1.0 - S0.y) / dS.y);
  float jit = h12(gl_FragCoord.xy + fract(uTime * 3.7) * 29.0);
  float fPrev = 0.0, fHit = -1.0;
  for (int i = 1; i <= @{steps}; i++) {
    float f = fmax * pow((float(i) - 1.0 + jit) / @{stepsF}, 1.6);
    vec2 uv = (S0 + dS * f) * 0.5 + 0.5;
    float sd = texture(tDepth, uv).r;
    if (sd < 1.0 && sd >= ${VM_SLICE.toFixed(2)}) {
      float qz = -mix(z0, z1, f) / mix(k0, k1, f);
      float sz = -linZ(sd);
      if (qz > sz + 0.03 && qz < sz + 0.45 + 0.05 * sz) { fHit = f; break; }
    }
    fPrev = f;
  }
  vec2 huv = vec2(-1.0);
  float hitT = 0.0;
  if (fHit > 0.0) {
    float a = fPrev, b = fHit;
    for (int j = 0; j < 5; j++) {
      float m = 0.5 * (a + b);
      vec2 um = (S0 + dS * m) * 0.5 + 0.5;
      float qz = -mix(z0, z1, m) / mix(k0, k1, m);
      if (qz > -linZ(texture(tDepth, um).r) + 0.03) b = m; else a = m;
    }
    huv = (S0 + dS * b) * 0.5 + 0.5;
    float kb = mix(k0, k1, b);
    hitT = length(mix(P * k0, P1 * k1, b) / kb - P);
  }
  if (huv.x < 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 e = smoothstep(vec2(0.0), vec2(0.06, 0.1), huv) * (1.0 - smoothstep(vec2(0.94, 0.86), vec2(1.0), huv));
  float conf = e.x * e.y * (1.0 - smoothstep(uMarch.x * 0.6, uMarch.x, hitT));
  vec3 col = texture(tColor, huv).rgb;
  gl_FragColor = vec4(min(col, vec3(32.0)) * F * wet * conf * uK.y, 1.0);
}
`;

// a mask-aware 1D blur (½ res): the floor's own samples only, the centre's mask kept
export const REFLECT_STREAK = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uStep;   // one tap's offset in uv
varying vec2 vUv;
void main() {
  vec4 c = texture(tSrc, vUv);
  if (c.a <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 acc = c.rgb;
  float wsum = 1.0;
  for (int i = 1; i <= 6; i++) {
    float w = exp(-float(i * i) / 14.0);
    vec4 a = texture(tSrc, vUv + uStep * float(i));
    vec4 b = texture(tSrc, vUv - uStep * float(i));
    acc += (a.rgb * a.a + b.rgb * b.a) * w;
    wsum += (a.a + b.a) * w;
  }
  gl_FragColor = vec4(acc / wsum, c.a);
}
`;

export const HAZE_MARCH = /* glsl */ `
uniform highp sampler2D tDepth;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec2 uNF;
uniform vec4 uHz;     // x: σ, y: max distance, z: height falloff (m), w: drift
uniform vec4 uHz2;    // x: forward lobe, y: time, z: the per-step irradiance cap, w: its threshold
uniform float uGroundY;
varying vec2 vUv;
@{lightvol}
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h12(i.xy + i.z * 17.0), b = h12(i.xy + vec2(1.0, 0.0) + i.z * 17.0);
  float c = h12(i.xy + vec2(0.0, 1.0) + i.z * 17.0), d = h12(i.xy + vec2(1.0, 1.0) + i.z * 17.0);
  float e = h12(i.xy + (i.z + 1.0) * 17.0), g = h12(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 17.0);
  float hh = h12(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 17.0), k = h12(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 17.0);
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(hh, k, f.x), f.y), f.z);
}
void main() {
  float d = texture(tDepth, vUv).r;
  vec4 vr = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dirV = normalize(vr.xyz / vr.w);
  float dist = uHz.y;
  if (d < 1.0 && d >= ${VM_SLICE.toFixed(2)}) {
    float z = (uNF.x * uNF.y) / ((uNF.y - uNF.x) * d - uNF.y);
    dist = min(dist, -z / max(-dirV.z, 1e-4));
  }
  vec3 cam = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 dirW = normalize(mat3(uCamWorld) * dirV);
  float ds = dist / @{stepsF};
  float jit = h12(gl_FragCoord.xy + fract(uHz2.y * 7.31) * 53.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < @{steps}; i++) {
    float t = (float(i) + jit) * ds;
    vec3 p = cam + dirW * t;
    // the rain's medium: densest in the square's air, thinning upward, drifting slowly
    float hk = exp(-max(p.y - uGroundY, 0.0) / uHz.z);
    float nz = n3(p * vec3(0.22, 0.12, 0.22) + vec3(0.0, uHz2.y * 0.35, uHz2.y * 0.08));
    float sigma = uHz.x * hk * mix(1.0, 0.4 + 1.2 * nz, uHz.w);
    acc += max(min(lpRaw(p), vec3(uHz2.z)) - uHz2.w, 0.0) * sigma;
  }
  acc *= ds;
  // a mild forward lobe: looking toward the square's lights (level) the air glows more than looking down at the stone
  acc *= 1.0 + uHz2.x * (1.0 - abs(dirW.y));
  gl_FragColor = vec4(min(acc, vec3(8.0)), 1.0);
}
`;

export const HAZE_ADD = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture(tSrc, vUv).rgb, 0.0); }
`;

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
uniform float uSutra;
uniform float uTime;
uniform float uLineScale;
uniform float uLines;
uniform vec3 uInk;
uniform vec3 uGold;
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
@{glowComp}
@{grade}
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
      vec3 ink = mix(mix(uInk, uInk1, smoothstep(4.0, uInkMid, z)), uGold * 1.25, uSutra);
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
    vec3 rc = mix(vec3(0.86, 0.9, 0.97), vec3(0.85, 0.7, 0.4), uSutra) * 0.55 + (tight + wide) * 1.6;
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
  c = mix(c, c * vec3(0.9, 0.96, 1.1), (1.0 - smoothstep(0.02, 0.25, l)) * uGrade.z * (1.0 - uSutra));
  c *= 1.0 + (weave - 0.5) * 0.035;
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * uGrade.x;
  if (uLines > 1.5) c = mix(vec3(1.0), vec3(0.0), edge);
  vec3 o = gradeLut(toSRGB(c));
  o += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) * uGrade.y / 255.0;
  outputColor = vec4(fromSRGB(o), inputColor.a);
}
`;

const PASS = { vertex: PASS_VS, depthTest: false, depthWrite: false } as const;

/** every pass program's row (each pass hands its own uniforms) */
export const PASS_PROGRAMS = {
  bleedPre: { ...PASS, name: 'NdBleedPre', fragment: BLEED_PRE, blend: 'none' },
  bleedDown: { ...PASS, name: 'NdBleedDown', fragment: BLEED_DOWN, blend: 'none' },
  bleedUp: { ...PASS, name: 'NdBleedUp', fragment: BLEED_UP, blend: 'none' },
  reflectTrace: { ...PASS, name: 'NdReflectTrace', fragment: REFLECT_TRACE, blend: 'none' },
  reflectStreak: { ...PASS, name: 'NdReflectStreak', fragment: REFLECT_STREAK, blend: 'none' },
  hazeMarch: { ...PASS, name: 'NdHazeMarch', fragment: HAZE_MARCH, blend: 'none' },
  hazeAdd: { ...PASS, name: 'NdHazeAdd', fragment: HAZE_ADD, transparent: true, blend: 'addKeepAlpha' },
} as const satisfies Readonly<Record<string, ShaderProgramRow>>;
