// The Jiehua composite as an Effect in the engine's colour chain (ChunkDef.ShardComposition `chain`): the clean room's
// one composite (look/post.ts FS_COMPOSITE) — the depth silhouette in ink (gold in the sutra look), the 晕染 bleed (tight +
// wide added as light, the wide mip soaked into pale paper as a pigment glaze), the window glow, screen-space drizzle, the
// hue-preserving shoulder, the cool shadow lift, the weave, the vignette, the learned LUT and grain. The silhouette reads
// inverse depth from the scene's depth texture (the engine's scene target has no MSAA and no near / viewZ alpha): its
// lines alias where the clean room's resolved; SMAA, after this pass, takes them.
// The LUT is display-referred: the effect ends in display sRGB and hands the chain linear back (the SMAA pass encodes).
import { type Color, Matrix4, type PerspectiveCamera, type Texture, Uniform, Vector2, Vector3, Vector4, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { FOG_GLSL, NOISE_GLSL, type Shared } from '../style';
import { GLOW_COMP_GLSL, type glowUniforms } from '../light/glow';
import { GRADE_GLSL, type gradeUniforms } from '../light/grade';
import { VM_SLICE } from './bleed';

/** the neon lab's final bleed look (round-7-lab-neon README §3), as the clean room ran it (post.ts BLEED); round 14: the
 *  shadow lift toward ink-blue 0.35 → 0.12 (the mockups' darks are warm: style-A's mean is r > g > b, ours was blue) */
export const BLEED = {
  threshold: 1.0, knee: 0.08, tight: 0.16, wide: 0.4, stain: 0.5, stainResponse: 2.2, weave: 0.5, warp: 0.004, edge: 0.12,
  exposure: 1, rain: 0.55, rainAngle: 0.14, rainSpeed: 520, vignette: 0.3, grain: 2.5, shadowBlue: 0.12,
};

const FS = /* glsl */ `
uniform sampler2D tTight;
uniform sampler2D tWide;
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
      vec3 ink = mix(mix(uInk, uInk1, smoothstep(4.0, uInkMid, z)), uGold * 1.25, uSutra);
      vec3 lineC = ink * fg.a + fg.rgb;
      edge = e * pow(max(fg.a, 1e-4), uLineFog - 1.0);
      c = mix(c, lineC, edge);
    }
  }
  vec2 warp = (vec2(vnoise(uv * vec2(9.0, 18.0)), vnoise(uv * vec2(9.0, 18.0) + 5.3)) - 0.5) * uBleed2.y;
  vec4 tight4 = texture(tTight, uv + warp * 0.5);
  vec4 wide4 = texture(tWide, uv + warp);
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
    rc += texture(tHaze, uv).rgb * uRainHaze;
    c = mix(c, rc, clamp(rn * uRain.x, 0.0, 1.0) * 0.55);
  }
  c *= uBleed2.w;
  c = shoulderHP(c);
  float l = lum(c);
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

type Glow = ReturnType<typeof glowUniforms>;
type Grade = ReturnType<typeof gradeUniforms>;

export class JiehuaEffect extends Effect {
  readonly u;
  private readonly shared: Shared;

  constructor(private readonly view: PerspectiveCamera, shared: Shared, glow: Glow, grade: Grade) {
    const s = shared.u, B = BLEED;
    const u = {
      tTight: new Uniform<Texture | null>(null), tWide: new Uniform<Texture | null>(null), tHaze: new Uniform<Texture | null>(null), uRainHaze: new Uniform(6), tRefl: new Uniform<Texture | null>(null), uReflK: new Uniform(0), uSilk: new Uniform(s.uSilk.value),
      uTexel: new Uniform(new Vector2()), uSutra: new Uniform(0), uTime: new Uniform(0), uLineScale: new Uniform(1), uLines: new Uniform(1),
      uInk: new Uniform(s.uInk0.value), uGold: new Uniform(s.uGold.value), uInk1: new Uniform(s.uInk1.value), uInkMid: new Uniform(110), uLineFog: new Uniform(1.7),
      uDpr: new Uniform(1), uSilPx: new Uniform(new Vector2(2.1, 1.2)), uSilFade: new Uniform(new Vector2(60, 170)), uSilGain: new Uniform(0.35),
      uInvProj: new Uniform(new Matrix4()), uCamWorld: new Uniform(new Matrix4()), uNF: new Uniform(new Vector2(0.1, 1000)), uSharp: new Uniform(0),
      uCam: new Uniform(s.uCam.value), uFogBase: new Uniform(s.uFogBase.value), uFogStart: new Uniform(s.uFogStart.value), uFogBaseCol: new Uniform(s.uFogBaseCol.value),
      uShaft: new Uniform(s.uShaft.value), uShaftK: new Uniform(s.uShaftK.value), uBands: new Uniform(s.uBands.value), uBandCols: new Uniform(s.uBandCols.value),
      uBleed: new Uniform(new Vector4(B.tight, B.wide / 4, B.stain, B.stainResponse)),
      uBleed2: new Uniform(new Vector4(B.weave, B.warp, B.edge, B.exposure)),
      uRain: new Uniform(new Vector4(B.rain, B.rainAngle, B.rainSpeed, 2)),
      uGrade: new Uniform(new Vector3(B.vignette, B.grain, B.shadowBlue)),
      uGlow2: new Uniform(glow.uGlow2.value), uGlowCol: new Uniform<Color>(glow.uGlowCol.value),
      uLut: new Uniform(grade.uLut.value), uLutAmt: new Uniform(grade.uLutAmt.value),
    };
    super('NdJiehuaEffect', FS, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>(Object.entries(u)),
    });
    this.u = u;
    this.shared = shared;
    this.grade = grade;
  }

  private readonly grade: Grade;
  /** the bleed pyramid's outputs (re-read every frame: its targets are remade on a resize) */
  source: { tight: Texture | null; wide: Texture | null } | null = null;
  /** the haze march's in-scatter (lights the drizzle); null = none */
  haze: { texture: Texture | null; enabled: boolean } | null = null;
  /** how much of the haze a raindrop catches */
  rainHaze = 6;
  /** the wet floor's reflection (render/reflect.ts); null = none */
  refl: { texture: Texture | null; debugGain: number } | null = null;
  /** the unsharp mask's strength below 3× */
  sharpen = 0.35;

  override update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget): void {
    const u = this.u, s = this.shared.u, cam = this.view;
    u.tTight.value = this.source?.tight ?? null;
    u.tWide.value = this.source?.wide ?? null;
    u.tHaze.value = this.haze?.enabled === true ? this.haze.texture : null;
    u.uRainHaze.value = u.tHaze.value === null ? 0 : this.rainHaze;
    u.tRefl.value = this.refl?.texture ?? null;
    u.uReflK.value = u.tRefl.value === null ? 0 : (this.refl?.debugGain ?? 1);
    u.uTexel.value.set(1 / inputBuffer.width, 1 / inputBuffer.height);
    u.uNF.value.set(cam.near, cam.far);
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uCamWorld.value.copy(cam.matrixWorld);
    u.uTime.value = s.uTime.value;
    u.uSutra.value = s.uSutra.value;
    u.uDpr.value = s.uDpr.value;
    u.uInkMid.value = s.uInkMid.value;
    u.uLineFog.value = s.uLineFog.value;
    u.uFogBase.value = s.uFogBase.value;
    u.uFogStart.value = s.uFogStart.value;
    u.uLut.value = this.grade.uLut.value;
    u.uLutAmt.value = this.grade.uLutAmt.value;
    u.uRain.value.w = renderer.getPixelRatio();
    u.uSharp.value = renderer.getPixelRatio() < 2.5 ? this.sharpen : 0;
  }
}
