// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real regional physics and traveller transfer.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHUNK_HALF } from '../src/engine/core/config';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimLevel } from '../src/engine/sim';
import { GridAssembly } from '../src/game/grid/assembly';
import { LiveGridHost } from '../src/game/grid/live';
import { PageResidency } from '../src/game/grid/pageResidency';

// G580 T1 (the Developer row warmNeighbour): owned worlds overlap. The approached cell builds whole while the traveller is
// still in the source, the source stays resident through the crossing, and the destination is entered with both resident.
const level: SimLevel = { version: 1, id: 'platform', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'none', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };

// G580 T1: the build-ahead answers travel, not a position: a 1 m step along (dx, dz) ending at the player's position
function travel(live: LiveGridHost, at: { x: number; z: number }, dx: number, dz: number): void {
  at.x -= dx; at.z -= dz; live.beforeFixed();
  at.x += dx; at.z += dz; live.beforeFixed();
}

async function crossing(warm: boolean) {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('driftwood-isle');
  const target = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  if (target === undefined) throw new Error('Missing east destination');
  const page = createSimHost(level, { rapier }), residency = new PageResidency();
  // facing east, toward the destination (the build-ahead picks the neighbour ahead)
  const player = { position: page.player.position, yaw: -Math.PI / 2, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const created: string[] = [], disposed: string[] = [];
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    bindFrame: () => undefined, gameplayReady: () => true, warmNeighbour: () => warm,
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    prefetchable: cell => cell.instance === target.instance,
    // a large world: its readiness reach starts well inside the source
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 10 }) },
    admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
      create: () => {
        created.push(cell.instance);
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        return Promise.resolve({ host, dispose: () => { disposed.push(cell.instance); host.dispose(); } });
      } }),
  });
  const run = async () => {
    const enterHome = await live.prepare(null, home.instance); enterHome.commit();
    player.position.x = CHUNK_HALF - 20; travel(live, player.position, 1, 0);
    await Promise.all(live.state().pending.map(id => live.prefetch([id])));
    for (let i = 0; i < 20 && live.state().pending.length > 0; i++) await new Promise(resolve => { setTimeout(resolve, 5); });
    const inSource = { created: [...created], residents: live.state().residents, current: live.state().current };
    const leave = await live.prepare(home.instance, null); leave.commit();
    player.position.x = CHUNK_HALF + 0.5; live.beforeFixed();
    const enter = await live.prepare(null, target.instance); enter.commit();
    return { inSource, entered: { created: [...created], residents: live.state().residents, current: live.state().current, disposed: [...disposed] }, issues: live.state().issues };
  };
  try { return { home: home.instance, target: target.instance, ...(await run()) }; }
  finally { live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); }
}

test('warm: the destination builds while the source is active, and both stay resident through the crossing', async () => {
  const r = await crossing(true);
  expect(r.inSource.current).toBe(r.home);
  expect(r.inSource.created).toEqual([r.home, r.target]);
  expect(r.inSource.residents).toEqual([r.home, r.target].sort());
  expect(r.entered.current).toBe(r.target);
  expect(r.entered.residents).toEqual([r.home, r.target].sort());
  expect(r.entered.disposed).toEqual([]);
  expect(r.issues).toEqual({});
});

test('off: nothing builds inside the source, and the source retires before the destination builds', async () => {
  const r = await crossing(false);
  expect(r.inSource.created).toEqual([r.home]);
  expect(r.entered.created).toEqual([r.home, r.target]);
  expect(r.entered.residents).toEqual([r.target]);
  expect(r.issues).toEqual({});
});

test('warm: the build-ahead picks the neighbour the traveller heads for', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('driftwood-isle');
  const east = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  const north = assembly.cells.find(cell => cell.origin.x === 0 && cell.origin.z === -assembly.pitch);
  if (east === undefined || north === undefined) throw new Error('Missing neighbours');
  const built = async (dx: number, dz: number): Promise<string[]> => {
    const page = createSimHost(level, { rapier }), residency = new PageResidency(), created: string[] = [];
    const player = { position: page.player.position, yaw: 0, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
    const live = new LiveGridHost(assembly, {
      home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
      player, allocator: residency.allocator, continuations: 'durable', save: () => true,
      bindFrame: () => undefined, gameplayReady: () => true, warmNeighbour: () => true,
      highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
      prefetchable: cell => cell.instance === east.instance || cell.instance === north.instance,
      readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
        bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 10 }) },
      admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
        create: () => {
          created.push(cell.instance);
          const host = createSimHost(level, { rapier, playerBody: false, ground: false });
          return Promise.resolve({ host, dispose: () => { host.dispose(); } });
        } }),
    });
    try {
      const enterHome = await live.prepare(null, home.instance); enterHome.commit();
      // near the north-east corner, a little closer to the east edge
      player.position.x = CHUNK_HALF - 30; player.position.z = -(CHUNK_HALF - 40); travel(live, player.position, dx, dz);
      for (let i = 0; i < 20 && live.state().pending.length > 0; i++) await new Promise(resolve => { setTimeout(resolve, 5); });
      return created.filter(id => id !== home.instance);
    } finally { live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); }
  };
  expect(await built(0, -1)).toEqual([north.instance]); // heading -z: north
  expect(await built(1, 0)).toEqual([east.instance]); // heading +x: east
});

