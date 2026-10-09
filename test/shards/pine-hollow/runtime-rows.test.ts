import { describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { appIdentity } from '../../../src/engine/app/identity';
import { Flags } from '../../../src/engine/world/interact/flags';
import { QuestState } from '../../../src/engine/quest/core';
import { Progress } from '../../../src/game/Progress';
import { Ledger, LedgerEmitter } from '../../../src/game/ledger';
import { SaveStore } from '../../../src/engine/saves/store';
import { bindRuntimeLedger, bindRuntimeQuest, bindRuntimeState, withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import source from '../../../src/shards/pine-hollow/shard.config';
import { PINE_FEATS } from '../../../src/shards/pine-hollow/feats';
import { WARDENS_HOLLOW, QUEST_EXTERNAL, QUEST_DONE } from '../../../src/shards/pine-hollow/quest/wardensHollow';
import { loadBoard, saveBoard, reroll } from '../../../src/shards/pine-hollow/quest/contracts';
import { bindPineCombatState } from '../../../src/shards/pine-hollow/runtime/persistence';
import { bindPineFacts } from '../../../src/shards/pine-hollow/runtime/facts';
import { createPineFacts, recordPineFeatKill } from '../../../src/shards/pine-hollow/quest/featLaw';
import { bindPineItems } from '../../../src/shards/pine-hollow/runtime/items';
import { CROSSBOW, LEVER, LONGBOW } from '../../../src/shards/pine-hollow/weapons/equipment';
import type { Weapon } from '../../../src/engine/combat/Weapon';
import type { GameServices } from '../../../src/game/shard/context';
import { legacyDouble } from '../../fake/FakeGame';
import { FakeStorage } from '../../fake/fakeStorage';

const slug = 'pine-hollow', saveKey = (): string => appIdentity().savePrefix + slug;
const legacy = () => ({ lodge: loadBoard({ getItem: () => null, setItem: () => undefined }), loadout: { pitch: 4, broadhead: 7, rounds: 19, arrows: 8 },
  bosses: { 'antler-king': { defeated: true, rewardTaken: false, kills: 2 } },
  elites: { ironhide: { timer: 34, discovered: true, skinTaken: true, kills: 1, retired: false } },
  progress: { counts: { deer5: 4, lanterns: 2, king: 1, streak: 3 }, earned: ['king'], title: 'king', playS: 246 } });
const seed = (): ReturnType<typeof legacy> => {
  const current = legacy(); current.lodge.streak = 3;
  localStorage.setItem(saveKey(), JSON.stringify({ keys: Object.fromEntries(Object.entries(current).map(([key, data]) => [key, { v: 1, data }])) }));
  return current;
};

describe('Pine runtime-owned declarations (SF47-p, C26)', () => {
  it('files two thrall deaths as two achievement increments across real tick identities, not replayed old counters', () => {
    const store = new SaveStore({ local: new FakeStorage() });
    const ledger = new Ledger(store, [{ id: slug, shard: slug }], [{ shard: slug, revision: source.identity.revision, rules: source.ledger }], []);
    let tick = 1, counts: Record<string, number> = {};
    const emitter = new LedgerEmitter(ledger, { instance: slug, shard: slug, revision: source.identity.revision },
      { kind: 'engine', source: 'pine.progress' }, () => tick, []);
    const facts = createPineFacts({ read: () => ({ ...counts }), write: next => { counts = next; }, emit: (fact, entity) => { emitter.emit(fact, entity); } });
    recordPineFeatKill(facts, { kind: 'boar', variant: 'thrall' }); tick++;
    recordPineFeatKill(facts, { kind: 'boar', variant: 'thrall' }); tick++;
    facts.event('thrall', 2);
    expect([counts['boar5'], counts['thralls']]).toEqual([2, 2]);
    const state = ledger.state();
    expect(Object.values(state.achievements).map(row => [row.id, row.count])).toEqual([['pine-hollow.boar5', 2], ['pine-hollow.thralls', 2]]);
    expect(Object.values(state.facts).map(row => [row.entity, row.tick])).toEqual([['boar5:1', 1], ['thralls:1', 1], ['boar5:2', 2], ['thralls:2', 2]]);
  });

  it('admits the shipping quest, three native item identities, facts and King body while leaving their runtime the owner', () => {
    expect(source.runtime?.binds).toEqual(['quests', 'ledger', 'items', 'spawns', 'state']);
    const { onComplete, ...quest } = source.quests.quests[0] ?? {};
    expect(quest).toEqual(WARDENS_HOLLOW); expect(onComplete).toEqual({ fact: 'pine.feat.quest' });
    expect(source.items.rows.map(row => [row.id, row.family, row.kind === 'weapon' ? row.context : null])).toEqual([
      ['weapon.crossbow', 'pine-hollow.crossbow', 'weapon.ranged'], ['weapon.lever', 'pine-hollow.lever', 'weapon.ranged'], ['weapon.longbow', 'pine-hollow.longbow', 'weapon.bow'],
    ]);
    expect(source.runtime?.spawns?.bosses).toEqual([{ id: 'pine.antler-king', kind: 'antler-king', look: 'warden', at: [150, -30], yaw: 0 }]);
    const data = withoutRuntimeRows(source);
    expect([data.quests.quests.length, data.items.rows.length, data.ledger.length, data.state.shared.length]).toEqual([0, 0, 0, 0]);
    expect(data.audio).toBe(source.audio); expect(data.edge).toBe(source.edge);
  });

  it('replays the actual shipping quest steps and current flags over the declared runtime quest', () => {
    const scope = app.engineScope.child('pine.rows.quest');
    const oldFlags = new Flags('pine.oracle'), flags = new Flags(slug), oracle = new QuestState(WARDENS_HOLLOW, oldFlags);
    const facts = bindRuntimeLedger({ app }, source, slug);
    try {
      const bound = bindRuntimeQuest({ app, scope }, source, 'wardens-hollow', { flags, facts }).state;
      for (const flag of QUEST_EXTERNAL) {
        oldFlags.set(flag); flags.set(flag); app.events.flush('update');
        expect([bound.current?.id, bound.objective(), bound.isComplete, bound.markers()]).toEqual([oracle.current?.id, oracle.objective(), oracle.isComplete, oracle.markers()]);
      }
      expect(flags.has(QUEST_DONE)).toBe(true);
      expect(bindRuntimeQuest({ app, scope }, source, 'wardens-hollow', { flags, facts }).state.isComplete).toBe(true);
    } finally { oracle.dispose(); scope.dispose(); }
  });

  it('migrates a current save exactly once, preserves board draws/ammo/encounters, and writes only declared continuations', () => {
    const current = seed(), scope = app.engineScope.child('pine.rows.c26');
    try {
      const lodgeRead = vi.fn(() => JSON.stringify(current.lodge)), ammoRead = vi.fn(() => JSON.stringify(current.loadout));
      const lodge = bindRuntimeState({ app, scope }, source, 'pine.lodge', lodgeRead);
      const ammo = bindRuntimeState({ app, scope }, source, 'pine.loadout', ammoRead);
      const storage = { getItem: () => String(lodge.read()), setItem: (_key: string, value: string) => { lodge.write(value); } };
      const board = loadBoard(storage); expect(board).toEqual(current.lodge); reroll(board, 0); saveBoard(board, storage);
      ammo.write(JSON.stringify({ ...current.loadout, pitch: 3 }));
      const encounters = bindPineCombatState({ app, scope }, slug);
      expect(encounters.bosses.read(slug)).toEqual(current.bosses); expect(encounters.elites.read(slug)).toEqual(current.elites);
      encounters.bosses.write({ 'antler-king': { defeated: true, rewardTaken: true, kills: 3 } }, slug);
      encounters.elites.write({ ironhide: { ...current.elites.ironhide, timer: 0, retired: true } }, slug);
      expect(loadBoard({ getItem: () => String(bindRuntimeState({ app, scope }, source, 'pine.lodge', lodgeRead).read()), setItem: () => undefined })).toEqual(board);
      expect(bindRuntimeState({ app, scope }, source, 'pine.loadout', ammoRead).read()).toBe(JSON.stringify({ ...current.loadout, pitch: 3 }));
      expect(lodgeRead).toHaveBeenCalledTimes(1); expect(ammoRead).toHaveBeenCalledTimes(1);
      const saved: unknown = JSON.parse(localStorage.getItem(saveKey()) ?? 'null');
      expect(saved).toMatchObject({ keys: Object.fromEntries(Object.entries(current).map(([key, data]) => [key, { v: 1, data }])) });
      expect(() => encounters.bosses.read('other-instance')).toThrow('another instance');
      scope.dispose(); expect(() => ammo.write('{}')).toThrow('disposed'); expect(() => encounters.elites.read(slug)).toThrow('disposed');
    } finally { scope.dispose(); }
  });

  it('migrates partial feat counters, preserves the worn title, and deduplicates gameplay outcomes across reload', () => {
    const current = seed(), scope = app.engineScope.child('pine.rows.feats'), progress = new Progress(slug), earned = vi.fn();
    progress.onEarned = (feat) => { earned(feat); };
    try {
      const facts = bindPineFacts({ app, scope }, progress, slug);
      expect([progress.count('deer5'), progress.count('lanterns'), progress.title?.id, progress.playS]).toEqual([4, 2, 'king', 246]);
      expect(earned).not.toHaveBeenCalled(); facts.kill('deer'); facts.event('lantern', 3); facts.event('lantern', 3);
      expect([progress.count('deer5'), progress.count('lanterns'), progress.earned('deer5'), progress.title?.id]).toEqual([5, 3, true, 'king']);
      expect(earned).toHaveBeenCalledTimes(2); expect(progress.checkpoint()).toBe(true);
      const reload = new Progress(slug), again = bindPineFacts({ app, scope }, reload, slug); again.event('lantern', 3);
      expect([reload.count('deer5'), reload.count('lanterns'), reload.title?.id, reload.playS]).toEqual([5, 3, 'king', 246]);
      expect(current.progress.counts).toEqual({ deer5: 4, lanterns: 2, king: 1, streak: 3 });
      const ledger = new Ledger(app.saves, [{ id: slug, shard: slug }], [{ shard: slug, revision: source.identity.revision, rules: source.ledger }], []);
      expect(Object.values(ledger.state().achievements).find(row => row.id === 'pine-hollow.deer5')?.count).toBe(5);
    } finally { scope.dispose(); }
  });

  it('matches the actual shipping Progress policy for every feat, including variant overlap and saturated repeats', () => {
    const scope = app.engineScope.child('pine.rows.progress-oracle'), oracle = new Progress(slug), bound = new Progress(slug);
    const expected: string[] = [], actual: string[] = [];
    oracle.onEarned = (feat) => { expected.push(feat.id); }; bound.onEarned = (feat) => { actual.push(feat.id); };
    try {
      const facts = bindPineFacts({ app, scope }, bound, slug);
      let counts: Record<string, number> = {};
      const identities = new Set<string>(); let emissions = 0;
      const hostFacts = createPineFacts({ read: () => ({ ...counts }), write: next => { counts = next; },
        emit: (fact, entity) => { identities.add(`${fact}/${entity}`); emissions++; } });
      for (const feat of PINE_FEATS) for (let n = 0; n < feat.count + 2; n++) {
        if (feat.kind !== undefined) { oracle.recordKill(feat.kind, feat.variant); facts.kill(feat.kind, feat.variant); hostFacts.kill(feat.kind, feat.variant); }
        else if (feat.event !== undefined) { oracle.recordEvent(feat.event); facts.event(feat.event); hostFacts.event(feat.event); }
        expect(bound.rows).toEqual(oracle.rows); expect(actual).toEqual(expected);
        for (const row of oracle.rows) expect(counts[row.def.id] ?? 0).toBe(row.count);
      }
      for (const feat of PINE_FEATS) if (feat.event !== undefined) {
        oracle.recordEvent(feat.event, feat.count - 1); facts.event(feat.event, feat.count - 1); hostFacts.event(feat.event, feat.count - 1);
        expect(bound.rows).toEqual(oracle.rows);
      }
      expect(bound.earnedCount).toBe(PINE_FEATS.length); expect(bound.checkpoint()).toBe(true);
      expect(identities.size).toBe(PINE_FEATS.reduce((sum, feat) => sum + feat.count, 0));
      expect(emissions).toBe(identities.size); // Each gameplay tick can submit only newly reached IDs; legacy replay is separate.
    } finally { scope.dispose(); }
  });

  it('adopts prebuilt native weapons with identical presentation and saved held ids', () => {
    const scope = app.engineScope.child('pine.rows.items');
    const make = (row: typeof CROSSBOW): Weapon => {
      if (row.legacySlot === undefined) throw new Error('Missing native compatibility slot');
      return legacyDouble<Weapon>({ row, id: row.legacySlot });
    };
    const weapons = { primary: make(CROSSBOW), rifle: make(LEVER), secondary: make(LONGBOW) };
    const game = legacyDouble<GameServices>({ runtime: legacyDouble<NonNullable<GameServices['runtime']>>({ world: legacyDouble<NonNullable<NonNullable<GameServices['runtime']>['world']>>({ game: legacyDouble<NonNullable<NonNullable<GameServices['runtime']>['world']>['game']>({ scene: new Scene() }) }) }) });
    try {
      app.input.register({ id: 'weapon.ranged', actions: ['attack', 'aim', 'reload'] }, scope);
      app.input.register({ id: 'weapon.bow', actions: ['attack', 'aim'] }, scope);
      bindPineItems({ app, scope, game }, weapons);
      for (const [weapon, native, context] of [[weapons.primary, CROSSBOW, 'weapon.ranged'], [weapons.rifle, LEVER, 'weapon.ranged'], [weapons.secondary, LONGBOW, 'weapon.bow']] as const) {
        expect(weapon.row.id).toBe(native.id); expect(weapon.row.legacySlot).toBe(native.legacySlot); expect(weapon.row.meta).toEqual(native.meta);
        expect(weapon.row.ui).toEqual({ ...native.ui, inputContext: context });
        expect([weapon.row.cues, weapon.row.hitStop, weapon.row.rangedFeel]).toEqual([native.cues, native.hitStop, native.rangedFeel]);
      }
    } finally { scope.dispose(); }
  });
});
