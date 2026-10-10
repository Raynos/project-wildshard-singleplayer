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
  HalfFloatType, LinearFilter, Matrix4, type PerspectiveCamera, type ShaderMaterial,
  type Texture, type TextureDataType, UnsignedByteType, Vector2, Vector4, WebGLRenderTarget,
} from 'three';
import { Pass } from 'postprocessing';
import type { Shared } from '../style';
import { PASS_FAMILY, stepSplices } from './family';
import type { Renderer } from '@wildshard/engine/render/renderer';

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
      uLpGain: s.uLpGain, uLpSky: s.uLpSky, uLpAmb: s.uLpAmb, uLpSpec: s.uLpSpec, uLpCut: s.uLpCut, uLpAmber: s.uLpAmber,
    };
    this.mMarch = this.marchMaterial();
    this.mAdd = PASS_FAMILY.material('hazeAdd', this.uAdd);
    this.fullscreenMaterial = this.mMarch;
  }

  private marchMaterial(): ShaderMaterial {
    return PASS_FAMILY.material('hazeMarch', this.uMarch, { fragments: stepSplices(this.steps) });
  }

  set(s: Partial<HazeSettings>): void {
    this.settings = { ...this.settings, ...s };
    if (this.settings.steps !== this.steps) {
      this.steps = this.settings.steps;
      this.mMarch.dispose();
      this.mMarch = this.marchMaterial();
    }
  }

  override initialize(renderer: Renderer, _alpha: boolean, frameBufferType: number): void {
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

  private draw(renderer: Renderer, mat: ShaderMaterial, target: WebGLRenderTarget): void {
    this.fullscreenMaterial = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  override render(renderer: Renderer, inputBuffer: WebGLRenderTarget | null): void {
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
