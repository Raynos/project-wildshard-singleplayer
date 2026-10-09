// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrikeRunner } from '../../../src/engine/ai/strikes';
import { App } from '../../../src/engine/app/app';
import { withOwner } from '../../../src/engine/app/ownership';
import type { Actor } from '../../../src/engine/combat/pipeline';
import type { LevelDriver } from '../../../src/engine/level/load';
import { TabRegistry } from '../../../src/engine/ui/tabs';
import { WorldRegistry } from '../../../src/engine/world/registry';
import { bossesSave, inventorySave, ownedSave, progressSave, purseSave, shardSave } from '../../../src/game/saves';
import { shardContext, type GameServices, type ShardContext } from '../../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../../src/game/shard/retainedHooks';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { Vector3 } from 'three';
import manifest from '../../../src/shards/sunscar-dunes/manifest';
import { SignalDunesPlugin } from '../../../src/shards/sunscar-dunes/plugin';
import { Bullwhip, CRACK } from '../../../src/shards/sunscar-dunes/weapons/Bullwhip';
import { COMPLETE_FLAG, LATER_FLAGS, MATRIARCH_DEFEATED_FLAG, MATRIARCH_FLAG, MATRIARCH_PAID_FLAG, PAID_FLAG } from '../../../src/shards/sunscar-dunes/quests/signal';
import { LEGACY_SIGNAL } from '../../../src/shards/sunscar-dunes/quest/install';
import { SIGNAL_LEDGER } from '../../../src/shards/sunscar-dunes/data/ledger';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import { Ledger } from '../../../src/game/ledger';
import { Progress } from '../../../src/game/Progress';
import { bindSignalFacts } from '../../../src/shards/sunscar-dunes/runtime/persistence';
import { saves } from '../../../src/engine/saves/runtime';
import { Flags } from '../../../src/engine/world/interact/flags';
import { SCOUT_FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { SWOOP } from '../../../src/shards/sunscar-dunes/runtime/species/duneRay';
import { DUNE_RAY } from '../../../src/shards/sunscar-dunes/data/species/duneRay';
import { DUNE_RAY_LOOK } from '../../../src/shards/sunscar-dunes/species/duneRay';
import { FakeGame } from '../../fake/FakeGame';
import { INPUT_CONTEXTS } from '../../../src/game/inputContexts';
import { DUSK, setDusk } from '../../../src/shards/sunscar-dunes/look/dusk';

const noop = (): void => undefined;
const ledger = (app: App): Ledger => new Ledger(app.saves, [{ id: manifest.slug, shard: source.identity.slug }], [{ shard: source.identity.slug, revision: source.identity.revision, rules: SIGNAL_LEDGER }], []);
const achievements = (app: App): Record<string, boolean> => Object.fromEntries(Object.values(ledger(app).state().achievements).filter((a) => a.shard === manifest.slug).map((a) => [a.id, a.earned]));
async function boot(retained = false): Promise<{ app: App; plugin: SignalDunesPlugin; stages: string[]; active: Set<string>; fake: FakeGame; hooks: RetainedRuntimeHooks | null }> {
  const fake = new FakeGame();
  const app = new App(), plugin = new SignalDunesPlugin(), stages: string[] = [], active = new Set<string>(), bag = new TabRegistry();
  for (const context of INPUT_CONTEXTS) app.input.register(context, app.engineScope);
  const game: GameServices = { shard: manifest, rows: new Map(), bag };
  app.registryValue = new WorldRegistry();
  const add = (name: string): (() => void) => { active.add(name); return () => { active.delete(name); }; };
  app.levelAdapters = { inputContext: (def) => { const scope = app.levelScope; if (scope === null) throw new Error('No input scope'); app.input.register(def, scope); app.input.push(def.id, scope); return add(def.id); },
    debugRow: () => add('debug'), playground: () => add('playground'), hud: { widget: () => add('widget'), pin: () => add('pin'), relabel: () => add('relabel'),
      verb: () => add('verb'), disc: () => ({ button: document.createElement('button'), dispose: add('disc') }) } };
  const stage = (id: string): void => { stages.push(id); };
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: () => stage('data'), world: () => stage('world'), kit: () => stage('kit'),
    loadout: (_spec, ctx) => { stage('loadout'); expect(ctx.app.levelRegistrations.list('weapon').map((r) => r.id)).toEqual(['weapon.sunscar-whip']); },
    play: () => stage('play'), finish: () => stage('finish') };
  app.levelDriver = driver;
  let hooks: RetainedRuntimeHooks | null = null;
  const context = (ctx: Parameters<typeof shardContext>[0]): ShardContext => {
    if (!retained) return shardContext(ctx, manifest, game);
    hooks ??= new RetainedRuntimeHooks(shardContext(ctx, manifest, game));
    return hooks.context;
  };
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(context(ctx)), kit: (ctx) => plugin.kit(context(ctx)), play: (ctx) => plugin.play(context(ctx)) });
  fake.onUpdate((dt, time) => { for (const system of app.systemsByPhase().update) system.run(dt, time); });
  app.setState('play'); return { app, plugin, stages, active, fake, hooks };
}
const target = (health = 70): Actor => { const actor: Actor = { id: 'sunscar.target', tags: ['actor.creature', 'creature.duneRay'], state: [], attributes: { health, maxHealth: health }, alive: true,
  applyDamage: (req) => { actor.attributes.health -= req.amount; return false; } }; return actor; };

