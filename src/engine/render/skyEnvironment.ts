import { Vector3, WebGLRenderer, WebGLRenderTarget, type Camera, type PMREMGenerator, type Scene, type Texture } from 'three';

/**
 * A day clock's sky as the scene's image-based light (SHARD-PLATFORM W2 C2; Pine Hollow's keyed sky and Driftwood's faceted
 * day): the sky drawn into a PMREM environment and refreshed as the clock moves on, in place. After the first build the
 * same cube-UV target is filled again, so `scene.environment` keeps its identity (every program its envmap define) and no
 * second target is allocated beside the old one. Nothing here knows a shard or its sky: the caller hands over what to draw
 * and keeps the generator and the target.
 *
 *   cube = refreshSkyEnvironment(gen, source, cube);   // the whole refresh (the first call allocates the target)
 *   step = stepSkyEnvironment(gen, source, cube, step); // a stepped refresh: one step a frame, -1 when done
 *
 * Everything draws with the generator's own renderer.
 *
 * THE SOURCE is an equirect pass (a scene + camera drawn into an equirect target, PMREM'd from that texture; the cube is a
 * quarter of its width) or a scene seen from the origin by PMREM's cube camera (`size` the cube, `near` / `far` its planes).
 *
 * THE STEPS (E142, the 30-fps-at-2× lane): the whole refresh is the source into the cube's top level, then r186's GGX
 * prefilter, ten 256-sample passes (~2 ms of an M5's GPU in one frame, a phone frame's whole budget). A stepped refresh
 * runs one step a frame instead: the top level, then one GGX level a frame. Both drive PMREMGenerator's internals
 * (`canStepSkyEnvironment`); a three upgrade that renames one falls back to the public whole refresh (a new target, the
 * old one freed).
 */

/** What the environment is drawn from. */
export type SkyEnvironmentSource =
  | { readonly kind: 'equirect'; readonly scene: Scene; readonly camera: Camera; readonly target: WebGLRenderTarget }
  | { readonly kind: 'scene'; readonly scene: Scene; readonly size: number; readonly near: number; readonly far: number };

/** the PMREMGenerator (r186) internals the in-place and stepped refreshes drive */
interface PmremSteps {
  _renderer: WebGLRenderer;
  _setSize: (cubeSize: number) => void;
  _textureToCubeUV: (texture: Texture, target: WebGLRenderTarget) => void;
  _sceneToCubeUV: (scene: Scene, near: number, far: number, target: WebGLRenderTarget, position: Vector3) => void;
  _applyGGXFilter: (target: WebGLRenderTarget, lodIn: number, lodOut: number) => void;
  _lodMeshes: unknown[];
}
/** The generator still has the internals the in-place and stepped refreshes drive. */
export function canStepSkyEnvironment(gen: object): gen is PmremSteps {
  return ['_setSize', '_textureToCubeUV', '_sceneToCubeUV', '_applyGGXFilter'].every((k) => typeof Reflect.get(gen, k) === 'function') && Array.isArray(Reflect.get(gen, '_lodMeshes')) && Reflect.get(gen, '_renderer') instanceof WebGLRenderer;
}

const ORIGIN = new Vector3();
/** a target's GPU bytes: half-float RGBA colour (8 a texel), its depth buffer at 4 */
const targetBytes = (t: { readonly width: number; readonly height: number; readonly depthBuffer: boolean }): number => t.width * t.height * (t.depthBuffer ? 12 : 8);
/** one of PMREM's cube-UV atlases at cube size `size` (3·max(size, 112) × 4·size) */
const atlasBytes = (size: number, depth: boolean): number => 3 * Math.max(size, 16 * 7) * 4 * size * (depth ? 12 : 8);
const cubeSize = (source: SkyEnvironmentSource): number => (source.kind === 'equirect' ? source.target.width / 4 : source.size);

