/**
 * n8ao's transparency pre-passes, made cheap (PINE-HOLLOW PH-P2; SHARD-PLATFORM SF69).
 *
 * n8ao (`N8AOPostPass`, transparency-aware) re-renders the whole scene twice per frame into two full-resolution targets:
 * once with only the transparents that write no depth, once with only those that do. Its compositer then takes, per
 * pixel, `max(alpha of the first, (1 − alpha of the second) × [the second's depth == the scene depth])` and lifts the AO
 * by it. Each render walks and re-sorts the scene, and the GPU clears both targets, copies the scene depth into each and
 * the compositer reads all three back.
 *
 * Both cuts leave the frame bit-identical:
 *
 * 1. **The passes touch only this frame's visible renderables** (SF69). One walk of the visible graph decides each one's
 *    pass visibility exactly as n8ao's would (`was && (transparent && !depthWrite && !treatAsOpaque || cannotReceiveAO)`,
 *    then `was && transparent && depthWrite && !treatAsOpaque`), with the PH-P2 rules folded in (moved here from
 *    Game.ts): an opaque multi-material mesh sits both out (n8ao's `material.transparent` is undefined on one, so three
 *    drew every rig a second time), and the depth-free transparents (glass, clouds, water, smoke, particles) leave the
 *    first pass (`lean() === false` draws them again; PH-P2's same-instant A/B showed no pixel past the frame noise).
 *    n8ao's four whole-scene walks with a fresh `Map` of every object, and its every-frame walk looking for a transparent
 *    material, are gone. Against the PH-P2 wrapper over n8ao's own passes: 0 bytes differ (SF69 pixel diff).
 *
 * 2. **No pre-pass at all when nothing would draw in either** (SF69). With nothing drawn, the first target holds alpha 0
 *    and the second alpha 0 over a depth of `clamp(scene depth + 0.00001)`, which equals the scene depth only where it is
 *    the clear value (nothing drew: 1, or 0 under a reversed depth buffer). Two 1×1 stand-ins (alpha 0; alpha 0 over the
 *    clear depth) give the compositer exactly those values, so the AO is unchanged, without the two scene walks, the two
 *    full-screen clears and depth copies, and the full-resolution reads. The scene's own render hooks still run twice,
 *    as the two skipped renders would have run them. The test is conservative: any object that could draw in either
 *    pass (visible, on the camera's layers, inside the view frustum) keeps the full passes.
 */
import * as THREE from 'three';
import type { N8AOPostPass } from 'n8ao';
import type { Renderer } from './renderer';

/** live switches (Game.ts fields, for same-instant A/B captures) */
export interface AoTransparencySwitches {
  /** cut 1's depth-free half: leave out the transparents that write no depth (PH-P2) */
  lean: () => boolean;
  /** cut 2: skip both pre-passes when nothing would draw in either (SF69) */
  skipEmpty: () => boolean;
}

/** n8ao's depth-buffer kinds (its `DepthType`): 3 = reversed */
const REVERSE_DEPTH = 3;
const PASS_FREE = 1, PASS_WRITE = 2; // the depth-free pass, the depth-writing pass
const PASSES = [PASS_FREE, PASS_WRITE] as const; // n8ao's order

/**
 * Which of n8ao's two pre-passes this object draws in (a bit set), with cut 1 applied: exactly the `visible` n8ao gives
 * it in each (`was && (transparent && !depthWrite && !treatAsOpaque || cannotReceiveAO)`, then
 * `was && transparent && depthWrite && !treatAsOpaque`, where a multi-material mesh's undefined `transparent` draws).
 */
function prepassBits(material: THREE.Material | THREE.Material[], userData: Record<string, unknown>, lean: boolean): number {
  const noAo = Boolean(userData['cannotReceiveAO']);
  if (Array.isArray(material)) {
    let transparent = false;
    for (const m of material) if (m.transparent) { transparent = true; break; }
    if (!transparent) return 0; // an opaque multi-material mesh sits both out (cut 1)
    return (noAo ? PASS_FREE : 0) | PASS_WRITE;
  }
  const opaqueToAo = userData['treatAsOpaque'] === true || (lean && material.transparent && !material.depthWrite); // cut 1
  const free = (material.transparent && !material.depthWrite && !opaqueToAo) || noAo;
  const write = material.transparent && material.depthWrite && !opaqueToAo;
  return (free ? PASS_FREE : 0) | (write ? PASS_WRITE : 0);
}

const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();

/** three's projectObject test: on the camera's layers and, when frustum-culled, inside the view frustum */
function inView(o: THREE.Object3D, camera: THREE.Camera): boolean {
  if (!o.layers.test(camera.layers)) return false;
  if (!o.frustumCulled) return true;
  if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) return frustum.intersectsObject(o);
  return true; // a sprite or another renderable: counted as in view (conservative)
}

/**
 * Install the cuts on an n8ao post pass that draws `scene` through `camera`. The pass's dispose also frees the stand-ins.
 */
