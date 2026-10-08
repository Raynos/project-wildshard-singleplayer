// oxlint-disable-next-line import/no-nodejs-modules -- The proof reads the committed immutable terrain bake.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import source from '../src/shards/nalati-grasslands/shard.config';
import { NALATI_EDGES } from '../src/shards/nalati-grasslands/data/edges';
import { encodeTerrainTile, decodeTerrainTile, terrainTileHeight } from '../src/engine/world/terrainTileData';
import { validateEntrywayTerrain } from '../src/game/shardfile/entryways';
import { entryFootprints } from '../src/game/shardfile/entryGeometry';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { addBakedTerrainCollider } from '../src/engine/physics/terrainTiles';
import { floorBelow } from '../src/engine/physics/query';
import { Scope } from '../src/engine/app/scope';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const original = readFileSync(new URL('../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url));
const view = new DataView(original.buffer, original.byteOffset, original.byteLength), resolution = view.getUint32(8, true);
if (view.getUint32(0, true) !== 0x52545357 || view.getUint32(4, true) !== 1 || resolution !== 256 || view.getFloat32(12, true) !== 500) throw new Error('Unexpected Nalati native bake');
const heights = Float32Array.from({ length: resolution ** 2 }, (_, i) => view.getFloat32(24 + i * 4, true));
// Change the wire header only. Every native sample and its 256 lattice location remain identical; no resampling.
const bytes = encodeTerrainTile({ resolution, x: -250, z: -250, size: 500, heights });
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
describe('Nalati real native midpoint entries', () => {
  it('preserves every terrain height and declares the exact four full native boundary rows', () => {
    expect(decodeTerrainTile(bytes).heights).toEqual(heights);
    for (const side of ['north', 'east', 'south', 'west'] as const) {
      const row = Array.from({ length: resolution }, (_, k) => heights[(side === 'north' ? resolution - 1 : side === 'south' ? 0 : k) * resolution + (side === 'east' ? resolution - 1 : side === 'west' ? 0 : k)]);
      expect(NALATI_EDGES[side].heights).toEqual(row);
      expect(source.edge[side].heights).toEqual(row);
    }
  });
  it('admits all continuous 8×15 footprints before allocating any platform socket', () => {
    expect(source.entryways).toHaveLength(4);
    expect(() => validateEntrywayTerrain({ entryways: source.entryways, terrain: { collider: 'native' } }, new Map([['native', bytes]]))).not.toThrow();
    const physics = new Physics(rapier), scope = new Scope('nalati-native-entry');
    try {
      addBakedTerrainCollider(physics, bytes, scope); physics.step();
      expect(physics.world.colliders.len()).toBe(1);
      for (const rect of entryFootprints(source.entryways)) {
        expect((rect.maxX - rect.minX) * (rect.maxZ - rect.minZ)).toBe(120);
        for (let x = rect.minX + 0.125; x < rect.maxX; x += 0.25) for (let z = rect.minZ + 0.125; z < rect.maxZ; z += 0.25) expect(floorBelow(physics, x, z, 1, 2)).toBeCloseTo(0, 5);
      }
    } finally { scope.dispose(); physics.dispose(); }
  });
  it('continues all 92 entry lanes for 50 m over the authored road instead of requiring a flat world', () => {
    const physics = new Physics(rapier), scope = new Scope('nalati-native-walk');
    const motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] });
    const terrain = decodeTerrainTile(bytes);
    let lanes = 0;
    try {
      addBakedTerrainCollider(physics, bytes, scope); physics.step();
      for (const side of ['north', 'east', 'south', 'west'] as const) for (let lane = 0; lane < 23; lane++) {
        const offset = -3.65 + lane * 7.3 / 22, along = side === 'north' || side === 'east' ? 249.55 : -249.55;
        const feet = { x: side === 'north' || side === 'south' ? offset : along, y: 0.03, z: side === 'east' || side === 'west' ? offset : along };
        const delta = { x: side === 'east' ? -0.1 : side === 'west' ? 0.1 : 0, y: -9.81 / 3600, z: side === 'north' ? -0.1 : side === 'south' ? 0.1 : 0 };
        let travelled = 0, stalled = 0;
        for (let tick = 0; travelled < 50; tick++) {
          const before = side === 'north' || side === 'south' ? feet.z : feet.x;
          const result = motor.move(feet, delta);
          const advance = (side === 'north' || side === 'east' ? -1 : 1) * ((side === 'north' || side === 'south' ? feet.z : feet.x) - before);
          travelled += advance; stalled = advance < 0.05 ? stalled + 1 : 0;
          expect(tick).toBeLessThan(600); expect(stalled).toBeLessThan(5); expect(result.grounded).toBe(true);
          expect(Math.abs((side === 'north' || side === 'south' ? feet.x : feet.z) - offset)).toBeLessThanOrEqual(0.35);
          const authored = terrainTileHeight(terrain, feet.x, feet.z);
          expect(Math.abs(feet.y - authored)).toBeLessThanOrEqual(0.15);
          expect(result.groundNormalY).toBeGreaterThanOrEqual(Math.cos(Math.PI / 4));
          // Only the canonical socket is required to stay at y=0; the following real road may descend.
          if (travelled < 14.55) { expect(authored).toBe(0); expect(result.groundNormalY).toBeGreaterThanOrEqual(0.99); }
        }
        lanes++;
      }
      expect(lanes).toBe(92); expect(physics.world.colliders.len()).toBe(2);
    } finally { motor.dispose(); scope.dispose(); physics.dispose(); }
  }, 60_000); // 46,000+ real native moves and per-step contact assertions share CPU with the full CI suite.
});
