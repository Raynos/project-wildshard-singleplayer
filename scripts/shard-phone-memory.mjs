// G595 E2: phone-tier memory of one shard standalone at its spawn (the GLSL -> look-graph port is measured with it).
// Chromium as iPhone 16 Pro, phone tier, 2x render, muted. Samples three times 10 s apart after a 20 s settle: fps
// over 4 s, JS heap, renderer + GPU process footprint (libproc phys_footprint), three.js memory counts.
//   scripts/browser-lane.sh --max 10 node scripts/shard-phone-memory.mjs <preview url> <shard> <label> <out.json>
// --floor samples at 10/60/120 s without forced GC, then diagnoses HTTP-cache retention.
// It also accepts menu or select as the target, with the real Developer prefetch on.
// Use core --floor --pin=<sha> for all four independent milestone floors.
// A single --floor --compiled --pin=<sha> target uses the same explicit compiled-entry contract.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { devices } from 'playwright';
import * as v from 'valibot';
import { launchMemoryBrowser } from './chromium-memory-browser.mjs';
import { saveFixture } from './debug-settings.mjs';
import { chromiumProcessPeaks, chromiumAllocatorBytes } from './grid-ready-memory.mjs';
import { loadingCardIndex } from './loading-benchmark/catalogue.mjs';
import { pageMemoryAttributionExpression } from './memory-report-snapshot.mjs';

/** G682: fixed 2026-10-24 hello-world 120s Simulator WebContent+GPU floor.
 * Same native reader: 87,397,464 + 15,927,456 bytes; no forced GC or app scripts.
 * This calibration is pinned, never automatically re-based when memory grows. */
export const webKitCoreMemoryFloorBytes = 103324920;
/** G682 allowances use MiB, as in the core-memory plan's measurement table. */
export const coreMemoryTargets = Object.freeze([
  Object.freeze({shard: 'menu', name: 'Menu', limitBytes: webKitCoreMemoryFloorBytes + 50 * 1048576}),
  Object.freeze({shard: 'select', name: 'SHARD SELECT', limitBytes: webKitCoreMemoryFloorBytes + 50 * 1048576}),
  Object.freeze({shard: '_template', name: 'Template 1', limitBytes: webKitCoreMemoryFloorBytes + 100 * 1048576}),
  Object.freeze({shard: 'blender-template', name: 'Template 2', limitBytes: webKitCoreMemoryFloorBytes + 100 * 1048576}),
]);
/** G682 calibration is a separate visit, never a fifth app floor or a budget gate. */
export const helloWorldMemoryTarget = Object.freeze({shard: 'hello', name: 'Hello, world', limitBytes: null});
/** No app, script, canvas, font, style or external asset is loaded by the calibration page. */
export const helloWorldMemoryHTML = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hello, world</title><body>Hello, world.</body></html>';
/** One loopback fixture owned by the official reader; no app preview/build is needed.
 * @returns {Promise<{url: string, close: () => Promise<void>}>} */
export async function serveHelloWorldMemory() {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (path === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(helloWorldMemoryHTML); }
    else if (path === '/version.json' || path === '/clear-cache.json') {
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({build: 'webkit-hello-world-v1'}));
    } else { response.statusCode = 404; response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { resolve(); }); });
  const address = server.address();
  if (address === null || typeof address === 'string') { server.close(); throw new Error('Missing hello-world fixture address'); }
  return {url: `http://127.0.0.1:${address.port}`, close: async () => {
    await new Promise((resolve, reject) => {
      /** @param {Error} [error] */
      const done = error => { if (error === undefined) resolve(); else reject(error); };
      server.close(done);
    });
  }};
}
/** Select only an existing floor; preserve its original target object and order.
 * @param {string} selection */
export function selectedCoreMemoryTargets(selection) {
  if (selection === 'all') return coreMemoryTargets;
  if (selection === 'hello') return [helloWorldMemoryTarget];
  const target = coreMemoryTargets.find(row => row.shard === selection);
  if (target === undefined) throw new Error('Expected --core-memory=all or an existing core floor');
  return [target];
}
/** Existing Developer-tools fixture: expose the explicit compiled button, never fall back to LEGACY. */
export const compiledFloorSave = Object.freeze({scope: 'device', key: 'debug.global.legacyShardButtons', data: 'on'});
/** Scalar inventory only: no response bodies or Network-domain changes.
 * @param {readonly {name: string}[]} [entries] */
