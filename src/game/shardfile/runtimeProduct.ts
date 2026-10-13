import type { Scope } from '@wildshard/engine/app/scope';
import { ClientAssets } from './clientAssets';
import { browserShardfileOptions } from '../plugin/ui';
import { boundedResponse, type AdmittedProduct, type ProductOptions } from './product';
import { bindRuntimeProps, bindRuntimeTerrain, type RuntimePropsPorts, type RuntimeTerrain, type RuntimeTerrainPorts } from './runtimeWorld';
import { hybridPresentation, type HybridPresentation } from './hybridPresentation';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { SHARDFILE_ADMISSION_LIMITS } from '@wildshard/format/admissionLimits';
import { runtimeBoundWorldFiles } from '../plugin/headless';
import { clientMaterials } from './clientMaterials';
import type { ShardContext } from '../plugin/context';

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
export interface RuntimeProduct {
  readonly source: Shardfile; readonly assets: ClientAssets;
  /** Release decoded runtime-owned wires from both admission and this reader; unbound/shared files remain. */
  readonly releaseTransport: (refs: Iterable<string>) => Promise<void>;
}

function ownedRuntimeProduct(source: Shardfile, assets: ClientAssets, release?: AdmittedProduct['releaseTransport']): RuntimeProduct {
  const bound = runtimeBoundWorldFiles(source);
  return { source, assets, releaseTransport: async refs => {
    const requested = [...refs].filter(ref => bound.has(ref));
    // Old/caller-owned admissions have no release authority: preserve their supplied maps and mirrors.
    const released = release === undefined ? [] : await release(requested);
    assets.releaseTransport(released);
  } };
}

const provided = new Map<string, RuntimeProduct[]>();

/** The canonical product base for a first-party shard (`/shardfiles/<slug>/`), relative to the page. */
function productBase(slug: string): string {
  return new URL(`shardfiles/${slug}/`, typeof document === 'undefined' ? location.href : document.baseURI || location.href).href;
}

/** A grid cell's admitted product, read by its resident runtime while `scope` lives (the cell's resident scope). */
export function provideRuntimeProduct(admitted: AdmittedProduct, scope: Scope, options?: ProductOptions): void {
  if (scope.disposed) throw new Error('Runtime product needs a live resident scope');
  const slug = admitted.source.identity.slug;
  const assets = new ClientAssets(admitted.source, admitted.assets, options ?? browserShardfileOptions(productBase(slug), true));
  // The handoff copies first, then pins every runtime-owned reread for the resident scope before any decoder releases it.
  scope.onDispose(assets.lease(runtimeBoundWorldFiles(admitted.source)));
  const product = ownedRuntimeProduct(admitted.source, assets, admitted.releaseTransport);
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

const declared = new Map<string, Shardfile>();

/**
 * A trusted hybrid's own declaration, recorded when its page prepares it (`prepareHybridShard`), so a session reader that
 * knows only the shard's slug (the baked-samples reader, `installProductSampling`) reaches the same product reader as its
 * runtime (`runtimeProduct`). The declaration is its module's own constant, so recording it retains nothing new.
 */
export function provideHybridDeclaration(source: Shardfile): void {
  declared.set(source.identity.slug, source);
}

const descriptors = new Map<string, Promise<Shardfile>>();

/** Read a first-party product's built descriptor (`<base>shard.json`, or the visited copy offline) and parse it. */
function readDescriptor(options: ProductOptions): Promise<Shardfile> {
  return (async () => {
    const visited = options.offline ? await options.cache?.product(options.base) : undefined;
    if (options.offline && visited?.firstParty !== true) throw new Error('First-party shardfile has not been visited offline');
    const input: unknown = options.offline ? visited?.source : JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedResponse(await options.fetch(new URL('shard.json', options.base).href), SHARDFILE_ADMISSION_LIMITS.sourceBytes)));
    return parseShardfile(input);
  })();
}

