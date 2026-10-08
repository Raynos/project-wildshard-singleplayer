import { withOwner } from '@wildshard/engine/app/ownership';
import type { Scope } from '@wildshard/engine/app/scope';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { createLevelInstallation, type LevelInstallation } from '@wildshard/engine/level/installation';
import { shardContext, type ShardContext } from '../shard/context';
import type { ShardRuntime } from '../shard/runtime';
import { ShardPlugin } from '../shard/plugin';
import type { ShardManifest } from '../shard/manifest';
import { bindScopedRuntime, createScopedRuntimeBinding, type ScopedRuntimeBinding } from '../shard/scopedRuntime';
import { RetainedRuntimeHooks } from '../shard/retainedHooks';
import { gridCells, gridHomeSim, pageGridInstance, type GridCellEvents, type GridCellRef } from '../grid/boot';
import { browserShardfileOptions, shardfileSource } from './loader';
import type { ProductOptions } from './product';
import type { ShardfileClientBindings } from './client';
import type { Shardfile } from './schema';
import { prepareTrustedRuntime, type RuntimeDeclaration, type TrustedRuntimeEntry } from './runtime';

/** A resident's data world stays alive when its independently scoped trusted play hooks leave. */
export interface HybridResident {
  readonly instance: string;
  readonly slug: string;
  readonly declaration: RuntimeDeclaration;
  readonly firstParty: boolean;
  readonly scope: Scope;
  readonly runtime: ShardRuntime;
  /** Adapted runtimes park geometry/state while their entered services and singleton bindings leave. */
  readonly retainRuntime?: boolean;
  readonly context: (scope: Scope, runtime: ShardRuntime) => {
    context: ShardContext;
    openKit: () => void;
    closeKit: () => void;
    /** Apply entered regional bindings before any trusted world hook reads ambient engine services. */
    beforeWorld?: (context: ShardContext) => Promise<void> | void;
    /** Finish the regional shell's world stage, after trusted world and before its kit registration window. */
    afterWorld?: (context: ShardContext) => Promise<void> | void;
    /** Create actual creature/equipment/play services from kit rows before trusted play. */
    afterKit?: (context: ShardContext) => Promise<void> | void;
    /** Apply continuation only after trusted play has created its complete authored encounter herd. */
    afterPlay?: (context: ShardContext) => Promise<void> | void;
  };
}
/** Runtime activation status is separate from data residency and asynchronous module preparation. */
export interface HybridRuntimeState { readonly instance: string | null; readonly ready: boolean }
/** Entered installation timing in the page performance clock; bounded diagnostics, never a readiness signal. */
export interface HybridHookTiming {
  readonly instance: string;
  readonly hook: 'beforeWorld' | 'constructor' | 'world' | 'afterWorld' | 'kit' | 'afterKit' | 'play' | 'afterPlay';
  readonly start: number;
  readonly end: number;
  readonly outcome: 'done' | 'failed';
}
/** Optional presentation boundary for grid entered stages; standalone callers keep the existing staged path. */
export interface HybridRuntimeOptions { readonly pause?: (scope: Scope) => Promise<void> }
interface ActiveRuntime {
  resident: HybridResident; scope: Scope; ready: boolean;
  retained?: { slots: ScopedRuntimeBinding; hooks: RetainedRuntimeHooks };
}

const residentScopes = new WeakMap<Scope, Scope>();

/** A transitional world's static resources persist for the resident; entered gameplay hooks retain their own scope. */
export class HybridResidentWorld<T> {
  private readonly builds = new WeakMap<Scope, Promise<T>>();
  /** Reuse one asynchronous build across entries; the supplied owner outlives each entered play scope. */
  load(context: ShardContext, build: (owner: Scope) => Promise<T>): Promise<T> {
    const owner = residentScopes.get(context.scope);
    if (owner === undefined || owner.disposed || context.scope.disposed) return Promise.reject(new Error('Missing live hybrid resident world'));
    const existing = this.builds.get(owner); if (existing !== undefined) return existing;
    const pending = Promise.resolve().then(() => {
      if (owner.disposed) throw new Error('Hybrid resident left before world construction');
      return withOwner(owner, () => build(owner));
    }).then((value) => {
      if (owner.disposed) throw new Error('Hybrid resident left during world construction');
      return value;
    });
    this.builds.set(owner, pending);
    owner.onDispose(() => { this.builds.delete(owner); });
    void pending.catch(() => { if (this.builds.get(owner) === pending) this.builds.delete(owner); });
    return pending;
  }
}

