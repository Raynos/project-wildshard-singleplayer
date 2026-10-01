// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, StrikeRunner, type Actor, type LevelDriver, type StrikeContext } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/far-reach/manifest';
import { SkyReachPlugin } from '#shards/far-reach/plugin';
import { WarFan, GUST, inCone } from '#shards/far-reach/weapons/WarFan';
import { DIVE } from '#shards/far-reach/species/driftRay';
import { DECK, HOVER_BRIDGE, HOVER_GAP, ISLES, ROOST, SUNREST, WINDMILL, FALLEN_BRIDGE, apothem } from '#shards/far-reach/layout';
import { REWARD } from '#shards/far-reach/quest/install';
import { FakeGame } from '../../fake/FakeGame';
import { INPUT_CONTEXTS } from '#game/inputContexts';

const noop = (): void => undefined;
async function boot(): Promise<{ app: App; plugin: SkyReachPlugin; stages: string[]; active: Set<string>; fake: FakeGame }> {
  const fake = new FakeGame();
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
  fake.onUpdate((dt, time) => { for (const system of app.systemsByPhase().update) system.run(dt, time); });
  app.setState('play'); return { app, plugin, stages, active, fake };
}
const tick = (app: App, dt: number, t: number): void => { for (const system of app.systemsByPhase().update) system.run(dt, t); };
const piece = (app: App, id: string): { active?: () => boolean } | undefined => app.registry.pieces.find((p) => p.id === id);

describe('Sky Reach contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every stage, registers its pieces and rows, and tears everything down', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.audio?.preload).toBeUndefined();
    expect(app.registry.pieces.map((p) => p.id)).toEqual(expect.arrayContaining(['far.isle.sunrest', 'far.isle.windmill', 'far.rope.grove', 'far.hover.roost', 'far.bridge.windmill', 'far.windmill']));
    expect(app.levelRegistrations.list('species')).toHaveLength(1); expect(app.levelRegistrations.text('raise')).toBe('Raise the fallen bridge to the windmill island');
    expect(app.debug.scopedSnapshot()['farReach']).toBe(plugin); expect(active.has('far.fan')).toBe(true);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('keeps the hover deck off for a walker and clear of every island rim', async () => {
    const { app } = await boot();
    expect(app.player?.mode ?? 'foot').toBe('foot'); expect(piece(app, HOVER_BRIDGE.id)?.active?.()).toBe(false);
    expect(piece(app, 'far.rope.grove')?.active?.() ?? true).toBe(true);
    for (const isle of ISLES) for (const x of [HOVER_BRIDGE.x0, HOVER_BRIDGE.x1]) {
      const nearest = Math.abs(x - isle.x);
      if (Math.abs(HOVER_BRIDGE.z0 - isle.z) < isle.r) expect(nearest).toBeGreaterThanOrEqual(apothem(isle) + HOVER_GAP - 1e-9);
    }
    expect(HOVER_BRIDGE.x0).toBeCloseTo(apothem(SUNREST) + HOVER_GAP); expect(HOVER_BRIDGE.x1).toBeCloseTo(ROOST.x - apothem(ROOST) - HOVER_GAP);
    await app.unloadLevel();
  });
  it('raises the fallen bridge with the winch, then pays the quest reward once at the windmill', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    expect(piece(app, FALLEN_BRIDGE.id)?.active?.()).toBe(false);
    plugin.built?.winch.onInteract(); for (let i = 0; i < 120; i++) tick(app, 1 / 30, i / 30);
    expect(piece(app, FALLEN_BRIDGE.id)?.active?.()).toBe(true); expect(plugin.quest?.index).toBe(1);
    plugin.player.set(WINDMILL.x, DECK, WINDMILL.z + 6); tick(app, 1 / 30, 5); app.events.flush('update');
    expect(plugin.quest?.isComplete).toBe(true); for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(purse.read()).toBe(before + REWARD); await app.unloadLevel();
  });
  it('GUST pushes and nicks only what stands in its cone', async () => {
    const { app } = await boot();
    const make = (id: string): Actor => { const actor: Actor = { id, tags: ['actor.creature'], state: [], attributes: { health: 50, maxHealth: 50 }, alive: true,
      applyDamage: (req) => { actor.attributes.health -= req.amount; return false; } }; return actor; };
    const ahead = make('ahead'), behind = make('behind'), pushes: Vector3[] = [];
    const fan = new WarFan(app, () => [{ position: new Vector3(0, 0, -5), actor: ahead, impulse: (v) => { pushes.push(v.clone()); } },
      { position: new Vector3(0, 0, 5), actor: behind, impulse: (v) => { pushes.push(v.clone()); } }]);
    expect(fan.blow(new Vector3(), new Vector3(0, 0, -1))).toBe(1);
    expect(ahead.attributes.health).toBe(50 - GUST.damage); expect(behind.attributes.health).toBe(50);
    expect(pushes[0]?.z).toBeCloseTo(-GUST.push); expect(pushes[0]?.y).toBeCloseTo(GUST.lift);
    expect(inCone(new Vector3(), new Vector3(0, 0, -1), new Vector3(3, 0, -3), 9, 0.6)).toBe(false);
    await app.unloadLevel();
  });
  it('the drift ray dive is a 3-D sphere: it lands on the chest, not from far above', () => {
    let hits = 0; const runner = new StrikeRunner(), at = new Vector3(0, DECK + 10, 0);
    const actor = { position: at, alive: true, scale: 1, yaw: 0, startAttack: noop, cancelAttack: noop, setMotion: noop };
    const chest = new Vector3(0, DECK + 1.2, 0);
    const ctx: StrikeContext = { actor, target: chest, canReach: () => true, hit: () => { hits++; } };
    runner.start(DIVE, actor, chest);
    for (let t = 0; t < DIVE.windup + 0.2; t += 0.05) runner.update(0.05, ctx);
    expect(hits).toBe(0);
    at.set(0, DECK + 2, 0.5); for (let t = 0; t < 0.4; t += 0.05) runner.update(0.05, ctx);
    expect(hits).toBe(1);
  });
});
