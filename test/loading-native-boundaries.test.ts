// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import calibrations from '../src/loadingCalibration.json';
import { Loading } from '../src/engine/ui/Loading';
import { declareDownloadFile } from '../src/engine/boot/download';
import { currentLoadingTimeline } from '../src/engine/boot/timeline';
import { loadShellTemplate } from '../src/engine/boot/shell';
import { loadingPath } from '../src/game/boot/loadingPaths';

it('publishes the measured cold entry boundaries with the shipping path and calibration', () => {
  // Official 0e50fb2c87 cold Sunscar: these three starts showed 0/33/33%,
  // exceeding 15 points. Final declared inventory and clocks are retained
  // inputs; this replay is not a new native reading or a full event trace.
  const origin = 28, elapsed = 4559, declaredBytes = 20_670_833;
  const starts = [1052, 2512, 2520] as const;
  let now = origin;
  vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('PerformanceObserver', class {
    observe(): void { /* No browser transport in this composition regression. */ }
    disconnect(): void { /* No browser transport in this composition regression. */ }
    takeRecords(): PerformanceEntry[] { return []; }
  });
  const shell = document.createElement('div');
  shell.className = 'ws-load'; shell.innerHTML = loadShellTemplate();
  shell.dataset['shell'] = ''; shell.dataset['startedAt'] = String(origin); shell.dataset['initialSetup'] = '0';
  document.body.append(shell);
  const loading = new Loading({id: 'sunscar-dunes', name: 'Sunscar'});
  try {
    loading.setPath(loadingPath('shardfile'), calibrations);
    declareDownloadFile('/native-replay-inventory.bin', declaredBytes);
    const timeline = currentLoadingTimeline();
    if (timeline === undefined) throw new Error('Missing loading timeline');
    now = starts[0];
    loading.paintAdmission({phase: 'descriptor', detail: 'Read /shardfiles/sunscar-dunes/shard.json',
      filesDone: 0, filesTotal: 1, bytesRead: 0, bytesTotal: 1});
    now = starts[1]; loading.endAdmission();
    const runtime = timeline.begin('runtimeModules');
    now = starts[2]; runtime.end();
    const data = timeline.begin('data');
    const measured = timeline.snapshot().rows.filter(row => ['admission', 'runtimeModules', 'data'].includes(row.key));
    expect(measured).toHaveLength(3);
    for (const [index, row] of measured.entries()) {
      expect(row.startedAt).toBe(starts[index]);
      expect(row.setupAtStart, row.key).toBeTypeOf('number');
      if (row.setupAtStart === undefined || row.startedAt === undefined) throw new Error(`Missing boundary ${row.key}`);
      expect(Math.abs(row.setupAtStart - (row.startedAt - origin) / elapsed * 100), row.key).toBeLessThanOrEqual(15);
    }
    data.end();
  } finally {
    loading.scope.dispose(); document.body.replaceChildren();
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  }
});
