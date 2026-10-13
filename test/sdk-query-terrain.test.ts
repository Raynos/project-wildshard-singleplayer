import { expect, it } from 'vitest';
import { bakeQueryTerrain, readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { encodeTerrainTile, decodeTerrainTile, bilinearTerrainSamplers } from '@wildshard/format/terrainTileBytes';
import { assetCost, validateTerrainAssets } from '@wildshard/format/product';
import { emptyShardfile } from '@wildshard/sdk/author';

function nativeBytes(resolution: 256 | 257): Uint8Array {
  const count = resolution ** 2, bytes = new Uint8Array(24 + count * 8), view = new DataView(bytes.buffer);
  bytes.set([0x57, 0x53, 0x54, 0x52]); view.setUint32(4, 1, true); view.setUint32(8, resolution, true);
  view.setFloat32(12, 500, true); view.setUint32(16, 123, true);
  for (let i = 0; i < count; i++) {
    view.setFloat32(24 + i * 4, ((i * 137) % 512) / 64 - 4, true);
    bytes[24 + count * 4 + i * 4] = i % 256;
    bytes[24 + count * 4 + i * 4 + 1] = 255 - i % 256;
  }
  return bytes;
}

for (const resolution of [256, 257] as const) it(`encodes the original ${resolution} lattice without evaluating or resampling its field`, () => {
  const native = readNativeTerrain(nativeBytes(resolution)), fail = (): never => { throw new Error('Analytic field was evaluated'); };
  const result = bakeQueryTerrain({ ...native, heightAt: fail, normalAt: fail, splatAt: fail }, { normalEpsilon: 0.6, datum: -0.8 });
  expect(result.terrain.form).toBe('query'); expect(result.terrain.tiles).toEqual([]);
  const [file] = result.files; if (file === undefined) throw new Error('Missing query root');
  const wire = result.assets.get(file.hash); if (wire === undefined) throw new Error('Missing query bytes');
  expect(wire).toEqual(encodeTerrainTile({ resolution, x: -250, z: -250, size: 500, heights: native.grid.heights, splat: native.grid.splat }));
  expect(result.files).toHaveLength(1); expect(result.assets.size).toBe(1); expect(result.critical).toEqual([file.hash]);
  expect(file).toMatchObject({ critical: true, compressed: wire.length, ...assetCost('binary', wire) });
  expect(file).toMatchObject({ gpu: 0, draws: 0, triangles: 0 });
  expect(result.terrain.collider).toBe(file.hash);
  const decoded = decodeTerrainTile(wire), queries = bilinearTerrainSamplers(decoded, 0.6, -0.8);
  for (let i = 0; i < 1000; i++) {
    const x = (i * 137.031) % 620 - 310, z = (i * 71.917) % 620 - 310;
    expect(queries.heightAt(x, z)).toBe(native.heightAt(x, z) - 0.8);
    expect(queries.normalAt(x, z)).toEqual(native.normalAt(x, z, 0.6));
    expect(queries.splatAt(x, z)).toEqual(native.splatAt(x, z));
  }
  const first = decoded.heights[0]; native.grid.heights.fill(42);
  expect(decodeTerrainTile(wire).heights[0]).toBe(first);
  const base = emptyShardfile({ slug: 'query-fixture', name: 'Query fixture', author: 'Test', seed: 123, revision: 1 });
  expect(() => validateTerrainAssets(result.terrain, result.assets, { ...base, critical: result.critical })).not.toThrow();
  expect(() => validateTerrainAssets(result.terrain, result.assets, { ...base, critical: [] })).toThrow(/critical/u);
});

it('refuses invalid query metadata and source lattices before producing an admitted root', () => {
  const native = readNativeTerrain(nativeBytes(256));
  expect(() => bakeQueryTerrain(native, { normalEpsilon: 0 })).toThrow();
  expect(() => bakeQueryTerrain(native, { datum: Number.NaN })).toThrow();
  expect(() => bakeQueryTerrain({ ...native, grid: { ...native.grid, size: 250 } })).toThrow(/500 m/u);
  native.grid.heights[0] = Number.NaN;
  expect(() => bakeQueryTerrain(native)).toThrow();
});
