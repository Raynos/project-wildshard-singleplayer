import * as THREE from 'three';
import type { Renderer } from './renderer';

/**
 * Draw a parked (hidden) subtree once, a few objects per painted slice, before it is first shown (op-hitch31, E435).
 *
 * Precompile (`precompile.ts`) issues and links every program a parked cell needs, and uploads its textures, but the
 * first draw of each (program × geometry layout × target) still builds the driver's pipeline and touches its buffers.
 * A cell made visible in one frame paid all of that at once: Sky Reach's entry frame was 900 ms on desktop with the
 * main thread idle (GPU process) and 166–1011 ms on the iOS Simulator, all inside the `activate` hook. This replays
 * the entry frame's colour draws ahead of time, spread over frames:
 *
 * - each slice draws a handful of the root's drawables (bounded by count and by new materials) through the page's own
 *   `renderer.render(scene, camera)` into the real target, so lights, fog, environment, tone mapping, colour space and
 *   attachment formats (the program and pipeline keys) equal the entry frame's;
 * - only a 1×1 scissor of the target is written, and the next game frame redraws it; the scene's shadow maps are not
 *   re-rendered (`shadowMap.autoUpdate` / `needsUpdate` held off for the call);
 * - the subtree is shown, its batch put on a private camera layer and unculled, and every light put on that layer,
 *   only for the synchronous call; every flag is restored before the slice yields.
 *
 * Output is unchanged: nothing is drawn to the screen, no simulation advances, no resource is created or disposed.
 */

/** A camera layer no content uses (ModelExplorer 31, diorama 30, shadows 9, Nalati bake 7). */
const WARM_LAYER = 29;

type Drawable = THREE.Object3D & { material: THREE.Material | THREE.Material[] };

const drawableMaterials = (object: THREE.Object3D): THREE.Material[] => {
  const material = (object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] }).material;
  return Array.isArray(material) ? material : material === undefined ? [] : [material];
};

const isDrawable = (object: THREE.Object3D): object is Drawable => {
  const kind = object as THREE.Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };
  return (kind.isMesh === true || kind.isPoints === true || kind.isLine === true || kind.isSprite === true) && drawableMaterials(object).length > 0;
};

/** The drawables an entry frame would draw under `root` (the root itself is the parked, hidden node). */
function parkedDrawables(root: THREE.Object3D, camera: THREE.Camera): Drawable[] {
  const out: Drawable[] = [];
  const visit = (object: THREE.Object3D): void => {
    if (object !== root && !object.visible) return;
    if (isDrawable(object) && object.layers.test(camera.layers)) out.push(object);
    for (const child of object.children) visit(child);
  };
  visit(root);
  return out;
}

/** Slice size: at most this many drawables, and at most this many materials not drawn by an earlier slice. */
export interface ParkedDrawBudget { readonly drawables: number; readonly newMaterials: number }

/** Split drawables into slices so that each slice builds only a few new pipelines. */
export function parkedDrawSlices<T extends THREE.Object3D>(drawables: readonly T[], budget: ParkedDrawBudget): T[][] {
  const slices: T[][] = [];
  const seen = new Set<THREE.Material>();
  let slice: T[] = [], fresh = 0;
  for (const object of drawables) {
    const unseen = drawableMaterials(object).filter(material => !seen.has(material));
    if (slice.length > 0 && (slice.length >= budget.drawables || fresh + unseen.length > budget.newMaterials)) {
      slices.push(slice); slice = []; fresh = 0;
    }
    slice.push(object); fresh += unseen.length;
    for (const material of unseen) seen.add(material);
  }
  if (slice.length > 0) slices.push(slice);
  return slices;
}

/** The renderer calls a slice makes (a WebGLRenderer). */
export type ParkedDrawRenderer = Pick<Renderer, 'render' | 'getRenderTarget' | 'setRenderTarget' | 'getActiveCubeFace' | 'getActiveMipmapLevel'
  | 'getScissor' | 'setScissor' | 'getScissorTest' | 'setScissorTest'> & { readonly shadowMap: { autoUpdate: boolean; needsUpdate: boolean } };

const DEFAULT_BUDGET: ParkedDrawBudget = { drawables: 8, newMaterials: 2 };

/**
 * Draw every visible drawable under the hidden `root` into a 1×1 scissor of `target`, a slice per `pause()`.
 * `environment` is the environment the entry frame will draw with (a parked sky can differ from the road's).
 * `current` fences every slice; a left owner rejects before the next draw.
 */
export async function warmParkedDraws(renderer: ParkedDrawRenderer, scene: THREE.Scene, camera: THREE.Camera,
  target: THREE.WebGLRenderTarget | null, root: THREE.Object3D, current: () => boolean, pause: () => Promise<void>,
  options: { environment?: THREE.Texture | null; budget?: ParkedDrawBudget } = {}): Promise<number> {
  const slices = parkedDrawSlices(parkedDrawables(root, camera), options.budget ?? DEFAULT_BUDGET);
  const view = camera.clone();
  let drawn = 0;
  for (const slice of slices) {
    if (!current()) throw new Error('Parked draw owner left');
    drawSlice(renderer, scene, camera, view, target, root, slice, options.environment);
    drawn += slice.length;
    await pause();
  }
  return drawn;
}

function drawSlice(renderer: ParkedDrawRenderer, scene: THREE.Scene, camera: THREE.Camera, view: THREE.Camera,
  target: THREE.WebGLRenderTarget | null, root: THREE.Object3D, slice: readonly THREE.Object3D[], environment: THREE.Texture | null | undefined): void {
  view.copy(camera, false);
  view.layers.set(WARM_LAYER);
  const lights: { light: THREE.Light; mask: number }[] = [];
  scene.traverse(object => { if (object instanceof THREE.Light) lights.push({ light: object, mask: object.layers.mask }); });
  const objects = slice.map(object => ({ object, mask: object.layers.mask, culled: object.frustumCulled }));
  const rootVisible = root.visible, priorEnvironment = scene.environment;
  const priorTarget = renderer.getRenderTarget(), priorFace = renderer.getActiveCubeFace(), priorMip = renderer.getActiveMipmapLevel();
  const shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate;
  const scissor = target?.scissor.clone(), scissorTest = target?.scissorTest ?? false;
  const canvasScissor = renderer.getScissor(new THREE.Vector4()), canvasScissorTest = renderer.getScissorTest();
  try {
    root.visible = true;
    if (environment !== undefined) scene.environment = environment;
    for (const { light } of lights) light.layers.enable(WARM_LAYER);
    for (const { object } of objects) { object.layers.enable(WARM_LAYER); object.frustumCulled = false; }
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    if (target !== null) { target.scissor.set(0, 0, 1, 1); target.scissorTest = true; }
    else { renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true); }
    renderer.setRenderTarget(target);
    renderer.render(scene, view);
  } finally {
    root.visible = rootVisible; scene.environment = priorEnvironment;
    for (const { light, mask } of lights) light.layers.mask = mask;
    for (const { object, mask, culled } of objects) { object.layers.mask = mask; object.frustumCulled = culled; }
    renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeeds;
    if (target !== null && scissor !== undefined) { target.scissor.copy(scissor); target.scissorTest = scissorTest; }
    renderer.setScissor(canvasScissor); renderer.setScissorTest(canvasScissorTest);
    renderer.setRenderTarget(priorTarget, priorFace, priorMip);
  }
}
