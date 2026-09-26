// The wet square's reflection (a `beforeChain` pass): a planar screen-space reflection of the frame on every wet floor,
// then streaked and rippled, added onto the scene's HDR colour before the bleed pyramid (so reflected neon blooms).
//
// Why screen space and not a mirror camera: the fragment is ~2 M triangles in a few huge merged batches (the facade
// shell alone is 231 k in one draw, r = 276 m), which a mirror camera cannot cull — a mirror render doubles the frame's
// geometry past the phone's 2.5 M budget. What the mockups' wet ground mirrors (the paifang, the lanterns, the people,
// the stalls, the lit windows) is on screen above the reflection point in every eye-level view; what is above the frame
// (the signs over the street) keeps the emitter streak cards (streaks.ts), and a ray that misses keeps the ground's own
// fog sheen (style.ts kind 3). Zero draws of the world.
//
//  1. trace, ½ res: the floor is found from depth (the world point on a horizontal plane: y at the square's datum, inside
//     the wet rect); its normal is up, tilted by drizzle rings and a slow wobble; the reflected view ray is marched in
//     screen space (a perspective-correct DDA, steps bunched near the floor point, a binary refine) against the depth buffer; the hit's colour × Schlick × the wet film
//     (the ground's own flagstone puddles and joints, STONES_GLSL) × a confidence that fades at the screen edges and
//     with distance. alpha = the floor mask.
//  2. streak, ½ res: two vertical blurs (the drizzle-roughened film smears a reflection along the view), mask-aware so a
//     reflection never leaks off the floor.
//  3. add: one full-screen additive draw into the scene target (no copy), only where the floor mask is.
import {
  AddEquation, CustomBlending, HalfFloatType, LinearFilter, Matrix4, NearestFilter, NoBlending, OneFactor, type PerspectiveCamera, ShaderMaterial,
  type Texture, type TextureDataType, UnsignedByteType, Vector2, Vector4, type WebGLRenderer, WebGLRenderTarget, ZeroFactor,
} from 'three';
import { Pass } from 'postprocessing';
import { NOISE_GLSL, STONES_GLSL } from '../style';
import { FLAG_GLSL } from '../paint';
import { VM_SLICE } from './bleed';

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

export interface ReflectSettings {
  /** overall strength (0 = off) */
  gain: number;
  /** march length (m) and steps */
  maxDist: number;
  steps: number;
  /** the wobble's and the rings' normal tilt */
  wobble: number;
  rings: number;
  /** the streak blur's two radii (½-res px) */
  streak1: number;
  streak2: number;
}

export const REFLECT_DEFAULTS: ReflectSettings = { gain: 2, maxDist: 90, steps: 28, wobble: 0.045, rings: 0.12, streak1: 5, streak2: 20 };

const FS_TRACE = (steps: number): string => /* glsl */ `
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
${FLAG_GLSL}
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
  float ring = exp(-pow((rr - rp * 0.3) / 0.03, 2.0)) * (1.0 - rp);
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
  for (int i = 1; i <= ${steps}; i++) {
    float f = fmax * pow((float(i) - 1.0 + jit) / ${steps.toFixed(1)}, 1.6);
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
const FS_BLUR = /* glsl */ `
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

const FS_ADD = /* glsl */ `
uniform sampler2D tSrc;
uniform float uDebug;
varying vec2 vUv;
void main() {
  vec4 c = texture(tSrc, vUv);
  if (c.a <= 0.0) discard;
  // uDebug: the reflection × 6 and the floor mask as a blue tint (captures only)
  gl_FragColor = vec4(uDebug > 0.5 ? c.rgb * 6.0 + vec3(0.0, 0.0, 0.25) : c.rgb, 0.0);
}
`;

export class ReflectPass extends Pass {
  private rtTrace: WebGLRenderTarget | null = null;
  private rtA: WebGLRenderTarget | null = null;
  private rtB: WebGLRenderTarget | null = null;
  private type: TextureDataType = HalfFloatType;
  private readonly uTrace;
  private readonly uBlur = { tSrc: { value: null as Texture | null }, uStep: { value: new Vector2() } };
  private readonly uAdd = { tSrc: { value: null as Texture | null }, uDebug: { value: 0 } };
  private mTrace: ShaderMaterial;
  private readonly mBlur: ShaderMaterial;
  private readonly mAdd: ShaderMaterial;
  private steps = REFLECT_DEFAULTS.steps;
  settings: ReflectSettings = { ...REFLECT_DEFAULTS };

