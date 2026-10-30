/**
 * The lazy door to the TSL back-end (SHARD-PLATFORM SF59 step 2; sf59-tsl-spike.md §5 point 4). `three/webgpu` +
 * `three/tsl` add ≈ 117 KB gzip (the spike's surface; up to ≈ 256 KB for all of it), so they load as their own chunk, only
 * when a graph material is about to be used: `await loadGraphBackend(renderer)` installs the engine's node handler
 * (`nodes/engineNodesHandler.ts`) on the renderer once and returns it. Nothing on the default render path calls it, so a
 * shard without a graph material pays nothing and its programs stay byte for byte.
 */
import { Texture, Material, Object3D, Vector2, type Mesh, type MeshDepthMaterial } from 'three';
import type { GraphBinding, GraphLiteral, GraphValidation, GraphValidationOptions } from '@wildshard/format/materialGraph';
import type { ToonLook } from './families/toon';
import type { Scope } from '../app/scope';
import { graphNodeOwner, ownGraphNodes } from './nodes/graphOwners';
import type { attachOutline, compileGraph, GraphNormalPrepass, GraphPostPass } from './graph/compile';
import type { EngineNodesHandler } from './nodes/engineNodesHandler';
import type { NodeMaterial } from 'three/webgpu';
import type { Renderer } from './renderer';
import { installClassicShadowDepth } from './shadowMaterialOwnership';
import { registerShadowDepthResolver, type ShadowDepthResolver } from './shadowDepthVariants';

const installed = new WeakMap<Renderer, Promise<EngineNodesHandler>>();
const ready = new WeakMap<Renderer, EngineNodesHandler>();

/** the renderer's node handler once installed, else null (never loads the back-end; diagnostics read its counters) */
export function installedGraphBackend(renderer: Renderer): EngineNodesHandler | null { return ready.get(renderer) ?? null; }

/** install the engine's node handler on this renderer (once; later calls return the same handler) */
export function loadGraphBackend(renderer: Renderer): Promise<EngineNodesHandler> {
  const known = installed.get(renderer);
  if (known !== undefined) return known;
  const loading = import('./nodes/engineNodesHandler').then(({ EngineNodesHandler: Handler }) => {
    const handler = new Handler();
    renderer.setNodesHandler(handler);
    ready.set(renderer, handler);
    return handler;
  });
  installed.set(renderer, loading);
  return loading;
}

/** the graph compiler's entry points, once its chunk has loaded */
export interface GraphCompiler {
  readonly compileGraph: typeof compileGraph;
  /** add a compiled graph's outline stage to a mesh as its second draw (SF59 step 7) */
  readonly attachOutline: typeof attachOutline;
  /** a compiled post graph as a composer pass (SF59 step 4) */
  readonly GraphPostPass?: typeof GraphPostPass;
  /** the normal pre-pass a post stack reading `sceneNormal` pays once */
  readonly GraphNormalPrepass?: typeof GraphNormalPrepass;
}

/**
 * install the engine's node handler on this renderer, then load the material graph compiler (`graph/compile.ts`,
 * SF59 step 3) from the same lazy chunk family: a graph IR becomes a node material only through this door
 */
export async function loadGraphCompiler(renderer: Renderer): Promise<GraphCompiler> {
  await loadGraphBackend(renderer);
  const { attachOutline: attach, compileGraph: compile, GraphPostPass: PostPass, GraphNormalPrepass: NormalPrepass } = await import('./graph/compile');
  return { compileGraph: compile, attachOutline: attach, GraphPostPass: PostPass, GraphNormalPrepass: NormalPrepass };
}

/** a compiled declared fog (`kind: 'fog'`), opaque outside the back-end that compiled it */
export interface LookGraphFog { readonly backend: 'tsl' | 'glsl' }
/** what a look material's compile takes, on either back-end */
export interface LookGraphOptions extends GraphValidationOptions {
  readonly toon?: ToonLook;
  readonly replaceEnvironmentDiffuse?: boolean;
  readonly textures?: (ref: string, role?: 'colour' | 'data') => Texture;
  /** resolves a material's `effectState.fog` catalogue id to that compiled fog graph (this back-end's) */
  readonly fog?: (id: string) => LookGraphFog;
  readonly validated?: Extract<GraphValidation, { ok: true }>;
}
/** a compiled look material, on either back-end */
export interface LookGraph {
  readonly material: Material;
  readonly outline: Material | null;
  readonly fog: LookGraphFog | null;
  readonly bindings: readonly { readonly param: string; readonly bind: GraphBinding }[];
  readonly setParam: (name: string, value: GraphLiteral) => void;
  readonly setTexture: (name: string, texture: Texture) => void;
}
/** A look material's graph compiler: the shipped TSL one (`graph/compile.ts`) or the classic GLSL one
 *  (`graph/glslMaterial.ts`, nine-fix NF14). A compile's declared fogs and outlines are its own back-end's. */