/** Reuse the ordinary registration verbs with a child owner; changing ctx.scope alone would retain parent registrations. */
export function hybridInstallation(base: ShardContext, scope: Scope, runtime: ShardRuntime): LevelInstallation & { context: ShardContext } {
  residentScopes.set(scope, base.scope);
  scope.onDispose(() => { residentScopes.delete(scope); });
  const installation = createLevelInstallation(base.app, scope, base.app.levelAdapters, () => base.progress);
  base.root.add(installation.context.root);
  // A captured callback may register after an await, when the ambient owner has already returned to the page.
  // Keep the borrowed world live, changing only the registration owner seen through this entered context.
  const worlds = new WeakMap<NonNullable<ShardRuntime['world']>, NonNullable<ShardRuntime['world']>>();
  const captured = new Proxy(runtime, { get(target, key, receiver) {
    if (key !== 'world') { const value: unknown = Reflect.get(target, key, receiver); return value; }
    const world = target.world; if (world === null) return null;
    let facade = worlds.get(world);
    if (facade === undefined) {
      const game = new Proxy(world.game, { get(host, property, owner) {
        if (property === 'registrationScope') return scope;
        const value: unknown = Reflect.get(host, property, owner); return value;
      } });
      facade = new Proxy(world, { get(host, property, owner) {
        if (property === 'game') return game;
        const value: unknown = Reflect.get(host, property, owner); return value;
      } });
      worlds.set(world, facade);
    }
    return facade;
  } });
  return { ...installation, context: shardContext(installation.context, base.manifest, { ...base.game, runtime: captured }) };
}

/** Interior events for one catalogue resident; another cell never activates its trusted hooks. */
export interface HybridCellBinding {
  readonly instance: string;
  readonly cells: Pick<GridCellEvents, 'cell' | 'onEnter' | 'onLeave'>;
  /** Hold region gameplay while entered hooks install; admission of the runtime module is a separate fence. */
  readonly readiness?: (ready: boolean) => void;
  /** Borrowed home geometry and authored state persist; transient services use entered runtime installers. */
  readonly retainHomeRuntime?: boolean;
}

interface CustomRuntime {
  plugin: ShardPlugin;
  installation: LevelInstallation & { context: ShardContext };
  active: boolean;
  ready: boolean;
  retained?: { slots: ScopedRuntimeBinding; hooks: RetainedRuntimeHooks };
}

