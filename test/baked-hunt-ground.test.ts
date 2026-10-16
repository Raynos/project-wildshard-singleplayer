import { expect, test } from 'vitest';
import { bakedHuntGround } from '../src/engine/ai/huntPattern';
import type { BakedGrid } from '../src/format/bakedTerrainBytes';

test('baked hunting ground keeps inclusive bounds and live water, wetness and forest authority', () => {
  const grid: BakedGrid = { res: 2, size: 10, seed: 0, landscapeHash: 0, heights: new Float32Array([0, 10, 0, 10]), splat: new Uint8Array(16), undergrowth: null };
  let water = 2, wet = false, empty = false, sea = false;
  const field = { trailDistance: (x: number, z: number) => x - z, cabinMask: (x: number, z: number) => x + z,
    waterLevel: () => water, pond: { x: 1, z: 2, r: 3 } as { x: number; z: number; r: number } | null };
  const trees = [{ x: 1, z: 2, r: 0.4 }], queries: number[][] = [];
  const ports = { field, chunkHalf: 5, trees: (x: number, z: number, r: number) => { queries.push([x, z, r]); return trees; },
    treeless: () => empty, sea: () => sea, wetAt: () => wet };
  const ground = bakedHuntGround(grid, ports);
  expect(ground.heightAt(0, 0)).toBeCloseTo(5);
  expect(ground.normalY(0, 0)).toBeCloseTo(Math.SQRT1_2);
  expect(ground.inChunk(-4, 4, 1)).toBe(true);
  expect(ground.inChunk(-4.01, 4, 1)).toBe(false);
  expect(ground.trailDistance(3, 1)).toBe(2);
  expect(ground.cabinMask(3, 1)).toBe(4);
  expect(ground.streamAt(1, 2)).toBeNull();
  expect(ground.waterLevel()).toBe(2);
  water = 7; field.pond = null; wet = true; empty = true; sea = true;
  expect(ground.waterLevel()).toBe(7);
  expect(ground.pond()).toBeNull();
  expect(ground.wetAt(0, 0)).toBe(true);
  expect(ground.treeless()).toBe(true);
  expect(ground.sea()).toBe(true);
  expect(ground.trees(3, 4, 5)).toBe(trees);
  expect(queries).toEqual([[3, 4, 5]]);
  expect(ground.terrain()).toBe(true);
  expect(bakedHuntGround(grid, { ...ports, field: { ...field, streamAt: (x, z) => x + z } }).streamAt(2, 3)).toBe(5);
});
