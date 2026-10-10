// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real native engine for the oracle replay.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimSpawn } from '../../../src/engine/sim';
import { snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { canReach } from '../../../src/engine/ai/reach';
import { speciesBrains } from '../../../src/sdk/speciesBrains';
import type { HomeObservation, SpeciesPolicy } from '../../../src/game/shardfile/speciesBrains';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from '../../../src/shards/sunscar-dunes/data/brains';
import { BASIN } from '../../../src/shards/sunscar-dunes/data/layout';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { MatriarchBrain } from '../../fixtures/species-oracle/matriarch';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [], ground: { size: 2048, height: 0 } };
function recipe(): SimSpawn {
  const base = SIM_LEVEL.entities[0];
  if (base === undefined) throw new Error('Missing native fixture recipe');
  return { ...base, id: 'oracle:matriarch', at: { x: BASIN.x, y: 0, z: BASIN.z },
    spec: { ...base.spec, kind: 'duneMatriarch', flight: { altitude: 18, above: 'ground', climbRate: 7, diveRate: 20, lockRange: 60 } } };
}
/** One host whose Matriarch runs `make`'s policy under her fight's memory marks: dormant, rising, phases I, II, III. */
function install(host: SimHost, make: (actor: AnimalSim) => SpeciesPolicy<HomeObservation>, hits: number[]): SpeciesPolicy<HomeObservation> {
  const actor = host.spawn(recipe()), policy = make(actor);
  const ports: HomeObservation = {
    dt: 1 / 60, t: 0, player: host.player.position, calm: false, phaseOffset: 0,
    reach: a => canReach(a, host.player.position, host.physics), claim: a => host.clock.frame % 7 !== 0 && a.alive,
    hurt: damage => { hits.push(host.clock.frame * 1000 + damage); },
    steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
    flight: { steer: (a, yaw, speed, altitude, turn) => { a.fly(yaw, speed, altitude, turn); } },
  };
  host.onStep('oracle', dt => {
    const frame = host.clock.frame;
    ports.dt = dt; ports.t = host.clock.now;
    // the player walks a wandering loop round the bowl's heart, now near, now far
    const r = 8 + 22 * (0.5 + 0.5 * Math.sin(frame / 211)), angle = frame / 97;
    host.player.position.set(BASIN.x + Math.sin(angle) * r, 0, BASIN.z + Math.cos(angle) * r);
    actor.mem['fight'] = frame >= 240 ? 1 : 0; actor.mem['rise'] = Math.min(1, Math.max(0, (frame - 30) / 192));
    actor.mem['phase'] = frame >= 2400 ? 2 : frame >= 1200 ? 1 : 0;
    if (frame % 6 === 0) policy.think(ports);
    policy.act(ports);
  }, { snapshot: () => policy.snapshot(), restore: value => { policy.restore(value); } });
  return policy;
}

it('the phased-flyer row moves, strikes and saves exactly as the Matriarch\'s shipping brain over a whole fight', () => {
  const brains = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES);
  const oracleHits: number[] = [], rowHits: number[] = [];
  const oracle = createSimHost(level, { rapier }), row = createSimHost(level, { rapier });
  try {
    const before = install(oracle, actor => new MatriarchBrain<AnimalSim>(actor), oracleHits);
    const after = install(row, actor => { const policy = brains.policy('duneMatriarch', actor); if (policy === null) throw new Error('Missing Matriarch row'); return policy; }, rowHits);
    const states = new Set<string>();
    for (let tick = 0; tick < 3600; tick++) {
      oracle.step(); row.step();
      const saved = after.snapshot(); expect(saved).toBe(before.snapshot());
      if (typeof saved === 'string') { const value: unknown = JSON.parse(saved); if (typeof value === 'object' && value !== null) states.add(String(Reflect.get(value, 'state'))); }
      if (tick % 60 === 0) expectSameSimSnapshot(snapshotSimHost(row), snapshotSimHost(oracle));
    }
    expectSameSimSnapshot(snapshotSimHost(row), snapshotSimHost(oracle));
    expect(rowHits).toEqual(oracleHits);
    expect([...states].sort()).toEqual(['circle', 'climb', 'dive', 'grounded']);
    expect(rowHits.length).toBeGreaterThan(0);
  } finally { oracle.dispose(); row.dispose(); }
});
