import { pageScope, resourceScope } from '../app/resources';
import type { Scope } from '../app/scope';
import { engineString } from '../strings';
import * as THREE from 'three';
import { Pass, ToneMappingEffect, ToneMappingMode, type EffectComposer } from 'postprocessing';
import { newProgramsSince, snapshotPrograms, type ProgramLike } from '../boot/perflog';
import { bootTraceActive } from '../boot/bootTrace';
import type { Renderer } from './renderer';
import type { OffscreenPass } from './look';
import type { Game } from '../core/Game';
import { chunkShadowCastersSliced } from '../world/shadowChunks';
import { recordGpuCheckpoint } from '../boot/gpuTrace';
import { familyCompileJobs } from './families/registry';
import { shaderPatchTextures } from './shaderPatches';
import { uploadCompressedTexture } from './compressedUpload';
import { linkStandIn } from '../app/sceneOwnership';
import { offscreenPreparations } from './offscreenPreparation';
import { waitMaterialPreparations } from './materialPreparation';
import { prepareSceneResources } from './scenePreparation';

/**
 * Shader precompile for the `shaders` boot step (project/archive/2026-09-22-load-perf.md §P2.3, Status table).
 *
 * The first `render()` of the world used to build every program the scene needs in one
 * synchronous stall: the lit materials, then the shadow-depth variants of every caster, then the
 * post chain's screen-quad shaders — on iOS (Metal through ANGLE) ~150 ms a program, so 10–17 s
 * with the loading bar frozen at "140 / 142". This module builds the same programs *before* the
 * first frame, in three passes:
 *
 *   1. issue   — `renderer.compile()` of every distinct (material × object-flags) pair, of a
 *                MeshDepthMaterial configured the way WebGLShadowMap would for each caster, of the
 *                sky background box, and of every material the composer's passes own. Program
 *                creation is synchronous JS; it is spread over frames by wall time.
 *   2. link    — with KHR_parallel_shader_compile the driver links everything on its worker threads
 *                at once and we poll `program.isReady()`, reporting the ready count every frame.
 *                Without it, one program per frame is forced through LINK_STATUS so the stall is
 *                sliced and the bar still moves.
 *   3. (the caller's firstFrame step draws; it should find nothing left to compile — Debug ▸ Performance ▸ Load profiling
 *      lists what it did.)
 *
 * Program identity is the WebGLPrograms cache key: material type + shader IDs + parameters from
 * the target scene (fog, lights, environment), the object (instancing, skinning, morphs, geometry
 * attributes) and the render target (colour space, tone mapping). Every clone here is built so its
 * key equals the one the real draw will compute — a wrong key is a wasted compile, not a bug.
 */







export interface CompileJob {
  label: string;
  root: THREE.Object3D;
  /** An offscreen pass's actual camera, including its light/caster layer mask. */
  camera?: THREE.Camera;
  /** the scene whose fog / lights / environment the real draw will see (null: an empty scene) */
  target: THREE.Scene | null;
  /** render target the real draw goes to (null: the canvas) */
  rt: THREE.WebGLRenderTarget | null;
  /** compile with the target scene's fog cleared (the shadow pass and the background box see no fog) */
  fogOff?: boolean;
  /** The offscreen factory's tone mapping during this variant, restored before yielding. */
  toneMapping?: THREE.ToneMapping;
  /** Borrowed environment of a parked world's first draw. Applied only during synchronous compile, never a paint. */
  environment?: THREE.Texture;
  /** Release only stand-in resources, after their owner's real draws no longer need the cached programs. */
  dispose?: () => void;
}

export interface PrecompileReport { materials: number; jobs: number; programs: number; parallel: boolean }

/** Scalar preparation stage observation. Elapsed time includes painted waits; units count completed jobs/resources. */
export type PrecompileStage = (phase: 'compile' | 'link' | 'upload', elapsedMs: number, units: number) => void;

const exteriorLighting = new WeakMap<THREE.Scene, { environment: THREE.Texture | null; roots: Set<THREE.Object3D> }>();

/** Declare a content root whose lights disappear outside its frame. Sliced preparation also compiles the exterior
 * state, excluding all registered roots and borrowing its declared environment, without changing a live scene.
 * Registrations leave with their content owners; all roots on one page must agree on its exterior environment. */
export function registerExteriorLighting(scene: THREE.Scene, owner: Scope, root: THREE.Object3D, environment: THREE.Texture | null): void {
  if (owner.disposed) throw new Error('Exterior lighting requires a live owner');
  let state = exteriorLighting.get(scene);
  if (state === undefined) { state = { environment, roots: new Set() }; exteriorLighting.set(scene, state); }
  if (state.environment !== environment) throw new Error('Exterior lighting declarations disagree');
  if (state.roots.has(root)) throw new Error('Exterior lighting root is already registered');
  const held = state;
  held.roots.add(root);
  owner.onDispose(() => { held.roots.delete(root); if (held.roots.size === 0) exteriorLighting.delete(scene); });
}

/** Hidden registered siblings cannot draw on this entered frame. Keep its entire hierarchy and any visible roots;
 * ordinary boot has no exclusion. Borrowed roots and their visibility are never changed. */
export function entryFrameExclusions(scene: THREE.Scene, future?: THREE.Object3D): ReadonlySet<THREE.Object3D> | undefined {
  if (future === undefined) return undefined;
  const contains = (root: THREE.Object3D, child: THREE.Object3D): boolean => {
    for (let node: THREE.Object3D | null = child; node !== null; node = node.parent) if (node === root) return true;
    return false;
  };
  return new Set([...exteriorLighting.get(scene)?.roots ?? []].filter(root => !root.visible
    && !contains(root, future) && !contains(future, root)));
}

function exclusiveMaterials(scene: THREE.Scene, excluded: ReadonlySet<THREE.Object3D> | undefined): Set<THREE.Material> | undefined {
  if (excluded === undefined || excluded.size === 0) return undefined;
  const included = new Set<THREE.Material>(), materials = new Set<THREE.Material>();
  compileObjects(scene, object => { for (const material of materialsOf(object)) included.add(material); }, excluded);
  for (const root of excluded) root.traverse(object => {
    for (const material of materialsOf(object)) if (!included.has(material)) materials.add(material);
  });
  return materials;
}

function exteriorJobs(scene: THREE.Scene, rt: THREE.WebGLRenderTarget | null, shadows: boolean, roots?: readonly THREE.Object3D[], per = 6): CompileJob[] {
  const state = exteriorLighting.get(scene);
  if (state === undefined) return [];
  const target = new THREE.Scene();
  target.fog = scene.fog; target.environment = state.environment;
  const visit = (object: THREE.Object3D): void => {
    if (!object.visible || state.roots.has(object)) return;
    if (object instanceof THREE.Light) target.add(object.clone(false));
    for (const child of object.children) visit(child);
  };
  visit(scene);
  const exterior = sceneJobs(scene, rt, roots === undefined ? per : 1, roots ?? [scene], state.roots).jobs;
  const materials = new Set<THREE.Material>();
  for (const job of exterior) job.root.traverse(object => { for (const material of materialsOf(object)) materials.add(material); });
  const excludedMaterials = new Set<THREE.Material>();
  for (const root of state.roots) root.traverse(object => { for (const material of materialsOf(object)) if (!materials.has(material)) excludedMaterials.add(material); });
  const jobs = roots === undefined
    ? [...exterior, ...familyCompileJobs(scene, rt, per, excludedMaterials), ...(shadows ? shadowJobs(scene, rt, per, state.roots) : [])]
    : exterior;
  // Passes with their own scene keep their authored state. Only the page world/depth variants transition outside.
  for (const job of jobs) if (job.target === scene) job.target = target;
  return jobs;
}

