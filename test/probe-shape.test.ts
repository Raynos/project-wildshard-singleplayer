// oxlint-disable-next-line import/no-nodejs-modules -- Load the native fixture bytes through the existing Rapier test alias.
import { readFileSync } from 'node:fs';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import type { EquipmentService } from '../src/engine/combat/EquipmentService';
import type { Weapon } from '../src/engine/combat/Weapon';
import type { LevelSpec } from '../src/engine/level/spec';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as THREE from 'three';
import { installProbe, programHash, compiledProgramHash, type ProbeWorld, type EngineProbe } from '../src/engine/debug/probe';
import type { WildshardProbe as ScriptProbe } from '../scripts/types/wildshard-probe';
import type { Game } from '../src/engine/core/Game';
import type { Player } from '../src/engine/player/Player';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { withOwner } from '../src/engine/app/ownership';
import type { World as RapierWorld, RigidBodySet, ColliderSet } from '@dimforge/rapier3d-simd';
import type { Audio } from '../src/engine/audio/Audio';
import type { Music } from '../src/engine/audio/Music';
import type { HUD } from '../src/engine/ui/HUD';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import type { TrainingArena } from '../src/engine/practice/TrainingArena';
import { WorldRegistry } from '../src/engine/world/registry';
import { ambientTick, tap } from '../src/engine/core/harnessTap';

// @vitest-environment happy-dom


















function fake<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get: (target, key) => {
    if (!(key in target)) throw new Error(`Unimplemented fixture field ${String(key)}`);
    return Reflect.get(target, key);
  } }) as T;
}

