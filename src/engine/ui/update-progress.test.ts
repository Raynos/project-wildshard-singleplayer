// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Scope } from '../app/scope';
import { DownloadAccounting } from '../boot/download';
import { UpdateProgress } from './UpdateProgress';
import { appIdentity } from '../app/identity';
import { installSaveEnvironment, saveEnvironment } from '../saves/environment';
import type { SaveStorage } from '../saves/store';

type Storage = NonNullable<ConstructorParameters<typeof UpdateProgress>[3]>;
type State = ReturnType<Storage['read']>;
const owners: Scope[] = [];
let now = 10000;
const owner = (): Scope => { const value = new Scope('update-fixture'); owners.push(value); return value; };
function memory(initial: State = null): Storage {
  let value = initial;
  return { read: () => structuredClone(value), write: next => { value = structuredClone(next); return true; }, reset: () => { value = null; } };
}
const incoming = (target: string | null = 'new-build'): NonNullable<State> => ({
  source: 'old-build', target, started: now, phase: 'reload', packReady: true, files: 3, network: 2048, cached: 1024,
});
beforeEach(() => { now = 10000; vi.useFakeTimers(); });
afterEach(() => {
  for (const scope of owners.splice(0)) scope.dispose();
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.useRealTimers();
});

test('the modal uses real completed receipts without inventing a total or download phase', () => {
  const store = memory(), screen = new UpdateProgress(owner(), 'old-build', () => undefined, store, () => now);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  screen.start('new-build', true); screen.phase('install');
  expect(document.querySelector('[aria-current="step"]')?.textContent).toBe('Installing');
  expect(document.querySelector('li:nth-child(2)')?.textContent).toBe('Boot pack ready');
  const accounting = new DownloadAccounting('https://example.com');
  accounting.resource({ name: 'https://example.com/boot.js', startTime: 0, responseEnd: 100,
    transferSize: 2048, encodedBodySize: 1024, workerStart: 0, serverTiming: [] });
  screen.downloads(accounting.snapshot()); screen.downloads(accounting.snapshot());
  expect(document.querySelector('[role="status"]')?.textContent).toBe('1 files · 2 KiB downloaded · 0 KiB cached');
  expect(store.read()).toMatchObject({ files: 1, network: 2048, phase: 'install' });
  screen.phase('found'); expect(document.querySelector<HTMLElement>('[data-phase]')?.dataset['phase']).toBe('install');
});

test('pagehide releases the old dialog but preserves the handoff until the requested title paints', async () => {
  const store = memory(), first = new UpdateProgress(owner(), 'old-build', () => undefined, store, () => now);
  first.start('new-build', true); first.phase('reload');
  window.dispatchEvent(new Event('pagehide'));
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(store.read()).not.toBeNull();
  new UpdateProgress(owner(), 'new-build', () => undefined, store, () => now);
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  document.dispatchEvent(new Event('ws:ready'));
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  await vi.advanceTimersByTimeAsync(100);
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(store.read()).toBeNull();
});

test('a wrong build cannot dismiss the modal and its retry remains available between repaints', async () => {
  const store = memory(incoming()), retry = vi.fn<() => void>();
  new UpdateProgress(owner(), 'still-old', retry, store, () => now);
  document.dispatchEvent(new Event('ws:ready')); await vi.advanceTimersByTimeAsync(750);
  const button = document.querySelector('button');
  expect(button?.hidden).toBe(false); expect(store.read()).not.toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toContain('new title has not arrived');
  button?.click(); expect(retry).toHaveBeenCalledTimes(1);
});

test('an explicit same-build refresh completes when there was no announced target', async () => {
  const store = memory({ ...incoming(null), packReady: false });
  const screen = new UpdateProgress(owner(), 'old-build', () => undefined, store, () => now);
  document.dispatchEvent(new Event('ws:ready')); await vi.advanceTimersByTimeAsync(100);
  expect(store.read()).toBeNull();
  screen.start('later-build', true); screen.phase('install');
  expect(document.querySelector('[aria-current="step"]')?.textContent).toBe('Installing');
  expect(store.read()).toMatchObject({ target: 'later-build' });
});

test('an announced waiting worker must advance the build even without a version label', async () => {
  const store = memory(incoming(null));
  new UpdateProgress(owner(), 'old-build', () => undefined, store, () => now);
  document.dispatchEvent(new Event('ws:ready')); await vi.advanceTimersByTimeAsync(100);
  expect(store.read()).not.toBeNull(); expect(document.querySelector('button')?.hidden).toBe(false);
});

test.each([-1, 300001])('stale or future handoffs do not obscure an unrelated launch (%s ms)', age => {
  const store = memory({ ...incoming(), started: now - age });
  new UpdateProgress(owner(), 'new-build', () => undefined, store, () => now);
  expect(store.read()).toBeNull(); expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('new-document receipts add to the saved totals once and cannot go backwards', () => {
  const store = memory(incoming()), screen = new UpdateProgress(owner(), 'new-build', () => undefined, store, () => now);
  const accounting = new DownloadAccounting('https://example.com'); accounting.cached('immutable-key', 4096);
  screen.downloads(accounting.snapshot()); screen.downloads(accounting.snapshot());
  screen.downloads(new DownloadAccounting('https://example.com').snapshot());
  expect(store.read()).toMatchObject({ files: 4, network: 2048, cached: 5120 });
});

test('unknown byte sizes remain unavailable while completed file steps move', () => {
  const screen = new UpdateProgress(owner(), 'old-build', () => undefined, memory(), () => now);
  screen.start('new-build', true);
  const accounting = new DownloadAccounting('https://example.com');
  accounting.resource({ name: 'https://example.com/boot.js', startTime: 0, responseEnd: 100,
    transferSize: 0, encodedBodySize: 0, workerStart: 1, serverTiming: [] });
  screen.downloads(accounting.snapshot());
  expect(document.querySelector('[role="status"]')?.textContent).toBe('1 files completed · byte sizes not reported');
});

test('the paint fence settles on owner disposal and releases input and timers', async () => {
  const scope = owner(), screen = new UpdateProgress(scope, 'old-build', () => undefined, memory(), () => now);
  screen.start('new-build', false);
  const pending = screen.present();
  const outside = document.createElement('button'); document.body.append(outside); outside.focus();
  expect(document.activeElement).toBe(document.querySelector('[role="dialog"]'));
  scope.dispose(); expect(await pending).toBe(false);
  outside.focus(); expect(document.activeElement).toBe(outside);
  expect(scope.census.timers).toBe(0); expect(scope.census.listeners).toBe(0);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('the actual session codec persists a reload and refuses malformed byte counts', async () => {
  const previous = saveEnvironment(), data = new Map<string, string>();
  const session: SaveStorage = {
    get length() { return data.size; }, key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
  };
  installSaveEnvironment({ storage: kind => kind === 'session' ? session : null, persistent: () => false, persist: () => Promise.resolve(false) });
  try {
    const old = owner(), screen = new UpdateProgress(old, 'old-build', () => undefined, undefined, () => now);
    screen.start('new-build', true); screen.phase('reload'); old.dispose();
    new UpdateProgress(owner(), 'new-build', () => undefined, undefined, () => now);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    document.dispatchEvent(new Event('ws:ready')); await vi.advanceTimersByTimeAsync(100);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    session.setItem(`${appIdentity().savePrefix}session`, JSON.stringify({ keys: {
      'update.progress': { v: 1, data: { ...incoming(), network: 'untrusted' } },
    } }));
    new UpdateProgress(owner(), 'new-build', () => undefined, undefined, () => now);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  } finally { installSaveEnvironment(previous); }
});
