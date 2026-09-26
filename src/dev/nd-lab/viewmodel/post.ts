// The lab's frame (lab P8 "viewmodel", E169): a backdrop plate (a clean-room capture with the weapon off) under the
// viewmodel, then the clean room's bloom and grade so a lab frame reads the way the clean room will draw it.
//   1. an MSAA ×4 HDR target: the plate (linear, alpha 0) as a full-screen triangle, then the viewmodel (alpha 1; the
//      halo and the trail blend without touching alpha)
//   2. the clean room's 晕染 bloom: Karis prefilter at ½ (threshold 1.0: the plate is LDR, only the neon blooms), four
//      dual-filter downs, three ups
//   3. composite: the plate passes through as captured (it was graded already); viewmodel pixels get the clean room's
//      hue-preserving shoulder, cool shadow lift, weave and the screen-space drizzle; bloom over both; sRGB; grain.
// In the clean room none of this is needed: its post.ts already draws the vm in the near depth slice and grades it.
import {
  BufferGeometry, type Camera, Float32BufferAttribute, HalfFloatType, LinearFilter, Mesh, NoBlending, OrthographicCamera, type Scene, ShaderMaterial,
  type Texture, Vector2, type WebGLRenderer, WebGLRenderTarget,
} from 'three';

const VS_FULL = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FS_PLATE = /* glsl */ `
uniform sampler2D tPlate;
uniform vec4 uCrop;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tPlate, uCrop.xy + vUv * uCrop.zw).rgb, 0.0); }
`;
const FS_PRE = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform vec2 uPre;
varying vec2 vUv;
vec3 pick(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uPre.x + uPre.y, 0.0, 2.0 * uPre.y);
  soft = soft * soft / (4.0 * uPre.y + 1e-4);
  return c * max(soft, br - uPre.x) / max(br, 1e-4);
}
void main() {
  vec3 a = pick(texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  vec3 b = pick(texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb);
  vec3 c = pick(texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb);
  vec3 d = pick(texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b))), wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b))), wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  gl_FragColor = vec4(min((a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd), vec3(64.0)), 1.0);
}
`;
const FS_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`;
const FS_UP = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + uTexel * vec2(-2.0, 0.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + uTexel * vec2(0.0, -2.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.0, 2.0)).rgb;
  s += (texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb) * 2.0;
  s += (texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb) * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}
`;
const FS_COMP = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tTight;
uniform sampler2D tWide;
uniform sampler2D uSilk;
uniform vec2 uBloom;
uniform vec4 uRain;
uniform float uTime;
uniform float uGrain;
varying vec2 vUv;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 shoulderHP(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  float t = m < 0.72 ? m : 0.72 + 0.28 * (1.0 - exp(-(m - 0.72) / 0.28));
  return c * (t / max(m, 1e-5));
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
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
void main() {
  vec4 s = texture2D(tColor, vUv);
  vec3 c = s.rgb;
  float vm = clamp(s.a, 0.0, 1.0);
  vec3 tight = texture2D(tTight, vUv).rgb, wide = texture2D(tWide, vUv).rgb;
  float weave = texture2D(uSilk, gl_FragCoord.xy / (300.0 * uRain.w / 3.0)).r;
  // the viewmodel's grade (the clean room's composite, minus the pigment stain it only applies to pale paper)
  vec3 g = shoulderHP(c);
  float l = lum(g);
  g = mix(g, g * vec3(0.9, 0.96, 1.1), (1.0 - smoothstep(0.02, 0.25, l)) * 0.35);
  g *= 1.0 + (weave - 0.5) * 0.035;
  if (uRain.x > 0.0) {
    float rn = rainLayer(gl_FragCoord.xy, 1.0, uRain.z, 0.28, 0.0) + 0.6 * rainLayer(gl_FragCoord.xy + 37.0, 0.55, uRain.z * 0.7, 0.3, 11.0);
    g = mix(g, vec3(0.86, 0.9, 0.97) * 0.55 + (tight + wide) * 1.6, clamp(rn * uRain.x, 0.0, 1.0) * 0.55);
  }
  // plate pixels pass through (already graded); the halo / trail added over them are clamped by the shoulder too
  vec3 plate = c;
  float extra = max(0.0, max(c.r, max(c.g, c.b)) - 1.0);
  if (extra > 0.0) plate = shoulderHP(c);
  vec3 o = mix(plate, g, vm);
  o += (tight * uBloom.x + wide * uBloom.y);
  vec3 outc = toSRGB(o);
  outc += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) * uGrain / 255.0;
  gl_FragColor = vec4(outc, 1.0);
}
`;

