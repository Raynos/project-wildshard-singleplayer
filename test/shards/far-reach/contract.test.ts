// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture serves the committed, content-addressed mover module without a browser server.
import { readFileSync } from 'node:fs';
import { LIFT_MODULE } from '../../../src/shards/far-reach/data/liftModule';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { StrikeRunner, type StrikeContext } from '../../../src/engine/ai/strikes';
import { App } from '../../../src/engine/app/app';
import type { Actor } from '../../../src/engine/combat/pipeline';
import type { LevelDriver } from '../../../src/engine/level/load';
import { TabRegistry } from '../../../src/engine/ui/tabs';
import { WorldRegistry } from '../../../src/engine/world/registry';
import { purseSave, shardSave } from '../../../src/game/saves';
import { shardContext, type GameServices } from '../../../src/game/shard/context';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { resolveLevelBounds, type ShardPlayHooks } from '../../../src/game/shard/runtime';
import { installBounds } from '../../../src/engine/world/bounds';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { ISLET, RISING_ISLETS } from '../../../src/shards/far-reach/world/islets';
import manifest from '../../../src/shards/far-reach/manifest';
import { SkyReachPlugin } from '../../../src/shards/far-reach/plugin';
import { WarFan, GUST, inCone } from '../../../src/shards/far-reach/weapons/WarFan';
import { DIVE } from '../../../src/shards/far-reach/species/driftRay';
import { DECK, HOVER_GAP, ISLES, SPANS, UPDRAFT, VANES, FALLEN_BRIDGE, apothem } from '../../../src/shards/far-reach/layout';
import { UPDRAFT_ANGLE, vaneColliders } from '../../../src/shards/far-reach/world/build';
import { SKY_GOAT, warmCoat } from '../../../src/shards/far-reach/species/skyGoat';
import { REWARD } from '../../../src/shards/far-reach/quest/install';
import { FLAGS } from '../../../src/shards/far-reach/quest/flags';
import { FakeGame, legacyDouble } from '../../fake/FakeGame';
import { fakeWorld } from '../../fake/world';
import type { ShardWorld } from '../../../src/game/shard/world';
import { INPUT_CONTEXTS } from '../../../src/game/inputContexts';

