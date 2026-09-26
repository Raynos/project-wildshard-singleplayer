// The frame for the neon lab: world → MSAA ×4 HDR target (alpha = bloom weight, or negative = wet ground for the
// 'screen' streaks) → half-res emissive-only prefilter → dual-filter pyramid (4 down + 3 up, 1/4 res result) → ONE
// composite that does everything else:
//   晕染 ink-bleed: the tight mip is added as LIGHT, the wide mip soaks into the silk as PIGMENT (a multiply glaze toward
//   the neon's hue on pale paper, so a halo on silk stays magenta instead of washing to white), both modulated by the
//   silk weave and a slow fibre warp so the edge is irregular, like colour dropped on wet paper;
//   'screen' streaks (optional): the emissive buffer mirrored about the horizon for wet-ground pixels;
//   drizzle: fine ruled diagonal hairlines in screen space (2 layers), lit by the bloom they cross;
//   a hue-preserving shoulder (scales by the max channel: saturated stays saturated, never clips to white), grain.
import {
  BufferGeometry, Float32BufferAttribute, HalfFloatType, LinearFilter, Mesh, NoBlending, OrthographicCamera, type PerspectiveCamera, type Scene,
  ShaderMaterial, type Texture, Vector2, Vector3, Vector4, type WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { NOISE } from './glsl';
import type { LabShared } from './shared';

const VS_FULL = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FS_PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform vec3 uPre; // x: 1 = alpha-weighted (selective), 0 = threshold; y: threshold; z: knee
varying vec2 vUv;
vec3 pick(vec4 s) {
  vec3 c = uPre.x > 0.5 ? s.rgb * clamp(s.a, 0.0, 1.0) : s.rgb;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uPre.y + uPre.z, 0.0, 2.0 * uPre.z);
  soft = soft * soft / (4.0 * uPre.z + 1e-4);
  return c * max(soft, br - uPre.y) / max(br, 1e-4);
}
void main() {
  vec3 a = pick(texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)));
  vec3 b = pick(texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)));
  vec3 c = pick(texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)));
  vec3 d = pick(texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)));
  // Karis average: one hot texel can't flicker the whole halo
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b)));
  float wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
  float wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 o = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  gl_FragColor = vec4(min(o, vec3(64.0)), 1.0);
}
`;
const FS_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 s = texture(tSrc, vUv).rgb * 4.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`;
const FS_UP = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
uniform float uAddW;
varying vec2 vUv;
void main() {
  vec3 s = vec3(0.0);
  s += texture(tSrc, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(2.0, 0.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(0.0, -2.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(0.0, 2.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture(tAdd, vUv).rgb * uAddW, 1.0);
}
`;

const FS_COMPOSITE = /* glsl */ `
${NOISE}
uniform sampler2D tScene;
uniform sampler2D tPre;    // half-res emissive (the 'screen' streak source)
uniform sampler2D tTight;  // 1/4 res, one down step of the emissive
uniform sampler2D tWide;   // 1/4 res, the whole pyramid summed
uniform sampler2D uSilk;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uBleed;   // x: tight light, y: wide light, z: stain (pigment glaze), w: stain response
uniform vec4 uBleed2;  // x: weave soak, y: fibre warp (uv), z: edge darkening, w: exposure
uniform vec4 uSS;      // x: on, y: horizon uv.y, z: gain, w: stretch (uv)
uniform vec4 uRain;    // x: strength, y: angle (rad), z: speed (px/s), w: px scale (DPR)
uniform vec3 uGrade;   // x: vignette, y: grain, z: shadow lift toward ink-blue
varying vec2 vUv;
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
  vec4 s = texture(tScene, vUv);
  vec3 c = s.rgb;
  // 'screen' streaks: mirror the emissive about the horizon, smeared along the screen vertical
  if (uSS.x > 0.5 && s.a < -0.002) {
    float k = -s.a;
    float my = 2.0 * uSS.y - vUv.y;
    float rip = (vnoise(vec2(vUv.y * 180.0, uTime * 0.6)) - 0.5) * 0.006;
    vec3 acc = vec3(0.0);
    float ws = 0.0;
    for (int i = 0; i < 8; i++) {
      float fi = float(i) / 7.0 - 0.3;
      float w = 1.0 - abs(fi) * 0.8;
      vec2 q = vec2(vUv.x + rip, my + fi * uSS.w);
      float inside = step(0.0, q.y) * step(q.y, 1.0);
      acc += texture(tTight, q).rgb * w * inside;
      ws += w;
    }
    c += acc / ws * k * uSS.z;
  }
  // 晕染: light from the tight mip, pigment from the wide one, both soaked by the weave; the fibre warp frays the edge
  vec2 warp = (vec2(vnoise(vUv * vec2(9.0, 18.0)), vnoise(vUv * vec2(9.0, 18.0) + 5.3)) - 0.5) * uBleed2.y;
  vec3 tight = texture(tTight, vUv + warp * 0.5).rgb;
  vec3 wide = texture(tWide, vUv + warp).rgb;
  float weave = texture(uSilk, gl_FragCoord.xy / (300.0 * uRain.w / 3.0)).r;
  float soak = 1.0 + (weave - 0.5) * uBleed2.x;
  float wl = max(wide.r, max(wide.g, wide.b));
  vec3 hue = wide / max(wl, 1e-4);
  float amt = (1.0 - exp(-wl * uBleed.w)) * uBleed.z * soak;
  // watercolour edge darkening: pigment piles up where the wet front stopped
  float front = smoothstep(0.05, 0.25, amt) * (1.0 - smoothstep(0.25, 0.6, amt));
  amt += front * uBleed2.z;
  float paper = smoothstep(0.04, 0.35, lum(c));
  c *= mix(vec3(1.0), mix(vec3(1.0), hue, clamp(amt, 0.0, 1.0)), paper);
  c += (tight * uBleed.x + wide * uBleed.y) * soak;
  // drizzle: two layers of ruled hairlines; they pick up the colour of the light they cross
  if (uRain.x > 0.0) {
    float r = rainLayer(gl_FragCoord.xy, 1.0, uRain.z, 0.28, 0.0) + 0.6 * rainLayer(gl_FragCoord.xy + 37.0, 0.55, uRain.z * 0.7, 0.3, 11.0);
    vec3 rc = vec3(0.86, 0.9, 0.97) * 0.55 + (tight + wide) * 1.6;
    c = mix(c, rc, clamp(r * uRain.x, 0.0, 1.0) * 0.55);
  }
  c *= uBleed2.w;
  c = shoulderHP(c);
  float l = lum(c);
  c = mix(c, c * vec3(0.9, 0.96, 1.1), (1.0 - smoothstep(0.02, 0.25, l)) * uGrade.z);
  c *= 1.0 + (weave - 0.5) * 0.035;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * uGrade.x;
  vec3 o = toSRGB(c);
  o += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 91.0) - 0.5) * uGrade.y / 255.0;
  gl_FragColor = vec4(o, 1.0);
}
`;

function fullTri(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export interface BleedLook {
  /** 1 = alpha-weighted (only what a material marks as light), 0 = luminance threshold */
  selective: number;
  threshold: number;
  knee: number;
  tight: number;
  wide: number;
  stain: number;
  stainResponse: number;
  weave: number;
  warp: number;
  edge: number;
  exposure: number;
  rain: number;
  rainAngle: number;
  rainSpeed: number;
  vignette: number;
  grain: number;
  shadowBlue: number;
  ssGain: number;
  ssStretch: number;
  bloomOn: boolean;
}

export const DEFAULT_BLEED: BleedLook = {
  selective: 1, threshold: 0.35, knee: 0.3, tight: 0.16, wide: 0.4, stain: 0.5, stainResponse: 2.2, weave: 0.5, warp: 0.004, edge: 0.12,
  exposure: 1, rain: 0.55, rainAngle: 0.14, rainSpeed: 520, vignette: 0.3, grain: 2.5, shadowBlue: 0.35, ssGain: 1.4, ssStretch: 0.12, bloomOn: true,
};

export class BleedPipeline {
  private readonly quad: Mesh;
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  readonly mComp: ShaderMaterial;
  private w = 0;
  private h = 0;
  look: BleedLook = { ...DEFAULT_BLEED };
  private dpr = 3;

  constructor(private readonly renderer: WebGLRenderer, private readonly shared: LabShared) {
    this.quad = new Mesh(fullTri());
    this.quad.frustumCulled = false;
    this.scene = this.makeScene(1, 1);
    const base = { vertexShader: VS_FULL, depthTest: false, depthWrite: false, blending: NoBlending };
    this.mPre = new ShaderMaterial({ ...base, fragmentShader: FS_PREFILTER, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uPre: { value: new Vector3(1, 0.35, 0.3) } } });
    this.mDown = new ShaderMaterial({ ...base, fragmentShader: FS_DOWN, uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } } });
    this.mUp = new ShaderMaterial({ ...base, fragmentShader: FS_UP, uniforms: { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new Vector2() }, uAddW: { value: 1 } } });
    this.mComp = new ShaderMaterial({
      ...base, fragmentShader: FS_COMPOSITE,
      uniforms: {
        tScene: { value: null }, tPre: { value: null }, tTight: { value: null }, tWide: { value: null }, uSilk: shared.u.uSilk,
        uRes: shared.u.uRes, uTime: shared.u.uTime,
        uBleed: { value: new Vector4() }, uBleed2: { value: new Vector4() }, uSS: { value: new Vector4() }, uRain: { value: new Vector4() },
        uGrade: { value: new Vector3() },
      },
    });
  }

  private makeScene(w: number, h: number): WebGLRenderTarget {
    const rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4, depthBuffer: true });
    rt.resolveDepthBuffer = false;
    return rt;
  }

  setSize(w: number, h: number, dpr: number): void {
    this.dpr = dpr;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.scene.dispose();
    this.scene = this.makeScene(w, h);
    for (const m of [...this.mips, ...this.ups]) m.dispose();
    this.mips = [];
    this.ups = [];
    let mw = Math.max(1, Math.round(w / 2)), mh = Math.max(1, Math.round(h / 2));
    for (let i = 0; i < 5; i++) {
      const rt = new WebGLRenderTarget(mw, mh, { type: HalfFloatType, depthBuffer: false });
      rt.texture.minFilter = LinearFilter;
      rt.texture.magFilter = LinearFilter;
      this.mips.push(rt);
      if (i >= 1 && i <= 3) {
        const up = new WebGLRenderTarget(mw, mh, { type: HalfFloatType, depthBuffer: false });
        up.texture.minFilter = LinearFilter;
        up.texture.magFilter = LinearFilter;
        this.ups.push(up);
      }
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
    }
    this.shared.u.uRes.value.set(w, h);
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.ortho);
  }

  private u(mat: ShaderMaterial, name: string): { value: unknown } {
    const x = mat.uniforms[name];
    if (x === undefined) throw new Error(`no uniform ${name}`);
    return x;
  }

  /** the horizon's screen v for a camera (for the 'screen' streaks) */
  static horizonV(camera: PerspectiveCamera): number {
    const e = camera.matrixWorld.elements;
    const fx = -e[8], fz = -e[10];
    const len = Math.max(Math.hypot(fx, fz), 1e-4);
    const p = new Vector3(camera.position.x + (fx / len) * 1000, camera.position.y, camera.position.z + (fz / len) * 1000);
    p.project(camera);
    return p.y * 0.5 + 0.5;
  }

  render(scene: Scene, camera: PerspectiveCamera, ssOn: boolean, clearColor: number): void {
    this.drawScene(scene, camera, clearColor, true);
    this.bloom();
    this.composite(camera, ssOn);
  }

  /** the world into the MSAA HDR target (clear = false draws over the last frame: the per-pass probe uses it) */
  drawScene(scene: Scene, camera: PerspectiveCamera, clearColor: number, clear: boolean): void {
    const r = this.renderer;
    r.autoClear = false;
    r.setRenderTarget(this.scene);
    if (clear) {
      r.setClearColor(clearColor, 0);
      r.clear(true, true, false);
    }
    r.render(scene, camera);
  }

  /** prefilter + the dual-filter pyramid */
  bloom(): void {
    const L = this.look;
    // bloom pyramid: prefilter → 1/2, down to 1/4, 1/8, 1/16, 1/32, up to 1/16, 1/8, 1/4
    const [m0, m1, m2, m3, m4] = this.mips;
    const [u1, u2, u3] = this.ups;
    if (m0 === undefined || m1 === undefined || m2 === undefined || m3 === undefined || m4 === undefined || u1 === undefined || u2 === undefined || u3 === undefined) return;
    (this.u(this.mPre, 'uPre').value as Vector3).set(L.selective, L.threshold, L.knee);
    this.u(this.mPre, 'tSrc').value = this.scene.texture;
    (this.u(this.mPre, 'uTexel').value as Vector2).set(1 / this.w, 1 / this.h);
    this.pass(this.mPre, m0);
    if (L.bloomOn) {
      const chain = [m0, m1, m2, m3, m4];
      for (let i = 1; i < chain.length; i++) {
        const src = chain[i - 1], dst = chain[i];
        if (src === undefined || dst === undefined) continue;
        this.u(this.mDown, 'tSrc').value = src.texture;
        (this.u(this.mDown, 'uTexel').value as Vector2).set(1 / src.width, 1 / src.height);
        this.pass(this.mDown, dst);
      }
      // up: u3 (1/16) = up(m4) + m3, u2 (1/8) = up(u3) + m2, u1 (1/4) = up(u2) + m1
      const ups: [WebGLRenderTarget, WebGLRenderTarget, WebGLRenderTarget][] = [[m4, m3, u3], [u3, m2, u2], [u2, m1, u1]];
      for (const [src, add, dst] of ups) {
        this.u(this.mUp, 'tSrc').value = src.texture;
        this.u(this.mUp, 'tAdd').value = add.texture;
        (this.u(this.mUp, 'uTexel').value as Vector2).set(1 / src.width, 1 / src.height);
        this.pass(this.mUp, dst);
      }
    }
  }

  /** the one composite to the canvas */
  composite(camera: PerspectiveCamera, ssOn: boolean): void {
    const L = this.look;
    const [m0, m1] = this.mips;
    const [u1] = this.ups;
    if (m0 === undefined || m1 === undefined || u1 === undefined) return;
    const c = this.mComp;
    this.u(c, 'tScene').value = this.scene.texture;
    this.u(c, 'tPre').value = m0.texture;
    this.u(c, 'tTight').value = m1.texture;
    this.u(c, 'tWide').value = u1.texture;
    const on = L.bloomOn ? 1 : 0;
    (this.u(c, 'uBleed').value as Vector4).set(L.tight * on, L.wide * on / 4, L.stain * on, L.stainResponse);
    (this.u(c, 'uBleed2').value as Vector4).set(L.weave, L.warp, L.edge, L.exposure);
    (this.u(c, 'uSS').value as Vector4).set(ssOn ? 1 : 0, BleedPipeline.horizonV(camera), L.ssGain, L.ssStretch);
    (this.u(c, 'uRain').value as Vector4).set(L.rain, L.rainAngle, L.rainSpeed, this.dpr);
    (this.u(c, 'uGrade').value as Vector3).set(L.vignette, L.grain, L.shadowBlue);
    this.pass(c, null);
  }

  get tex(): { scene: Texture } { return { scene: this.scene.texture }; }

  /** count non-finite texels in the half-res prefilter (a NaN anywhere in the lit scene lands here) */
  nanScan(): number {
    const m0 = this.mips[0];
    if (m0 === undefined) return -1;
    const buf = new Uint16Array(m0.width * m0.height * 4);
    this.renderer.readRenderTargetPixels(m0, 0, 0, m0.width, m0.height, buf);
    let bad = 0;
    for (let i = 0; i < buf.length; i += 4) {
      for (let k = 0; k < 3; k++) if (((buf[i + k] ?? 0) & 0x7c00) === 0x7c00) { bad++; break; }
    }
    return bad;
  }
}
