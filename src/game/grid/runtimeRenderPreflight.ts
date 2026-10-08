/**
 * The renderer's preflight for a runtime render plan (SHARD-PLATFORM G208, E435): classify a built region subtree into
 * ring chunks and shared dependencies with real byte figures. Generic: it knows meshes, geometry and textures, never a
 * shard. Duck-typed over three's `is*` flags (no `instanceof`), so a probe can run the same module against a live page.
 *
 * Rules, all honest-by-construction:
 * - a drawable whose root-local bounds fit one L1 tile footprint (with `slack`) belongs to the L1 chunk of its centre;
 *   anything larger (the one-mesh terrain, a cell-wide instanced forest, a batched herd) is **global**: its own buffers are
 *   `nonStreamingBytes`, because no ring can drop part of it;
 * - a geometry, instance buffer or texture used by exactly one chunk is that chunk's; one used by several chunks is a
 *   dependency charged once per distinct chunk set; one used by a global drawable is an `always` dependency;
 * - GPU bytes come from element counts and texture dimensions (they survive a released CPU array); JS bytes are the CPU
 *   arrays / decoded images still retained right now. Everything not in the scene (render targets, PMREM, shadow maps, sim
 *   JS, WASM) stays in the residual that `reconcileRenderPlan` derives from the measured claim.
 */
import { Box3, Matrix4, Vector3, type BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute, type Material, type Object3D, type Texture } from 'three';
import { CHUNK_HALF, CONTENT_CAPS } from '@wildshard/engine/core/config';
import type { RuntimeRenderPlan } from './runtimeRenderPlan';
import type { RuntimeCost } from './runtimeCost';

/** A classified shared resource set (charged once; `always` = used by a cell-wide drawable). */
export interface PreflightDependency { readonly id: string; readonly jsBytes: number; readonly gpuBytes: number; readonly always?: boolean }
/** One L1 ring tile's own presentation bytes. */
export interface PreflightChunk { readonly id: string; readonly level: 'l1'; readonly x: number; readonly z: number; readonly dependencyIds: readonly string[]; readonly jsBytes: number; readonly gpuBytes: number }
/** The classification, before the runtime plan's provenance and residual are attached (`runtimeRenderPlan.ts`, sp-x2). */
export interface PreflightPlan { readonly id: string; readonly claimBytes: number; readonly nonStreamingBytes: number; readonly dependencies: readonly PreflightDependency[]; readonly chunks: readonly PreflightChunk[] }

/** What one classified resource costs. */
interface Cost { js: number; gpu: number }
/** One drawable's resources, keyed by object identity for dedupe. */
interface Owned { readonly own: Map<object, Cost>; readonly shared: Map<object, Cost> }

const L1 = CONTENT_CAPS.l1.size, TILES = 4;

type Drawable = Object3D & { geometry?: BufferGeometry; material?: Material | Material[]; isMesh?: boolean; isPoints?: boolean; isLine?: boolean;
  isInstancedMesh?: boolean; isBatchedMesh?: boolean; instanceMatrix?: BufferAttribute; instanceColor?: BufferAttribute | null; count?: number };

function attributeCost(attribute: BufferAttribute | InterleavedBufferAttribute): { key: object; cost: Cost } {
  if ('isInterleavedBufferAttribute' in attribute) {
    const data = attribute.data, gpu = data.count * data.stride * data.array.BYTES_PER_ELEMENT;
    return { key: data, cost: { js: data.array.byteLength, gpu } };
  }
  const array = attribute.array, gpu = attribute.count * attribute.itemSize * array.BYTES_PER_ELEMENT;
  return { key: attribute, cost: { js: array.byteLength, gpu: Math.max(gpu, array.byteLength) } };
}

