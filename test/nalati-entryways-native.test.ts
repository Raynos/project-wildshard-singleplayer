// oxlint-disable-next-line import/no-nodejs-modules -- The proof reads the committed immutable terrain bake.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import source from '../src/shards/nalati-grasslands/shard.config';
import { NALATI_EDGES } from '../src/shards/nalati-grasslands/data/edges';
import { encodeTerrainTile, decodeTerrainTile } from '../src/engine/world/terrainTileData';
import { validateEntrywayTerrain } from '../src/game/shardfile/entryways';
import { entryFootprints } from '../src/game/shardfile/entryGeometry';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
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

});