/** Resolve an entered world's programs, then warm the actual depth/post pass targets without advancing simulation.
 * The entered owner fences both phases; the renderer target is restored even if a pass fails. */
export async function warmComposerFrame(composer: Pick<EffectComposer, 'render'>,
  renderer: Pick<Renderer, 'getRenderTarget' | 'setRenderTarget'>, prepare: () => Promise<unknown>, current: () => boolean): Promise<void> {
  if (!current()) throw new Error('Entered frame left before shader warm-up');
  await prepare();
  if (!current()) throw new Error('Entered frame left during shader warm-up');
  const target = renderer.getRenderTarget();
  try { composer.render(0); } finally { renderer.setRenderTarget(target); }
}

/** any scene object, with the mesh-ish fields the program key reads (all optional: lights, groups and bones have none) */
type MeshLike = THREE.Object3D & { isMesh?: boolean; geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[]; isInstancedMesh?: boolean; instanceColor?: THREE.InstancedBufferAttribute | null; isSkinnedMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };

/** The parts of an object that change its material's program (WebGLPrograms.getParameters); `positionOnly` drops the
 * attribute bits a position-only override pass never reads. */
export function programObjectKey(o: BatchedLike, positionOnly = false): string {
  const g = o.geometry;
  const a: THREE.NormalBufferAttributes = g?.attributes ?? {};
  const morph = g?.morphAttributes ? Object.keys(g.morphAttributes).map((k) => `${k}${g.morphAttributes[k as 'position']?.length ?? 0}`).join('') : '';
  // The facade shares one material between its shell and a colored BatchedMesh.
  // Both batching bits are shader defines; omitting them skips the batch until its first draw.
  return `${o.isBatchedMesh ? 'B' : ''}${o.isBatchedMesh && o._colorsTexture ? 'K' : ''}${o.isInstancedMesh ? 'I' : ''}${o.instanceColor ? 'C' : ''}${o.isSkinnedMesh ? 'S' : ''}${o.isPoints ? 'P' : ''}${o.isLine ? 'L' : ''}${o.isSprite ? 'Q' : ''}` +
    `|${positionOnly ? '' : `${a['uv1'] ? 1 : 0}${a['uv2'] ? 1 : 0}${a['uv3'] ? 1 : 0}${a['tangent'] ? 1 : 0}${a['color'] ? 1 : 0}${a['normal'] ? 1 : 0}`}|${morph}`;
}

function materialProperties(renderer: Renderer, material: THREE.Material): object | undefined {
  // Test doubles of the renderer carry no property store.
  const store: unknown = Reflect.get(renderer, 'properties');
  const get: unknown = typeof store === 'object' && store !== null ? Reflect.get(store, 'get') : undefined;
  const properties: unknown = typeof get === 'function' ? Reflect.apply(get, store, [material]) : undefined;
  return typeof properties === 'object' && properties !== null ? properties : undefined;
}

/** The program a material last compiled to (three's material properties), or undefined; identity only. */
function currentProgram(renderer: Renderer, material: THREE.Material): unknown {
  const properties = materialProperties(renderer, material);
  return properties === undefined ? undefined : Reflect.get(properties, 'currentProgram');
}

/** compile() selects its new program on the borrowed material. Keep the last real draw's selection while
 * that variant links across painted waits; retain the expanded program cache for its later real use. */
function holdDrawnPrograms(renderer: Renderer, root: THREE.Object3D): () => void {
  const held: { material: THREE.Material; properties: object; fields: Map<PropertyKey, unknown>;
    uniforms: { uniform: object; value: unknown }[] }[] = [];
  const seen = new Set<THREE.Material>();
  root.traverse(object => {
    for (const material of materialsOf(object)) {
      if (seen.has(material)) continue;
      seen.add(material);
      const properties = materialProperties(renderer, material);
      // __version is set by setProgram on a real draw, not by compile. Never restore an unrendered variant.
      if (properties === undefined || Reflect.get(properties, '__version') !== material.version ||
        Reflect.get(properties, 'currentProgram') === undefined) continue;
      const fields = new Map<PropertyKey, unknown>();
      for (const key of Reflect.ownKeys(properties)) if (key !== 'programs') fields.set(key, Reflect.get(properties, key));
      const uniforms: { uniform: object; value: unknown }[] = [];
      const values: unknown = Reflect.get(properties, 'uniforms');
      if (typeof values === 'object' && values !== null) for (const key of Reflect.ownKeys(values)) {
        const uniform: unknown = Reflect.get(values, key);
        if (typeof uniform === 'object' && uniform !== null && Object.hasOwn(uniform, 'value')) {
          uniforms.push({ uniform, value: Reflect.get(uniform, 'value') });
        }
      }
      held.push({ material, properties, fields, uniforms });
    }
  });
  return () => {
    for (const { material, properties, fields, uniforms } of held) {
      if (materialProperties(renderer, material) !== properties) continue;
      for (const key of Reflect.ownKeys(properties)) if (key !== 'programs' && !fields.has(key)) Reflect.deleteProperty(properties, key);
      for (const [key, value] of fields) Reflect.set(properties, key, value);
      for (const { uniform, value } of uniforms) Reflect.set(uniform, 'value', value);
    }
  };
}

/** How many programs the renderer holds (0 for a test double without `info.programs`). */
function programCount(renderer: Renderer): number {
  const info: unknown = Reflect.get(renderer, 'info');
  const programs: unknown = typeof info === 'object' && info !== null ? Reflect.get(info, 'programs') : undefined;
  return Array.isArray(programs) ? programs.length : 0;
}

function materialsOf(o: THREE.Object3D): THREE.Material[] { const m = (o as MeshLike).material; return Array.isArray(m) ? m : m ? [m] : []; }

type BatchedLike = MeshLike & { isBatchedMesh?: boolean; _colorsTexture?: THREE.DataTexture | null };

/** An exterior frame excludes the same owned subtrees as its light inventory, including nested roots. */
function compileObjects(root: THREE.Object3D, visit: (object: THREE.Object3D) => void, excludedRoots?: ReadonlySet<THREE.Object3D>): void {
  if (excludedRoots === undefined) { root.traverse(visit); return; }
  const walk = (object: THREE.Object3D): void => {
    if (excludedRoots.has(object)) return;
    visit(object);
    for (const child of object.children) walk(child);
  };
  walk(root);
}
/**
 * A detached stand-in for `mesh` that computes the same program: `clone(false)` keeps the
 * instancing / skinning / morph flags, geometry and skeleton. BatchedMesh.copy in r186 never
 * copies `_colorsTexture` (it tests the destination, which is null), yet `batchingColor` is a
 * cache-key bit — carry the reference over, or the forest's four materials and three depth
 * variants compile again at the first frame.
 */
function standIn(mesh: MeshLike): MeshLike {
  const copy = mesh.clone(false) as BatchedLike;
  linkStandIn(copy, mesh); // its uploads belong to the mesh's owner (SF57 upload-owner)
  const src = mesh as BatchedLike;
  if (src.isBatchedMesh && src._colorsTexture && !copy._colorsTexture) copy._colorsTexture = src._colorsTexture;
  return copy;
}

