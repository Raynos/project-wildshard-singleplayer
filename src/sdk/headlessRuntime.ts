import { registerNativeQuestInputs } from '@wildshard/game/quest/nativeInputs';
import { hasDeclaredClientPage } from '@wildshard/format/runtimeBinds';
import { parseNativeRuntimePlan } from '@wildshard/format/nativeRuntimePlan';
import { MoverScriptDriver, type MoverRuntime } from '@wildshard/game/plugin/mover';
import { installCableModes } from '@wildshard/engine/player/modes';
import { createNativeCombatFrame, type NativeCombatFrame } from '@wildshard/game/plugin/nativeItems';
import { prepareRuntimePlan, ledgerPorts, pickCommands, type NativeSweptMeleeInput } from '@wildshard/game/plugin/simulation';
import { createSimHost, type SimHost, type SimHostPorts, type SimLevel } from '@wildshard/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost, type SimSnapshot } from '@wildshard/engine/sim/snapshot';
import type { Rapier } from '@wildshard/engine/physics/rapier';
import type { Shardfile } from './shardfile';
import { simPlayerCommand, type HeadlessCommand, type HeadlessEffect } from './tickProtocol';
import type { TickWorkerAdapter } from './tickWorkerLoop';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { prepareProductRuntimePlan } from '@wildshard/game/shardfile/nativePlan';
import { prepareHeadlessAssembly, type HeadlessAssemblyModules } from './headlessAssembly';

/** Explicit trusted-code entry, chosen by the caller, never taken from an authored shardfile or asset URL. */
export interface TrustedHeadlessRuntime { module: string }
/** The same admitted bytes and native physics implementation used by the ordinary headless worker. */
export interface HeadlessRuntimePreparation { shard: Shardfile; assets: ReadonlyMap<string, Uint8Array>; rapier: Rapier; readonly product: ShardProduct }
/** Build workers carry verified native sections before any output exists.
 * Existing native callers may instead supply or explicitly load their built product. */
export type HeadlessRuntimeInput = Omit<HeadlessRuntimePreparation, 'product'> & { readonly product?: ShardProduct; readonly sections?: ReadonlyMap<string, unknown> };
/** Current tick inputs and buffered effects; only a completed tick publishes them to the parent. */
export interface HeadlessRuntimeInstallation {
  readonly combat?: NativeCombatFrame;
  restoring: boolean;
  /** Strictly decoded continuation; reinstall its dynamic actor roster before native restore. Never step here. */
  snapshot?: Readonly<SimSnapshot>;
  commands: () => readonly HeadlessCommand[];
  emit: (effect: HeadlessEffect) => void;
}
/** Tick readers borrow the current admitted tape; no input state or simulation clock is retained. */
export interface HeadlessCommandPorts {
  readonly ledger: ReturnType<typeof ledgerPorts>;
  readonly shots: () => readonly string[];
  readonly heavy: () => NonNullable<Extract<HeadlessCommand, { kind: 'player' }>['heavy']> | null;
  readonly scripts: (ids?: readonly string[]) => () => readonly Extract<HeadlessCommand, { kind: 'script' }>[];
  readonly lastScript: <T extends number | null>(id: string, fallback: T) => number | T;
  readonly melee: () => NativeSweptMeleeInput;
  readonly walk: (speed: number) => { x: number; z: number };
}
/** Bind existing tick commands and ledger effects once at installation. Shots keep every attack; heavy picks the first
 * held command; melee/walk take the last player command, including an empty release. Script values use the last match.
 * Readers resample the current tape on every call, refuse overflow, and preserve tape order. Filtered lists and melee
 * input are borrowed scratch values, consumed immediately by the native owner rather than saved between ticks. */
