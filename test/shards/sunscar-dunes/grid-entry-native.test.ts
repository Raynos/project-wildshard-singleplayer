// oxlint-disable-next-line import/no-nodejs-modules -- Walk the committed native collision samples, never an analytic substitute.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { addBakedTerrainCollider } from '../../../src/engine/physics/terrainTiles';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/format/terrainTileBytes';

it('walks all 92 Signal Dunes entry lanes on its shipped terrain collider, then releases every collider', async () => {
  // the collider the grid's required-ground loader and the standalone look both admit (data/tiles.json → assets/<sha256>)
  const tiles: unknown = JSON.parse(readFileSync('src/shards/sunscar-dunes/data/tiles.json', 'utf8'));
  const collider = typeof tiles === 'object' && tiles !== null && 'terrain' in tiles && typeof tiles.terrain === 'object' && tiles.terrain !== null
    && 'collider' in tiles.terrain && typeof tiles.terrain.collider === 'string' ? tiles.terrain.collider : null;
  if (collider === null) throw new Error('Missing Signal terrain collider');
  const bytes = Uint8Array.from(readFileSync(`src/shards/sunscar-dunes/assets/${collider}`)), terrain = decodeTerrainTile(bytes);
  expect([terrain.resolution, terrain.x, terrain.z, terrain.size]).toEqual([257, -250, -250, 500]);
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const physics = new Physics(rapier), scope = new Scope('sunscar-native-entry');
  const motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] });
  let lanes = 0, steps = 0;
  try {
    addBakedTerrainCollider(physics, bytes, scope); physics.step();
    // There is no socket floor, implicit plane, boundary wall or second terrain owner in this proof.
    expect(physics.world.colliders.len()).toBe(2);
    for (const side of ['north', 'east', 'south', 'west'] as const) for (let lane = 0; lane < 23; lane++) {
      const offset = -3.65 + lane * 7.3 / 22, along = side === 'north' || side === 'east' ? 249.55 : -249.55;
      const feet = { x: side === 'north' || side === 'south' ? offset : along, y: 0.03, z: side === 'east' || side === 'west' ? offset : along };
      const delta = { x: side === 'east' ? -0.1 : side === 'west' ? 0.1 : 0, y: -9.81 / 3600, z: side === 'north' ? -0.1 : side === 'south' ? 0.1 : 0 };
      let travelled = 0, stalled = 0;
      for (let tick = 0; travelled < 50; tick++) {
        const before = side === 'north' || side === 'south' ? feet.z : feet.x;
        const result = motor.move(feet, delta); steps++;
        const advance = (side === 'north' || side === 'east' ? -1 : 1) * ((side === 'north' || side === 'south' ? feet.z : feet.x) - before);
        travelled += advance; stalled = advance < 0.05 ? stalled + 1 : 0;
        const authored = terrainTileHeight(terrain, feet.x, feet.z), lateral = side === 'north' || side === 'south' ? feet.x : feet.z;
        if (tick >= 600 || stalled >= 5 || !result.grounded || Math.abs(lateral - offset) > 0.35
          || Math.abs(feet.y - authored) > 0.15 || result.groundNormalY < Math.cos(Math.PI / 4)
          || (travelled < 14.55 && (authored !== 0 || result.groundNormalY < 0.99))) {
          throw new Error(`Blocked native ${side} lane ${lane}: ${JSON.stringify({ tick, travelled, stalled, feet, authored, result })}`);
        }
      }
      lanes++;
    }
    expect(lanes).toBe(92); expect(steps).toBeGreaterThanOrEqual(46_000);
    expect(physics.world.colliders.len()).toBe(2);
  } finally {
    motor.dispose(); scope.dispose();
    expect(physics.world.colliders.len()).toBe(0); expect(physics.world.bodies.len()).toBe(0);
    physics.dispose();
  }
});
