// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App, WorldRegistry, TabRegistry, StrikeRunner, type Actor, type LevelDriver, type StrikeContext } from '@wildshard/engine';
import { shardContext, toLevelSpec, purseSave, shardSave, type GameServices } from '@wildshard/game';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import manifest from '../../../src/shards/far-reach/manifest';
import { SkyReachPlugin } from '../../../src/shards/far-reach/plugin';
import { WarFan, GUST, inCone } from '../../../src/shards/far-reach/weapons/WarFan';
import { DIVE } from '../../../src/shards/far-reach/species/driftRay';
import { DECK, HOVER_GAP, ISLES, SPANS, UPDRAFT, VANES, FALLEN_BRIDGE, apothem } from '../../../src/shards/far-reach/layout';
import { UPDRAFT_ANGLE, vaneColliders } from '../../../src/shards/far-reach/world/build';
import { SKY_GOAT, warmCoat } from '../../../src/shards/far-reach/species/skyGoat';
import { FLAGS, REWARD } from '../../../src/shards/far-reach/quest/install';
import { FakeGame } from '../../fake/FakeGame';
import { INPUT_CONTEXTS } from '../../../src/game/inputContexts';

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
  it('walks the goats on the decks (G26), warms their coat, and fits the vane plinth', () => {
    expect(SKY_GOAT.flight).toBeUndefined();
    // mauve shading (linear 0.22, 0.12, 0.16) loses its blue and lifts toward cream; a dark horn stays dark
    const g = new BufferGeometry(); g.setAttribute('color', new Float32BufferAttribute([0.22, 0.12, 0.16, 0.012, 0, 0.05], 3)); warmCoat(g);
    const c = g.getAttribute('color');
    expect(c.getZ(0)).toBeLessThan(c.getY(0)); expect(c.getX(0)).toBeGreaterThan(0.22);
    expect(c.getX(1)).toBeLessThan(0.02);
    const [plinth] = vaneColliders(0, 0, DECK);
    expect(plinth?.kind).toBe('box');
    if (plinth?.kind === 'box') { expect(plinth.hx).toBeGreaterThanOrEqual(0.45); expect(plinth.hz).toBeGreaterThanOrEqual(0.4); }
  });
});
