// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Loading } from './Loading';
import type { ProgressView } from '../boot/plan';
import { declareDownloadFile, recordCachedDownload, recordReadDownload, beginLoadingWait, finishLoadingWait, loadingWaitState, reportLoadingWait } from '../boot/download';
import { currentLoadingTimeline } from '../boot/timeline';
import { waitFor } from '../boot/waits';
import { loadShellTemplate } from '../boot/shell';

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

it('closes actual entry reads at ready without completing unused product-bank declarations', async () => {
  const loading = new Loading({id: 'entry-receipts', name: 'Entry receipts'});
  try {
    declareDownloadFile('/unused.glb', 41_000_000);
    recordCachedDownload('warm', 51_600_000, '/warm.bin'); recordReadDownload('/fresh.bin', 400_000, false);
    loading.waiting('Prepared entry content');
    now = 400; vi.advanceTimersByTime(32);
    expect(loading.root.dataset['download']).toBe('99');
    expect(loading.root.querySelector('[data-el="dlFact"]')?.textContent).toBe('52.0 MB · 51.6 MB from cache');
    const done = loading.done();
    expect(loading.root.dataset['download']).toBe('100');
    expect(loading.root.dataset['readBytes']).toBe('52000000');
    expect(loading.root.dataset['pendingBytes']).toBe('41000000');
    expect(loading.root.dataset['readsClosed']).toBe('true');
    recordReadDownload('/background.bin', 1_000_000, false);
    expect(loading.root.querySelector('[data-el="dlFact"]')?.textContent).toBe('52.0 MB · 51.6 MB from cache');
    await vi.advanceTimersByTimeAsync(317); await done;
  } finally { loading.scope.dispose(); }
});

it.each([[-1600, '00:01.7'], [-90000, '00:00.1'], [101, '00:00.1']])('adopts bounded handoff clock %s without shifting stage timing', (clock, expected) => {
  document.body.innerHTML = `<div class="ws-load" data-shell data-started-at="0" data-clock-started-at="${clock}">${loadShellTemplate()}</div>`;
  const root = document.querySelector<HTMLElement>('.ws-load');
  if (root === null) throw new Error('Missing handoff shell');
  root.dataset['loadingWaitId'] = String(beginLoadingWait('Application modules', {inline: true, startedAt: 0, progressAt: 0}));
  const loading = new Loading({id: 'handoff-clock', name: 'Home'});
  try {
    expect(loading.root.querySelector('[data-el="clock"]')?.textContent).toBe(expected);
    expect(loading.root.dataset['startedAt']).toBe('0');
    expect([...loadingWaitState().pending.values()].find(wait => wait.owner === currentLoadingTimeline()?.waitOwner)?.startedAt).toBe(0);
  } finally {loading.scope.dispose();}
});

it('exposes completed quick rows to passive capture without changing their exclusive clocks', () => {
  const loading = new Loading({id: 'capture', name: 'Capture'});
  try {
    loading.setPath({id: 'capture', steps: ['modules', 'quick'].map(key => ({key, label: key, weight: 1}))});
    const timeline = currentLoadingTimeline(); if (timeline === undefined) throw new Error('Missing timeline');
    const quick = timeline.begin('quick'); now = 150; quick.end();
    loading.paintAdmission({phase: 'descriptor', detail: 'Capture completed rows', bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0});
    vi.advanceTimersByTime(32);
    const snapshot: unknown = Reflect.get(loading.root, Symbol.for('engine.loading.snapshot'));
    expect(snapshot).toMatchObject({path: 'capture', rows: [expect.anything(), {key: 'quick', startedAt: 100, endedAt: 150, ms: 50}]});
    expect(loading.root.querySelector('[data-key="quick"]')).toBeNull();
  } finally {loading.scope.dispose();}
});