/**
 * One detached clone per distinct (material, object-flags) pair, grouped `per` clones a job.
 * `clone(false)` keeps the instancing / skinning / morph flags and the geometry that pick the
 * variant, without touching live visibility or parents (gauntlet's compileMaterials).
 * `roots` restricts the borrowed inventory while retaining the target scene's lights, fog and environment.
 * `excludedRoots` omits content that leaves with an exterior frame's lighting, without changing live visibility.
 */
export function sceneJobs(scene: THREE.Scene, rt: THREE.WebGLRenderTarget | null, per = 6, roots: readonly THREE.Object3D[] = [scene],
  excludedRoots?: ReadonlySet<THREE.Object3D>): { jobs: CompileJob[]; materials: number } {
  const seen = new Set<string>();
  const mats = new Set<THREE.Material>();
  const clones: THREE.Object3D[] = [];
  for (const root of roots) compileObjects(root, (o) => {
    const mesh = o as MeshLike;
    const list = materialsOf(mesh);
    if (list.length === 0) return;
    const ok = programObjectKey(mesh);
    const wanted = list.filter((m) => { mats.add(m); const k = m.uuid + ok; if (seen.has(k)) return false; seen.add(k); return true; });
    const first = wanted[0];
    if (first === undefined) return;
    const copy = standIn(mesh);
    copy.material = Array.isArray(mesh.material) ? wanted : first;
    clones.push(copy);
  }, excludedRoots);
  const jobs: CompileJob[] = [];
  for (let i = 0; i < clones.length; i += per) {
    const root = new THREE.Group();
    for (const c of clones.slice(i, i + per)) root.add(c);
    jobs.push({ label: engineString('s_4bdf150dd0ed', [i]), root, target: scene, rt });
  }
  return { jobs, materials: mats.size };
}

/** Prepare newly resident roots against current page lighting and its declared exterior state before exposure.
 * Borrow original materials and object flags in the ordinary painted compile/link/upload slices. Live parents,
 * visibility, uniforms, lighting and render targets stay unchanged; the resident owner fences every slice.
 * An optional live-draw barrier spaces batches; initial boot uses ordinary browser paint opportunities.
 * An optional upload budget batches the isolated image uploads per drawn frame (op-hitch32). */
export async function prepareSceneRoots(renderer: Renderer, camera: THREE.Camera, scene: THREE.Scene,
  target: THREE.WebGLRenderTarget | null, roots: readonly THREE.Object3D[], current: () => boolean, pause?: () => Promise<void>,
  uploadBudget?: UploadBudget): Promise<void> {
  await prepareSceneResources(roots, camera, current);
  const { jobs, materials } = sceneJobs(scene, target, 1, roots);
  jobs.push(...exteriorJobs(scene, target, false, roots));
  await runPrecompile(renderer, camera, jobs, materials, undefined, undefined, current, pause !== undefined, pause, uploadBudget);
}

/** Prepare registered override passes with their real caster flags and camera layers. Borrowed materials, geometry,
 * textures and scene state stay untouched; each pass is compiled into its own real target in the ordinary slices.
 * Optional excluded roots defer passes owned by another hidden entered-frame hierarchy. */
export function offscreenJobs(scene: THREE.Scene, per = 1, excludedRoots?: ReadonlySet<THREE.Object3D>): CompileJob[] {
  const isScene = (object: THREE.Object3D): object is THREE.Scene => object instanceof THREE.Scene;
  const jobs: CompileJob[] = [];
  compileObjects(scene, object => {
    if (!isScene(object)) return;
    for (const pass of offscreenPreparations(object)) {
      const seen = new Set<string>(), clones: THREE.Object3D[] = [];
      for (const root of pass.roots()) root.traverseVisible(caster => {
        const mesh = caster as MeshLike;
        if (!mesh.layers.test(pass.camera.layers)) return;
        // A real render builds its list from visible materials and, for arrays, authored geometry groups.
        // compile() does neither, so do not create programs for slots the pass cannot draw.
        const materials = materialsOf(mesh);
        const drawable = (material: THREE.Material | undefined): boolean => material?.visible === true && material.allowOverride;
        const eligible = Array.isArray(mesh.material)
          ? mesh.geometry?.groups.some(group => drawable(materials[group.materialIndex ?? 0])) === true
          : materials.some(drawable);
        if (!eligible) return;
        const key = programObjectKey(mesh, pass.positionOnly);
        if (seen.has(key)) return;
        seen.add(key);
        const copy = standIn(mesh);
        copy.material = pass.material;
        clones.push(copy);
      });
      for (let i = 0; i < clones.length; i += per) {
        const root = new THREE.Group();
        for (const clone of clones.slice(i, i + per)) root.add(clone);
        jobs.push({ label: pass.label, root, target: object, rt: pass.target, camera: pass.camera });
      }
    }
  }, excludedRoots);
  return jobs;
}

/** Compile a parked subtree against the light counts its first visible frame will have. Three gathers visible lights
 * from both the target scene and each job root. Detached light clones add only the future lights absent from the
 * target's visible traversal; live visibility, intensity, parents and the page's drawn light count stay unchanged.
 * A future scene's environment is likewise borrowed during compile: a parked sky can have a different PMREM layout
 * from the road. Post/background jobs targeting another scene keep that scene's lighting. */
export function includeFutureLights(jobs: readonly CompileJob[], target: THREE.Scene, future: THREE.Object3D,
  environment: THREE.Texture | null = future instanceof THREE.Scene ? future.environment : null): void {
  if (future === target) return;
  const visible = new Set<THREE.Light>();
  target.traverseVisible(object => { if (object instanceof THREE.Light) visible.add(object); });
  const added: THREE.Light[] = [];
  const visit = (object: THREE.Object3D): void => {
    // Only the parked root is hidden by admission; authored descendant visibility still governs the future draw.
    if (object !== future && !object.visible) return;
    if (object instanceof THREE.Light && !visible.has(object)) added.push(object);
    for (const child of object.children) visit(child);
  };
  visit(future);
  for (const job of jobs) if (job.target === target) {
    for (const light of added) job.root.add(light.clone(false));
    if (environment !== null) job.environment = environment;
  }
}

/**
 * A job's disposer made outside the function that collects the job's stand-ins (SF57 leak5). A closure shares its
 * function's one context: made inside `shadowJobs`, the disposer (held by the warm-up's owner until that frame leaves)
 * also held the stand-in list the scene walk filled, and so every caster's geometry, material and textures, including
 * other residents' that retired meanwhile.
 */
function disposerOf(resources: Iterable<{ dispose: () => void }>): () => void {
  const held = [...resources];
  return () => { for (const resource of held) resource.dispose(); };
}

/**
 * The shadow pass's depth materials: WebGLShadowMap.getDepthMaterial picks the caster's
 * customDepthMaterial, else the shared MeshDepthMaterial (BasicDepthPacking — r186 shadow maps are depth textures) with the caster
 * material's map / alphaMap / alphaTest / displacement copied on and the side flipped — and it
 * draws with no fog (renderBufferDirect's empty scene) and the main scene's lights.
 * `excludedRoots` omits casters whose owned subtree cannot draw in the requested exterior frame.
 */