function fixture(): ProbeWorld {
  const scene = new THREE.Scene(), group = new THREE.Group(); group.name = 'place'; scene.add(group);
  const mesh = new THREE.Mesh(); mesh.name = 'model'; group.add(mesh);
  const renderer = fake<THREE.WebGLRenderer>({
    info: { programs: [], memory: { geometries: 1, textures: 2 }, autoReset: true, render: { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 }, reset: () => { /* observation fixture has no side effects */ }, update: () => { /* observation fixture has no side effects */ } },
    getContext: () => fake<WebGL2RenderingContext>({ getExtension: () => null, getParameter: () => 'ANGLE (Apple, ANGLE Metal Renderer)', RENDERER: 7937 }),
  });
  const app = new App(), levelScope = new Scope('level'); app.setState('play'); app.clock.tick(10);
  const game = fake<Game>({ level: fake<LevelSpec>({ id: 'driftwood-isle', budgets: {}, spawn: { x: 0, z: 0, yaw: 0 } }), app, levelScope, hudBaseline: 0, scene, renderer, frameTime: 10, levelSystemIds: () => [], systemLabels: () => ({ input: ['input'], 'fixed.pre': [], 'fixed.step': ['physics'], 'fixed.post': [], update: [], late: [] }) });
  const player = fake<Player>({ position: new THREE.Vector3(1.0004, 2, 3), velocity: new THREE.Vector3(), yaw: 0.1, pitch: 0.2, keys: new Set<string>(), spawn: vi.fn<() => void>(), setHover: vi.fn<() => void>() });
  const physics = fake<Physics>({ scopedCensus: () => ({ bodies: 0, colliders: 0 }), captureRetainedCensus: () => () => ({ bodies: 1, colliders: 2 }), world: fake<RapierWorld>({ bodies: fake<RigidBodySet>({ len: () => 1, forEach: () => { /* observation fixture has no side effects */ } }), colliders: fake<ColliderSet>({ len: () => 2 }) }) });
  const hud = fake<HUD>({ paused: false, entered: true, enterArenaNow: vi.fn<() => void>() });
  const animal = fake<Animal>({ kind: 'wolf', alive: true, hp: 20, position: new THREE.Vector3(5, 0, 6), state: 'idle', harnessHold: false });
  const animals = fake<AnimalManager>({ animals: [animal] });
  const state = { ammo: 2, magazine: 3, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  const weapon = fake<Weapon>({ id: 'sword', state }), weapons = fake<EquipmentService>({ current: weapon, list: [weapon], select: vi.fn<() => void>() });
  const arena = fake<TrainingArena>({ targets: [], isActive: false });
  const registry = new WorldRegistry(); registry.add({ id: 'deck', name: 'Deck', category: 'buildings', file: 'fixture', surface: 'stone', colliders: [{ kind: 'box', x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1 }] });
  return fake<ProbeWorld>({ game, player, physics, hud, animals, weapons, arena, registry,
    audio: fake<Audio>({ bedIds: undefined, samples: { set: 'best', loops: [], oneshots: [], sampleBed: false, underSample: false } }), music: fake<Music>({ scoreId: undefined, genre: 'synth', state: { mode: 'menu', intensity: 0, underwater: false } }), ocean: 'ocean-handle', pier: null, jetties: [], boat: null, hut: null, lookout: null, wreck: null, shrine: null, bushes: null, gulls: null, bridge: null, bridgeDeck: null, cove: null, enemies: null, shrineHum: null, islandSfx: null,
  });
}
const deps = { bootSteps: { renderer: 1, physics: 2 }, health: () => 90, quest: () => ['quest:started'] };
afterEach(() => {
  delete window.__wildshardHarness;
  tap.hit = null; tap.kill = null; tap.use = null; tap.sound = null; tap.resumed = null;
});

describe('probe contract', () => {
  it('reads authored handles and quest flags from this level and forgets scoped readers on disposal', () => {
    const world = fixture(), debug = world.game.app.debug, slug = world.game.level.id, scope = world.game.levelScope;
    const handles = { cabins: { id: 'authored-building' }, pineLife: { alive: true } }, flags = ['second', 'first'];
    const inactive = vi.fn(() => ['inactive']);
    scope.onDispose(debug.scopedExpose(`harness.shard.${slug}`, handles));
    scope.onDispose(debug.scopedExpose(`harness.quest.${slug}`, () => flags));
    scope.onDispose(debug.scopedExpose('harness.quest.other', inactive));
    const probe = installProbe(world, deps);
    expect(probe.shard['cabins']).toBe(handles.cabins);
    expect(probe.shard['pineLife']).toBe(handles.pineLife);
    expect(probe.state().quest).toEqual({ adventure: deps.quest(), level: ['first', 'second'] });
    expect(flags).toEqual(['second', 'first']);
    expect(inactive).not.toHaveBeenCalled();
    scope.dispose();
    expect(probe.world).toBeUndefined();
    expect(probe.shard).toEqual({ slug });
    expect(() => probe.state()).toThrow('Debug level has retired');
    expect(debug.snapshot()).not.toHaveProperty(`harness.shard.${slug}`);
  });
  it('returns every disposal failure alongside the post-unload census instead of rejecting the leak probe', async () => {
    window.__wildshardHarness = { seed: 1, capture: null, resources: () => ({
      listeners: { window: 0, document: 0, canvas: 0, other: 0 },
      timers: { timeouts: 0, intervals: 0, raf: 1 }, timerIds: { timeouts: [], intervals: [], raf: [1] },
      stacks: { listeners: [], timers: [] },
    }) };
    const world = fixture();
    Object.assign(world.game, { retainedGpuCounts: () => ({ geometries: 1, textures: 2, programs: 0 }),
      retainedHudCount: () => 0, retainedSceneObjects: () => 4, gpuResourceDiagnostics: () => ({}) });
    Object.assign(world.audio, { census: () => ({ activeVoices: 0, beds: 0, buses: 0 }) });
    vi.spyOn(world.game.app, 'unloadLevel').mockImplementation(() => {
      world.game.levelScope.dispose();
      return Promise.reject(new AggregateError([
      new Error('first disposer'), new AggregateError([new Error('child disposer')], 'child scope'),
      ], 'level scope'));
    });
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      const pending = installProbe(world, deps).leak();
      await vi.runAllTimersAsync();
      const result = await pending;
      expect(result.disposalErrors).toEqual(['first disposer', 'child disposer']);
      expect(result.after.bodies).toBe(0);
      expect(result.scope.disposers).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('counts the retained page world after freeing a native temporary frame and keeps active queries live', async () => {
    window.__wildshardHarness = { seed: 1, capture: null, resources: () => ({
      listeners: { window: 0, document: 0, canvas: 0, other: 0 },
      timers: { timeouts: 0, intervals: 0, raf: 1 }, timerIds: { timeouts: [], intervals: [], raf: [1] },
      stacks: { listeners: [], timers: [] },
    }) };
    const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer), page = new Physics(R), temporary = new Physics(R);
    const world = fixture(); let active = temporary;
    const temporaryScope = world.game.levelScope.child('temporary');
    withOwner(temporaryScope, () => {
      const body = temporary.world.createRigidBody(R.RigidBodyDesc.fixed());
      for (let i = 0; i < 3; i++) temporary.world.createCollider(R.ColliderDesc.cuboid(1, 1, 1), body);
    });
    withOwner(world.game.app.engineScope, () => {
      const body = page.world.createRigidBody(R.RigidBodyDesc.fixed());
      page.world.createCollider(R.ColliderDesc.cuboid(1, 1, 1), body);
    });
    Object.defineProperty(world, 'physics', { get: () => active });
    withOwner(world.game.levelScope, () => {
      const body = page.world.createRigidBody(R.RigidBodyDesc.fixed());
      page.world.createCollider(R.ColliderDesc.cuboid(1, 1, 1), body);
    });
    Object.assign(world.game, { retainedGpuCounts: () => ({ geometries: 1, textures: 2, programs: 0 }),
      retainedHudCount: () => 0, retainedSceneObjects: () => 4, gpuResourceDiagnostics: () => ({}) });
    Object.assign(world.audio, { census: () => ({ activeVoices: 0, beds: 0, buses: 0 }) });
    vi.spyOn(world.game.app, 'unloadLevel').mockImplementation(() => {
      active = page; temporaryScope.dispose(); temporary.dispose(); world.game.levelScope.dispose(); return Promise.resolve();
    });
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    try {
      const probe = installProbe(world, { ...deps, leakPhysics: page });
      expect(probe.world?.physics).toBe(temporary);
      expect(world.game.levelScope.census.colliders).toBe(4);
      expect(page.scopedCensus(world.game.levelScope)).toEqual({ bodies: 1, colliders: 1 });
      expect(temporary.scopedCensus(world.game.levelScope)).toEqual({ bodies: 1, colliders: 3 });
      const pending = probe.leak(); await vi.runAllTimersAsync();
      const result = await pending;
      expect(probe.world).toBeUndefined(); expect(() => temporary.world.bodies.len()).toThrow();
      expect(await probe.leak()).toBe(result);
      expect(result.disposalErrors).toEqual([]); expect(result.after.bodies).toBe(0); expect(result.after.colliders).toBe(0);
      expect(page.world.colliders.len()).toBe(1); // Actual retained engine collider, excluded by its own baseline.
    } finally { vi.useRealTimers(); world.game.app.engineScope.dispose(); page.dispose(); }
  });
  it('forgets deleted retained native identities and exposes later unowned handles without clamping', async () => {
    const R = await loadRapier(new Uint8Array(readFileSync('node_modules/@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm')));
    const physics = new Physics(R), level = new Scope('retained-identities');
    const retainedBody = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
    const retainedCollider = physics.world.createCollider(R.ColliderDesc.ball(1), retainedBody);
    withOwner(level, () => {
      const body = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
      physics.world.createCollider(R.ColliderDesc.ball(1), body);
    });
    const retained = physics.captureRetainedCensus(level);
    try {
      expect(retained()).toEqual({ bodies: 1, colliders: 1 });
      physics.world.removeCollider(retainedCollider, true);
      expect(retained()).toEqual({ bodies: 1, colliders: 0 });
      physics.world.removeRigidBody(retainedBody);
      expect(retained()).toEqual({ bodies: 0, colliders: 0 });
      const later = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
      physics.world.createCollider(R.ColliderDesc.ball(1), later);
      level.dispose();
      expect(retained()).toEqual({ bodies: 0, colliders: 0 });
      expect(physics.world.bodies.len() - retained().bodies).toBe(1);
      expect(physics.world.colliders.len() - retained().colliders).toBe(1);
      physics.world.removeRigidBody(later);
      expect(physics.world.bodies.len() - retained().bodies).toBe(0);
      expect(physics.world.colliders.len() - retained().colliders).toBe(0);
    } finally { level.dispose(); physics.dispose(); }
  });
  it('shares its exact declared type with scripts and captures the boot synchronously', () => {
    expectTypeOf<ScriptProbe>().toEqualTypeOf<EngineProbe>();
    const world = fixture();
    // the shard exposes its own handles (E405 AG25: the engine's probe has no per-shard key table)
    world.game.levelScope.onDispose(world.game.app.debug.scopedExpose(`harness.shard.${world.game.level.id}`, { ocean: world['ocean'] }));
    const probe = installProbe(world, deps);
    expect(Object.keys(probe).sort()).toEqual(['version', 'world', 'requireWorld', 'shard', 'boot', 'fingerprint', 'pose', 'walkLeg', 'combat', 'arena', 'state', 'onResume', 'saves', 'sounds', 'used', 'nav', 'leak', 'app', 'budgets'].sort());
    expect(window.__wildshard).toBe(probe);
    expect(Reflect.has(window, '__world')).toBe(false);
    expect(probe.shard).toMatchObject({ slug: 'driftwood-isle', ocean: 'ocean-handle' });
    expect(probe.boot.steps).toEqual(['renderer', 'physics']);
    expect(probe.boot.registry[0]?.shapes).toEqual({ cuboid: 1, ball: 0, capsule: 0, convex: 0, trimesh: 0, treads: 0 });
    expect(probe.boot.scene.totals.mesh).toBe(1);
    expect(probe.boot.scene.named).toEqual([{ path: 'place', type: 'Group', n: 1 }, { path: 'place/model', type: 'Mesh', n: 0 }]);
    world.game.scene.add(new THREE.Mesh());
    expect(probe.boot.scene.totals.mesh).toBe(1);
    expect(probe.fingerprint().scene.totals.mesh).toBe(2);
    expect(tap.hit).toBeNull(); expect(tap.sound).toBeNull(); expect(tap.resumed).toBeNull();
    expect(() => { probe.combat.equip('sword'); }).toThrow('requires the harness pins');
  });

  it('records and drains harness observations without changing gameplay snapshots', () => {
    window.__wildshardHarness = { seed: 1, capture: null, lane: 'm5', sha: 'sha', browser: 'Chromium', errors: [], saves: { read: ['local:b', 'local:a', 'local:b'], written: [] }, gpuBytes: () => ({ textures: 1, renderbuffers: 2, buffers: 3, total: 6 }) };
    const world = fixture(), probe = installProbe(world, deps);
    expect(probe.boot.saves.read).toEqual(['local:a', 'local:b']);
    expect(probe.boot.gpuBytes.total).toBe(6);
    tap.hit?.('wolf', 12); tap.kill?.('wolf'); tap.use?.('Open'); tap.sound?.('shot'); tap.sound?.('shot');
    ambientTick('herd', () => { tap.sound?.('animal:horse_neigh'); });
    ambientTick('herd', () => { /* observation fixture has no side effects */ });
    expect(probe.sounds()).toEqual({ event: { shot: 2 }, ambient: ['herd'] });
    expect(probe.sounds()).toEqual({ event: {}, ambient: [] });
    expect(probe.used()).toEqual(['Open']); expect(probe.used()).toEqual([]);
    expect(probe.combat.hits).toEqual([{ kind: 'wolf', amount: 12 }]); expect(probe.combat.kills).toEqual(['wolf']);
    expect(() => { probe.combat.equip('rifle'); }).toThrow('absent');
    const target = probe.combat.target('wolf', { x: 0, z: 0 }); expect(target.harnessHold).toBe(true);
    probe.combat.hold(target, false); expect(target.harnessHold).toBe(false);
    const state = probe.state(); expect(state.player.pos.x).toBe(1); expect(state.clockNow).toBe(10);
    const resumed = vi.fn<() => void>(); probe.onResume(resumed); tap.resumed?.(); tap.resumed?.(); expect(resumed).toHaveBeenCalledOnce();
    expect(probe.state()).toEqual(state);
    world.game.app.setState('paused'); expect(probe.state().appState).toBe('paused');
  });

  it('hashes sorted program keys using standard SHA-256', () => {
    expect(programHash('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(programHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('reports underived budget provenance without changing gameplay observations', () => {
    const world = fixture(), probe = installProbe(world, deps), before = probe.state();
    expect(probe.budgets(['fixture'])['fixture']).toMatchObject({ derived: null, ceiling: null, formula: { inputs: {} } });
    expect(probe.state()).toEqual(before);
    expect(world.game.renderer.info.render.calls).toBe(0);
  });
  it('hashes sorted linked shader pairs independently of cache keys and observes GLSL changes', () => {
    const a = { vertexShader: 'vertex-a', fragmentShader: 'fragment-a', cacheKey: 'callback source' };
    const b = { vertexShader: 'vertex-b', fragmentShader: 'fragment-b', cacheKey: 'minified callback' };
    const read = (source: string): string => source;
    expect(compiledProgramHash([a, b], read)).toBe(compiledProgramHash([b, { ...a, cacheKey: 'rewritten callback' }], read));
    expect(compiledProgramHash([a], read)).not.toBe(compiledProgramHash([{ ...a, fragmentShader: 'new fragment' }], read));
    expect(compiledProgramHash([a], read)).not.toBe(compiledProgramHash([{ vertexShader: a.fragmentShader, fragmentShader: a.vertexShader }], read));
    expect(() => compiledProgramHash([a], () => null)).toThrow('source unavailable');
  });
  it('exposes frozen observations that follow app services without exposing service mutators', () => {
    const world = fixture(), probe = installProbe(world, deps);
    expect(Object.isFrozen(probe.app)).toBe(true); expect(Object.isFrozen(probe.app.clock)).toBe(true);
    expect(Object.isFrozen(probe.app.systems.update)).toBe(true); expect(Object.isFrozen(probe.app.census.level)).toBe(true);
    expect(probe.app.state).toBe('play'); expect(probe.app.clock.now).toBe(10);
    world.game.app.setState('paused'); world.game.app.rng.seed(77);
    expect(probe.app.state).toBe('paused'); expect(probe.app.rngSeed).toBe(77);
    expect(Reflect.has(probe.app, 'setState')).toBe(false); expect(Reflect.has(probe.app.clock, 'tick')).toBe(false);
    expect(probe.boot.appStates).toEqual(['boot', 'play']);
  });
});
