import * as THREE from 'three';
import type { Renderer } from './renderer';
import { dropShadowColour, shadowColourDropped } from '../world/shadowVariants';
import { SHADOW_LAYER } from '../core/shadowLayer';

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
 * - only a 1×1 scissor of the target is written, and the next game frame redraws it;
 * - the slice's shadow casters draw into a stand-in of each light's shadow map (`ShadowStandIns`: the real map's formats,
 *   one texel per cascade), so the depth pipelines are built too and no real map is touched (op-hitch33: Nalati's entry
 *   frame drew its casters' depth variants for the first time);
 * - the subtree is shown, its batch put on a private camera layer and unculled, and every light put on that layer,
 *   only for the synchronous call; every flag is restored before the slice yields.
 *
 * Output is unchanged: nothing is drawn to the screen and no simulation advances. The only resources made are the shadow
 * stand-ins (a few texels each), disposed when the warm ends.
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
    // the view's drawables, and the shadow-only casters (SHADOW_LAYER) the shadow pass draws
    if (isDrawable(object) && (object.layers.test(camera.layers) || object.castShadow && object.layers.isEnabled(SHADOW_LAYER))) out.push(object);
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

/**
 * Stand-in shadow maps for the slices' depth draws (op-hitch33): one per shadow-casting light, with the light's own
 * map's attachment formats (so the depth pipelines equal the entry frame's) but one texel per cascade viewport. The
 * light's real map is never written, so a cascade that is not redrawn on the next frame (the far cascade every other
 * frame, a settled fade ghost) shows exactly what it showed. Created on first use, disposed when the warm ends.
 */
export class ShadowStandIns {
  private readonly targets = new Map<THREE.LightShadow, THREE.WebGLRenderTarget>();
  private readonly renderer: Renderer | null;
  /** `renderer`: the game's renderer, which makes a stand-in depth-only like its real map; null (a test's fake) skips it */
  constructor(renderer: Renderer | null) { this.renderer = renderer; }
  /** The stand-in for `shadow`, or null when its map cannot be stood in for (none yet, a cube map, VSM). */
  standIn(shadow: THREE.LightShadow, vsm: boolean): THREE.WebGLRenderTarget | null {
    const real = shadow.map;
    if (vsm || real === null || (real as THREE.WebGLRenderTarget & { isWebGLCubeRenderTarget?: boolean }).isWebGLCubeRenderTarget === true) return null;
    const extents = shadow.getFrameExtents();
    let target = this.targets.get(shadow);
    if (target === undefined || target.width !== extents.x || target.height !== extents.y) {
      target?.dispose(); target?.depthTexture?.dispose();
      const texture = real.texture;
      target = new THREE.WebGLRenderTarget(extents.x, extents.y, { type: texture.type,
        depthBuffer: real.depthBuffer, stencilBuffer: real.stencilBuffer, samples: real.samples, generateMipmaps: false });
      target.texture.format = texture.format;
      target.texture.name = `${texture.name}.warm`;
      const depth = real.depthTexture;
      if (depth !== null) {
        const copy = new THREE.DepthTexture(extents.x, extents.y, depth.type);
        copy.format = depth.format; copy.compareFunction = depth.compareFunction;
        copy.minFilter = depth.minFilter; copy.magFilter = depth.magFilter; copy.name = `${depth.name}.warm`;
        target.depthTexture = copy;
      }
      // a depth-only real map (E174 / the Memory saver) has no colour attachment: neither may its stand-in
      if (this.renderer !== null && shadowColourDropped(real)) { this.renderer.initRenderTarget(target); dropShadowColour(this.renderer, target); }
      this.targets.set(shadow, target);
    }
    return target;
  }
  /** Dispose every stand-in. */
  dispose(): void {
    for (const target of this.targets.values()) { target.depthTexture?.dispose(); target.dispose(); }
    this.targets.clear();
  }
}

const isShadow = (value: unknown): value is THREE.LightShadow => value instanceof THREE.LightShadow;

interface ShadowSwap { shadow: THREE.LightShadow; map: THREE.LightShadow['map']; size: THREE.Vector2; auto: boolean; needs: boolean }

/**
 * Point every casting light at its stand-in for the slice's render (every cascade draws there, even one drawn every other
 * frame); a light with no stand-in draws nothing. Returns what `restoreShadows` puts back, and whether any light draws.
 */
function swapShadows(lights: readonly THREE.Light[], standIns: ShadowStandIns, vsm: boolean): { swaps: ShadowSwap[]; drawn: boolean } {
  const swaps: ShadowSwap[] = [];
  let drawn = false;
  for (const light of lights) {
    const shadow: unknown = Reflect.get(light, 'shadow');
    if (!light.castShadow || !isShadow(shadow)) continue;
    swaps.push({ shadow, map: shadow.map, size: shadow.mapSize.clone(), auto: shadow.autoUpdate, needs: shadow.needsUpdate });
    const standIn = light instanceof THREE.PointLight ? null : standIns.standIn(shadow, vsm);
    if (standIn === null) { shadow.autoUpdate = false; shadow.needsUpdate = false; continue; }
    shadow.map = standIn; shadow.mapSize.set(1, 1); shadow.autoUpdate = true;
    drawn = true;
  }
  return { swaps, drawn };
}

function restoreShadows(swaps: readonly ShadowSwap[]): void {
  for (const swap of swaps) { swap.shadow.map = swap.map; swap.shadow.mapSize.copy(swap.size); swap.shadow.autoUpdate = swap.auto; swap.shadow.needsUpdate = swap.needs; }
}

/** The renderer calls a slice makes (a WebGLRenderer). */
export type ParkedDrawRenderer = Pick<Renderer, 'render' | 'getRenderTarget' | 'setRenderTarget' | 'getActiveCubeFace' | 'getActiveMipmapLevel'
  | 'getScissor' | 'setScissor' | 'getScissorTest' | 'setScissorTest'> & {
  readonly shadowMap: { autoUpdate: boolean; needsUpdate: boolean; type: THREE.ShadowMapType } };

const DEFAULT_BUDGET: ParkedDrawBudget = { drawables: 8, newMaterials: 2 };

/**
 * Draw every visible drawable under the hidden `root` into a 1×1 scissor of `target`, and its casters into the shadow
 * stand-ins, a slice per `pause()`. `environment` is the environment the entry frame will draw with (a parked sky can
 * differ from the road's). `current` fences every slice; a left owner rejects before the next draw.
 */
export async function warmParkedDraws(renderer: ParkedDrawRenderer, scene: THREE.Scene, camera: THREE.Camera,
  target: THREE.WebGLRenderTarget | null, root: THREE.Object3D, current: () => boolean, pause: () => Promise<void>,
  options: { environment?: THREE.Texture | null; budget?: ParkedDrawBudget } = {}): Promise<number> {
  const slices = parkedDrawSlices(parkedDrawables(root, camera), options.budget ?? DEFAULT_BUDGET);
  const view = camera.clone(), standIns = new ShadowStandIns(renderer instanceof THREE.WebGLRenderer ? renderer : null);
  let drawn = 0;
  try {
    for (const slice of slices) {
      if (!current()) throw new Error('Parked draw owner left');
      drawSlice(renderer, scene, camera, view, target, root, slice, options.environment, standIns);
      drawn += slice.length;
      await pause();
    }
  } finally { standIns.dispose(); }
  return drawn;
}

function drawSlice(renderer: ParkedDrawRenderer, scene: THREE.Scene, camera: THREE.Camera, view: THREE.Camera,
  target: THREE.WebGLRenderTarget | null, root: THREE.Object3D, slice: readonly THREE.Object3D[],
  environment: THREE.Texture | null | undefined, standIns: ShadowStandIns): void {
  view.copy(camera, false);
  view.layers.set(WARM_LAYER);
  const inSlice = new Set(slice);
  const lights: { light: THREE.Light; mask: number }[] = [];
  // shadow-only casters (SHADOW_LAYER: the shadow pass sees them through the view camera) outside the slice sit it out
  const benched: { object: THREE.Object3D; mask: number }[] = [];
  scene.traverse(object => {
    if (object instanceof THREE.Light) lights.push({ light: object, mask: object.layers.mask });
    else if (!inSlice.has(object) && object.layers.isEnabled(SHADOW_LAYER)) benched.push({ object, mask: object.layers.mask });
  });
  const objects = slice.map(object => ({ object, mask: object.layers.mask, culled: object.frustumCulled, colour: object.layers.test(camera.layers) }));
  const rootVisible = root.visible, priorEnvironment = scene.environment;
  const priorTarget = renderer.getRenderTarget(), priorFace = renderer.getActiveCubeFace(), priorMip = renderer.getActiveMipmapLevel();
  const shadowAuto = renderer.shadowMap.autoUpdate, shadowNeeds = renderer.shadowMap.needsUpdate;
  const scissor = target?.scissor.clone(), scissorTest = target?.scissorTest ?? false;
  const canvasScissor = renderer.getScissor(new THREE.Vector4()), canvasScissorTest = renderer.getScissorTest();
  let shadows: ShadowSwap[] = [];
  try {
    root.visible = true;
    if (environment !== undefined) scene.environment = environment;
    for (const { light } of lights) light.layers.enable(WARM_LAYER);
    for (const { object, colour } of objects) { if (colour) object.layers.enable(WARM_LAYER); object.frustumCulled = false; }
    for (const { object } of benched) object.layers.disableAll();
    // the slice's casters draw into each light's stand-in map in the same render (the entry frame's depth pipelines)
    const swapped = swapShadows(lights.map(({ light }) => light), standIns, renderer.shadowMap.type === THREE.VSMShadowMap);
    shadows = swapped.swaps;
    renderer.shadowMap.autoUpdate = swapped.drawn; renderer.shadowMap.needsUpdate = false;
    if (target !== null) { target.scissor.set(0, 0, 1, 1); target.scissorTest = true; }
    else { renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true); }
    renderer.setRenderTarget(target);
    renderer.render(scene, view);
  } finally {
    root.visible = rootVisible; scene.environment = priorEnvironment;
    for (const { light, mask } of lights) light.layers.mask = mask;
    for (const { object, mask, culled } of objects) { object.layers.mask = mask; object.frustumCulled = culled; }
    for (const { object, mask } of benched) object.layers.mask = mask;
    restoreShadows(shadows);
    renderer.shadowMap.autoUpdate = shadowAuto; renderer.shadowMap.needsUpdate = shadowNeeds;
    if (target !== null && scissor !== undefined) { target.scissor.copy(scissor); target.scissorTest = scissorTest; }
    renderer.setScissor(canvasScissor); renderer.setScissorTest(canvasScissorTest);
    renderer.setRenderTarget(priorTarget, priorFace, priorMip);
  }
}