export function shadowJobs(scene: THREE.Scene, rt: THREE.WebGLRenderTarget | null, per = 6, excludedRoots?: ReadonlySet<THREE.Object3D>): CompileJob[] {
  const flip: Record<number, THREE.Side> = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
  const seen = new Set<string>();
  const clones: THREE.Object3D[] = [];
  const temporary = new Set<THREE.Material>();
  compileObjects(scene, (o) => {
    const mesh = o as MeshLike;
    if (!mesh.castShadow || !mesh.isMesh && !mesh.isPoints && !mesh.isLine) return;
    const ok = programObjectKey(mesh);
    for (const m of materialsOf(mesh)) {
      const mat = m as THREE.MeshStandardMaterial;
      let depth: THREE.Material;
      let key: string;
      if (mesh.customDepthMaterial) { depth = mesh.customDepthMaterial; key = `custom:${depth.uuid}|${ok}`; }
      else {
        const side = mat.shadowSide ?? flip[mat.side] ?? THREE.BackSide;
        const disp = mat.displacementMap && mat.displacementScale !== 0 ? mat.displacementMap : null;
        const alphaTest = mat.alphaToCoverage ? 0.5 : mat.alphaTest;
        key = `depth|${mat.map ? `m${mat.map.channel}` : ''}|${mat.alphaMap ? `a${mat.alphaMap.channel}` : ''}|${alphaTest > 0 ? 't' : ''}|${side}|${disp ? `d${disp.channel}` : ''}|${ok}`;
        if (seen.has(key)) continue;
        depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, map: mat.map ?? null, alphaMap: mat.alphaMap ?? null, alphaTest, side, displacementMap: disp, displacementScale: mat.displacementScale, displacementBias: mat.displacementBias });
        temporary.add(depth);
      }
      if (seen.has(key)) continue;
      seen.add(key);
      const copy = standIn(mesh);
      copy.material = depth;
      clones.push(copy);
    }
  }, excludedRoots);
  // Generic variants for casters that appear after this step (a fired bolt, a fade clone, a detail LOD
  // that pops in): plain and mapped, front and double sided — cache hits when the scene already had them.
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const [map, side, alphaTest] of [[null, THREE.BackSide, 0], [white, THREE.BackSide, 0], [white, THREE.DoubleSide, 0.5]] as [THREE.Texture | null, THREE.Side, number][]) {
    const key = `depth|${map ? 'm0' : ''}||${alphaTest > 0 ? 't' : ''}|${side}||generic`;
    if (seen.has(key)) continue;
    seen.add(key);
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, map, alphaTest, side });
    temporary.add(depth);
    clones.push(new THREE.Mesh(box, depth));
  }
  const jobs: CompileJob[] = [];
  for (let i = 0; i < clones.length; i += per) {
    const root = new THREE.Group();
    for (const c of clones.slice(i, i + per)) root.add(c);
    jobs.push({ label: engineString('s_2a96df75489f', [i]), root, target: scene, rt, fogOff: true });
  }
  const first = jobs[0];
  if (first !== undefined) first.dispose = disposerOf([...temporary, box, white]);
  return jobs;
}

/** The sky background box (WebGLBackground's boxMesh) — same shader, same envMap kind, drawn into the scene target. */
export function backgroundJob(scene: THREE.Scene, rt: THREE.WebGLRenderTarget | null): CompileJob | null {
  const bg = scene.background;
  if (!bg || !('isTexture' in bg)) return null;
  const cube = bg.mapping === THREE.CubeUVReflectionMapping ? bg : 'isCubeTexture' in bg ? bg : new THREE.CubeTexture(); // equirect → cube (WebGLCubeMaps)
  const lib = THREE.ShaderLib['backgroundCube'];
  if (lib === undefined) throw new Error('precompile: ShaderLib.backgroundCube is missing');
  const envMap: THREE.IUniform<THREE.Texture> = { value: cube };
  const mat = new THREE.ShaderMaterial({
    name: 'BackgroundCubeMaterial', uniforms: { ...THREE.UniformsUtils.clone(lib.uniforms), envMap },
    vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader,
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
  });
  Object.defineProperty(mat, 'envMap', { get: () => envMap.value });
  mat.toneMapped = THREE.ColorManagement.getTransfer(bg.colorSpace) !== THREE.SRGBTransfer;
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  const root = new THREE.Group(); root.add(new THREE.Mesh(geo, mat));
  return { label: engineString('s_ff7f862b819f'), root, target: scene, rt,
    dispose: () => { mat.dispose(); geo.dispose(); if (cube !== bg) cube.dispose(); } };
}

/**
 * Every material the composer's passes own (fullscreen materials, the blur / luminance /
 * downsample materials passes swap in, nested passes of effects), each on a screen triangle in an
 * empty scene: no fog, no lights, into a frame buffer — except the pass that renders to screen.
 */
export function postJobs(composer: EffectComposer, rt: THREE.WebGLRenderTarget | null, per = Number.POSITIVE_INFINITY): CompileJob[] {
  const found = new Map<THREE.Material, boolean>(); // material → renders to screen
  const visited = new Set<object>();
  const walk = (v: unknown, toScreenIn: boolean, depth: number): void => {
    let toScreen = toScreenIn;
    if (v === null || typeof v !== 'object' || visited.has(v) || depth > 4) return;
    // AGX never updates its adaptation passes. Bloom still draws luminance when its threshold is zero.
    if (v instanceof ToneMappingEffect && v.mode !== ToneMappingMode.REINHARD2_ADAPTIVE) return;
    if (v instanceof Pass && !v.enabled) return;
    const o = v as Record<string, unknown> & { isMaterial?: boolean; isObject3D?: boolean; isScene?: boolean; isTexture?: boolean; isWebGLRenderTarget?: boolean; isCamera?: boolean; isMesh?: boolean };
    if (o.isMaterial) {
      const m = o as unknown as THREE.ShaderMaterial;
      // The god-rays light source's MeshBasicMaterial already has its in-scene program.
      const idle = !m.isShaderMaterial;
      if (!idle && !found.has(m)) found.set(m, toScreen);
      return;
    }
    if (o.isTexture || o.isWebGLRenderTarget || o.isCamera || o.isScene || ArrayBuffer.isView(v)) return;
    if (o.isObject3D) { if (o.isMesh) walk((o as unknown as THREE.Mesh).material, toScreen, depth + 1); return; }
    visited.add(v);
    if (v instanceof Pass) { toScreen = v.renderToScreen; walk(v.fullscreenMaterial, toScreen, depth + 1); }
    for (const val of Array.isArray(v) ? v : Object.values(o)) walk(val, toScreen, depth + 1);
  };
  for (const pass of composer.passes) walk(pass, pass.renderToScreen, 0);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const jobs: CompileJob[] = [];
  const empty = new THREE.Scene();
  const groups = { buffer: new THREE.Group(), screen: new THREE.Group() };
  for (const [m, toScreen] of found) (toScreen ? groups.screen : groups.buffer).add(new THREE.Mesh(tri, m));
  for (const [group, target, label] of [[groups.buffer, rt, 's_178612197e2b'], [groups.screen, null, 's_9070659b32c3']] as const) {
    const meshes = [...group.children];
    for (let i = 0; i < meshes.length; i += per) {
      const root = new THREE.Group();
      for (const mesh of meshes.slice(i, i + per)) root.add(mesh);
      jobs.push({ label: engineString(label), root, target: empty, rt: target });
    }
  }
  const first = jobs[0];
  if (first === undefined) tri.dispose(); else first.dispose = disposerOf([tri]);
  return jobs;
}

/**
 * Every texture the first frame would upload — material maps, ShaderMaterial uniforms (the post
 * chain's lookup tables included), the scene's background / environment — read off the compile jobs.
 * Uploading (texImage + mipmaps, ~30 × 1024² on the phone) is otherwise the first draw's job,
 * inside the first frame's stall.
 */
