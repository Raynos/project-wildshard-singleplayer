// The frame: (1) the world into an MSAA ×4 HDR target, the viewmodel in a near depth slice (no clear, no copy: the
// depth texture holds both), (2) the neon lab's 晕染 bloom: a Karis prefilter (threshold 1.0, tight knee) at ½ res,
// 4 dual-filter downs to 1/32 and 3 ups back to ¼ (tight = the ¼ mip, wide = the summed pyramid), (3) one composite:
// the depth silhouette (ink, gold in the sutra look), the bleed — tight + wide added as LIGHT, the wide mip soaked into
// pale paper as PIGMENT (a multiply glaze toward the neon's hue, a darker wet front, the silk weave, a fibre warp) —
// screen-space drizzle (two layers of ruled hairlines, zero draws), a hue-preserving shoulder, a cool shadow lift and
// grain. The wet-ground streaks are geometry now (streaks.ts), so there is no mirror pass.
import {
  BufferGeometry, type Camera, DepthTexture, Float32BufferAttribute, HalfFloatType, LinearFilter, Matrix4, Mesh, NearestFilter, NoBlending,
  OrthographicCamera, type PerspectiveCamera, type Scene, ShaderMaterial, type Texture, type TextureDataType, UnsignedByteType,
  UnsignedIntType, Vector2, Vector3, Vector4, type WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { FOG_GLSL, NOISE_GLSL, type Shared } from './style';
// (lab P6) the window glow rides in the bloom pyramid's alpha; the learned LUT is the composite's last colour step
import { GLOW_COMP_GLSL, GLOW_PRE_GLSL, glowUniforms } from './light/glow';
import { GRADE_GLSL, gradeUniforms } from './light/grade';

const VS_FULL = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FS_PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform vec2 uPre; // x: threshold, y: knee
uniform float uNearP;
varying vec2 vUv;
${GLOW_PRE_GLSL}
vec3 pick(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uPre.x + uPre.y, 0.0, 2.0 * uPre.y);
  soft = soft * soft / (4.0 * uPre.y + 1e-4);
  return c * max(soft, br - uPre.x) / max(br, 1e-4);
}
void main() {
  vec4 ta = texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0));
  vec4 tb = texture(tSrc, vUv + uTexel * vec2(1.0, -1.0));
  vec4 tc = texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0));
  vec4 td = texture(tSrc, vUv + uTexel * vec2(1.0, 1.0));
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

/** window depth [0, SLICE) holds the viewmodel, [SLICE, 1] the world */
export const SLICE = 0.05;

