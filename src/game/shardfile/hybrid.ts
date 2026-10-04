import { withOwner } from '@wildshard/engine/app/ownership';
import type { Scope } from '@wildshard/engine/app/scope';
import { createLevelInstallation, type LevelInstallation } from '@wildshard/engine/level/installation';
import { shardContext, type ShardContext } from '../shard/context';
import type { ShardRuntime } from '../shard/runtime';
import { ShardPlugin } from '../shard/plugin';
import type { ShardManifest } from '../shard/manifest';
import { bindScopedRuntime } from '../shard/scopedRuntime';
import type { GridCellEvents, GridCellRef } from '../grid/boot';
import { prepareTrustedRuntime, type RuntimeDeclaration, type TrustedRuntimeEntry } from './runtime';

/** A resident's data world stays alive when its independently scoped trusted play hooks leave. */
export interface HybridResident {
  readonly instance: string;
  readonly slug: string;
  readonly declaration: RuntimeDeclaration;
  readonly firstParty: boolean;
  readonly scope: Scope;
  readonly runtime: ShardRuntime;
  readonly context: (scope: Scope, runtime: ShardRuntime) => {
    context: ShardContext;
    openKit: () => void;
    closeKit: () => void;
  };
}
/** Runtime activation status is separate from data residency and asynchronous module preparation. */
export interface HybridRuntimeState { readonly instance: string | null; readonly ready: boolean }
interface ActiveRuntime { resident: HybridResident; scope: Scope; ready: boolean }

/** Reuse the ordinary registration verbs with a child owner; changing ctx.scope alone would retain parent registrations. */
export function hybridInstallation(base: ShardContext, scope: Scope, runtime: ShardRuntime): LevelInstallation & { context: ShardContext } {
  const installation = createLevelInstallation(base.app, scope, base.app.levelAdapters, () => base.progress);
  base.root.add(installation.context.root);
  return { ...installation, context: shardContext(installation.context, base.manifest, { ...base.game, runtime }) };
}

/** Standalone staged composition keeps the resident data plugin and trusted hooks on the existing Game boot path. */
export class HybridShardPlugin extends ShardPlugin {
  private readonly data: ShardPlugin;
  private readonly Runtime: new () => ShardPlugin;
  private custom: { plugin: ShardPlugin; installation: LevelInstallation & { context: ShardContext } } | undefined;
  constructor(data: ShardPlugin, Runtime: new () => ShardPlugin) { super(); this.data = data; this.Runtime = Runtime; }
  override async world(ctx: ShardContext): Promise<void> {
    await this.data.world?.(ctx);
    if (ctx.scope.disposed) throw new Error('Hybrid world was unloaded during admission');
    const parent = ctx.game.runtime; if (parent === undefined) throw new Error('Hybrid requires the normal runtime host');
    const scope = ctx.scope.child('runtime.play'), runtime = bindScopedRuntime(parent, scope);
    const installation = hybridInstallation(ctx, scope, runtime), plugin = withOwner(scope, () => new this.Runtime());
    this.custom = { plugin, installation };
    scope.onDispose(() => { this.custom = undefined; });
    await withOwner(scope, () => plugin.world?.(installation.context));
    if (scope.disposed) throw new Error('Hybrid runtime left during world installation');
  }
  override async kit(ctx: ShardContext): Promise<void> {
    await this.data.kit?.(ctx);
    const custom = this.custom; if (custom === undefined) throw new Error('Hybrid runtime world is not installed');
    custom.installation.openKit();
    try { await withOwner(custom.installation.context.scope, () => custom.plugin.kit?.(custom.installation.context)); }
    finally { custom.installation.closeKit(); }
    if (custom.installation.context.scope.disposed) throw new Error('Hybrid runtime left during kit installation');
  }
  override async play(ctx: ShardContext): Promise<void> {
    await this.data.play?.(ctx);
    const custom = this.custom; if (custom === undefined) throw new Error('Hybrid runtime kit is not installed');
    await withOwner(custom.installation.context.scope, () => custom.plugin.play?.(custom.installation.context));
    if (custom.installation.context.scope.disposed) throw new Error('Hybrid runtime left during play installation');
  }
}

