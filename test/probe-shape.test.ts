// @vitest-environment happy-dom
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as THREE from 'three';
import { installProbe, programHash, type ProbeWorld, type WildshardProbe } from '../src/core/probe';
import type { WildshardProbe as ScriptProbe } from '../scripts/types/wildshard-probe';
import type { Game } from '../src/core/Game';
import type { Player } from '../src/player/Player';
import type { Physics } from '../src/physics/Physics';
import type { World as RapierWorld, RigidBodySet, ColliderSet } from '@dimforge/rapier3d-simd';
import type { ChunkDef } from '../src/chunks/ChunkDef';
import type { Audio } from '../src/audio/Audio';
import type { Music } from '../src/audio/Music';
import type { HUD } from '../src/ui/HUD';
import type { Animal } from '../src/entities/Animal';
import type { AnimalManager } from '../src/entities/AnimalManager';
import type { Weapons, KitWeapon } from '../src/player/Weapons';
import type { TrainingArena } from '../src/practice/TrainingArena';
import { WorldRegistry } from '../src/world/registry';
import { ambientTick, tap } from '../src/core/harnessTap';

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
  const game = fake<Game>({ scene, renderer, frameTime: 10, systemLabels: () => ({ input: ['input'], 'fixed.pre': [], 'fixed.step': ['physics'], 'fixed.post': [], update: [], late: [] }) });
  const player = fake<Player>({ position: new THREE.Vector3(1.0004, 2, 3), velocity: new THREE.Vector3(), yaw: 0.1, pitch: 0.2, keys: new Set<string>(), spawn: vi.fn<() => void>(), setHover: vi.fn<() => void>() });
  const physics = fake<Physics>({ world: fake<RapierWorld>({ bodies: fake<RigidBodySet>({ forEach: () => { /* observation fixture has no side effects */ } }), colliders: fake<ColliderSet>({ len: () => 2 }) }) });
  const hud = fake<HUD>({ paused: false, entered: true, enterArenaNow: vi.fn<() => void>() });
  const animal = fake<Animal>({ kind: 'wolf', alive: true, hp: 20, position: new THREE.Vector3(5, 0, 6), state: 'idle', harnessHold: false });
  const animals = fake<AnimalManager>({ animals: [animal] });
  const state = { ammo: 2, magazine: 3, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  const weapon = fake<KitWeapon>({ id: 'sword', state }), weapons = fake<Weapons>({ current: weapon, list: [weapon], select: vi.fn<() => void>() });
  const arena = fake<TrainingArena>({ targets: [], isActive: false });
  const registry = new WorldRegistry(); registry.add({ id: 'deck', name: 'Deck', category: 'buildings', file: 'fixture', surface: 'stone', colliders: [{ kind: 'box', x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1 }] });
  return fake<ProbeWorld>({ game, player, physics, hud, animals, weapons, arena, registry,
    chunk: fake<ChunkDef>({ slug: 'driftwood-isle', spawn: { x: 0, z: 0, yaw: 0 } }),
    audio: fake<Audio>({ samples: { set: 'best', loops: [], oneshots: [], sampleBed: false, underSample: false } }), music: fake<Music>({ style: 'synth', state: { shard: 'island', mode: 'menu', intensity: 0, underwater: false } }), ocean: 'ocean-handle', pier: null, jetties: [], boat: null, hut: null, lookout: null, wreck: null, shrine: null, bushes: null, gulls: null, bridge: null, bridgeDeck: null, cove: null, enemies: null, shrineHum: null, islandSfx: null,
  });
}
const deps = { bootSteps: { renderer: 1, physics: 2 }, health: () => 90, quest: () => ['quest:started'] };
afterEach(() => {
  delete window.__wildshardHarness;
  tap.hit = null; tap.kill = null; tap.use = null; tap.sound = null; tap.resumed = null;
});

describe('probe contract', () => {
  it('shares its exact declared type with scripts and captures the boot synchronously', () => {
    expectTypeOf<ScriptProbe>().toEqualTypeOf<WildshardProbe>();
    const world = fixture(), probe = installProbe(world, deps);
    expect(Object.keys(probe).sort()).toEqual(['version', 'world', 'shard', 'boot', 'fingerprint', 'pose', 'walkLeg', 'combat', 'arena', 'state', 'onResume', 'saves', 'sounds', 'used', 'nav'].sort());
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
    expect(() => { probe.combat.equip('sword'); }).toThrow('requires __wildshardHarness');
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
    Reflect.set(world.hud, 'paused', true); expect(probe.state().appState).toBe('paused');
  });

  it('hashes sorted program keys using standard SHA-256', () => {
    expect(programHash('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(programHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
