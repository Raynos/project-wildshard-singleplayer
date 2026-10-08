import { expect, it, vi } from 'vitest';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { Flags } from '../../../src/engine/world/interact/flags';
import { Progress } from '../../../src/game/Progress';
import { bindRuntimeQuest, withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import { parseShardfile } from '../../../src/game/shardfile/schema';
import { bossesSave, inventorySave, ownedSave, progressSave, purseSave } from '../../../src/game/saves';
import source from '../../../src/shards/far-reach/shard.config';
import { bindSkyPersistence, LEGACY_REWARDED } from '../../../src/shards/far-reach/runtime/persistence';
import { FLAGS, vaneFlag } from '../../../src/shards/far-reach/quest/flags';
import { DECK, GOATS, RAY_HOMES, ROC, ROOST_RAYS, VANES, WISP_HOMES, WINCH } from '../../../src/shards/far-reach/layout';
import { KEEPER_AT } from '../../../src/shards/far-reach/data/quests';
import { STRINGS } from '../../../src/shards/far-reach/strings';

it('declares only finite bodies, the native fan context and the exact quest markers/chips', () => {
  expect(parseShardfile(source)).toEqual(source);
  const data = withoutRuntimeRows(source);
  expect([data.quests.quests, data.ledger, data.items.rows, data.state.shared, data.creatures.spawns]).toEqual([[], [], [], [], []]);
  expect(data.audio).toBe(source.audio); expect(data.edge).toBe(source.edge);
  const rows = source.runtime?.spawns;
  expect(rows?.homes).toEqual([]);
  expect(rows?.actors).toHaveLength(RAY_HOMES.length + ROOST_RAYS.length + WISP_HOMES.length + GOATS.length);
  expect(rows?.bosses).toEqual([{ id: 'far.roc', kind: 'stormRoc', look: 'storm', at: [ROC.x + ROC.r, ROC.z], yaw: 0 }]);
  expect(source.items.runtimeContexts).toEqual(['far.fan']); expect(source.items.contexts).toEqual([]);
  expect(source.items.rows[0]).toMatchObject({ id: 'weapon.far-reach.fan', family: 'far-reach.fan', context: 'far.fan',
    light: { damage: 16, cooldown: .45, range: 3.4, width: .9 }, heavy: { damage: 30, cooldown: .85 }, charge: .6 });
  const steps = source.quests.quests[0]?.steps;
  expect(steps?.map(step => step.chip)).toEqual([STRINGS.chipKeeper, STRINGS.chipRoost, STRINGS.chipVanes, STRINGS.chipRaise]);
  expect(steps?.[0]?.markers?.[0]?.at).toEqual({ poi: 'world', x: KEEPER_AT.x, y: DECK, z: KEEPER_AT.z });
  expect(steps?.[2]?.markers?.map(marker => marker.at)).toEqual(VANES.map(vane => ({ poi: 'world', x: vane.x, y: vane.y + 1.4, z: vane.z })));
  expect(steps?.[3]?.markers?.[0]?.at).toEqual({ poi: 'world', x: WINCH.x, y: WINCH.y, z: WINCH.z });
});

it('migrates a current C26 save once and projects the same ledger without replaying reward coins or legacy writes', () => {
  localStorage.clear();
  const scope = new Scope('sky.c26'), slug = source.identity.slug;
  try { withOwner(scope, () => {
    const old = app.saves.define(LEGACY_REWARDED), previous = { counts: {}, earned: [], title: null, playS: 125 };
    old.write(true, slug); progressSave.write(previous, slug);
    bossesSave.write({ 'far.roc': { defeated: true, rewardTaken: true, kills: 2 } }, slug);
    purseSave.write(35, slug); inventorySave.write({ counts: { feather: 2 }, order: ['feather'] }, slug);
    ownedSave.write({ owned: ['far-fan'], worn: ['far-fan'] }, slug);
    const flags = new Flags(slug);
    for (const flag of [FLAGS.complete, FLAGS.notes, FLAGS.roost, FLAGS.vanes, FLAGS.raised, FLAGS.roc, ...VANES.map(vane => vaneFlag(vane.id))]) flags.set(flag);
    const bind = () => {
      const persistence = bindSkyPersistence({ app, scope }, app.saves), progress = new Progress(slug);
      persistence.bindProgress(progress);
      const quest = bindRuntimeQuest({ app, scope }, source, 'far.quest', { flags, facts: persistence.facts });
      expect(quest.state.isComplete).toBe(true);
      expect(persistence.rewarded.read()).toBe(true);
      expect(persistence.boss.read()).toEqual({ defeated: true, rewardTaken: true, kills: 2 });
      expect(persistence.facts.achievement('far-reach.quest')).toMatchObject({ count: 1, earned: true });
      expect(persistence.facts.achievement('far-reach.roc')).toMatchObject({ count: 1, earned: true });
      expect(progress.rows).toEqual([]); expect(progress.playS).toBe(125); expect(progress.checkpoint()).toBe(true);
      return persistence;
    };
    bind(); const profile = localStorage.getItem('wildshard.save.v2.profile');
    const persistence = bind(); expect(localStorage.getItem('wildshard.save.v2.profile')).toBe(profile);
    persistence.boss.write({ defeated: false, rewardTaken: false, kills: 3 }); persistence.rewarded.write(false);
    const restored = bindSkyPersistence({ app, scope }, app.saves);
    expect(restored.boss.read()).toEqual({ defeated: false, rewardTaken: false, kills: 3 }); expect(restored.rewarded.read()).toBe(false);
    expect(bossesSave.read(slug)['far.roc']).toEqual({ defeated: true, rewardTaken: true, kills: 2 }); expect(old.read(slug)).toBe(true);
    expect(progressSave.read(slug)).toEqual(previous); expect(purseSave.read(slug)).toBe(35);
    expect(inventorySave.read(slug)).toEqual({ counts: { feather: 2 }, order: ['feather'] });
    expect(ownedSave.read(slug)).toEqual({ owned: ['far-fan'], worn: ['far-fan'] });
  }); } finally { scope.dispose(); }
});

it('refuses and retries pending profile writes without losing the continuation or granting twice', () => {
  localStorage.clear(); const scope = new Scope('sky.pending');
  try { withOwner(scope, () => {
    const persistence = bindSkyPersistence({ app, scope }, app.saves), progress = new Progress(source.identity.slug);
    persistence.bindProgress(progress);
    const original = localStorage.setItem.bind(localStorage);
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'wildshard.save.v2.profile') throw new Error('Quota'); original(key, value);
    });
    persistence.facts('far-reach.roc', 'far.roc'); expect(progress.checkpoint()).toBe(false);
    persistence.boss.write({ defeated: true, rewardTaken: true, kills: 1 });
    write.mockRestore(); expect(progress.checkpoint()).toBe(true);
    const before = persistence.facts.achievement('far-reach.roc'); persistence.facts('far-reach.roc', 'far.roc');
    expect(persistence.facts.achievement('far-reach.roc')).toEqual(before);
    expect(bindSkyPersistence({ app, scope }, app.saves).boss.read()).toEqual({ defeated: true, rewardTaken: true, kills: 1 });
  }); } finally { scope.dispose(); }
});
