// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real native physics and owned body lifetimes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { parseBossOwnerRow } from '../../src/format/bossProfiles';
import { installBossOwnerRow } from '../../src/game/shardfile/bossRow';
import { createSimHost } from '../../src/engine/sim';
import { snapshotSimHost, serializeSimSnapshot } from '../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import type { AnimalSim } from '../../src/engine/entities/AnimalSim';
import { SIM_LEVEL } from '../fixtures/sim-level/level';
import { SIGNAL_HEADLESS, SIGNAL_BOSS_OWNER } from '../../src/shards/sunscar-dunes/data/headlessOwners';
import { ROC_OWNER } from '../../src/shards/far-reach/data/rocFight';
import { installMarkedBossRow } from '../fixtures/boss-owner/signal';
import { installSkyRoc } from '../fixtures/boss-owner/sky';
import { stormRocBrain } from '../../src/shards/far-reach/runtime/stormRocBrain';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const recipe = SIM_LEVEL.entities[0];
if (recipe?.spec === undefined) throw new Error('Missing native recipe');
const native = recipe.spec;

function fixture(kind: 'spawned' | 'held', authored: boolean) {
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  let actor: AnimalSim | null = null, serial = 0;
  const effects: unknown[][] = [];
  const row = kind === 'spawned' ? SIGNAL_BOSS_OWNER : ROC_OWNER;
  const spawn = (): AnimalSim => {
    if (actor !== null) host.retire(actor.entityId);
    actor = host.spawn({ id: `boss.${String(serial++)}`, spec: native, seed: 7, scale: 1,
      at: { x: row.profile.fight.arena.x, y: 3, z: row.profile.fight.arena.z }, yaw: 0 });
    return actor;
  };
  const keeper = { draw: spawn, free: () => { if (actor !== null) host.retire(actor.entityId); actor = null; }, actor: () => actor };
  const fact = (name: string, id: string): void => { effects.push(['fact', name, id]); };
  const coins = (amount: number, id: string): void => { effects.push(['coins', amount, id]); };
  const body = spawn();
  const brain = stormRocBrain(body, () => undefined);
  const encounter = kind === 'spawned'
    ? authored ? installBossOwnerRow(host, row, { body: { kind, keeper }, fact, coins })
      : installMarkedBossRow(host, SIGNAL_HEADLESS.boss, { body: keeper, fact, coins })
    : authored ? installBossOwnerRow(host, row, { body: { kind, actor: body, brain }, fact, coins })
      : installSkyRoc(host, { roc: body, body: brain, fact, coins });
  encounter.boss.arm();
  return { host, encounter, effects, actor: () => actor, row };
}

it.each(['spawned', 'held'] as const)('%s rows preserve native continuation, retries and ordered durable rewards', kind => {
  const a = fixture(kind, true), b = fixture(kind, false);
  try {
    for (let tick = 0; tick < 1200; tick++) {
      for (const run of [a, b]) {
        run.host.player.position.set(run.row.profile.fight.arena.x, 100, run.row.profile.fight.arena.z);
        const actor = run.actor();
        if (actor !== null && tick % 300 === 270) actor.alive = false;
        if (tick % 213 === 150) run.encounter.boss.onPlayerDeath();
        if (tick % 401 === 0) run.encounter.boss.devStartAt(0);
        run.host.step();
      }
      expect(serializeSimSnapshot(snapshotSimHost(a.host)), `tick ${String(tick)}`).toEqual(serializeSimSnapshot(snapshotSimHost(b.host)));
      expect(a.effects).toEqual(b.effects);
    }
    expect(a.effects.some(effect => effect[0] === 'fact')).toBe(true);
    expect(a.effects.some(effect => effect[0] === 'coins')).toBe(true);
  } finally { a.host.dispose(); b.host.dispose(); }
});

it('refuses dangling identity, mismatched phases and conflicting records before a body is lent', () => {
  expect(() => parseBossOwnerRow({ ...ROC_OWNER, actor: 'other' })).toThrow();
  expect(() => parseBossOwnerRow({ ...ROC_OWNER, definition: { ...ROC_OWNER.definition, phases: [] } })).toThrow();
  expect(() => parseBossOwnerRow({ ...ROC_OWNER, record: { defeated: 'a', paid: 'b' } })).toThrow();
  expect(() => parseBossOwnerRow({ ...SIGNAL_BOSS_OWNER, placement: undefined })).toThrow();
});