/**
 * A standalone first-party hybrid's built descriptor, read ahead of its hybrid boot by a session reader that needs the
 * product before the boot prepares it (the baked-samples reader runs in the level's terrain step, before the plugin). The
 * read is held only until the hybrid boot takes it (`takeFirstPartyDescriptor`), so the page fetches `shard.json` once.
 */
export function firstPartyDescriptor(slug: string): Promise<Shardfile> {
  const options = browserShardfileOptions(productBase(slug), true), held = descriptors.get(options.base);
  if (held !== undefined) return held;
  const read = readDescriptor(options);
  descriptors.set(options.base, read);
  read.catch(() => { if (descriptors.get(options.base) === read) descriptors.delete(options.base); });
  return read;
}

/** The hybrid boot's descriptor read (`prepareHybridShard`): one a session reader started ahead (released here), else a fresh read. */
export function takeFirstPartyDescriptor(options: ProductOptions): Promise<Shardfile> {
  const held = descriptors.get(options.base);
  descriptors.delete(options.base);
  return held ?? readDescriptor(options);
}

/** The product reader for `slug`: its runtime's (`runtimeProduct`) once its hybrid was prepared, else a resident grid cell's, else null. */
export function slugRuntimeProduct(slug: string): RuntimeProduct | null {
  const source = declared.get(slug);
  return source === undefined ? admittedRuntimeProduct(slug) : runtimeProduct(source);
}

/** The reader for a trusted runtime's own declaration: its grid cell's admitted product while one is resident, else standalone. */
export function runtimeProduct(source: Shardfile): RuntimeProduct {
  const slug = source.identity.slug, admitted = admittedRuntimeProduct(slug);
  if (admitted !== null) return admitted;
  return ownedRuntimeProduct(source, new ClientAssets(source, new Map(), browserShardfileOptions(productBase(slug), true)),
    refs => Promise.resolve([...refs]));
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
 * A trusted runtime's own look materials (`look.materials`, graph entries included) compiled on its world's renderer under
 * its scope, from its product reader (`runtimeProduct`), for the meshes it still builds itself (read from its world stage).
 * `graphs` is the shard's switch (G387): true compiles its graphs whatever the Debug row says; absent, the row decides
 * (off: each graph's family preset). `ids` compiles only those catalogue entries (no props, curves or terrain maps), so a
 * runtime whose data client already draws the textured rest compiles just its own meshes' materials.
 */
export function runtimeLookMaterials(ctx: Pick<ShardContext, 'scope' | 'game'>, source: Shardfile, graphs?: boolean, ids?: readonly string[]): ReturnType<typeof clientMaterials> {
  const world = ctx.game.runtime?.world;
  if (world === null || world === undefined) throw new Error('Runtime look materials need the world stage');
  const product = runtimeProduct(source);
  let shard = product.source;
  if (ids !== undefined) {
    const { curves: _curves, ...look } = shard.look, materials = Object.fromEntries(ids.map((id) => {
      const entry = look.materials[id]; if (entry === undefined) throw new Error(`Runtime look materials: no look.materials entry ${id}`);
      return [id, entry];
    }));
    shard = { ...shard, look: { ...look, families: [], materials }, terrain: null, props: null };
  }
  return clientMaterials(shard, product.assets.retained, world.game.renderer, ctx.scope, graphs === undefined ? {} : { graphs });
}

/**
 * What its data client lends a trusted runtime (`HybridPresentation`): the built look materials by id, the drawn terrain's
 * queries and the host-state port of the look's curves. A grid region runs no data client: it lends a presentation-only
 * hybrid's drawn ground the same way (`lendHybridPresentation`) while it is resident. Null when nothing lends one (a LEGACY
 * entry, or a runtime that owns every stage). Read it from a hook that runs after the data client's world stage (the
 * hybrid's runtime world, kit or play) or the region's presentation.
 */
export function runtimePresentation(source: Shardfile): HybridPresentation | null {
  return hybridPresentation(source.identity.slug);
}
