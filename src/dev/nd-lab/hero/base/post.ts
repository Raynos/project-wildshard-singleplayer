// The frame: (1) the wet-ground mirror (neon, lanterns, the gate) at quarter res, (2) the world into an MSAA HDR target
// with its depth, the viewmodel over it with depth cleared, (3) a half-res dual-filter bloom, (4) one composite: the
// depth silhouette line (ink, or gold in the sutra look), the bloom soaked into the silk weave, a soft shoulder, grain.
import {
  AdditiveBlending, BufferGeometry, type Camera, DepthTexture, Float32BufferAttribute, HalfFloatType, LinearFilter, Matrix4, Mesh,
  NearestFilter, NoBlending, OrthographicCamera, PerspectiveCamera, type Scene, ShaderMaterial, type Texture, type TextureDataType,
  UnsignedByteType, UnsignedIntType, Vector2, Vector3, Vector4, type WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { NOISE_GLSL, type Shared } from './style';

const VS_FULL = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FS_PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThr;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 a = texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 b = texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  vec3 c = texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  vec3 d = texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  // Karis-weighted average: no single hot pixel flickers the bloom
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b)));
  float wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
  float wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThr + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float k = max(soft, br - uThr) / max(br, 1e-4);
  gl_FragColor = vec4(col * k, 1.0);
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
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec3 s = vec3(0.0);
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb * 2.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 12.0 * uWeight, 1.0);
}
`;
// the wet-ground streak: a long one-way vertical smear of the mirror's bright parts (every sign and lantern drips)
const FS_STREAK = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uStep;
uniform float uCut;
varying vec2 vUv;
void main() {
  vec3 s = vec3(0.0);
  float w = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float wi = 1.0 - fi / 14.0;
    vec3 c = texture(tSrc, vUv + uStep * fi).rgb;
    s += max(c - uCut, vec3(0.0)) * wi;
    w += wi;
  }
  gl_FragColor = vec4(s / w, 1.0);
}
`;
const FS_COMPOSITE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D uSilk;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uBloom;
uniform float uSutra;
uniform float uTime;
uniform float uLineScale;
uniform float uLines;
uniform vec3 uInk;
uniform vec3 uGold;
varying vec2 vUv;
${NOISE_GLSL}
uniform float uSlice;
uniform float uVmNear;
uniform float uVmFar;
float ldw(float z, float n, float f) { return 2.0 * n * f / (f + n - (2.0 * z - 1.0) * (f - n)); }
// depth slices (lab): the viewmodel is drawn into [0, uSlice) of the depth range, the world into [uSlice, 1]
float ld(float z) { return z < uSlice ? ldw(z / uSlice, uVmNear, uVmFar) : ldw((z - uSlice) / (1.0 - uSlice), uNear, uFar); }
float invD(vec2 uv) { return 1.0 / ld(texture(tDepth, uv).r); }
vec3 shoulder(vec3 x) {
  vec3 k = 0.74 + 0.26 * (1.0 - exp(-(x - 0.74) / 0.26));
  return mix(x, k, step(0.74, x));
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float contour(vec2 uv, float wc, float r) {
  float e = 0.0;
  vec2 o1 = vec2(r, 0.0) * uTexel, o2 = vec2(0.0, r) * uTexel, o3 = vec2(r, r) * uTexel * 0.7071, o4 = vec2(r, -r) * uTexel * 0.7071;
  float l1 = (invD(uv + o1) + invD(uv - o1) - 2.0 * wc) / wc;
  float l2 = (invD(uv + o2) + invD(uv - o2) - 2.0 * wc) / wc;
  float l3 = (invD(uv + o3) + invD(uv - o3) - 2.0 * wc) / wc;
  float l4 = (invD(uv + o4) + invD(uv - o4) - 2.0 * wc) / wc;
  float m = min(min(l1, l2), min(l3, l4));
  return smoothstep(0.012, 0.06, -m);
}
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  float zc = texture(tDepth, vUv).r;
  float dc = ld(zc);
  float wc = 1.0 / dc;
  // the silhouette: ruled where the depth folds toward the eye (a contour or a convex edge), heavier on the living/held
  float r = uLineScale * mix(1.6, 0.8, smoothstep(3.0, 60.0, dc));
  if (dc < 1.6) r = uLineScale * 2.1;
  float edge = zc >= 0.999999 ? 0.0 : max(contour(vUv, wc, r), contour(vUv, wc, r * 0.5) * 0.8);
  edge *= (1.0 - smoothstep(55.0, 210.0, dc)) * uLines;
  vec3 ink = mix(uInk, uGold * 1.25, uSutra);
  vec3 lineC = mix(ink, c, smoothstep(12.0, 170.0, dc) * 0.85);
  c = mix(c, lineC, edge);
  float weave = texture(uSilk, gl_FragCoord.xy / 320.0).r;
  vec3 b = texture(tBloom, vUv).rgb;
  c += b * uBloom * (0.78 + 0.44 * weave);
  c = shoulder(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, c * vec3(0.93, 0.97, 1.08), (1.0 - smoothstep(0.02, 0.3, l)) * 0.45 * (1.0 - uSutra));
  c *= 1.0 + (weave - 0.5) * 0.04;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.32;
  vec3 o = toSRGB(c);
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

export class Pipeline {
  private readonly quad: Mesh;
  private readonly ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rtScene: WebGLRenderTarget;
  private rtRefl: WebGLRenderTarget;
  private rtStreakA: WebGLRenderTarget;
  private rtStreakB: WebGLRenderTarget;
  private readonly mStreak: ShaderMaterial;
  private readonly uStreak = { tSrc: { value: null as Texture | null }, uStep: { value: new Vector2() }, uCut: { value: 0 } };
  private mips: WebGLRenderTarget[] = [];
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  readonly mComp: ShaderMaterial;
  private readonly uPre = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() }, uThr: { value: 0.88 }, uKnee: { value: 0.45 } };
  private readonly uDown = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly uUp = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() }, uWeight: { value: 1.0 } };
  readonly uComp;
  private readonly type: TextureDataType;
  private readonly reflCam = new PerspectiveCamera();
  private readonly texMat = new Matrix4();
  private w = 1;
  private h = 1;
  reflections = true;
  /** lab A/B: true = renderer.clearDepth() before the viewmodel (the clean room today), false = depth-range slices */
  clearDepthA = false;
  readonly groundY: number;

  constructor(private readonly renderer: WebGLRenderer, private readonly shared: Shared, groundY: number) {
    this.groundY = groundY;
    const ext = renderer.extensions;
    this.type = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? HalfFloatType : UnsignedByteType;
    this.quad = new Mesh(fullTri());
    this.quad.frustumCulled = false;
    this.rtScene = this.makeScene(1, 1);
    this.rtRefl = new WebGLRenderTarget(1, 1, { type: this.type, depthBuffer: true });
    this.rtStreakA = new WebGLRenderTarget(1, 1, { type: this.type, depthBuffer: false });
    this.rtStreakB = new WebGLRenderTarget(1, 1, { type: this.type, depthBuffer: false });
    const base = { vertexShader: VS_FULL, depthTest: false, depthWrite: false, blending: NoBlending };
    this.mPre = new ShaderMaterial({ ...base, fragmentShader: FS_PREFILTER, uniforms: this.uPre });
    this.mDown = new ShaderMaterial({ ...base, fragmentShader: FS_DOWN, uniforms: this.uDown });
    this.mUp = new ShaderMaterial({ ...base, fragmentShader: FS_UP, blending: AdditiveBlending, uniforms: this.uUp });
    this.mStreak = new ShaderMaterial({ ...base, fragmentShader: FS_STREAK, uniforms: this.uStreak });
    this.uComp = {
      tColor: { value: null as Texture | null }, tDepth: { value: null as Texture | null }, tBloom: { value: null as Texture | null },
      uSilk: shared.u.uSilk, uTexel: { value: new Vector2() }, uNear: { value: 0.1 }, uFar: { value: 1200 }, uSlice: { value: 0.3 }, uVmNear: { value: 0.05 }, uVmFar: { value: 50 }, uBloom: { value: 1.05 },
      uSutra: shared.u.uSutra, uTime: shared.u.uTime, uLineScale: { value: 1.5 }, uLines: { value: 1 },
      uInk: { value: shared.u.uInk0.value }, uGold: { value: shared.u.uGold.value },
    };
    this.mComp = new ShaderMaterial({ ...base, fragmentShader: FS_COMPOSITE, uniforms: this.uComp });
    this.reflCam.layers.set(1);
  }

  private makeScene(w: number, h: number): WebGLRenderTarget {
    const depth = new DepthTexture(w, h, UnsignedIntType);
    depth.minFilter = NearestFilter;
    depth.magFilter = NearestFilter;
    return new WebGLRenderTarget(w, h, { type: this.type, samples: 4, depthBuffer: true, depthTexture: depth });
  }

  setSize(w: number, h: number, lineScale: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.rtScene.dispose();
    this.rtScene = this.makeScene(w, h);
    const rw = Math.max(1, Math.round(w / 4)), rh = Math.max(1, Math.round(h / 4));
    this.rtRefl.setSize(rw, rh);
    this.rtStreakA.setSize(rw, rh);
    this.rtStreakB.setSize(rw, rh);
    for (const m of this.mips) m.dispose();
    this.mips = [];
    let mw = Math.max(1, Math.round(w / 2)), mh = Math.max(1, Math.round(h / 2));
    for (let i = 0; i < 7 && mw > 4 && mh > 4; i++) {
      const rt = new WebGLRenderTarget(mw, mh, { type: this.type, depthBuffer: false });
      rt.texture.minFilter = LinearFilter;
      rt.texture.magFilter = LinearFilter;
      this.mips.push(rt);
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
    }
    this.uComp.uLineScale.value = lineScale;
    this.shared.u.uRes.value.set(w, h);
  }

  /** the mirrored camera for the wet ground (three's Reflector maths, plane y = groundY) */
  private updateReflection(camera: PerspectiveCamera): void {
    const n = new Vector3(0, 1, 0);
    const planePos = new Vector3(0, this.groundY, 0);
    const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rot = new Matrix4().extractRotation(camera.matrixWorld);
    const view = new Vector3().subVectors(planePos, camPos);
    view.y = planePos.y - camPos.y;
    const mirrorPos = camPos.clone();
    mirrorPos.y = 2 * this.groundY - camPos.y;
    const look = new Vector3(0, 0, -1).applyMatrix4(rot).add(camPos);
    const target = look.clone();
    target.y = 2 * this.groundY - look.y;
    this.reflCam.position.copy(mirrorPos);
    this.reflCam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    this.reflCam.lookAt(target);
    this.reflCam.near = camera.near;
    this.reflCam.far = camera.far;
    this.reflCam.updateMatrixWorld();
    this.reflCam.projectionMatrix.copy(camera.projectionMatrix);
    this.reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    this.texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.texMat.multiply(this.reflCam.projectionMatrix);
    this.texMat.multiply(this.reflCam.matrixWorldInverse);
    this.shared.u.uReflMat.value.copy(this.texMat);
    // an oblique near plane at the ground so nothing under it leaks into the mirror
    const plane = new Vector4(0, 1, 0, -this.groundY);
    const clip = plane.applyMatrix4(new Matrix4().copy(this.reflCam.matrixWorldInverse).invert().transpose());
    const p = this.reflCam.projectionMatrix;
    const e = p.elements;
    const qv = new Vector4((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    clip.multiplyScalar(2 / clip.dot(qv));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1;
    e[14] = clip.w;
    void view;
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quad, this.ortho);
  }

  render(scene: Scene, camera: PerspectiveCamera, vmScene: Scene, vmCamera: Camera): void {
    const r = this.renderer;
    r.autoClear = false;
    // 1. the mirror
    const aboveGround = camera.position.y > this.groundY + 0.05 && this.reflections;
    this.shared.u.uReflOn.value = 0;
    if (aboveGround) {
      this.updateReflection(camera);
      this.shared.u.uRefl.value = this.shared.blankTex;
      this.shared.u.uStreak.value = this.shared.blankTex;
      r.setRenderTarget(this.rtRefl);
      r.setClearColor(0x000000, 0);
      r.clear(true, true, false);
      r.render(scene, this.reflCam);
      // two one-way passes: a short smear, then a long one
      this.uStreak.tSrc.value = this.rtRefl.texture;
      this.uStreak.uStep.value.set(0, 1.6 / this.rtRefl.height);
      this.uStreak.uCut.value = 0.22;
      this.pass(this.mStreak, this.rtStreakA);
      this.uStreak.tSrc.value = this.rtStreakA.texture;
      this.uStreak.uStep.value.set(0, 11 / this.rtRefl.height);
      this.uStreak.uCut.value = 0;
      this.pass(this.mStreak, this.rtStreakB);
      this.shared.u.uRefl.value = this.rtRefl.texture;
      this.shared.u.uStreak.value = this.rtStreakB.texture;
      this.shared.u.uReflOn.value = 1;
    }
    // 2. the world, then the viewmodel over it
    r.setRenderTarget(this.rtScene);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    // depth slices instead of a depth clear (src/core/worldDepth.ts, E142): the world keeps its depth for the silhouettes
    const gl = r.getContext();
    const S = 0.3;
    this.uComp.uSlice.value = this.clearDepthA ? 0 : S;
    if (this.clearDepthA) {
      // the clean room's way (for the A/B): the world's depth is cleared before the viewmodel draws
      r.render(scene, camera);
      r.clearDepth();
      r.render(vmScene, vmCamera);
    } else {
      gl.depthRange(S, 1);
      r.render(scene, camera);
      gl.depthRange(0, S);
      r.render(vmScene, vmCamera);
      gl.depthRange(0, 1);
    }
    // 3. bloom
    const first = this.mips[0];
    if (first !== undefined) {
      this.uPre.tSrc.value = this.rtScene.texture;
      this.uPre.uTexel.value.set(1 / this.w, 1 / this.h);
      this.pass(this.mPre, first);
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
        this.pass(this.mUp, dst);
      }
    }
    // 4. composite to the canvas
    const u = this.uComp;
    u.tColor.value = this.rtScene.texture;
    u.tDepth.value = this.rtScene.depthTexture;
    u.tBloom.value = first?.texture ?? null;
    u.uTexel.value.set(1 / this.w, 1 / this.h);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    if (vmCamera instanceof PerspectiveCamera) { u.uVmNear.value = vmCamera.near; u.uVmFar.value = vmCamera.far; }
    this.pass(this.mComp, null);
  }
}