export function scriptResourceURLs(entries = performance.getEntriesByType('resource')) {
  return [...new Set(entries.filter(row => /\.m?js$/iu.test(new URL(row.name).pathname)).map(row => row.name))];
}
const footprintBytes = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const floorRows = v.array(v.object({shard: v.string(), errors: v.array(v.string()),
  samples: v.array(v.object({phase: v.string(), rendererBytes: footprintBytes, gpuBytes: footprintBytes}))}));

/** Admit only the complete original cold, unforced 10/60/120s calibration.
 * The selected 120s total is pinned by G682, never automatically re-based on growth.
 * @param {unknown} input */
export function helloWorldMemoryFloor(input) {
  const row = v.parse(v.object({shard: v.literal('hello'), protocol: v.literal('webkit-core-floor/1'),
    mode: v.literal('cold'), forcedGC: v.literal(false), inspectorResponseBodyBytes: v.literal(0),
    scriptURLs: v.pipe(v.array(v.string()), v.maxLength(0)),
    calibrationDocument: v.object({title: v.literal('Hello, world'), text: v.literal('Hello, world.'), scripts: v.literal(0), canvases: v.literal(0)}),
    errors: v.array(v.string()), samples: v.array(v.object({phase: v.string(), rendererBytes: footprintBytes, gpuBytes: footprintBytes}))}), input);
  if (row.errors.length > 0 || row.samples.map(sample => sample.phase).join(',') !== '10s,60s,120s') throw new Error('Incomplete hello-world calibration');
  const sample = row.samples.at(2);
  if (sample === undefined) throw new Error('Missing hello-world 120s sample');
  const totalBytes = v.parse(footprintBytes, sample.rendererBytes + sample.gpuBytes);
  return {phase: '120s', rendererBytes: sample.rendererBytes, gpuBytes: sample.gpuBytes, totalBytes,
    menuLimitBytes: totalBytes + 50 * 1048576, templateLimitBytes: totalBytes + 100 * 1048576};
}

/** Read only the original 120-second floor, never the cache-clear diagnostic.
 * @param {unknown} input
 * @param {string} [selection] One app floor, or all four by default. */
function coreFloorTotals(input, selection = 'all') {
  const targets = coreMemoryTargets.filter(target => selection === 'all' || target.shard === selection);
  if (targets.length === 0) throw new Error('Unknown app core memory floor');
  const rows = v.parse(floorRows, input);
  if (new Set(rows.map(row => row.shard)).size !== rows.length || rows.some(row => !targets.some(target => target.shard === row.shard))) throw new Error('Duplicate or unknown core memory floor');
  return targets.map(target => {
    const row = rows.find(value => value.shard === target.shard), samples = row?.samples.filter(sample => sample.phase === '120s') ?? [];
    if (samples.length > 1) throw new Error(`Duplicate 120s floor: ${target.shard}`);
    const sample = samples[0], totalBytes = sample === undefined || row?.errors.length !== 0 ? null : sample.rendererBytes + sample.gpuBytes;
    return {shard: target.shard, name: target.name, limitBytes: target.limitBytes, totalBytes};
  });
}

/** G682 applies only to the cold, uncollected native WebKit reader.
 * Missing/failed floors stay unknown and fail; Chromium is not phone RAM.
 * @param {unknown} input
 * @param {string} [selection] One app floor, or all four by default. */
export function coreMemorySummary(input, selection = 'all') {
  const totals = coreFloorTotals(input, selection);
  v.parse(v.array(v.object({protocol: v.literal('webkit-core-floor/1'), mode: v.literal('cold'),
    forcedGC: v.literal(false), inspectorResponseBodyBytes: v.literal(0)})), input);
  return totals.map(({shard, name, limitBytes, totalBytes}) => ({shard, name, limitBytes, totalBytes,
    passed: totalBytes !== null && totalBytes <= limitBytes}));
}

