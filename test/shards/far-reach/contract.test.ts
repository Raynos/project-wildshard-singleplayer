// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, type Actor, type LevelDriver } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/far-reach/manifest';
import { SkyReachPlugin } from '#shards/far-reach/plugin';
import { WarFan, GUST, type Gustable } from '#shards/far-reach/weapons/WarFan';
import { RAY_STRIKES, rayGeometry } from '#shards/far-reach/species/driftRay';
import { RAISE_SECONDS } from '#shards/far-reach/quest/install';
import { MILL, WINCH } from '#shards/far-reach/layout';
import { INPUT_CONTEXTS } from '#game/inputContexts';

const noop = (): void => undefined;
async function boot(): Promise<{ app: App; plugin: SkyReachPlugin; stages: string[]; active: Set<string> }> {
  const app = new App(), plugin = new SkyReachPlugin(), stages: string[] = [], active = new Set<string>(), bag = new TabRegistry();
  for (const context of INPUT_CONTEXTS) app.input.register(context, app.engineScope);
  const game: GameServices = { shard: manifest, rows: new Map(), bag };
  app.registryValue = new WorldRegistry();
  const add = (name: string): (() => void) => { active.add(name); return () => { active.delete(name); }; };
  app.levelAdapters = { inputContext: (def) => { const scope = app.levelScope; if (scope === null) throw new Error('No input scope'); app.input.register(def, scope); app.input.push(def.id, scope); return add(def.id); },
    debugRow: () => add('debug'), playground: () => add('playground'), hud: { widget: () => add('widget'), pin: () => add('pin'), relabel: () => add('relabel'),
      verb: () => add('verb'), disc: () => ({ button: document.createElement('button'), dispose: add('disc') }) } };
  const stage = (id: string): void => { stages.push(id); };
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: () => stage('data'), world: () => stage('world'), kit: () => stage('kit'),
    loadout: (_spec, ctx) => { stage('loadout'); expect(ctx.app.levelRegistrations.list('weapon').map((r) => r.id)).toEqual(['weapon.far-fan']); },
    play: () => stage('play'), finish: () => stage('finish') };
  app.levelDriver = driver;
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)), kit: (ctx) => plugin.kit(shardContext(ctx, manifest, game)), play: (ctx) => plugin.play(shardContext(ctx, manifest, game)) });
  app.setState('play'); return { app, plugin, stages, active };
}
const tick = (app: App, dt: number, t: number): void => { for (const system of app.systemsByPhase().update) system.run(dt, t); };

describe('Sky Reach contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every stage, registers its pieces and rows, and tears everything down', async () => {
    const { app, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.style).toBe('skyReach'); expect(manifest.world?.killY).toBeLessThan(0);
    expect(app.levelRegistrations.list('species').map((r) => r.id)).toEqual(['far.creature.driftRay']);
    expect(app.levelRegistrations.text('gust')).toBe('GUST'); expect(active.has('far.fan')).toBe(true);
    const ids = app.registry.pieces.map((p) => p.id);
    for (const id of ['far.isle.sunrest', 'far.isle.mill', 'far.rope.fernhold', 'far.hover.roost', 'far.hover.tern', 'far.rope.mill', 'far.windmill', 'far.winch']) expect(ids).toContain(id);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]);
  });
  it('hover bridges collide only for a board rider: on foot they let you through', async () => {
    const { app } = await boot();
    const hover = app.registry.pieces.filter((p) => p.id.startsWith('far.hover.') && !p.id.endsWith('.pylons')), rope = app.registry.pieces.find((p) => p.id === 'far.rope.fernhold');
    expect(hover).toHaveLength(2); expect(app.player?.mode ?? 'foot').toBe('foot');
    for (const piece of hover) { expect(piece.active?.()).toBe(false); expect(piece.colliders?.length).toBe(1); }
    expect(rope?.active).toBeUndefined();
    await app.unloadLevel();
  });
  it('the winch raises the fallen bridge, the bridge then collides, and crossing it completes the quest once', async () => {
    const { app, plugin } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    const fallen = app.registry.pieces.find((p) => p.id === 'far.rope.mill');
    expect(fallen?.active?.()).toBe(false); expect(plugin.quest?.index).toBe(0);
    plugin.sky?.winch.onInteract(); expect(plugin.sky?.winch.label).toBe('The bridge rises…');
    for (let i = 0; i <= RAISE_SECONDS * 30 + 2; i++) tick(app, 1 / 30, i / 30);
    expect(fallen?.active?.()).toBe(true); expect(plugin.quest?.index).toBe(1);
    plugin.player.set(MILL.x, MILL.top, MILL.z + 2); tick(app, 1 / 30, 10); app.events.flush('update');
    expect(plugin.quest?.isComplete).toBe(true);
    for (let i = 0; i < 120; i++) tick(app, 1 / 30, 11 + i / 30);
    expect(purse.read()).toBe(before + 10);
    expect(Math.hypot(WINCH.x, WINCH.z)).toBeGreaterThan(5);
    await app.unloadLevel();
  });
  it('GUST shoves only the creatures in its cone and hurts them a little; SWING lands inside its arc', async () => {
    const { app } = await boot();
    const pushed: Vector3[] = [], hurt: string[] = [];
    const actor = (id: string): Actor => ({ id, tags: ['actor.creature'], state: [], attributes: { health: 100, maxHealth: 100 }, alive: true,
      applyDamage: (req) => { hurt.push(id); actor(id).attributes.health -= req.amount; return false; } });
    const ahead: Gustable = { alive: true, kind: 'driftRay', position: new Vector3(0, 0, -6), impulse: (v) => { pushed.push(v.clone()); } };
    const behind: Gustable = { alive: true, kind: 'driftRay', position: new Vector3(0, 0, 6), impulse: (v) => { pushed.push(v.clone()); } };
    const fan = new WarFan(app, null, { animals: () => [ahead, behind], actorFor: (a) => actor(a.position.z < 0 ? 'ahead' : 'behind') });
    expect(fan.blow(new Vector3(), new Vector3(0, 0, -1))).toBe(1);
    expect(pushed).toHaveLength(1); expect(pushed[0]?.z).toBeLessThan(-5); expect(pushed[0]?.y).toBe(GUST.lift); expect(hurt).toEqual(['ahead']);
    expect(fan.blow(new Vector3(), new Vector3(0, 0, -1))).toBe(0);
    const target = actor('target');
    expect(fan.strike(target, new Vector3(3, 0, -3), new Vector3(0, 0, -1), new Vector3(), false)).toBe(false);
    expect(fan.strike(target, new Vector3(0, 0, -3), new Vector3(0, 0, -1), new Vector3(), true)).toBe(true);
    await app.unloadLevel();
  });
  it('the drift ray dives with a 3-D sphere strike and flaps skinned wings', () => {
    const dive = RAY_STRIKES[0];
    expect(dive?.shape.kind).toBe('sphere'); expect(dive?.motion?.track).toBe('lead');
    const g = rayGeometry(), bones = new Set(Array.from(g.getAttribute('skinIndex').array).filter((_, i) => i % 4 === 0));
    expect([...bones].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });
});
