// Lab P9 "grapple" (E169): the frame. A trimmed copy of the facade lab's pipeline (MSAA ×4 HDR target with depth →
// half-res dual-filter bloom → one composite) with what the grapple needs on top:
//  - DEPTH SLICES (lab P4's learning 8): the world is drawn into depth [0.3, 1], the viewmodel into [0, 0.3), so the
//    arm is always in front AND the post silhouette still sees every world edge (a depth clear would erase them);
//  - the ZIP: a radial smear toward the hook (the Chungking Express step-print: jittered taps, stronger at the rim),
//    silk-white speed lines streaming out of the focus, and dark ink-wash brush streaks at the frame's edge;
//  - the lock-on reticle (HUD language: cyan hairline brackets, gold when a dragon hook is locked) + the centre ticks;
//  - an exposure kick on the shot and the bite, vignette, silk grain.
import {
  AdditiveBlending, BufferGeometry, type Camera, Color, DepthTexture, Float32BufferAttribute, HalfFloatType, Mesh, NearestFilter,
  NoBlending, OrthographicCamera, type Scene, ShaderMaterial, type Texture, UnsignedIntType, Vector2, type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FS_PRE = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThr;
varying vec2 vUv;
void main() {
  vec3 a = texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb, b = texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  vec3 c = texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb, d = texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b))), wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b))), wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  float br = max(col.r, max(col.g, col.b));
  gl_FragColor = vec4(col * max(br - uThr, 0.0) / max(br, 1e-4), 1.0);
}
`;
const FS_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture(tSrc, vUv).rgb * 4.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`;
const FS_UP = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = (texture(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb
    + texture(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb) * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 12.0 * 0.9, 1.0);
}
`;
const FS_COMP = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D uSilk;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uSlice;
uniform float uBloom;
uniform float uLineScale;
uniform float uTime;
uniform vec3 uInk;
uniform float uAspect;
uniform float uSpeed;
uniform vec2 uFocus;
uniform vec2 uRetAt;
uniform float uRetLock;
uniform float uRetAlpha;
uniform float uRetSize;
uniform float uExpo;
uniform float uTicks;
uniform float uRain;
uniform float uGain;
uniform float uGamma;
uniform float uSat;
uniform vec3 uCyan;
uniform vec3 uGold;
varying vec2 vUv;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float ldw(float z) { return 2.0 * uNear * uFar / (uFar + uNear - (2.0 * z - 1.0) * (uFar - uNear)); }
// the world lives in depth [uSlice, 1]; the viewmodel in front of it returns -1 (no silhouette there)
float ld(float z) { return z < uSlice ? -1.0 : ldw((z - uSlice) / (1.0 - uSlice)); }
float invD(vec2 uv) { float d = ld(texture(tDepth, uv).r); return d < 0.0 ? 1.0 / uNear : 1.0 / d; }
vec3 shoulder(vec3 x) { vec3 k = 0.74 + 0.26 * (1.0 - exp(-(x - 0.74) / 0.26)); return mix(x, k, step(0.74, x)); }
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float contour(vec2 uv, float wc, float r) {
  vec2 o1 = vec2(r, 0.0) * uTexel, o2 = vec2(0.0, r) * uTexel, o3 = vec2(r, r) * uTexel * 0.7071, o4 = vec2(r, -r) * uTexel * 0.7071;
  float l1 = (invD(uv + o1) + invD(uv - o1) - 2.0 * wc) / wc;
  float l2 = (invD(uv + o2) + invD(uv - o2) - 2.0 * wc) / wc;
  float l3 = (invD(uv + o3) + invD(uv - o3) - 2.0 * wc) / wc;
  float l4 = (invD(uv + o4) + invD(uv - o4) - 2.0 * wc) / wc;
  return smoothstep(0.012, 0.06, -min(min(l1, l2), min(l3, l4)));
}
// a hairline box-bracket corner: p in reticle space (units of its half size), returns coverage
float bracket(vec2 p, float px) {
  vec2 a = abs(p);
  float arm = 0.38;
  float onX = step(1.0 - arm, a.x) * step(a.x, 1.0) * (1.0 - smoothstep(px * 0.5, px * 0.5 + px, abs(a.y - 1.0)));
  float onY = step(1.0 - arm, a.y) * step(a.y, 1.0) * (1.0 - smoothstep(px * 0.5, px * 0.5 + px, abs(a.x - 1.0)));
  return max(onX, onY);
}
void main() {
  vec2 uv = vUv;
  vec2 fuv = uFocus * 0.5 + 0.5;
  vec2 dq = (uv - fuv) * vec2(uAspect, 1.0);
  float r = length(dq);
  // the zip smear: taps toward the focus, jittered per frame (step-printing), none at the focus
  vec4 c4 = texture(tColor, uv);
  vec3 c = c4.rgb;
  float amt = uSpeed * 0.05 * smoothstep(0.08, 0.6, r);
  if (amt > 0.0005) {
    vec3 acc = c;
    float wsum = 1.0;
    float jit = h11(floor(uTime * 24.0)) * 0.5;
    for (int i = 1; i <= 9; i++) {
      float s = (float(i) + jit) / 9.0;
      float w = 1.0 - s * 0.6;
      acc += texture(tColor, uv + (fuv - uv) * s * amt).rgb * w;
      wsum += w;
    }
    c = acc / wsum;
  }
  float zc = texture(tDepth, uv).r;
  float dc = ld(zc);
  if (dc > 0.0 && zc < 0.999999) {
    float rr = uLineScale * mix(1.3, 0.8, smoothstep(3.0, 60.0, dc));
    float edge = max(contour(uv, 1.0 / dc, rr), contour(uv, 1.0 / dc, rr * 0.5) * 0.8);
    edge *= (1.0 - smoothstep(50.0, 190.0, dc)) * smoothstep(0.2, 0.75, c4.a) * (1.0 - uSpeed * 0.6);
    vec3 lineC = mix(uInk, c, smoothstep(12.0, 160.0, dc) * 0.85);
    c = mix(c, lineC, edge);
  }
  // the blue-hour grade (fitted to the codex targets of this lab's own frames: ~0.55× darker mids, deeper shadows,
  // more saturated warm windows and lanterns; the HDR lights pass through untouched)
  float mx = max(c.r, max(c.g, c.b));
  vec3 graded = uGain * pow(max(c, vec3(0.0)), vec3(uGamma));
  c = mix(graded, c, smoothstep(0.7, 1.6, mx));
  float lu = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(lu), c, uSat), vec3(0.0));
  c *= mix(vec3(0.92, 0.96, 1.07), vec3(1.0), smoothstep(0.05, 0.4, lu));
  float weave = texture(uSilk, gl_FragCoord.xy / 320.0).r;
  c += texture(tBloom, uv).rgb * uBloom * (0.78 + 0.44 * weave);
  // speed lines: silk-white streaks streaming out of the focus, and dark ink-wash brush streaks at the edge
  if (uSpeed > 0.001) {
    float a = atan(dq.y, dq.x);
    float lane = floor(a * 70.0);
    float pick = step(0.8, h11(lane * 1.37 + 3.0));
    float along = fract(r * 1.6 - uTime * (2.4 + h11(lane) * 2.0) + h11(lane * 7.1));
    float seg = smoothstep(0.0, 0.08, along) * (1.0 - smoothstep(0.38, 0.55, along));
    float across = abs(fract(a * 70.0) - 0.5);
    float thin = 1.0 - smoothstep(0.06, 0.14, across);
    float sl = pick * seg * thin * smoothstep(0.22, 0.6, r) * uSpeed;
    c = mix(c, vec3(0.93, 0.95, 0.97), sl * 0.75);
    // the ink streaks: the silk fibre sampled in polar space, stretched along the rays, only at the rim
    float ink = texture(uSilk, vec2(a * 3.0, r * 0.35 - uTime * 1.6)).r;
    ink = smoothstep(0.55, 0.85, ink) * smoothstep(0.42, 0.95, r) * uSpeed;
    c = mix(c, uInk * 1.4, ink * 0.55);
  }
  // light drizzle: sparse thin falling streaks in three depths (comp-B's rain), stretched while zipping
  for (int k = 0; k < 3; k++) {
    float sc = 1.0 + float(k) * 0.8;
    vec2 p = vec2(uv.x * uAspect * 150.0 * sc + uv.y * 9.0, uv.y * (3.2 - uSpeed * 1.8) * sc + uTime * (3.6 + float(k) * 0.9));
    vec2 cell = floor(p);
    float on = step(0.955, h12(cell + float(k) * 13.1));
    vec2 f = fract(p);
    float streak = on * (1.0 - smoothstep(0.02, 0.12, abs(f.x - 0.5))) * smoothstep(0.0, 0.25, f.y) * (1.0 - smoothstep(0.45, 0.9, f.y));
    c += vec3(0.78, 0.84, 0.95) * streak * 0.07 / sc * uRain;
  }
  c *= 1.0 + uExpo;
  c = shoulder(c);
  c *= 1.0 + (weave - 0.5) * 0.04;
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * (0.28 + uSpeed * 0.5);
  vec3 o = toSRGB(c);
  // HUD: the centre ticks + the lock-on brackets (drawn in sRGB, over the frame)
  vec2 px = gl_FragCoord.xy;
  vec2 res = 1.0 / uTexel;
  float unit = res.y;
  vec2 cp = (px - res * 0.5) / unit;
  float tk = 0.0;
  float lw = 1.6 / unit * max(res.x / 1206.0, 0.5) * 1.5;
  for (int i = 0; i < 4; i++) {
    vec2 d = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
    float along = dot(cp, d);
    float acr = abs(dot(cp, vec2(-d.y, d.x)));
    tk = max(tk, step(0.008, along) * step(along, 0.02) * (1.0 - smoothstep(lw * 0.5, lw * 1.5, acr)));
  }
  o = mix(o, vec3(0.93, 0.97, 1.0), tk * 0.8 * uTicks);
  if (uRetAlpha > 0.001) {
    vec2 rc = (uRetAt * 0.5 + 0.5) * res;
    float hs = 0.06 * uRetSize * unit;
    vec2 p = (px - rc) / hs;
    float br = bracket(p, lw * unit / hs);
    // a thin diamond pip at the centre when locked
    float pip = (1.0 - smoothstep(0.08, 0.08 + lw * unit / hs, abs(p.x) + abs(p.y))) * uRetLock;
    vec3 rcol = mix(uCyan, uGold * 1.25, uRetLock);
    o = mix(o, rcol, clamp(br + pip, 0.0, 1.0) * uRetAlpha);
  }
  o += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) / 255.0;
  gl_FragColor = vec4(o, 1.0);
}
`;

