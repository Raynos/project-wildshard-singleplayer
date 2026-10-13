import type { Material, Mesh, Points } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { TerrainField } from '@wildshard/engine/level/data';
import type { GraphSources } from './clientGraphs';

/**
 * What a trusted hybrid's data client lends its runtime (SHARD-PLATFORM G345): the data client built the shard's look
 * materials and, in presentation-only mode, draws its terrain; the runtime keeps its simulation and reads them here instead
 * of building a second copy. Published per shard identity while the data client's world scope lives (the runtime reads it
 * through `runtimePresentation`, `./runtimeProduct.ts`).
 */
export interface HybridPresentation {
  /** The data client's built family material `id` (a `look.materials` entry or a family default), owned by its scope. */
  readonly material: (id: string) => Material;
  /**
   * Lend a declared material to a runtime mesh or points object. The caller owns its
   * geometry; the data client owns the material. Scope disposal or unbind restores
   * the original material and retires any graph outline. Unknown ids refuse.
   */
  readonly bindMaterial: (id: string, object: Mesh | Points, scope: Scope) => () => void;
  /** The drawn terrain's height / normal queries, from its admitted collider; null when the data client draws no terrain. */
  readonly ground: TerrainField | null;
  /**
   * Hand the look's curves the live values of host-owned fields (`runtime.binds` names `state`; `look.curves` may read
   * them). Until bound, or when `read` answers undefined, a field reads its declared default. Returns the unbind.
   */
  readonly bindState: (read: NonNullable<GraphSources['state']>) => () => void;
}

const published = new Map<string, HybridPresentation[]>();

/** The data client: lend `presentation` to the runtime of shard `slug` while `scope` lives. */
export function publishHybridPresentation(slug: string, presentation: HybridPresentation, scope: Scope): void {
  if (scope.disposed) throw new Error('Hybrid presentation needs a live data client scope');
  const stack = published.get(slug) ?? [];
  stack.push(presentation); published.set(slug, stack);
  scope.onDispose(() => {
    const at = stack.indexOf(presentation); if (at !== -1) stack.splice(at, 1);
    if (stack.length === 0 && published.get(slug) === stack) published.delete(slug);
  });
}

/** The newest live presentation of shard `slug`, or null when no data client lends one. */
export function hybridPresentation(slug: string): HybridPresentation | null {
  return published.get(slug)?.at(-1) ?? null;
}