export function installAoTransparency(ao: N8AOPostPass, scene: THREE.Scene, camera: THREE.Camera, switches: AoTransparencySwitches): void {
  // this frame's visible renderables (the graph three would walk) and the pre-passes each draws in
  const objects: THREE.Object3D[] = [];
  const bits: number[] = [];
  /** walks the visible graph into `objects` / `bits`; true when something in view draws in a pre-pass */
  const collect = (o: THREE.Object3D, lean: boolean): boolean => {
    if (!o.visible) return false; // three draws nothing under a hidden object
    let work = false;
    const material = (o as Partial<THREE.Mesh>).material;
    if (material !== undefined) {
      const b = prepassBits(material, o.userData, lean);
      objects.push(o); bits.push(b);
      work = b !== 0 && inView(o, camera);
    }
    for (const child of o.children) if (collect(child, lean)) work = true;
    return work;
  };

  // ── cut 1: n8ao's two renders, touching only this frame's visible renderables ──
  const clearColour = new THREE.Color();
  const showOnly = (pass: number): void => { for (let i = 0; i < objects.length; i++) { const o = objects[i]; if (o !== undefined) o.visible = ((bits[i] ?? 0) & pass) !== 0; } };
  const prepass = (renderer: Renderer): void => {
    const off = ao.transparencyRenderTargetDWFalse, on = ao.transparencyRenderTargetDWTrue, copy = ao.depthCopyPass;
    if (!(off instanceof THREE.WebGLRenderTarget) || !(on instanceof THREE.WebGLRenderTarget) || copy === null || copy === undefined) return;
    const background = scene.background, alpha = renderer.getClearAlpha(), autoClearDepth = renderer.autoClearDepth;
    const autoShadows = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(clearColour);
    scene.background = null;
    renderer.autoClearDepth = false;
    renderer.setClearColor(0x000000, 0);
    // its renders re-drew every shadow cascade too (autoUpdate), cleared and refilled with only the meshes it left
    // visible — after the main pass had used them, so nothing saw it: skip the redraw (Water.ts does too)
    renderer.shadowMap.autoUpdate = false;
    const uniforms = copy.material.uniforms;
    if (uniforms['depthTexture'] !== undefined) uniforms['depthTexture'].value = ao.depthTexture ?? null;
    if (uniforms['reverseDepthBuffer'] !== undefined) uniforms['reverseDepthBuffer'].value = ao.configuration.depthBufferType === REVERSE_DEPTH;
    try {
      for (const pass of PASSES) {
        renderer.setRenderTarget(pass === PASS_FREE ? off : on);
        showOnly(pass);
        renderer.clear(true, true, true);
        copy.render(renderer);
        renderer.render(scene, camera);
      }
    } finally {
      for (const o of objects) o.visible = true; // every one was visible (collect walks only visible ones)
      renderer.shadowMap.autoUpdate = autoShadows;
      renderer.setClearColor(clearColour, alpha);
      scene.background = background;
      renderer.autoClearDepth = autoClearDepth;
    }
  };
  ao.renderTransparency = prepass;

  // ── cut 2: nothing to draw → 1×1 stand-ins holding exactly what the empty passes would hold ──
  const blankOff = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const blankOn = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const blankDepth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  blankOn.depthTexture = blankDepth;
  blankOff.texture.name = 'n8ao.blankTransparency'; blankOn.texture.name = 'n8ao.blankTransparencyDepthWrite';
  // cleared on every use (two 1×1 clears): nothing to restore after a context loss
  const clearBlanks = (renderer: Renderer): void => {
    const target = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColour);
    renderer.setClearColor(0x000000, 0);
    try {
      renderer.setRenderTarget(blankOff); renderer.clear(true, false, false);
      renderer.setRenderTarget(blankOn); renderer.clear(true, true, false); // the renderer's clear depth: 1, or 0 reversed
    } finally { renderer.setRenderTarget(target); renderer.setClearColor(clearColour, alpha); }
  };
  // the skipped renders' scene hooks: three runs scene.onBeforeRender(renderer, scene, camera, target) and
  // scene.onAfterRender(renderer, scene, camera) on every render (the grid frame and the light pool hook them)
  const blanks = [blankOff, blankOn] as const;
  const hooksOnly = (renderer: Renderer): void => {
    for (const target of blanks) {
      const before: unknown = Reflect.get(scene, 'onBeforeRender'), after: unknown = Reflect.get(scene, 'onAfterRender');
      if (typeof before === 'function') Reflect.apply(before, scene, [renderer, scene, camera, target]);
      if (typeof after === 'function') Reflect.apply(after, scene, [renderer, scene, camera]);
    }
  };

  const render = ao.render.bind(ao);
  ao.render = (renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) => {
    const off = ao.transparencyRenderTargetDWFalse, on = ao.transparencyRenderTargetDWTrue;
    objects.length = 0; bits.length = 0;
    let work = true;
    if (ao.configuration.transparencyAware) {
      // n8ao re-walks the whole scene every frame looking for a transparent material, only ever to switch this on
      ao.autoDetectTransparency = false;
      camera.updateMatrixWorld();
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection, camera.coordinateSystem, camera.reversedDepth);
      work = collect(scene, switches.lean());
    }
    const skip = !work && switches.skipEmpty() && off instanceof THREE.WebGLRenderTarget && on instanceof THREE.WebGLRenderTarget;
    if (!skip) {
      try { render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest); } finally { objects.length = 0; bits.length = 0; }
      return;
    }
    clearBlanks(renderer);
    ao.transparencyRenderTargetDWFalse = blankOff; ao.transparencyRenderTargetDWTrue = blankOn;
    ao.renderTransparency = hooksOnly;
    try { render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest); } finally {
      ao.renderTransparency = prepass;
      ao.transparencyRenderTargetDWFalse = off; ao.transparencyRenderTargetDWTrue = on;
      objects.length = 0; bits.length = 0;
    }
  };
  const dispose = ao.dispose.bind(ao);
  ao.dispose = () => { blankOff.dispose(); blankDepth.dispose(); blankOn.dispose(); dispose(); };
}