export function collectTextures(jobs: CompileJob[]): THREE.Texture[] {
  const out = new Set<THREE.Texture>();
  const isTexture = (v: unknown): v is THREE.Texture => typeof v === 'object' && v !== null && (v as { isTexture?: boolean }).isTexture === true;
  const add = (v: unknown): void => { if (isTexture(v) && !v.isRenderTargetTexture) out.add(v); };
  const fromMaterial = (m: THREE.Material): void => {
    for (const v of Object.values(m)) add(v);
    for (const texture of shaderPatchTextures(m)) add(texture);
    const u = (m as THREE.Material & { uniforms?: Record<string, THREE.IUniform> }).uniforms;
    if (u) for (const uni of Object.values(u)) add(uni.value);
  };
  // the jobs' clones carry every scene material, the post-chain materials and the background box;
  // the target scenes carry the background / environment maps
  for (const job of jobs) {
    job.root.traverse((o) => { for (const m of materialsOf(o)) fromMaterial(m); });
    if (job.target) { add(job.target.background); add(job.target.environment); }
    add(job.environment);
  }
  return [...out];
}

const frame = (): Promise<void> => new Promise((resolve) => { pageScope.raf(() => { pageScope.timeout(0, resolve); }); }); // a real paint between (the page's: no ambient owner read mid-build, SF57)

/**
 * A per-frame budget for live image uploads (op-hitch32). Isolated preparation (WebKit's entered world) uploads one image
 * per drawn frame, and other browsers check 12 ms only after each upload; with a budget, a frame takes uploads while their
 * measured time stays under `ms`, predicting the next one's cost from its decoded size before it starts, so a large image
 * uploads alone and a slice never starts an upload it cannot fit. `Game` uses this bound for paced live WebKit
 * preparation; other browsers select it explicitly with the `uploads` Developer mode.
 */
export interface UploadBudget {
  /** Measured upload milliseconds one drawn frame may hold. */
  ms: number;
  /** Decoded bytes one drawn frame may hold; a larger image uploads alone. */
  bytes: number;
  /**
   * sp-o105: level-0 bytes one row band may upload. A plain, unflipped ImageBitmap texture larger than this uploads in row
   * bands, one per drawn frame, into the storage three allocated for it (`bandedImageUpload`); its final texels and mips
   * are the whole upload's. Absent: every image uploads whole. Selected by the `bands` Build pacing Developer mode.
   */
  bandBytes?: number;
}

/** The Developer tool's budget for isolated (WebKit) uploads: about a quarter of a 30 fps frame, 8 MiB of decoded texels. */
export const LIVE_UPLOAD_BUDGET: UploadBudget = { ms: 8, bytes: 8 * 1024 * 1024 };

/** sp-o105: the `bands` Build pacing mode: the live budget, with a 2048² bitmap's 16 MiB level 0 in four 4 MiB row bands.
 * Each WebKit texSubImage2D from a bitmap pays a fixed cost (~4 ms for 2048² on macOS WebKit) plus its rows. */
export const BANDED_UPLOAD_BUDGET: UploadBudget = { ...LIVE_UPLOAD_BUDGET, bandBytes: 4 * 1024 * 1024 };

/** The rows a band of `texture` holds under `bandBytes`, or null when it uploads whole: only a plain 2D texture whose image
 * is an ImageBitmap (WebGL ignores flip, premultiply and colour conversion for bitmaps), unflipped, unpremultiplied, with no
 * authored mips and no resize, larger than one band. */
function uploadBandRows(texture: THREE.Texture, bandBytes: number, maxTextureSize: number): number | null {
  const image: unknown = texture.image;
  if (typeof ImageBitmap === 'undefined' || !(image instanceof ImageBitmap) || texture.flipY || texture.premultiplyAlpha || texture.mipmaps.length > 0) return null;
  for (const flag of ['isDataTexture', 'isCompressedTexture', 'isCubeTexture', 'isVideoTexture', 'isCanvasTexture', 'isDataArrayTexture', 'isData3DTexture', 'isFramebufferTexture', 'isDepthTexture', 'isRenderTargetTexture', 'isHTMLTexture'])
    if (Reflect.get(texture, flag) === true) return null;
  if (image.width > maxTextureSize || image.height > maxTextureSize || image.width === 0) return null;
  const rows = Math.max(1, Math.floor(bandBytes / (image.width * 4)));
  return rows >= image.height ? null : rows;
}

/**
 * sp-o105: upload a large bitmap texture in row bands, one per `pause`. Three allocates the storage and sets the sampler and
 * versions with no texels (`source.dataReady` false); each band is then a `copyTextureToTexture` from the same bitmap
 * (UNPACK_SKIP_ROWS selects its rows) and the last band generates the mips, as the whole upload would. A band cancelled
 * mid-way (the owner left) marks the texture for a whole upload at its next use; a retired texture just stops.
 */
async function bandedImageUpload(renderer: Renderer, texture: THREE.Texture, image: ImageBitmap, rows: number, pause: () => Promise<void>, retired: () => boolean): Promise<void> {
  const source = texture.source, mips = texture.generateMipmaps;
  source.dataReady = false;
  try { renderer.initTexture(texture); } finally { source.dataReady = true; }
  const band = new THREE.Texture(image), region = new THREE.Box2(), at = new THREE.Vector2();
  let complete = false;
  try {
    for (let y = 0; y < image.height; y += rows) {
      if (y > 0) await pause();
      if (retired()) { complete = true; return; }
      const height = Math.min(rows, image.height - y);
      region.min.set(0, y); region.max.set(image.width, y + height); at.set(0, y);
      texture.generateMipmaps = mips && y + height >= image.height;
      renderer.copyTextureToTexture(band, texture, region, at);
    }
    complete = true;
  } finally {
    texture.generateMipmaps = mips;
    if (!complete) texture.needsUpdate = true;
  }
}

/** Live WebKit preparation settles one program per painted slice. A material can issue two side variants. */
export const LIVE_PROGRAMS_PER_FRAME = 1;

// Program identities are renderer-owned; preparation must not keep a retired renderer or revisit its resolved links.
const resolvedPrograms = new WeakSet<ProgramLike>();

/** The Developer tool's budget for other browsers' slices: under the 12 ms checked after the fact, and 64 MiB. */
export const SLICED_UPLOAD_BUDGET: UploadBudget = { ms: 10, bytes: 64 * 1024 * 1024 };

/** A slice's wall time, checked after each unit (a job's compile, a program's resolve, an image's upload): boot's bound. */
const PRECOMPILE_SLICE_MS = 12;
/**
 * sp-o100: the bound for a live warm-up on a paced page that does not isolate its uploads (desktop Chromium's entered
 * frame). The 12 ms boot bound is checked after the fact, so a slice ran 12 ms plus its last unit (a six-material job, a
 * 15 ms first link query) on top of the frame's own 3-5 ms of game work: Pine's road entry drew five of its ten
 * double-vsync travel frames in its warm-up. Live slices also issue one material a job.
 */
export const LIVE_PRECOMPILE_SLICE_MS = 6;

