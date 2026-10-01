// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, StrikeRunner, type Actor, type LevelDriver } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/sunscar-dunes/manifest';
import { SignalDunesPlugin } from '#shards/sunscar-dunes/plugin';
import { Bullwhip, CRACK } from '#shards/sunscar-dunes/weapons/Bullwhip';
import { DUNE_RAY, DUNE_RAY_LOOK, SWOOP } from '#shards/sunscar-dunes/species/duneRay';
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
const target = (health = 70): Actor => { const actor: Actor = { id: 'sunscar.target', tags: ['actor.creature', 'creature.duneRay'], state: [], attributes: { health, maxHealth: health }, alive: true,
  applyDamage: (req) => { actor.attributes.health -= req.amount; return false; } }; return actor; };

describe('Signal Dunes plugin contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every stage and tears down registrations and resources', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.audio?.preload).toBeUndefined(); expect(manifest.audio?.ambience).toBe('none');
    expect(app.registry.pieces.map((p) => p.id)).toEqual(['sunscar.tower']); expect(app.levelRegistrations.list('species')).toHaveLength(1);
    expect(app.levelRegistrations.text('step')).toBe('Light the signal fire'); expect(app.debug.scopedSnapshot()['sunscar']).toBe(plugin);
    const scope = app.levelScope; if (scope === null) throw new Error('No scope');
    expect(scope.census.disposers).toBeGreaterThan(0);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]);
    expect(app.levelRegistrations.list('weapon')).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('lights the signal fire at the brazier, completes the one-step quest and pays 5 coins once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    expect(plugin.quest?.index).toBe(0); expect(plugin.fire?.lit).toBe(false);
    plugin.fire?.brazier.onInteract(); app.events.flush('update');
    expect(plugin.fire?.lit).toBe(true); expect(plugin.fire?.brazier.label).toBe('Signal fire lit'); expect(plugin.quest?.isComplete).toBe(true);
    for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(fake.dead).toBe(false); expect(purse.read()).toBe(before + 5);
    plugin.fire?.brazier.onInteract(); for (let i = 0; i < 30; i++) fake.advance(1 / 30); expect(purse.read()).toBe(before + 5);
    await app.unloadLevel();
  });
  it('cracks a narrow lane through the damage pipeline: 7 m light, 8 m heavy', async () => {
    const { app } = await boot(), whip = new Bullwhip(app), dir = new Vector3(0, 0, -1), from = new Vector3();
    const ray = target();
    expect(whip.strike({ actor: ray, animal: null }, new Vector3(1.5, 0, -4), dir, from, false)).toBe(false);
    expect(whip.strike({ actor: ray, animal: null }, new Vector3(0, 0, -7.5), dir, from, false)).toBe(false);
    expect(whip.strike({ actor: ray, animal: null }, new Vector3(0.5, 0, -6.5), dir, from, false)).toBe(true); expect(ray.attributes.health).toBe(70 - CRACK.light);
    expect(whip.strike({ actor: ray, animal: null }, new Vector3(0, 0.4, -7.8), dir, from, true, true)).toBe(true); expect(ray.attributes.health).toBe(70 - CRACK.light - CRACK.heavy);
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
