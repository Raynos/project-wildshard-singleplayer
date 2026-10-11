import { phasedDiverPreset, PhasedDiverSchema } from '../../../src/format/phasedFlyers';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real native engine for the oracle replay.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash every native frame against the captured shipping policy.
import { createHash } from 'node:crypto';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimSpawn } from '../../../src/engine/sim';
import { snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { canReach } from '../../../src/engine/ai/reach';
import { speciesBrains } from '../../../src/sdk/speciesBrains';
import type { HomeObservation, SpeciesPolicy } from '../../../src/game/plugin/brain';
import { strikeFromData } from '../../../src/engine/ai/strikeRows';
import { DiverBrain } from '../../../src/engine/ai/diver';
import { MATRIARCH_BRAIN, SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from '../../../src/shards/sunscar-dunes/data/brains';
import { BASIN } from '../../../src/shards/sunscar-dunes/data/layout';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { MatriarchBrain } from '../../fixtures/species-oracle/matriarch';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [], ground: { size: 2048, height: 0 } };
function phased(actor: AnimalSim): SpeciesPolicy<HomeObservation> {
  const profile = MATRIARCH_BRAIN;
  if (profile.archetype !== 'diver' || profile.data.pattern !== 'phased') throw new Error('Missing phased declaration');
  const data = phasedDiverPreset(profile.data);
  const strikes = new Map(SIGNAL_STRIKES.map(row => { const strike = strikeFromData(row); return [strike.id, strike] as const; }));
  const resolve = (id: string) => { const strike = strikes.get(id); if (strike === undefined) throw new Error('Missing strike'); return strike; };
  const policy = new DiverBrain(actor, { pattern: 'phased', spec: data,
    dive: data.dive.map(resolve), grounded: data.grounded.map(resolve) });
  return { think: ports => { policy.think({ ...ports, pattern: 'phased' }); },
    act: ports => { policy.act({ ...ports, pattern: 'phased' }); }, snapshot: () => policy.snapshot(), restore: value => { policy.restore(value); } };
}
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
  const oracleHits: number[] = [], rowHits: number[] = [], sharedHits: number[] = [];
  const oracle = createSimHost(level, { rapier }), row = createSimHost(level, { rapier }), shared = createSimHost(level, { rapier });
  try {
    const before = install(oracle, actor => new MatriarchBrain<AnimalSim>(actor), oracleHits);
    const after = install(row, actor => { const policy = brains.policy('duneMatriarch', actor); if (policy === null) throw new Error('Missing Matriarch row'); return policy; }, rowHits);
    const direct = install(shared, phased, sharedHits);
    const oldHash = createHash('sha256'), presetHash = createHash('sha256'), sharedHash = createHash('sha256');
    const states = new Set<string>();
    for (let tick = 0; tick < 3600; tick++) {
      oracle.step(); row.step(); shared.step();
      const saved = after.snapshot(); expect(saved).toBe(before.snapshot());
      expect(direct.snapshot()).toBe(saved);
      oldHash.update(JSON.stringify({ policy: before.snapshot(), sim: snapshotSimHost(oracle) }));
      presetHash.update(JSON.stringify({ policy: saved, sim: snapshotSimHost(row) }));
      sharedHash.update(JSON.stringify({ policy: direct.snapshot(), sim: snapshotSimHost(shared) }));
      if (typeof saved === 'string') { const value: unknown = JSON.parse(saved); if (typeof value === 'object' && value !== null) states.add(String(Reflect.get(value, 'state'))); }
      if (tick % 60 === 0) expectSameSimSnapshot(snapshotSimHost(row), snapshotSimHost(oracle));
    }
    expectSameSimSnapshot(snapshotSimHost(row), snapshotSimHost(oracle)); expectSameSimSnapshot(snapshotSimHost(shared), snapshotSimHost(oracle));
    const expected = oldHash.digest('hex'); expect(presetHash.digest('hex')).toBe(expected); expect(sharedHash.digest('hex')).toBe(expected);
    expect(rowHits).toEqual(oracleHits); expect(sharedHits).toEqual(oracleHits);
    expect([...states].sort()).toEqual(['circle', 'climb', 'dive', 'grounded']);
    expect(rowHits.length).toBeGreaterThan(0);
  } finally { oracle.dispose(); row.dispose(); shared.dispose(); }
});

  it('admits the phased diver profile with the old complete flight contract and refuses bad phase tuning', () => {
    const profile = MATRIARCH_BRAIN;
    if (profile.archetype !== 'diver' || profile.data.pattern !== 'phased') throw new Error('Missing phased diver row');
    const data = profile.data, preset = phasedDiverPreset(data);
    expect(preset.kind).toBe('phased-flyer');
    expect(preset.fields).toEqual(data.fields); expect(preset.altitudes).toEqual(data.altitudes);
    expect(preset.restSeconds).toEqual(data.restSeconds);
    expect(() => phasedDiverPreset({ ...data, climbSpeedBonus: 31 })).toThrow();
    expect(() => phasedDiverPreset({ ...data, fields: { ...data.fields, unused: 'bad' } })).toThrow();
    expect(v.safeParse(PhasedDiverSchema, { ...data, pattern: 'patrol' }).success).toBe(false);
  });