export function bindHeadlessCommands(context: Pick<HeadlessRuntimeInstallation, 'commands' | 'emit'>, host?: SimHost): HeadlessCommandPorts {
  const commands = (): readonly HeadlessCommand[] => {
    const tape = context.commands();
    if (tape.length > 1024) throw new RangeError('Tick commands exceed the protocol allowance');
    return tape;
  };
  const player = (): Extract<HeadlessCommand, { kind: 'player' }> | undefined => {
    let last: Extract<HeadlessCommand, { kind: 'player' }> | undefined;
    for (const command of commands()) if (command.kind === 'player') last = command;
    return last;
  };
  const input: { attack: string | null; heavy: boolean; heavyTarget: string | null } = { attack: null, heavy: false, heavyTarget: null };
  const bound: HeadlessCommandPorts = {
    ledger: ledgerPorts(context.emit),
    shots: pickCommands(commands, command => command.kind === 'player' ? command.attack?.targetId : undefined),
    heavy: () => { for (const command of commands()) if (command.kind === 'player' && command.heavy !== undefined) return command.heavy; return null; },
    scripts: ids => pickCommands(commands, command => command.kind === 'script' && (ids === undefined || ids.includes(command.actorId)) ? command : undefined),
    lastScript: <T extends number | null>(id: string, fallback: T): number | T => {
      let result: number | T = fallback;
      for (const command of commands()) if (command.kind === 'script' && command.actorId === id) result = command.value;
      return result;
    },
    melee: () => {
      const current = player(); input.attack = current?.attack?.targetId ?? null;
      input.heavy = current?.heavy !== undefined; input.heavyTarget = current?.heavy?.targetId ?? null; return input;
    },
    walk: speed => {
      const current = player(), x = current?.moveX ?? 0, z = current?.moveZ ?? 0, length = Math.hypot(x, z), scale = length > 1 ? speed / length : speed;
      return { x: x * scale, z: z * scale };
    },
  };
  if (host !== undefined) registerNativeQuestInputs(host, { scripts: bound.scripts(), walk: bound.walk, ledger: bound.ledger });
  return bound;
}

/** A renderer-free native runtime. Install is synchronous and registers every mutable controller via host.onStep.
 * Restore calls install before applying the complete native snapshot. It must not step or award anything at install.
 * Optional entry walks remain independent of the live headless simulation.
 */
export interface HeadlessRuntimePlan {
  level: SimLevel;
  ports?: Pick<SimHostPorts, 'ground' | 'heightAt' | 'groundResolution'>;
  install: (host: SimHost, context: HeadlessRuntimeInstallation) => void;
  proveEntries?: (host: SimHost) => { lanes: number; steps: number; liftRides?: number; liftCalls?: number; portalTransfers?: number };
}
/** Export this named factory from the explicitly selected trusted entry. No browser globals or renderer imports. */
export type PrepareHeadlessRuntime = (context: HeadlessRuntimePreparation) => HeadlessRuntimePlan | Promise<HeadlessRuntimePlan>;

/** Restrict trusted code selection to a concrete local ESM entry; data-only clients never invoke this path. */
export function trustedHeadlessModule(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'file:' || url.search !== '' || url.hash !== '') throw new Error('Trusted runtime requires a local file module URL');
  return url.href;
}
function hasFactory(value: unknown): value is { prepareHeadlessRuntime: PrepareHeadlessRuntime } {
  return typeof value === 'object' && value !== null && 'prepareHeadlessRuntime' in value && typeof value.prepareHeadlessRuntime === 'function';
}
function hasAssemblyModules(value: unknown): value is { headlessModules: HeadlessAssemblyModules } {
  if (value === null || typeof value !== 'object' || !('headlessModules' in value)) return false;
  const modules: unknown = value.headlessModules;
  return modules !== null && typeof modules === 'object' && !Array.isArray(modules)
    && Object.values(modules).every((module: unknown) => module !== null && typeof module === 'object' && !Array.isArray(module));
}
/**
 * One owned, renderer-free trusted world: the explicitly selected entry's plan installed into one native host. The worker's
 * tick adapter (`createTrustedHeadlessAdapter`) and the grid's server-side admission (a `GridSimulation` `load` port,
 * `test/proof/<slug>/grid-ready.mjs`) both compose exactly this, so an admitted region runs the same runtime, controllers
 * and continuation as the worker.
 * - `host` is owned and stepped by its owner (the worker's `step`, or `GridSimulation.step` while the region is current);
 *   it is never embedded and owns its player motor until a grid detaches it.
 * - `lend(commands)` hands the runtime the coming tick's tick-protocol commands (`HeadlessRuntimeInstallation.commands`)
 *   and opens a fresh effect buffer; `effects` reads what the runtime emitted since that lend.
 * - `step(commands)` is the worker's fenced tick: lend, the last `player` command drives the host, and a nonfinite body
 *   refuses the tick.
 */
