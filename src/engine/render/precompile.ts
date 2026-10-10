import { pageScope, resourceScope } from '../app/resources';
import type { Scope } from '../app/scope';
import { engineString } from '../strings';
import * as THREE from 'three';
import { Pass, type EffectComposer } from 'postprocessing';
import { newProgramsSince, snapshotPrograms, type ProgramLike } from '../boot/perflog';
import { bootTraceActive } from '../boot/bootTrace';
import type { Renderer } from './renderer';
import type { Game } from '../core/Game';
import { chunkShadowCastersSliced } from '../world/shadowChunks';
import { recordGpuCheckpoint } from '../boot/gpuTrace';
import { familyCompileJobs } from './families/registry';
import { shaderPatchTextures } from './shaderPatches';
import { uploadCompressedTexture } from './compressedUpload';
import { linkStandIn } from '../app/sceneOwnership';
import { offscreenPreparations } from './offscreenPreparation';

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
  /** Borrowed environment of a parked world's first draw. Applied only during synchronous compile, never a paint. */
  environment?: THREE.Texture;
  /** Release only stand-in resources, after their owner's real draws no longer need the cached programs. */
  dispose?: () => void;
}

export interface PrecompileReport { materials: number; jobs: number; programs: number; parallel: boolean }

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

/** The parts of an object that change its material's program (WebGLPrograms.getParameters). */
function objectKey(o: BatchedLike, positionOnly = false): string {
  const g = o.geometry;
  const a: THREE.NormalBufferAttributes = g?.attributes ?? {};
  const morph = g?.morphAttributes ? Object.keys(g.morphAttributes).map((k) => `${k}${g.morphAttributes[k as 'position']?.length ?? 0}`).join('') : '';
  // The facade shares one material between its shell and a colored BatchedMesh.
  // Both batching bits are shader defines; omitting them skips the batch until its first draw.
  return `${o.isBatchedMesh ? 'B' : ''}${o.isBatchedMesh && o._colorsTexture ? 'K' : ''}${o.isInstancedMesh ? 'I' : ''}${o.instanceColor ? 'C' : ''}${o.isSkinnedMesh ? 'S' : ''}${o.isPoints ? 'P' : ''}${o.isLine ? 'L' : ''}${o.isSprite ? 'Q' : ''}` +
    `|${positionOnly ? '' : `${a['uv1'] ? 1 : 0}${a['uv2'] ? 1 : 0}${a['uv3'] ? 1 : 0}${a['tangent'] ? 1 : 0}${a['color'] ? 1 : 0}${a['normal'] ? 1 : 0}`}|${morph}`;
}

const materialsOf = (o: THREE.Object3D): THREE.Material[] => { const m = (o as MeshLike).material; return Array.isArray(m) ? m : m ? [m] : []; };

type BatchedLike = MeshLike & { isBatchedMesh?: boolean; _colorsTexture?: THREE.DataTexture | null };
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
 */
export function sceneJobs(scene: THREE.Scene, rt: THREE.WebGLRenderTarget | null, per = 6): { jobs: CompileJob[]; materials: number } {
  const seen = new Set<string>();
  const mats = new Set<THREE.Material>();
  const clones: THREE.Object3D[] = [];
  scene.traverse((o) => {
    const mesh = o as MeshLike;
    const list = materialsOf(mesh);
    if (list.length === 0) return;
    const ok = objectKey(mesh);
    const wanted = list.filter((m) => { mats.add(m); const k = m.uuid + ok; if (seen.has(k)) return false; seen.add(k); return true; });
    const first = wanted[0];
    if (first === undefined) return;
    const copy = standIn(mesh);
    copy.material = Array.isArray(mesh.material) ? wanted : first;
    clones.push(copy);
  });
  const jobs: CompileJob[] = [];
  for (let i = 0; i < clones.length; i += per) {
    const root = new THREE.Group();
    for (const c of clones.slice(i, i + per)) root.add(c);
    jobs.push({ label: engineString('s_4bdf150dd0ed', [i]), root, target: scene, rt });
  }
  return { jobs, materials: mats.size };
}

/** Prepare registered override passes with their real caster flags and camera layers. Borrowed materials, geometry,
 * textures and scene state stay untouched; each pass is compiled into its own real target in the ordinary slices. */
