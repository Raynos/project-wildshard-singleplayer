// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { LoadingTimeline, installLoadingTimeline } from './timeline';
import { bootWaits, loadingStage, loadingStepWaits } from './waits';

afterEach(() => { vi.restoreAllMocks(); });

// DL21 (E526): Pine's cold phone-link boot fetched 143 level files inside setup steps (edge, animals, spawn detail) while
// the card only said 'Now working on: Spawn detail' for 32 s. A step that reads files now names them on the card.
test('a loading stage names its own reads as a counted wait of its step, and drops it when the stage ends', async () => {
  const timeline = new LoadingTimeline({ id: 'fixture', steps: [{ key: 'spawnDetail', label: 'Spawn detail', weight: 1 }] }, 0, () => 100);
  const restore = installLoadingTimeline(timeline);
  const entry = (name: string, startTime: number, transferSize: number): PerformanceResourceTiming =>
    Object.defineProperties(Object.create(PerformanceResourceTiming.prototype) as PerformanceResourceTiming, {
      name: { value: name }, startTime: { value: startTime }, transferSize: { value: transferSize },
      encodedBodySize: { value: transferSize }, initiatorType: { value: 'fetch' } });
  const entries: PerformanceResourceTiming[] = [];
  vi.spyOn(performance, 'getEntriesByType').mockImplementation(() => entries);
  vi.spyOn(performance, 'setResourceTimingBufferSize').mockImplementation(() => undefined);
  let release = (): void => undefined;
  try {
    const stage = loadingStage('spawnDetail', () => new Promise<void>(resolve => { release = resolve; }));
    const now = performance.now();
    entries.push(entry(`${location.origin}/shardfiles/pine/blobs/glb/a.glb`, now + 1, 1_500_000),
      entry(`${location.origin}/shardfiles/pine/blobs/glb/b.glb`, now + 2, 2_600_000), entry('https://elsewhere.test/x.js', now + 3, 9_000_000));
    await vi.waitFor(() => {
      const waits = loadingStepWaits(bootWaits(), null, 'spawnDetail', timeline.waitOwner);
      expect(waits.map(wait => wait.label)).toEqual(['Reading 2 files · 4.1 MB']);
    });
    release(); await stage;
    expect(loadingStepWaits(bootWaits(), null, 'spawnDetail', timeline.waitOwner)).toEqual([]);
  } finally { restore(); }
});
