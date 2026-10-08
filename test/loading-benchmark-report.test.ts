import { expect, it } from 'vitest';
import { loadingReport } from '../progress/loading/sf67/benchmark.mjs';

it('uses tap-to-playable clocks, records all loading tasks over 50ms, and excludes post-play tasks', () => {
  const report = loadingReport('pin', 'iPhone 16 Pro emulation / 4x CPU', [{ shard: 'fixture', cache: 'cold', status: 'ok', playMs: 200, tapToOriginMs: 10 }],
    [{ base: 'fixture-cold', phases: [['props', 30], ['Ready', 150]], longTasks: [
      { atMs: 40, durMs: 50, appLeaf: [] }, { atMs: 100, durMs: 70, appLeaf: [['build src/src/fixture.ts:1', 60]] }, { atMs: 201, durMs: 90, appLeaf: [] },
    ] }]);
  expect(report.runs[0]?.timeToPlayableMs).toBe(210);
  expect(report.runs[0]?.phases.at(-1)).toEqual({ name: 'Ready', startMs: 160, endMs: 210, owner: 'src/game/session/finish.ts' });
  expect(report.runs[0]?.longTasks).toEqual([{ startMs: 110, durationMs: 70, owner: 'build src/fixture.ts:1' }]);
});
it('keeps failed runs and unavailable owners explicit, and refuses a stale-document navigation fence', () => {
  const captures = [{ shard: 'fixture', cache: 'cold', status: 'ok', playMs: 200, tapToOriginMs: 10 }] as const;
  const report = loadingReport('pin', 'desktop', [...captures, { ...captures[0], cache: 'warm', status: 'timeout', playMs: null }],
    [{ base: 'fixture-cold', phases: [], longTasks: [{ atMs: 20, durMs: 51, appLeaf: [] }] }]);
  expect(report.runs).toHaveLength(1); expect(report.missing.join(' ')).toContain('app owner unavailable'); expect(report.missing.join(' ')).toContain('timeout');
  expect(() => loadingReport('pin', 'desktop', [{ ...captures[0], tapToOriginMs: -1 }], [{ base: 'fixture-cold', phases: [], longTasks: [] }])).toThrow('navigation fence');
});
