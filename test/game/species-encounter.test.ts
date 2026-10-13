// oxlint-disable-next-line import/no-nodejs-modules -- Exercise actual native population ownership.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot } from '../../src/engine/sim/snapshot';
import { bakedSpecs, installSpeciesHomes, type SpeciesHomesSpec } from '../../src/game/plugin/brain';
import { installBossOwnerRow, installSpeciesEncounter, type BossOwnerBody } from '../../src/game/shardfile/bossRow';
import { speciesBrains } from '../../src/sdk/speciesBrains';
import { SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES } from '../../src/shards/far-reach/data/brains';
import { ROC_OWNER } from '../../src/shards/far-reach/data/rocFight';
import { SKY_FLOCK_ROWS } from '../../src/shards/far-reach/data/spawns';
import skyBake from '../../src/shards/far-reach/data/physics.generated.json' with { type: 'json' };
import { SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES } from '../../src/shards/sunscar-dunes/data/brains';
import { SIGNAL_HEADLESS, SIGNAL_BOSS_OWNER } from '../../src/shards/sunscar-dunes/data/headlessOwners';
import signalBake from '../../src/shards/sunscar-dunes/data/physics.generated.json' with { type: 'json' };
import { SIM_LEVEL } from '../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
function population(pattern: 'held' | 'spawned'): SpeciesHomesSpec {
  if (pattern === 'spawned') return { step: 'fixture.population', seed: 31, think: { bands: { rate: () => 'legacy' } }, homes: [], boss: SIGNAL_HEADLESS.boss.row,
    specs: bakedSpecs([...signalBake.actors, ...signalBake.bosses]), species: SIGNAL_SPECIES,
    brains: speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES), attackers: SIGNAL_HEADLESS.homes.attackers };
  const row = SKY_FLOCK_ROWS.find(home => home.id === ROC_OWNER.actor);
  if (row === undefined) throw new Error('Missing actual held owner row');
  return { step: 'fixture.population', seed: 31, think: { bands: { rate: () => 'legacy' } }, homes: [{ id: row.id, kind: row.kind, at: row.at, yaw: row.yaw, respawn: 0 }],
    specs: bakedSpecs(skyBake.actors), species: SKY_CREATURE_ROWS, brains: speciesBrains(SKY_CREATURE_ROWS, SKY_CREATURE_STRIKES),
    attackers: Infinity, home: () => row.home };
}
function fixture(pattern: 'held' | 'spawned', assembled: boolean) {
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier }), spec = population(pattern);
  const row = pattern === 'held' ? ROC_OWNER : SIGNAL_BOSS_OWNER, effects: unknown[][] = [];
  const ports = { fact: (name: string, id: string) => { effects.push(['fact', name, id]); },
    coins: (amount: number, id: string) => { effects.push(['coins', amount, id]); } };
  const installed = (() => {
    if (assembled) return installSpeciesEncounter(host, spec, row, ports);
    const keeper = installSpeciesHomes(host, spec);
    let body: BossOwnerBody;
    if (pattern === 'spawned') {
      if (keeper.boss === null) throw new Error('Missing spawned keeper');
      body = { kind: 'spawned', keeper: keeper.boss };
    } else {
      const actor = keeper.homes()[0]?.actor, brain = actor === null || actor === undefined ? null : spec.brains.held(actor.kind, actor);
      if (actor === null || actor === undefined || brain === null) throw new Error('Missing held owner');
      body = { kind: 'held', actor, brain };
    }
    return { keeper, encounter: installBossOwnerRow(host, row, { body, ...ports }) };
  })();
  installed.keeper.settle();
  return { host, ...installed, effects };
}

it.each(['held', 'spawned'] as const)('%s population keeps actual bodies, install order, phases and continuation exact', pattern => {
  const before = fixture(pattern, false), after = fixture(pattern, true);
  try {
    for (let tick = 0; tick < 600; tick++) {
      for (const f of [before, after]) {
        if (tick % 200 === 0) f.encounter.boss.devStartAt(tick / 200);
        if (tick % 173 === 172) f.encounter.boss.onPlayerDeath();
        f.host.step();
      }
      expect(serializeSimSnapshot(snapshotSimHost(after.host)), `tick ${String(tick)}`).toBe(serializeSimSnapshot(snapshotSimHost(before.host)));
      expect(after.effects).toEqual(before.effects);
    }
  } finally { before.host.dispose(); after.host.dispose(); }
});

it.each(['held', 'spawned'] as const)('%s foreign population address refuses before allocating or installing systems', pattern => {
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    const row = pattern === 'held' ? ROC_OWNER : SIGNAL_BOSS_OWNER, spec = population(pattern);
    const wrong = { ...spec, homes: [], boss: { ...SIGNAL_HEADLESS.boss.row, id: 'foreign.owner' } }, saved = serializeSimSnapshot(snapshotSimHost(host));
    expect(() => installSpeciesEncounter(host, wrong, row, { fact: () => undefined, coins: () => undefined })).toThrow('declared species population');
    expect(serializeSimSnapshot(snapshotSimHost(host))).toBe(saved);
  } finally { host.dispose(); }
});