function geometryCosts(geometry: BufferGeometry, into: Map<object, Cost>): void {
  for (const attribute of Object.values(geometry.attributes)) { const { key, cost } = attributeCost(attribute); into.set(key, cost); }
  for (const list of Object.values(geometry.morphAttributes) as (BufferAttribute[] | undefined)[]) for (const attribute of list ?? []) { const { key, cost } = attributeCost(attribute); into.set(key, cost); }
  const index = geometry.index;
  if (index !== null) { const { key, cost } = attributeCost(index); into.set(key, cost); }
}

interface Dimensions { width: number; height: number; depth: number }
const dims = (value: unknown): Dimensions | null => {
  if (typeof value !== 'object' || value === null) return null;
  const read = (name: string): number => { const field: unknown = Reflect.get(value, name); return typeof field === 'number' && Number.isFinite(field) ? field : 0; };
  const width = read('width') || read('naturalWidth') || read('videoWidth'), height = read('height') || read('naturalHeight') || read('videoHeight');
  return width > 0 && height > 0 ? { width, height, depth: Math.max(1, read('depth')) } : null;
};
const bufferLength = (value: unknown): number => {
  if (typeof value !== 'object' || value === null) return 0;
  const data: unknown = Reflect.get(value, 'data');
  return ArrayBuffer.isView(data) ? data.byteLength : 0;
};

/** A texture's GPU allocation (full mip chain) and the CPU source it still retains. */
export function textureCost(texture: Texture): Cost {
  const flags = texture as Texture & { isCompressedTexture?: boolean; isCubeTexture?: boolean; isDataTexture?: boolean; isDataArrayTexture?: boolean; isData3DTexture?: boolean };
  const faces = flags.isCubeTexture === true ? 6 : 1;
  const mipmaps: unknown[] = Array.isArray(texture.mipmaps) ? texture.mipmaps : [];
  if (flags.isCompressedTexture === true && mipmaps.length > 0) {
    let sum = 0; for (const level of mipmaps) sum += bufferLength(level);
    return { js: sum, gpu: sum * faces };
  }
  const image: unknown = texture.image;
  const images: unknown[] = Array.isArray(image) ? image : [image];
  let gpu = 0, js = 0;
  for (const source of images) {
    const size = dims(source);
    if (size === null) continue;
    const data = bufferLength(source);
    const texel = data > 0 ? data / (size.width * size.height * size.depth) : 4;
    const base = size.width * size.height * size.depth * texel;
    gpu += texture.generateMipmaps || mipmaps.length > 1 ? Math.ceil(base * 4 / 3) : base;
    js += data > 0 ? data : base; // a decoded bitmap / canvas retains its pixels on the CPU side
  }
  return { js: Math.round(js), gpu: Math.round(gpu) * (Array.isArray(image) ? 1 : faces) };
}

const isTexture = (value: unknown): value is Texture => typeof value === 'object' && value !== null && Reflect.get(value, 'isTexture') === true;

function materialTextures(material: Material, into: Map<object, Cost>): void {
  for (const value of Object.values(material) as unknown[]) {
    if (isTexture(value)) into.set(value, textureCost(value));
  }
  const uniforms: unknown = Reflect.get(material, 'uniforms');
  if (typeof uniforms === 'object' && uniforms !== null) for (const uniform of Object.values(uniforms)) {
    const value: unknown = typeof uniform === 'object' && uniform !== null ? Reflect.get(uniform, 'value') : null;
    if (isTexture(value)) into.set(value, textureCost(value));
  }
}

function owned(node: Drawable): Owned {
  const own = new Map<object, Cost>(), shared = new Map<object, Cost>();
  if (node.geometry !== undefined) geometryCosts(node.geometry, shared);
  if (node.isInstancedMesh === true && node.instanceMatrix !== undefined) {
    const { key, cost } = attributeCost(node.instanceMatrix); own.set(key, cost);
    if (node.instanceColor) { const color = attributeCost(node.instanceColor); own.set(color.key, color.cost); }
  }
  const materials = node.material === undefined ? [] : Array.isArray(node.material) ? node.material : [node.material];
  for (const material of materials) materialTextures(material, shared);
  return { own, shared };
}