export function offscreenJobs(scene: THREE.Scene, per = 1): CompileJob[] {
  const isScene = (object: THREE.Object3D): object is THREE.Scene => object instanceof THREE.Scene;
  const jobs: CompileJob[] = [];
  scene.traverse(object => {
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
        const key = objectKey(mesh, pass.positionOnly);
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
  });
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
 */
export function shadowJobs(scene: THREE.Scene, rt: THREE.WebGLRenderTarget | null, per = 6): CompileJob[] {
  const flip: Record<number, THREE.Side> = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
  const seen = new Set<string>();
  const clones: THREE.Object3D[] = [];
  const temporary = new Set<THREE.Material>();
  scene.traverse((o) => {
    const mesh = o as MeshLike;
    if (!mesh.castShadow || !mesh.isMesh && !mesh.isPoints && !mesh.isLine) return;
    const ok = objectKey(mesh);
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
  });
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
export function postJobs(composer: EffectComposer, rt: THREE.WebGLRenderTarget | null): CompileJob[] {
  const found = new Map<THREE.Material, boolean>(); // material → renders to screen
  const visited = new Set<object>();
  const walk = (v: unknown, toScreenIn: boolean, depth: number): void => {
    let toScreen = toScreenIn;
    if (v === null || typeof v !== 'object' || visited.has(v) || depth > 4) return;
    const o = v as Record<string, unknown> & { isMaterial?: boolean; isObject3D?: boolean; isScene?: boolean; isTexture?: boolean; isWebGLRenderTarget?: boolean; isCamera?: boolean; isMesh?: boolean };
    if (o.isMaterial) {
      const m = o as unknown as THREE.ShaderMaterial;
      // only screen shaders a frame really draws: the tone-mapping effect's adaptive-luminance pair is idle
      // under AGX, and the god-rays light source's MeshBasicMaterial already has its in-scene program
      const idle = !m.isShaderMaterial || m.name === 'AdaptiveLuminanceMaterial' || (m.name === 'LuminanceMaterial' && !('THRESHOLD' in m.defines));
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
  if (groups.buffer.children.length > 0) jobs.push({ label: engineString('s_178612197e2b'), root: groups.buffer, target: empty, rt });
  if (groups.screen.children.length > 0) jobs.push({ label: engineString('s_9070659b32c3'), root: groups.screen, target: empty, rt: null });
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
 * Issue every job, then wait for the driver: reports (done, total, detail) monotonically —
 * `total` = jobs + programs once the programs are known.
 */
export async function runPrecompile(
  renderer: Renderer, camera: THREE.Camera, jobs: CompileJob[], materials: number,
  onProgress?: (done: number, total: number, detail: string) => void,
  textures: THREE.Texture[] = collectTextures(jobs),
  current: () => boolean = () => true,
): Promise<PrecompileReport> {
  const checkCurrent = (): void => { if (!current()) throw new Error('Shader warm-up owner left'); };
  checkCurrent();
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const before = snapshotPrograms(renderer);
  const created: ProgramLike[] = [];
  const total = () => jobs.length + Math.max(created.length, 1) + textures.length;
  const mode = parallel ? 'parallel' : 'serial';
  let tFrame = performance.now();
  for (const [i, job] of jobs.entries()) {
    checkCurrent();
    const prevRt = renderer.getRenderTarget();
    const fog = job.target?.fog ?? null;
    const environment = job.target?.environment ?? null;
    try {
      if (job.fogOff && job.target) job.target.fog = null;
      if (job.environment !== undefined && job.target) job.target.environment = job.environment;
      renderer.setRenderTarget(job.rt);
      renderer.compile(job.root, job.camera ?? camera, job.target ?? undefined);
    } finally {
      renderer.setRenderTarget(prevRt);
      if (job.fogOff && job.target) job.target.fog = fog;
      if (job.environment !== undefined && job.target) job.target.environment = environment;
    }
    onProgress?.(i + 1, total(), `${materials} materials · ${i + 1} / ${jobs.length} batches · ${mode}`);
    // oxlint-disable-next-line eslint/no-useless-assignment -- read by the next iteration's guard; oxlint's flow analysis loses the loop back-edge across the try/finally above
    if (performance.now() - tFrame > 12 || i === jobs.length - 1) { await frame(); tFrame = performance.now(); }
  }
  created.push(...newProgramsSince(renderer, before));
  const n = created.length;
  // Phase A (parallel drivers): wait for COMPLETION_STATUS_KHR on every program, counting them up.
  const units = parallel ? 2 * n : n;
  if (parallel) {
    for (;;) {
      checkCurrent();
      let ready = 0;
      for (const p of created) if (p.isReady()) ready++;
      onProgress?.(jobs.length + ready, jobs.length + units + textures.length, `${ready} / ${n} programs linked · parallel`);
      if (ready >= n) break;
      await frame();
    }
  }
  // Phase B: resolve each link. COMPLETION_STATUS only says the front end is done — ANGLE Metal
  // builds the Metal library on the first LINK_STATUS / uniform query (~20 ms a program with a cold
  // shader cache), which the first frame would otherwise pay for every program in one stall. One
  // resolve per program, time-boxed per frame so the count keeps moving; without the extension this
  // is also where the link itself blocks. The resolve is three's own first use (`getUniforms()`: the
  // link-status + info-log checks, every uniform / attribute location), which the first draw of each
  // program otherwise ran inside the first frame (~45 ms of onFirstUse at 4x CPU).
  let tSlice = performance.now();
  for (const [i, p] of created.entries()) {
    checkCurrent();
    p.getUniforms();
    onProgress?.(jobs.length + (parallel ? n : 0) + i + 1, jobs.length + units + textures.length, `${i + 1} / ${n} programs resolved · ${mode}`);
    if (performance.now() - tSlice > 12) { await frame(); tSlice = performance.now(); }
  }
  // Compilation exposes samplers injected by shader callbacks; merge them before any draw.
  const uploadTextures = [...new Set([...textures, ...collectTextures(jobs)])];
  // Phase C: each compressed texture owns a fenced painted slice; other uploads use 12 ms slices.
  tSlice = performance.now();
  const base = jobs.length + units;
  for (const [i, tex] of uploadTextures.entries()) {
    checkCurrent();
    const compressed = tex instanceof THREE.CompressedTexture;
    if (compressed) await uploadCompressedTexture(renderer, tex, current);
    else renderer.initTexture(tex);
    onProgress?.(base + i + 1, base + uploadTextures.length, `${i + 1} / ${uploadTextures.length} textures uploaded`);
    if (compressed) { checkCurrent(); tSlice = performance.now(); }
    else if (performance.now() - tSlice > 12) { await frame(); checkCurrent(); tSlice = performance.now(); }
  }
  checkCurrent();
  return { materials, jobs: jobs.length, programs: n, parallel };
}







/** The level supplies compile policy; the mechanism owns all shader jobs. */
export async function precompileLevel(game: Pick<Game, 'renderer' | 'camera' | 'scene' | 'rootScene' | 'composer' | 'level'>, onProgress?: (done: number, total: number, detail: string) => void,
  options: { /** Entered frames reuse their existing caster geometry. */ chunkCasters?: boolean; /** Fence yielded work to its entered owner. */ current?: () => boolean;
    /** A parked content subtree whose lights become visible on entry; no live light/visibility change. */ futureLighting?: THREE.Object3D;
    /** The installing scene's PMREM when futureLighting includes sibling content outside that scene. */ futureEnvironment?: THREE.Texture;
    /** Temporary program holders survive until this frame leaves; content materials remain borrowed. */ owner?: Pick<Scope, 'onDispose'> } = {}): Promise<number> {

    if (options.current?.() === false) throw new Error('Shader warm-up owner left');
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
        await frame();
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
    const { jobs, materials } = policy?.scene === false ? { jobs: [], materials: 0 } : sceneJobs(scene, rt);
    // material families (SF10a): live family programs the scene does not hold yet (none live: no jobs)
    if (policy?.scene !== false) jobs.push(...familyCompileJobs(scene, rt), ...offscreenJobs(scene));
    if (policy?.shadows !== false) jobs.push(...shadowJobs(scene, rt));
    const bg = backgroundJob(scene, rt);
    if (bg && policy?.background !== false) jobs.push(bg); else bg?.dispose?.();
    if (policy?.post !== false) jobs.push(...postJobs(game.composer, rt));
    // Three renders shadows before setupLights(), so the first entered shadow draw still uses the preceding
    // road frame's light state. Warm that depth variant too; the following shadow draw uses the future state.
    const previousShadows = policy?.shadows !== false && options.futureLighting !== undefined && options.futureLighting !== scene
      ? shadowJobs(scene, rt) : [];
    if (options.futureLighting !== undefined) includeFutureLights(jobs, scene, options.futureLighting, options.futureEnvironment);
    jobs.push(...previousShadows);
    const owner = options.owner ?? resourceScope();
    for (const job of jobs) if (job.dispose !== undefined) owner.onDispose(job.dispose);
    const report = await runPrecompile(game.renderer, game.camera, jobs, materials, onProgress, collectTextures(jobs), options.current);
    if (tracedBoot) recordGpuCheckpoint(game.renderer, 'compile:after');
    return report.materials;
  
}