it('publishes completed step credit before the next step records its visible setup', () => {
  const loading = new Loading({id: 'boundaries', name: 'Boundaries'});
  try {
    loading.setPath({id: 'shardfile', steps: [{key: 'modules', label: 'Modules', weight: 1},
      {key: 'admission', label: 'Product admission', weight: 1}, {key: 'world', label: 'World', weight: 1}]},
    [{tier: '*', path: 'shardfile', identity: '*', source: 'boundary fixture', samples: 1,
      ms: {modules: 1000, admission: 1500, world: 1000}}]);
    loading.waiting('Preparing services');
    now = 1100; loading.paintAdmission({phase: 'descriptor', detail: 'Read /entry.json',
      filesDone: 0, filesTotal: 1, bytesRead: 0, bytesTotal: 0});
    const timeline = currentLoadingTimeline();
    if (timeline === undefined) throw new Error('Missing timeline');
    expect(loading.root.querySelector('[data-el="suPct"]')?.textContent).toBe('28');
    expect(timeline.snapshot().rows[1]?.setupAtStart).toBe(28);
    expect(Number.parseFloat(loading.root.querySelector<HTMLElement>('[data-el="bar"]')?.style.width ?? ''))
      .toBeCloseTo(1000 / 3500 * 50);
    now = 2600; loading.endAdmission();
    const world = timeline.begin('world');
    expect(loading.root.querySelector('[data-el="suPct"]')?.textContent).toBe('71');
    expect(timeline.snapshot().rows[2]?.setupAtStart).toBe(71);
    expect(loading.root.dataset['setup']).toBe('71');
    world.end();
  } finally { loading.scope.dispose(); }
});

it('names the actual nested work in the header while retaining exclusive parent accounting', () => {
  const loading = new Loading({id: 'nested-label', name: 'Nested label'});
  try {
    loading.setPath({id: 'nested-label', steps: ['modules', 'finish', 'home'].map(key => ({key, label: key, weight: 1}))});
    const timeline = currentLoadingTimeline(); if (timeline === undefined) throw new Error('Missing timeline');
    loading.endAdmission();
    const outer = timeline.begin('finish'), inner = timeline.begin('home');
    loading.paintAdmission({phase: 'modules', detail: 'Home preparation', bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0});
    now = 700; vi.advanceTimersByTime(32);
    expect(loading.root.dataset['step']).toBe('home');
    expect(loading.root.querySelector('[data-el="suFact"]')?.textContent).toContain('home');
    expect(timeline.snapshot()).toMatchObject({current: 'home', display: 'finish'});
    inner.end(); outer.end();
  } finally {loading.scope.dispose();}
});

it('keeps boundary credit when the next paced paint still carries the previous view', () => {
  const loading = new Loading({id: 'paced-boundary', name: 'Paced boundary'});
  try {
    loading.setPath({id: 'shardfile', steps: ['modules', 'world', 'finish']
      .map(key => ({key, label: key, weight: 1}))},
    [{tier: '*', path: 'shardfile', identity: '*', source: 'boundary fixture', samples: 1,
      ms: {modules: 1000, world: 1000, finish: 1000}}]);
    loading.waiting('Services'); now = 1100; loading.endAdmission();
    const timeline = currentLoadingTimeline();
    if (timeline === undefined) throw new Error('Missing timeline');
    const world = timeline.begin('world');
    const view: ProgressView = {download: 0, setup: 0, done: false, error: null, step: 'assembly', label: 'World', detail: '',
      bytes: null, bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, worldBytesReady: false, doneCount: 0, rows: [], gaps: []};
    loading.paint(view); vi.advanceTimersByTime(32);
    expect(loading.root.querySelector('[data-el="suPct"]')?.textContent).toBe('33');
    now = 2100; world.end(); const finish = timeline.begin('finish');
    expect(loading.root.querySelector('[data-el="suPct"]')?.textContent).toBe('66');
    vi.advanceTimersByTime(32);
    expect(loading.root.querySelector('[data-el="suPct"]')?.textContent).toBe('66');
    finish.end();
  } finally { loading.scope.dispose(); }
});

it('adopts the original shell setup fact without replacing it with a later percentage', () => {
  const shell = document.createElement('div'); shell.className = 'ws-load'; shell.innerHTML = loadShellTemplate();
  shell.dataset['shell'] = ''; shell.dataset['startedAt'] = '50'; shell.dataset['initialSetup'] = '7';
  document.body.append(shell);
  const loading = new Loading({id: 'adopted', name: 'Adopted'});
  try {
    const timeline = currentLoadingTimeline();
    if (timeline === undefined) throw new Error('Missing timeline');
    expect(timeline.snapshot().rows[0]).toMatchObject({startedAt: 50, setupAtStart: 7});
    shell.dataset['initialSetup'] = '99'; loading.waiting('Preparing application services');
    now = 400; vi.advanceTimersByTime(32);
    expect(currentLoadingTimeline()?.snapshot().rows.find(row => row.key === 'modules')?.setupAtStart).toBe(7);
    expect(loading.root.querySelector('[data-key="modules"]')).toBeNull();
  } finally { loading.scope.dispose(); }
});

