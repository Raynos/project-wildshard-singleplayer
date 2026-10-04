// oxlint-disable-next-line import/no-nodejs-modules -- Only the platform-selected physics binary is read inside the isolated worker.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { walkEdgeEntries } from '@wildshard/engine/physics/edgeEntries';
import { snapshotSimHost, serializeSimSnapshot, decodeSimSnapshot, restoreSimHost } from '@wildshard/engine/sim/snapshot';
import { createShardfileSim, bindShardfileSim, type ShardfileSimulation } from '@wildshard/game/shardfile/simulation';
import type { SimCommand } from '@wildshard/engine/sim';
import { parseShardfile } from './shardfile';
import { runTickWorker } from './tickWorkerLoop';
import type { HeadlessEffect } from './tickProtocol';

await runTickWorker(async raw => {
  const payload = v.parse(v.strictObject({ shard: v.unknown(), assets: v.map(v.string(), v.instance(Uint8Array)), binary: v.string(), snapshot: v.optional(v.string()) }), raw);
  const shard = parseShardfile(payload.shard), rapier = await loadRapier(readFileSync(payload.binary));
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
  return {
    step: input => {
      effects = []; const numeric = new Map<string, number>(); let player: SimCommand | undefined;
      for (const command of input) {
        if (command.kind === 'player') player = { moveX: command.moveX, moveZ: command.moveZ, yaw: command.yaw, ...(command.attack === undefined ? {} : { attack: command.attack }) };
        else if (command.kind === 'script') {
          if (!sim.actors.has(command.actorId)) throw new Error('Unknown command actor'); numeric.set(command.actorId, command.value);
        } else { if (sim.lane === undefined) throw new Error('Event requires a script lane'); sim.lane.enqueue({ type: command.type, target: command.target, value: command.value }); }
      }
      commands = numeric; sim.host.step(player);
      if (![sim.host.player.position, ...[...sim.host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite headless simulation state');
    },
    commit: () => {
      if (sim.lane?.host.checkpoint().modules.some(module => module.failures > 0 || module.disabled)) throw new Error('Headless script call failed');
      return { tick: sim.host.state.tick, snapshot: serializeSimSnapshot(snapshotSimHost(sim.host)), effects };
    },
    finish: () => ({ ticks: sim.host.state.tick, ...walkEdgeEntries(sim.host.physics, (x, z) => sim.water.restAt(x, z)) }),
    dispose: () => { sim.dispose(); },
  };
});