/** Chromium diagnostics report totals without qualifying a WebKit budget.
 * @param {unknown} input */
export function chromiumCoreMemorySummary(input) {
  const totals = coreFloorTotals(input);
  v.parse(v.array(v.object({protocol: v.literal('chromium-phone-core/1')})), input);
  return totals.map(({shard, name, totalBytes}) => ({shard, name, totalBytes}));
}

const processRows = v.array(v.object({pid: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  startAbstime: v.pipe(v.number(), v.safeInteger(), v.minValue(1)), physicalFootprintBytes: footprintBytes}));
/** Validate native identities; an absent GPU process is distinct from an unreadable one.
 * @param {unknown} input */
export function simulatorCoreFootprint(input) {
  const row = v.parse(v.object({webContent: processRows, gpu: processRows}), input);
  const processes = [...row.webContent, ...row.gpu];
  if (row.webContent.length === 0 || new Set(processes.map(process => process.pid)).size !== processes.length) throw new Error('Missing or duplicate Simulator memory process');
  return {...row, rendererBytes: row.webContent.reduce((sum, process) => sum + process.physicalFootprintBytes, 0),
    gpuBytes: row.gpu.reduce((sum, process) => sum + process.physicalFootprintBytes, 0)};
}

/** Same libproc reader as the Simulator watchdog, with no interval reset or GC.
 * Caller owns sim-lane; process ancestry confines this to its Simulator.
 * @param {string} device */
export function readSimulatorCoreFootprint(device) {
  const native = spawnSync('python3', ['-c', String.raw`
import json,runpy,sys
tool=runpy.run_path('scripts/ios-memory-watchdog.py')
manager=int(tool['command'](['xcrun','simctl','spawn',sys.argv[1],'launchctl','managerpid']))
native=tool['NativeMemory']()
def readings(name):
    return [native.sample(pid) for pid in sorted(tool['simulator_processes'](manager,name))]
print(json.dumps({'webContent':readings('com.apple.WebKit.WebContent'),'gpu':readings('com.apple.WebKit.GPU')}))
`, device], {cwd: resolvePath(import.meta.dirname, '..'), encoding: 'utf8'});
  if (native.status !== 0) throw new Error(`Simulator native footprint failed: ${native.stderr.trim()}`);
  return simulatorCoreFootprint(JSON.parse(native.stdout));
}
const PY = String.raw`
import ctypes, json, sys
class R(ctypes.Structure):
    _fields_ = [('uuid', ctypes.c_ubyte * 16)] + [(n, ctypes.c_uint64) for n in ('user_time','system_time','pkg_idle_wkups','interrupt_wkups','pageins','wired_size','resident_size','phys_footprint','proc_start_abstime','proc_exit_abstime')]
lib = ctypes.CDLL('/usr/lib/libproc.dylib'); out = {}
for p in sys.argv[1:]:
    u = R()
    out[p] = u.phys_footprint if lib.proc_pid_rusage(int(p), 0, ctypes.byref(u)) == 0 else None
print(json.dumps(out))
`;
async function footprint(session) {
  const info = await session.send('SystemInfo.getProcessInfo');
  const pids = info.processInfo.filter(row => row.type === 'renderer' || row.type === 'GPU');
  const measured = spawnSync('python3', ['-c', PY, ...pids.map(row => String(row.id))], { encoding: 'utf8' });
  if (measured.status !== 0) throw new Error('Process footprint reader failed');
  const sizes = JSON.parse(measured.stdout);
  if (pids.some(row => !Number.isSafeInteger(sizes[String(row.id)]))) throw new Error('Missing process footprint');
  const bytes = type => pids.filter(row => row.type === type).reduce((sum, row) => sum + sizes[String(row.id)], 0);
  return { rendererBytes: bytes('renderer'), gpuBytes: bytes('GPU') };
}
async function memoryDump(session, phase) {
  const events = [], collect = event => { events.push(...event.value); };
  session.on('Tracing.dataCollected', collect);
  try {
    await session.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], memoryDumpConfig: { triggers: [] } } });
    const dump = await session.send('Tracing.requestMemoryDump', { levelOfDetail: 'detailed', deterministic: false });
    const ended = new Promise(resolve => { session.once('Tracing.tracingComplete', resolve); });
    await session.send('Tracing.end'); await ended;
    if (!dump.success) throw new Error('Memory dump refused');
    return { phase, at: Date.now(), process: chromiumProcessPeaks(events), allocators: chromiumAllocatorBytes(events) };
  } finally { session.off('Tracing.dataCollected', collect); }
}
async function floors(page, context, browser, result) {
  const session = await browser.newBrowserCDPSession(), cdp = await context.newCDPSession(page), started = Date.now();
  const sample = async phase => {
    const heap = await cdp.send('Runtime.getHeapUsage');
    return { phase, elapsedMs: Date.now() - started, ...await footprint(session), heap,
      workers: page.workers().map(worker => worker.url()),
      page: await page.evaluate(() => ({ prefetch: window.__ws_gridPrefetch?.() ?? null,
        resources: performance.getEntriesByType('resource').length, href: location.href })),
      scriptURLs: await page.evaluate(scriptResourceURLs) };
  };
  for (const second of [10, 60, 120]) {
    await page.waitForTimeout(Math.max(0, second * 1000 - (Date.now() - started)));
    result.samples.push(await sample(`${second}s`));
  }
  // Original scalar owner ledger, after acceptance; never resource getters or GC.
  result.attribution = await page.evaluate(`(() => {const api=window.__wildshard;return ${pageMemoryAttributionExpression};})()`);
  result.memoryDumps = [await memoryDump(session, '120s-unmodified')];
  // Diagnostic only, AFTER the acceptance samples. CacheStorage stays intact.
  await cdp.send('Network.clearBrowserCache'); await page.waitForTimeout(5000);
  result.afterHttpCacheClear = await sample('after-http-cache-clear');
  result.memoryDumps.push(await memoryDump(session, 'after-http-cache-clear'));
}

