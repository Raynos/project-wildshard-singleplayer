import { describe, expect, it } from 'vitest';
import { CHUNK_HALF } from '../src/engine/core/config';
import { SEA_RES } from '../src/shards/driftwood-isle/generators/oceanLook';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { oceanGrid, oceanGridGlb, seaFloor } from '../src/shards/driftwood-isle/generators/oceanGrid';

const ground = { heightAt: (x: number, z: number): number => -2 + 0.01 * x - 0.02 * z, inChunk: (x: number, z: number): boolean => Math.abs(x) <= CHUNK_HALF && Math.abs(z) <= CHUNK_HALF };

describe('Driftwood sea bake', () => {
  it('bakes the coarsening grid with its still depth, seed and alternating diagonals', () => {
    const geo = oceanGrid(ground, 4, 0, 6), pos = geo.getAttribute('position'), depth = geo.getAttribute('aDepth'), seed = geo.getAttribute('aSeed');
    const n = Math.round(Math.sqrt(pos.count));
    expect(n * n).toBe(pos.count);
    expect(geo.getIndex()?.count).toBe((n - 1) * (n - 1) * 6);
    for (let i = 0; i < pos.count; i += 97) {
      const x = pos.getX(i), z = pos.getZ(i);
      expect(pos.getY(i)).toBe(0);
      expect(depth.getX(i)).toBeCloseTo(ground.inChunk(x, z) ? -ground.heightAt(x, z) : 12, 4);
      expect(seed.getX(i)).toBeGreaterThanOrEqual(0); expect(seed.getX(i)).toBeLessThan(1);
    }
    expect(Math.max(...Array.from({ length: n }, (_, i) => pos.getX(i)))).toBeGreaterThanOrEqual(4200);
  });

  it('round-trips the grid GLB through the runtime intake with its depth and seed channels', async () => {
    const intake = createOwnedGeometry('ocean.glb', { _depth: 'aDepth', _seed: 'aSeed' });
    await intake.load(oceanGridGlb(ground, 4, 0, 6));
    const geo = intake.take(), raw = oceanGrid(ground, 4, 0, 6);
    expect(geo.getAttribute('aDepth').count).toBe(raw.getAttribute('aDepth').count);
    expect(geo.getAttribute('aSeed').getX(5)).toBeCloseTo(raw.getAttribute('aSeed').getX(5), 6);
    expect(geo.getIndex()?.count).toBe(raw.getIndex()?.count);
  });

  it('bakes the sea floor at each texel centre', () => {
    const floor = seaFloor(ground);
    expect(floor.length).toBe(SEA_RES * SEA_RES);
  });
});