it('hands the visible footer to admission before publishing its first callback', () => {
  const loading = new Loading({id: 'descriptor', name: 'Descriptor'});
  const foot = (): string => loading.root.querySelector('[data-el="foot"]')?.textContent ?? '';
  try {
    loading.setPath({id: 'shardfile', steps: [{key: 'modules', label: 'Application modules', weight: 1},
      {key: 'admission', label: 'Product admission', weight: 1}, {key: 'world', label: 'World', weight: 1}]});
    loading.waiting('Preparing application services');
    now = 400; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Application modules');
    loading.paintAdmission({phase: 'descriptor', detail: 'Fetching shard descriptor · /shardfiles/descriptor/entry.json',
      filesDone: 0, filesTotal: 1, bytesRead: 0, bytesTotal: 0});
    expect(loading.root.dataset['step']).toBe('admission.descriptor');
    expect(foot()).toContain('Product admission · Fetching shard descriptor · /shardfiles/descriptor/entry.json');
    expect(foot()).not.toContain('Application modules');
    expect(loading.root.dataset['filesInFlight']).toBe('0');
    const handedOff = foot();
    loading.paintAdmission({phase: 'descriptor', detail: 'Reading shard descriptor · /shardfiles/descriptor/entry.json',
      filesDone: 0, filesTotal: 1, bytesRead: 10, bytesTotal: 100});
    // Same-phase byte progress keeps the ordinary paced repaint.
    expect(foot()).toBe(handedOff);
    now = 700; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Reading shard descriptor · /shardfiles/descriptor/entry.json');
  } finally { loading.scope.dispose(); }
});

it('retains a completed short step start even when it finished before the first row paint', () => {
  const loading = new Loading({id: 'starts', name: 'Starts'});
  try {
    loading.setPath({id: 'shardfile', steps: [{key: 'modules', label: 'Modules', weight: 1},
      {key: 'admission', label: 'Product admission', weight: 1}, {key: 'world', label: 'World', weight: 1}]});
    const timeline = currentLoadingTimeline();
    if (timeline === undefined) throw new Error('Missing timeline');
    loading.waiting('Preparing application services');
    now = 110; vi.advanceTimersByTime(32);
    now = 120; loading.paintAdmission({phase: 'product', detail: 'Reading entry.json',
      filesDone: 0, filesTotal: 0, bytesRead: 0, bytesTotal: 0});
    const setupAtStart = Number(loading.root.querySelector('[data-el="suPct"]')?.textContent);
    expect(Number.isFinite(setupAtStart)).toBe(true);
    loading.endAdmission();
    now = 500; const world = timeline.begin('world'); vi.advanceTimersByTime(32);
    // Presentation collapses quick steps, while the complete timing record is retained.
    expect(timeline.snapshot().rows.find(row => row.key === 'admission')).toMatchObject({
      startedAt: 120, setupAtStart, ms: 0, state: 'ok',
    });
    expect(loading.root.querySelector('[data-key="admission"]')).toBeNull();
    expect(loading.root.querySelector('[data-el="rows"]')?.textContent).toContain('2 quick steps');
    world.end();
  } finally { loading.scope.dispose(); }
});

it('groups only completed sub-500ms steps and keeps the exact 500ms boundary visible', async () => {
  const loading = new Loading({ id: 'quick-boundary', name: 'Quick boundary' });
  try {
    loading.setPath({ id: 'shardfile', steps: ['modules', 'quick', 'slow'].map(key => ({key, label: key, weight: 1})) });
    loading.waiting('Modules'); now = 200; loading.endAdmission();
    const timeline = currentLoadingTimeline(); if (timeline === undefined) throw new Error('Missing timeline');
    const quick = timeline.begin('quick'); now = 699; quick.end();
    const slow = timeline.begin('slow'); now = 1199; slow.end();
    // WebKit can still have a short external finalizer at completed-panel paint.
    const tail = timeline.begin('quick');
    const completed = loading.done();
    const rows = [...loading.root.querySelectorAll<HTMLElement>('[data-el="rows"] > div')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.dataset['key']).toBe('slow'); expect(rows[0]?.dataset['ms']).toBe('500');
    expect(rows[1]?.textContent).toContain('2 quick steps'); expect(rows[1]?.dataset['ms']).toBe('599');
    expect(timeline.snapshot().rows.map(row => row.ms)).toEqual([100, 499, 500]);
    tail.end();
    await vi.advanceTimersByTimeAsync(1000); await completed;
  } finally { loading.scope.dispose(); }
});