const noop = (): void => undefined;
const loaded = new Set<App>();
afterEach(async () => { for (const app of loaded) await app.unloadLevel(); loaded.clear(); vi.unstubAllGlobals(); });
async function boot(): Promise<{ app: App; plugin: SkyReachPlugin; stages: string[]; active: Set<string>; fake: FakeGame; hooks: ShardPlayHooks }> {
  const fake = new FakeGame(), surface = fakeWorld();
  const physics = new Physics(await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer));
  const app = new App(), plugin = new SkyReachPlugin(), stages: string[] = [], active = new Set<string>(), bag = new TabRegistry();
  for (const context of INPUT_CONTEXTS) app.input.register(context, app.engineScope);
  const game: GameServices = { shard: manifest, rows: new Map(), bag, runtime: {
    world: legacyDouble<ShardWorld>({ ...surface, physics, game: fake.asGame(), chunk: manifest }),
    step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => surface.player.position, horizonVeil: null,
  } };
  const originalFetch = globalThis.fetch;
  // the admitted mover modules: the bridges' and (SF49-g) the Rising Islets'
  const modules = ['1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd', LIFT_MODULE.hash];
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const module = modules.find((hash) => url.endsWith(`/assets/${hash}`));
    if (module !== undefined) return Promise.resolve(new Response(Uint8Array.from(readFileSync(`src/shards/far-reach/assets/${module}`))));
    return originalFetch(input, init);
  });
  app.registryValue = new WorldRegistry();
  const add = (name: string): (() => void) => { active.add(name); return () => { active.delete(name); }; };
  app.levelAdapters = { inputContext: (def) => { const scope = app.levelScope; if (scope === null) throw new Error('No input scope'); app.input.register(def, scope); app.input.push(def.id, scope); return add(def.id); },
    debugRow: () => add('debug'), playground: () => add('playground'), hud: { widget: () => add('widget'), pin: () => add('pin'), relabel: () => add('relabel'),
      verb: () => add('verb'), disc: () => ({ button: document.createElement('button'), dispose: add('disc') }) } };
  const stage = (id: string): void => { stages.push(id); };
  const driver: LevelDriver = { progress: () => ({ set: noop, detail: noop }), data: (_spec, ctx) => {
    stage('data'); ctx.scope.onDispose(() => { physics.dispose(); });
    ctx.system({ id: 'physics.step', phase: 'fixed.step', run: () => { physics.step(); } });
  }, world: () => stage('world'), kit: () => stage('kit'),
    loadout: (_spec, ctx) => { stage('loadout'); expect(ctx.app.levelRegistrations.list('weapon').map((r) => r.id)).toEqual(['weapon.far-fan']); },
    play: () => stage('play'), finish: () => stage('finish') };
  app.levelDriver = driver;
  loaded.add(app);
  await app.loadLevel(toLevelSpec(manifest), { world: (ctx) => plugin.world(shardContext(ctx, manifest, game)), kit: (ctx) => plugin.kit(shardContext(ctx, manifest, game)), play: (ctx) => plugin.play(shardContext(ctx, manifest, game)) });
  fake.onFixed('pre', (dt) => { for (const system of app.systemsByPhase()['fixed.pre']) system.run(dt, fake.clock.elapsedTime); });
  fake.onFixed('step', (dt) => { for (const system of app.systemsByPhase()['fixed.step']) system.run(dt, fake.clock.elapsedTime); });
  fake.onFixed('post', (dt) => { for (const system of app.systemsByPhase()['fixed.post']) system.run(dt, fake.clock.elapsedTime); });
  fake.onUpdate((dt, time) => { for (const system of app.systemsByPhase().update) system.run(dt, time); });
  app.setState('play'); return { app, plugin, stages, active, fake, hooks: game.runtime?.hooks ?? {} };
}
const tick = (app: App, dt: number, t: number): void => {
  for (let i = 0; i < Math.round(dt * 60); i++) for (const phase of ['fixed.pre', 'fixed.step', 'fixed.post'] as const) for (const system of app.systemsByPhase()[phase]) system.run(1 / 60, t);
  for (const system of app.systemsByPhase().update) system.run(dt, t);
};
const piece = (app: App, id: string): { active?: () => boolean } | undefined => app.registry.pieces.find((p) => p.id === id);