/** Standalone staged composition keeps the resident data plugin and trusted hooks on the existing Game boot path. */
export class HybridShardPlugin extends ShardPlugin {
  private readonly data: ShardPlugin;
  private readonly Runtime: new () => ShardPlugin;
  private custom: CustomRuntime | undefined;
  private readonly binding: HybridCellBinding | undefined;
  private generation = 0;
  constructor(data: ShardPlugin, Runtime: new () => ShardPlugin, binding?: HybridCellBinding) {
    super(); this.data = data; this.Runtime = Runtime; this.binding = binding;
  }
  override async world(ctx: ShardContext): Promise<void> {
    await this.data.world?.(ctx);
    if (ctx.scope.disposed) throw new Error('Hybrid world was unloaded during admission');
    if (this.binding !== undefined) {
      const binding = this.binding;
      ctx.scope.onDispose(binding.cells.onLeave((cell) => {
        if (cell.instance === binding.instance) this.leaveRuntime();
      }));
    }
    await this.runtimeWorld(ctx);
  }
  private leaveRuntime(): void {
    this.generation++;
    const custom = this.custom; if (custom === undefined) return;
    if (custom.retained === undefined || !custom.ready) { custom.installation.context.scope.dispose(); return; }
    custom.active = false; this.binding?.readiness?.(false);
    try { custom.retained.hooks.deactivate(); } finally { custom.retained.slots.deactivate(); }
  }
  private async runtimeWorld(ctx: ShardContext): Promise<void> {
    if (this.binding !== undefined && this.binding.cells.cell?.instance !== this.binding.instance) throw new Error('Trusted hooks require the entered cell interior');
    this.generation++;
    const existing = this.custom;
    if (existing?.retained !== undefined && existing.ready) {
      const retained = existing.retained;
      retained.slots.activate();
      try { retained.hooks.activate(); existing.active = true; }
      catch (error) { retained.slots.deactivate(); throw error; }
      return;
    }
    const parent = ctx.game.runtime; if (parent === undefined) throw new Error('Hybrid requires the normal runtime host');
    const scope = ctx.scope.child('runtime.play');
    try {
      const slots = this.binding?.retainHomeRuntime === true ? createScopedRuntimeBinding(parent, scope) : undefined;
      slots?.activate();
      const runtime = slots?.runtime ?? bindScopedRuntime(parent, scope), base = hybridInstallation(ctx, scope, runtime);
      const hooks = slots === undefined ? undefined : new RetainedRuntimeHooks(base.context);
      const installation = hooks === undefined ? base : { ...base, context: hooks.context };
      const plugin = withOwner(scope, () => new this.Runtime());
      const custom: CustomRuntime = { plugin, installation, active: true, ready: false,
        ...(slots === undefined || hooks === undefined ? {} : { retained: { slots, hooks } }),
      }; this.custom = custom;
      scope.onDispose(() => {
        if (this.custom === custom) { this.custom = undefined; this.binding?.readiness?.(false); }
      });
      this.binding?.readiness?.(false);
      await withOwner(scope, () => plugin.world?.(installation.context));
      if (scope.disposed) throw new Error('Hybrid runtime left during world installation');
    } catch (error) {
      try { scope.dispose(); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'Hybrid world installation and cleanup failed', { cause: cleanup }); }
      throw error;
    }
  }
  override async kit(ctx: ShardContext): Promise<void> {
    await this.data.kit?.(ctx);
    await this.runtimeKit();
  }
  private async runtimeKit(): Promise<void> {
    const custom = this.custom; if (custom === undefined || !custom.active) throw new Error('Hybrid runtime world is not installed');
    if (custom.retained !== undefined && custom.ready) return;
    custom.installation.openKit();
    try { await withOwner(custom.installation.context.scope, () => custom.plugin.kit?.(custom.installation.context)); }
    finally { custom.installation.closeKit(); }
    if (custom.installation.context.scope.disposed) throw new Error('Hybrid runtime left during kit installation');
  }
  override async play(ctx: ShardContext): Promise<void> {
    await this.data.play?.(ctx);
    await this.runtimePlay();
    // The shell creates creature motors between kit and play. Release their trusted dependants before those later
    // parent registrations unwind, rather than relying on the child's early world-stage insertion order.
    ctx.scope.onDispose(() => { this.generation++; this.custom?.installation.context.scope.dispose(); });
    const binding = this.binding;
    if (binding !== undefined) ctx.scope.onDispose(binding.cells.onEnter((cell) => {
      if (cell.instance !== binding.instance || this.custom?.active === true) return;
      void this.reenter(ctx);
    }));
  }
  private async reenter(ctx: ShardContext): Promise<void> {
    const generation = this.generation + 1;
    try { await this.runtimeWorld(ctx); await this.runtimeKit(); await this.runtimePlay(); }
    catch (error) {
      if (generation !== this.generation || ctx.scope.disposed) return;
      let failure = error;
      try { this.custom?.installation.context.scope.dispose(); }
      catch (cleanup) { failure = new AggregateError([error, cleanup], 'Hybrid activation and cleanup failed'); }
      ctx.app.events.emit('fault', { source: 'hybrid.runtime', message: failure instanceof Error ? failure.message : String(failure), error: failure });
    }
  }
  private async runtimePlay(): Promise<void> {
    const custom = this.custom; if (custom === undefined || !custom.active) throw new Error('Hybrid runtime kit is not installed');
    if (custom.retained !== undefined && custom.ready) { this.binding?.readiness?.(true); return; }
    await withOwner(custom.installation.context.scope, () => custom.plugin.play?.(custom.installation.context));
    if (custom.installation.context.scope.disposed) throw new Error('Hybrid runtime left during play installation');
    custom.ready = true; this.binding?.readiness?.(true);
  }
}

