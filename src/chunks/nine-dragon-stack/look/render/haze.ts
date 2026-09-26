// Light haze in the drizzle (a `beforeChain` pass, after the reflection, before the bleed pyramid): the baked light
// volumes (light/lightvol.ts: every lantern, shop, lamp, sign and lit window) marched along each view ray through the
// rain's thin medium — the glowing halos round every light, the warm air under the paifang's lanterns, the neon's
// coloured bloom in the air, shafts where the pools overlap. No lights are looped: one 3D fetch per step.
//
//  1. march, ¼ res: from the eye to the scene's depth (capped), N steps, dithered per pixel and per frame; in-scatter
//     E(x) · σ(x) · ds with σ = the rain medium (denser low down, a slow noise so it drifts), a mild forward lobe.
//  2. add: one full-screen additive draw into the scene target (bilinear from ¼ res; the haze is smooth), before the
//     bleed so the halos bloom and soak the paper like any light.
import {
  AddEquation, CustomBlending, HalfFloatType, LinearFilter, Matrix4, NoBlending, OneFactor, type PerspectiveCamera, ShaderMaterial,
  type Texture, type TextureDataType, UnsignedByteType, Vector2, Vector4, type WebGLRenderer, WebGLRenderTarget, ZeroFactor,
} from 'three';
import { Pass } from 'postprocessing';
import { LIGHTVOL_GLSL } from '../light/lightvol';
import type { Shared } from '../style';
import { VM_SLICE } from './bleed';

const VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;

export interface HazeSettings {
  /** in-scatter strength (σ at the datum, 1/m) */
  density: number;
  /** the march's reach (m) and steps */
  maxDist: number;
  steps: number;
  /** the medium's height falloff above the datum (m) and its drift noise's share */
  height: number;
  drift: number;
  /** the forward-scatter lobe's share (0 = isotropic) */
  forward: number;
  /** the brightest irradiance a step takes (the paifang's cluster of lanterns drowned the gate in orange uncapped) */
  cap: number;
  /** the irradiance a step must pass to scatter: halos round the bright clusters, not a veil from every lit window */
  thr: number;
}

/** off by default (round 14): even thresholded (σ 0.035 over 0.9) it washed the stair-street warm and only faintly haloed
 *  the paifang at phone size — `window.__ndRender.haze.set({ density: 0.025 })` to look again */
export const HAZE_DEFAULTS: HazeSettings = { density: 0, maxDist: 70, steps: 14, height: 18, drift: 0.5, forward: 0.35, cap: 1.4, thr: 1.0 };

const FS_MARCH = (steps: number): string => /* glsl */ `
uniform highp sampler2D tDepth;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec2 uNF;
uniform vec4 uHz;     // x: σ, y: max distance, z: height falloff (m), w: drift
uniform vec4 uHz2;    // x: forward lobe, y: time, z: the per-step irradiance cap, w: its threshold
uniform float uGroundY;
varying vec2 vUv;
${LIGHTVOL_GLSL}
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
  float ds = dist / ${steps.toFixed(1)};
  float jit = h12(gl_FragCoord.xy + fract(uHz2.y * 7.31) * 53.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${steps}; i++) {
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

const FS_ADD = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture(tSrc, vUv).rgb, 0.0); }
`;

export class HazePass extends Pass {
  private rt: WebGLRenderTarget | null = null;
  private type: TextureDataType = HalfFloatType;
  private readonly uMarch;
  private readonly uAdd = { tSrc: { value: null as Texture | null } };
  private mMarch: ShaderMaterial;
  private readonly mAdd: ShaderMaterial;
  private steps = HAZE_DEFAULTS.steps;
  settings: HazeSettings = { ...HAZE_DEFAULTS };
  /** the ¼-res in-scatter (the composite lights the drizzle with it); null before the first frame */
  texture: Texture | null = null;

  constructor(private readonly view: PerspectiveCamera, private readonly shared: Shared, groundY: number, private readonly scale = 0.25) {
    super('NdHazePass');
    this.needsSwap = false;
    this.needsDepthTexture = true;
    const s = shared.u;
    this.uMarch = {
      tDepth: { value: null as Texture | null }, uInvProj: { value: new Matrix4() }, uCamWorld: { value: new Matrix4() },
      uNF: { value: new Vector2(0.1, 1000) }, uHz: { value: new Vector4() }, uHz2: { value: new Vector4() }, uGroundY: { value: groundY },
      uLpVolA: s.uLpVolA, uLpMinA: s.uLpMinA, uLpInvA: s.uLpInvA, uLpVolB: s.uLpVolB, uLpMinB: s.uLpMinB, uLpInvB: s.uLpInvB,
      uLpGain: s.uLpGain, uLpSky: s.uLpSky, uLpAmb: s.uLpAmb, uLpSpec: s.uLpSpec,
    };
    this.mMarch = this.marchMaterial();
    this.mAdd = new ShaderMaterial({
      vertexShader: VS, fragmentShader: FS_ADD, uniforms: this.uAdd, name: 'NdHazeAdd', depthTest: false, depthWrite: false, transparent: true,
      blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor,
      blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
    });
    this.fullscreenMaterial = this.mMarch;
  }

  private marchMaterial(): ShaderMaterial {
    return new ShaderMaterial({ vertexShader: VS, fragmentShader: FS_MARCH(this.steps), uniforms: this.uMarch, name: 'NdHazeMarch', depthTest: false, depthWrite: false, blending: NoBlending });
  }

  set(s: Partial<HazeSettings>): void {
    this.settings = { ...this.settings, ...s };
    if (this.settings.steps !== this.steps) {
      this.steps = this.settings.steps;
      this.mMarch.dispose();
      this.mMarch = this.marchMaterial();
    }
  }

  override initialize(renderer: WebGLRenderer, _alpha: boolean, frameBufferType: number): void {
    const ext = renderer.extensions;
    this.type = frameBufferType === UnsignedByteType || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) ? UnsignedByteType : HalfFloatType;
  }

  override setDepthTexture(depthTexture: Texture): void { this.uMarch.tDepth.value = depthTexture; }

  override setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width * this.scale)), h = Math.max(1, Math.round(height * this.scale));
    if (this.rt?.width === w && this.rt.height === h) return;
    this.rt?.dispose();
    this.rt = new WebGLRenderTarget(w, h, { type: this.type, depthBuffer: false });
    this.rt.texture.minFilter = LinearFilter;
    this.rt.texture.magFilter = LinearFilter;
    this.rt.texture.name = 'NdHaze';
    this.texture = this.rt.texture;
  }

  private draw(renderer: WebGLRenderer, mat: ShaderMaterial, target: WebGLRenderTarget): void {
    this.fullscreenMaterial = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget | null): void {
    const rt = this.rt, s = this.settings;
    if (inputBuffer === null || rt === null || s.density <= 0) return;
    const u = this.uMarch, cam = this.view;
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uCamWorld.value.copy(cam.matrixWorld);
    u.uNF.value.set(cam.near, cam.far);
    u.uHz.value.set(s.density, s.maxDist, s.height, s.drift);
    u.uHz2.value.set(s.forward, this.shared.u.uTime.value, s.cap, s.thr);
    this.draw(renderer, this.mMarch, rt);
    this.uAdd.tSrc.value = rt.texture;
    this.draw(renderer, this.mAdd, inputBuffer);
  }

  override dispose(): void {
    this.rt?.dispose();
    this.mMarch.dispose();
    this.mAdd.dispose();
    super.dispose();
  }
}
