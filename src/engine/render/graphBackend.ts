/**
 * The lazy door to the TSL back-end (SHARD-PLATFORM SF59 step 2; sf59-tsl-spike.md §5 point 4). `three/webgpu` +
 * `three/tsl` add ≈ 117 KB gzip (the spike's surface; up to ≈ 256 KB for all of it), so they load as their own chunk, only
 * when a graph material is about to be used: `await loadGraphBackend(renderer)` installs the engine's node handler
 * (`nodes/engineNodesHandler.ts`) on the renderer once and returns it. Nothing on the default render path calls it, so a
 * shard without a graph material pays nothing and its programs stay byte for byte.
 */
import type { attachOutline, compileGraph } from './graph/compile';
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
}

/**
 * install the engine's node handler on this renderer, then load the material graph compiler (`graph/compile.ts`,
 * SF59 step 3) from the same lazy chunk family: a graph IR becomes a node material only through this door
 */
export async function loadGraphCompiler(renderer: Renderer): Promise<GraphCompiler> {
  await loadGraphBackend(renderer);
  const { attachOutline: attach, compileGraph: compile } = await import('./graph/compile');
  return { compileGraph: compile, attachOutline: attach };
}