/** Decoded bytes an uncompressed texture's upload moves (with a third more for generated mips); 0 when unknown. */
export function imageUploadBytes(texture: THREE.Texture): number {
  const one = (image: unknown): number => {
    if (typeof image !== 'object' || image === null) return 0;
    const data: unknown = Reflect.get(image, 'data');
    if (ArrayBuffer.isView(data)) return data.byteLength;
    const size = (key: string): number => { const v: unknown = Reflect.get(image, key); return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0; };
    return (size('naturalWidth') || size('width')) * (size('naturalHeight') || size('height')) * Math.max(1, size('depth')) * 4;
  };
  const image: unknown = texture.image;
  const texels = Array.isArray(image) ? image.reduce((sum: number, face: unknown) => sum + one(face), 0) : one(image);
  return Math.round(texture.generateMipmaps ? texels * 4 / 3 : texels);
}

// Three's versioned allocation can already hold a page image borrowed by a new frame.
// Initialization still runs; only its empty upload wait may be omitted. A lost allocation
// or either changed version requires the normal upload slice, including after recovery.
function imageResident(renderer: Renderer, texture: THREE.Texture): boolean {
  // These sources may advance and upload inside initTexture itself.
  if (Reflect.get(texture, 'isVideoTexture') === true || Reflect.get(texture, 'isHTMLTexture') === true) return false;
  const store: unknown = Reflect.get(renderer, 'properties');
  const get: unknown = typeof store === 'object' && store !== null ? Reflect.get(store, 'get') : undefined;
  if (typeof get !== 'function') return false;
  const allocation: unknown = Reflect.apply(get, store, [texture]);
  const source: unknown = Reflect.apply(get, store, [texture.source]);
  return typeof allocation === 'object' && allocation !== null
    && Reflect.get(allocation, '__webglTexture') !== undefined
    && Reflect.get(allocation, '__webglTexture') !== null
    && Reflect.get(allocation, '__version') === texture.version
    && typeof source === 'object' && source !== null
    && Reflect.get(source, '__version') === texture.source.version;
}

/** One drawn frame's batch of image uploads under a budget, predicting each upload's time from the measured rate. */
interface UploadBatch { full: (bytes: number) => boolean; add: (bytes: number, ms: number) => void; reset: () => void; pending: () => boolean }
function newUploadBatch(budget: UploadBudget): UploadBatch {
  let ms = 0, bytes = 0, count = 0, totalMs = 0, totalBytes = 0;
  return {
    full: next => {
      if (count === 0) return false;
      // The byte-weighted rate so far predicts the next upload; nothing measured yet, the frame is full.
      const predicted = totalBytes === 0 ? budget.ms : next * totalMs / totalBytes;
      return bytes + next > budget.bytes || ms + predicted > budget.ms;
    },
    add: (b, t) => {
      ms += t; bytes += b; count++;
      if (b > 0) { totalMs += t; totalBytes += b; }
    },
    reset: () => { ms = 0; bytes = 0; count = 0; },
    pending: () => count > 0,
  };
}

/** Wait for a new completed game draw, then a paint opportunity. A capped/skipped rAF cannot release preparation;
 * cancellation rejects before another batch. Does not advance simulation, force a draw or change frame pacing. */
export function waitForDrawnFrame(scope: Scope, drawn: () => number, current: () => boolean): Promise<void> {
  if (scope.disposed || !current()) return Promise.reject(new Error('Shader warm-up owner left'));
  const before = drawn();
  return new Promise<void>((resolve, reject) => {
    let done = false;
    const forget = scope.capture('disposers', () => { if (!done) { done = true; reject(new Error('Shader warm-up owner left')); } });
    const finish = (): void => {
      if (done) return;
      done = true; forget();
      if (current()) resolve(); else reject(new Error('Shader warm-up owner left'));
    };
    const poll = (): void => { scope.raf(() => {
      if (done) return;
      if (!current()) { finish(); return; }
      if (drawn() > before) scope.timeout(0, finish); else poll();
    }); };
    poll();
  });
}

/**
 * Issue jobs and settle their driver links: reports (done, total, detail) monotonically —
 * `total` = jobs + programs once the programs are known. Live preparation may isolate image
 * uploads so an unpredictable native upload cannot join another upload in the same painted slice.
 * An optional pause port requires a completed live draw between batches instead of a browser rAF the game may skip.
 * An optional upload budget batches image uploads per frame under it (op-hitch32).
 */
export async function runPrecompile(
  renderer: Renderer, camera: THREE.Camera, jobs: CompileJob[], materials: number,
  onProgress?: (done: number, total: number, detail: string) => void,
  textures: THREE.Texture[] = collectTextures(jobs),
  current: () => boolean = () => true,
  isolateImageUploads = false,
  pause: () => Promise<void> = frame,
  uploadBudget?: UploadBudget,
  onStage?: PrecompileStage,
  sliceMs: number = PRECOMPILE_SLICE_MS,
): Promise<PrecompileReport> {
  // Page siblings can retire while a neighbour's preparation yields. The inventory is
  // borrowed: disposal cancels only that resource's upload, not the live neighbour.
  const retired = new WeakSet<THREE.Texture>(), watched = new Set<THREE.Texture>();
  const observer = pageScope.child('shader-texture-inventory');
  const watch = (texture: THREE.Texture): void => {
    if (watched.has(texture)) return;
    watched.add(texture); observer.listenOnceEmitter(texture, 'dispose', () => { retired.add(texture); });
  };
  for (const texture of textures) watch(texture);
  try { return await runPrecompileWork(renderer, camera, jobs, materials, onProgress, textures, current, retired, watch, isolateImageUploads, pause, uploadBudget, onStage, sliceMs); }
  finally { observer.dispose(); }
}