export interface TrustedHeadlessResident {
  readonly host: SimHost;
  lend: (commands: readonly HeadlessCommand[]) => void;
  readonly effects: readonly HeadlessEffect[];
  step: (commands: readonly HeadlessCommand[]) => void;
  proveEntries: () => ReturnType<NonNullable<HeadlessRuntimePlan['proveEntries']>>;
  dispose: () => void;
}
/** Resolve the built native plan when entry is absent. An explicitly supplied
 * legacy entry keeps its existing local-module law; missing declarations never
 * fall back to a shard source path. Both paths verify product/level identity. */
export async function prepareNativeRuntime(provided: HeadlessRuntimeInput, entry?: TrustedHeadlessRuntime): Promise<HeadlessRuntimePlan> {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(provided.shard.identity.slug)) throw new Error('Invalid native product identity');
  let plan: HeadlessRuntimePlan, source = provided.shard;
  if (entry === undefined && provided.sections !== undefined) {
    const declaration = parseNativeRuntimePlan(provided.sections.get('sim/runtime-plan'));
    plan = await prepareRuntimePlan(source, provided.assets, declaration.baked, declaration.recipe, provided.sections);
  } else {
    let product = provided.product;
    if (product === undefined) {
      const { loadHeadlessProduct } = await import('./headlessProduct');
      product = await loadHeadlessProduct(`out/${provided.shard.identity.slug}`);
    }
    const { slug: actualIdentity } = product, { slug: expectedIdentity } = provided.shard.identity;
    if (actualIdentity !== expectedIdentity || product.revision !== provided.shard.identity.revision) throw new Error('Native product and trusted identity differ');
    const preparation: HeadlessRuntimePreparation = { ...provided, product };
    source = product.shardfile;
    plan = entry === undefined ? await prepareProductRuntimePlan(product, provided.assets) : await (async () => {
      const loaded: unknown = await import(/* @vite-ignore */ trustedHeadlessModule(entry.module));
      if (hasFactory(loaded)) return loaded.prepareHeadlessRuntime(preparation);
      if (hasAssemblyModules(loaded)) return prepareHeadlessAssembly(preparation, loaded.headlessModules);
      throw new Error('Trusted runtime must export prepareHeadlessRuntime or headlessModules');
    })();
  }
  const identity = { id: source.identity.slug, seed: source.identity.seed };
  if (plan.level.id !== identity.id || plan.level.seed !== identity.seed) throw new Error('Trusted runtime simulation identity mismatch');
  return { ...plan, install: (host, context) => {
    installCableModes(host.scope, source.modes?.traverse ?? [], host.flags).bindNative(host);
    const carried = source.runtime?.binds?.includes('movers') === true || hasDeclaredClientPage(source)
      ? source.movers.filter(row => row.carry !== undefined) : [];
    if (carried.length > 0) {
      let motion: MoverRuntime | null = null;
      host.onStep('movers.commands', () => {
        if (motion === null) throw new Error('Missing installed mover owner');
        for (const command of context.commands()) if (command.kind === 'script' && carried.some(row => row.id === command.actorId)) {
          if (command.value !== 1 && command.value !== 2) throw new Error('Invalid mover ride command');
          motion.command(command.actorId, command.value);
        }
      });
      motion = new MoverScriptDriver(carried, host).install(host, { content: { identity: source.identity,
        sim: { ...source.sim, bindings: [] }, state: source.state }, assets: new Map(),
        rules: { fields: {}, archetypes: [], events: [], maxEntities: 32 } },
      { id: 'movers.carried', restoring: context.restoring, restoreFlags: new Set(host.flags.all), drive: true });
    }
    plan.install(host, context);
  } };
}
/** Install the selected plan into one fresh or strictly restored native host.
 * A failed install disposes its world; installation may emit no gameplay effects. */
