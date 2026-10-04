// oxlint-disable-next-line import/no-nodejs-modules -- The joined fixture boots the committed Rapier WASM.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimLevel } from '../src/engine/sim';
import { readinessModel, TraversalReadiness } from '../src/engine/sim/readiness';
import { generateStrip } from '../src/engine/sim/strips';
import { ReadinessWalls } from '../src/engine/physics/readinessWalls';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridSimulation, type GridResident } from '../src/game/grid/simulation';
import { SIM_LEVEL } from './fixtures/sim-level/level';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer); });
const level: SimLevel = { ...SIM_LEVEL, ground: { size: 500, height: 0 }, player: { ...SIM_LEVEL.player, speed: 30 }, entities: [], quests: [] };

for (const maxStallSeconds of [3, 10]) it(`joins cold 30 m/s traversal, a ${maxStallSeconds}s stall, late colliders and a U-turn with the actual strip and residency driver`, async () => {
  const assembly = new GridAssembly({ developer: false, devserver: false }), cell = assembly.cells.find((row) => row.cell[0] === 0 && row.cell[1] === 0);
  if (cell === undefined) throw new Error('Central cell');
  const profile = { heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
  const strip = generateStrip({ id: 'readiness.east', axis: 'x', origin: { x: 277.5, z: 0 }, profiles: [profile, profile], adjacent: [cell] });
  const estimate = readinessModel({ criticalWireBytes: 2_000_000, hybridWireBytes: 500_000, decodeSeconds: 0.8, runtimeParseSeconds: 0.2 },
    { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.5, maxStallSeconds });
  const readiness = new TraversalReadiness(), ticket = readiness.request(cell.instance, 27.5, estimate, true);
  if (ticket === null) throw new Error('Cold neighbour request');
  const walls = new Map<SimHost, ReadinessWalls>();
  const installWalls = (host: SimHost): void => { walls.set(host, new ReadinessWalls(host.physics, [
    { instance: cell.instance, x: 256, z: 0, halfLength: 250.25, axis: 'x', floor: 0 }, // Hold before the 6 m re-frame line, on shared ground.
    { instance: null, x: 305, z: 0, halfLength: 250.25, axis: 'x', floor: 0 },
  ], host.scope)); };
  const highway = createSimHost(level, { rapier, ground: false });
  installStripCollider(highway.physics, strip.mesh, highway.scope); installWalls(highway); highway.player.position.set(277.5, 0, 0);
  let destination: GridResident | undefined, finish: ((value: GridResident) => void) | undefined;
  const sim = new GridSimulation(assembly, {
    highway: { host: highway, dispose: () => { highway.dispose(); } },
    load: () => {
      const host = createSimHost(level, { rapier }); installWalls(host);
      host.player.motor.setEnabled(false); // The not-yet-admitted host is frozen and cannot own a traveler.
      destination = { host, dispose: () => { host.dispose(); } };
      return new Promise<GridResident>((resolve) => { finish = resolve; });
    },
    save: () => true, admitted: (id) => readiness.status(id).ready,
    invalidated: (id) => { readiness.invalidate(id); },
    beforeMove: (_id, host) => { walls.get(host)?.sync(readiness); },
  });
  const loading = sim.prefetch([cell.instance]);
  const lateTick = Math.ceil(estimate.seconds * 60) + 120;
  let tick = 0, crossings = 0, heldTicks = 0, verticalVelocity = 0;
  const move = async (direction: number, count: number): Promise<void> => {
    for (let i = 0; i < count; i++, tick++) {
      if (tick === lateTick - 60) readiness.complete(ticket, 'runtime');
      if (tick === lateTick - 30) readiness.complete(ticket, 'sim');
      if (tick === lateTick) {
        const duplicate = strip.duplicates[0], value = destination;
        if (duplicate === undefined || value === undefined || finish === undefined) throw new Error('Pending collider admission');
        installStripCollider(value.host.physics, duplicate.mesh, value.host.scope);
        readiness.complete(ticket, 'colliders'); finish(value);
      }
      const target = sim.target(sim.worldFeet());
      if (target !== sim.current() && sim.ready(target)) {
        if (sim.current() !== null) expect(sim.checkpoint(cell.instance)).toBe(true);
        const prepared = await sim.prepare(sim.current(), target); prepared.commit(); crossings++;
      }
      sim.step(); // Step the active world and its beforeMove fence; the fixture drives one gravity-bearing capsule move.
      verticalVelocity -= 9.81 / 60;
      const moved = sim.host().player.motor.move(sim.host().player.position, { x: direction * 30 / 60, y: verticalVelocity / 60, z: 0 });
      if (moved.grounded) verticalVelocity = 0;
      const feet = sim.worldFeet(), pose = JSON.stringify({ tick, current: sim.current(), feet });
      expect(feet.y, pose).toBeGreaterThan(-0.06);
      expect(feet.y, pose).toBeLessThan(sim.host().player.motor.opts.step + 0.05);
      if (sim.current() === cell.instance && feet.x < 245) expect(moved.horizontalFreedom).toBeGreaterThan(0.98);
      if (!readiness.status(cell.instance).ready && direction < 0) {
        expect(sim.current()).toBeNull(); expect(feet.x).toBeGreaterThan(256);
        if (sim.host().player.motor.result.horizontalFreedom < 0.1) heldTicks++;
      }
      let capsules = 0;
      for (const host of [highway, ...(destination === undefined ? [] : [destination.host])]) host.physics.world.forEachCollider((collider) => {
        if (collider.isEnabled() && collider.collisionGroups() === groups('PLAYER')) capsules++;
      });
      expect(capsules).toBe(1);
      await Promise.resolve();
    }
  };
  try {
    await move(-1, 120); expect(heldTicks).toBeGreaterThan(30);
    await move(1, 50); expect(sim.worldFeet().x).toBeGreaterThan(274); // U-turn while the request remains in flight.
    await move(-1, lateTick - tick + 91); await loading;
    expect(crossings).toBe(1); expect(sim.current()).toBe(cell.instance); expect(sim.worldFeet().x).toBeLessThan(215);
    await move(1, 145); expect(crossings).toBe(2); expect(sim.current()).toBeNull();
    expect(sim.unload(cell.instance)).toBe(true); expect(readiness.status(cell.instance).ready).toBe(false);
    expect(readiness.complete(ticket, 'colliders')).toBe(false);
    destination = undefined;
    await move(1, 180); expect(sim.worldFeet().x).toBeGreaterThan(304); expect(sim.worldFeet().x).toBeLessThan(305);
    expect(readiness.status(null).proxy).toBe(true); expect(crossings).toBe(2);
  } finally { sim.dispose(); }
});
