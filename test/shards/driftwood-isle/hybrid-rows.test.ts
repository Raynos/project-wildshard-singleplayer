import { expect, it, vi } from 'vitest';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { Flags } from '../../../src/engine/world/interact/flags';
import { QuestState } from '../../../src/engine/quest/core';
import { Progress } from '../../../src/game/Progress';
import { Ledger } from '../../../src/game/ledger';
import { bindRuntimeLedger, bindRuntimeQuest, withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import { parseShardfile } from '../../../src/game/shardfile/schema';
import { inventorySave, ownedSave, progressSave, purseSave } from '../../../src/game/saves';
import manifest, { SHRINE } from '../../../src/shards/driftwood-isle/manifest';
import source from '../../../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_MARKERS } from '../../../src/shards/driftwood-isle/data/quests';
import { bindDriftwoodFacts } from '../../../src/shards/driftwood-isle/quest/facts';
import { DRIFTWOOD_FEATS } from '../../../src/shards/driftwood-isle/quest/rows';
import { DRIFTWOOD_QUEST } from '../../../src/shards/driftwood-isle/quest/questLine';

const ledger = (): Ledger => new Ledger(app.saves, [{ id: manifest.slug, shard: manifest.slug }],
  [{ shard: manifest.slug, revision: source.identity.revision, rules: source.ledger }], []);
const achievement = (id: string) => ledger().state().achievements[JSON.stringify([manifest.slug, id])];

it('declares bound quest, feat, sword and Captain rows while preserving the data-only client and authored placement', () => {
  expect(parseShardfile(source)).toEqual(source);
  expect(source.runtime?.binds).toEqual(['quests', 'ledger', 'items', 'spawns']);
  const data = withoutRuntimeRows(source);
  expect([data.quests.quests, data.ledger, data.items.rows, data.creatures.spawns]).toEqual([[], [], [], []]);
  expect(data.audio).toBe(source.audio); expect(data.edge).toBe(source.edge);
  expect(source.items.rows.map(row => [row.id, row.family])).toEqual([
    ['weapon.driftwood-isle.wood', 'driftwood-isle.wood'], ['weapon.driftwood-isle.iron', 'driftwood-isle.iron'],
  ]);
  const boss = source.runtime?.spawns?.bosses[0];
  expect(boss?.at).toEqual([SHRINE.x + 11 * Math.sin(SHRINE.rot), SHRINE.z + 11 * Math.cos(SHRINE.rot)]);
  expect(boss?.yaw).toBe(SHRINE.rot + 2 * Math.PI);
  expect(source.runtime?.spawns?.homes).toEqual([]); // specialized ecology keeps its night/distance/random-delay rules
});

it('migrates a current C26 progress save into count facts once without changing flags, inventory, title or coins', () => {
  localStorage.clear();
  const scope = new Scope('driftwood.c26');
  try {
    withOwner(scope, () => {
      const previous = { counts: Object.fromEntries(DRIFTWOOD_FEATS.map(feat => [feat.id, feat.count])),
        earned: DRIFTWOOD_FEATS.map(feat => feat.id), title: 'glass', playS: 125 };
      expect(progressSave.write(previous, manifest.slug)).toBe(true);
      expect(ownedSave.write({ owned: ['iron-sword'], worn: ['iron-sword'] }, manifest.slug)).toBe(true);
      expect(inventorySave.write({ counts: { doubloon: 5 }, order: ['doubloon'] }, manifest.slug)).toBe(true);
      expect(purseSave.write(25, manifest.slug)).toBe(true);
      const flags = new Flags(manifest.slug);
      for (const flag of ['talked:castaway', 'shard:lookout', 'shard:wreck', 'shard:cave', 'used:altar', 'dead:captain', 'seen:reward', DRIFTWOOD_QUEST.completeFlag]) flags.set(flag);
      const original = new QuestState(DRIFTWOOD_QUEST, flags);
      scope.onDispose(() => original.dispose());
      expect(original.isComplete).toBe(true);
      const progress = new Progress(manifest.slug), ctx = { app, scope, manifest };
      const bind = (): void => {
        const grants = bindDriftwoodFacts(ctx, progress.rows, progress);
        const quest = bindRuntimeQuest(ctx, source, DRIFTWOOD_QUEST.id, { flags, facts: grants.facts,
          place: marker => DRIFTWOOD_MARKERS[marker.id] });
        expect(quest.state.isComplete).toBe(true);
        expect(quest.state.objective()).toBe(original.objective());
        expect(quest.state.chip()).toEqual(original.chip());
        expect(quest.state.markers()).toEqual(original.markers());
      };
      bind();
      const earned = ledger().state();
      bind(); expect(ledger().state()).toEqual(earned);
      for (const feat of DRIFTWOOD_FEATS) expect(achievement(feat.id)).toMatchObject({ id: feat.id, title: feat.title, count: feat.count, earned: true });
      expect(progress.title?.id).toBe('glass'); expect(progress.playS).toBe(125);
      expect(progress.earnedCount).toBe(DRIFTWOOD_FEATS.length);
      expect(progress.checkpoint()).toBe(true);
      expect(progressSave.read(manifest.slug)).toEqual(previous);
      expect(ownedSave.read(manifest.slug)).toEqual({ owned: ['iron-sword'], worn: ['iron-sword'] });
      expect(inventorySave.read(manifest.slug)).toEqual({ counts: { doubloon: 5 }, order: ['doubloon'] });
      expect(purseSave.read(manifest.slug)).toBe(25);
      expect(new Flags(manifest.slug).has('dead:captain')).toBe(true);
    });
  } finally { scope.dispose(); }
});

it('continues partial kill counts from the ledger and keeps every original quest marker, anchor and chip', () => {
  localStorage.clear();
  const scope = new Scope('driftwood.partial');
  try {
    withOwner(scope, () => {
      progressSave.write({ counts: { crab10: 7, monkey6: 2 }, earned: [], title: null, playS: 0 }, manifest.slug);
      const progress = new Progress(manifest.slug), ctx = { app, scope, manifest };
      const earned = vi.fn<(def: (typeof DRIFTWOOD_FEATS)[number]) => void>(); progress.onEarned = earned;
      const first = bindDriftwoodFacts(ctx, progress.rows, progress);
      for (let n = 0; n < 3; n++) first.kill('crab');
      expect(achievement('crab10')).toMatchObject({ count: 10, earned: true });
      expect(progress.count('crab10')).toBe(10); expect(progress.earned('crab10')).toBe(true);
      expect(earned).toHaveBeenCalledTimes(1); expect(earned.mock.calls[0]?.[0]).toMatchObject({ id: 'crab10' });
      progress.recordKill('crab'); progress.recordEvent('glass', 10);
      expect(earned).toHaveBeenCalledTimes(1);
      const rebound = bindDriftwoodFacts(ctx, progress.rows, progress);
      rebound.kill('monkey'); expect(achievement('monkey6')).toMatchObject({ count: 3, earned: false });
      const flags = new Flags(manifest.slug), original = new QuestState(DRIFTWOOD_QUEST, flags);
      scope.onDispose(() => original.dispose());
      const bound = bindRuntimeQuest(ctx, source, DRIFTWOOD_QUEST.id, { flags, facts: rebound.facts,
        place: marker => DRIFTWOOD_MARKERS[marker.id] }).state;
      const same = (): void => {
        expect(bound.markers()).toEqual(original.markers()); expect(bound.chip()).toEqual(original.chip());
        expect(bound.objective()).toBe(original.objective());
      };
      same();
      for (const flag of ['talked:castaway', 'shard:lookout', 'shard:wreck', 'shard:cave', 'used:altar', 'dead:captain', 'seen:reward']) {
        flags.set(flag); same();
      }
      expect(progressSave.read(manifest.slug).counts).toEqual({ crab10: 7, monkey6: 2 });
    });
  } finally { scope.dispose(); }
});


it('refuses and retries the actual pending fact write without a second count store or grant', () => {
  const scope = new Scope('driftwood.pending');
  try { withOwner(scope, () => {
    const progress = new Progress(manifest.slug), ctx = { app, scope, manifest };
    const grants = bindDriftwoodFacts(ctx, progress.rows, progress);
    const original = localStorage.setItem.bind(localStorage);
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'wildshard.save.v2.profile') throw new Error('Profile quota');
      original(key, value);
    });
    grants.count('castaway', 1);
    expect(progress.count('castaway')).toBe(1); expect(progress.earned('castaway')).toBe(true);
    expect(progress.checkpoint()).toBe(false); expect(progress.checkpoint()).toBe(false);
    expect(progressSave.read(manifest.slug).counts).toEqual({});
    write.mockRestore(); expect(progress.checkpoint()).toBe(true);
    const before = ledger().state(); grants.count('castaway', 1);
    expect(ledger().state()).toEqual(before); expect(achievement('castaway')?.count).toBe(1);
    expect(localStorage.getItem('wildshard.save.v2.profile')).toContain('platform.ledger');
  }); } finally { scope.dispose(); }
});


it('does not replay already-authoritative counts through another placement migration', () => {
  const scope = new Scope('driftwood.authoritative');
  try { withOwner(scope, () => {
    const ctx = { app, scope, manifest }, prior = bindRuntimeLedger(ctx, source, 'prior-placement');
    for (let n = 1; n <= 7; n++) prior('driftwood.crab10', `crab10:${n}`);
    const before = ledger().state();
    const grants = bindDriftwoodFacts(ctx, [{ def: { id: 'crab10' }, count: 7 }]);
    expect(ledger().state()).toEqual(before); expect(achievement('crab10')?.count).toBe(7);
    grants.kill('crab'); expect(achievement('crab10')?.count).toBe(8);
  }); } finally { scope.dispose(); }
});