export async function createTrustedHeadlessResident(preparation: HeadlessRuntimeInput, entry?: TrustedHeadlessRuntime, snapshot?: string | Readonly<SimSnapshot>): Promise<TrustedHeadlessResident> {
  const plan = await prepareNativeRuntime(preparation, entry);
  let commands: readonly HeadlessCommand[] = [], effects: HeadlessEffect[] = [];
  const saved = snapshot === undefined ? undefined : decodeSimSnapshot(typeof snapshot === 'string' ? snapshot : serializeSimSnapshot(snapshot));
  const combat = createNativeCombatFrame();
  const context: HeadlessRuntimeInstallation = { combat, restoring: saved !== undefined, ...(saved === undefined ? {} : { snapshot: saved }), commands: () => commands, emit: effect => { effects.push(effect); } };
  const ports = { ...plan.ports, rapier: preparation.rapier };
  let installing: SimHost | undefined;
  let host: SimHost;
  try {
    if (saved === undefined) { installing = createSimHost(plan.level, ports); plan.install(installing, context); host = installing; }
    else host = restoreSimHost(plan.level, ports, saved, fresh => {
      installing = fresh; if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, context);
    });
    if (effects.length > 0) throw new Error('Trusted runtime emitted gameplay effects during installation');
  } catch (error) { installing?.dispose(); throw error; }
  const lend = (input: readonly HeadlessCommand[]): void => {
    if (input.some(command => command.kind === 'interact')) throw new Error('Authored interaction commands require the data-only owner');
    fillNativeCombatFrame(combat, input); commands = input; effects = []; };
  return {
    host, lend,
    get effects() { return effects; },
    step: input => {
      lend(input);
      let player: Parameters<SimHost['step']>[0];
      for (const command of input) if (command.kind === 'player') player = simPlayerCommand(command);
      host.step(player);
      if (![host.player.position, ...[...host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite trusted simulation state');
    },
    proveEntries: () => {
      if (plan.proveEntries === undefined) throw new Error('Trusted runtime has no entry proof');
      return plan.proveEntries(host);
    },
    dispose: () => { host.dispose(); },
  };
}
/** Worker-side composition only: owns one trusted resident (its real SimHost, native continuation and scoped installers). */
export async function createTrustedHeadlessAdapter(preparation: HeadlessRuntimeInput, entry?: TrustedHeadlessRuntime, snapshot?: string): Promise<TickWorkerAdapter> {
  const resident = await createTrustedHeadlessResident(preparation, entry, snapshot), { host } = resident;
  return {
    step: input => { resident.step(input); },
    commit: () => ({ tick: host.state.tick, snapshot: serializeSimSnapshot(snapshotSimHost(host)), effects: [...resident.effects] }),
    finish: () => ({ ticks: host.state.tick, lanes: 0, steps: 0 }),
    dispose: () => { resident.dispose(); },
  };
}

/** Fill the borrowed combat frame before the tick. All attacks retain tape order; held ranged input uses the first
 * hold, melee and movement use the last player command (including release), script values use the last matching row. */
export function fillNativeCombatFrame(frame: NativeCombatFrame, commands: readonly HeadlessCommand[]): void {
  if (commands.length > 1024) throw new RangeError('Tick commands exceed the protocol allowance');
  frame.attacks.length = 0; frame.heavy = null; frame.scripts.clear();
  frame.moveX = 0; frame.moveZ = 0; frame.yaw = 0;
  frame.melee.attack = null; frame.melee.heavy = false; frame.melee.heavyTarget = null;
  for (const command of commands) {
    if (command.kind === 'script') frame.scripts.set(command.actorId, command.value);
    if (command.kind !== 'player') continue;
    if (command.attack !== undefined) frame.attacks.push(command.attack.targetId);
    if (frame.heavy === null && command.heavy !== undefined) frame.heavy = command.heavy;
    frame.moveX = command.moveX; frame.moveZ = command.moveZ; frame.yaw = command.yaw;
    frame.melee.attack = command.attack?.targetId ?? null; frame.melee.heavy = command.heavy !== undefined;
    frame.melee.heavyTarget = command.heavy?.targetId ?? null;
  }
}
