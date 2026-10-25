// oxlint-disable-next-line import/no-nodejs-modules -- Refusals must occur before launching a memory browser.
import { execFileSync, spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { coreMemorySummary, coreMemoryEstimateAudit, chromiumCoreMemorySummary, coreMemoryTargets, selectedCoreMemoryTargets, scriptResourceURLs, simulatorCoreFootprint, webKitCoreMemoryFloorBytes,
  serveHelloWorldMemory, helloWorldMemoryHTML, helloWorldMemoryFloor } from '../scripts/shard-phone-memory.mjs';

const MiB = 1048576;
test('script inventory keeps distinct complete JavaScript URLs only', () => {
  const urls = ['https://example.test/main.js?v=1#entry', 'https://example.test/worker.mjs',
    'https://example.test/CHUNK.JS', 'https://example.test/main.js?v=1#entry',
    'https://example.test/style.css', 'https://example.test/card.png?name=module.js'];
  expect(scriptResourceURLs(urls.map(name => ({name})))).toEqual(urls.slice(0, 3));
  expect(scriptResourceURLs([])).toEqual([]);
});
const nativeProtocol = {protocol: 'webkit-core-floor/1', mode: 'cold', forcedGC: false, inspectorResponseBodyBytes: 0};
const rows = () => coreMemoryTargets.map(target => ({...nativeProtocol, shard: target.shard, errors: [],
  samples: [10, 60, 120].map(second => ({phase: `${second}s`, rendererBytes: target.limitBytes - 10 * MiB, gpuBytes: 10 * MiB}))}));

test('saved estimate audits keep a one-byte tolerance miss separate from the native budget', () => {
  const summary = {rev: '1'.repeat(40), coreMemory: '_template', results: [{...nativeProtocol, version: JSON.stringify({build: '1111111-fixture'}), shard: '_template', errors: [],
    samples: [{phase: '120s', rendererBytes: 250_000_000, gpuBytes: 50_000_000}]}]};
  const result = spawnSync('node', ['scripts/shard-phone-memory.mjs', 'audit-estimate', '_template', '345000001'],
    {encoding: 'utf8', input: JSON.stringify(summary)});
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('"within15Percent":false');
  expect(result.stdout).toContain('"budgetPassed":false');
  const accurate = spawnSync('node', ['scripts/shard-phone-memory.mjs', 'audit-estimate', '_template', '300000000'],
    {encoding: 'utf8', input: JSON.stringify(summary)});
  expect(accurate.status).toBe(1);
  expect(accurate.stdout).toContain('"within15Percent":true');
  expect(accurate.stdout).toContain('"budgetPassed":false');
  const small = summary.results[0];
  if (small === undefined) throw new Error('Missing native fixture');
  const passing = spawnSync('node', ['scripts/shard-phone-memory.mjs', 'audit-estimate', '_template', '100000000'],
    {encoding: 'utf8', input: JSON.stringify({...summary, results: [{...small,
      samples: [{phase: '120s', rendererBytes: 90_000_000, gpuBytes: 10_000_000}]}]})});
  expect(passing.status).toBe(0);
  expect(passing.stdout).toContain('"within15Percent":true');
  expect(passing.stdout).toContain('"budgetPassed":true');
});

test('model tolerance uses exact bytes in both directions and never grants a native budget pass', () => {
  const input = [{...nativeProtocol, shard: '_template', errors: [],
    samples: [{phase: '120s', rendererBytes: 250_000_000, gpuBytes: 50_000_000}]}];
  for (const estimate of [255_000_000, 345_000_000]) {
    expect(coreMemoryEstimateAudit(input, '_template', estimate)).toMatchObject({measuredBytes: 300_000_000,
      within15Percent: true, budgetPassed: false});
  }
  for (const estimate of [254_999_999, 345_000_001]) {
    expect(coreMemoryEstimateAudit(input, '_template', estimate)).toMatchObject({within15Percent: false, budgetPassed: false});
  }
  expect(coreMemoryEstimateAudit([], '_template', 300_000_000)).toMatchObject({measuredBytes: null, within15Percent: null, errorPercent: null, budgetPassed: false});
  for (const estimate of [-1, 0, 1.5, Number.NaN, Infinity]) expect(() => coreMemoryEstimateAudit(input, '_template', estimate)).toThrow();
  expect(() => coreMemoryEstimateAudit(input, 'other', 300_000_000)).toThrow('Unknown app');
});

test('saved estimate audits refuse mixed source pins before issuing a verdict', () => {
  const summary = {rev: '1'.repeat(40), coreMemory: '_template', results: [{...nativeProtocol, version: JSON.stringify({build: '2222222-other'}), shard: '_template', errors: [],
    samples: [{phase: '120s', rendererBytes: 1, gpuBytes: 1}]}]};
  const result = spawnSync('node', ['scripts/shard-phone-memory.mjs', 'audit-estimate', '_template', '1'],
    {encoding: 'utf8', input: JSON.stringify(summary)});
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('source pin differs');
});

test('four independent floors use the picked combined process limits', () => {
  expect(webKitCoreMemoryFloorBytes).toBe(87397464 + 15927456);
  expect(coreMemoryTargets.map(target => [target.shard, (target.limitBytes - webKitCoreMemoryFloorBytes) / MiB])).toEqual([
    ['menu', 50], ['select', 50], ['_template', 100], ['blender-template', 100],
  ]);
  expect(coreMemorySummary(rows()).every(row => row.passed && row.totalBytes === row.limitBytes)).toBe(true);
});

test('WebKit budgets refuse Chromium, collected and unlabelled readings', () => {
  const native = {shard: 'menu', errors: [], protocol: 'webkit-core-floor/1', mode: 'cold',
    forcedGC: false, inspectorResponseBodyBytes: 0,
    samples: [{phase: '120s', rendererBytes: 1, gpuBytes: 1}]};
  for (const patch of [{protocol: 'chromium-phone-core/1'}, {protocol: undefined},
    {mode: 'warm'}, {forcedGC: true}, {inspectorResponseBodyBytes: 1}]) {
    expect(() => coreMemorySummary([{...native, ...patch}], 'menu')).toThrow();
  }
});

test('single-floor cohorts retain the original target and refuse unknown selections', () => {
  expect(selectedCoreMemoryTargets('all')).toBe(coreMemoryTargets);
  for (const target of coreMemoryTargets) {
    const selected = selectedCoreMemoryTargets(target.shard);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toBe(target);
  }
  for (const selection of ['', 'template', '_template,menu', 'unknown']) {
    expect(() => selectedCoreMemoryTargets(selection)).toThrow('Expected --core-memory');
  }
});

test('Template-only cohorts retain both original floors and refuse mixed or missing evidence', () => {
  const targets = selectedCoreMemoryTargets('templates');
  expect(targets.map(target => target.shard)).toEqual(['_template', 'blender-template']);
  expect(targets[0]).toBe(coreMemoryTargets[2]); expect(targets[1]).toBe(coreMemoryTargets[3]);
  const input = rows().slice(2);
  expect(coreMemorySummary(input, 'templates')).toEqual(coreMemorySummary(rows()).slice(2));
  expect(coreMemorySummary(input.slice(0, 1), 'templates')[1]).toMatchObject({totalBytes: null, passed: false});
  expect(() => coreMemorySummary(rows(), 'templates')).toThrow('Duplicate or unknown');
  const first = input[0];
  if (first === undefined) throw new Error('Missing native Template fixture');
  expect(() => coreMemorySummary([{...first, forcedGC: true}], 'templates')).toThrow();
  expect(() => coreMemorySummary([{...first, protocol: 'chromium-phone-core/1'}], 'templates')).toThrow();
});

test('single-floor verdicts enforce the same limit without requiring other visits', () => {
  for (const target of coreMemoryTargets) {
    const input = {...nativeProtocol, shard: target.shard, errors: [], samples: [
      {phase: '120s', rendererBytes: target.limitBytes - 1, gpuBytes: 1},
    ]};
    expect(coreMemorySummary([input], target.shard)).toEqual([
      {...target, totalBytes: target.limitBytes, passed: true},
    ]);
    input.samples[0] = {phase: '120s', rendererBytes: target.limitBytes, gpuBytes: 1};
    expect(coreMemorySummary([input], target.shard)).toEqual([
      {...target, totalBytes: target.limitBytes + 1, passed: false},
    ]);
    expect(coreMemorySummary([], target.shard)).toEqual([
      {...target, totalBytes: null, passed: false},
    ]);
    expect(coreMemorySummary([{...input, errors: ['reader failed']}], target.shard)).toEqual([
      {...target, totalBytes: null, passed: false},
    ]);
  }
});

test('single-floor verdicts refuse foreign results and non-app targets', () => {
  expect(() => coreMemorySummary(rows(), 'menu')).toThrow('Duplicate or unknown');
  for (const selection of ['hello', 'unknown', '', 'menu,select']) {
    expect(() => coreMemorySummary([], selection)).toThrow('Unknown app core memory floor');
  }
});

test('uses original 120s values, counts GPU, and never substitutes a cache-clear improvement', () => {
  const input = rows();
  const menu = input[0], target = coreMemoryTargets[0];
  if (menu === undefined || target === undefined) throw new Error('Missing menu fixture');
  menu.samples = [{phase: '10s', rendererBytes: 300 * MiB, gpuBytes: 30 * MiB},
    {phase: '60s', rendererBytes: 200 * MiB, gpuBytes: 30 * MiB},
    {phase: '120s', rendererBytes: target.limitBytes - 5 * MiB, gpuBytes: 6 * MiB},
    {phase: 'after-http-cache-clear', rendererBytes: MiB, gpuBytes: MiB}];
  expect(coreMemorySummary(input)[0]).toMatchObject({totalBytes: target.limitBytes + MiB, passed: false});
});

test('missing, failed and invalid readings cannot pass as zero', () => {
  expect(coreMemorySummary([])).toHaveLength(4);
  expect(coreMemorySummary([]).every(row => row.totalBytes === null && !row.passed)).toBe(true);
  expect(coreMemorySummary([{...nativeProtocol, shard: 'menu', errors: ['page failed'], samples: [{phase: '120s', rendererBytes: 1, gpuBytes: 1}]}])[0])
    .toMatchObject({totalBytes: null, passed: false});
  expect(coreMemorySummary([{...nativeProtocol, shard: 'menu', errors: [], samples: [{phase: '10s', rendererBytes: 1, gpuBytes: 1}]}])[0])
    .toMatchObject({totalBytes: null, passed: false});
  for (const rendererBytes of [-1, Number.NaN, Infinity, undefined]) expect(() => coreMemorySummary([
    {shard: 'menu', errors: [], samples: [{phase: '120s', rendererBytes, gpuBytes: 1}]},
  ])).toThrow();
});

test('Chromium diagnostics retain original totals and errors without native verdicts', () => {
  const input = rows().map(({shard, errors, samples}) => ({shard, errors, samples, protocol: 'chromium-phone-core/1'}));
  expect(chromiumCoreMemorySummary(input)).toEqual(coreMemoryTargets.map(({shard, name, limitBytes}) => ({
    shard, name, totalBytes: limitBytes,
  })));
  const menu = input[0];
  if (menu === undefined) throw new Error('Missing diagnostic fixture');
  expect(chromiumCoreMemorySummary([{...menu, errors: ['page failed']}])[0]).toMatchObject({totalBytes: null});
  expect(chromiumCoreMemorySummary([]).every(row => row.totalBytes === null)).toBe(true);
  expect(() => chromiumCoreMemorySummary(rows())).toThrow();
  expect(() => coreMemorySummary(input)).toThrow();
});

test('duplicate or foreign floors and duplicate acceptance samples refuse', () => {
  const input = rows();
  expect(() => coreMemorySummary([...input, ...input])).toThrow('Duplicate or unknown');
  expect(() => coreMemorySummary([{shard: 'other', errors: [], samples: []}])).toThrow('Duplicate or unknown');
  expect(() => coreMemorySummary([{shard: 'menu', errors: [], samples: [
    {phase: '120s', rendererBytes: 1, gpuBytes: 1}, {phase: '120s', rendererBytes: 2, gpuBytes: 2},
  ]}])).toThrow('Duplicate 120s');
});

test('core command requires the floor protocol and source pin before any browser', () => {
  for (const flags of [[], ['--floor']]) {
    expect(() => execFileSync('node', ['scripts/shard-phone-memory.mjs', 'http://127.0.0.1:1', 'core', 'fixture', 'tmp/unused-core.json', ...flags],
      {encoding: 'utf8', stdio: 'pipe'})).toThrow(flags.length > 0 ? 'Core floors require --pin' : 'Menu/core targets require --floor');
  }
});

test('single compiled floors require their protocol and exact pin before any browser', () => {
  for (const flags of [[], ['--floor']]) expect(() => execFileSync('node', [
    'scripts/shard-phone-memory.mjs', 'http://127.0.0.1:1', '_template', 'fixture', 'tmp/unused-core.json', '--compiled', ...flags,
  ], {encoding: 'utf8', stdio: 'pipe'})).toThrow('Compiled floor requires');
});

test('official WebKit core floors refuse mixed entry modes or duplicate readings before Simulator access', () => {
  const run = (flags: readonly string[]): string => execFileSync('node', ['scripts/sim-grid-entry.mjs', '--base=http://127.0.0.1:1', ...flags],
    {encoding: 'utf8', stdio: 'pipe', env: {...process.env, SIM_UDID: 'no-device-opened'}});
  expect(() => run(['--core-memory=all', '--shard=_template'])).toThrow('Expected --core-memory');
  expect(() => run(['--core-memory=unknown'])).toThrow('Expected --core-memory');
  expect(() => run(['--core-memory=all', '--runs=2'])).toThrow('exactly one cold reading');
  expect(() => run(['--core-memory=all', '--modes=cold,warm'])).toThrow('exactly one cold reading');
  expect(() => run(['--core-attribution=1'])).toThrow('Core attribution requires');
  expect(() => run(['--core-memory=all', '--core-attribution=2'])).toThrow('Core attribution requires');
});

test('upgrade observation refuses unrelated or repeated Simulator scenarios before device access', () => {
  expect(() => execFileSync('node', ['scripts/sim-grid-entry.mjs', '--base=http://127.0.0.1:1', '--upgrade-second-tap=1'],
    { encoding: 'utf8', stdio: 'pipe', env: {...process.env, SIM_UDID: 'no-device-opened'} })).toThrow('Second tap diagnostic requires');
  for (const flags of [[], ['--runs=2', '--modes=warm'], ['--runs=1', '--modes=cold'], ['--runs=1', '--modes=warm', '--shard=_template']]) {
    expect(() => execFileSync('node', ['scripts/sim-grid-entry.mjs', '--base=http://127.0.0.1:1', '--upgrade-from=https://example.test', ...flags],
      {encoding: 'utf8', stdio: 'pipe', env: {...process.env, SIM_UDID: 'no-device-opened'}})).toThrow('one warm grid run');
  }
});

test('Simulator footprint sums original process identities and keeps GPU separate', () => {
  const webContent = [{pid: 12, startAbstime: 100, physicalFootprintBytes: 120 * MiB},
    {pid: 13, startAbstime: 101, physicalFootprintBytes: 20 * MiB}];
  const gpu = [{pid: 14, startAbstime: 102, physicalFootprintBytes: 30 * MiB}];
  expect(simulatorCoreFootprint({webContent, gpu})).toEqual({webContent, gpu, rendererBytes: 140 * MiB, gpuBytes: 30 * MiB});
  expect(simulatorCoreFootprint({webContent, gpu: []}).gpuBytes).toBe(0);
});

test('Simulator missing, duplicate or corrupt native process readings refuse', () => {
  const process = {pid: 12, startAbstime: 100, physicalFootprintBytes: MiB};
  for (const input of [{webContent: [], gpu: []}, {webContent: [process]},
    {webContent: [process], gpu: [process]}, {webContent: [{...process, physicalFootprintBytes: -1}], gpu: []},
    {webContent: [{...process, startAbstime: 0}], gpu: []}]) expect(() => simulatorCoreFootprint(input)).toThrow();
});


test('hello-world is a calibration target and never part of the app cohort', () => {
  const target = selectedCoreMemoryTargets('hello');
  expect(target).toEqual([{shard: 'hello', name: 'Hello, world', limitBytes: null}]);
  expect(selectedCoreMemoryTargets('all').some(row => row.shard === 'hello')).toBe(false);
});

test('hello-world fixture serves only plain HTML and reset metadata', async () => {
  const fixture = await serveHelloWorldMemory();
  try {
    const page = await fetch(fixture.url);
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(await page.text()).toBe(helloWorldMemoryHTML);
    expect(helloWorldMemoryHTML).toContain('<body>Hello, world.</body>');
    expect(helloWorldMemoryHTML).not.toMatch(/<(?:script|style|link|img|canvas)\b/iu);
    expect((await fetch(`${fixture.url}/version.json`)).status).toBe(200);
    expect((await fetch(`${fixture.url}/clear-cache.json?sw=0`)).status).toBe(200);
    expect((await fetch(`${fixture.url}/assets/main.js`)).status).toBe(404);
  } finally { await fixture.close(); }
});

const helloCalibration = () => ({shard: 'hello', protocol: 'webkit-core-floor/1', mode: 'cold', forcedGC: false,
  inspectorResponseBodyBytes: 0, scriptURLs: [], errors: [],
  calibrationDocument: {title: 'Hello, world', text: 'Hello, world.', scripts: 0, canvases: 0},
  samples: [10, 60, 120].map(second => ({phase: `${second}s`, rendererBytes: (90 - second / 2) * MiB, gpuBytes: 7 * MiB}))});

test('hello-world budget base is exactly the unforced 120s combined native sample', () => {
  expect(helloWorldMemoryFloor(helloCalibration())).toEqual({phase: '120s', rendererBytes: 30 * MiB,
    gpuBytes: 7 * MiB, totalBytes: 37 * MiB, menuLimitBytes: 87 * MiB, templateLimitBytes: 137 * MiB});
  for (const patch of [{forcedGC: true}, {mode: 'warm'}, {inspectorResponseBodyBytes: 1}, {scriptURLs: ['app.js']},
    {errors: ['page failed']}, {samples: []}, {samples: helloCalibration().samples.slice(1)},
    {samples: [...helloCalibration().samples, ...helloCalibration().samples]},
    {calibrationDocument: {...helloCalibration().calibrationDocument, canvases: 1}}]) {
    expect(() => helloWorldMemoryFloor({...helloCalibration(), ...patch})).toThrow();
  }
});

test('hello-world refuses app origins or revisions before touching a Simulator', () => {
  for (const flag of ['--base=http://127.0.0.1:1', '--rev=abc']) {
    expect(() => execFileSync('node', ['scripts/sim-grid-entry.mjs', '--core-memory=hello', flag],
      {encoding: 'utf8', stdio: 'pipe', env: {...process.env, SIM_UDID: 'no-device-opened'}})).toThrow('serves its own fixture');
  }
});
