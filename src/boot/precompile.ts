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
 *   3. (the caller's firstFrame step draws; it should find nothing left to compile — `?perfload=1`
 *      lists what it did.)
 *
 * Program identity is the WebGLPrograms cache key: material type + shader IDs + parameters from
 * the target scene (fog, lights, environment), the object (instancing, skinning, morphs, geometry
 * attributes) and the render target (colour space, tone mapping). Every clone here is built so its
 * key equals the one the real draw will compute — a wrong key is a wasted compile, not a bug.
 */
import * as THREE from 'three';
import { Pass, type EffectComposer } from 'postprocessing';
import { PERFLOAD, perfLog, describeProgram, newProgramsSince, snapshotPrograms, type ProgramLike } from './perflog';

export interface CompileJob {
  label: string;
  root: THREE.Object3D;
  /** the scene whose fog / lights / environment the real draw will see (null: an empty scene) */
  target: THREE.Scene | null;
  /** render target the real draw goes to (null: the canvas) */
  rt: THREE.WebGLRenderTarget | null;
  /** compile with the target scene's fog cleared (the shadow pass and the background box see no fog) */
  fogOff?: boolean;
}

export interface PrecompileReport { materials: number; jobs: number; programs: number; parallel: boolean }

/** any scene object, with the mesh-ish fields the program key reads (all optional: lights, groups and bones have none) */
type MeshLike = THREE.Object3D & { isMesh?: boolean; geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[]; isInstancedMesh?: boolean; instanceColor?: THREE.InstancedBufferAttribute | null; isSkinnedMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };

/** The parts of an object that change its material's program (WebGLPrograms.getParameters). */
function objectKey(o: MeshLike): string {
  const g = o.geometry;
  const a: THREE.NormalBufferAttributes = g?.attributes ?? {};
  const morph = g?.morphAttributes ? Object.keys(g.morphAttributes).map((k) => `${k}${g.morphAttributes[k as 'position']?.length ?? 0}`).join('') : '';
  return `${o.isInstancedMesh ? 'I' : ''}${o.instanceColor ? 'C' : ''}${o.isSkinnedMesh ? 'S' : ''}${o.isPoints ? 'P' : ''}${o.isLine ? 'L' : ''}${o.isSprite ? 'Q' : ''}` +
    `|${a['uv1'] ? 1 : 0}${a['uv2'] ? 1 : 0}${a['uv3'] ? 1 : 0}${a['tangent'] ? 1 : 0}${a['color'] ? 1 : 0}${a['normal'] ? 1 : 0}|${morph}`;
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
    jobs.push({ label: `materials ${i}`, root, target: scene, rt });
  }
  return { jobs, materials: mats.size };
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
    clones.push(new THREE.Mesh(box, new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, map, alphaTest, side })));
  }
  const jobs: CompileJob[] = [];
  for (let i = 0; i < clones.length; i += per) {
    const root = new THREE.Group();
    for (const c of clones.slice(i, i + per)) root.add(c);
    jobs.push({ label: `shadow depth ${i}`, root, target: scene, rt, fogOff: true });
  }
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
  return { label: 'sky background', root, target: scene, rt };
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
  if (groups.buffer.children.length > 0) jobs.push({ label: 'post chain', root: groups.buffer, target: empty, rt });
  if (groups.screen.children.length > 0) jobs.push({ label: 'post → screen', root: groups.screen, target: empty, rt: null });
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
    for (const v of Object.values(m as unknown as Record<string, unknown>)) add(v);
    const u = (m as THREE.Material & { uniforms?: Record<string, THREE.IUniform> }).uniforms;
    if (u) for (const uni of Object.values(u)) add(uni.value);
  };
  // the jobs' clones carry every scene material, the post-chain materials and the background box;
  // the target scenes carry the background / environment maps
  for (const job of jobs) {
    job.root.traverse((o) => { for (const m of materialsOf(o)) fromMaterial(m); });
    if (job.target) { add(job.target.background); add(job.target.environment); }
  }
  return [...out];
}

const frame = (): Promise<void> => new Promise((resolve) => { requestAnimationFrame(() => { setTimeout(resolve, 0); }); }); // a real paint between

/**
 * Issue every job, then wait for the driver: reports (done, total, detail) monotonically —
 * `total` = jobs + programs once the programs are known.
 */