it('offers Retry after eight seconds without bytes, including changing diagnostic text', () => {
  const loading = new Loading({ id: 'wait', name: 'Wait' }, { scoped: true });
  const reload = vi.spyOn(location, 'reload').mockImplementation(() => undefined);
  try {
    loading.setPath({ id: 'cell', steps: [{ key: 'read', label: 'Read world', weight: 1 }] });
    loading.scopedStep('read', 'Reading terrain'); vi.advanceTimersByTime(32);
    now = 8100; loading.scopedStep('read', 'Still reading terrain'); vi.advanceTimersByTime(32);
    const retry = loading.root.querySelector<HTMLButtonElement>('[data-el="retry"]');
    expect(loading.root.dataset['stalled']).toBe('true'); expect(retry?.hidden).toBe(false);
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toContain('Waiting for Read world');
    recordCachedDownload('eight-second-progress', 32); now = 8400; vi.advanceTimersByTime(240);
    expect(retry?.hidden).toBe(true);
    now = 16400; vi.advanceTimersByTime(240); expect(retry?.hidden).toBe(false);
    retry?.click(); expect(reload).toHaveBeenCalledTimes(1);
  } finally { reload.mockRestore(); loading.scope.dispose(); }
});

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

it('keeps the current saved-file detail instead of an outer zero-file admission wrapper', async () => {
  const loading = new Loading({id: 'product', name: 'Product'});
  let finish = (): void => { throw new Error('Uninitialized admission'); };
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const waits: Promise<void>[] = [];
  try {
    loading.setPath({id: 'shardfile', steps: [{key: 'modules', label: 'Modules', weight: 1},
      {key: 'admission', label: 'Product admission', weight: 1}]});
    loading.paintAdmission({phase: 'cache', detail: 'Checking saved 0123456789ab', bytesRead: 10,
      bytesTotal: 10, filesDone: 1, filesTotal: 1});
    waits.push(waitFor('Admit product', pending, 'admission'));
    now = 400; vi.advanceTimersByTime(32);
    const foot = (): string => loading.root.querySelector('[data-el="foot"]')?.textContent ?? '';
    expect(foot()).toContain('Now working on: Product admission · Checking saved 0123456789ab');
    expect(foot()).not.toContain('Admit product');
    expect(loading.root.dataset['filesInFlight']).toBe('0');
    waits.push(waitFor('Hash 0123456789ab', pending, 'worker'));
    now = 700; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Now waiting for: Hash 0123456789ab');
    expect(foot()).not.toContain('0 files in flight');
    expect(loading.root.dataset['filesInFlight']).toBe('0');
    waits.push(waitFor('Read /product/blob.bin', pending, 'file'));
    now = 1000; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Now waiting for: Read /product/blob.bin');
    expect(foot()).toContain('1 files in flight');
  } finally { finish(); await Promise.all(waits); loading.scope.dispose(); }
});

it('names uncounted admission work without inventing an empty file batch', () => {
  const loading = new Loading({id: 'visited-product', name: 'Visited product'});
  const foot = (): string => loading.root.querySelector('[data-el="foot"]')?.textContent ?? '';
  try {
    loading.setPath({id: 'shardfile', steps: [{key: 'modules', label: 'Modules', weight: 1},
      {key: 'admission', label: 'Product admission', weight: 1}]});
    loading.paintAdmission({phase: 'cache-read', detail: 'Checking visited product', bytesRead: 0,
      bytesTotal: 0, filesDone: 0, filesTotal: 0});
    now = 400; vi.advanceTimersByTime(32);
    expect(foot()).toBe('Now working on: Product admission · Checking visited product');
    expect(loading.root.dataset['filesInFlight']).toBe('0');
    loading.paintAdmission({phase: 'assets', detail: 'Reading indexed files', bytesRead: 0,
      bytesTotal: 100, filesDone: 0, filesTotal: 2});
    now = 700; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Reading indexed files · 0 / 2 files · 0.00 MB read');
    loading.paintAdmission({phase: 'assets', detail: 'Reading bytes before file index', bytesRead: 10,
      bytesTotal: 0, filesDone: 0, filesTotal: 0});
    now = 1000; vi.advanceTimersByTime(32);
    expect(foot()).toContain('Reading bytes before file index · 0.00 MB read');
    expect(foot()).not.toContain('0 / 0 files');
  } finally { loading.scope.dispose(); }
});