describe('Sky Reach contract', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it('SF49-g (G183) / SF8c: each Rising Islet rests at the road until INTERACT rides it to its gate isle, then comes back by itself', async () => {
    const { app, plugin } = await boot(), at = (edge: string) => plugin.isletAt(edge);
    const gate = (entry: (typeof RISING_ISLETS)[number]) => plugin.isletGateShut(entry.edge);
    for (const entry of RISING_ISLETS) { expect(at(entry.edge)).toEqual(entry.rest); expect(gate(entry)).toBe(false); }
    // idle at the road: no automatic cycle (SF8c: a loaded lift rests at its road stop)
    tick(app, ISLET.dwell + 2, 0);
    for (const entry of RISING_ISLETS) expect(at(entry.edge)).toEqual(entry.rest);
    for (const entry of RISING_ISLETS) plugin.interactIslet(entry.edge, 1);
    const longest = Math.max(...RISING_ISLETS.map((e) => e.travel));
    tick(app, longest / 2, 0);
    for (const entry of RISING_ISLETS) { expect(at(entry.edge)?.y).toBeGreaterThan(0); expect(gate(entry)).toBe(true); }
    tick(app, longest / 2 + 1, 0);
    for (const entry of RISING_ISLETS) {
      const p = at(entry.edge); if (p === null) throw new Error('islet');
      // the shorter rides already rest out their dwell at the top (or head home); the longest has just docked
      if (entry.travel === longest) { expect(p.y).toBeCloseTo(entry.dock.y, 3); expect(p.x).toBeCloseTo(entry.dock.x, 3); expect(p.z).toBeCloseTo(entry.dock.z, 3); }
    }
    // the automatic idle return: after the dwell it comes back down and the road gate opens
    tick(app, ISLET.dwell + longest + 1, 0);
    for (const entry of RISING_ISLETS) { expect(at(entry.edge)?.y).toBe(0); expect(gate(entry)).toBe(false); }
    await app.unloadLevel();
  });
  it('bounds the whole cell for the Rising Islet entries (G194: the only way in), recovering only below the cloud sea', async () => {
    const { app, hooks } = await boot(), authored = toLevelSpec(manifest).bounds;
    expect(authored).toEqual({ x0: -120, x1: 120, z0: -240, z1: 60, floor: 12 });
    const selected = resolveLevelBounds(authored, hooks);
    expect(selected).toEqual({ x0: -250, x1: 250, z0: -250, z1: 250, floor: -8 });
    const recover = vi.fn<() => void>(), player = { position: { x: 0, y: 11, z: 0 }, yaw: 0, onGround: false, hover: false, spawn: noop };
    const scope = app.levelScope; if (scope === null) throw new Error('Missing bounds scope');
    installBounds(app, scope, selected, { player, toSpawn: recover, floorAt: () => undefined, suspended: () => false });
    const system = app.systemsByPhase().update.find(row => row.id === 'engine.world.bounds');
    if (system === undefined) throw new Error('Missing bounds system');
    system.run(1 / 60, 0); expect(recover).not.toHaveBeenCalled();
    recover.mockClear(); player.position.y = 30; player.position.x = 130;
    system.run(1 / 60, 0); expect(recover).not.toHaveBeenCalled();
    recover.mockClear(); player.position.x = 0; player.position.y = -9;
    system.run(1 / 60, 0); expect(recover).toHaveBeenCalledOnce();
    await app.unloadLevel(); expect(toLevelSpec(manifest).bounds).toEqual(authored);
    expect(app.systemsByPhase().update).toEqual([]);
  });

  it('boots every stage, registers its pieces, creatures and boss, and tears everything down', async () => {
    const { app, plugin, stages, active } = await boot();
    expect(stages).toEqual(['data', 'world', 'kit', 'loadout', 'play', 'finish']);
    expect(manifest.status).toBe('experimental'); expect(manifest.audio?.preload).toBeUndefined();
    expect(app.registry.pieces.map((p) => p.id)).toEqual(expect.arrayContaining([...ISLES.map((i) => `far.isle.${i.id}`), ...SPANS.map((s) => s.id), 'far.updraft', FALLEN_BRIDGE.id, 'far.windmill', 'far.crown.ruin']));
    expect(app.levelRegistrations.list('species').map((r) => r.id)).toEqual(['far.creature.driftRay', 'far.creature.skyGoat', 'far.creature.galeWisp', 'far.creature.stormRoc']);
    expect(app.levelRegistrations.text('raise')).toBe('Raise the bridge to the storm crown');
    expect(plugin.boss).not.toBeNull(); expect(app.debug.scopedSnapshot()['farReach']).toBe(plugin); expect(active.has('far.fan')).toBe(true);
    await app.unloadLevel(); expect(active.size).toBe(0); expect(app.registry.pieces).toEqual([]); expect(app.debug.scopedSnapshot()).toEqual({});
  });
  it('keeps every hover deck and the updraft off for a walker, each hover deck clear of every rim', async () => {
    const { app } = await boot();
    expect(app.player?.mode ?? 'foot').toBe('foot');
    for (const span of SPANS) expect(piece(app, span.id)?.active?.() ?? true, span.id).toBe(span.kind === 'rope');
    expect(piece(app, 'far.updraft')?.active?.()).toBe(false);
    for (const span of SPANS.filter((s) => s.kind === 'hover')) for (const isle of ISLES) for (const [x, y, z] of [[span.x0, span.y, span.z0], [span.x1, span.y1, span.z1]] as const) {
      if (Math.abs(isle.y - y) > 0.5) continue;
      expect(Math.hypot(x - isle.x, z - isle.z), `${span.id} vs ${isle.id}`).toBeGreaterThanOrEqual(apothem(isle) + HOVER_GAP - 1e-9);
    }
    // every sloped span stays under the player's 40° climb
    for (const span of SPANS) expect(Math.abs(Math.atan2(span.y1 - span.y, Math.hypot(span.x1 - span.x0, span.z1 - span.z0))), span.id).toBeLessThan((40 * Math.PI) / 180);
    expect(UPDRAFT_ANGLE).toBeLessThan((40 * Math.PI) / 180); expect(UPDRAFT.y1).toBeGreaterThan(UPDRAFT.y);
    await app.unloadLevel();
  });
  it('runs the four-step chain: notes, roost, three vanes by GUST, then the winch raises the crown bridge and pays once', async () => {
    const { app, plugin, fake } = await boot(), purse = shardSave(purseSave, manifest.slug), before = purse.read();
    const built = plugin.built, flags = plugin.flags; if (built === null || flags === null) throw new Error('not built');
    built.winch.onInteract(); tick(app, 1 / 30, 0); expect(built.state.raising).toBe(false);
    built.notes.onInteract(); tick(app, 1 / 30, 0.1); app.events.flush('update'); expect(plugin.quest?.index).toBe(1);
    flags.set(FLAGS.roost); tick(app, 1 / 30, 0.2); app.events.flush('update'); expect(plugin.quest?.index).toBe(2);
    for (const vane of VANES) expect(plugin.gustVanes(new Vector3(vane.x, vane.y + 1.6, vane.z + 5), new Vector3(0, 0.2, -1).normalize())).toBe(1);
    tick(app, 1 / 30, 0.3); app.events.flush('update'); expect(plugin.quest?.index).toBe(3);
    expect(piece(app, FALLEN_BRIDGE.id)?.active?.()).toBe(false);
    built.winch.onInteract(); for (let i = 0; i < 120; i++) tick(app, 1 / 30, 1 + i / 30); app.events.flush('update');
    expect(piece(app, FALLEN_BRIDGE.id)?.active?.()).toBe(true); expect(plugin.quest?.isComplete).toBe(true);
    for (let i = 0; i < 90; i++) fake.advance(1 / 30);
    expect(purse.read()).toBe(before + REWARD); await app.unloadLevel();
  });
  it('GUST pushes and nicks only what stands in its cone; a stowed fan neither gusts nor shows', async () => {
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
    fan.stowed = () => true; fan.update(0.1); expect(fan.model.visible).toBe(false);
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
  it('walks the goats on the decks (G26), warms their coat, and stands the vane on a plinth collider', () => {
    expect(SKY_GOAT.flight).toBeUndefined();
    // mauve shading (linear 0.22, 0.12, 0.16) loses its blue and lifts toward cream; a dark horn stays dark
    const g = new BufferGeometry(); g.setAttribute('color', new Float32BufferAttribute([0.22, 0.12, 0.16, 0.012, 0, 0.05], 3)); warmCoat(g);
    const c = g.getAttribute('color');
    expect(c.getZ(0)).toBeLessThan(c.getY(0)); expect(c.getX(0)).toBeGreaterThan(0.22);
    expect(c.getX(1)).toBeLessThan(0.02);
    const [plinth] = vaneColliders(0, 0, DECK);
    // E388: no size bar here. The ≥ 0.45 / 0.4 m restated build.ts's own constants; build.ts measured them off the generated
    // shrine (wind-vane.glb fitted 3.6 m tall: below 0.8 m it spans ±0.458 m in x and −0.424…0.412 m in z).
    expect(plinth?.kind).toBe('box');
  });
});