async function measureTarget(base, shard, label, out, pin, floor, requireCompiled = false) {
const title = shard === 'menu' || shard === 'select';
const memoryBrowser = await launchMemoryBrowser(['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info']);
const {browser} = memoryBrowser;
const result = { label, shard, base, pin, floor, protocol: 'chromium-phone-core/1', compiledEntryRequired: requireCompiled && !title, inspectorResponseBodyBytes: 0, samples: [], errors: [] };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: floor ? 'block' : 'allow' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  if (requireCompiled && !title) await saveFixture(context, compiledFloorSave);
  await saveFixture(context, { scope: 'global', key: 'settings', merge: true, data: { tier: 'phone', fps: 'auto', volume: 0 } });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  await context.route('**/api/errors', route => route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', error => { result.errors.push(error.message); });
  if (floor) {
    await page.goto(`${base}?sw=0`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ws-main').waitFor({ state: 'visible' });
    if (shard !== 'menu') {
      await page.locator('.ws-main-select').click(); await page.locator('.ws-title-stack[data-screen="select"]').waitFor();
      if (shard !== 'select') {
        const titles = await page.locator('.ws-menu-card b').allTextContents(), selected = loadingCardIndex(titles, shard);
        await page.locator(`.ws-menu-dots i[data-i="${selected}"]`).click();
        await page.locator(`.ws-menu-card.selected[data-i="${selected}"]`).waitFor();
        const compiled = page.locator('.ws-menu-shardfile');
        if (requireCompiled && !await compiled.isVisible()) throw new Error(`Missing compiled floor entry: ${shard}`);
        await (await compiled.isVisible() ? compiled : page.locator('.ws-menu-play')).click();
        await page.waitForURL(url => url.searchParams.get('chunk') === shard);
      }
    }
  } else {
  await page.goto(`${base}?chunk=${shard}&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  }
  if (!title) {
  await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent) || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.world?.game)));
  const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent ?? null);
  if (failure) throw new Error(failure);
  await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
  }
  if (floor) await floors(page, context, browser, result);
  else {
  await page.waitForTimeout(20000);
  for (let i = 0; i < 3; i++) {
    const fps = await page.evaluate(() => new Promise(resolve => {
      let frames = 0; const start = performance.now();
      const tick = () => { frames++; if (performance.now() - start < 4000) requestAnimationFrame(tick); else resolve(frames * 1000 / (performance.now() - start)); };
      requestAnimationFrame(tick);
    }));
    const page_ = await page.evaluate(() => { const g = window.__wildshard.requireWorld().game, r = g.renderer;
      return { heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576), textures: r.info.memory.textures, geometries: r.info.memory.geometries,
        programs: r.info.programs?.length ?? null, calls: g.lastFrame.calls, renderScale: r.getPixelRatio(), tier: window.__wildshard.boot.tier }; });
    const info = await (await browser.newBrowserCDPSession()).send('SystemInfo.getProcessInfo');
    const pids = info.processInfo.filter(row => row.type === 'renderer' || row.type === 'GPU');
    const sizes = JSON.parse(spawnSync('python3', ['-c', PY, ...pids.map(row => String(row.id))], { encoding: 'utf8' }).stdout);
    const mb = type => Math.round(pids.filter(row => row.type === type).reduce((sum, row) => sum + (sizes[String(row.id)] ?? 0), 0) / 1048576);
    result.samples.push({ fps: Math.round(fps * 10) / 10, rendererMB: mb('renderer'), gpuMB: mb('GPU'), ...page_ });
    await page.waitForTimeout(10000);
  }
  }
  await page.screenshot({ path: out.replace(/\.json$/u, '.jpg'), type: 'jpeg', quality: 70 });
} catch (error) { result.errors.push(String(error)); }
finally { await memoryBrowser.close(); }
return result;
}

async function main() {
  const [base, shard, label, out] = process.argv.slice(2), floor = process.argv.includes('--floor'), compiled = process.argv.includes('--compiled');
  const pin = process.argv.find(arg => arg.startsWith('--pin='))?.slice(6);
  if (!base || !shard || !label || !out || !out.endsWith('.json')) throw new Error('Expected <preview URL> <shard|menu|select|core> <label> <out.json>');
  if (['menu', 'select', 'core'].includes(shard) && !floor) throw new Error('Menu/core targets require --floor');
  if (shard === 'core' && pin === undefined) throw new Error('Core floors require --pin=<full-sha>');
  if (compiled && (!floor || pin === undefined || ['menu', 'select'].includes(shard))) throw new Error('Compiled floor requires a shard, --floor and --pin=<full-sha>');
  if (pin !== undefined) {
    if (!/^[a-f0-9]{40}$/u.test(pin)) throw new Error('Expected exact served source pin');
    const version = await (await fetch(new URL('/version.json', base))).json();
    if (!version.build?.startsWith(pin.slice(0, 7))) throw new Error('Served source differs from pin');
  }
  if (shard !== 'core') {
    const result = await measureTarget(base, shard, label, out, pin, floor, compiled);
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result));
    if (result.errors.length > 0) process.exitCode = 1;
    return;
  }
  const result = {label, base, pin, protocol: 'chromium-phone-core/1', targets: [], summary: []};
  try {
    for (const target of coreMemoryTargets) {
      // A fresh browser (not just context) prevents the previous floor's GPU/
      // renderer processes and prefetch payloads from inflating the next floor.
      const row = await measureTarget(base, target.shard, label, out.replace(/\.json$/u, `-${target.shard}.json`), pin, true, true);
      result.targets.push(row);
      if (row.errors.length > 0) break;
    }
  } finally {
    result.summary = chromiumCoreMemorySummary(result.targets);
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    for (const row of result.summary) console.log(`${row.name}: ${row.totalBytes === null ? 'UNKNOWN' : `${(row.totalBytes / 1048576).toFixed(1)} MiB`} (Chromium diagnostic; WebKit budget unqualified)`);
    if (result.summary.some(row => row.totalBytes === null)) process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolvePath(process.argv[1]) === import.meta.filename) await main();
