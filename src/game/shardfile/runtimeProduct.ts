import type { Scope } from '@wildshard/engine/app/scope';
import { ClientAssets } from './clientAssets';
import { browserShardfileOptions } from '../plugin/ui';
import type { AdmittedProduct } from './product';
import { bindRuntimeProps, bindRuntimeTerrain, type RuntimePropsPorts, type RuntimeTerrain, type RuntimeTerrainPorts } from './runtimeWorld';
import { hybridPresentation, type HybridPresentation } from './hybridPresentation';
import type { Shardfile } from '@wildshard/format/shardSchema';

/**
 * The trusted runtime's product reader (SHARD-PLATFORM M3 tiles-swap, G227, E435): the same `ClientAssets` in both modes,
 * so a hybrid whose `runtime.binds` names `terrain` streams its compiled tiles whether it boots standalone or as a grid cell.
 *
 * - **Grid**: the cell's admission already holds the verified product (`liveSession.admitRuntime`); the regional world hands
 *   it to its resident runtime (`provideRuntimeProduct`, keyed by the shard's identity, for the resident scope's lifetime).
 * - **Standalone**: the legacy manifest admits no product. The reader starts empty and reads each declared file on demand
 *   from the canonical `/shardfiles/<slug>/` product the build writes (`scripts/build-shardfiles.mjs`), each one checked
 *   against its declared hash and size and cached like every product file, so only the collider and the resident tiles
 *   are ever fetched.
 */
export interface RuntimeProduct { readonly source: Shardfile; readonly assets: ClientAssets }

const provided = new Map<string, RuntimeProduct[]>();

/** The canonical product base for a first-party shard (`/shardfiles/<slug>/`), relative to the page. */
function productBase(slug: string): string {
  return new URL(`shardfiles/${slug}/`, typeof document === 'undefined' ? location.href : document.baseURI || location.href).href;
}

/** A grid cell's admitted product, read by its resident runtime while `scope` lives (the cell's resident scope). */
export function provideRuntimeProduct(admitted: AdmittedProduct, scope: Scope): void {
  if (scope.disposed) throw new Error('Runtime product needs a live resident scope');
  const slug = admitted.source.identity.slug;
  const product: RuntimeProduct = { source: admitted.source, assets: new ClientAssets(admitted.source, admitted.assets, browserShardfileOptions(productBase(slug), true)) };
  const stack = provided.get(slug) ?? [];
  stack.push(product); provided.set(slug, stack);
  scope.onDispose(() => {
    const at = stack.indexOf(product); if (at !== -1) stack.splice(at, 1);
    if (stack.length === 0 && provided.get(slug) === stack) provided.delete(slug);
  });
}

/** The product a grid cell of `slug` handed its resident runtime (`provideRuntimeProduct`), or null when none is resident. */
export function admittedRuntimeProduct(slug: string): RuntimeProduct | null {
  return provided.get(slug)?.at(-1) ?? null;
}

/** The reader for a trusted runtime's own declaration: its grid cell's admitted product while one is resident, else standalone. */
export function runtimeProduct(source: Shardfile): RuntimeProduct {
  const slug = source.identity.slug, admitted = admittedRuntimeProduct(slug);
  if (admitted !== null) return admitted;
  return { source, assets: new ClientAssets(source, new Map(), browserShardfileOptions(productBase(slug), true)) };
}

/** Bind a runtime's declared terrain tiles from its product reader (`runtimeProduct`) under `scope`; see `bindRuntimeTerrain`. */
export function bindRuntimeProductTerrain(scope: Scope, source: Shardfile, ports: Omit<RuntimeTerrainPorts, 'assets'>): Promise<RuntimeTerrain> {
  const product = runtimeProduct(source);
  return bindRuntimeTerrain({ scope }, product.source, { ...ports, assets: product.assets });
}

/** Bind a runtime's declared props tiles from its product reader (`runtimeProduct`) under `scope`; see `bindRuntimeProps`. */
export function bindRuntimeProductProps(scope: Scope, source: Shardfile, ports: Omit<RuntimePropsPorts, 'assets'>): Promise<void> {
  const product = runtimeProduct(source);
  return bindRuntimeProps({ scope }, product.source, { ...ports, assets: product.assets });
}

/**
 * What its data client lends a trusted runtime (`HybridPresentation`): the built look materials by id, the drawn terrain's
 * queries and the host-state port of the look's curves; null when no data client of this shard is live (a LEGACY entry, a
 * runtime that owns every stage, or a grid region whose ground the rings draw). Read it from a hook that runs after the data
 * client's world stage (the hybrid's runtime world, kit or play).
 */
export function runtimePresentation(source: Shardfile): HybridPresentation | null {
  return hybridPresentation(source.identity.slug);
}
