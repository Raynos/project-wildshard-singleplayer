import { describe, expect, it } from 'vitest';
import { memoryReferenceProblem, selectMemoryReference, MEMORY_PROTOCOL, type MemoryReferenceReport } from '../scripts/gpu-perf/report.mjs';

function completeReport() {
  return {
    sha: 'good', started: '2026-10-01T00:00:00Z', shards: ['pine-hollow'], memoryProtocol: MEMORY_PROTOCOL, steps: [{ name: 'memory', code: 0 }],
    memory: ['loading', 'play', 'explorer'].map((phase) => ({
      shard: 'pine-hollow', phase, nativeGB: 0.6, inspectorGB: 0.8, nativePeakGB: 0.7, previousGB: null,
      measurement: 'settled-median-3', verdict: 'success', reason: 'first reading', limitGB: 1,
      settling: { nativeGB: 0.6, inspectorGB: 0.8, minGB: 0.6, maxGB: 0.6, spreadGB: 0, spreadPercent: 0,
        samples: [], settled: true, timedOut: false, seconds: 3 },
    })),
  };
}

describe('memory comparison reference', () => {
  it('skips a newer timed-out collection even when it printed all green rows', () => {
    const good = completeReport(), broken = { ...completeReport(), sha: 'broken', started: '2026-10-02T00:00:00Z', steps: [{ name: 'memory', code: 124 }] };
    const selected = selectMemoryReference([{ path: 'good.json', report: good }, { path: 'broken.json', report: broken }], ['pine-hollow'], '2026-10-03T00:00:00Z');
    expect(selected.path).toBe('good.json');
    expect(selected.sha).toBe('good');
    expect(selected.rejected).toEqual([{ path: 'broken.json', sha: 'broken', reason: 'memory collection did not exit successfully' }]);
  });
  it('rejects missing shards, phases and duplicate phases', () => {
    const report = completeReport();
    expect(memoryReferenceProblem(report, ['pine-hollow', '_template'])).toContain('coverage');
    const unrecorded: MemoryReferenceReport = { ...report };
    delete unrecorded.shards;
    expect(memoryReferenceProblem(unrecorded, ['pine-hollow'])).toContain('coverage');
    expect(memoryReferenceProblem({ ...report, memory: report.memory.slice(0, 2) }, ['pine-hollow'])).toContain('phase coverage');
    const row = report.memory[0];
    if (!row) throw new Error('fixture row missing');
    expect(memoryReferenceProblem({ ...report, memory: [row, row, row] }, ['pine-hollow'])).toContain('duplicate');
  });
  it('rejects failed or pending measurements, legacy peaks and unsettled medians', () => {
    for (const verdict of ['failure', 'pending']) {
      const report = completeReport();
      for (const row of report.memory) row.verdict = verdict;
      expect(memoryReferenceProblem(report, ['pine-hollow'])).toContain('not green');
    }
    const legacy = completeReport();
    for (const row of legacy.memory) row.measurement = 'legacy-peak';
    expect(memoryReferenceProblem(legacy, ['pine-hollow'])).toContain('settled median');
    const unsettled = completeReport();
    for (const row of unsettled.memory) row.settling.settled = false;
    expect(memoryReferenceProblem(unsettled, ['pine-hollow'])).toContain('settled median');
    const overLimit = completeReport();
    for (const row of overLimit.memory) row.nativePeakGB = 2;
    expect(memoryReferenceProblem(overLimit, ['pine-hollow'])).toContain('absolute limit');
  });
  it('records first reading when all historical reports are broken and ignores future reports', () => {
    const report = { ...completeReport(), steps: [{ name: 'memory', code: 124 }] };
    expect(selectMemoryReference([{ path: 'bad.json', report }], ['pine-hollow'], '2026-10-03T00:00:00Z').path).toBe('');
    expect(selectMemoryReference([{ path: 'future.json', report: completeReport() }], ['pine-hollow'], '2026-09-30T00:00:00Z').rejected).toEqual([]);
  });
  it('does not use a partial full nightly with a failed step after memory', () => {
    const report = completeReport();
    report.steps.push({ name: 'soak-pine-hollow', code: 124 });
    expect(memoryReferenceProblem(report, ['pine-hollow'])).toBe('run contains an unsuccessful step');
  });
  it('rejects a run that could have loaded cached code or settings', () => {
    expect(memoryReferenceProblem({ ...completeReport(), memoryProtocol: 'legacy' }, ['pine-hollow'])).toBe('cold origin/build identity was not verified');
  });
});
