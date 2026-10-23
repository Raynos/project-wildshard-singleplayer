// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Loading } from '../src/engine/ui/Loading';
import type { ProgressView } from '../src/engine/boot/plan';
import { declareDownloadFile, recordCachedDownload } from '../src/engine/boot/download';
import { currentLoadingTimeline } from '../src/engine/boot/timeline';
import { waitFor } from '../src/engine/boot/waits';

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

it('does not invent a one-step total before the actual path is declared', () => {
  const loading = new Loading({ id: 'pending', name: 'Pending' });
  try {
    loading.waiting('Preparing application services');
    now = 400; vi.advanceTimersByTime(32);
    const fact = (): string => loading.root.querySelector('[data-el="suFact"]')?.textContent ?? '';
    expect(fact()).toContain('Application modules');
    expect(fact()).not.toMatch(/step \d+ \/ \d+/u);
    loading.setPath({ id: 'shardfile', steps: [{ key: 'modules', label: 'Modules', weight: 1 },
      { key: 'admission', label: 'Product admission', weight: 1 }, { key: 'world', label: 'World', weight: 1 }] });
    now = 700; vi.advanceTimersByTime(32);
    expect(fact()).toContain('step 1 / 3');
    loading.paintAdmission({ phase: 'product', detail: 'Reading files', bytesRead: 0, bytesTotal: 10, filesDone: 0, filesTotal: 1 });
    now = 1000; vi.advanceTimersByTime(32);
    expect(fact()).toContain('step 2 / 3');
  } finally { loading.scope.dispose(); }
});

it('shows a controlling worker instead of assuming an offline cache from the API handle', () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  const old = window.__ws_sw;
  Reflect.set(window, '__ws_sw', {});
  try {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: null } });
    const noController = new Loading({ id: 'worker', name: 'Worker' }, { scoped: true });
    expect(noController.root.querySelector('[data-el="tier"]')?.textContent).not.toMatch(/worker ready|offline cache/);
    noController.scope.dispose();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { controller: {} } });
    const controlled = new Loading({ id: 'worker', name: 'Worker' }, { scoped: true });
    expect(controlled.root.querySelector('[data-el="tier"]')?.textContent).toContain('worker ready');
    controlled.scope.dispose();
  } finally {
    Reflect.set(window, '__ws_sw', old);
    if (descriptor === undefined) Reflect.deleteProperty(navigator, 'serviceWorker');
    else Object.defineProperty(navigator, 'serviceWorker', descriptor);
  }
});

it('keeps another step\'s music out of the actual visible world footer', async () => {
  const loading = new Loading({ id: 'dunes', name: 'Dunes' });
  let finish = (): void => { throw new Error('Uninitialized resolver'); };
  const work = new Promise<void>(resolve => { finish = resolve; });
  try {
    loading.setPath({ id: 'shardfile', steps: [{ key: 'modules', label: 'Modules', weight: 1 },
      { key: 'audioFiles', label: 'Selected audio', weight: 1 }, { key: 'world', label: 'World', weight: 1 }] });
    loading.endAdmission();
    const timeline = currentLoadingTimeline();
    if (timeline === undefined) throw new Error('Missing loading timeline');
    const music = timeline.begin('audioFiles');
    const foreign = waitFor('Pine music', work, 'file');
    music.end();
    const world = timeline.begin('world');
    const own = waitFor('Dunes terrain', work, 'file');
    now = 400; vi.advanceTimersByTime(32);
    expect(loading.root.dataset['waiting']).toBe('Dunes terrain');
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).not.toContain('Pine music');
    world.end(); finish(); await Promise.all([foreign, own]);
  } finally { finish(); loading.scope.dispose(); }
});

it('shows the actual declared ratio when a late dependency is discovered, without a 99 percent cap', () => {
  const loading = new Loading({ id: 'test', name: 'Test' }, { scoped: true });
  const view: ProgressView = { download: 0, setup: 0, done: false, error: null, step: 'audio', label: 'Audio', detail: '',
    bytes: null, bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, worldBytesReady: false, doneCount: 0, rows: [], gaps: [] };
  try {
    declareDownloadFile('/assets/known.bin', 10);
    recordCachedDownload('known', 10, '/assets/known.bin');
    loading.paint(view);
    expect(loading.root.dataset['download']).toBe('100');
    declareDownloadFile('/assets/later.bin', 30);
    loading.paint(view);
    expect(loading.root.dataset['download']).toBe('25');
    expect(loading.root.dataset['pendingBytes']).toBe('30');
    expect(loading.root.dataset['declaredBytes']).toBe('40');
    now = 400; vi.advanceTimersByTime(32);
    expect(loading.root.querySelector<HTMLElement>('[data-el="bar"]')?.style.width).toBe('12.5%');
    recordCachedDownload('later', 30, '/assets/later.bin');
    loading.paint(view);
    expect(loading.root.dataset['download']).toBe('100');
  } finally { loading.scope.dispose(); }
});

it('paints download bars and facts from the same fresh cache snapshot', () => {
  const loading = new Loading({ id: 'fresh', name: 'Fresh' }, { scoped: true });
  const view: ProgressView = { download: 0, setup: 0, done: false, error: null, step: 'terrain', label: 'Terrain', detail: '',
    bytes: null, bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, worldBytesReady: false, doneCount: 0, rows: [], gaps: [] };
  try {
    declareDownloadFile('/assets/cache-between-paints.bin', 40);
    loading.paint(view);
    expect(loading.root.dataset['download']).toBe('0');
    recordCachedDownload('cache-between-paints', 40, '/assets/cache-between-paints.bin');
    now = 400; vi.advanceTimersByTime(32);
    expect(loading.root.dataset['download']).toBe('100');
    expect(loading.root.dataset['pendingBytes']).toBe('0');
    expect(loading.root.querySelector('[data-el="dlPct"]')?.textContent).toBe('100');
    expect(loading.root.querySelector<HTMLElement>('[data-el="dlBar"]')?.style.width).toBe('100.0%');
    expect(loading.root.querySelector('[data-el="dlFact"]')?.textContent).toContain('1 / 1 files');
  } finally { loading.scope.dispose(); }
});

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
    expect(loading.root.dataset['setup']).toBe('100');
    expect(loading.root.querySelector<HTMLElement>('[data-el="bar"]')?.style.width).toBe('100%');
    expect(loading.root.classList.contains('hide')).toBe(false);
    await vi.advanceTimersByTimeAsync(17);
    expect(loading.root.classList.contains('hide')).toBe(false);
    expect(loading.root.dataset['step']).toBe('gap');
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toBe(`Now working on: ${loading.root.querySelector('[data-el="suFact"]')?.textContent}`);
    await vi.advanceTimersByTimeAsync(300); await finished;
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
