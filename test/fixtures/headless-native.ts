import type { HeadlessRuntimeInput, HeadlessRuntimeInstallation, HeadlessRuntimePreparation, HeadlessRuntimePlan, PrepareHeadlessRuntime, TrustedHeadlessResident } from '../../src/sdk/headlessRuntime';
import { fillNativeCombatFrame } from '../../src/sdk/headlessRuntime';
import { prepareAssetDecoders } from '../../src/format/product';
import { loadHeadlessProduct } from '../../src/sdk/headlessProduct';
import { hasDeclaredClientPage } from '../../src/format/runtimeBinds';
import { MoverScriptDriver, type MoverRuntime } from '../../src/game/plugin/mover';
import { installCableModes } from '../../src/engine/player/modes';
import { createNativeCombatFrame } from '../../src/game/plugin/nativeItems';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHostBytes, type SimSnapshot } from '../../src/engine/sim/snapshot';
import { simPlayerCommand, type HeadlessCommand, type HeadlessEffect } from '../../src/sdk/tickProtocol';
import type { TickWorkerAdapter } from '../../src/sdk/tickWorkerLoop';

/** Direct typed proof composition; no module URL, dynamic code lookup or authored factory selection. */
export async function prepareNativeProof(provided: HeadlessRuntimeInput, prepare: PrepareHeadlessRuntime): Promise<HeadlessRuntimePlan> {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(provided.shard.identity.slug)) throw new Error('Invalid native product identity');
  await prepareAssetDecoders();
  const product=provided.product ?? await loadHeadlessProduct(`out/${provided.shard.identity.slug}`);
  if(product.slug!==provided.shard.identity.slug || product.revision!==provided.shard.identity.revision) throw new Error('Native product and trusted identity differ');
  const preparation: HeadlessRuntimePreparation={...provided,product};
  const source=product.shardfile,plan=await prepare(preparation);
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

/** Keep the native transaction, restore and tick fences in the direct gameplay proof. */
export async function createNativeProofResident(preparation: HeadlessRuntimeInput, prepare: PrepareHeadlessRuntime, snapshot?: string | Readonly<SimSnapshot>): Promise<TrustedHeadlessResident> {
  const plan = await prepareNativeProof(preparation, prepare);
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
export async function createNativeProofAdapter(preparation: HeadlessRuntimeInput, prepare: PrepareHeadlessRuntime, snapshot?: string): Promise<TickWorkerAdapter> {
  const resident = await createNativeProofResident(preparation, prepare, snapshot), { host } = resident;
  return {
    step: input => { resident.step(input); },
    commit: () => ({ tick: host.state.tick, snapshot: serializeSimSnapshot(snapshotSimHostBytes(host)), effects: [...resident.effects] }),
    finish: () => ({ ticks: host.state.tick, lanes: 0, steps: 0 }),
    dispose: () => { resident.dispose(); },
  };
}

