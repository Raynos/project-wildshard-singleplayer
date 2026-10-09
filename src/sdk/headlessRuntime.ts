import { createSimHost, type SimHost, type SimHostPorts, type SimLevel } from '@wildshard/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '@wildshard/engine/sim/snapshot';
import type { Rapier } from '@wildshard/engine/physics/rapier';
import type { Shardfile } from './shardfile';
import type { HeadlessCommand, HeadlessEffect } from './tickProtocol';
import type { TickWorkerAdapter } from './tickWorkerLoop';

/** Explicit trusted-code entry, chosen by the caller, never taken from an authored shardfile or asset URL. */
export interface TrustedHeadlessRuntime { module: string }
/** The same admitted bytes and native physics implementation used by the ordinary headless worker. */
export interface HeadlessRuntimePreparation { shard: Shardfile; assets: ReadonlyMap<string, Uint8Array>; rapier: Rapier }
/** Current tick inputs and buffered effects; only a completed tick publishes them to the parent. */
export interface HeadlessRuntimeInstallation {
  restoring: boolean;
  commands: () => readonly HeadlessCommand[];
  emit: (effect: HeadlessEffect) => void;
}
/** A renderer-free native runtime. Install is synchronous and registers every mutable controller via host.onStep.
 * Restore calls install before applying the complete native snapshot. It must not step or award anything at install.
 * Entry validation remains an independent proof; omitting it makes finish refuse, never claim zero entry lanes.
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
/** Worker-side composition only: owns one real SimHost, its native continuation and its scoped installers. */
export async function createTrustedHeadlessAdapter(preparation: HeadlessRuntimePreparation, entry: TrustedHeadlessRuntime, snapshot?: string): Promise<TickWorkerAdapter> {
  const loaded: unknown = await import(/* @vite-ignore */ trustedHeadlessModule(entry.module));
  if (!hasFactory(loaded)) throw new Error('Trusted runtime must export prepareHeadlessRuntime');
  const plan = await loaded.prepareHeadlessRuntime(preparation);
  const identity = { id: preparation.shard.identity.slug, seed: preparation.shard.identity.seed };
  if (plan.level.id !== identity.id || plan.level.seed !== identity.seed) throw new Error('Trusted runtime simulation identity mismatch');
  let commands: readonly HeadlessCommand[] = [], effects: HeadlessEffect[] = [];
  const context: HeadlessRuntimeInstallation = { restoring: snapshot !== undefined, commands: () => commands, emit: effect => { effects.push(effect); } };
  const ports = { ...plan.ports, rapier: preparation.rapier };
  let installing: SimHost | undefined;
  let host: SimHost;
  try {
    if (snapshot === undefined) { installing = createSimHost(plan.level, ports); plan.install(installing, context); host = installing; }
    else host = restoreSimHost(plan.level, ports, decodeSimSnapshot(snapshot), fresh => {
      installing = fresh; if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, context);
    });
    if (effects.length > 0) throw new Error('Trusted runtime emitted gameplay effects during installation');
  } catch (error) { installing?.dispose(); throw error; }
  return {
    step: input => {
      commands = input; effects = [];
      let player: Parameters<SimHost['step']>[0];
      for (const command of input) if (command.kind === 'player') player = { moveX: command.moveX, moveZ: command.moveZ, yaw: command.yaw, ...(command.attack === undefined ? {} : { attack: command.attack }) };
      host.step(player);
      if (![host.player.position, ...[...host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite trusted simulation state');
    },
    commit: () => ({ tick: host.state.tick, snapshot: serializeSimSnapshot(snapshotSimHost(host)), effects }),
    finish: () => {
      if (plan.proveEntries === undefined) throw new Error('Trusted runtime has no entry proof');
      const proof = plan.proveEntries(host);
      if (proof.lanes < 1 || proof.steps < 1) throw new Error('Trusted runtime entry proof is empty');
      return { ticks: host.state.tick, ...proof };
    },
    dispose: () => { host.dispose(); },
  };
}