export async function runPrecompile(
  renderer: THREE.WebGLRenderer, camera: THREE.Camera, jobs: CompileJob[], materials: number,
  onProgress?: (done: number, total: number, detail: string) => void,
  textures: THREE.Texture[] = collectTextures(jobs),
): Promise<PrecompileReport> {
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const before = snapshotPrograms(renderer);
  const created: ProgramLike[] = [];
  const total = () => jobs.length + Math.max(created.length, 1) + textures.length;
  const mode = parallel ? 'parallel' : 'serial';
  let tFrame = performance.now();
  for (const [i, job] of jobs.entries()) {
    const t0 = performance.now();
    const snap = PERFLOAD ? snapshotPrograms(renderer) : null;
    const prevRt = renderer.getRenderTarget();
    const fog = job.target?.fog ?? null;
    try {
      if (job.fogOff && job.target) job.target.fog = null;
      renderer.setRenderTarget(job.rt);
      renderer.compile(job.root, camera, job.target ?? undefined);
    } finally {
      renderer.setRenderTarget(prevRt);
      if (job.fogOff && job.target) job.target.fog = fog;
    }
    if (snap) perfLog(`issue ${job.label}`, performance.now() - t0, renderer, newProgramsSince(renderer, snap).map(describeProgram).join(' | ') || 'cached');
    onProgress?.(i + 1, total(), `${materials} materials · ${i + 1} / ${jobs.length} batches · ${mode}`);
    // oxlint-disable-next-line eslint/no-useless-assignment -- read by the next iteration's guard; oxlint's flow analysis loses the loop back-edge across the try/finally above
    if (performance.now() - tFrame > 12 || i === jobs.length - 1) { await frame(); tFrame = performance.now(); }
  }
  created.push(...newProgramsSince(renderer, before));
  const n = created.length;
  const t0 = performance.now();
  // Phase A (parallel drivers): wait for COMPLETION_STATUS_KHR on every program, counting them up.
  const units = parallel ? 2 * n : n;
  if (parallel) {
    for (;;) {
      let ready = 0;
      for (const p of created) if (p.isReady()) ready++;
      onProgress?.(jobs.length + ready, jobs.length + units + textures.length, `${ready} / ${n} programs linked · parallel`);
      if (ready >= n) break;
      await frame();
    }
    if (PERFLOAD) perfLog('link', performance.now() - t0, renderer, `${n} programs · parallel`);
  }
  // Phase B: resolve each link. COMPLETION_STATUS only says the front end is done — ANGLE Metal
  // builds the Metal library on the first LINK_STATUS / uniform query (~20 ms a program with a cold
  // shader cache), which the first frame would otherwise pay for every program in one stall. One
  // resolve per program, time-boxed per frame so the count keeps moving; without the extension this
  // is also where the link itself blocks. The resolve is three's own first use (`getUniforms()`: the
  // link-status + info-log checks, every uniform / attribute location), which the first draw of each
  // program otherwise ran inside the first frame (~45 ms of onFirstUse at 4x CPU).
  const tB = performance.now();
  let tSlice = tB;
  const skipResolve = PERFLOAD && new URLSearchParams(location.search).has('noresolve'); // A/B for the instrumentation
  for (const [i, p] of created.entries()) {
    if (!skipResolve) p.getUniforms();
    onProgress?.(jobs.length + (parallel ? n : 0) + i + 1, jobs.length + units + textures.length, `${i + 1} / ${n} programs resolved · ${mode}`);
    if (performance.now() - tSlice > 12) { await frame(); tSlice = performance.now(); }
  }
  if (PERFLOAD) perfLog('resolve', performance.now() - tB, renderer, `${n} programs · LINK_STATUS`);
  // Phase C: upload every texture (12 ms slices) so the first draw finds them resident.
  const tC = performance.now();
  tSlice = tC;
  const base = jobs.length + units;
  for (const [i, tex] of textures.entries()) {
    try { renderer.initTexture(tex); } catch { /* a texture the driver rejects is the draw's problem, not the loader's */ }
    onProgress?.(base + i + 1, base + textures.length, `${i + 1} / ${textures.length} textures uploaded`);
    if (performance.now() - tSlice > 12) { await frame(); tSlice = performance.now(); }
  }
  if (PERFLOAD) perfLog('textures', performance.now() - tC, renderer, `${textures.length} textures · initTexture`);
  return { materials, jobs: jobs.length, programs: n, parallel };
}
