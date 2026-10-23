// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Loading } from '../src/engine/ui/Loading';
import type { ProgressView } from '../src/engine/boot/plan';

let now = 100;
beforeEach(() => {
  vi.useFakeTimers(); now = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('PerformanceObserver', class {
    observe(): void { /* no transport in this DOM regression */ }
    disconnect(): void { /* no transport in this DOM regression */ }
    takeRecords(): PerformanceEntry[] { return []; }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

it('paints completion rows and footer together without waiting for another frame', () => {
  const loading = new Loading({ id: 'test', name: 'Test' }, { scoped: true });
  try {
    loading.setPath({ id: 'cell', steps: [{ key: 'audio', label: 'Audio', weight: 1 }] });
    loading.scopedStep('audio', 'Prepared audio clips 0 / 0');
    now = 200; vi.advanceTimersByTime(32);
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toContain('Prepared audio clips');
    loading.endAdmission(); now = 201;
    const completed: ProgressView = { download: 1, setup: 1, done: true, error: null, step: 'audio', label: 'Audio', detail: '',
      bytes: null, bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, worldBytesReady: true, doneCount: 1, rows: [], gaps: [] };
    loading.paint(completed);
    const current = loading.root.querySelector('[data-el="suFact"]')?.textContent;
    expect(loading.root.dataset['step']).toBe('gap');
    expect(current).toContain('Audio');
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toBe(`Now working on: ${current}`);
  } finally { loading.scope.dispose(); }
});

it('ends a scoped cell step immediately when fading without a boot-plan view', async () => {
  const loading = new Loading({ id: 'test', name: 'Test' }, { scoped: true });
  try {
    loading.setPath({ id: 'cell', steps: [{ key: 'enter', label: 'Enter', weight: 1 }] });
    loading.scopedStep('enter', 'Activating destination');
    now = 200; vi.advanceTimersByTime(32);
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toContain('Activating destination');
    now = 201;
    const finished = loading.done();
    expect(loading.root.dataset['step']).toBe('gap');
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toBe(`Now working on: ${loading.root.querySelector('[data-el="suFact"]')?.textContent}`);
    await vi.advanceTimersByTimeAsync(250); await finished;
    expect(loading.scope.disposed).toBe(true);
  } finally { loading.scope.dispose(); }
});

it('repaints the facts of a step at most every 200 ms while its clock moves every frame, and a new step at once', () => {
  const loading = new Loading({ id: 'test', name: 'Test' }, { scoped: true });
  const foot = (): string => loading.root.querySelector('[data-el="foot"]')?.textContent ?? '';
  const clock = (): string => loading.root.querySelector('[data-el="clock"]')?.textContent ?? '';
  try {
    loading.setPath({ id: 'cell', steps: [{ key: 'audio', label: 'Audio', weight: 1 }, { key: 'enter', label: 'Enter', weight: 1 }] });
    loading.scopedStep('audio', 'Clips 1 / 3');
    now = 200; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Clips 1 / 3');
    const before = clock();
    loading.scopedStep('audio', 'Clips 2 / 3');
    now = 300; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Clips 1 / 3'); expect(clock()).not.toBe(before);
    now = 420; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Clips 2 / 3');
    loading.scopedStep('enter', 'Activating');
    now = 430; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Activating');
  } finally { loading.scope.dispose(); }
});