async function runPrecompileWork(renderer: Renderer, camera: THREE.Camera, jobs: CompileJob[], materials: number,
  onProgress: ((done: number, total: number, detail: string) => void) | undefined, textures: THREE.Texture[],
  current: () => boolean, retired: WeakSet<THREE.Texture>, watch: (texture: THREE.Texture) => void, isolateImageUploads: boolean, pause: () => Promise<void>,
  uploadBudget: UploadBudget | undefined, onStage: PrecompileStage | undefined, sliceMs: number): Promise<PrecompileReport> {
  const checkCurrent = (): void => { if (!current()) throw new Error('Shader warm-up owner left'); };
  checkCurrent();
  const borrowed = new Set<THREE.Material>();
  for (const job of jobs) job.root.traverse(object => { for (const material of materialsOf(object)) borrowed.add(material); });
  await waitMaterialPreparations([...borrowed], current);
  for (const texture of collectTextures(jobs)) watch(texture);
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const before = snapshotPrograms(renderer);
  const created: ProgramLike[] = [];
  // op-hitch31: the programs the jobs' materials compiled to, including ones issued before `before` (a captured
  // offscreen factory such as PMREM issues its own in `_compileMaterial` during capture). Without them the replayed
  // draw was their first use: a blocking link query (53-99 ms getProgramInfoLog on the Simulator) in one frame.
  const jobPrograms = new Set<unknown>();
  // Keep issue and first use on one painted slice when the driver has already finished linking.
  // An incomplete link is queued; it never blocks issuing the next material or loses its owner fence.
  const queued: ProgramLike[] = [], enqueued = new Set<ProgramLike>();
  let settled = 0;
  const queue = (program: ProgramLike): void => {
    if (!enqueued.has(program) && !resolvedPrograms.has(program)) { enqueued.add(program); queued.push(program); }
  };
  const settleOne = (): void => {
    const program = queued[settled];
    if (program === undefined || parallel && !program.isReady()) return;
    program.getUniforms(); resolvedPrograms.add(program); settled++;
  };
  const total = () => jobs.length + Math.max(created.length, 1) + textures.length;
  const mode = parallel ? 'parallel' : 'serial';
  let tFrame = performance.now(), programsAtFrame = programCount(renderer);
  let stageStart = tFrame;
  for (const [i, job] of jobs.entries()) {
    checkCurrent();
    const prevRt = renderer.getRenderTarget(), prevTone = renderer.toneMapping;
    const fog = job.target?.fog ?? null;
    const environment = job.target?.environment ?? null;
    const restoreDrawn = isolateImageUploads ? holdDrawnPrograms(renderer, job.root) : undefined;
    try {
      if (job.fogOff && job.target) job.target.fog = null;
      if (job.environment !== undefined && job.target) job.target.environment = job.environment;
      if (job.toneMapping !== undefined) renderer.toneMapping = job.toneMapping;
      renderer.setRenderTarget(job.rt);
      renderer.compile(job.root, job.camera ?? camera, job.target ?? undefined);
      job.root.traverse(object => { for (const material of materialsOf(object)) jobPrograms.add(currentProgram(renderer, material)); });
    } finally {
      restoreDrawn?.();
      renderer.setRenderTarget(prevRt); renderer.toneMapping = prevTone;
      if (job.fogOff && job.target) job.target.fog = fog;
      if (job.environment !== undefined && job.target) job.target.environment = environment;
    }
    if (isolateImageUploads) {
      for (const program of snapshotPrograms(renderer)) if (!before.has(program) || jobPrograms.has(program)) queue(program);
    }
    onProgress?.(i + 1, total(), `${materials} materials · ${i + 1} / ${jobs.length} batches · ${mode}`);
    // op-hitch37: a live WebKit warm-up also yields once a slice has issued LIVE_PROGRAMS_PER_FRAME programs: WebKit
    // queues compile/link to its GPU process, so the JS slice is cheap but the frame that presents it waits for all of
    // them (Sky Reach's entry: 18 programs in one 217 ms Simulator frame of afterPlay).
    const capped = isolateImageUploads && programCount(renderer) - programsAtFrame >= LIVE_PROGRAMS_PER_FRAME;
    // oxlint-disable-next-line eslint/no-useless-assignment -- read by the next iteration's guard; oxlint's flow analysis loses the loop back-edge across the try/finally above
    if (performance.now() - tFrame > sliceMs || capped || i === jobs.length - 1) { if (isolateImageUploads) settleOne(); await pause(); tFrame = performance.now(); programsAtFrame = programCount(renderer); }
  }
  created.push(...newProgramsSince(renderer, before));
  for (const program of before) if (jobPrograms.has(program)) created.push(program);
  if (onStage !== undefined) { onStage('compile', performance.now() - stageStart, jobs.length); stageStart = performance.now(); }
  const pending = created.filter(program => !resolvedPrograms.has(program));
  const n = pending.length;
  // Ordinary parallel preparation waits for the batch before resolving it. Live preparation
  // settles one ready identity below; completion polls also cross the GPU-process boundary.
  const units = parallel ? 2 * n : n;
  if (parallel && !isolateImageUploads) {
    const linked = new Set<ProgramLike>();
    for (;;) {
      checkCurrent();
      let ready = 0;
      for (const p of pending) {
        if (linked.has(p)) { ready++; continue; }
        if (p.isReady()) { linked.add(p); ready++; }
      }
      onProgress?.(jobs.length + ready, jobs.length + units + textures.length, `${ready} / ${n} programs linked · parallel`);
      if (ready >= n) break;
      await pause();
    }
  }
  // Phase B: resolve each link. COMPLETION_STATUS only says the front end is done — ANGLE Metal
  // builds the Metal library on the first LINK_STATUS / uniform query (~20 ms a program with a cold
  // shader cache), which the first frame would otherwise pay for every program in one stall. One
  // resolve per program, time-boxed per frame so the count keeps moving; without the extension this
  // is also where the link itself blocks. The resolve is three's own first use (`getUniforms()`: the
  // link-status + info-log checks, every uniform / attribute location), which the first draw of each
  // program otherwise ran inside the first frame (~45 ms of onFirstUse at 4x CPU).
  // op-hitch37: a live WebKit warm-up resolves at most LIVE_PROGRAMS_PER_FRAME a slice. Its queries return quickly on the
  // main thread, so the 12 ms box never closed, but the frame waited for every library they forced (Nine Dragon's entry:
  // 759 uniforms resolved in one 699 ms Simulator frame of afterPlay).
  let tSlice = performance.now(), resolvedInSlice = 0;
  for (const [i, p] of pending.entries()) {
    checkCurrent();
    // A live slice settles one ready program. An incomplete link alone needs another poll.
    if (parallel && isolateImageUploads) {
      while (!p.isReady()) { await pause(); checkCurrent(); }
    }
    p.getUniforms(); resolvedPrograms.add(p); resolvedInSlice++;
    const linkedProgress = parallel ? (isolateImageUploads ? 2 * (i + 1) : n + i + 1) : i + 1;
    onProgress?.(jobs.length + linkedProgress, jobs.length + units + textures.length, `${i + 1} / ${n} programs resolved · ${mode}`);
    if (performance.now() - tSlice > sliceMs || (isolateImageUploads && resolvedInSlice >= LIVE_PROGRAMS_PER_FRAME)) { await pause(); tSlice = performance.now(); resolvedInSlice = 0; }
  }
  // Compilation exposes samplers injected by shader callbacks; merge them before any draw.
  if (onStage !== undefined) { onStage('link', performance.now() - stageStart, pending.length); stageStart = performance.now(); }
  const uploadTextures = [...new Set([...textures, ...collectTextures(jobs)])];
  for (const texture of uploadTextures) watch(texture);
  // Phase C: compressed textures retain their fenced slices. Live WebKit image preparation
  // isolates native uploads; a post-upload time check alone can overshoot before it yields.
  tSlice = performance.now();
  const base = jobs.length + units;
  // op-hitch32: with an upload budget, live preparation batches image uploads per frame under it: several instead of one
  // when isolated, and a predicted overshoot waits for the next frame instead of the 12 ms check after the fact.
  const batch = uploadBudget !== undefined ? newUploadBatch(uploadBudget) : undefined;
  for (const [i, tex] of uploadTextures.entries()) {
    checkCurrent();
    const compressed = tex instanceof THREE.CompressedTexture;
    const bytes = compressed ? 0 : imageUploadBytes(tex);
    const imageUpload = !compressed && !retired.has(tex) && !(isolateImageUploads && imageResident(renderer, tex));
    if (batch !== undefined && imageUpload && batch.full(bytes)) { await pause(); checkCurrent(); batch.reset(); }
    const tUpload = performance.now();
    const bandRows = imageUpload && isolateImageUploads && uploadBudget?.bandBytes !== undefined ? uploadBandRows(tex, uploadBudget.bandBytes, renderer.capabilities.maxTextureSize) : null;
    const bitmap: unknown = tex.image;
    if (bandRows !== null && bitmap instanceof ImageBitmap) {
      // a banded image takes its own drawn frames: whatever the batch holds draws first, and the next upload starts fresh
      if (batch?.pending() === true) { await pause(); checkCurrent(); }
      await bandedImageUpload(renderer, tex, bitmap, bandRows, async () => { await pause(); checkCurrent(); }, () => retired.has(tex));
      onProgress?.(base + i + 1, base + uploadTextures.length, `${i + 1} / ${uploadTextures.length} textures uploaded`);
      await pause(); checkCurrent(); batch?.reset(); tSlice = performance.now();
      continue;
    }
    if (!retired.has(tex)) {
      if (compressed) {
        try { await uploadCompressedTexture(renderer, tex, () => current() && !retired.has(tex), true); }
        catch (error) { if (!retired.has(tex)) throw error; }
      } else {
        renderer.initTexture(tex);
      }
    }
    onProgress?.(base + i + 1, base + uploadTextures.length, `${i + 1} / ${uploadTextures.length} textures uploaded`);
    if (compressed) { checkCurrent(); tSlice = performance.now(); batch?.reset(); }
    else if (batch !== undefined) { if (imageUpload) batch.add(bytes, performance.now() - tUpload); }
    else if (isolateImageUploads ? imageUpload : performance.now() - tSlice > sliceMs) { await pause(); checkCurrent(); tSlice = performance.now(); }
  }
  // The batch's last uploads keep their own drawn frame before whatever follows warm-up, as isolation did.
  if (batch?.pending() === true) await pause();
  checkCurrent();
  onStage?.('upload', performance.now() - stageStart, uploadTextures.length);
  return { materials, jobs: jobs.length, programs: created.length, parallel };
}







