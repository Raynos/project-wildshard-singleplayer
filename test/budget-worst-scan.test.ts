import { expect, test } from 'vitest';
import { nearbyContentCost, worstContentCost, worstContentCostSteps } from '../src/format/budget';
import { emptyShardfile } from '../src/sdk/author';

const MB = 1_000_000;

/** a shard with `count` deterministic L0 / L1 tiles of varied sizes across its cell */
function shard(count: number, seed: number) {
  const source = emptyShardfile({ slug: `worst-${String(seed)}`, name: 'Worst', author: 'Test', revision: 1, seed });
  let state = seed;
  const next = (): number => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
  source.tiles = Array.from({ length: count }, () => {
    const x = Math.floor(-250 + next() * 400), z = Math.floor(-250 + next() * 400), w = Math.floor(10 + next() * 90);
    return { lod: next() < 0.8 ? 0 : 1, x: 0, z: 0, bounds: { min: [x, 0, z], max: [x + w, 10, z + w] }, geometricError: 0, files: [],
      compressed: 0, decoded: Math.floor(next() * 20 * MB), gpu: Math.floor(next() * 30 * MB), triangles: 0, draws: 0 };
  });
  source.budgets.library.resident = Math.floor(next() * 90 * MB);
  return source;
}

test('the worst-disc scan finds the highest location cost on its grid (O14 precomputed scan)', () => {
  for (const [count, seed] of [[0, 1], [12, 2], [48, 3]] as const) {
    const source = shard(count, seed), worst = worstContentCost(source, 3 * MB);
    let best = 0;
    for (let x = -280; x <= 280; x += 5) for (let z = -280; z <= 280; z += 5) best = Math.max(best, nearbyContentCost(source, x, z, 3 * MB).playing);
    expect(worst.playing).toBe(best);
    const [x, z] = worst.location;
    expect(nearbyContentCost(source, x, z, 3 * MB).playing).toBe(worst.playing);
  }
});

test('the worst-disc scan in steps pauses between rows and finds the same location', () => {
  const source = shard(48, 7), steps = worstContentCostSteps(source, 2 * MB);
  let pauses = 0, step = steps.next();
  while (step.done !== true) { pauses++; step = steps.next(); }
  expect(pauses).toBeGreaterThan(1);
  expect(worstContentCost(source, 2 * MB)).toEqual(step.value);
});
