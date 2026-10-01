// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, StrikeRunner, type Actor, type LevelDriver, type StrikeActor } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/sunscar-dunes/manifest';
import { SunscarDunesPlugin } from '#shards/sunscar-dunes/plugin';
import { SignalWhip, CRACK } from '#shards/sunscar-dunes/weapons/SignalWhip';
import { RAY_STRIKES, rayGeometry } from '#shards/sunscar-dunes/species/duneRay';
import { CREST, SPAWN } from '#shards/sunscar-dunes/layout';
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
    loadout: (_spec, ctx) => { stage('loadout'); expect(ctx.app.levelRegistrations.list('weapon').map((r) => r.id)).toEqual(['weapon.signal-bullwhip']); },
    play: () => stage('play'), finish: () => stage('finish') };
  app.levelDriver = driver;
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)), kit: (ctx) => plugin.kit(shardContext(ctx, manifest, game)), play: (ctx) => plugin.play(shardContext(ctx, manifest, game)) });
  fake.onUpdate((dt, time) => { for (const system of app.systemsByPhase().update) system.run(dt, time); });
  app.setState('play'); return { app, plugin, stages, active, fake };
}
const fakeRay = (y: number): StrikeActor & { position: Vector3 } => ({ position: new Vector3(0, y, 0), alive: true, scale: 1, yaw: 0, startAttack: noop, cancelAttack: noop, setMotion: noop });

describe('Signal Dunes plugin contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every boundary and tears down registrations', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.slug).toBe('sunscar-dunes');
    expect(app.registry.pieces.map((p) => p.id)).toEqual(['sunscar.tower']); expect(app.levelRegistrations.list('species')).toHaveLength(1);
    expect(app.levelRegistrations.text('step')).toBe('Light the signal fire'); expect(app.debug.scopedSnapshot()['sunscar']).toBe(plugin);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]);
    expect(app.levelRegistrations.list('weapon')).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('lights the signal fire once and pays the reward once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    expect(plugin.quest?.index).toBe(0); expect(plugin.beacon?.label).toBe('Light the signal fire');
    plugin.beacon?.onInteract(); app.events.flush('update');
    expect(plugin.quest?.isComplete).toBe(true); expect(plugin.beacon?.label).toBe('The signal fire burns'); expect(plugin.built?.tower.fire.visible).toBe(true);
    for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(purse.read()).toBe(before + 5); await app.unloadLevel();
    const again = await boot(); expect(again.plugin.built?.tower.fire.visible).toBe(true); await again.app.unloadLevel();
  });
  it('the crack is a long, narrow line', async () => {
    const { app } = await boot();
    const actor: Actor = { id: 'sunscar.target', tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 }, alive: true,
      applyDamage: (req) => { actor.attributes.health -= req.amount; return false; } };
    const whip = new SignalWhip(app), dir = new Vector3(0, 0, -1);
    expect(whip.strike(actor, new Vector3(1.2, 0, -4), dir, new Vector3(), false)).toBe(false);
    expect(whip.strike(actor, new Vector3(0, 0, -(CRACK.reach + 0.5)), dir, new Vector3(), false)).toBe(false);
    expect(whip.strike(actor, new Vector3(0.3, 0, -6), dir, new Vector3(), false)).toBe(true); expect(actor.attributes.health).toBe(100 - CRACK.light);
    await app.unloadLevel();
  });
  it('light on attack, the double crack on heavy and on lifting a touch hold', async () => {
    const { app } = await boot(); const whip = new SignalWhip(app), swings: boolean[] = []; whip.onSwing = (heavy) => { swings.push(heavy); };
    whip.tryFire(); whip.update(1); whip.crackNow(true); whip.update(1);
    whip.adsHeld = true; whip.update(0.4); expect(whip.charge).toBe(1); whip.adsHeld = false; whip.update(0.01);
    expect(swings).toEqual([false, true, true]); await app.unloadLevel();
  });
  it('the swoop lands only when the ray has come down to the player', () => {
    const spec = RAY_STRIKES[0]; if (spec === undefined) throw new Error('no swoop');
    const player = new Vector3(0, 0, 20);
    for (const [y, lands] of [[16, false], [1.4, true]] as const) {
      const runner = new StrikeRunner(), ray = fakeRay(y); let hits = 0;
      ray.position.z = player.z - 1;
      const ctx = { actor: ray, target: player, canReach: () => true, hit: () => { hits++; } };
      runner.start(spec, ray, player); runner.update(spec.windup + 0.01, ctx); runner.update(0.05, ctx);
      expect(hits > 0).toBe(lands);
    }
  });
  it('the strike clock frees the ray for its next swoop', () => {
    const spec = RAY_STRIKES[0]; if (spec === undefined) throw new Error('no swoop');
    const runner = new StrikeRunner(), ray = fakeRay(16), player = new Vector3(0, 0, 20), ctx = { actor: ray, target: player, canReach: () => false, hit: noop };
    runner.start(spec, ray, player); for (let t = 0; t < 12; t += 0.1) runner.update(0.1, ctx);
    expect(runner.busy).toBe(false);
  });
  it('builds a skinned ray and walkable dunes', () => {
    const g = rayGeometry(); expect(g.getAttribute('skinIndex').count).toBe(g.getAttribute('position').count);
    const h = (x: number, z: number): number => manifest.ground.terrain?.heightAt(x, z) ?? 0;
    expect(h(CREST.x, CREST.z)).toBeGreaterThan(h(SPAWN.x, SPAWN.z) + 10);
    // every slip face stays under the 40 degree climb limit
    let steepest = 0;
    for (let x = -120; x <= 120; x += 2) for (let z = -120; z <= 120; z += 2) { const [, ny] = manifest.ground.terrain?.normalAt(x, z, 1) ?? [0, 1, 0]; steepest = Math.max(steepest, Math.acos(ny) * 180 / Math.PI); }
    expect(steepest).toBeLessThan(38);
  });
});
