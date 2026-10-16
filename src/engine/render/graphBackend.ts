/**
 * The lazy door to the TSL back-end (SHARD-PLATFORM SF59 step 2; sf59-tsl-spike.md §5 point 4). `three/webgpu` +
 * `three/tsl` add ≈ 117 KB gzip (the spike's surface; up to ≈ 256 KB for all of it), so they load as their own chunk, only
 * when a graph material is about to be used: `await loadGraphBackend(renderer)` installs the engine's node handler
 * (`nodes/engineNodesHandler.ts`) on the renderer once and returns it. Nothing on the default render path calls it, so a
 * shard without a graph material pays nothing and its programs stay byte for byte.
 */
import { Texture, Material, Vector2 } from 'three';
import type { Scope } from '../app/scope';
import type { attachOutline, compileGraph, GraphNormalPrepass, GraphPostPass } from './graph/compile';
import type { EngineNodesHandler } from './nodes/engineNodesHandler';
import type { Renderer } from './renderer';

const installed = new WeakMap<Renderer, Promise<EngineNodesHandler>>();

/** install the engine's node handler on this renderer (once; later calls return the same handler) */
export function loadGraphBackend(renderer: Renderer): Promise<EngineNodesHandler> {
  const known = installed.get(renderer);
  if (known !== undefined) return known;
  const loading = import('./nodes/engineNodesHandler').then(({ EngineNodesHandler: Handler }) => {
    const handler = new Handler();
    renderer.setNodesHandler(handler);
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
    const variant = scope.own(material.clone());
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
  const variant = scope.own(material.clone());
  if (!Reflect.set(variant, 'map', map)) throw new Error('Graph colour map could not be bound');
  meshMapBases.set(variant, material);
  textures.set(map, variant);
  return variant;
}

/** Resolve the compiled graph that owns a borrowed-map variant, including its outline and live parameter feeds. */
export function graphMeshMapBase(material: Material): Material { return meshMapBases.get(material) ?? material; }
