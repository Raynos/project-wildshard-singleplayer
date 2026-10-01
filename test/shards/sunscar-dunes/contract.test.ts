// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, Scope, type Actor, type LevelDriver } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/sunscar-dunes/manifest';
import { SignalDunesPlugin } from '#shards/sunscar-dunes/plugin';
import { Bullwhip, WHIP } from '#shards/sunscar-dunes/weapons/Bullwhip';
import { DUNE_RAY, DUNE_RAY_LOOK } from '#shards/sunscar-dunes/species/duneRay';
import { FakeGame } from '../../fake/FakeGame';
import { INPUT_CONTEXTS } from '#game/inputContexts';

const noop = (): void => undefined;
async function boot(): Promise<{ app: App; plugin: SignalDunesPlugin; stages: string[]; active: Set<string>; fake: FakeGame }> {
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
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)), kit: (ctx) => plugin.kit(shardContext(ctx, manifest, game)), play: (ctx) => plugin.play(shardContext(ctx, manifest, game)) });
  fake.onUpdate((dt, time) => { for (const system of app.systemsByPhase().update) system.run(dt, time); });
  app.setState('play'); return { app, plugin, stages, active, fake };
}

describe('Signal Dunes plugin contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it('boots every stage, registers its rows and tears everything down', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.uses).toEqual(['quests', 'hover', 'coins', 'loot']);
    expect(app.registry.pieces.map((p) => p.id)).toEqual(['sunscar.tower']);
    expect(app.levelRegistrations.list('species').map((r) => r.id)).toEqual([DUNE_RAY.id]);
    expect(app.levelRegistrations.text('light')).toBe('Light the signal fire');
    expect(app.debug.scopedSnapshot()['sunscar']).toBe(plugin);
    expect(active.has('sunscar.whip')).toBe(true);
    const scope = app.levelScope; if (scope === null) throw new Error('No scope');
    expect(scope.census.disposers).toBeGreaterThan(0);
    await app.unloadLevel();
    expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]); expect(app.levelRegistrations.list('weapon')).toEqual([]);
    expect(app.debug.scopedSnapshot()).toEqual({});
  });

  it('lights the signal fire once, completes the quest and pays five coins once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    const brazier = plugin.built?.brazier; if (!brazier) throw new Error('No brazier');
    expect(plugin.quest?.quest.isComplete).toBe(false);
    brazier.onInteract(); for (const system of app.systemsByPhase().update) system.run(1 / 30, 0);
    expect(plugin.built?.lit()).toBe(true); expect(brazier.label).toBe('Signal fire lit'); expect(plugin.quest?.quest.isComplete).toBe(true);
    for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(purse.read()).toBe(before + 5);
    brazier.onInteract(); for (let i = 0; i < 90; i++) fake.advance(1 / 30); expect(purse.read()).toBe(before + 5);
    await app.unloadLevel();
    // A second visit: the fire is already lit, no second reward.
    const again = await boot(); expect(again.plugin.built?.lit()).toBe(true); expect(again.plugin.quest?.quest.isComplete).toBe(true);
    for (let i = 0; i < 90; i++) again.fake.advance(1 / 30); expect(purse.read()).toBe(before + 5);
    await again.app.unloadLevel();
  });

  it('cracks a narrow line within reach, and the double crack throws on a released touch hold', () => {
    const app = new App(), scope = new Scope('sunscar-whip'), whip = new Bullwhip(app);
    try {
      const actor: Actor = { id: 'sunscar.target', tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 }, alive: true,
        applyDamage: (req) => { actor.attributes.health -= req.amount; return false; } };
      const from = new Vector3(), dir = new Vector3(0, 0, -1);
      expect(whip.strike(actor, new Vector3(1.2, 0, -4), dir, from, false)).toBe(false);
      expect(whip.strike(actor, new Vector3(0, 0, -(WHIP.reach + 0.5)), dir, from, false)).toBe(false);
      expect(whip.strike(actor, new Vector3(0.3, 0, -(WHIP.reach - 0.5)), dir, from, false)).toBe(true);
      expect(actor.attributes.health).toBe(100 - WHIP.light);
      const swings: boolean[] = []; whip.onSwing = (heavy) => { swings.push(heavy); }; whip.install({ scope });
      app.input.press('attack'); expect(swings).toEqual([false]);
      whip.update(1); whip.adsHeld = true; whip.update(0.3); expect(whip.charge).toBeCloseTo(0.6); whip.update(0.3); expect(whip.charge).toBe(1);
      whip.adsHeld = false; whip.update(0.01); expect(swings).toEqual([false, true]); expect(whip.charge).toBe(0);
      whip.update(1); app.input.press('heavy'); expect(swings).toEqual([false, true, true]);
    } finally { scope.dispose(); app.engineScope.dispose(); }
  });

  it('declares a flying ray with body and head sockets', () => {
    expect(DUNE_RAY.flight?.above).toBe('ground');
    expect(DUNE_RAY_LOOK.rigContract.sockets.slice(0, 2)).toEqual(['body', 'head']);
  });
});