const FS_COMPOSITE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tTight;
uniform sampler2D tWide;
uniform sampler2D uSilk;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
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
varying vec2 vUv;
${NOISE_GLSL}
${FOG_GLSL}
${GLOW_COMP_GLSL}
${GRADE_GLSL}
// inverse depth (1/m) from the colour target's alpha (near / viewZ, MSAA-resolved, so antialiased): linear across a
// plane in screen space, so its Laplacian is 0 on flat faces and only folds toward the eye survive (the ink lab's)
float wAt(vec2 uv) { return texture(tColor, uv).a / uNear; }
float fold(vec2 uv, float wc, float r) {
  vec2 o1 = vec2(r, 0.0) * uTexel, o2 = vec2(0.0, r) * uTexel, o3 = vec2(r, r) * uTexel * 0.7071, o4 = vec2(r, -r) * uTexel * 0.7071;
  float l1 = (wAt(uv + o1) + wAt(uv - o1) - 2.0 * wc) / wc;
  float l2 = (wAt(uv + o2) + wAt(uv - o2) - 2.0 * wc) / wc;
  float l3 = (wAt(uv + o3) + wAt(uv - o3) - 2.0 * wc) / wc;
  float l4 = (wAt(uv + o4) + wAt(uv - o4) - 2.0 * wc) / wc;
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
  vec3 c = texture(tColor, vUv).rgb;
  float edge = 0.0;
  float wc = wAt(vUv);
  if (wc > 1e-5 && uLines > 0.5) {
    float z = 1.0 / wc;
    float r = mix(uSilPx.x, uSilPx.y, smoothstep(4.0, 60.0, z)) * uDpr * (z < 1.6 ? 1.6 : 1.0) * uLineScale;
    // two radii half a pixel apart, averaged: the outer border gets a one-pixel ramp instead of a stair
    float e = 0.5 * (clamp(fold(vUv, wc, r - 0.5) / uSilGain, 0.0, 1.0) + clamp(fold(vUv, wc, r + 0.5) / uSilGain, 0.0, 1.0));
    e = max(e, clamp(fold(vUv, wc, max(r * 0.5, 1.0)) / uSilGain, 0.0, 1.0));
    e *= 1.0 - smoothstep(uSilFade.x, uSilFade.y, z);
    if (e > 0.002) {
      // the line sits on the near surface: fog it like that surface (lines dissolve before the wash)
      vec4 vr = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
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
  // 晕染: light from the tight mip, pigment from the wide one, both soaked by the weave; the fibre warp frays the edge
  vec2 warp = (vec2(vnoise(vUv * vec2(9.0, 18.0)), vnoise(vUv * vec2(9.0, 18.0) + 5.3)) - 0.5) * uBleed2.y;
  vec4 tight4 = texture(tTight, vUv + warp * 0.5);
  vec4 wide4 = texture(tWide, vUv + warp);
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
  // (lab P6) warm window glow in the fog (the pyramid's alpha), kept off anything nearer than the glow
  c += glowAdd(tight4.a, wide4.a * 0.25, wc > 1e-5 ? 1.0 / wc : 1e4) * soak;
  if (uRain.x > 0.0) {
    float rn = rainLayer(gl_FragCoord.xy, 1.0, uRain.z, 0.28, 0.0) + 0.6 * rainLayer(gl_FragCoord.xy + 37.0, 0.55, uRain.z * 0.7, 0.3, 11.0);
    vec3 rc = mix(vec3(0.86, 0.9, 0.97), vec3(0.85, 0.7, 0.4), uSutra) * 0.55 + (tight + wide) * 1.6;
    c = mix(c, rc, clamp(rn * uRain.x, 0.0, 1.0) * 0.55);
  }
  c *= uBleed2.w;
  c = shoulderHP(c);
  float l = lum(c);
  c = mix(c, c * vec3(0.9, 0.96, 1.1), (1.0 - smoothstep(0.02, 0.25, l)) * uGrade.z * (1.0 - uSutra));
  c *= 1.0 + (weave - 0.5) * 0.035;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * uGrade.x;
  if (uLines > 1.5) c = mix(vec3(1.0), vec3(0.0), edge);
  vec3 o = gradeLut(toSRGB(c));
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

/** the neon lab's final bleed look (round-7-lab-neon README §3) */
export const BLEED = {
  threshold: 1.0, knee: 0.08, tight: 0.16, wide: 0.4, stain: 0.5, stainResponse: 2.2, weave: 0.5, warp: 0.004, edge: 0.12,
  exposure: 1, rain: 0.55, rainAngle: 0.14, rainSpeed: 520, vignette: 0.3, grain: 2.5, shadowBlue: 0.35,
};

export class Pipeline {
  private readonly quad: Mesh;
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rtScene: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  readonly mComp: ShaderMaterial;
  readonly glow = glowUniforms();
  readonly grade = gradeUniforms();
  private readonly uPre = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() }, uPre: { value: new Vector2(BLEED.threshold, BLEED.knee) }, uNearP: { value: 0.1 }, uGlow: this.glow.uGlow, uGlow2: this.glow.uGlow2 };
  private readonly uDown = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly uUp = { tSrc: { value: null as Texture | null }, tAdd: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  readonly uComp;
  private readonly type: TextureDataType;
  private w = 1;
  private h = 1;

  constructor(private readonly renderer: WebGLRenderer, private readonly shared: Shared) {
    const ext = renderer.extensions;
    this.type = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? HalfFloatType : UnsignedByteType;
    this.quad = new Mesh(fullTri());
    this.quad.frustumCulled = false;
    this.rtScene = this.makeScene(1, 1);
    const base = { vertexShader: VS_FULL, depthTest: false, depthWrite: false, blending: NoBlending };
    this.mPre = new ShaderMaterial({ ...base, fragmentShader: FS_PREFILTER, uniforms: this.uPre });
    this.mDown = new ShaderMaterial({ ...base, fragmentShader: FS_DOWN, uniforms: this.uDown });
    this.mUp = new ShaderMaterial({ ...base, fragmentShader: FS_UP, uniforms: this.uUp });
    const B = BLEED;
    this.uComp = {
      tColor: { value: null as Texture | null }, tDepth: { value: null as Texture | null },
      tTight: { value: null as Texture | null }, tWide: { value: null as Texture | null },
      uSilk: shared.u.uSilk, uTexel: { value: new Vector2() }, uNear: { value: 0.1 }, uFar: { value: 1200 },
      uSutra: shared.u.uSutra, uTime: shared.u.uTime, uLineScale: { value: 1.5 }, uLines: { value: 1 },
      uInk: { value: shared.u.uInk0.value }, uGold: { value: shared.u.uGold.value }, uInk1: shared.u.uInk1, uInkMid: shared.u.uInkMid, uLineFog: shared.u.uLineFog,
      uDpr: shared.u.uDpr, uSilPx: { value: new Vector2(2.1, 1.2) }, uSilFade: { value: new Vector2(60, 170) }, uSilGain: { value: 0.35 },
      uInvProj: { value: new Matrix4() }, uCamWorld: { value: new Matrix4() },
      uCam: shared.u.uCam, uFogBase: shared.u.uFogBase, uFogStart: shared.u.uFogStart, uFogBaseCol: shared.u.uFogBaseCol, uBands: shared.u.uBands, uBandCols: shared.u.uBandCols,
      uBleed: { value: new Vector4(B.tight, B.wide / 4, B.stain, B.stainResponse) },
      uBleed2: { value: new Vector4(B.weave, B.warp, B.edge, B.exposure) },
      uRain: { value: new Vector4(B.rain, B.rainAngle, B.rainSpeed, 2) },
      uGrade: { value: new Vector3(B.vignette, B.grain, B.shadowBlue) },
      ...this.glow, ...this.grade,
    };
    this.mComp = new ShaderMaterial({ ...base, fragmentShader: FS_COMPOSITE, uniforms: this.uComp });
  }

  private makeScene(w: number, h: number): WebGLRenderTarget {
    const depth = new DepthTexture(w, h, UnsignedIntType);
    depth.minFilter = NearestFilter;
    depth.magFilter = NearestFilter;
    return new WebGLRenderTarget(w, h, { type: this.type, samples: 4, depthBuffer: true, depthTexture: depth });
  }

  setSize(w: number, h: number, lineScale: number, dpr: number): void {
    this.uComp.uLineScale.value = lineScale;
    this.uComp.uRain.value.w = dpr;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.rtScene.dispose();
    this.rtScene = this.makeScene(w, h);
    for (const m of [...this.mips, ...this.ups]) m.dispose();
    this.mips = [];
    this.ups = [];
    let mw = Math.max(1, Math.round(w / 2)), mh = Math.max(1, Math.round(h / 2));
    for (let i = 0; i < 5; i++) {
      const rt = new WebGLRenderTarget(mw, mh, { type: this.type, depthBuffer: false });
      rt.texture.minFilter = LinearFilter;
      rt.texture.magFilter = LinearFilter;
      this.mips.push(rt);
      if (i >= 1 && i <= 3) {
        const up = new WebGLRenderTarget(mw, mh, { type: this.type, depthBuffer: false });
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

  render(scene: Scene, camera: PerspectiveCamera, vmScene: Scene, vmCamera: Camera): void {
    const r = this.renderer;
    r.autoClear = false;
    // 1. the world, then the viewmodel in its near depth slice
    r.setRenderTarget(this.rtScene);
    r.setClearColor(0x000000, 0); // alpha 0 = inverse depth 0 = infinitely far
    r.clear(true, true, false);
    const gl = r.getContext();
    gl.depthRange(SLICE, 1);
    r.render(scene, camera);
    gl.depthRange(0, SLICE);
    r.render(vmScene, vmCamera);
    gl.depthRange(0, 1);
    // 2. bloom: prefilter → ½, down to ¼ … 1/32, up to 1/16, 1/8, ¼
    const [m0, m1, m2, m3, m4] = this.mips;
    const [u1, u2, u3] = this.ups;
    if (m0 === undefined || m1 === undefined || m2 === undefined || m3 === undefined || m4 === undefined || u1 === undefined || u2 === undefined || u3 === undefined) return;
    this.uPre.tSrc.value = this.rtScene.texture;
    this.uPre.uTexel.value.set(1 / this.w, 1 / this.h);
    this.uPre.uNearP.value = camera.near;
    this.pass(this.mPre, m0);
    const chain = [m0, m1, m2, m3, m4];
    for (let i = 1; i < chain.length; i++) {
      const src = chain[i - 1], dst = chain[i];
      if (src === undefined || dst === undefined) continue;
      this.uDown.tSrc.value = src.texture;
      this.uDown.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mDown, dst);
    }
    const upChain: [WebGLRenderTarget, WebGLRenderTarget, WebGLRenderTarget][] = [[m4, m3, u3], [u3, m2, u2], [u2, m1, u1]];
    for (const [src, add, dst] of upChain) {
      this.uUp.tSrc.value = src.texture;
      this.uUp.tAdd.value = add.texture;
      this.uUp.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mUp, dst);
    }
    // 3. composite to the canvas
    const u = this.uComp;
    u.tColor.value = this.rtScene.texture;
    u.tDepth.value = this.rtScene.depthTexture;
    u.tTight.value = m1.texture;
    u.tWide.value = u1.texture;
    u.uTexel.value.set(1 / this.w, 1 / this.h);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    this.pass(this.mComp, null);
  }
}