/**
 * Link an offscreen pass's programs before its first draw (op-hitch47): `compileAsync` with the pass's own target bound,
 * so the programs carry that target's keys (a render target's draws skip tone mapping and the output conversion), and
 * resolves once the driver has linked them (KHR_parallel_shader_compile where there is one). The target is restored.
 */
export async function compileOffscreenPass(renderer: Renderer, pass: OffscreenPass): Promise<void> {
  const prior = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  let linked: Promise<unknown>;
  renderer.setRenderTarget(pass.target);
  try { linked = renderer.compileAsync(pass.scene, pass.camera); } finally { renderer.setRenderTarget(prior, face, mip); }
  await linked;
}

/** The level supplies compile policy; the mechanism owns all shader jobs. */
export async function precompileLevel(game: Pick<Game, 'renderer' | 'camera' | 'scene' | 'rootScene' | 'composer' | 'level'>, onProgress?: (done: number, total: number, detail: string) => void,
  options: { /** Entered frames reuse their existing caster geometry. */ chunkCasters?: boolean; /** Fence yielded work to its entered owner. */ current?: () => boolean;
    /** A parked content subtree whose lights become visible on entry; no live light/visibility change. */ futureLighting?: THREE.Object3D;
    /** The installing scene's PMREM when futureLighting includes sibling content outside that scene. */ futureEnvironment?: THREE.Texture;
    /** Temporary program holders survive until this frame leaves; content materials remain borrowed. */ owner?: Pick<Scope, 'onDispose'>;
    /** Yield after each image upload during live preparation; ordinary boot keeps batched uploads. */ isolateImageUploads?: boolean;
    /** A live presentation barrier; initial boot keeps the ordinary browser paint opportunity. */ pause?: () => Promise<void>;
    /** Batch image uploads per frame under this budget (op-hitch32): several when isolated, none started past it. */ uploadBudget?: UploadBudget;
    /** Optional scalar stage timings, including painted waits. Does not retain materials or native handles. */ onStage?: PrecompileStage;
    /** A live warm-up's slice bound (LIVE_PRECOMPILE_SLICE_MS): one material a job, each slice checked against it. */ sliceMs?: number } = {}): Promise<number> {

    if (options.current?.() === false) throw new Error('Shader warm-up owner left');
    if (options.futureLighting !== undefined) {
      await prepareSceneResources([options.futureLighting], game.camera, options.current ?? (() => true));
    }
    const tracedBoot = bootTraceActive();
    if (tracedBoot) recordGpuCheckpoint(game.renderer, 'compile:before');
    // r186 removed PCFSoftShadowMap: the first shadow pass silently flips the type to PCF, and
    // shadowMapType is in every program's cache key — so everything compiled here would be
    // compiled AGAIN by the first frame (desktop 105 → 179 programs). Settle it before compiling.
    // oxlint-disable-next-line typescript/no-deprecated -- the guard exists to migrate away from the deprecated value
    if (game.renderer.shadowMap.type === THREE.PCFSoftShadowMap) game.renderer.shadowMap.type = THREE.PCFShadowMap;
    // E153: island-wide casters draw into each shadow map in pieces, culled per cascade (shadowChunks.ts)
    if (options.chunkCasters !== false) {
      // SF67: sliced with a painted frame between (it was one 0.3 s task on Driftwood at 4×); the pieces are the same
      let tChunk = performance.now();
      const pauseChunking = async (): Promise<void> => {
        await (options.pause ?? frame)();
        if (options.current?.() === false) throw new Error('Shader warm-up owner left');
        tChunk = performance.now();
      };
      const cut = await chunkShadowCastersSliced(game.scene, () => (performance.now() - tChunk < 12 ? null : pauseChunking()));
      if (cut.meshes > 0) console.info(`[shadow] ${String(cut.meshes)} casters in ${String(cut.pieces)} pieces (${String(cut.tris)} tris)`);
    }
    // Compile against the same page lights/environment as firstFrame. A regional content binding
    // changes game.scene only for installation; the renderer always draws rootScene. Keep caster
    // chunking above scoped to the content frame so warm-up cannot restructure other residents.
    const scene = game.rootScene;
    const rt = game.composer.inputBuffer;
    const policy = game.level.boot.shaders;
    const single = options.isolateImageUploads === true || options.sliceMs !== undefined;
    const per = single ? 1 : 6;
    const excludedRoots = entryFrameExclusions(scene, options.futureLighting);
    const { jobs, materials } = policy?.scene === false ? { jobs: [], materials: 0 } : sceneJobs(scene, rt, per, [scene], excludedRoots);
    // material families (SF10a): live family programs the scene does not hold yet (none live: no jobs)
    if (policy?.scene !== false) jobs.push(...familyCompileJobs(scene, rt, per, exclusiveMaterials(scene, excludedRoots)), ...offscreenJobs(scene, 1, excludedRoots));
    if (policy?.shadows !== false) jobs.push(...shadowJobs(scene, rt, per, excludedRoots));
    const bg = backgroundJob(scene, rt);
    if (bg && policy?.background !== false) jobs.push(bg); else bg?.dispose?.();
    if (policy?.post !== false) jobs.push(...postJobs(game.composer, rt, single ? 1 : Number.POSITIVE_INFINITY));
    // Three renders shadows before setupLights(), so the first entered shadow draw still uses the preceding
    // road frame's light state. Warm that depth variant too; the following shadow draw uses the future state.
    const previousShadows = policy?.shadows !== false && options.futureLighting !== undefined && options.futureLighting !== scene
      ? shadowJobs(scene, rt, per, excludedRoots) : [];
    if (options.futureLighting !== undefined) includeFutureLights(jobs, scene, options.futureLighting, options.futureEnvironment);
    jobs.push(...previousShadows);
    if (policy?.scene !== false) jobs.push(...exteriorJobs(scene, rt, policy?.shadows !== false, undefined, per));
    const owner = options.owner ?? resourceScope();
    for (const job of jobs) if (job.dispose !== undefined) owner.onDispose(job.dispose);
    const report = await runPrecompile(game.renderer, game.camera, jobs, materials, onProgress, collectTextures(jobs), options.current, options.isolateImageUploads, options.pause, options.uploadBudget, options.onStage, options.sliceMs);
    if (tracedBoot) recordGpuCheckpoint(game.renderer, 'compile:after');
    return report.materials;
  
}
