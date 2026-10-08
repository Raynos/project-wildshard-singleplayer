// oxlint-disable-next-line import/no-nodejs-modules -- Reads the immutable native collision heightfield used by the shipping world.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import source from '../src/shards/pine-hollow/shard.config';
import { PINE_EDGE_HEIGHTS } from '../src/shards/pine-hollow/data/edges';
import { encodeTerrainTile, decodeTerrainTile } from '../src/engine/world/terrainTileData';
import { validateEntrywayTerrain } from '../src/game/shardfile/entryways';
import { entryFootprints } from '../src/game/shardfile/entryGeometry';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { addBakedTerrainCollider } from '../src/engine/physics/terrainTiles';
import { floorBelow } from '../src/engine/physics/query';
import { Scope } from '../src/engine/app/scope';
import wasmInline from '../public/assets/physics/rapier.wasm?inline';

const original = readFileSync('public/assets/baked/pine-hollow/terrain.bin');
const view = new DataView(original.buffer, original.byteOffset, original.byteLength), resolution = view.getUint32(8, true);
if (view.getUint32(0, true) !== 0x52545357 || view.getUint32(4, true) !== 1 || resolution !== 256 || view.getFloat32(12, true) !== 500) throw new Error('Unexpected Pine native bake');
const heights = Float32Array.from({ length: resolution ** 2 }, (_, i) => view.getFloat32(24 + i * 4, true));
// Only the transport header changes: keep all native Float32 samples and their collision lattice.
const bytes = encodeTerrainTile({ resolution, x: -250, z: -250, size: 500, heights });
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
describe('Pine real native midpoint entries', () => {
  it('retains every collision sample and declares the native boundary within its recorded millimetre precision', () => {
    expect(decodeTerrainTile(bytes).heights).toEqual(heights);
    for (const side of ['north', 'east', 'south', 'west'] as const) {
      const native = Array.from({ length: resolution }, (_, k) => heights[(side === 'north' ? resolution - 1 : side === 'south' ? 0 : k) * resolution + (side === 'east' ? resolution - 1 : side === 'west' ? 0 : k)] ?? Number.NaN);
      expect(source.edge[side].heights).toEqual([...PINE_EDGE_HEIGHTS[side]]);
      expect(Math.max(...native.map((height, k) => Math.abs(height - (source.edge[side].heights[k] ?? Number.NaN))))).toBeLessThanOrEqual(0.000501);
    }
  });
  it('admits the full continuous footprints and queries real native ground without a platform socket or implicit plane', () => {
    expect(source.entryways.map(entry => [entry.edge, entry.width, entry.kind ?? 'ground'])).toEqual([['north', 8, 'ground'], ['east', 8, 'ground'], ['south', 8, 'ground'], ['west', 8, 'ground']]);
    expect(() => validateEntrywayTerrain({ entryways: source.entryways, terrain: { collider: 'native' } }, new Map([['native', bytes]]))).not.toThrow();
    const physics = new Physics(rapier), scope = new Scope('pine-native-entry');
    try {
      addBakedTerrainCollider(physics, bytes, scope); physics.step(); expect(physics.world.colliders.len()).toBe(1);
      for (const rect of entryFootprints(source.entryways)) {
        expect((rect.maxX - rect.minX) * (rect.maxZ - rect.minZ)).toBe(120);
        for (let x = rect.minX + 0.125; x < rect.maxX; x += 0.25) for (let z = rect.minZ + 0.125; z < rect.maxZ; z += 0.25) expect(floorBelow(physics, x, z, 1, 2)).toBeCloseTo(0, 5);
      }
    } finally { scope.dispose(); physics.dispose(); }
  });
});
