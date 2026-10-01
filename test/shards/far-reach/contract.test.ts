// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, type Actor, type LevelDriver } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/far-reach/manifest';
import { FarReachPlugin } from '#shards/far-reach/plugin';
import { WarFan, type GustTarget } from '#shards/far-reach/weapons/WarFan';
import { ISLANDS, SPANS, CLOUD_Y, skyLandscape, spanEnds } from '#shards/far-reach/layout';
import { FALLEN } from '#shards/far-reach/world/build';
import { FakeGame } from '../../fake/FakeGame';

const noop = (): void => undefined;
async function boot(): Promise<{ app: App; plugin: FarReachPlugin; stages: string[]; active: Set<string>; bag: TabRegistry; fake: FakeGame }> {
  const fake = new FakeGame();
  const app = new App(), plugin = new FarReachPlugin(), stages: string[] = [], active = new Set<string>(), bag = new TabRegistry();
  const game: GameServices = { shard: manifest, rows: new Map(), bag };
  app.registryValue = new WorldRegistry();
  const add = (name: string): (() => void) => { active.add(name); return () => { active.delete(name); }; };
  app.levelAdapters = { inputContext: (def) => { const scope = app.levelScope; if (scope === null) throw new Error('No input scope'); app.input.register(def, scope); app.input.push(def.id, scope); return add(def.id); },
    debugRow: () => add('debug'), playground: () => add('playground'), hud: { widget: () => add('widget'), pin: () => add('pin'), relabel: () => add('relabel'),
      verb: () => add('verb'), disc: () => ({ button: document.createElement('button'), dispose: add('disc') }) } };
  const stage = (id: string): void => { stages.push(id); };
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: () => stage('data'), world: () => stage('world'), kit: () => stage('kit'),
    loadout: (_spec, ctx) => { stage('loadout'); expect(ctx.app.levelRegistrations.list('weapon').map((r) => r.id)).toEqual(['weapon.far-reach-fan']); },
    play: () => stage('play'), finish: () => stage('finish') };
  app.levelDriver = driver;
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)), kit: (ctx) => plugin.kit(shardContext(ctx, manifest, game)), play: (ctx) => plugin.play(shardContext(ctx, manifest, game)) });
  fake.onUpdate((dt, time) => { for (const system of app.systemsByPhase().update) system.run(dt, time); });
  app.setState('play'); return { app, plugin, stages, active, bag, fake };
}
const tick = (app: App, seconds: number): void => { for (let t = 0; t < seconds; t += 1 / 30) for (const system of [...app.systemsByPhase().update, ...app.systemsByPhase().late]) system.run(1 / 30, t); };

describe('far-reach (Sky Reach) plugin contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every boundary and tears down registrations', async () => {
    const { app, plugin, stages, active, bag } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.uses).toContain('hover');
    expect(app.levelRegistrations.list('species')).toHaveLength(2);
    expect(app.levelRegistrations.text('questStep')).toBe('Raise the fallen bridge to the windmill island');
    expect(app.debug.scopedSnapshot()['farReach']).toBe(plugin); expect(bag.registeredTabs.map((t) => t.id)).toEqual(['notes']);
    expect(app.registry.pieces.map((p) => p.id)).toEqual(expect.arrayContaining(['farReach.rope.fern', 'farReach.hover.roost', 'farReach.hover.lantern', 'farReach.fallen', 'farReach.windmill']));
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('hover bridges collide only while riding the hoverboard; rope bridges always', async () => {
    const { app, plugin } = await boot();
    const hover = app.registry.pieces.find((p) => p.id === 'farReach.hover.roost'), rope = app.registry.pieces.find((p) => p.id === 'farReach.rope.fern');
    expect(hover?.active?.()).toBe(false); expect(rope?.active).toBeUndefined();
    plugin.hovering = true; expect(hover?.active?.()).toBe(true);
    plugin.hovering = false; expect(hover?.active?.()).toBe(false);
    await app.unloadLevel();
  });
  it('the roost and the lantern rock are reachable only by a hover bridge, over a void', () => {
    for (const id of ['roost', 'lantern']) expect(SPANS.filter((s) => s.from === id || s.to === id).every((s) => s.kind === 'hover')).toBe(true);
    for (const span of SPANS) { const { a, b } = spanEnds(span); expect(skyLandscape((a.x + b.x) / 2, (a.z + b.z) / 2, 0)).toBeLessThan(CLOUD_Y); }
    expect(skyLandscape(ISLANDS.home.x, ISLANDS.home.z, 0)).toBeCloseTo(ISLANDS.home.top, 0);
  });
  it('the winch raises the fallen bridge, which then collides and pays the quest once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    const fallen = app.registry.pieces.find((p) => p.id === 'farReach.fallen'), sky = plugin.sky;
    expect(fallen?.active?.()).toBe(false); expect(plugin.quest?.isComplete).toBe(false);
    sky?.winch.onInteract(); tick(app, FALLEN.seconds + 0.5);
    expect(sky?.fallen.raised).toBe(true); expect(fallen?.active?.()).toBe(true); expect(plugin.quest?.isComplete).toBe(true);
    for (let i = 0; i < 120; i++) fake.advance(1 / 30);
    expect(purse.read()).toBe(before + 10); await app.unloadLevel();
  });
  it('GUST throws only the foes inside its cone', async () => {
    const { app } = await boot();
    const hits: string[] = [], foe = (id: string, at: Vector3): GustTarget & { pushed: number } => {
      const actor: Actor = { id, tags: ['actor.creature'], state: [], attributes: { health: 50, maxHealth: 50 }, alive: true, applyDamage: (req) => { actor.attributes.health -= req.amount; hits.push(id); return false; } };
      const target = { position: at, actor, pushed: 0, push: (_dir: Vector3, power: number) => { target.pushed = power; } }; return target;
    };
    const ahead = foe('ahead', new Vector3(0, 0, -5)), aside = foe('aside', new Vector3(6, 0, 0)), far = foe('far', new Vector3(0, 0, -30));
    const fan = new WarFan(app, null, () => null, () => [ahead, aside, far]);
    expect(fan.blow(new Vector3(), new Vector3(0, 0, -1))).toBe(1);
    expect(ahead.pushed).toBeGreaterThan(0); expect(aside.pushed).toBe(0); expect(far.pushed).toBe(0); expect(hits).toEqual(['ahead']);
    await app.unloadLevel();
  });
});
