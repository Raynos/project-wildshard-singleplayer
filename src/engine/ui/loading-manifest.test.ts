// @vitest-environment happy-dom
import {afterEach, expect, test, vi} from 'vitest';
import {Loading, type LoadingDownloadSource} from './Loading';
import type {ProgressView} from '../boot/plan';

afterEach(() => {vi.unstubAllGlobals(); document.body.replaceChildren();});
test('one manifest owns the bar; plan completion and later work cannot complete a pending list', async () => {
  let disconnected = 0;
  vi.stubGlobal('PerformanceObserver', class {observe(): void { /* The manifest replaces this legacy observer. */ } disconnect(): void {disconnected++;} takeRecords(): PerformanceEntry[] {return [];}});
  const loading = new Loading({id: 'manifest', name: 'Manifest'});
  let complete: () => void = () => undefined, notify = (): void => undefined;
  const pending = new Promise<void>(resolve => {complete = resolve;});
  let state = {totalBytes: 4, completedBytes: 0, cachedBytes: 0, filesTotal: 1, filesDone: 0, complete: false, error: null};
  const source: LoadingDownloadSource = {ready: pending, snapshot: () => state,
    subscribe: listener => {notify = listener; listener(); return () => {notify = () => undefined;};}};
  const view: ProgressView = {download: 1, setup: 1, done: true, error: null, step: 'audio', label: 'Audio', detail: '', bytes: null,
    bytesRead: 99, bytesTotal: 99, filesDone: 99, filesTotal: 99, worldBytesReady: true, doneCount: 1, rows: [], gaps: []};
  try {
    expect(loading.setDownloadSource(source)).toBe(pending); expect(disconnected).toBe(1);
    loading.paint(view); expect(loading.root.dataset['download']).toBe('0');
    state = {...state, completedBytes: 4, cachedBytes: 4, filesDone: 1}; notify();
    expect(loading.root.dataset['download']).toBe('99');
    state = {...state, complete: true}; notify(); complete(); await pending;
    expect(loading.root.dataset['download']).toBe('100'); expect(loading.root.dataset['readBytes']).toBe('4');
    expect(loading.root.dataset['readCachedBytes']).toBe('4');
    expect(loading.root.querySelector('[data-el="dlFact"]')?.textContent).toContain('from cache');
    loading.scope.dispose(); state = {...state, completedBytes: 0}; notify();
    expect(loading.root.dataset['readBytes']).toBe('4');
  } finally {loading.scope.dispose();}
});
