import { createTrustedHeadlessAdapter } from './headlessRuntime';
import { diagnosticNow } from '@wildshard/engine/core/clock';
// oxlint-disable-next-line import/no-nodejs-modules -- Only the platform-selected physics binary is read inside the isolated worker.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { proveShardfileEntries } from '@wildshard/game/shardfile/socketLiftProof';
import { snapshotSimHost, serializeSimSnapshot, decodeSimSnapshot, restoreSimHost } from '@wildshard/engine/sim/snapshot';
import { createShardfileSim, bindShardfileSim, type ShardfileSimulation } from '@wildshard/game/shardfile/simulation';
import type { SimCommand } from '@wildshard/engine/sim';
import { parseShardfile } from './shardfile';
import { runTickWorker } from './tickWorkerLoop';
import { simPlayerCommand, type HeadlessEffect } from './tickProtocol';

await runTickWorker(async raw => {
  const payload = v.parse(v.strictObject({ shard: v.unknown(), assets: v.map(v.string(), v.instance(Uint8Array)), binary: v.string(), snapshot: v.optional(v.string()), trustedRuntime: v.exactOptional(v.strictObject({ module: v.string() })) }), raw);
  const shard = parseShardfile(payload.shard), rapier = await loadRapier(readFileSync(payload.binary));
  if (payload.trustedRuntime !== undefined) return createTrustedHeadlessAdapter({ shard, assets: payload.assets, rapier }, payload.trustedRuntime, payload.snapshot);
  let commands: ReadonlyMap<string, number> = new Map();
  let effects: HeadlessEffect[] = [];
  const ports = { rapier, commands: () => commands, quest: {
    fact: (name: string, actorId: string) => { effects.push({ kind: 'fact', name, actorId }); },
    coins: (amount: number, actorId: string) => { effects.push({ kind: 'coins', amount, actorId }); },
  } };
  let sim = createShardfileSim(shard, payload.assets, ports);
  if (payload.snapshot !== undefined) {
    const level = sim.host.level; sim.dispose();
    let installed: ShardfileSimulation | undefined;
    const host = restoreSimHost(level, { rapier }, decodeSimSnapshot(payload.snapshot), fresh => { installed = bindShardfileSim(fresh, shard, payload.assets, { ...ports, restoring: true }); });
    if (installed === undefined) { host.dispose(); throw new Error('Missing restored headless adapters'); }
    sim = installed;
  }
  effects = [];
  let scriptMicros = 0;
  if (sim.lane !== undefined) {
    const host = sim.lane.host, call = host.call.bind(host);
    // Offline-only instrumentation; neither author code nor the production frame loop chooses this wrapper.
    host.call = (...args: Parameters<typeof call>): ReturnType<typeof call> => {
      const started = diagnosticNow();
      try { return call(...args); } finally { scriptMicros += (diagnosticNow() - started) * 1000; }
    };
  }
  return {
    step: input => {
      scriptMicros = 0; effects = []; const numeric = new Map<string, number>(); let player: SimCommand | undefined;
      for (const command of input) {
        if (command.kind === 'player') player = simPlayerCommand(command);
        else if (command.kind === 'script') {
          if (!sim.actors.has(command.actorId)) throw new Error('Unknown command actor'); numeric.set(command.actorId, command.value);
        } else { if (sim.lane === undefined) throw new Error('Event requires a script lane'); sim.lane.enqueue({ type: command.type, target: command.target, value: command.value }); }
      }
      commands = numeric; sim.host.step(player);
      if (![sim.host.player.position, ...[...sim.host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite headless simulation state');
    },
    commit: () => {
      const script = sim.lane?.host.checkpoint();
      if (script?.modules.some(module => module.failures > 0 || module.disabled)) throw new Error('Headless script call failed');
      // A sleeping lane retains its last counters; report only fuel consumed by this completed global tick.
      const fuelUsed = script?.tick === sim.host.state.tick ? script.used.fuel : 0;
      return { tick: sim.host.state.tick, snapshot: serializeSimSnapshot(snapshotSimHost(sim.host)), effects, fuelUsed, scriptMicros };
    },
    finish: () => ({ ticks: sim.host.state.tick, ...proveShardfileEntries(shard, sim, payload.assets, ports) }),
    dispose: () => { sim.dispose(); },
  };
});
