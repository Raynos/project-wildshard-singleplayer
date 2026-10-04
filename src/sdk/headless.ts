// oxlint-disable-next-line import/no-nodejs-modules -- Native validation reads the SDK's distributed physics binary.
import { existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate distributed or workspace physics bytes.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Recheck immutable admitted bytes before copying them into a worker.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Select the SDK's fixed bundled worker entry without Vite asset rewriting.
import { pathToFileURL } from 'node:url';
import { validateShardfileAssets } from '@wildshard/game/shardfile/validate';
import type { Shardfile } from './shardfile';
import { TickWorkerHost } from './tickWorkerHost';
import type { HeadlessCommandSource, HeadlessTickCommit } from './tickProtocol';

/** A plain-Node authoritative session. Failed ticks quarantine the isolate and retain the previous exact checkpoint. */
export class HeadlessSimulation {
  private constructor(private readonly runner: TickWorkerHost) {}
  /** Admit content, start the fixed platform worker, and optionally resume an exact committed same-engine checkpoint. */
  static async create(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, snapshot?: string): Promise<HeadlessSimulation> {
    validateShardfileAssets(shard, assets, bytes => createHash('sha256').update(bytes).digest('hex'));
    const binary = [resolve(import.meta.dirname, 'client/assets/physics/rapier.wasm'), resolve(import.meta.dirname, 'dist/client/assets/physics/rapier.wasm'), resolve(import.meta.dirname, '../../public/assets/physics/rapier.wasm')].find(existsSync);
    if (binary === undefined) throw new Error('SDK physics binary missing; build/pack the SDK before headless validation');
    const admitted = new Map<string, Uint8Array>();
    for (const ref of [...shard.files.map(file => file.hash), ...shard.requires.commons.map(hash => `commons:${hash}`)]) {
      const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Missing admitted worker bytes'); admitted.set(ref, bytes);
    }
    const bundled = resolve(import.meta.dirname, 'headlessWorker.js');
    const source = resolve(import.meta.dirname, 'headlessWorker.ts');
    const loader = resolve(import.meta.dirname, '../../scripts/sim-node-loader.mjs');
    const distributed = existsSync(bundled);
    if (!distributed && (!existsSync(source) || !existsSync(loader))) throw new Error('SDK headless worker missing; build/pack the SDK or use its complete workspace checkout');
    // Source-checkout workers need their own Node hooks; parent Vitest/Vite transforms never cross the isolate boundary.
    const execArgv = distributed ? [] : ['--experimental-transform-types', '--import', pathToFileURL(loader).href];
    const runner = new TickWorkerHost(pathToFileURL(distributed ? bundled : source), { shard, assets: admitted, binary, ...(snapshot === undefined ? {} : { snapshot }) }, shard.serverBudget, execArgv);
    try { await runner.initialized(); return new HeadlessSimulation(runner); } catch (error) { await runner.dispose(); throw error; }
  }
  /** Last committed state is detached; callers cannot change the checkpoint used after a refused or unfinished tick. */
  get checkpoint(): HeadlessTickCommit | undefined { return this.runner.checkpoint; }
  /** Quarantined sessions cannot execute again; a trusted caller may start a new worker from the retained checkpoint. */
  get quarantined(): boolean { return this.runner.quarantined; }
  /** Actual timed work, excluding detached checkpoint encoding and IPC. The first touch has a bounded 16.666 ms JIT allowance. */
  get lastTickMicros(): number { return this.runner.lastTickMicros; }
  /** Admit the aggregate command count across all sources, then atomically return state and effects from one bounded tick. */
  step(sources: readonly HeadlessCommandSource[] = []): Promise<HeadlessTickCommit> { return this.runner.step(sources); }
  /** Walk every declared entry against installed colliders inside the worker, under a separate validation request deadline. */
  finish(): Promise<{ ticks: number; lanes: number; steps: number }> { return this.runner.finish(); }
  /** Terminate the owned worker and release its complete native world. */
  dispose(): Promise<void> { return this.runner.dispose(); }
}
/** CLI validation uses the same preemptible, plain-Node session as an embedding host. */
export async function validateSimulation(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>): Promise<{ ticks: number; lanes: number; steps: number }> {
  const sim = await HeadlessSimulation.create(shard, assets);
  try {
    for (let tick = 0; tick < 60; tick++) await sim.step();
    return await sim.finish();
  } finally { await sim.dispose(); }
}