function fullTri(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export class LabPost {
  private readonly quad = new Mesh(fullTri());
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rt: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  readonly mPlate: ShaderMaterial;
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  readonly mComp: ShaderMaterial;
  private w = 1;
  private h = 1;

  constructor(private readonly renderer: WebGLRenderer, silk: Texture) {
    this.quad.frustumCulled = false;
    const base = { vertexShader: VS_FULL, depthTest: false, depthWrite: false, blending: NoBlending };
    this.mPlate = new ShaderMaterial({ ...base, fragmentShader: FS_PLATE, uniforms: { tPlate: { value: null }, uCrop: { value: [0, 0, 1, 1] } } });
    this.mPre = new ShaderMaterial({ ...base, fragmentShader: FS_PRE, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uPre: { value: new Vector2(1.0, 0.08) } } });
    this.mDown = new ShaderMaterial({ ...base, fragmentShader: FS_DOWN, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } } });
    this.mUp = new ShaderMaterial({ ...base, fragmentShader: FS_UP, uniforms: { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new Vector2() } } });
    this.mComp = new ShaderMaterial({
      ...base,
      fragmentShader: FS_COMP,
      uniforms: {
        tColor: { value: null }, tTight: { value: null }, tWide: { value: null }, uSilk: { value: silk },
        uBloom: { value: new Vector2(0.16, 0.4) }, uRain: { value: [0.55, 0.14, 520, 3] }, uTime: { value: 0 }, uGrain: { value: 2.5 },
      },
    });
    this.rt = this.make(1, 1);
  }

  private make(w: number, h: number): WebGLRenderTarget {
    const rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 });
    rt.texture.minFilter = LinearFilter;
    rt.texture.magFilter = LinearFilter;
    return rt;
  }

  setSize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.rt.dispose();
    this.rt = this.make(w, h);
    for (const m of [...this.mips, ...this.ups]) m.dispose();
    this.mips = [];
    this.ups = [];
    let mw = Math.max(1, Math.round(w / 2)), mh = Math.max(1, Math.round(h / 2));
    for (let i = 0; i < 5; i++) {
      const rt = new WebGLRenderTarget(mw, mh, { type: HalfFloatType, depthBuffer: false });
      rt.texture.minFilter = LinearFilter;
      this.mips.push(rt);
      if (i >= 1 && i <= 3) {
        const up = new WebGLRenderTarget(mw, mh, { type: HalfFloatType, depthBuffer: false });
        up.texture.minFilter = LinearFilter;
        this.ups.push(up);
      }
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
    }
    const rain = this.mComp.uniforms['uRain'];
    if (rain !== undefined) rain.value = [0.55, 0.14, 520, dpr];
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.ortho);
  }

  private set(m: ShaderMaterial, k: string, v: unknown): void {
    const u = m.uniforms[k];
    if (u !== undefined) u.value = v;
  }

  private texel(m: ShaderMaterial, x: number, y: number): void {
    const u = m.uniforms['uTexel'];
    if (u !== undefined && u.value instanceof Vector2) u.value.set(x, y);
  }

  render(plate: Texture | null, vmScene: Scene, vmCamera: Camera, time: number): void {
    const r = this.renderer;
    r.autoClear = false;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    if (plate !== null) {
      this.set(this.mPlate, 'tPlate', plate);
      this.pass(this.mPlate, this.rt);
    }
    r.setRenderTarget(this.rt);
    r.render(vmScene, vmCamera);
    const [m0, m1, m2, m3, m4] = this.mips;
    const [u1, u2, u3] = this.ups;
    if (m0 === undefined || m1 === undefined || m2 === undefined || m3 === undefined || m4 === undefined || u1 === undefined || u2 === undefined || u3 === undefined) return;
    this.set(this.mPre, 'tSrc', this.rt.texture);
    this.texel(this.mPre, 1 / this.w, 1 / this.h);
    this.pass(this.mPre, m0);
    const chain = [m0, m1, m2, m3, m4];
    for (let i = 1; i < chain.length; i++) {
      const src = chain[i - 1], dst = chain[i];
      if (src === undefined || dst === undefined) continue;
      this.set(this.mDown, 'tSrc', src.texture);
      this.texel(this.mDown, 1 / src.width, 1 / src.height);
      this.pass(this.mDown, dst);
    }
    const upChain: [WebGLRenderTarget, WebGLRenderTarget, WebGLRenderTarget][] = [[m4, m3, u3], [u3, m2, u2], [u2, m1, u1]];
    for (const [src, add, dst] of upChain) {
      this.set(this.mUp, 'tSrc', src.texture);
      this.set(this.mUp, 'tAdd', add.texture);
      this.texel(this.mUp, 1 / src.width, 1 / src.height);
      this.pass(this.mUp, dst);
    }
    this.set(this.mComp, 'tColor', this.rt.texture);
    this.set(this.mComp, 'tTight', m1.texture);
    this.set(this.mComp, 'tWide', u1.texture);
    this.set(this.mComp, 'uTime', time);
    this.pass(this.mComp, null);
  }
}
