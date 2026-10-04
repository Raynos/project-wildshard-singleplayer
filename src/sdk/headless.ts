// oxlint-disable-next-line import/no-nodejs-modules -- Native validation reads the SDK's distributed physics binary.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Locate distributed or workspace physics bytes.
import { resolve } from 'node:path';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { walkEdgeEntries } from '@wildshard/engine/physics/edgeEntries';
import { createShardfileSim } from '@wildshard/game/shardfile/simulation';
import type { Shardfile } from './shardfile';

/** Execute admitted content on the real simulation core and walk every entry through its installed colliders. */
export async function validateSimulation(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>): Promise<{ ticks: number; lanes: number; steps: number }> {
  const binary = [resolve(import.meta.dirname, 'client/assets/physics/rapier.wasm'), resolve(import.meta.dirname, 'dist/client/assets/physics/rapier.wasm'), resolve(import.meta.dirname, '../../public/assets/physics/rapier.wasm')].find(existsSync);
  if (binary === undefined) throw new Error('SDK physics binary missing; build/pack the SDK before headless validation');
  const rapier = await loadRapier(readFileSync(binary));
  const facts: string[] = [], coins = new Map<string, number>();
  const sim = createShardfileSim(shard, assets, { rapier, quest: { fact: (name, entity) => { facts.push(`${name}:${entity}`); }, coins: (amount, entity) => { coins.set(entity, (coins.get(entity) ?? 0) + amount); } } });
  try {
    for (let tick = 0; tick < 60; tick++) {
      sim.host.step();
      if (![sim.host.player.position, ...[...sim.host.entities.values()].map((entity) => entity.position)].every((point) => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite headless simulation state');
      if (sim.lane?.host.checkpoint().modules.some((module) => module.failures > 0 || module.disabled)) throw new Error('Headless script call failed');
    }
    return { ticks: sim.host.state.tick, ...walkEdgeEntries(sim.host.physics, (x, z) => sim.water.restAt(x, z)) };
  } finally { sim.dispose(); }
}