describe('Signal Dunes plugin contract', () => {
  // No asset server exists in Node: refuse network fetches at once, so a failed optional load settles inside its test instead of
  // retrying localhost and logging after the worker has torn down (the EnvironmentTeardownError the push gate saw).
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline contract test: no asset server'))); });
  afterEach(() => { vi.unstubAllGlobals(); });
  it('retains authored quest state while parked input and dusk callbacks disappear through two re-entries', async () => {
    const { app, plugin, fake, hooks } = await boot(true);
    if (hooks === null || plugin.places === null || app.levelScope === null) throw new Error('Missing retained Dunes context');
    const quest = plugin.quest, pieces = app.registry.pieces.map(piece => piece.id), scope = app.levelScope;
    try {
      plugin.places.flags.set(SCOUT_FLAG); app.events.flush('update');
      expect(plugin.quest?.index).toBe(1);
      for (let visit = 0; visit < 2; visit++) {
        app.input.push('sunscar.whip', scope);
        expect(app.input.allowed('attack')).toBe(true);
        expect(app.systemsByPhase().update.filter(system => system.id === 'sunscar.dusk')).toHaveLength(1);
        hooks.deactivate();
        expect(() => app.input.push('sunscar.whip', scope)).toThrow('Unknown input context');
        expect(app.systemsByPhase().update.some(system => system.id.startsWith('sunscar.'))).toBe(false);
        setDusk(0.83, true);
        for (let tick = 0; tick < 600; tick++) fake.advance(1 / 60);
        expect(DUSK.value).toBe(0.83);
        expect(app.registry.pieces.map(piece => piece.id)).toEqual(pieces);
        hooks.activate();
        expect(plugin.quest).toBe(quest); expect(plugin.quest?.index).toBe(1);
        expect(DUSK.value).toBe(0.5);
      }
    } finally { await app.unloadLevel(); }
    expect(app.systemsByPhase().update.some(system => system.id.startsWith('sunscar.'))).toBe(false);
  });
  it('boots every stage and tears down registrations and resources', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.audio?.preload).toBeUndefined(); expect(manifest.audio?.ambience).toBe('none');
    expect(app.registry.pieces.map((p) => p.id)).toEqual(['sunscar.tower', 'sunscar.caravan', 'sunscar.well', 'sunscar.rocks', 'sunscar.dressing', 'sunscar.brazier.0', 'sunscar.brazier.1', 'sunscar.brazier.2']);
    expect(app.levelRegistrations.list('species')).toHaveLength(4);
    expect(app.levelRegistrations.text('step')).toBe('Light the signal fire'); expect(app.debug.scopedSnapshot()['sunscar']).toBe(plugin);
    expect(plugin.quest?.chip().label).toBe('Light signal fire');
    const scope = app.levelScope; if (scope === null) throw new Error('No scope');
    expect(scope.census.disposers).toBeGreaterThan(0);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]);
    expect(app.levelRegistrations.list('weapon')).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('runs the six-step chain: Sefa the scout, logbook, the well pulled by a heavy crack, three waymarks lit by the lash, the signal fire, the Matriarch; pays 5 coins once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read(), places = plugin.places;
    if (places === null) throw new Error('no places');
    const step = (): number | undefined => { app.events.flush('update'); return plugin.quest?.index; };
    expect(step()).toBe(0); expect(plugin.fire?.lit).toBe(false);
    places.flags.set(SCOUT_FLAG); expect(step()).toBe(1); // her first talk starts the quest (P4)
    places.fire.brazier.onInteract(); expect(plugin.fire?.lit).toBe(false); // the waymarks come first
    places.logbook.onInteract(); expect(step()).toBe(2);
    places.well.spot.onInteract(); expect(step()).toBe(2); // the bucket is still down the shaft
    const crank = places.crackables[0], whip = new Bullwhip(app); if (!crank) throw new Error('no crank');
    whip.aimAt(places.crackables);
    const from = crank.at.clone().add(new Vector3(0, 0, 5)), dir = new Vector3(0, 0, -1);
    expect(crank.crack(false, false)).toBe(true); expect(places.well.raised).toBe(false); // a light crack only hints
    expect(crank.crack(true, true)).toBe(true); expect(places.well.raised).toBe(true);
    places.well.spot.onInteract(); expect(step()).toBe(3);
    for (const b of places.braziers) {
      expect(b.light()).toBe(false); b.spot.onInteract(); expect(b.oiled).toBe(true);
      whip.swing(false); expect(whip.crackWorld(b.parts.bowlAt.clone().add(new Vector3(0, 0, 5)), dir, CRACK.reach, false)).not.toBeNull(); expect(b.lit).toBe(true);
    }
    expect(whip.crackWorld(from, dir, CRACK.reach, false)).toBeNull();
    expect(step()).toBe(4); expect(places.litCount).toBe(3); expect(plugin.matriarch?.state).toBe('dormant');
    places.fire.brazier.onInteract(); app.events.flush('update');
    expect(plugin.matriarch?.state).toBe('armed'); // the signal summons the Dune Matriarch
    expect(plugin.fire?.lit).toBe(true); expect(plugin.fire?.brazier.label).toBe('Signal fire lit');
    // P4: the Matriarch is the last step; the signal reward pays after her fall.
    expect(step()).toBe(5); expect(plugin.quest?.isComplete).toBe(false);
    for (let i = 0; i < 30; i++) fake.advance(1 / 30);
    expect(purse.read()).toBe(before);
    places.flags.set(MATRIARCH_FLAG); app.events.flush('update'); expect(plugin.quest?.isComplete).toBe(true);
    for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(fake.dead).toBe(false); expect(purse.read()).toBe(before + 5);
    plugin.fire?.brazier.onInteract(); for (let i = 0; i < 30; i++) fake.advance(1 / 30); expect(purse.read()).toBe(before + 5);
    await app.unloadLevel();
  });
  it('writes no reward save of its own: the paid reward is a quest flag and the finished quest a ledger fact granting its achievement once (SF14)', async () => {
    const { app, plugin, fake } = await boot(), places = plugin.places; if (places === null) throw new Error('no places');
    const legacy = app.saves.define(LEGACY_SIGNAL);
    for (const flag of [SCOUT_FLAG, ...LATER_FLAGS.filter((f) => f !== MATRIARCH_FLAG)]) places.flags.set(flag);
    app.events.flush('update'); expect(achievements(app)).toEqual({});
    places.flags.set(MATRIARCH_FLAG); app.events.flush('update');
    for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(places.flags.has(PAID_FLAG)).toBe(true); expect(legacy.read(manifest.slug)).toBe(false);
    expect(shardSave(bossesSave, manifest.slug).read()).toEqual({}); expect(plugin.matriarch?.defeated).toBe(false); // the flag alone is no fight
    expect(achievements(app)).toEqual({ 'sunscar.signal': true }); // the flag alone, no boss fight: no Matriarch feat
    const facts = Object.keys(ledger(app).state().facts).length;
    await app.unloadLevel();
    const again = await boot(); again.app.events.flush('update');
    expect(Object.keys(ledger(again.app).state().facts)).toHaveLength(facts); // the reloaded feats are the same facts
    await again.app.unloadLevel();
  });
  it('migrates a current Signal Dunes save (C26): the old paid record becomes the flag, no second payout, old feats grant once', async () => {
    // the save as the shipped build leaves it: every quest flag, the reward paid in `sunscar.signal`, the Matriarch beaten
    const flags = new Flags(manifest.slug);
    for (const flag of [SCOUT_FLAG, ...LATER_FLAGS, COMPLETE_FLAG]) flags.set(flag);
    shardSave(bossesSave, manifest.slug).write({ 'sunscar.matriarch': { defeated: true, rewardTaken: true, kills: 1 } });
    const purse = shardSave(purseSave, manifest.slug); purse.write(25);
    const metadata = { counts: {}, earned: [], title: null, playS: 125 };
    progressSave.write(metadata, manifest.slug);
    inventorySave.write({ counts: { feather: 2 }, order: ['feather'] }, manifest.slug);
    ownedSave.write({ owned: ['sunscar-whip'], worn: ['sunscar-whip'] }, manifest.slug);
    saves.define(LEGACY_SIGNAL).write(true, manifest.slug);
    const loaded = await boot(); loaded.app.events.flush('update');
    for (let i = 0; i < 90; i++) loaded.fake.advance(1 / 30);
    expect(loaded.plugin.quest?.isComplete).toBe(true); expect(loaded.plugin.places?.flags.has(PAID_FLAG)).toBe(true);
    expect(purse.read()).toBe(25); // paid once, under the old record
    // her old bossesSave entry is carried over as her flags (SF50-p) and never written again
    expect([MATRIARCH_DEFEATED_FLAG, MATRIARCH_PAID_FLAG].map((flag) => loaded.plugin.places?.flags.has(flag))).toEqual([true, true]);
    expect(loaded.plugin.matriarch?.defeated).toBe(true); expect(loaded.plugin.matriarch?.rewardTaken).toBe(true);
    expect(achievements(loaded.app)).toEqual({ 'sunscar.signal': true, 'sunscar.matriarch': true });
    const facts = Object.keys(ledger(loaded.app).state().facts).length; expect(facts).toBe(2);
    const scope = loaded.app.levelScope; if (scope === null) throw new Error('Missing migrated level scope');
    const progress = withOwner(scope, () => new Progress(manifest.slug));
    const emitted = bindSignalFacts({ app: loaded.app }, progress);
    expect(progress.rows).toEqual([]); expect(progress.playS).toBe(125);
    expect(emitted.achievement('sunscar.signal')).toEqual({ count: 1, earned: true });
    expect(emitted.achievement('sunscar.matriarch')).toEqual({ count: 1, earned: true });
    expect(progress.checkpoint()).toBe(true);
    const profile = localStorage.getItem('wildshard.save.v2.profile');
    await loaded.app.unloadLevel();
    const third = await boot(); third.app.events.flush('update');
    expect(Object.keys(ledger(third.app).state().facts)).toHaveLength(2);
    expect(localStorage.getItem('wildshard.save.v2.profile')).toBe(profile);
    expect(shardSave(bossesSave, manifest.slug).read()).toEqual({ 'sunscar.matriarch': { defeated: true, rewardTaken: true, kills: 1 } });
    expect(saves.define(LEGACY_SIGNAL).read(manifest.slug)).toBe(true);
    expect(progressSave.read(manifest.slug)).toEqual(metadata); expect(purse.read()).toBe(25);
    expect(inventorySave.read(manifest.slug)).toEqual({ counts: { feather: 2 }, order: ['feather'] });
    expect(ownedSave.read(manifest.slug)).toEqual({ owned: ['sunscar-whip'], worn: ['sunscar-whip'] });
    await third.app.unloadLevel();
  });
  it('resumes a mid-quest save from before Sefa past her step, and skips her step once a later one is done', async () => {
    const first = await boot(), places = first.plugin.places; if (places === null) throw new Error('no places');
    places.logbook.onInteract(); first.app.events.flush('update');
    expect(first.plugin.quest?.index).toBe(2); // walked past her to the caravan: the logbook also passes her step
    expect(places.flags.has(SCOUT_FLAG)).toBe(false); await first.app.unloadLevel();
    // the save as loop 1 left it: the logbook read, no scout flag
    const again = await boot(); again.app.events.flush('update');
    expect(again.plugin.places?.flags.has(SCOUT_FLAG)).toBe(true); expect(again.plugin.quest?.index).toBe(2);
    await again.app.unloadLevel();
  });
  it('cracks a narrow lane through the damage pipeline: 7 m light, 8 m heavy', async () => {
    const { app } = await boot(), whip = new Bullwhip(app), dir = new Vector3(0, 0, -1), from = new Vector3();
    const ray = target();
    expect(whip.strike({ actor: ray }, new Vector3(1.5, 0, -4), dir, from, false)).toBe(false);
    expect(whip.strike({ actor: ray }, new Vector3(0, 0, -7.5), dir, from, false)).toBe(false);
    expect(whip.strike({ actor: ray }, new Vector3(0.5, 0, -6.5), dir, from, false)).toBe(true); expect(ray.attributes.health).toBe(70 - CRACK.light);
    expect(whip.strike({ actor: ray }, new Vector3(0, 0.4, -7.8), dir, from, true, true)).toBe(true); expect(ray.attributes.health).toBe(70 - CRACK.light - CRACK.heavy);
    await app.unloadLevel();
  });
  it('declares a flying ray with a body/head custom rig and a chest-height sphere swoop', () => {
    expect(DUNE_RAY.flight?.above).toBe('ground'); expect(DUNE_RAY_LOOK.rigContract.sockets.slice(0, 2)).toEqual(['body', 'head']);
    expect(SWOOP.shape.kind).toBe('sphere');
    const runner = new StrikeRunner(), hits: number[] = [];
    const actor = { position: new Vector3(0, 2.4, -1.5), alive: true, scale: 1, yaw: 0, startAttack: noop, cancelAttack: noop, setMotion: noop };
    const chest = new Vector3(0, 1.2, 0), ctx = { actor, target: chest, canReach: () => true, hit: () => { hits.push(SWOOP.damage); } };
    const pick = runner.pick([SWOOP], ctx); expect(pick?.id).toBe('sunscar.ray.swoop'); if (pick) runner.start(pick, actor, chest);
    for (let i = 0; i < 40; i++) runner.update(1 / 30, ctx);
    expect(hits).toEqual([14]);
    actor.position.set(0, 9, -1.5); expect(runner.pick([SWOOP], ctx)).toBeNull();
  });
});
