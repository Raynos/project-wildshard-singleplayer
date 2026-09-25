/**
 * The scene pass that keeps the world's depth for the post chain (PINE-HOLLOW-REMASTER, the render-fix lane).
 *
 * Every first-person viewmodel (the crossbow, the rifles, the longbow, the sword, the swim hands, the hoverboard, the
 * skinning knife) draws a clearer at renderOrder 999 whose `onBeforeRender` calls `renderer.clearDepth()`, so the weapon
 * — at 1000 — never clips into a wall. The post chain's depth readers (n8ao's AO, the volumetric march in Volumetrics.ts,
 * the god rays' sun mask) read the composer's stable depth, which postprocessing blits from the scene pass's target
 * AFTER the scene pass: by then it held the weapon alone, every world pixel cleared to the far plane. So with a weapon
 * out the AO shaded only the weapon, the march integrated 120 m of height fog through every wall and never saw a
 * shadow, and the sun's rays shone through rock and trunks.
 *
 * `WorldRenderPass` is the RenderPass with the depth kept: the first depth clear of the pass blits the world's depth into
 * the composer's stable target first, and after the pass the viewmodel's own depth is merged over it (one full-screen,
 * depth-only draw, LESS) — the effects see world + weapon exactly as if the weapon had been drawn without the clear. The
 * pixels, the draw order and the grade are untouched; the frame gains one draw (the merge, only while a viewmodel
 * cleared) and the composer's own post-pass blit becomes this pass's. No viewmodel shown (a menu, the golden-hour reward
 * view) = no clear = the plain blit, as before. `?aofix=0` builds the old pass (today's look, for A/B).
 */
import * as THREE from 'three';
import { RenderPass, type EffectComposer } from 'postprocessing';

/** `?aofix=0`: the depth clear leaks into the post chain again (the pre-fix look, for A/B shots) */
export const WORLD_DEPTH_FIX: boolean = typeof location === 'undefined' || new URLSearchParams(location.search).get('aofix') !== '0';

/** a render target's framebuffer, once three has set it up */
function framebufferOf(renderer: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget): WebGLFramebuffer | null {
  const props: unknown = renderer.properties.get(rt);
  if (typeof props !== 'object' || props === null || !('__webglFramebuffer' in props)) return null;
  const fb = props.__webglFramebuffer;
  return fb instanceof WebGLFramebuffer ? fb : null;
}

/**
 * Copy `src`'s depth into `dst` (same size, same depth format — postprocessing makes the stable target so). Leaves `src`
 * bound for drawing, three's framebuffer cache in step: safe in the middle of a scene render.
 */
function blitDepth(renderer: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget): boolean {
  const gl = renderer.getContext();
  if (!(gl instanceof WebGL2RenderingContext)) return false;
  const s = framebufferOf(renderer, src), d = framebufferOf(renderer, dst);
  if (s === null || d === null) return false;
  const state = renderer.state;
  state.bindFramebuffer(gl.READ_FRAMEBUFFER, s);
  state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d);
  gl.blitFramebuffer(0, 0, src.width, src.height, 0, 0, dst.width, dst.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
  state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, s);
  return true;
}

export class WorldRenderPass extends RenderPass {
  /** the scene pass's own target while it draws (null otherwise): the only target whose clear is the viewmodels' */
  private drawing: THREE.WebGLRenderTarget | null = null;
  /** the world's depth is in the stable target this frame (a viewmodel cleared) */
  private kept = false;
  /** the merge: the viewmodel's depth over the world's, into the stable target (depth-only; the input's 1.0 = discard) */
  private readonly depthIn: THREE.IUniform<THREE.Texture | null> = { value: null };
  readonly mergeMaterial = new THREE.ShaderMaterial({
    name: 'ViewmodelDepthMerge',
    uniforms: { tDepth: this.depthIn },
    depthTest: true, depthWrite: true, depthFunc: THREE.LessDepth, colorWrite: false, fog: false,
    vertexShader: /* glsl */`void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform highp sampler2D tDepth;
      void main() {
        float d = texelFetch(tDepth, ivec2(gl_FragCoord.xy), 0).r;
        if (d >= 1.0) discard;
        gl_FragDepth = d;
      }`,
  });
  private readonly mergeScene = new THREE.Scene();
  private readonly mergeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(scene: THREE.Scene, camera: THREE.Camera, private readonly composer: EffectComposer) {
    super(scene, camera);
    if (!WORLD_DEPTH_FIX) return;
    Reflect.set(this, 'needsDepthBlit', false); // this pass fills the stable depth itself (render below)
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const quad = new THREE.Mesh(tri, this.mergeMaterial);
    quad.frustumCulled = false;
    this.mergeScene.add(quad);
    const renderer = composer.getRenderer();
    const clearDepth = renderer.clearDepth.bind(renderer);
    renderer.clearDepth = () => { this.keepWorldDepth(renderer); clearDepth(); };
  }

  /** the composer's stable depth target (made when the first depth-reading pass is added; null = nothing reads depth) */
  private stableTarget(): THREE.WebGLRenderTarget | null {
    const rt: unknown = Reflect.get(this.composer, 'depthRenderTarget');
    return rt instanceof THREE.WebGLRenderTarget ? rt : null;
  }

  /** read through a call: the clear sets it from inside `super.render`, where control-flow narrowing cannot see */
  private keptThisFrame(): boolean { return this.kept; }

  /** before a depth clear: the first one of the scene pass saves the world's depth */
  private keepWorldDepth(renderer: THREE.WebGLRenderer): void {
    const target = this.drawing;
    if (target === null || this.kept || renderer.getRenderTarget() !== target) return;
    const stable = this.stableTarget();
    if (stable !== null && blitDepth(renderer, target, stable)) this.kept = true;
  }

  override render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget | null, outputBuffer: THREE.WebGLRenderTarget | null, deltaTime?: number, stencilTest?: boolean): void {
    const stable = WORLD_DEPTH_FIX ? this.stableTarget() : null;
    if (stable === null || inputBuffer === null || this.renderToScreen) { super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest); return; }
    renderer.initRenderTarget(stable); // a no-op once set up (again after a resize)
    this.kept = false;
    this.drawing = inputBuffer;
    try { super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest); } finally { this.drawing = null; }
    // no viewmodel cleared: the world's depth is the whole buffer — the composer's own blit, done here
    if (!this.keptThisFrame()) { blitDepth(renderer, inputBuffer, stable); return; }
    this.depthIn.value = inputBuffer.depthTexture;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(stable);
    renderer.render(this.mergeScene, this.mergeCamera);
    renderer.autoClear = autoClear;
  }
}