export interface LookGraphCompiler {
  readonly backend: 'tsl' | 'glsl';
  readonly compileGraph: (input: unknown, opts: LookGraphOptions) => LookGraph;
  readonly attachOutline: (mesh: Mesh, outline: Material) => Mesh;
}
/** a back-end's declared fogs behind their tokens */
function fogTokens<P>(backend: 'tsl' | 'glsl'): { readonly wrap: (fog: P | null) => LookGraphFog | null; readonly unwrap: (token: LookGraphFog) => P } {
  const own = new WeakMap<LookGraphFog, P>();
  return {
    wrap: (fog) => { if (fog === null) return null; const token: LookGraphFog = { backend }; own.set(token, fog); return token; },
    unwrap: (token) => { const fog = own.get(token); if (fog === undefined) throw new Error(`material graph: a declared fog of another ${backend === 'tsl' ? 'back-end' : 'compile'}`); return fog; },
  };
}
const isNodeMaterial = (material: Material): material is NodeMaterial => Reflect.get(material, 'isNodeMaterial') === true;
/** The shipped TSL compiler behind the look-material contract (its declared fogs as tokens). */
export function tslLookCompiler(compiler: Pick<GraphCompiler, 'compileGraph' | 'attachOutline'>): LookGraphCompiler {
  const fogs = fogTokens<NonNullable<ReturnType<GraphCompiler['compileGraph']>['fog']>>('tsl');
  return {
    backend: 'tsl',
    compileGraph: (input, { fog, ...opts }) => {
      const compiled = compiler.compileGraph(input, { ...opts, ...(fog === undefined ? {} : { fog: (id: string) => fogs.unwrap(fog(id)) }) });
      return { material: compiled.material, outline: compiled.outline, fog: fogs.wrap(compiled.fog), bindings: compiled.bindings, setParam: compiled.setParam, setTexture: compiled.setTexture };
    },
    attachOutline: (mesh, outline) => {
      if (!isNodeMaterial(outline)) throw new Error('material graph: a TSL outline is a node material');
      return compiler.attachOutline(mesh, outline);
    },
  };
}
/** a compiled post graph, on either back-end: a scaled post pass lends its inputs as textures and moves its params */
export interface PostGraph {
  readonly material: Material;
  readonly setParam: (name: string, value: GraphLiteral) => void;
  readonly setTexture: (name: string, texture: Texture) => void;
  readonly setArrayParam: (name: string, value: readonly GraphLiteral[]) => void;
}
/** A post graph compiler: the shipped TSL one or the classic GLSL one (nine-fix NF16's seam). */
export interface PostGraphCompiler {
  readonly backend: 'tsl' | 'glsl';
  readonly compileGraph: (input: unknown, opts: GraphValidationOptions) => PostGraph;
}
/** The post compiler of the chosen back-end (pause ▸ Settings ▸ Debug ▸ Graph back-end); the classic one loads no node runtime. */
export async function loadPostGraphCompiler(renderer: Renderer, backend: 'tsl' | 'glsl'): Promise<PostGraphCompiler> {
  if (backend === 'tsl') {
    const compiler = await loadGraphCompiler(renderer);
    return { backend, compileGraph: (input, opts) => compiler.compileGraph(input, opts) };
  }
  const [{ compileClassicGraph }, { installGraphShaderHost }] = await Promise.all([import('./graph/glslMaterial'), import('./graph/glslProgram')]);
  installGraphShaderHost(renderer);
  return { backend, compileGraph: (input, opts) => compileClassicGraph(input, opts) };
}
/** a renderer's classic depth resolver, made once (registration dedupes by identity); the caster is unknown at compile time,
 *  so its grid decode reads a plain object's (step 1): uniforms only, the program is the same */
const classicDepthResolvers = new WeakMap<object, ShadowDepthResolver>();
const compileCaster = new Object3D();
function classicDepthResolver(depthOf: (source: unknown, stock: MeshDepthMaterial, object: Object3D) => Material | null): ShadowDepthResolver {
  let resolve = classicDepthResolvers.get(depthOf);
  if (resolve === undefined) { resolve = (source, stock) => depthOf(source, stock, compileCaster); classicDepthResolvers.set(depthOf, resolve); }
  return resolve;
}
/**
 * The look-material compiler of the chosen back-end (pause ▸ Settings ▸ Debug ▸ Graph back-end): the classic one loads
 * no node runtime and installs no node handler; the shipped one is `loadGraphCompiler`'s.
 */
