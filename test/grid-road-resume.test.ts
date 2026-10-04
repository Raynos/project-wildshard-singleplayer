// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual native controller and highway collider generation.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { Scope } from '../src/engine/app/scope';
import { loadRapier } from '../src/engine/physics/rapier';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { floorBelow } from '../src/engine/physics/query';
import { generatePlatform } from '../src/engine/sim/strips';
import { createSimHost } from '../src/engine/sim';
import { SaveStore } from '../src/engine/saves/store';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { GridAssembly } from '../src/game/grid/assembly';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { LiveGridSession } from '../src/game/grid/liveSession';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

it('restores the real highway controller and road recovery without arming another crossing or leaking a world', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const homeHost = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  const restore = ['window', 'document'].map((name) => {
    const before = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: new EventTarget() });
    return () => { if (before === undefined) Reflect.deleteProperty(globalThis, name); else Object.defineProperty(globalThis, name, before); };
  });
  const baseline = homeHost.physics.world.colliders.len();
  const assembly = new GridAssembly({ developer: false, devserver: false }), home = assembly.cell('driftwood-isle'), empty = assembly.emptyNeighbour.edge;
  const strips = generatePlatform(assembly.cells.map((cell) => ({ ...cell, edges: { north: empty, south: empty, east: empty, west: empty } })), empty);
  const scope = new Scope('road.resume'), allocator = new ResidencyAllocator(), pre: (() => void)[] = [];
  const equipment = new EquipmentService(new EmptyEquipment(), { scope });
  let currentPhysics = homeHost.physics;
  const traveller = { position: homeHost.player.position, yaw: 0, motor: homeHost.releasePlayerMotor(), camera: new PerspectiveCamera(), hoverSpeedLimit: null,
    bindFrame: (physics: typeof homeHost.physics, motor: typeof homeHost.player.motor) => { currentPhysics = physics; traveller.motor = motor; } };
  const session = new LiveGridSession({ assembly, home, physics: homeHost.physics, scope, walls: new ReadinessWalls(homeHost.physics, [], scope),
    strips, allocator, neighbourEdges: () => [], rimEdges: () => [] }, {
    traveller, health: homeHost.player.health, equipment, events: homeHost.events, saves: new SaveStore({ local: new MemoryStorage(), session: null }),
    checkpoint: () => false, catalogue: [], setPhysics: () => undefined, onFixedPre: (fn) => { pre.push(fn); },
    onFixedPost: () => undefined, onInput: () => undefined, onUpdate: () => undefined,
  });
  try {
    const statusScope = scope.child('reload.status');
    session.bindReloadStatus(() => 'failed', statusScope); expect(session.state().reloadStatus).toBe('failed');
    statusScope.dispose(); expect(session.state().reloadStatus).toBeNull();
    await session.resumeRoad({ x: 277.5, y: 0.45, z: 0 }, { x: 281.1, z: 0, yaw: 1.2 });
    expect(session.frame()).toBeNull(); expect(session.worldFeet()).toEqual({ x: 277.5, y: 0.45, z: 0 });
    expect(equipment.stowed).toBe(true); expect(session.roadPoint()).toEqual({ x: 281.1, z: 0, yaw: 1.2 });
    expect(session.state().crossing).toMatchObject({ current: null, target: null, phase: 'settled' });
    expect(floorBelow(currentPhysics, 277.5, 0, 1, 2)).toBeCloseTo(0, 4);
    for (let n = 0; n < 3; n++) { for (const step of pre) step(); await Promise.resolve(); }
    expect(session.state().crossing).toMatchObject({ current: null, target: null, phase: 'settled' });
  } finally {
    scope.dispose(); expect(allocator.entries()).toEqual([]);
    expect(homeHost.physics.world.colliders.len()).toBe(baseline);
    homeHost.attachPlayerMotor(traveller.motor); homeHost.dispose();
    for (const reset of restore) reset();
  }
}, 20_000);
