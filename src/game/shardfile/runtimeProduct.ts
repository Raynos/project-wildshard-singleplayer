import { loadPaintedTexture, type PaintedSampler, type ModelLibrary } from '../plugin/geometry';
import type { Material, Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { ClientAssets } from './clientAssets';
import { ktx2TranscodeSupport } from '@wildshard/engine/core/ktx2';
import { boundedResponse, browserContentHash, browserProductCache, type AdmittedProduct, type ProductOptions } from './product';
import { bindRuntimeProps, bindRuntimeTerrain, type RuntimePropsPorts, type RuntimeTerrain, type RuntimeTerrainPorts } from './runtimeWorld';
import { hybridPresentation, type HybridPresentation } from './hybridPresentation';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { SHARDFILE_ADMISSION_LIMITS } from '@wildshard/format/admissionLimits';
import { runtimeBoundWorldFiles } from '../plugin/headless';
import { clientMaterials } from './clientMaterials';
import { graphFileTextureRefs, materialTextureRefs } from '@wildshard/format/materials';
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

/** Browser connectivity and visited-product storage feed the same admission path as headless validation. */
export function browserShardfileOptions(base: string, firstParty = false): ProductOptions {
  return { base, firstParty, textures: ktx2TranscodeSupport(), offline: !navigator.onLine, hash: browserContentHash, fetch: (url) => fetch(url),
    ...(typeof caches === 'undefined' ? {} : { cache: browserProductCache(caches) }),
  };
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
export async function runtimeLookMaterials(ctx: Pick<ShardContext, 'scope' | 'game'>, source: Shardfile, graphs?: boolean, ids?: readonly string[]): ReturnType<typeof clientMaterials> {
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
  const assets = new Map(product.assets.retained);
  const files = Object.values(shard.look.materials).flatMap(entry => entry.family === 'graph' && 'file' in entry ? [entry.file] : []);
  for (const ref of files) assets.set(ref, await product.assets.read(ref));
  for (const ref of new Set([...materialTextureRefs(shard.look.materials), ...graphFileTextureRefs(shard.look.materials, hash => assets.get(hash))])) assets.set(ref, await product.assets.read(ref));
  if (ctx.scope.disposed) throw new Error('Runtime look scope unloaded while reading materials');
  return clientMaterials(shard, assets, world.game.renderer, ctx.scope, { trustedGraphs: true, ...(graphs === undefined ? {} : { graphs }) });
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

/** Ordered preparation rows for existing hybrid world textures and graph materials. */
export interface ClientWorldPreparation {
  readonly textures?: readonly { readonly id: string; readonly url: string; readonly name: string; readonly warn: string; readonly sampler?: PaintedSampler; readonly phase?: number }[];
  readonly materials?: readonly string[];
  readonly requiredMaterials?: readonly string[];
  /**
   * A prepared texture (`texture`, a `textures` id) laid on a compiled look material (`material`) as its bump, read on UV set
   * `channel` (default 0) at `scale`: a graph cannot output a normal, so a painted relief (a tower's stone courses) rides the
   * material's own bump slot, and every mesh-map binding of that look inherits it. A missing texture or a material without
   * a bump slot (a family preset with graphs off) keeps the look unbumped.
   */
  readonly bumps?: readonly { readonly material: string; readonly texture: string; readonly channel?: number; readonly scale: number }[];
}
/** Prepare borrowed world assets under their existing scope, never installing another host. */
export async function prepareClientWorld(ctx: Parameters<typeof runtimeLookMaterials>[0], source: Shardfile, rows: ClientWorldPreparation,
  library?: Pick<ModelLibrary<string, string>, 'bindLooks' | 'material' | 'geometry'>): Promise<Awaited<ReturnType<typeof runtimeLookMaterials>> & {
  readonly painted: ReadonlyMap<string, Texture | null>; readonly material: (id: string) => Material;
}> {
  const textures = rows.textures ?? [], required = rows.requiredMaterials ?? [], bumps = rows.bumps ?? [];
  if (textures.length > 64 || required.length > 64 || bumps.length > 16 || bumps.some(row => ![0, 1, 2, 3].includes(row.channel ?? 0) || !Number.isFinite(row.scale)) || new Set(textures.map(row => row.id)).size !== textures.length
    || textures.some(row => !/^[a-z][a-zA-Z0-9.:-]{0,127}$/u.test(row.id) || !Number.isSafeInteger(row.phase ?? 0) || (row.phase ?? 0) < 0 || (row.phase ?? 0) > 7)) throw new Error('Invalid bounded client world preparation');
  const painted = new Map<string, Texture | null>();
  for (const phase of [...new Set(textures.map(row => row.phase ?? 0))].sort((a, b) => a - b)) {
    const group = textures.filter(row => (row.phase ?? 0) === phase);
    const loaded = await Promise.all(group.map(row => loadPaintedTexture(row.url, row.name, row.warn, row.sampler)));
    if (ctx.scope.disposed) { for (const texture of loaded) texture?.dispose(); throw new Error('Client world preparation left its owner'); }
    for (const [index, row] of group.entries()) { const texture = loaded[index] ?? null; if (texture !== null) ctx.scope.own(texture); painted.set(row.id, texture); }
  }
  const compiled = await runtimeLookMaterials(ctx, source, true, rows.materials);
  const material = (id: string): Material => { const value = compiled.materials.get(id); if (value === undefined) throw new Error(`Missing prepared world material ${id}`); return value; };
  for (const id of required) material(id);
  for (const row of bumps) {
    const relief = painted.get(row.texture) ?? null, target = compiled.materials.get(row.material);
    if (relief === null || target === undefined || !('bumpMap' in target)) continue;
    const map = ctx.scope.own(relief.clone()); map.channel = row.channel ?? 0;
    Object.assign(target, { bumpMap: map, bumpScale: row.scale }); target.needsUpdate = true;
  }
  library?.bindLooks(ctx.scope, compiled);
  return { ...compiled, painted, material };
}
