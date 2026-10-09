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
import { trustedHeadlessModule, type TrustedHeadlessRuntime } from './headlessRuntime';
import { SCRIPT_LIMITS } from '@wildshard/engine/script/host';

/** A plain-Node authoritative session. Failed ticks quarantine the isolate and retain the previous exact checkpoint. */
export class HeadlessSimulation {
  private readonly runner: TickWorkerHost;
  private constructor(runner: TickWorkerHost) { this.runner = runner; }
  /** Start the fixed worker with runtime deadlines by default. Trusted offline validation selects advisory timing; author data cannot select this policy. */
  static async create(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, snapshot?: string, options: { deadline?: 'runtime' | 'advisory'; trustedRuntime?: TrustedHeadlessRuntime } = {}): Promise<HeadlessSimulation> {
    const trustedRuntime = options.trustedRuntime === undefined ? undefined : { module: trustedHeadlessModule(options.trustedRuntime.module) };
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
    const runner = new TickWorkerHost(pathToFileURL(distributed ? bundled : source), { shard, assets: admitted, binary, ...(trustedRuntime === undefined ? {} : { trustedRuntime }), ...(snapshot === undefined ? {} : { snapshot }) }, shard.serverBudget, execArgv, options.deadline ?? 'runtime');
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
  /** Final validation walks every entry under a separate request deadline. Further ticks refuse; resume from the last committed checkpoint in a fresh worker. */
  finish(): Promise<{ ticks: number; lanes: number; steps: number; liftRides?: number; liftCalls?: number; portalTransfers?: number }> { return this.runner.finish(); }
  /** Terminate the owned worker and release its complete native world. */
  dispose(): Promise<void> { return this.runner.dispose(); }
}
/** Offline observation: 60 warm-up ticks and three 60-tick windows. CPU uses the least interrupted window p95; raw maxima and all fuel remain visible. Scripts exclude native physics, checkpoints and IPC. */
export interface SimulationObservations {
  timing: { medianMicros: number; p95Micros: number; maxMicros: number; samples: number };
  fuel: { p95: number; max: number; limit: number; samples: number };
  scripts: { p95Micros: number; maxMicros: number; samples: number };
}
const WARMUP_TICKS = 60, WINDOW_TICKS = 60, WINDOWS = 3;
function p95(values: readonly number[]): number { return values[Math.floor((values.length - 1) * 0.95)] ?? 0; }
async function observe(sim: Pick<HeadlessSimulation, 'step' | 'lastTickMicros'>): Promise<SimulationObservations> {
  const measured: number[] = [], fuel: number[] = [], scripts: number[] = [], windowP95: number[] = [];
  // Cold JIT belongs to startup. Fuel remains deterministic and every warm-up tick is still budgeted.
  for (let tick = 0; tick < WARMUP_TICKS; tick++) fuel.push((await sim.step()).fuelUsed ?? 0);
  for (let window = 0; window < WINDOWS; window++) {
    const costs: number[] = [];
    for (let tick = 0; tick < WINDOW_TICKS; tick++) {
      const commit = await sim.step(), script = commit.scriptMicros ?? 0;
      measured.push(sim.lastTickMicros); fuel.push(commit.fuelUsed ?? 0); scripts.push(script); costs.push(script);
    }
    costs.sort((a, b) => a - b); windowP95.push(p95(costs));
  }
  measured.sort((a, b) => a - b); fuel.sort((a, b) => a - b); scripts.sort((a, b) => a - b);
  const middle = measured.length / 2;
  // The least interrupted window estimates hot execution; genuine persistent CPU overages fail all three.
  // Retain raw maxima and all fuel samples, so this does not conceal an expensive tick or relax its fuel cap.
  return { timing: { medianMicros: ((measured[middle - 1] ?? 0) + (measured[middle] ?? 0)) / 2, p95Micros: p95(measured), maxMicros: measured.at(-1) ?? 0, samples: measured.length },
    fuel: { p95: p95(fuel), max: fuel.at(-1) ?? 0, limit: SCRIPT_LIMITS.fuelPerTick, samples: fuel.length },
    scripts: { p95Micros: Math.min(...windowP95), maxMicros: scripts.at(-1) ?? 0, samples: scripts.length } };
}
/** Build warms up, then samples three fixed windows; it never runs the expensive entry walk reserved for validate. */
export async function measureSimulation(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, start: (shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>) => Promise<Pick<HeadlessSimulation, 'step' | 'lastTickMicros' | 'dispose'>> = (source, bytes) => HeadlessSimulation.create(source, bytes, undefined, { deadline: 'advisory' })): Promise<SimulationObservations> {
  const sim = await start(shard, assets);
  try { return await observe(sim); } finally { await sim.dispose(); }
}
/** Offline admission proves bounded execution and entries; wall timing is advisory. The independent request watchdog still bounds a broken worker. */
export async function validateSimulation(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>): Promise<{ ticks: number; lanes: number; steps: number; liftRides?: number; liftCalls?: number; portalTransfers?: number } & SimulationObservations> {
  const sim = await HeadlessSimulation.create(shard, assets, undefined, { deadline: 'advisory' });
  try { const observed = await observe(sim); return { ...await sim.finish(), ...observed }; }
  finally { await sim.dispose(); }
}