test('warm: the neighbour built ahead stays whole however long the traveller stands deep in the source', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('driftwood-isle');
  const east = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  if (east === undefined) throw new Error('Missing east neighbour');
  const page = createSimHost(level, { rapier }), residency = new PageResidency(), created: string[] = [], disposed: string[] = [];
  const player = { position: page.player.position, yaw: -Math.PI / 2, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    bindFrame: () => undefined, gameplayReady: () => true, warmNeighbour: () => true,
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    prefetchable: cell => cell.instance === east.instance,
    // a quick world: its readiness reach (and the cold-release radius) ends well short of the source's centre
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 0 }) },
    admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
      create: () => {
        created.push(cell.instance);
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        return Promise.resolve({ host, dispose: () => { disposed.push(cell.instance); host.dispose(); } });
      } }),
  });
  try {
    const enterHome = await live.prepare(null, home.instance); enterHome.commit();
    player.position.x = 0; player.position.z = 0; travel(live, player.position, 1, 0);
    for (let i = 0; i < 20 && !live.state().residents.includes(east.instance); i++) await new Promise(resolve => { setTimeout(resolve, 5); });
    expect(live.state().residents).toContain(east.instance);
    // well past the five-second cold dwell
    for (let tick = 0; tick < 8 * 60; tick++) { live.beforeFixed(); if (tick % 60 === 0) await new Promise(resolve => { setTimeout(resolve, 1); }); }
    expect(live.state().residents).toEqual([home.instance, east.instance].sort());
    expect(created).toEqual([home.instance, east.instance]);
    expect(disposed).toEqual([]);
    expect(residency.allocator.entries().find(row => row.id === `sim:${east.instance}`)?.needed).toBe(true);
  } finally { live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); }
});

test('warm: after a road crossing, the next neighbour builds ahead beside the kept source', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('driftwood-isle');
  const east = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  const beyond = assembly.cells.find(cell => cell.origin.x === 2 * assembly.pitch && cell.origin.z === 0);
  if (east === undefined || beyond === undefined) throw new Error('Missing east neighbours');
  const page = createSimHost(level, { rapier }), residency = new PageResidency(), created: string[] = [];
  const player = { position: page.player.position, yaw: -Math.PI / 2, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    bindFrame: () => undefined, gameplayReady: () => true, warmNeighbour: () => true,
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    prefetchable: cell => cell.instance === east.instance || cell.instance === beyond.instance,
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 10 }) },
    admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
      create: () => {
        created.push(cell.instance);
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        return Promise.resolve({ host, dispose: () => { host.dispose(); } });
      } }),
  });
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 20 && live.state().pending.length > 0; i++) await new Promise(resolve => { setTimeout(resolve, 5); });
  };
  try {
    const enterHome = await live.prepare(null, home.instance); enterHome.commit();
    player.position.x = CHUNK_HALF - 20; travel(live, player.position, 1, 0); await settle();
    const leave = await live.prepare(home.instance, null); leave.commit();
    player.position.x = CHUNK_HALF + 0.5; live.beforeFixed();
    const enter = await live.prepare(null, east.instance); enter.commit();
    // inside the destination, facing on east: the source just left stays, and the next cell builds ahead
    player.position.x = CHUNK_HALF - 20; player.position.z = 0; travel(live, player.position, 1, 0); await settle();
    expect(live.state().transitions.slice(-2)).toEqual([{ from: home.instance, to: null }, { from: null, to: east.instance }]);
    expect(created).toEqual([home.instance, east.instance, beyond.instance]);
    expect(live.state().residents).toEqual([home.instance, east.instance, beyond.instance].sort());
    expect(live.state().issues).toEqual({});
  } finally { live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); }
});

test('warm: standing, turning or a teleport builds nothing ahead', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assembly = new GridAssembly({ developer: false, devserver: false });
  const home = assembly.cell('driftwood-isle');
  const east = assembly.cells.find(cell => cell.origin.x === assembly.pitch && cell.origin.z === 0);
  if (east === undefined) throw new Error('Missing east neighbour');
  const page = createSimHost(level, { rapier }), residency = new PageResidency(), created: string[] = [];
  const player = { position: page.player.position, yaw: -Math.PI / 2, health: page.player.health, owner: page.player, motor: page.releasePlayerMotor() };
  const live = new LiveGridHost(assembly, {
    home: { mode: 'owned', instance: home.instance, bytes: 1000, residency: residency.admitHome(home.instance, 1000) },
    player, allocator: residency.allocator, continuations: 'durable', save: () => true,
    bindFrame: () => undefined, gameplayReady: () => true, warmNeighbour: () => true,
    highway: { bytes: 1000, create: () => ({ physics: page.physics, dispose: () => undefined }) },
    prefetchable: cell => cell.instance === east.instance,
    readiness: { link: { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 3 },
      bundle: () => ({ criticalWireBytes: 1000, hybridWireBytes: 1000, decodeSeconds: 0, runtimeParseSeconds: 10 }) },
    admit: cell => Promise.resolve({ bytes: 1000, exclusiveRuntime: true, reloadsCheckpoint: true, prepareRuntime: () => Promise.resolve(),
      create: () => {
        created.push(cell.instance);
        const host = createSimHost(level, { rapier, playerBody: false, ground: false });
        return Promise.resolve({ host, dispose: () => { host.dispose(); } });
      } }),
  });
  try {
    const enterHome = await live.prepare(null, home.instance); enterHome.commit();
    // facing east beside its edge: a spawn, then standing and turning there
    player.position.x = CHUNK_HALF - 20; live.beforeFixed();
    for (let tick = 0; tick < 30; tick++) { player.yaw = -Math.PI / 2 + tick * 0.01; live.beforeFixed(); }
    // a teleport toward the east edge
    player.position.x = CHUNK_HALF - 5; live.beforeFixed();
    for (let i = 0; i < 4; i++) await new Promise(resolve => { setTimeout(resolve, 5); });
    expect(created).toEqual([home.instance]);
  } finally { live.dispose(); player.motor.dispose(); page.dispose(); residency.dispose(); }
});
