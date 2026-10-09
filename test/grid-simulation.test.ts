// oxlint-disable-next-line import/no-nodejs-modules -- Native Rapier payload is present in the clean product export.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Prove the new grid driver runs without the Vitest DOM or module evaluator.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the invoking test runner's Node version.
import { execPath } from 'node:process';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { tagCollider, tagOf } from '../src/engine/physics/surface';
import { createSimHost, type SimLevel } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost, type SimSnapshot } from '../src/engine/sim/snapshot';
import { installDeclaredPropColliders, type PropColliderPort } from '../src/engine/physics/declaredProps';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { installEntrySockets } from '../src/engine/physics/entrySockets';
import { generateStrip } from '../src/engine/sim/strips';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridSimulation, type GridResident } from '../src/game/grid/simulation';
import { regionalState } from '../src/game/grid/state';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { prepareFrameMotors } from '../src/engine/physics/frame';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { GRID_CONTINUATION_CACHE_BYTES } from '../src/game/grid/continuations';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer); });
const entities = structuredClone(SIM_LEVEL.entities); for (const entity of entities) entity.at = { x: 30, y: 0, z: 20 };
const level: SimLevel = { ...SIM_LEVEL, ground: { size: 500, height: 0 }, player: { ...SIM_LEVEL.player, speed: 30 }, entities };
const doors = [{ id: 'door', initialActive: true, shapes: [{ kind: 'box' as const, x: 50, y: 1, z: 20, hx: 1, hy: 1, hz: 0.2 }] }];
function resident(saved?: SimSnapshot): GridResident & { door: PropColliderPort } {
  let door: PropColliderPort | undefined;
  const install = (host: ReturnType<typeof createSimHost>, restoring: boolean): void => {
    const rows = installDeclaredPropColliders(doors, () => host.physics, host.scope, restoring ? new Map([['door', { handles: [] }]]) : undefined);
    door = rows.get('door'); if (door === undefined) throw new Error('Missing door fixture');
    const port = door;
    host.onStep('door', () => undefined, { snapshot: () => ({ handles: port.snapshot().handles }), restore: (data) => {
      if (data === null || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data['handles']) || !data['handles'].every((h) => typeof h === 'number')) throw new Error('Bad door checkpoint');
      port.restore({ handles: data['handles'] });
    } });
  };
  const host = saved === undefined ? createSimHost(level, { rapier }) : restoreSimHost(level, { rapier }, saved, (h) => { install(h, true); });
  if (saved === undefined) install(host, false);
  if (door === undefined) throw new Error('Missing installed door');
  return { host, door, dispose: () => { host.dispose(); } };
}
describe('world-local grid residency', () => {
  it('boots two real declared templates and restores grid continuation in plain Node', () => {
    const result = execFileSync(execPath, ['--import', './scripts/sim-node-loader.mjs', 'test/fixtures/grid/run.mjs'], { encoding: 'utf8', timeout: 30_000 });
    expect(result).toContain('"native":true'); expect(result).toContain('"openedDoor":true'); expect(result).toContain('"frozenTicks":600');
  });
  it('keeps equal collider handles isolated after one world unloads', () => {
    const a = new Physics(rapier), b = new Physics(rapier);
    const ca = a.world.createCollider(rapier.ColliderDesc.cuboid(1, 1, 1)), cb = b.world.createCollider(rapier.ColliderDesc.cuboid(1, 1, 1));
    expect(ca.handle).toBe(cb.handle); tagCollider(ca, 'wood', 'a'); tagCollider(cb, 'stone', 'b'); a.dispose();
    expect(tagOf(ca)).toBeUndefined(); expect(tagOf(cb)).toEqual({ material: 'stone', owner: 'b' }); b.dispose();
  });
  it('hashes identical local authored state at different placements with different platform duplicates', () => {
    const a = resident(), b = resident();
    const profile = { heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
    const strip = generateStrip({ id: 'shared', axis: 'x', origin: { x: 277.5, z: 0 }, profiles: [profile, profile], adjacent: [{ instance: 'a', origin: { x: 0, z: 0 } }, { instance: 'b', origin: { x: 555, z: 0 } }] });
    try {
      for (const [i, value] of [a, b].entries()) { const duplicate = strip.duplicates[i]; if (duplicate === undefined) throw new Error('Missing strip'); installStripCollider(value.host.physics, duplicate.mesh, value.host.scope); }
      expect(regionalState(a.host)).toBe(regionalState(b.host));
      b.door.setActive(false); expect(regionalState(a.host)).not.toBe(regionalState(b.host));
    } finally { a.dispose(); b.dispose(); }
  });
  it('loads whole sims in stable order, freezes neighbours, retains an opened door and hurt creature on reload', async () => {
    const assembly = new GridAssembly({ developer: false, devserver: false }), highway = resident(), loaded = new Map<string, ReturnType<typeof resident>>(), order: string[] = [], saves = new Map<string, SimSnapshot>();
    const ids = assembly.cells.map((c) => c.instance).sort(), first = ids[0], second = ids[1]; if (first === undefined || second === undefined) throw new Error('Missing grid');
    const sim = new GridSimulation(assembly, { highway, load: (cell, saved) => { order.push(cell.instance); const value = resident(saved); loaded.set(cell.instance, value); return Promise.resolve(value); }, save: (id, snapshot) => { saves.set(id, snapshot); return true; } });
    try {
      await sim.prefetch([second, first, first]); expect(order).toEqual([first, second]);
      expect(loaded.get(first)?.host.hasPlayerMotor).toBe(false); expect(loaded.get(second)?.host.hasPlayerMotor).toBe(false);
      const transaction = await sim.prepare(null, first); transaction.commit();
      const active = loaded.get(first); if (active === undefined) throw new Error('Missing active host');
      active.door.setActive(false); active.host.entities.get('boar:1')?.applyFinalDamage(20, active.host.player.position, active.host.player.position);
      sim.step(); expect(active.host.state.tick).toBe(1); expect(loaded.get(second)?.host.state.tick).toBe(0); expect(highway.host.state.tick).toBe(0);
      expect(() => loaded.get(second)?.host.step()).toThrow('Frozen');
      expect(sim.checkpoint(first)).toBe(true); const out = await sim.prepare(first, null); out.commit();
      expect(sim.unload(first)).toBe(true); const back = await sim.prepare(null, first); back.commit();
      expect(loaded.get(first)?.door.active()).toBe(false); expect(loaded.get(first)?.host.entities.get('boar:1')?.hp).toBe(80);
      expect(loaded.get(first)?.host.state.tick).toBe(1); expect(highway.host.hasPlayerMotor).toBe(false);
    } finally { sim.dispose(); }
  });
  it('applies the strip hysteresis without changing the active instance during target calculation', async () => {
    const assembly = new GridAssembly({ developer: false, devserver: false }), cell = assembly.cells[0]; if (cell === undefined) throw new Error('Missing cell');
    const sim = new GridSimulation(assembly, { highway: resident(), load: () => Promise.resolve(resident()), save: () => true });
    try {
      expect(sim.target({ x: cell.origin.x + 257, y: 0, z: cell.origin.z })).toBeNull();
      expect(sim.target({ x: cell.origin.x + 255, y: 0, z: cell.origin.z })).toBe(cell.instance); expect(sim.current()).toBeNull();
      const prepared = await sim.prepare(null, cell.instance); prepared.commit();
      expect(sim.target({ x: cell.origin.x + 259, y: 0, z: cell.origin.z })).toBe(cell.instance);
      expect(sim.target({ x: cell.origin.x + 261, y: 0, z: cell.origin.z })).toBeNull();
    } finally { sim.dispose(); }
  });
  it('cancels prepared controllers, closes late admissions and rejects non-durable eviction', async () => {
    const assembly = new GridAssembly({ developer: false, devserver: false }), id = assembly.cells[0]?.instance; if (id === undefined) throw new Error('Missing cell');
    const highway = resident(), sim = new GridSimulation(assembly, { highway, load: () => Promise.resolve(resident()), save: () => false });
    const before = highway.host.physics.world.colliders.len();
    await sim.prefetch([id]); const transaction = await sim.prepare(null, id); transaction.cancel(); transaction.cancel();
    expect(sim.current()).toBeNull(); expect(highway.host.physics.world.colliders.len()).toBe(before); expect(sim.unload(id)).toBe(false);
    const pending = await sim.prepare(null, id); sim.dispose(); expect(() => pending.commit()).toThrow('Stale'); pending.cancel();
  });
  it('restores complete normal snapshots without changing their continuation contract', () => {
    const initial = resident(); initial.host.step(); const saved = snapshotSimHost(initial.host), restored = resident(saved);
    try { expectSameSimSnapshot(snapshotSimHost(restored.host), saved); } finally { initial.dispose(); restored.dispose(); }
  });
  it('reserves the single allocator before allocation and aborts two-phase eviction without losing a world', async () => {
    const assembly = new GridAssembly({ developer: false, devserver: false }), id = assembly.cells[0]?.instance; if (id === undefined) throw new Error('Missing cell');
    const events: string[] = [], highway = resident();
    const sim = new GridSimulation(assembly, { highway, residentBytes: () => 25_000_000,
      reserve: (instance, bytes) => { events.push(`reserve:${instance}:${bytes}`); return Promise.resolve({ release: () => { events.push('released'); }, update: () => undefined }); },
      load: () => { events.push('allocated'); return Promise.resolve(resident()); }, save: () => true });
    try {
      await sim.prefetch([id]); expect(events.slice(0, 3)).toEqual([`reserve:sim-continuations:node:${String(GRID_CONTINUATION_CACHE_BYTES)}`, `reserve:${id}:25000000`, 'allocated']);
      const abort = sim.prepareUnload(id); if (abort === null) throw new Error('Missing eviction');
      expect(sim.ready(id)).toBe(false); abort.abort(); expect(sim.ready(id)).toBe(true); expect(events).not.toContain('released');
      sim.retain(id, true, 2); expect(sim.prepareUnload(id)).toBeNull(); sim.retain(id, false, 100);
      const commit = sim.prepareUnload(id); if (commit === null) throw new Error('Missing eviction'); commit.commit(); commit.commit();
      expect(sim.ready(id)).toBe(false); expect(events.filter((event) => event === 'released')).toHaveLength(1);
    } finally { sim.dispose(); }
  });
  it('holds soft admission when the shared budget refuses, then evicts a durable frozen sim through the allocator', async () => {
    const assembly = new GridAssembly({ developer: false, devserver: false }), first = assembly.cells[0]?.instance, second = assembly.cells[1]?.instance;
    if (first === undefined || second === undefined) throw new Error('Missing grid');
    const allocator = new ResidencyAllocator({ playing: CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + Math.ceil((GRID_CONTINUATION_CACHE_BYTES + 25_000_000) * CONTENT_CAPS.residentFactor) });
    const sim = new GridSimulation(assembly, { highway: resident(), allocator, residentBytes: () => 25_000_000, load: () => Promise.resolve(resident()), save: () => true });
    try {
      await sim.prefetch([first]); expect(allocator.entries().map((e) => e.id)).toEqual(['sim-continuations:node', `sim:${first}`]);
      expect(sim.continuationState()).toMatchObject({ entries: 1, claimedBytes: GRID_CONTINUATION_CACHE_BYTES });
      sim.retain(first, true, 10); await expect(sim.prefetch([second])).rejects.toThrow('deferred'); expect(sim.ready(first)).toBe(true); expect(sim.current()).toBeNull();
      sim.retain(first, false, 200); await sim.prefetch([second]); expect(sim.ready(first)).toBe(false); expect(sim.ready(second)).toBe(true);
      expect(allocator.entries().map((e) => e.id)).toEqual(['sim-continuations:node', `sim:${second}`]); expect(sim.disposalIssues()).toEqual([]);
    } finally { sim.dispose(); }
    expect(allocator.entries()).toEqual([]);
    expect(sim.continuationState()).toMatchObject({ entries: 0, storedChars: 0, claimedBytes: 0 });
  });
  it('defers a packed pool before allocation and drops unloaded copies when a durable reader owns reload', async () => {
    const assembly = new GridAssembly({ developer: false, devserver: false }), id = assembly.cells[0]?.instance;
    if (id === undefined) throw new Error('Missing grid');
    let allocations = 0;
    const refused = new GridSimulation(assembly, { highway: resident(), allocator: new ResidencyAllocator({ playing: CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap }),
      residentBytes: () => 1000, load: () => { allocations++; return Promise.resolve(resident()); }, save: () => true });
    try { await expect(refused.prefetch([id])).rejects.toThrow('continuation cache admission deferred'); expect(allocations).toBe(0); }
    finally { refused.dispose(); }
    const durable = new Map<string, SimSnapshot>();
    const sim = new GridSimulation(assembly, { highway: resident(), allocator: new ResidencyAllocator(), residentBytes: () => 1000,
      load: (_cell, saved) => Promise.resolve(resident(saved)), save: (instance, saved) => { durable.set(instance, saved); return true; }, read: (instance) => durable.get(instance) });
    try {
      await sim.prefetch([id]); const enter = await sim.prepare(null, id); enter.commit();
      sim.host().flags.set('packed.reload'); sim.step(); expect(sim.checkpoint(id)).toBe(true);
      const leave = await sim.prepare(id, null); leave.commit(); expect(sim.unload(id)).toBe(true);
      expect(sim.continuationState()).toMatchObject({ entries: 0, storedChars: 0, claimedBytes: GRID_CONTINUATION_CACHE_BYTES });
      const back = await sim.prepare(null, id); back.commit(); expect(sim.host().flags.has('packed.reload')).toBe(true); expect(sim.host().state.tick).toBe(1);
    } finally { sim.dispose(); }
  });
  it('retires every world and allocator lease even when one scoped cleanup fails', async () => {
    const assembly = new GridAssembly({ developer: false, devserver: false }), ids = assembly.cells.slice(0, 2).map((c) => c.instance), allocator = new ResidencyAllocator(), retired: string[] = [];
    const highway = resident();
    const sim = new GridSimulation(assembly, { highway: { host: highway.host, dispose: () => { highway.dispose(); retired.push('highway'); } }, allocator, residentBytes: () => 25_000_000,
      load: (cell) => { const value = resident(); return Promise.resolve({ host: value.host, dispose: () => { value.dispose(); retired.push(cell.instance); if (cell.instance === ids[0]) throw new Error('Owned cleanup failed'); } }); }, save: () => true });
    await sim.prefetch(ids);
    expect(() => sim.dispose()).toThrow('Grid simulation disposal failed');
    expect(retired.sort()).toEqual([...ids, 'highway'].sort()); expect(allocator.entries()).toEqual([]); expect(sim.disposalIssues()).toContain('Owned cleanup failed');
    sim.dispose();
  });
  // Eight native Rapier round trips exercise both boundary resolutions and axes;
  // coverage-instrumented CI runners need longer than the default 20 seconds.
  it('walks the shared field across both frame changes at 15 and 30 m/s with no falls or snags', async () => {
    for (const resolution of [256, 257] as const) for (const axis of ['x', 'z'] as const) for (const speed of [15, 30]) {
      const assembly = new GridAssembly({ developer: false, devserver: false }), cell = assembly.cells.find((c) => c.cell[0] === 0 && c.cell[1] === 0);
      if (cell === undefined) throw new Error('Missing central cell');
      const profile = { heights: Array.from({ length: resolution }, () => 0), colours: Array.from({ length: resolution }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
      const strip = generateStrip({ id: 'east', axis, origin: axis === 'x' ? { x: 277.5, z: 0 } : { x: 0, z: 277.5 }, profiles: [profile, profile], adjacent: [cell] });
      const highwayHost = createSimHost({ ...level, entities: [], quests: [] }, { rapier, ground: false });
      installStripCollider(highwayHost.physics, strip.mesh, highwayHost.scope); highwayHost.player.position.set(axis === 'x' ? 277.5 : 0, 0, axis === 'z' ? 277.5 : 0);
      const sim = new GridSimulation(assembly, { highway: { host: highwayHost, dispose: () => { highwayHost.dispose(); } }, load: () => {
        const host = createSimHost({ ...level, entities: [], quests: [] }, { rapier, groundResolution: resolution }), mesh = strip.duplicates[0]?.mesh; if (mesh === undefined) throw new Error('Missing duplicate');
        installStripCollider(host.physics, mesh, host.scope);
        installEntrySockets(host.physics, host.scope, [{ x: 0, z: 0 }], 'backstop');
        return Promise.resolve({ host, dispose: () => host.dispose() });
      }, save: () => true });
      let crossings = 0;
      try {
        for (const direction of [-1, 1]) for (let tick = 0; tick < 180; tick++) {
          const target = sim.target(sim.worldFeet());
          if (target !== sim.current()) { if (sim.current() !== null) expect(sim.checkpoint(cell.instance)).toBe(true); const prepared = await sim.prepare(sim.current(), target); prepared.commit(); crossings++; }
          sim.step({ moveX: axis === 'x' ? direction * speed / 30 : 0, moveZ: axis === 'z' ? direction * speed / 30 : 0, yaw: direction * Math.PI / 2 });
          expect(Math.abs(sim.worldFeet().y)).toBeLessThan(0.06); expect(sim.host().player.motor.result.horizontalFreedom, JSON.stringify({ resolution, axis, speed, direction, tick, current: sim.current(), feet: sim.worldFeet() })).toBeGreaterThan(0.98);
        }
        expect(crossings).toBe(2); expect(sim.current()).toBeNull(); expect(sim.worldFeet()[axis]).toBeCloseTo(277.5, 2);
      } finally { sim.dispose(); }
    }
  }, 120_000);
  it('prepares rider and lying mount together, preserving filters, yaw and their relative offset', () => {
    const a = new Physics(rapier), b = new Physics(rapier);
    const rider = { position: { x: 10, y: 0, z: 2 }, motor: new CharacterMotor(a, { radius: 0.35, height: 1.8, step: 0.3, snap: 0.2, maxClimbDeg: 45, group: 'PLAYER', blockedBy: ['WORLD'] }) };
    const mount = { position: { x: 10, y: 0, z: 1 }, motor: new CharacterMotor(a, { radius: 0.4, height: 0.8, length: 1.8, step: 0.3, snap: 0.2, maxClimbDeg: 45, group: 'CREATURE', blockedBy: ['WORLD', 'BORDER'] }) };
    mount.motor.passThrough(['BORDER']); mount.motor.setClimb(32);
    try {
      const cancelled = prepareFrameMotors([rider, mount], b, { x: -555, z: 0 }); cancelled.cancel(); expect(a.world.colliders.len()).toBe(2); expect(b.world.colliders.len()).toBe(0);
      const frame = prepareFrameMotors([rider, mount], b, { x: -555, z: 0 }); rider.position.x += 0.5; mount.position.x += 0.5; frame.commit();
      expect(a.world.colliders.len()).toBe(0); expect(b.world.colliders.len()).toBe(2); expect(rider.position.x).toBe(-544.5); expect(mount.position.z - rider.position.z).toBe(-1);
      expect(mount.motor.passThroughKinds()).toEqual(['BORDER']); expect(mount.motor.snapshot().climbAngle).toBeCloseTo(32 * Math.PI / 180);
    } finally { rider.motor.dispose(); mount.motor.dispose(); a.dispose(); b.dispose(); }
  });
});
