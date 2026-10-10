// The Jiehua bleed pyramid in the engine's composer (a `beforeChain` pass, ShardManifest.ShardComposition): the clean room's
// 晕染 bloom (the clean room's post.ts, deleted in E357 F7; git show b1b8f9c9:src/chunks/nine-dragon-stack/look/post.ts) — a Karis prefilter (threshold 1.0, tight knee), dual-filter downs, ups summing back (tight =
// the ¼ mip, wide = the summed pyramid). Round 14 (the phone's draw budget, 8 → 5 draws): the prefilter writes the ¼
// level directly (four bilinear taps cover its 4×4 full-res texels) and the pyramid stops at 1/16. The window glow rides in its alpha
// (light/glow.ts). The one change: the prefilter reads inverse depth from the scene's depth texture (the engine's scene
// target is not MSAA and its alpha is not the clean room's near / viewZ), so the pass asks for the depth.
// It writes only its own targets (needsSwap false): JiehuaEffect samples `tight` and `wide`.
import {
  HalfFloatType, LinearFilter, type PerspectiveCamera, type ShaderMaterial, type Texture, type TextureDataType, UnsignedByteType,
  Vector2, WebGLRenderTarget,
} from 'three';
import { Pass } from 'postprocessing';
import type { glowUniforms } from '../light/glow';
import { PASS_FAMILY } from './family';
import type { Renderer } from '@wildshard/engine/render/renderer';

type Glow = ReturnType<typeof glowUniforms>;

export class BleedPass extends Pass {
  private mips: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  private readonly uPre;
  private readonly uDown = { tSrc: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly uUp = { tSrc: { value: null as Texture | null }, tAdd: { value: null as Texture | null }, uTexel: { value: new Vector2() } };
  private readonly mPre: ShaderMaterial;
  private readonly mDown: ShaderMaterial;
  private readonly mUp: ShaderMaterial;
  private type: TextureDataType = HalfFloatType;
  private w = 0;
  private h = 0;
  /** the ¼-res mip (the tight bleed) and the summed pyramid at ¼ (the wide one); null before the first setSize */
  tight: Texture | null = null;
  wide: Texture | null = null;

  constructor(private readonly view: PerspectiveCamera, glow: Glow, threshold = 1.0, knee = 0.08) {
    super('NdBleedPass');
    this.needsSwap = false;
    this.needsDepthTexture = true;
    this.uPre = {
      tSrc: { value: null as Texture | null }, tDepth: { value: null as Texture | null }, uTexel: { value: new Vector2() },
      uPre: { value: new Vector2(threshold, knee) }, uNearP: { value: 0.1 }, uFarP: { value: 1000 }, uGlow: glow.uGlow, uGlow2: glow.uGlow2,
    };
    this.mPre = PASS_FAMILY.material('bleedPre', this.uPre);
    this.mDown = PASS_FAMILY.material('bleedDown', this.uDown);
    this.mUp = PASS_FAMILY.material('bleedUp', this.uUp);
    this.fullscreenMaterial = this.mPre;
  }

  override initialize(renderer: Renderer, _alpha: boolean, frameBufferType: number): void {
    const ext = renderer.extensions;
    this.type = frameBufferType === UnsignedByteType || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) ? UnsignedByteType : HalfFloatType;
  }

  override setDepthTexture(depthTexture: Texture): void { this.uPre.tDepth.value = depthTexture; }

  override setSize(width: number, height: number): void {
    if (width === this.w && height === this.h) return;
    this.w = width;
    this.h = height;
    for (const m of [...this.mips, ...this.ups]) m.dispose();
    this.mips = [];
    this.ups = [];
    // ¼ (the prefilter: tight), ⅛, 1/16; ups at ⅛ and ¼ (wide)
    let mw = Math.max(1, Math.round(width / 4)), mh = Math.max(1, Math.round(height / 4));
    for (let i = 0; i < 3; i++) {
      const rt = new WebGLRenderTarget(mw, mh, { type: this.type, depthBuffer: false });
      rt.texture.minFilter = LinearFilter;
      rt.texture.magFilter = LinearFilter;
      rt.texture.name = `NdBleed.mip${String(i)}`;
      this.mips.push(rt);
      if (i <= 1) {
        const up = new WebGLRenderTarget(mw, mh, { type: this.type, depthBuffer: false });
        up.texture.minFilter = LinearFilter;
        up.texture.magFilter = LinearFilter;
        up.texture.name = `NdBleed.up${String(i)}`;
        this.ups.push(up);
      }
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
    }
    this.tight = this.mips[0]?.texture ?? null;
    this.wide = this.ups[0]?.texture ?? null;
  }

  private draw(renderer: Renderer, mat: ShaderMaterial, target: WebGLRenderTarget): void {
    this.fullscreenMaterial = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  override render(renderer: Renderer, inputBuffer: WebGLRenderTarget | null): void {
    const [m0, m1, m2] = this.mips;
    const [u0, u1] = this.ups;
    if (inputBuffer === null || m0 === undefined || m1 === undefined || m2 === undefined || u0 === undefined || u1 === undefined) return;
    this.uPre.tSrc.value = inputBuffer.texture;
    this.uPre.uTexel.value.set(1 / inputBuffer.width, 1 / inputBuffer.height);
    this.uPre.uNearP.value = this.view.near;
    this.uPre.uFarP.value = this.view.far;
    this.draw(renderer, this.mPre, m0);
    for (const [src, dst] of [[m0, m1], [m1, m2]] as const) {
      this.uDown.tSrc.value = src.texture;
      this.uDown.uTexel.value.set(1 / src.width, 1 / src.height);
      this.draw(renderer, this.mDown, dst);
    }
    for (const [src, add, dst] of [[m2, m1, u1], [u1, m0, u0]] as const) {
      this.uUp.tSrc.value = src.texture;
      this.uUp.tAdd.value = add.texture;
      this.uUp.uTexel.value.set(1 / src.width, 1 / src.height);
      this.draw(renderer, this.mUp, dst);
    }
  }

  override dispose(): void {
    for (const m of [...this.mips, ...this.ups]) m.dispose();
    this.mPre.dispose();
    this.mDown.dispose();
    this.mUp.dispose();
    super.dispose();
  }
}