/** run one PMREM step, then PMREMGenerator._cleanup's target reset (its own restores a module-level target from its last whole run) */
function inPlace(renderer: WebGLRenderer, cube: WebGLRenderTarget, atlas: boolean, run: () => void): void {
  const prev = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(), autoClear = renderer.autoClear;
  try {
    if (atlas) renderer.autoClear = false; // as PMREMGenerator._applyPMREM: each level is drawn into its own rectangle of the atlas
    run();
  } finally {
    renderer.autoClear = autoClear;
    cube.scissorTest = false;
    cube.viewport.set(0, 0, cube.width, cube.height);
    cube.scissor.set(0, 0, cube.width, cube.height);
    renderer.setRenderTarget(prev, face, mip);
  }
}

/** the source into the cube's top level (a scene: its depth cleared first, PMREM draws the six faces without clearing) */
function topLevel(renderer: WebGLRenderer, gen: PmremSteps, source: SkyEnvironmentSource, cube: WebGLRenderTarget): void {
  gen._setSize(cubeSize(source));
  renderer.setRenderTarget(source.kind === 'equirect' ? source.target : cube);
  if (source.kind === 'equirect') {
    renderer.render(source.scene, source.camera);
    gen._textureToCubeUV(source.target.texture, cube);
  } else {
    renderer.clearDepth();
    gen._sceneToCubeUV(source.scene, source.near, source.far, cube, ORIGIN);
  }
}

/** The whole refresh: the source PMREM'd into `cube` in place (the first call, `cube` null, allocates it); returns the target. */
export function refreshSkyEnvironment(gen: PMREMGenerator, source: SkyEnvironmentSource, cube: WebGLRenderTarget | null): WebGLRenderTarget {
  if (source.kind === 'equirect') {
    const renderer: unknown = Reflect.get(gen, '_renderer');
    if (!(renderer instanceof WebGLRenderer)) throw new Error('sky environment: the PMREM generator has no renderer');
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(source.target);
    renderer.render(source.scene, source.camera);
    renderer.setRenderTarget(prev);
    return gen.fromEquirectangular(source.target.texture, cube);
  }
  if (cube === null || !canStepSkyEnvironment(gen)) {
    const rt = gen.fromScene(source.scene, 0, source.near, source.far, { size: source.size });
    cube?.dispose();
    return rt;
  }
  const renderer = gen._renderer;
  inPlace(renderer, cube, false, () => { topLevel(renderer, gen, source, cube); });
  for (let i = 1; i < gen._lodMeshes.length; i++) inPlace(renderer, cube, true, () => { gen._applyGGXFilter(cube, i - 1, i); });
  return cube;
}

/**
 * One step of a stepped refresh into `cube` (built by a whole refresh first; check `canStepSkyEnvironment`): step 0 the
 * top level from the source, step i GGX level i from the one above. Returns the next step, or -1 when the refresh is done.
 */
export function stepSkyEnvironment(gen: PmremSteps, source: SkyEnvironmentSource, cube: WebGLRenderTarget, step: number): number {
  const renderer = gen._renderer;
  if (step === 0) inPlace(renderer, cube, false, () => { topLevel(renderer, gen, source, cube); });
  else inPlace(renderer, cube, true, () => { gen._applyGGXFilter(cube, step - 1, step); });
  return step + 1 < gen._lodMeshes.length ? step + 1 : -1;
}

/** The GPU bytes held now: an equirect pass's target, the environment target and the generator's ping-pong atlas. */
export function skyEnvironmentBytes(source: SkyEnvironmentSource, cube: WebGLRenderTarget | null, gen: PMREMGenerator | null): number {
  let bytes = (source.kind === 'equirect' ? targetBytes(source.target) : 0) + (cube === null ? 0 : targetBytes(cube));
  const ping: unknown = gen === null ? null : Reflect.get(gen, '_pingPongRenderTarget');
  if (ping instanceof WebGLRenderTarget) bytes += targetBytes(ping);
  return bytes;
}

/** The most it can hold: an equirect pass's target and two atlases (a scene's: two environment targets beside the ping-pong). */
export function skyEnvironmentCeiling(source: SkyEnvironmentSource): number {
  const size = cubeSize(source);
  if (source.kind === 'equirect') return targetBytes(source.target) + 2 * atlasBytes(size, false);
  return 2 * atlasBytes(size, true) + atlasBytes(size, false);
}