/** Admit declared data and trusted hooks; catalogue placement and cell activation stay in the game layer. */
export async function prepareHybridShard(source: Shardfile, options: ProductOptions | { firstParty: true },
  bindings: Omit<ShardfileClientBindings, 'instance' | 'trustedRuntime'> & {
    /** The game adapter forwards the page owner; the shard need not read or own another service. */
    readonly residencyContext?: Pick<ShardContext, 'game'>;
    /** Retain an adapted borrowed home runtime across road visits; neighbours remain fenced. */
    readonly retainHomeRuntime?: boolean;
  },
  entries: readonly TrustedRuntimeEntry[],
  debug?: { context: ShardContext; row: Omit<Parameters<ShardContext['debugRow']>[0], 'change'> }): Promise<ShardPlugin> {
  if (source.runtime === null) throw new Error('Hybrid requires a declared runtime entry');
  if (debug !== undefined) {
    const choice = { hybrid: false };
    const adapters = debug.context;
    adapters.debugRow({ ...debug.row, change: (value) => { choice.hybrid = value === 'on'; } });
    if (!choice.hybrid) {
      const Runtime = await prepareTrustedRuntime(source.runtime, source.identity.slug, options.firstParty, entries);
      return new Runtime();
    }
  }
  const { residencyContext, retainHomeRuntime, ...providedBindings } = bindings;
  const residency = residencyContext?.game.residency;
  if (residency !== undefined && providedBindings.residency !== undefined && residency !== providedBindings.residency) {
    throw new Error('Hybrid installation and bindings must share one page residency owner');
  }
  const clientBindings = residency === undefined ? providedBindings : { ...providedBindings, residency };
  const productOptions = 'base' in options ? options : browserShardfileOptions(
    new URL(`shardfiles/${source.identity.slug}/`, document.baseURI || location.href).href, options.firstParty);
  const gridInstance = pageGridInstance(), instance = gridInstance ?? source.identity.slug;
  // The data client announces only when it will actually build a simulation. An empty trusted transition runs its
  // legacy gameplay directly and has no handoff; promising one would hold the reveal until its safety ceiling.
  const onSimulationExpected = (): void => { clientBindings.onSimulationExpected?.(); if (gridInstance !== null) gridHomeSim.expect(); };
  // in a grid page the restored home simulation goes to the live grid owner (its freeze fence gates the existing driver)
  const onSimulation: ShardfileClientBindings['onSimulation'] = gridInstance === null ? clientBindings.onSimulation : (binding) => {
    clientBindings.onSimulation?.(binding);
    gridHomeSim.offer({ setActive: binding.setActive, checkpoint: binding.checkpoint, suppressCheckpoint: binding.suppressCheckpoint, disposed: () => binding.scope.disposed,
      ...(binding.residency === undefined ? {} : { residency: binding.residency }),
    });
  };
  const data = await shardfileSource(source, productOptions, { ...clientBindings, instance, trustedRuntime: true, audioOwner: clientBindings.audioOwner ?? 'runtime', worldOwner: clientBindings.worldOwner ?? 'runtime', onSimulationExpected, ...(onSimulation === undefined ? {} : { onSimulation }) });
  const load = data.load; if (load === undefined) throw new Error('Missing admitted hybrid data plugin');
  const [{ default: Data }, Runtime] = await Promise.all([load(), prepareTrustedRuntime(source.runtime, source.identity.slug, productOptions.firstParty, entries)]);
  return new HybridShardPlugin(new Data(), Runtime, gridInstance === null ? undefined : { instance, cells: gridCells, ...(retainHomeRuntime === undefined ? {} : { retainHomeRuntime }) });
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
  private readonly retained = new Map<string, ActiveRuntime>();
  private active: ActiveRuntime | undefined;
  private generation = 0;
  private disposed = false;
  private currentHook: Readonly<Pick<HybridHookTiming, 'instance' | 'hook' | 'start'>> | null = null;
  private readonly completedHooks: HybridHookTiming[] = [];
  constructor(residents: ReadonlyMap<string, HybridResident>, entries: readonly TrustedRuntimeEntry[], scope: Scope, private readonly options: HybridRuntimeOptions = {}) {
    this.residents = residents; this.entries = entries;
    scope.onDispose(() => {
      this.disposed = true; this.leave();
      for (const active of this.retained.values()) active.scope.dispose();
      this.retained.clear(); this.prepared.clear();
    });
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
  private async stage<T>(scope: Scope, instance: string, hook: HybridHookTiming['hook'], run: () => T | Promise<T>): Promise<T> {
    const current = Object.freeze({ instance, hook, start: diagnosticNow() });
    this.currentHook = current;
    let outcome: HybridHookTiming['outcome'] = 'failed';
    let value: T;
    try { value = await run(); outcome = 'done'; }
    finally {
      this.completedHooks.push(Object.freeze({ ...current, end: diagnosticNow(), outcome }));
      if (this.completedHooks.length > 32) this.completedHooks.shift();
      if (this.currentHook === current) this.currentHook = null;
    }
    if (this.options.pause !== undefined) await this.options.pause(scope);
    if (scope.disposed) throw new Error('Hybrid runtime left between entered stages');
    return value;
  }
  /** Correlate long-task intervals with the current hook and the last 32 completed hooks, including failed installs. */
  timings(): { readonly current: Readonly<Pick<HybridHookTiming, 'instance' | 'hook' | 'start'>> | null; readonly completed: readonly HybridHookTiming[] } {
    return { current: this.currentHook, completed: [...this.completedHooks] };
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
      const parked = this.retained.get(cell.instance);
      if (parked !== undefined && !parked.scope.disposed && parked.retained !== undefined) {
        parked.retained.slots.activate();
        try { parked.retained.hooks.activate(); }
        catch (error) { parked.retained.slots.deactivate(); throw error; }
        this.active = parked; return true;
      }
      const Plugin = await this.prepare(cell.instance);
      if (generation !== this.generation || resident.scope.disposed) return false;
      const scope = resident.scope.child(`runtime:${cell.instance}`), active: ActiveRuntime = { resident, scope, ready: false };
      this.active = active;
      scope.onDispose(() => { if (this.active === active) this.active = undefined; if (this.retained.get(cell.instance) === active) this.retained.delete(cell.instance); });
      const slots = resident.retainRuntime === true ? createScopedRuntimeBinding(resident.runtime, scope) : undefined;
      slots?.activate();
      const runtime = slots?.runtime ?? bindScopedRuntime(resident.runtime, scope), installation = resident.context(scope, runtime);
      residentScopes.set(scope, resident.scope);
      scope.onDispose(() => { residentScopes.delete(scope); });
      const hooks = slots === undefined ? undefined : new RetainedRuntimeHooks(installation.context);
      if (slots !== undefined && hooks !== undefined) active.retained = { slots, hooks };
      const context = hooks?.context ?? installation.context;
      const live = (): boolean => !scope.disposed && this.active === active && generation === this.generation;
      await this.stage(scope, cell.instance, 'beforeWorld', () => withOwner(scope, () => installation.beforeWorld?.(context))); if (!live()) return false;
      const plugin = await this.stage(scope, cell.instance, 'constructor', () => withOwner(scope, () => new Plugin()));
      if (!live()) return false;
      await this.stage(scope, cell.instance, 'world', () => withOwner(scope, () => plugin.world?.(context))); if (!live()) return false;
      await this.stage(scope, cell.instance, 'afterWorld', () => withOwner(scope, () => installation.afterWorld?.(context))); if (!live()) return false;
      installation.openKit();
      try { await this.stage(scope, cell.instance, 'kit', () => withOwner(scope, () => plugin.kit?.(context))); } finally { installation.closeKit(); }
      if (!live()) return false;
      await this.stage(scope, cell.instance, 'afterKit', () => withOwner(scope, () => installation.afterKit?.(context))); if (!live()) return false;
      await this.stage(scope, cell.instance, 'play', () => withOwner(scope, () => plugin.play?.(context))); if (!live()) return false;
      await this.stage(scope, cell.instance, 'afterPlay', () => withOwner(scope, () => installation.afterPlay?.(context))); if (!live()) return false;
      active.ready = true;
      if (active.retained !== undefined) this.retained.set(cell.instance, active);
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      try { this.leave(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Hybrid activation and cleanup failed', { cause: cleanup }); }
      throw error;
    }
  }
  /** Remove only play resources and runtime aliases; the admitted shardfile world, tiles and frozen simulation remain. */
  leave(): void {
    this.generation++; const active = this.active; this.active = undefined;
    if (active === undefined) return;
    if (active.retained === undefined || !active.ready) { active.scope.dispose(); return; }
    try { active.retained.hooks.deactivate(); } finally { active.retained.slots.deactivate(); }
  }
  /** Admission fences can observe whether the current inside-cell runtime finished its trusted stages. */
  state(): HybridRuntimeState { return { instance: this.active?.resident.instance ?? null, ready: this.active?.ready ?? false }; }
}

/** Consume the grid client's interior events; a late subscriber installs the current cell, never its neighbours. */
export function installHybridRuntime(cells: Pick<GridCellEvents, 'onEnter' | 'onLeave'>, session: HybridRuntimeSession,
  scope: Scope, report: (error: unknown) => void): void {
  scope.onDispose(cells.onLeave(() => { try { session.leave(); } catch (error) { report(error); } }));
  scope.onDispose(cells.onEnter((cell) => { void session.enter(cell).catch(report); }));
}
