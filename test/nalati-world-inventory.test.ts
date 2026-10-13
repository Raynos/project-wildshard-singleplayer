// oxlint-disable-next-line import/no-nodejs-modules -- Inventory pins committed native bake bytes before conversion.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nativeTerrainWitness } from '../src/shards/nalati-grasslands/generators/nalati-world-inventory.mjs';
import { NALATI_EDGES } from '../src/shards/nalati-grasslands/data/edges';

const bytes = readFileSync(new URL('../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url));
describe('Nalati world conversion authority', () => {
  it('pins all native samples, four boundaries and complete entry footprints without resampling', () => {
    const report = nativeTerrainWitness(bytes, NALATI_EDGES);
    expect(report.sha256).toBe('6e891957a4397f11df121137c7d35311fe975d062975f46aca03873d3476d7dd');
    expect(report.resolution).toBe(256); expect(report.samples).toBe(65536);
    expect(Object.values(report.boundaries)).toHaveLength(4);
    expect(report.entries.map(entry => [entry.area, entry.y, entry.nativeCorners > 0])).toEqual(Array.from({ length: 4 }, () => [120, 0, true]));
  });
  it('refuses a single changed boundary height or a changed native lattice', () => {
    const changed = Uint8Array.from(bytes), view = new DataView(changed.buffer);
    view.setFloat32(24, view.getFloat32(24, true) + 1, true);
    expect(() => nativeTerrainWitness(changed, NALATI_EDGES)).toThrow('native boundary differs');
    view.setUint32(8, 257, true);
    expect(() => nativeTerrainWitness(changed, NALATI_EDGES)).toThrow('WSTR256');
  });
  it('refuses a raised interior entry corner even when all boundary rows are unchanged', () => {
    const changed = Uint8Array.from(bytes), view = new DataView(changed.buffer);
    view.setFloat32(24 + (250 * 256 + 128) * 4, 0.01, true);
    expect(() => nativeTerrainWitness(changed, NALATI_EDGES)).toThrow('entry footprint is not flat');
  });
});
