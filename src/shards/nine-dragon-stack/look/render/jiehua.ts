// The Jiehua composite as an Effect in the engine's colour chain (ShardManifest.ShardComposition `chain`): the clean room's
// one composite (the clean room's post.ts FS_COMPOSITE, deleted in E357 F7; git show b1b8f9c9:src/chunks/nine-dragon-stack/look/post.ts) — the depth silhouette in ink (gold in the sutra look), the 晕染 bleed (tight +
// wide added as light, the wide mip soaked into pale paper as a pigment glaze), the window glow, screen-space drizzle, the
// hue-preserving shoulder, the cool shadow lift, the weave, the vignette, the learned LUT and grain. The silhouette reads
// inverse depth from the scene's depth texture (the engine's scene target has no MSAA and no near / viewZ alpha): its
// lines alias where the clean room's resolved; SMAA, after this pass, takes them.
// The LUT is display-referred: the effect ends in display sRGB and hands the chain linear back (the SMAA pass encodes).
import { type Color, Matrix4, type PerspectiveCamera, type Texture, Uniform, Vector2, Vector3, Vector4, type WebGLRenderTarget } from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import type { Shared } from '../style';
import type { glowUniforms } from '../light/glow';
import type { gradeUniforms } from '../light/grade';
import { BLEED, JIEHUA_FS } from '../../data/passes';
import { PASS_FAMILY } from './family';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { RowRenderPassView } from '@wildshard/sdk/looks/renderPass';

type Glow = ReturnType<typeof glowUniforms>;
type Grade = ReturnType<typeof gradeUniforms>;

export class JiehuaEffect extends Effect {
  readonly u;
  private readonly shared: Shared;

  constructor(private readonly view: PerspectiveCamera, shared: Shared, glow: Glow, grade: Grade) {
    const s = shared.u, B = BLEED;
    const u = {
      tTight: new Uniform<Texture | null>(null), tWide: new Uniform<Texture | null>(null), uHasBleed: new Uniform(0), tHaze: new Uniform<Texture | null>(null), uRainHaze: new Uniform(6), tRefl: new Uniform<Texture | null>(null), uReflK: new Uniform(0), uSilk: new Uniform(s.uSilk.value),
      uTexel: new Uniform(new Vector2()), uSutra: new Uniform(0), uTime: new Uniform(0), uLineScale: new Uniform(1), uLines: new Uniform(1),
      uInk: new Uniform(s.uInk0.value), uGold: new Uniform(s.uGold.value), uInk1: new Uniform(s.uInk1.value), uInkMid: new Uniform(110), uLineFog: new Uniform(1.7),
      uDpr: new Uniform(1), uSilPx: new Uniform(new Vector2(2.1, 1.2)), uSilFade: new Uniform(new Vector2(60, 170)), uSilGain: new Uniform(0.35),
      uInvProj: new Uniform(new Matrix4()), uCamWorld: new Uniform(new Matrix4()), uNF: new Uniform(new Vector2(0.1, 1000)), uSharp: new Uniform(0),
      uCam: new Uniform(s.uCam.value), uFogBase: new Uniform(s.uFogBase.value), uFogStart: new Uniform(s.uFogStart.value), uFogBaseCol: new Uniform(s.uFogBaseCol.value),
      uShaft: new Uniform(s.uShaft.value), uShaftK: new Uniform(s.uShaftK.value), uBands: new Uniform(s.uBands.value), uBandCols: new Uniform(s.uBandCols.value), uBandWin: new Uniform(s.uBandWin.value),
      uFogDeep: new Uniform(s.uFogDeep.value), uShaftLit: new Uniform(s.uShaftLit.value), uDeepAir: new Uniform(s.uDeepAir.value), uDeepAir2: new Uniform(s.uDeepAir2.value), uPuff: new Uniform(s.uPuff.value),
      uBleed: new Uniform(new Vector4(B.tight, B.wide / 4, B.stain, B.stainResponse)),
      uBleed2: new Uniform(new Vector4(B.weave, B.warp, B.edge, B.exposure)),
      uRain: new Uniform(new Vector4(B.rain, B.rainAngle, B.rainSpeed, 2)),
      uGrade: new Uniform(new Vector3(B.vignette, B.grain, B.shadowBlue)),
      uTone: new Uniform(new Vector4(B.toe, B.toeEnd, B.vibrance, B.warm)),
      uGlow2: new Uniform(glow.uGlow2.value), uGlowCol: new Uniform<Color>(glow.uGlowCol.value),
      uLut: new Uniform(grade.uLut.value), uLutAmt: new Uniform(grade.uLutAmt.value),
    };
    super('NdJiehuaEffect', PASS_FAMILY.glsl(JIEHUA_FS), {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>(Object.entries(u)),
    });
    this.u = u;
    this.shared = shared;
    this.grade = grade;
  }

  private readonly grade: Grade;
  /** the bleed pyramid (its `tight` and `wide` outputs, re-read every frame: its targets are remade on a resize) */
  source: RowRenderPassView | null = null;
  /** the haze march (its `haze` in-scatter lights the drizzle); null = none */
  haze: RowRenderPassView | null = null;
  /** how much of the haze a raindrop catches */
  rainHaze = 6;
  /** the wet floor's reflection (its `reflection` output, data/passes.ts REFLECT_PASS); null = none */
  refl: RowRenderPassView | null = null;
  /** the unsharp mask's strength below 3× */
  sharpen = 0.35;

  override update(renderer: Renderer, inputBuffer: WebGLRenderTarget): void {
    const u = this.u, s = this.shared.u, cam = this.view;
    u.tTight.value = this.source?.output('tight') ?? null;
    u.tWide.value = this.source?.output('wide') ?? null;
    u.uHasBleed.value = u.tTight.value === null || u.tWide.value === null ? 0 : 1;
    u.tHaze.value = this.haze?.enabled === true ? this.haze.output('haze') : null;
    u.uRainHaze.value = u.tHaze.value === null ? 0 : this.rainHaze;
    u.tRefl.value = this.refl?.output('reflection') ?? null;
    u.uReflK.value = u.tRefl.value === null ? 0 : (this.refl?.debugGain ?? 1);
    u.uTexel.value.set(1 / inputBuffer.width, 1 / inputBuffer.height);
    u.uNF.value.set(cam.near, cam.far);
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uCamWorld.value.copy(cam.matrixWorld);
    u.uTime.value = s.uTime.value;
    u.uSutra.value = s.uSutra.value;
    u.uDpr.value = s.uDpr.value;
    u.uInkMid.value = s.uInkMid.value;
    u.uLineFog.value = s.uLineFog.value;
    u.uFogBase.value = s.uFogBase.value;
    u.uFogStart.value = s.uFogStart.value;
    u.uShaftLit.value = s.uShaftLit.value;
    u.uLut.value = this.grade.uLut.value;
    u.uLutAmt.value = this.grade.uLutAmt.value;
    u.uRain.value.w = renderer.getPixelRatio();
    u.uSharp.value = renderer.getPixelRatio() < 2.5 ? this.sharpen : 0;
  }
}
