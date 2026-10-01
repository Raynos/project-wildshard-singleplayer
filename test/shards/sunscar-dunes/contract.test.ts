// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, Scope, type Actor, type LevelDriver } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/sunscar-dunes/manifest';
import { SunscarDunesPlugin } from '#shards/sunscar-dunes/plugin';
import { Bullwhip, CRACK } from '#shards/sunscar-dunes/weapons/Bullwhip';
import { TOWER, SPAWN } from '#shards/sunscar-dunes/layout';
import { RAY_STRIKES } from '#shards/sunscar-dunes/species/duneRay';
import { FakeGame } from '../../fake/FakeGame';
import { INPUT_CONTEXTS } from '#game/inputContexts';

const noop = (): void => undefined;
async function boot(): Promise<{ app: App; plugin: SunscarDunesPlugin; stages: string[]; active: Set<string>; fake: FakeGame }> {
  const fake = new FakeGame();
  const app = new App(), plugin = new SunscarDunesPlugin(), stages: string[] = [], active = new Set<string>(), bag = new TabRegistry();
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
describe('sunscar-dunes plugin contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every stage, registers its rows and pieces, and tears them down', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.slug).toBe('sunscar-dunes');
    expect(app.registry.pieces.map((p) => p.id)).toEqual(['sunscar.tower']);
    expect(app.levelRegistrations.list('species').map((r) => r.id)).toEqual(['sunscar.creature.duneRay']);
    expect(app.levelRegistrations.text('kindle')).toBe('Light the signal fire'); expect(app.debug.scopedSnapshot()['sunscar']).toBe(plugin);
    expect(plugin.quest?.index).toBe(0);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]);
    expect(app.levelRegistrations.list('weapon')).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('reaches the tower, lights the fire and pays five coins once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    plugin.player.set(TOWER.x, 0, TOWER.z - 4); for (const system of app.systemsByPhase().update) system.run(1 / 30, 1);
    expect(plugin.quest?.index).toBe(1);
    plugin.built?.interact.onInteract(); app.events.flush('update');
    expect(plugin.lit).toBe(true); expect(plugin.built?.fire.visible).toBe(true); expect(plugin.built?.interact.label).toBe('Signal fire lit');
    expect(plugin.quest?.isComplete).toBe(true); for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(purse.read()).toBe(before + 5);
    plugin.built?.interact.onInteract(); for (let i = 0; i < 30; i++) fake.advance(1 / 30); expect(purse.read()).toBe(before + 5);
    await app.unloadLevel();
  });
  it('keeps every dune face walkable and the spawn on its crest', () => {
    const t = manifest.ground.terrain; if (t === undefined) throw new Error('No terrain');
    let steepest = 0;
    for (let x = -240; x <= 240; x += 3) for (let z = -240; z <= 240; z += 3) {
      const gx = (t.heightAt(x + 0.5, z) - t.heightAt(x - 0.5, z)), gz = (t.heightAt(x, z + 0.5) - t.heightAt(x, z - 0.5));
      steepest = Math.max(steepest, Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI);
    }
    expect(steepest).toBeLessThan(40);
    expect(t.heightAt(SPAWN.x, SPAWN.z)).toBeGreaterThan(t.heightAt(SPAWN.x, SPAWN.z + 40));
  });
  it('cracks inside a long, narrow lane only, and the hold releases a double crack', () => {
    const app = new App(), scope = new Scope('sunscar-whip'), whip = new Bullwhip(app), swings: boolean[] = [];
    const actor: Actor = { id: 'sunscar.target', tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 }, alive: true,
      applyDamage: (req) => { actor.attributes.health -= req.amount; return false; } };
    try {
      expect(whip.strike(actor, new Vector3(1.5, 0, -4), new Vector3(0, 0, -1), new Vector3(), false)).toBe(false);
      expect(whip.strike(actor, new Vector3(0, 0, -(CRACK.light.reach + 0.5)), new Vector3(0, 0, -1), new Vector3(), false)).toBe(false);
      expect(whip.strike(actor, new Vector3(0, 0, -6), new Vector3(0, 0, -1), new Vector3(), false)).toBe(true);
      expect(actor.attributes.health).toBe(100 - CRACK.light.damage);
      whip.onSwing = (heavy) => { swings.push(heavy); }; whip.install({ scope });
      app.input.press('attack'); expect(swings).toEqual([false]);
      whip.update(1); whip.adsHeld = true; whip.update(0.3); whip.update(0.3); expect(whip.charge).toBe(1);
      whip.adsHeld = false; whip.update(0.01); expect(swings).toEqual([false, true]);
      expect(RAY_STRIKES[0]?.shape.kind).toBe('sphere');
    } finally { scope.dispose(); app.engineScope.dispose(); }
  });
});