export async function loadLookGraphCompiler(renderer: Renderer, backend: 'tsl' | 'glsl'): Promise<LookGraphCompiler> {
  if (backend === 'tsl') return tslLookCompiler(await loadGraphCompiler(renderer));
  const [{ compileClassicGraph, attachClassicOutline, classicShadowDepth }, { installGraphShaderHost }] = await Promise.all([import('./graph/glslMaterial'), import('./graph/glslProgram')]);
  installGraphShaderHost(renderer);
  installClassicShadowDepth(classicShadowDepth);
  // precompile's shadow jobs warm each classic caster's own depth program (it links in the loading, not at its first cast)
  registerShadowDepthResolver(renderer, classicDepthResolver(classicShadowDepth));
  const fogs = fogTokens<NonNullable<ReturnType<typeof compileClassicGraph>['fog']>>('glsl');
  return {
    backend,
    compileGraph: (input, { fog, ...opts }) => {
      const compiled = compileClassicGraph(input, { ...opts, ...(fog === undefined ? {} : { fog: (id: string) => fogs.unwrap(fog(id)) }) });
      return { material: compiled.material, outline: compiled.outline, fog: fogs.wrap(compiled.fog), bindings: compiled.bindings, setParam: compiled.setParam, setTexture: compiled.setTexture };
    },
    attachOutline: attachClassicOutline,
  };
}

const meshMapBases = new WeakMap<Material, Material>();
const sourceMaps = new WeakMap<Scope, WeakMap<Material, WeakMap<Material, Material>>>();
const meshMaps = new WeakMap<Scope, WeakMap<Material, WeakMap<Texture, Material>>>();

/** Borrow a model's original colour map for an opted-in graph, preserving its sampler and UV transform.
 * Equal graph/map pairs share one scope-owned material; neither the source nor the borrowed texture is disposed. */
export function bindGraphMeshMap(material: Material, map: Texture | Material | null | undefined, scope: Scope): Material {
  if (map instanceof Material) {
    if (scope.disposed) throw new Error('Graph map loan needs a live scope');
    if (material.userData['graphPbrMaps'] !== true && material.userData['graphMeshMap'] !== true) return material;
    let owners = sourceMaps.get(scope);
    if (owners === undefined) { owners = new WeakMap(); sourceMaps.set(scope, owners); }
    let sources = owners.get(material);
    if (sources === undefined) { sources = new WeakMap(); owners.set(material, sources); }
    const known = sources.get(map); if (known !== undefined) return known;
    const variant = graphClone(material, scope);
    for (const slot of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'aoMap'] as const) {
      const value: unknown = Reflect.get(map, slot);
      if (value instanceof Texture && !Reflect.set(variant, slot, value)) throw new Error(`Graph cannot borrow ${slot}`);
    }
    for (const slot of ['bumpScale', 'aoMapIntensity'] as const) {
      const value: unknown = Reflect.get(map, slot);
      if (typeof value === 'number' && Number.isFinite(value)) Reflect.set(variant, slot, value);
    }
    const scale: unknown = Reflect.get(map, 'normalScale'), target: unknown = Reflect.get(variant, 'normalScale');
    if (scale instanceof Vector2 && target instanceof Vector2) target.copy(scale);
    meshMapBases.set(variant, material); sources.set(map, variant); return variant;
  }
  if (material.userData['graphMeshMap'] !== true || (map === null || map === undefined)) return material;
  let graphs = meshMaps.get(scope);
  if (graphs === undefined) { graphs = new WeakMap(); meshMaps.set(scope, graphs); }
  let textures = graphs.get(material);
  if (textures === undefined) { textures = new WeakMap(); graphs.set(material, textures); }
  const known = textures.get(map); if (known !== undefined) return known;
  const variant = graphClone(material, scope);
  if (!Reflect.set(variant, 'map', map)) throw new Error('Graph colour map could not be bound');
  meshMapBases.set(variant, material);
  textures.set(map, variant);
  return variant;
}

/** A scope-owned clone of a compiled graph material that shares its nodes, and so its compile's node owner: a clone with
 *  no owner was a full node build per mesh map (nodeBuildReuse rebinds an equal graph's build, and refuses what it cannot) */
function graphClone(material: Material, scope: Scope): Material {
  const variant = scope.own(material.clone());
  shareGraphOwner(variant, material);
  return variant;
}
/** `variant`, a clone of `source` sharing its nodes (a cell's clip variant), builds as `source`'s compile would: an equal
 *  earlier build is rebound to it instead of a full node build (no-op for a material no graph compile made) */
export function shareGraphOwner(variant: Material, source: Material): void {
  const owner = graphNodeOwner(source);
  if (owner !== undefined) ownGraphNodes(variant, owner);
}

/** Resolve the compiled graph that owns a borrowed-map variant, including its outline and live parameter feeds. */
export function graphMeshMapBase(material: Material): Material { return meshMapBases.get(material) ?? material; }
