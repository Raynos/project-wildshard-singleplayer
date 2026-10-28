// @vitest-environment happy-dom
import {expect, test} from 'vitest';
import {comparisons, profiles, record, type Run} from '../scripts/phone-loading/model';
import baseline from '../art/loading/round-1-phone-speed/baseline-a6701db71.json';
import {instrument} from '../scripts/phone-loading/instrument';

function run(): Run {
  const profile = profiles['phone']; if (profile === undefined) throw new Error('Missing phone profile');
  return {schema: 1, build: 'fixture', engine: 'chromium', flow: 'grid', cache: 'cold', preset: 'phone', at: '', url: '', profile,
    applied: {pageCPU: true, pageNetwork: true, workerNetwork: true, notes: []}, requests: [], tap: 100, control: 1100, totalMs: 1000,
    rows: [{key: 'home', label: 'Home', start: 100, end: 1100, duration: 500, wallMs: 1000}],
    rowCoverage: 'native-all-rows', measures: [{name: 'read-wait', start: 200, duration: 600, detail: {calls: 3, elapsedMs: 50, longestMs: 30}}],
    longTasks: [], frameGaps: [], errors: []};
}
test('compares matching protocols without mutating data or treating overlapping wall spans as wait totals', () => {
  const old = run(), current = run(); current.totalMs = 1110; current.rows[0] = {...old.rows[0], key: 'home', label: 'Home', start: 100, end: 1700, duration: 1501, wallMs: 1600};
  expect(comparisons(current, {runs: [old]})).toEqual(['total +11.0%', 'home +1.00s']);
  expect(current.measures[0]?.detail).toEqual({calls: 3, elapsedMs: 50, longestMs: 30});
  expect(old.totalMs).toBe(1000);
  expect(comparisons(run(), old)).toEqual([]);
});
test('never substitutes another engine, cache or throttle profile for the selected baseline', () => {
  for (const patch of [{engine: 'webkit'}, {preset: 'lte'}, {cache: 'warm'}, {flow: 'select:driftwood-isle'}])
    expect(comparisons({...run(), ...patch}, run())).toEqual(['No matching engine/flow/cache/preset baseline']);
  expect(profiles['phone']).toEqual({cpu: 10, down: 1_250_000, up: 250_000, latency: 100});
});
test('the retained live baseline preserves original windows and never fabricates nested row ends or wait sums', () => {
  expect(baseline.runs.map(capture => [capture.totalMs, capture.requests.length, capture.longTasks.length])).toEqual([[53270, 548, 96], [27556, 288, 93]]);
  for (const capture of baseline.runs) {
    expect(capture.rows.every(row => row.end === null && row.wallMs === null)).toBe(true);
    expect(capture.measures.every(row => row.detail === null)).toBe(true);
    expect(capture.requests.every(row => row.start >= capture.tap && row.start <= capture.control)).toBe(true);
  }
});
test('the capture sees the real pointer-up before widget propagation stops, quick rows and named fatal errors', async () => {
  sessionStorage.removeItem('phone-loading.tap');
  document.body.innerHTML = '<button class="ws-main-grid">Enter</button><div class="ws-load"></div>';
  const button = document.querySelector('button'), root = document.querySelector('.ws-load');
  if (button === null || root === null) throw new Error('Missing capture fixture');
  instrument('grid');
  button.addEventListener('pointerup', event => {event.stopPropagation();});
  button.dispatchEvent(new Event('pointerup', {bubbles: true}));
  expect(Number(sessionStorage.getItem('phone-loading.tap'))).toBeGreaterThan(0);
  Reflect.set(root, Symbol.for('engine.loading.snapshot'), {rows: [{key: 'quick', label: 'Quick', startedAt: 10, endedAt: 20, ms: 4}]});
  const fatal = document.createElement('div'); fatal.className = 'ws-load-error'; fatal.textContent = 'Original warm-up refusal and stack';
  document.body.append(fatal); document.documentElement.dataset['wsState'] = 'error';
  await new Promise<void>(resolve => {setTimeout(resolve, 0);});
  const capture = record(Reflect.get(window, '__phoneLoading'));
  expect(capture).toMatchObject({rowCoverage: 'native-all-rows', fatal: fatal.textContent,
    rows: [{key: 'quick', duration: 4, wallMs: 10}], errors: [fatal.textContent]});
  document.dispatchEvent(new Event('ws:control-ready'));
  delete document.documentElement.dataset['wsState']; document.body.replaceChildren();
});
