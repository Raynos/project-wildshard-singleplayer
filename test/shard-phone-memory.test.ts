// oxlint-disable-next-line import/no-nodejs-modules -- Refusals must occur before launching a memory browser.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { coreMemorySummary, coreMemoryTargets } from '../scripts/shard-phone-memory.mjs';

const MiB = 1048576;
const rows = () => coreMemoryTargets.map(target => ({shard: target.shard, errors: [],
  samples: [10, 60, 120].map(second => ({phase: `${second}s`, rendererBytes: target.limitBytes - 10 * MiB, gpuBytes: 10 * MiB}))}));

test('four independent floors use the picked combined process limits', () => {
  expect(coreMemoryTargets.map(target => [target.shard, target.limitBytes / MiB])).toEqual([
    ['menu', 50], ['select', 50], ['_template', 100], ['blender-template', 100],
  ]);
  expect(coreMemorySummary(rows()).every(row => row.passed && row.totalBytes === row.limitBytes)).toBe(true);
});

test('uses original 120s values, counts GPU, and never substitutes a cache-clear improvement', () => {
  const input = rows();
  const menu = input[0];
  if (menu === undefined) throw new Error('Missing menu fixture');
  menu.samples = [{phase: '10s', rendererBytes: 300 * MiB, gpuBytes: 30 * MiB},
    {phase: '60s', rendererBytes: 200 * MiB, gpuBytes: 30 * MiB},
    {phase: '120s', rendererBytes: 45 * MiB, gpuBytes: 6 * MiB},
    {phase: 'after-http-cache-clear', rendererBytes: MiB, gpuBytes: MiB}];
  expect(coreMemorySummary(input)[0]).toMatchObject({totalBytes: 51 * MiB, passed: false});
});

test('missing, failed and invalid readings cannot pass as zero', () => {
  expect(coreMemorySummary([])).toHaveLength(4);
  expect(coreMemorySummary([]).every(row => row.totalBytes === null && !row.passed)).toBe(true);
  expect(coreMemorySummary([{shard: 'menu', errors: ['page failed'], samples: [{phase: '120s', rendererBytes: 1, gpuBytes: 1}]}])[0])
    .toMatchObject({totalBytes: null, passed: false});
  expect(coreMemorySummary([{shard: 'menu', errors: [], samples: [{phase: '10s', rendererBytes: 1, gpuBytes: 1}]}])[0])
    .toMatchObject({totalBytes: null, passed: false});
  for (const rendererBytes of [-1, Number.NaN, Infinity, undefined]) expect(() => coreMemorySummary([
    {shard: 'menu', errors: [], samples: [{phase: '120s', rendererBytes, gpuBytes: 1}]},
  ])).toThrow();
});

test('duplicate or foreign floors and duplicate acceptance samples refuse', () => {
  const input = rows();
  expect(() => coreMemorySummary([...input, ...input])).toThrow('Duplicate or unknown');
  expect(() => coreMemorySummary([{shard: 'other', errors: [], samples: []}])).toThrow('Duplicate or unknown');
  expect(() => coreMemorySummary([{shard: 'menu', errors: [], samples: [
    {phase: '120s', rendererBytes: 1, gpuBytes: 1}, {phase: '120s', rendererBytes: 2, gpuBytes: 2},
  ]}])).toThrow('Duplicate 120s');
});

test('core command requires the floor protocol and source pin before any browser', () => {
  for (const flags of [[], ['--floor']]) {
    expect(() => execFileSync('node', ['scripts/shard-phone-memory.mjs', 'http://127.0.0.1:1', 'core', 'fixture', 'tmp/unused-core.json', ...flags],
      {encoding: 'utf8', stdio: 'pipe'})).toThrow(flags.length > 0 ? 'Core floors require --pin' : 'Menu/core targets require --floor');
  }
});
