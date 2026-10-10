// The wet square's reflection (a `beforeChain` pass): a planar screen-space reflection of the frame on every wet floor,
// then streaked and rippled; the Jiehua composite (render/jiehua.ts) adds it to the frame (`texture`).
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
//  2. streak, ½ res: one 13-tap vertical blur (the drizzle-roughened film smears a reflection along the view), mask-aware
//     so a reflection never leaks off the floor.
//  (Round 14, the phone's draw budget: 4 → 2 draws — the two blurs are one, and the composite reads the result instead of
//  a full-screen additive draw into the scene. Reflected neon no longer feeds the bleed pyramid.)
import {
  HalfFloatType, LinearFilter, Matrix4, NearestFilter, type PerspectiveCamera, type ShaderMaterial,
  type Texture, type TextureDataType, UnsignedByteType, Vector2, Vector4, WebGLRenderTarget,
} from 'three';
import { Pass } from 'postprocessing';
import { PASS_FAMILY, stepSplices } from './family';
import type { Renderer } from '@wildshard/engine/render/renderer';

export interface ReflectSettings {
  /** overall strength (0 = off) */
  gain: number;
  /** march length (m) and steps */
  maxDist: number;
  steps: number;
  /** the wobble's and the rings' normal tilt */
  wobble: number;
  rings: number;
  /** the streak blur's reach (½-res px, each way) */
  streak: number;
}

export const REFLECT_DEFAULTS: ReflectSettings = { gain: 2, maxDist: 90, steps: 28, wobble: 0.045, rings: 0.12, streak: 20 };

export class ReflectPass extends Pass {
  private rtTrace: WebGLRenderTarget | null = null;
  private rtB: WebGLRenderTarget | null = null;
  private type: TextureDataType = HalfFloatType;
  private readonly uTrace;
  private readonly uBlur = { tSrc: { value: null as Texture | null }, uStep: { value: new Vector2() } };
  private mTrace: ShaderMaterial;
  private readonly mBlur: ShaderMaterial;
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
    this.mBlur = PASS_FAMILY.material('reflectStreak', this.uBlur);
    this.fullscreenMaterial = this.mTrace;
  }

  private traceMaterial(): ShaderMaterial {
    return PASS_FAMILY.material('reflectTrace', this.uTrace, { fragments: stepSplices(this.steps) });
  }

  /** captures only: 1 = the reflection × 6 (the composite reads `debugGain`), 2 = the raw trace before the streak */
  debug(mode: 0 | 1 | 2): void { this.debugGain = mode === 0 ? 1 : 6; this.raw = mode === 2; }
  private raw = false;
  /** the composite's gain on `texture` (6 in the debug view) */
  debugGain = 1;
  /** the streaked reflection (rgb, premultiplied; alpha = the floor mask) for the composite; null when off */
  texture: Texture | null = null;

  /** live tuning (the step count rebuilds the trace program) */
  set(s: Partial<ReflectSettings>): void {
    this.settings = { ...this.settings, ...s };
    if (this.settings.steps !== this.steps) {
      this.steps = this.settings.steps;
      this.mTrace.dispose();
      this.mTrace = this.traceMaterial();
    }
  }

  override initialize(renderer: Renderer, _alpha: boolean, frameBufferType: number): void {
    const ext = renderer.extensions;
    this.type = frameBufferType === UnsignedByteType || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) ? UnsignedByteType : HalfFloatType;
  }

  override setDepthTexture(depthTexture: Texture): void { this.uTrace.tDepth.value = depthTexture; }

  override setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width / 2)), h = Math.max(1, Math.round(height / 2));
    if (this.rtTrace?.width === w && this.rtTrace.height === h) return;
    this.rtTrace?.dispose();
    this.rtB?.dispose();
    const mk = (name: string, filter: typeof LinearFilter | typeof NearestFilter): WebGLRenderTarget => {
      const rt = new WebGLRenderTarget(w, h, { type: this.type, depthBuffer: false });
      rt.texture.minFilter = filter;
      rt.texture.magFilter = filter;
      rt.texture.name = name;
      return rt;
    };
    this.rtTrace = mk('NdReflect.trace', NearestFilter);
    this.rtB = mk('NdReflect.b', LinearFilter);
  }

  private draw(renderer: Renderer, mat: ShaderMaterial, target: WebGLRenderTarget | null): void {
    this.fullscreenMaterial = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  override render(renderer: Renderer, inputBuffer: WebGLRenderTarget | null): void {
    const s = this.settings, tr = this.rtTrace, b = this.rtB;
    this.texture = null;
    if (inputBuffer === null || tr === null || b === null || s.gain <= 0) return;
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
    // the streak: along the screen's vertical (the view's own direction on a floor seen at eye height), one pass
    this.uBlur.tSrc.value = tr.texture;
    this.uBlur.uStep.value.set(0, s.streak / 6 / tr.height);
    this.draw(renderer, this.mBlur, b);
    this.texture = this.raw ? tr.texture : b.texture;
  }

  override dispose(): void {
    this.rtTrace?.dispose();
    this.rtB?.dispose();
    this.mTrace.dispose();
    this.mBlur.dispose();
    super.dispose();
  }
}
