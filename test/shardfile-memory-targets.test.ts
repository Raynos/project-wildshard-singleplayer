import { expect, it } from 'vitest';
import { CONTENT_CAPS as C } from '../src/engine/core/config';
import { memoryTargetWarnings, worstContentCost } from '../src/game/shardfile/budget';
import { parseShardfile } from '../src/game/shardfile/schema';
import { emptyShardfile } from '@wildshard/sdk/author';
import { validateProject } from '@wildshard/sdk/project';

const source = () => emptyShardfile({ slug: 'memory-targets', name: 'Memory targets', author: 'Fixture', revision: 1, seed: 1 });

it('admits tradeable category memory above the targets while warning on every exceeded category', () => {
  const s = source();
  s.budgets.library.resident = C.library.resident + 1;
  s.budgets.sim.resident = C.sim.resident + 1;
  s.serverBudget.memory = C.sim.resident + 1;
  s.budgets.overlap = C.overlap + 1;
  s.far = { files: [], bounds: { min: [-250, 0, -250], max: [250, 0, 250] }, compressed: 0, decoded: C.far.resident + 1, gpu: 0, triangles: 0, draws: 0 };
  for (const lod of [0, 1] as const) {
    const cap = lod === 0 ? C.l0 : C.l1;
    s.tiles.push({ lod, x: 0, z: 0, bounds: { min: [-250, 0, -250], max: [-250 + cap.size, 0, -250 + cap.size] }, geometricError: 0, files: [], compressed: 0, decoded: cap.resident + 1, gpu: 0, triangles: 0, draws: 0 });
  }
  expect(validateProject(s, new Map())).toEqual(s);
  expect(memoryTargetWarnings(s).map(row => row.category)).toEqual(['library', 'simulation', 'overlap', 'server simulation', 'tile 0/0/0', 'tile 1/0/0', 'far']);
  expect(memoryTargetWarnings(s).every(row => row.bytes === row.target + 1)).toBe(true);
});

it('charges the larger overlap instead of introducing an unaccounted memory category', () => {
  const s = source(), normal = worstContentCost(s);
  s.budgets.overlap = C.overlap - 1;
  expect(worstContentCost(s)).toEqual(normal);
  s.budgets.overlap = C.overlap + 123;
  const larger = worstContentCost(s);
  expect(larger.playing - normal.playing).toBe(123);
  expect(larger.loading - normal.loading).toBe(246);
  s.budgets.overlap = C.playing;
  expect(() => validateProject(s, new Map())).toThrow('total exceeds envelope');
});

it('keeps natural-byte contracts, wire/render caps and truthful asset budgets', () => {
  const s = source();
  s.budgets.library.resident = -1;
  expect(() => parseShardfile(s)).toThrow();
  s.budgets.library.resident = 0;
  s.budgets.library.compressed = C.library.compressed + 1;
  expect(() => parseShardfile(s)).toThrow();
  s.budgets.library.compressed = 0;
  s.files.push({ hash: 'a'.repeat(64), kind: 'binary', compressed: 0, decoded: 1, gpu: 0, triangles: 0, draws: 0, critical: false, dependencies: [] });
  s.library.push('a'.repeat(64));
  expect(() => validateProject(s, new Map())).toThrow('bundle cost exceeds budget');
});

it('charges authored coarse tile excess and the larger server reservation against the total', () => {
  const s = source(), normal = worstContentCost(s);
  s.tiles.push({ lod: 1, x: 0, z: 0, bounds: { min: [-250, 0, -250], max: [-125, 0, -125] }, geometricError: 0, files: [], compressed: 0, decoded: C.l1.resident + 1_000_000, gpu: 0, triangles: 0, draws: 0 });
  expect(worstContentCost(s).playing - normal.playing).toBe(1_110_000);
  s.serverBudget.memory = C.playing;
  expect(() => validateProject(s, new Map())).toThrow('total exceeds envelope');
  s.serverBudget.memory = 1_000_000;
  const tile = s.tiles[0]; if (tile === undefined) throw new Error('Missing coarse tile');
  tile.decoded = C.playing;
  expect(() => validateProject(s, new Map())).toThrow('total exceeds envelope');
});
