// oxlint-disable-next-line import/no-nodejs-modules -- Pin committed native bytes before any world conversion.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pineTerrainWitness } from '../scripts/bake/pine-world-inventory.mjs';
import { PINE_EDGE_HEIGHTS } from '../src/shards/pine-hollow/data/edges';

const bytes = readFileSync(new URL('../public/assets/baked/pine-hollow/terrain.bin', import.meta.url));
const metadata: unknown = JSON.parse(readFileSync(new URL('../public/assets/baked/pine-hollow/terrain.json', import.meta.url), 'utf8'));
describe('Pine world bake authority', () => {
  it('pins exact heights, splats and placement bytes while recording the existing millimetre edge rounding', () => {
    const report = pineTerrainWitness(bytes, metadata, PINE_EDGE_HEIGHTS);
    expect(report.sha256).toBe('73135bc55e9acc06475f7e13c6bd9a907ed9ba2c0524a24275617f877dfd562d');
    expect(report.samples).toBe(65536);
    expect(Object.values(report.boundaries).every(row => row.maxRoundingError <= 0.0005)).toBe(true);
    expect(report.entries.map(entry => [entry.area, entry.y, entry.nativeCorners])).toEqual(Array.from({ length: 4 }, () => [120, 0, 54]));
  });
  it('refuses changed interior entry ground without relying on edge declarations', () => {
    const changed = Uint8Array.from(bytes);
    new DataView(changed.buffer).setFloat32(24 + (250 * 256 + 128) * 4, 0.01, true);
    expect(() => pineTerrainWitness(changed, metadata, PINE_EDGE_HEIGHTS)).toThrow('entry footprint is not flat');
  });
  it('refuses changed native boundary or placement bytes', () => {
    const changed = Uint8Array.from(bytes), view = new DataView(changed.buffer);
    view.setFloat32(24, view.getFloat32(24, true) + 1, true);
    expect(() => pineTerrainWitness(changed, metadata, PINE_EDGE_HEIGHTS)).toThrow('rounded declaration differs');
    const placement = Uint8Array.from(bytes); placement[placement.length - 1] = (placement.at(-1) ?? 0) ^ 1;
    expect(() => pineTerrainWitness(placement, metadata, PINE_EDGE_HEIGHTS)).toThrow('metadata differs');
  });
});