export interface PreflightOptions {
  readonly id: string;
  /** the measured whole-runtime accounted claim */
  readonly claimBytes: number;
  /** a drawable may overhang its L1 tile by this fraction of a tile and still belong to it (default 0.5) */
  readonly slack?: number;
}
/** The classification before reconciliation, plus a readout of what went where. */
export interface PreflightResult {
  readonly plan: PreflightPlan;
  readonly drawables: { readonly chunked: number; readonly global: number };
  readonly globalNames: readonly { readonly name: string; readonly bytes: number }[];
}

/**
 * Classify every drawable under `root` (its local frame is the cell's: x / z in [−CHUNK_HALF, CHUNK_HALF]). Hidden
 * drawables count: they are resident whether or not they draw this frame.
 */
export function preflightRenderPlan(root: Object3D, options: PreflightOptions): PreflightResult {
  const slack = (options.slack ?? 0.5) * L1;
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert(), box = new Box3(), centre = new Vector3(), size = new Vector3(), local = new Matrix4();
  const users = new Map<object, { cost: Cost; chunks: Set<string> }>();
  const chunkOwn = new Map<string, Cost>(), nonStreaming: Cost = { js: 0, gpu: 0 };
  const globalNames: { name: string; bytes: number }[] = [];
  let chunked = 0, globals = 0;
  const add = (target: Cost, cost: Cost): void => { target.js += cost.js; target.gpu += cost.gpu; };
  root.traverse(object => {
    const node = object as Drawable;
    if (node.isMesh !== true && node.isPoints !== true && node.isLine !== true) return;
    const geometry = node.geometry;
    if (geometry === undefined) return;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    let chunk: string | null = null;
    if (bounds !== null && node.isInstancedMesh !== true && node.isBatchedMesh !== true && !bounds.isEmpty()) {
      local.multiplyMatrices(toRoot, node.matrixWorld);
      box.copy(bounds).applyMatrix4(local); box.getCenter(centre); box.getSize(size);
      if (size.x <= L1 + slack && size.z <= L1 + slack && Math.abs(centre.x) <= CHUNK_HALF && Math.abs(centre.z) <= CHUNK_HALF) {
        const x = Math.min(TILES - 1, Math.floor((centre.x + CHUNK_HALF) / L1)), z = Math.min(TILES - 1, Math.floor((centre.z + CHUNK_HALF) / L1));
        chunk = `l1/${x}/${z}`;
      }
    }
    const { own, shared } = owned(node);
    if (chunk === null) {
      globals++;
      let bytes = 0;
      for (const cost of own.values()) { add(nonStreaming, cost); bytes += cost.js + cost.gpu; }
      for (const [key, cost] of shared) {
        const row = users.get(key) ?? { cost, chunks: new Set<string>() }; row.chunks.add('global'); users.set(key, row);
        bytes += cost.gpu;
      }
      globalNames.push({ name: node.name || node.type, bytes });
      return;
    }
    chunked++;
    const mine = chunkOwn.get(chunk) ?? { js: 0, gpu: 0 }; chunkOwn.set(chunk, mine);
    for (const cost of own.values()) add(mine, cost);
    for (const [key, cost] of shared) { const row = users.get(key) ?? { cost, chunks: new Set<string>() }; row.chunks.add(chunk); users.set(key, row); }
  });
  // single-chunk resources are the chunk's; the rest group into one dependency per distinct chunk set
  const groups = new Map<string, { cost: Cost; chunks: readonly string[]; always: boolean }>();
  for (const { cost, chunks } of users.values()) {
    if (chunks.size === 1 && !chunks.has('global')) {
      const [only] = chunks; if (only === undefined) continue;
      const mine = chunkOwn.get(only) ?? { js: 0, gpu: 0 }; add(mine, cost); chunkOwn.set(only, mine); continue;
    }
    const always = chunks.has('global'), members = always ? [] : [...chunks].sort(), key = always ? 'shared:global' : `shared:${members.join('+')}`;
    const group = groups.get(key) ?? { cost: { js: 0, gpu: 0 }, chunks: members, always }; add(group.cost, cost); groups.set(key, group);
  }
  const dependencies: PreflightDependency[] = [], depIds = new Map<string, string[]>();
  let n = 0;
  for (const [, group] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const id = group.always ? 'dep.global' : `dep.${String(n++).padStart(3, '0')}`;
    dependencies.push({ id, jsBytes: group.cost.js, gpuBytes: group.cost.gpu, ...(group.always ? { always: true } : {}) });
    if (!group.always) for (const chunk of group.chunks) depIds.set(chunk, [...(depIds.get(chunk) ?? []), id]);
  }
  const chunks: PreflightChunk[] = [...chunkOwn].sort((a, b) => a[0].localeCompare(b[0])).map(([tile, cost]) => {
    const [, xs = '0', zs = '0'] = tile.split('/');
    return { id: `chunk.${tile.replaceAll('/', '.')}`, level: 'l1', x: Number(xs), z: Number(zs), dependencyIds: depIds.get(tile) ?? [], jsBytes: cost.js, gpuBytes: cost.gpu };
  });
  globalNames.sort((a, b) => b.bytes - a.bytes);
  return { plan: { id: options.id, claimBytes: options.claimBytes, nonStreamingBytes: nonStreaming.js + nonStreaming.gpu, dependencies, chunks },
    drawables: { chunked, global: globals }, globalNames: globalNames.slice(0, 20) };
}