function fullTri(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export const SLICE = 0.3;

export class Pipeline {
  private readonly quad = new Mesh(fullTri());
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rt: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private readonly uPre = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() }, uThr: { value: 0.85 } };
  private readonly uDown = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly uUp = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  readonly u;
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  private readonly mComp: ShaderMaterial;
  private w = 1;
  private h = 1;
  /** the sky / clear colour (linear) */
  readonly clearColor = new Color(0.4, 0.45, 0.55);

  constructor(private readonly renderer: WebGLRenderer, silk: Texture) {
    this.quad.frustumCulled = false;
    this.rt = this.make(1, 1);
    const base = { vertexShader: VS, depthTest: false, depthWrite: false, blending: NoBlending };
    this.mPre = new ShaderMaterial({ ...base, fragmentShader: FS_PRE, uniforms: this.uPre });
    this.mDown = new ShaderMaterial({ ...base, fragmentShader: FS_DOWN, uniforms: this.uDown });
    this.mUp = new ShaderMaterial({ ...base, fragmentShader: FS_UP, blending: AdditiveBlending, uniforms: this.uUp });
    this.u = {
      tColor: { value: null as Texture | null }, tDepth: { value: null as Texture | null }, tBloom: { value: null as Texture | null },
      uSilk: { value: silk }, uTexel: { value: new Vector2() }, uNear: { value: 0.1 }, uFar: { value: 1200 },
      uSlice: { value: SLICE }, uBloom: { value: 0.85 }, uLineScale: { value: 1.5 }, uTime: { value: 0 },
      uInk: { value: new Color(0x14161c) }, uAspect: { value: 0.46 }, uSpeed: { value: 0 }, uFocus: { value: new Vector2() },
      uRetAt: { value: new Vector2() }, uRetLock: { value: 0 }, uRetAlpha: { value: 0 }, uRetSize: { value: 1 },
      uExpo: { value: 0 }, uTicks: { value: 1 }, uRain: { value: 1 }, uGain: { value: 0.6 }, uGamma: { value: 1.22 }, uSat: { value: 1.25 }, uCyan: { value: new Color(0x8fe3ff) }, uGold: { value: new Color(0xe8c46a) },
    };
    this.mComp = new ShaderMaterial({ ...base, fragmentShader: FS_COMP, uniforms: this.u });
  }

  private make(w: number, h: number): WebGLRenderTarget {
    const depth = new DepthTexture(w, h, UnsignedIntType);
    depth.minFilter = NearestFilter;
    depth.magFilter = NearestFilter;
    return new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4, depthBuffer: true, depthTexture: depth });
  }

  setSize(w: number, h: number, lineScale: number): void {
    this.u.uLineScale.value = lineScale;
    this.u.uAspect.value = w / h;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.rt.dispose();
    this.rt = this.make(w, h);
    for (const m of this.mips) m.dispose();
    this.mips = [];
    let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
    for (let i = 0; i < 5; i++) {
      this.mips.push(new WebGLRenderTarget(mw, mh, { type: HalfFloatType, depthBuffer: false }));
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
    }
  }

  private pass(m: ShaderMaterial, target: WebGLRenderTarget | null, clear = true): void {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    if (clear) this.renderer.clear(true, false, false);
    this.renderer.render(this.quad, this.ortho);
  }

  /** world into depth [SLICE, 1], the viewmodel into [0, SLICE), then bloom and the composite */
  render(world: Scene, camera: Camera & { near: number; far: number }, vm: Scene, vmCamera: Camera, time: number): void {
    const r = this.renderer;
    const gl = r.getContext();
    r.setRenderTarget(this.rt);
    r.setClearColor(this.clearColor, 1);
    r.clear(true, true, false);
    gl.depthRange(SLICE, 1);
    r.render(world, camera);
    gl.depthRange(0, SLICE);
    r.render(vm, vmCamera);
    gl.depthRange(0, 1);
    const m0 = this.mips[0];
    if (m0 !== undefined) {
      this.uPre.tSrc.value = this.rt.texture;
      this.uPre.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mPre, m0);
      for (let i = 1; i < this.mips.length; i++) {
        const src = this.mips[i - 1], dst = this.mips[i];
        if (src === undefined || dst === undefined) continue;
        this.uDown.tSrc.value = src.texture;
        this.uDown.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.mDown, dst);
      }
      for (let i = this.mips.length - 1; i > 0; i--) {
        const src = this.mips[i], dst = this.mips[i - 1];
        if (src === undefined || dst === undefined) continue;
        this.uUp.tSrc.value = src.texture;
        this.uUp.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(this.mUp, dst, false);
      }
    }
    this.u.tColor.value = this.rt.texture;
    this.u.tDepth.value = this.rt.depthTexture;
    this.u.tBloom.value = m0 === undefined ? null : m0.texture;
    this.u.uTexel.value.set(1 / this.w, 1 / this.h);
    this.u.uNear.value = camera.near;
    this.u.uFar.value = camera.far;
    this.u.uTime.value = time;
    this.pass(this.mComp, null);
  }
}