/** Keep a transitional shard's existing standalone presentation while admitting data and resolving its declared code separately. */
export async function hybridShardManifest(data: ShardManifest, presentation: ShardManifest, declaration: RuntimeDeclaration,
  firstParty: boolean, entries: readonly TrustedRuntimeEntry[]): Promise<ShardManifest> {
  if (data.slug.replace(/^_/u, '') !== presentation.slug.replace(/^_/u, '')) throw new Error('Hybrid data and presentation must name the same shard');
  const load = data.load; if (load === undefined) throw new Error('Hybrid requires an admitted data plugin');
  const [{ default: Data }, Runtime] = await Promise.all([load(), prepareTrustedRuntime(declaration, data.slug, firstParty, entries)]);
  return { ...presentation, load: () => Promise.resolve({ default: class extends HybridShardPlugin {
    constructor() { super(new Data(), Runtime); }
  } }) };
}

/** Only the entered cell owns trusted hooks. Prefetch imports the declared chunk without constructing or running it. */
export class HybridRuntimeSession {
  private readonly residents: ReadonlyMap<string, HybridResident>;
  private readonly entries: readonly TrustedRuntimeEntry[];
  private readonly prepared = new Map<string, Promise<new () => ShardPlugin>>();
  private active: ActiveRuntime | undefined;
  private generation = 0;
  private disposed = false;
  constructor(residents: ReadonlyMap<string, HybridResident>, entries: readonly TrustedRuntimeEntry[], scope: Scope) {
    this.residents = residents; this.entries = entries;
    scope.onDispose(() => { this.disposed = true; this.leave(); this.prepared.clear(); });
  }
  /** Module admission can run while a neighbour is frozen; no constructor or world/kit/play hook runs here. */
  prepare(instance: string): Promise<new () => ShardPlugin> {
    if (this.disposed) return Promise.reject(new Error('Hybrid session is disposed'));
    const resident = this.residents.get(instance);
    if (resident === undefined) return Promise.reject(new Error('Missing hybrid resident'));
    const prior = this.prepared.get(instance); if (prior !== undefined) return prior;
    const prepared = prepareTrustedRuntime(resident.declaration, resident.slug, resident.firstParty, this.entries);
    this.prepared.set(instance, prepared);
    void prepared.catch(() => { if (this.prepared.get(instance) === prepared) this.prepared.delete(instance); });
    return prepared;
  }
  /** Called by the cell-interior producer, after leaving the old cell. Late hook completions cannot publish another scope. */
  async enter(cell: GridCellRef): Promise<boolean> {
    if (this.disposed) throw new Error('Hybrid session is disposed');
    const resident = this.residents.get(cell.instance);
    if (resident === undefined) throw new Error('Missing hybrid resident');
    const { slug: identity } = resident, { slug: cellIdentity } = cell;
    if (identity !== cellIdentity) throw new Error('Hybrid cell must match its catalogue instance and shard');
    if (this.active?.resident === resident) return this.active.ready;
    this.leave(); const generation = this.generation;
    try {
      const Plugin = await this.prepare(cell.instance);
      if (generation !== this.generation || resident.scope.disposed) return false;
      const scope = resident.scope.child(`runtime:${cell.instance}`), active = { resident, scope, ready: false };
      this.active = active;
      scope.onDispose(() => { if (this.active === active) this.active = undefined; });
      const runtime = bindScopedRuntime(resident.runtime, scope), installation = resident.context(scope, runtime);
      const context = installation.context, plugin = withOwner(scope, () => new Plugin());
      const live = (): boolean => !scope.disposed && this.active === active && generation === this.generation;
      await withOwner(scope, () => plugin.world?.(context)); if (!live()) return false;
      installation.openKit();
      try { await withOwner(scope, () => plugin.kit?.(context)); } finally { installation.closeKit(); }
      if (!live()) return false;
      await withOwner(scope, () => plugin.play?.(context)); if (!live()) return false;
      active.ready = true; return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      try { this.leave(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Hybrid activation and cleanup failed', { cause: cleanup }); }
      throw error;
    }
  }
  /** Remove only play resources and runtime aliases; the admitted shardfile world, tiles and frozen simulation remain. */
  leave(): void { this.generation++; const active = this.active; this.active = undefined; active?.scope.dispose(); }
  /** Admission fences can observe whether the current inside-cell runtime finished its trusted stages. */
  state(): HybridRuntimeState { return { instance: this.active?.resident.instance ?? null, ready: this.active?.ready ?? false }; }
}

/** Consume the grid client's interior events; a late subscriber installs the current cell, never its neighbours. */
export function installHybridRuntime(cells: Pick<GridCellEvents, 'onEnter' | 'onLeave'>, session: HybridRuntimeSession,
  scope: Scope, report: (error: unknown) => void): void {
  scope.onDispose(cells.onLeave(() => { try { session.leave(); } catch (error) { report(error); } }));
  scope.onDispose(cells.onEnter((cell) => { void session.enter(cell).catch(report); }));
}