  constructor(private readonly view: PerspectiveCamera, groundY: number, rect: Vector4, private readonly time: () => number, rect2 = new Vector4(0, 0, -1, -1)) {
    super('NdReflectPass');
    this.needsSwap = false;
    this.needsDepthTexture = true;
    this.uTrace = {
      tColor: { value: null as Texture | null }, tDepth: { value: null as Texture | null },
      uProj: { value: new Matrix4() }, uInvProj: { value: new Matrix4() }, uView: { value: new Matrix4() }, uCamWorld: { value: new Matrix4() },
      uNF: { value: new Vector2(0.1, 1000) }, uRect: { value: rect }, uRect2: { value: rect2 }, uK: { value: new Vector4(groundY, 1, 0.045, 0.12) },
      uMarch: { value: new Vector2(90, 0.25) }, uTime: { value: 0 },
    };
    this.mTrace = this.traceMaterial();
    const base = { vertexShader: VS, depthTest: false, depthWrite: false };
    this.mBlur = new ShaderMaterial({ ...base, name: 'NdReflectStreak', fragmentShader: FS_BLUR, uniforms: this.uBlur, blending: NoBlending });
    // colour added, the target's alpha kept
    this.mAdd = new ShaderMaterial({
      ...base, name: 'NdReflectAdd', fragmentShader: FS_ADD, uniforms: this.uAdd, transparent: true,
      blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor,
      blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
    });
    this.fullscreenMaterial = this.mTrace;
  }

  private traceMaterial(): ShaderMaterial {
    return new ShaderMaterial({ vertexShader: VS, fragmentShader: FS_TRACE(this.steps), uniforms: this.uTrace, name: 'NdReflectTrace', depthTest: false, depthWrite: false, blending: NoBlending });
  }

  /** captures only: the reflection × 6 with the floor mask tinted blue (2: the raw trace, before the streak blur) */
  debug(mode: 0 | 1 | 2): void { this.uAdd.uDebug.value = mode === 0 ? 0 : 1; this.raw = mode === 2; }
  private raw = false;

  /** live tuning (the step count rebuilds the trace program) */
  set(s: Partial<ReflectSettings>): void {
    this.settings = { ...this.settings, ...s };
    if (this.settings.steps !== this.steps) {
      this.steps = this.settings.steps;
      this.mTrace.dispose();
      this.mTrace = this.traceMaterial();
    }
  }

  override initialize(renderer: WebGLRenderer, _alpha: boolean, frameBufferType: number): void {
    const ext = renderer.extensions;
    this.type = frameBufferType === UnsignedByteType || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) ? UnsignedByteType : HalfFloatType;
  }

  override setDepthTexture(depthTexture: Texture): void { this.uTrace.tDepth.value = depthTexture; }

  override setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width / 2)), h = Math.max(1, Math.round(height / 2));
    if (this.rtTrace?.width === w && this.rtTrace.height === h) return;
    this.rtTrace?.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    const mk = (name: string, filter: typeof LinearFilter | typeof NearestFilter): WebGLRenderTarget => {
      const rt = new WebGLRenderTarget(w, h, { type: this.type, depthBuffer: false });
      rt.texture.minFilter = filter;
      rt.texture.magFilter = filter;
      rt.texture.name = name;
      return rt;
    };
    this.rtTrace = mk('NdReflect.trace', NearestFilter);
    this.rtA = mk('NdReflect.a', NearestFilter);
    this.rtB = mk('NdReflect.b', LinearFilter);
  }

  private draw(renderer: WebGLRenderer, mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.fullscreenMaterial = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget | null): void {
    const s = this.settings, tr = this.rtTrace, a = this.rtA, b = this.rtB;
    if (inputBuffer === null || tr === null || a === null || b === null || s.gain <= 0) return;
    const u = this.uTrace, cam = this.view;
    u.tColor.value = inputBuffer.texture;
    u.uProj.value.copy(cam.projectionMatrix);
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uView.value.copy(cam.matrixWorldInverse);
    u.uCamWorld.value.copy(cam.matrixWorld);
    u.uNF.value.set(cam.near, cam.far);
    u.uK.value.set(u.uK.value.x, s.gain, s.wobble, s.rings);
    u.uMarch.value.set(s.maxDist, 0.25);
    u.uTime.value = this.time();
    this.draw(renderer, this.mTrace, tr);
    // the streak: along the screen's vertical (the view's own direction on a floor seen at eye height)
    this.uBlur.tSrc.value = tr.texture;
    this.uBlur.uStep.value.set(0, s.streak1 / tr.height);
    this.draw(renderer, this.mBlur, a);
    this.uBlur.tSrc.value = a.texture;
    this.uBlur.uStep.value.set(0, s.streak2 / tr.height);
    this.draw(renderer, this.mBlur, b);
    this.uAdd.tSrc.value = this.raw ? tr.texture : b.texture;
    this.draw(renderer, this.mAdd, inputBuffer);
  }

  override dispose(): void {
    this.rtTrace?.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.mTrace.dispose();
    this.mBlur.dispose();
    this.mAdd.dispose();
    super.dispose();
  }
}
