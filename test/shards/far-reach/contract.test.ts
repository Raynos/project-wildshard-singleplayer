// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, StrikeRunner, type LevelDriver, type PlayerMode } from '#engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '#game';
import { Vector3 } from 'three';
import manifest from '#shards/far-reach/manifest';
import { SkyReachPlugin, RAISE_SECONDS } from '#shards/far-reach/plugin';
import { WarFan, GUST, type Gustable } from '#shards/far-reach/weapons/WarFan';
import { RAY_STRIKES } from '#shards/far-reach/species/driftRay';
import { BRIDGES, ISLANDS, HOVER_GAP, MILL, TOP, bridgeEnds } from '#shards/far-reach/layout';
import { REWARD_COINS } from '#shards/far-reach/quest/install';
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
    loadout: (_spec, ctx) => { stage('loadout'); expect(ctx.app.levelRegistrations.list('weapon').map((r) => r.id)).toEqual(['weapon.war-fan']); },
    play: () => stage('play'), finish: () => stage('finish') };
  app.levelDriver = driver;
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)), kit: (ctx) => plugin.kit(shardContext(ctx, manifest, game)), play: (ctx) => plugin.play(shardContext(ctx, manifest, game)) });
  app.setState('play'); return { app, plugin, stages, active };
}
const step = (app: App, dt: number, t: number): void => { for (const system of app.systemsByPhase().update) system.run(dt, t); app.events.flush('update'); };
/** The registry piece's `active()` gate, with the player's movement mode stubbed. */
function gate(app: App, id: string): () => boolean {
  const piece = app.registry.pieces.find((p) => p.id === id); if (!piece) throw new Error(`no piece ${id}`);
  return () => piece.active?.() ?? true;
}
function withMode(app: App, mode: PlayerMode | null): void {
  Object.defineProperty(app, 'player', { configurable: true, get: () => mode === null ? null : { mode } });
}

describe('Sky Reach (far-reach) contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('boots every stage, registers its pieces and rows, and tears everything down', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental');
    const ids = app.registry.pieces.map((p) => p.id);
    for (const island of ISLANDS) expect(ids).toContain(`far.island.${island.id}`);
    for (const bridge of BRIDGES) expect(ids).toContain(bridge.id);
    expect(app.levelRegistrations.list('species').map((r) => r.id)).toEqual(['far.creature.driftRay']);
    expect(app.levelRegistrations.text('raise')).toBe('Raise the fallen bridge to the windmill island');
    expect(app.debug.scopedSnapshot()['farReach']).toBe(plugin);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('hover decks collide only for a board rider and start clear of every island rim', async () => {
    const { app } = await boot();
    for (const bridge of BRIDGES.filter((b) => b.kind === 'hover')) {
      const active = gate(app, bridge.id);
      withMode(app, 'foot'); expect(active()).toBe(false);
      withMode(app, 'swim'); expect(active()).toBe(false);
      withMode(app, 'board'); expect(active()).toBe(true);
      const e = bridgeEnds(bridge);
      for (const island of ISLANDS) for (const [x, z] of [[e.ax, e.az], [e.bx, e.bz]] as const) {
        expect(Math.hypot(x - island.x, z - island.z)).toBeGreaterThanOrEqual(island.r + HOVER_GAP - 1e-6);
      }
    }
    withMode(app, 'foot'); expect(gate(app, 'far.bridge.gull')()).toBe(true);
    await app.unloadLevel();
  });
  it('the winch raises the fallen bridge, which then collides, and crossing pays the quest once', async () => {
    const { app, plugin } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    const fallen = gate(app, 'far.bridge.mill'); expect(fallen()).toBe(false);
    plugin.winch?.onInteract(); let t = 0;
    for (let i = 0; i < RAISE_SECONDS * 30 + 5; i++) step(app, 1 / 30, t += 1 / 30);
    expect(fallen()).toBe(true); expect(plugin.quest?.index).toBe(1);
    plugin.player.set(MILL.x, TOP, MILL.z + 5); step(app, 1 / 30, t += 1 / 30);
    expect(plugin.quest?.isComplete).toBe(true);
    for (let i = 0; i < 120; i++) step(app, 1 / 30, t += 1 / 30);
    expect(purse.read()).toBe(before + REWARD_COINS);
    await app.unloadLevel();
  });
  it('GUST pushes only bodies inside its cone, away from the fan', async () => {
    const { app } = await boot();
    const pushes = new Map<string, Vector3>();
    const body = (id: string, x: number, y: number, z: number): Gustable => ({ position: new Vector3(x, y, z), alive: true, impulse: (v) => { pushes.set(id, v.clone()); } });
    const bodies = [body('ahead', 0, 0, -5), body('side', 6, 0, 0), body('far', 0, 0, -30), body('above', 0, 3, -6)];
    const fan = new WarFan(app, null, () => null, () => bodies);
    expect(fan.gust(new Vector3(), new Vector3(0, 0, -1))).toBe(2);
    expect([...pushes.keys()].sort()).toEqual(['above', 'ahead']);
    const ahead = pushes.get('ahead'); expect(ahead?.z).toBeLessThan(-GUST.push / 2); expect(ahead?.y).toBe(GUST.lift);
    expect(fan.gust(new Vector3(), new Vector3(0, 0, -1))).toBe(0);
    await app.unloadLevel();
  });
  it('the drift ray dives with a 3-D sphere strike that misses a player far below', () => {
    const dive = RAY_STRIKES[0]; if (!dive) throw new Error('no dive');
    expect(dive.shape.kind).toBe('sphere'); expect(dive.motion?.track).toBe('lead');
    const runner = new StrikeRunner(), hits: number[] = [];
    const actor = { position: new Vector3(0, 40, 0), alive: true, scale: 1, yaw: 0, startAttack: noop, cancelAttack: noop, setMotion: noop };
    const ctx = (target: Vector3) => ({ actor, target, canReach: () => true, hit: () => { hits.push(1); } });
    expect(runner.pick(RAY_STRIKES, ctx(new Vector3(0, 30, -10)))).toBe(dive);
    expect(runner.contact(dive, ctx(new Vector3(0, 30, 0)))).toBe(false);
    actor.position.set(0, 31, 0);
    expect(runner.contact(dive, ctx(new Vector3(0, 30, 0)))).toBe(true); expect(hits).toHaveLength(1);
  });
});
