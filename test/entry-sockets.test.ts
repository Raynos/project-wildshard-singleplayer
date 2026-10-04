// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the shipped Rapier binary against scoped platform floors.
import { readFile } from 'node:fs/promises';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { Scope } from '../src/engine/app/scope';
import { entrySockets, installEntrySockets } from '../src/engine/physics/entrySockets';
import { castRay } from '../src/engine/physics/query';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
it('uses identical local footprints for standalone and rebased grid cells, with platform tags and scope cleanup', () => {
  const physics = new Physics(rapier), home = new Scope('home'), grid = new Scope('grid');
  try {
    expect(entrySockets({ x: 0, z: 0 })).toEqual([
      { x: 0, z: 242.5, halfX: 4, halfZ: 7.5 }, { x: 242.5, z: 0, halfX: 7.5, halfZ: 4 },
      { x: 0, z: -242.5, halfX: 4, halfZ: 7.5 }, { x: -242.5, z: 0, halfX: 7.5, halfZ: 4 },
    ]);
    const local = installEntrySockets(physics, home, [{ x: 0, z: 0 }]);
    const moved = installEntrySockets(physics, grid, [{ x: 555, z: -555 }]); physics.step();
    expect(local.length).toBe(4); expect(moved.length).toBe(4);
    for (const origin of [{ x: 0, z: 0 }, { x: 555, z: -555 }]) for (const socket of entrySockets(origin)) {
      for (const [dx, dz] of [[0, 0], [-socket.halfX + 0.01, -socket.halfZ + 0.01], [socket.halfX - 0.01, socket.halfZ - 0.01]]) {
        if (dx === undefined || dz === undefined) throw new Error('Missing sample');
        const hit = castRay(physics, { x: socket.x + dx, y: 2, z: socket.z + dz }, { x: 0, y: -1, z: 0 }, 3);
        expect(hit?.point.y).toBeCloseTo(0, 6); expect(hit?.material).toBe('stone'); expect(hit?.owner).toBe('platform.grid');
      }
    }
    grid.dispose(); expect(physics.world.colliders.len()).toBe(4);
    home.dispose(); expect(physics.world.colliders.len()).toBe(0);
  } finally { grid.dispose(); home.dispose(); physics.dispose(); }
});
it('walks the full 15 metre socket at road height in either axis without introducing a lip', () => {
  const physics = new Physics(rapier), scope = new Scope('walk');
  const motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] });
  try {
    installEntrySockets(physics, scope, [{ x: 0, z: 0 }]); physics.step();
    for (const socket of entrySockets({ x: 0, z: 0 })) for (const sign of [-1, 1]) {
      const alongX = socket.halfX > socket.halfZ, feet = { x: socket.x, y: 0.05, z: socket.z };
      if (alongX) feet.x -= sign * 7; else feet.z -= sign * 7;
      const start = alongX ? feet.x : feet.z;
      for (let tick = 0; tick < 168; tick++) {
        const delta = motor.move(feet, { x: alongX ? sign / 12 : 0, y: -9.81 / 3600, z: alongX ? 0 : sign / 12 });
        feet.x += delta.x; feet.y += delta.y; feet.z += delta.z;
        expect(feet.y).toBeGreaterThanOrEqual(-0.01); expect(feet.y).toBeLessThan(0.1);
      }
      expect(Math.abs((alongX ? feet.x : feet.z) - start)).toBeGreaterThan(13.9);
    }
  } finally { motor.dispose(); scope.dispose(); physics.dispose(); }
});
it('rejects duplicate, nonfinite and disposed origins before allocating any collider', () => {
  const physics = new Physics(rapier), scope = new Scope('reject');
  try {
    expect(() => installEntrySockets(physics, scope, [{ x: 0, z: 0 }, { x: 0, z: 0 }])).toThrow('Duplicate');
    expect(() => installEntrySockets(physics, scope, [{ x: 0, z: 0 }, { x: Infinity, z: 0 }])).toThrow('Invalid');
    expect(physics.world.colliders.len()).toBe(0);
    scope.dispose(); expect(() => installEntrySockets(physics, scope, [{ x: 0, z: 0 }])).toThrow('disposed');
  } finally { scope.dispose(); physics.dispose(); }
});
