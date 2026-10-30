import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Own a minimal duration registry for the actual planner.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve isolated synthetic report paths.
import { resolve } from 'node:path';
import { createShardPlan, readShardPlan } from '../scripts/test-shard-plan';
import { measuredWeights } from '../scripts/vitest-plan';

const source = { sha: 'a'.repeat(40), run: '123' };
function fixture() {
  const paths = Array.from({ length: 37 }, (_, index) => `test/fixture-${index}.test.ts`);
  const weights = new Map(paths.map((path, index) => [path, index % 7]));
  const options = { ...source, count: 4, workers: 2, fallbackSeconds: 3, measuredFiles: 37 };
  return { paths, weights, options, plan: createShardPlan(paths, weights, options) };
}

test('plans assign every current and newly discovered file once with deterministic balanced worker bins', () => {
  const f = fixture(), plan = createShardPlan([...f.paths, 'test/added.test.ts'], f.weights, f.options);
  expect(plan.shards.flatMap(shard => shard.files).sort()).toEqual([...f.paths, 'test/added.test.ts'].sort());
  expect(new Set(plan.shards.flatMap(shard => shard.files)).size).toBe(f.paths.length + 1);
  expect(createShardPlan([...f.paths].reverse(), f.weights, f.options)).toEqual(f.plan);
  const walls = f.plan.shards.map(shard => shard.expectedSeconds);
  expect(Math.max(...walls) - Math.min(...walls)).toBeLessThanOrEqual(6);
  const long = createShardPlan(['long', 'short-a', 'short-b'], new Map([['long', 20], ['short-a', 1], ['short-b', 1]]), { ...f.options, count: 1 });
  expect(long.expectedSeconds).toBe(20);
});

test('stale, duplicate, missing and foreign-source plans refuse before selecting a shard', () => {
  const f = fixture();
  expect(() => readShardPlan(f.plan, f.paths, 3, source)).toThrow('count');
  expect(() => readShardPlan(f.plan, f.paths.slice(1), 4, source)).toThrow('inventory');
  const duplicate = structuredClone(f.plan), file = duplicate.shards[0]?.files[0];
  if (file === undefined) throw new Error('Missing planned fixture');
  duplicate.shards[1]?.files.push(file);
  expect(() => readShardPlan(duplicate, f.paths, 4, source)).toThrow('inventory');
  expect(() => readShardPlan(f.plan, f.paths, 4, { ...source, run: 'other' })).toThrow('source/run');
  expect(() => readShardPlan(f.plan, f.paths, 4, { ...source, sha: 'b'.repeat(40) })).toThrow('source/run');
  expect(() => createShardPlan([], f.weights, f.options)).toThrow('Empty');
  expect(() => createShardPlan(f.paths, f.weights, { ...f.options, workers: 0 })).toThrow('count');
});

test('recent successful complete-module observations include import/setup and override older body-only results', () => {
  const root = mkdtempSync(resolve('tmp/vitest-plan-'));
  try {
    mkdirSync(resolve(root, 'test'));
    writeFileSync(resolve(root, 'test/durations.json'), JSON.stringify({ 'test/a.test.ts': 3, 'test/b.test.ts': 4 }));
    const results = [{ testResults: [
      { name: resolve(root, 'test/a.test.ts'), status: 'passed', startTime: 1000, endTime: 2000 },
      { name: resolve(root, 'test/b.test.ts'), status: 'failed', startTime: 1000, endTime: 1001 },
    ] }];
    const timings = [{ files: [{ file: 'test/a.test.ts', state: 'passed', measuredAt: 3000,
      durationMs: 2000, collectMs: 1000, setupMs: 500, prepareMs: 0, environmentMs: 0 }] }];
    const result = measuredWeights(root, ['test/a.test.ts', 'test/b.test.ts', 'test/new.test.ts'], results, timings);
    expect(result.weights.get('test/a.test.ts')).toBe(3.5);
    expect(result.weights.get('test/b.test.ts')).toBe(5.5);
    expect(result.weights.get('test/new.test.ts')).toBe(5.5);
    expect(result.measuredFiles).toBe(1);
    expect(() => measuredWeights(root, [], [], [{ files: [{ ...timings[0]?.files[0], collectMs: -1 }] }])).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