/** The L1 chunk ids the rings want with the camera at cell-local (x, z): every tile within `radius` (default 400 m). */
export function wantedL1Chunks(plan: Pick<PreflightPlan, 'chunks'>, x: number, z: number, radius = 400): ReadonlySet<string> {
  const wanted = new Set<string>();
  for (const chunk of plan.chunks) {
    const minX = -CHUNK_HALF + chunk.x * L1, minZ = -CHUNK_HALF + chunk.z * L1;
    const d = Math.hypot(Math.max(minX - x, 0, x - minX - L1), Math.max(minZ - z, 0, z - minZ - L1));
    if (d <= radius) wanted.add(chunk.id);
  }
  return wanted;
}

/**
 * Hand a classification to sp-x2's checked plan (`runtimeRenderPlan.ts`): streamable dependencies and chunks keep their
 * bytes; cell-wide drawables, their `always` dependencies and the whole residual (measured accounted claim minus what was
 * classified as streamable) become `nonStreamingBytes`, so the full inventory never undercounts the measured whole.
 * `measuredWholeBytes` is `runtimeAccountedBytes(measurement)`; the provenance is checked by `compileRuntimeRenderPlan`.
 */
export function toRuntimeRenderPlan(plan: PreflightPlan, measurement: Pick<RuntimeCost, 'rev' | 'evidence'>, measuredWholeBytes: number): RuntimeRenderPlan {
  const streamDeps = plan.dependencies.filter(dep => dep.always !== true);
  let streamable = 0, fixed = plan.nonStreamingBytes;
  for (const dep of plan.dependencies) if (dep.always === true) fixed += dep.jsBytes + dep.gpuBytes; else streamable += dep.jsBytes + dep.gpuBytes;
  for (const chunk of plan.chunks) streamable += chunk.jsBytes + chunk.gpuBytes;
  return { measurement: { rev: measurement.rev, evidence: measurement.evidence }, nonStreamingBytes: Math.max(fixed, measuredWholeBytes - streamable),
    dependencies: streamDeps.map(({ id, jsBytes, gpuBytes }) => ({ id, jsBytes, gpuBytes })), chunks: plan.chunks.map(chunk => ({ ...chunk, dependencyIds: [...chunk.dependencyIds] })) };
}