it('keeps quiet work visibly current without inventing completed work', () => {
  const loading = new Loading({id: 'quiet-work', name: 'Quiet work'});
  const foot = (): string => loading.root.querySelector('[data-el="foot"]')?.textContent ?? '';
  try {
    loading.paintAdmission({phase: 'cache-read', detail: 'Checking visited product',
      bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0});
    declareDownloadFile('/assets/pending.bin', 100);
    now = 400; vi.advanceTimersByTime(32);
    const counters = {network: loading.root.dataset['networkBytes'], cached: loading.root.dataset['cachedBytes'],
      pending: loading.root.dataset['pendingBytes'], setup: loading.root.dataset['setup']};
    now = 1000; vi.advanceTimersByTime(32);
    expect(foot()).toContain('No reported progress for 0.9 s');
    expect(foot()).toContain('Checking visited product');
    expect(loading.root.dataset['stalled']).toBe('false');
    now = 1400; vi.advanceTimersByTime(32);
    expect(foot()).toContain('No reported progress for 1.3 s');
    expect({network: loading.root.dataset['networkBytes'], cached: loading.root.dataset['cachedBytes'],
      pending: loading.root.dataset['pendingBytes'], setup: loading.root.dataset['setup']}).toEqual(counters);
    now = 10_500; vi.advanceTimersByTime(32);
    expect(loading.root.dataset['stalled']).toBe('true');
    recordCachedDownload('pending-cache', 100);
    now = 10_900; vi.advanceTimersByTime(32);
    expect(foot()).not.toContain('No reported progress');
    expect(loading.root.dataset['stalled']).toBe('false');
  } finally { loading.scope.dispose(); }
});

it('does not count one parsed descriptor as half the complete admission stage', () => {
  const loading = new Loading({id: 'admission-units', name: 'Admission units'});
  try {
    loading.setPath({id: 'shardfile', steps: [{key: 'modules', label: 'Modules', weight: 1},
      {key: 'admission', label: 'Product admission', weight: 1}, {key: 'world', label: 'World', weight: 1}]},
    [{tier: '*', path: 'shardfile', identity: '*', source: 'measured fixture', samples: 1,
      ms: {modules: 100, admission: 1000, world: 1000}}]);
    now = 200;
    loading.paintAdmission({phase: 'descriptor', detail: 'Parsing shard descriptor', bytesRead: 50,
      bytesTotal: 50, filesDone: 1, filesTotal: 1});
    vi.advanceTimersByTime(32);
    expect(loading.root.dataset['setup']).toBe('4');
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toContain('1 / 1 files');
    now = 400;
    loading.paintAdmission({phase: 'assets', detail: 'Reading product assets', bytesRead: 0,
      bytesTotal: 1000, filesDone: 0, filesTotal: 122});
    vi.advanceTimersByTime(32);
    expect(loading.root.dataset['setup']).toBe('13');
    now = 600;
    loading.paintAdmission({phase: 'assets', detail: 'Checking verified product', bytesRead: 1000,
      bytesTotal: 1000, filesDone: 122, filesTotal: 122});
    vi.advanceTimersByTime(32);
    expect(loading.root.dataset['setup']).toBe('20');
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toContain('122 / 122 files');
  } finally { loading.scope.dispose(); }
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

it('adopts the first-document wait list without resetting a pending deadline or its retry', () => {
  const root = document.createElement('div'); root.className = 'ws-load'; root.dataset['shell'] = '';
  root.dataset['startedAt'] = '100'; root.innerHTML = loadShellTemplate(); document.body.append(root);
  const inline = beginLoadingWait('Application modules', { inline: true }); root.dataset['loadingWaitId'] = String(inline);
  const retry = vi.fn<() => void>(), id = beginLoadingWait('Held source bytes', { kind: 'file', totalBytes: 4096, retry });
  const state = loadingWaitState(), pending = state.pending.get(id);
  now = 7900;
  const loading = new Loading({ id: 'shared-waits', name: 'Shared waits' });
  try {
    expect(loadingWaitState()).toBe(state); expect(state.pending.get(id)).toBe(pending);
    expect(state.pending.get(inline)?.inline).toBe(false);
    loading.waiting('Preparing services');
    now = 8101; vi.advanceTimersByTime(200);
    expect(loading.root.querySelector<HTMLElement>('[data-el="retry"]')?.hidden).toBe(false);
    expect(loading.root.querySelector('[data-el="foot"]')?.textContent).toContain('Waiting for Held source bytes · 8.0 s');
    loading.root.querySelector<HTMLButtonElement>('[data-el="retry"]')?.click(); expect(retry).toHaveBeenCalledTimes(1);
    reportLoadingWait(id, { loadedBytes: 1024 }); now = 8350; vi.advanceTimersByTime(200);
    expect(loading.root.querySelector<HTMLElement>('[data-el="retry"]')?.hidden).toBe(true);
    expect(pending?.loadedBytes).toBe(1024); expect(loadingWaitState().pending.get(id)).toBe(pending);
  } finally { finishLoadingWait(id); loading.scope.dispose(); }
  expect(state.pending.has(inline)).toBe(false);
});
