// The Jiehua bleed pyramid in the engine's composer (a `beforeChain` pass, ChunkDef.ShardComposition): the clean room's
// 晕染 bloom (look/post.ts), unchanged in its taps — a Karis prefilter (threshold 1.0, tight knee) at ½ res, 4 dual-filter
// downs to 1/32, 3 ups back to ¼ (tight = the ¼ mip, wide = the summed pyramid). The window glow rides in its alpha
// (light/glow.ts). The one change: the prefilter reads inverse depth from the scene's depth texture (the engine's scene
// target is not MSAA and its alpha is not the clean room's near / viewZ), so the pass asks for the depth.
// It writes only its own targets (needsSwap false): JiehuaEffect samples `tight` and `wide`.
import {
  HalfFloatType, LinearFilter, NoBlending, type PerspectiveCamera, ShaderMaterial, type Texture, type TextureDataType, UnsignedByteType,
  Vector2, type WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { Pass } from 'postprocessing';
import { GLOW_PRE_GLSL, type glowUniforms } from '../light/glow';

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

/** window depth below this is a viewmodel's near slice (core/worldDepth.ts DEPTH_SLICES), not the world */
export const VM_SLICE = 0.3;

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

const FS_PRE = /* glsl */ `
uniform sampler2D tSrc;
uniform highp sampler2D tDepth;
uniform vec2 uTexel;
uniform vec2 uPre; // x: threshold, y: knee
uniform float uNearP;
uniform float uFarP;
varying vec2 vUv;
${GLOW_PRE_GLSL}
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
const FS_DOWN = /* glsl */ `
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
const FS_UP = /* glsl */ `
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

type Glow = ReturnType<typeof glowUniforms>;

export class BleedPass extends Pass {
  private mips: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  private readonly uPre;
  private readonly uDown = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly uUp = { tSrc: { value: null as Texture | null }, tAdd: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  private type: TextureDataType = HalfFloatType;
  private w = 0;
  private h = 0;
  /** the ¼-res mip (the tight bleed) and the summed pyramid at ¼ (the wide one); null before the first setSize */
  tight: Texture | null = null;
  wide: Texture | null = null;

  constructor(private readonly view: PerspectiveCamera, glow: Glow, threshold = 1.0, knee = 0.08) {
    super('NdBleedPass');
    this.needsSwap = false;
    this.needsDepthTexture = true;
    this.uPre = {
      tSrc: { value: null as Texture | null }, tDepth: { value: null as Texture | null }, uTexel: { value: new Vector2() },
      uPre: { value: new Vector2(threshold, knee) }, uNearP: { value: 0.1 }, uFarP: { value: 1000 }, uGlow: glow.uGlow, uGlow2: glow.uGlow2,
    };
    const base = { vertexShader: VS, depthTest: false, depthWrite: false, blending: NoBlending };
    this.mPre = new ShaderMaterial({ ...base, name: 'NdBleedPre', fragmentShader: FS_PRE, uniforms: this.uPre });
    this.mDown = new ShaderMaterial({ ...base, name: 'NdBleedDown', fragmentShader: FS_DOWN, uniforms: this.uDown });
    this.mUp = new ShaderMaterial({ ...base, name: 'NdBleedUp', fragmentShader: FS_UP, uniforms: this.uUp });
    this.fullscreenMaterial = this.mPre;
  }

  override initialize(renderer: WebGLRenderer, _alpha: boolean, frameBufferType: number): void {
    const ext = renderer.extensions;
    this.type = frameBufferType === UnsignedByteType || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) ? UnsignedByteType : HalfFloatType;
  }

  override setDepthTexture(depthTexture: Texture): void { this.uPre.tDepth.value = depthTexture; }

  override setSize(width: number, height: number): void {
    if (width === this.w && height === this.h) return;
    this.w = width;
    this.h = height;
    for (const m of [...this.mips, ...this.ups]) m.dispose();
    this.mips = [];
    this.ups = [];
    let mw = Math.max(1, Math.round(width / 2)), mh = Math.max(1, Math.round(height / 2));
    for (let i = 0; i < 5; i++) {
      const rt = new WebGLRenderTarget(mw, mh, { type: this.type, depthBuffer: false });
      rt.texture.minFilter = LinearFilter;
      rt.texture.magFilter = LinearFilter;
      rt.texture.name = `NdBleed.mip${String(i)}`;
      this.mips.push(rt);
      if (i >= 1 && i <= 3) {
        const up = new WebGLRenderTarget(mw, mh, { type: this.type, depthBuffer: false });
        up.texture.minFilter = LinearFilter;
        up.texture.magFilter = LinearFilter;
        up.texture.name = `NdBleed.up${String(i)}`;
        this.ups.push(up);
      }
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
    }
    this.tight = this.mips[1]?.texture ?? null;
    this.wide = this.ups[0]?.texture ?? null;
  }

  private draw(renderer: WebGLRenderer, mat: ShaderMaterial, target: WebGLRenderTarget): void {
    this.fullscreenMaterial = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget | null): void {
    const [m0, m1, m2, m3, m4] = this.mips;
    const [u1, u2, u3] = this.ups;
    if (inputBuffer === null || m0 === undefined || m1 === undefined || m2 === undefined || m3 === undefined || m4 === undefined || u1 === undefined || u2 === undefined || u3 === undefined) return;
    this.uPre.tSrc.value = inputBuffer.texture;
    this.uPre.uTexel.value.set(1 / inputBuffer.width, 1 / inputBuffer.height);
    this.uPre.uNearP.value = this.view.near;
    this.uPre.uFarP.value = this.view.far;
    this.draw(renderer, this.mPre, m0);
    const chain = [m0, m1, m2, m3, m4];
    for (let i = 1; i < chain.length; i++) {
      const src = chain[i - 1], dst = chain[i];
      if (src === undefined || dst === undefined) continue;
      this.uDown.tSrc.value = src.texture;
      this.uDown.uTexel.value.set(1 / src.width, 1 / src.height);
      this.draw(renderer, this.mDown, dst);
    }
    const upChain: [WebGLRenderTarget, WebGLRenderTarget, WebGLRenderTarget][] = [[m4, m3, u3], [u3, m2, u2], [u2, m1, u1]];
    for (const [src, add, dst] of upChain) {
      this.uUp.tSrc.value = src.texture;
      this.uUp.tAdd.value = add.texture;
      this.uUp.uTexel.value.set(1 / src.width, 1 / src.height);
      this.draw(renderer, this.mUp, dst);
    }
  }

  override dispose(): void {
    for (const m of [...this.mips, ...this.ups]) m.dispose();
    this.mPre.dispose();
    this.mDown.dispose();
    this.mUp.dispose();
    super.dispose();
  }
}
