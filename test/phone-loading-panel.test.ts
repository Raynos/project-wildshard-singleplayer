// @vitest-environment happy-dom
import {afterEach, expect, test, vi} from 'vitest';
import {instrument} from '../scripts/phone-loading/instrument';

afterEach(() => {vi.unstubAllGlobals(); document.body.replaceChildren(); Reflect.deleteProperty(window, '__phoneLoading');});
test('the unchanged sampler retains exact native download facts and gap durations without inventing gap boundaries', () => {
  vi.stubGlobal('PerformanceObserver', {supportedEntryTypes: []});
  vi.stubGlobal('MutationObserver', class {observe(): void { /* Explicit sampling only. */ }});
  vi.stubGlobal('requestAnimationFrame', vi.fn((_callback: FrameRequestCallback): number => 1));
  const root = document.createElement('div'); root.className = 'ws-load';
  root.innerHTML = '<span data-el="dlPct">30%</span><span data-el="dlFact">2.0 of 6.5 MB content · 4 / 10 files</span><span data-el="suFact">Work</span>';
  const snapshot = {current: 'work', rows: [{key: 'work', label: 'Work', ms: 5, startedAt: 1, endedAt: 6, state: 'ok'}],
    gaps: [{label: 'gap after Title art', ms: 1200, state: 'ok', after: 'art'}, {label: 'gap after Work', ms: 10, state: 'on', after: 'work'}]};
  const original = JSON.stringify(snapshot);
  Reflect.set(root, Symbol.for('engine.loading.snapshot'), snapshot); document.body.append(root);
  instrument('grid'); document.dispatchEvent(new Event('ws:control-ready'));
  const capture: unknown = Reflect.get(window, '__phoneLoading');
  expect(capture).toMatchObject({rowCoverage: 'native-all-rows', rows: [
    {key: 'work', label: 'Work', duration: 5, start: performance.timeOrigin + 1, end: performance.timeOrigin + 6, wallMs: 5},
    {key: 'gap:native:0', label: 'gap after Title art', duration: 1200, state: 'ok', start: null, end: null, wallMs: null},
    {key: 'gap:native:1', label: 'gap after Work', duration: 10, state: 'on', start: null, end: null, wallMs: null},
  ], panels: [{download: 30, downloadFact: '2.0 of 6.5 MB content · 4 / 10 files', activeLabel: 'Work'}]});
  expect(JSON.stringify(snapshot)).toBe(original);
});
