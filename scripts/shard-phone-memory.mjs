// G595 E2: phone-tier memory of one shard standalone at its spawn (the GLSL -> look-graph port is measured with it).
// Chromium as iPhone 16 Pro, phone tier, 2x render, muted. Samples three times 10 s apart after a 20 s settle: fps
// over 4 s, JS heap, renderer + GPU process footprint (libproc phys_footprint), three.js memory counts.
//   scripts/browser-lane.sh --max 10 node scripts/shard-phone-memory.mjs <preview url> <shard> <label> <out.json>
// --floor samples at 10/60/120 s without forced GC, then diagnoses HTTP-cache retention.
// It also accepts menu or select as the target, with the real Developer prefetch on.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { saveFixture } from './debug-settings.mjs';
import { chromiumProcessPeaks, chromiumAllocatorBytes } from './grid-ready-memory.mjs';
import { loadingCardIndex } from './loading-benchmark/catalogue.mjs';

const [base, shard, label, out] = process.argv.slice(2);
const floor = process.argv.includes('--floor'), title = shard === 'menu' || shard === 'select';
const pin = process.argv.find(arg => arg.startsWith('--pin='))?.slice(6);
if (title && !floor) throw new Error('Menu targets require --floor');
if (pin !== undefined) {
  if (!/^[a-f0-9]{40}$/u.test(pin)) throw new Error('Expected exact served source pin');
  const version = await (await fetch(new URL('/version.json', base))).json();
  if (!version.build?.startsWith(pin.slice(0, 7))) throw new Error('Served source differs from pin');
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
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const result = { label, shard, base, pin, floor, samples: [], errors: [] };
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
async function floors(page, context) {
  const session = await browser.newBrowserCDPSession(), cdp = await context.newCDPSession(page), started = Date.now();
  const sample = async phase => {
    const heap = await cdp.send('Runtime.getHeapUsage');
    return { phase, elapsedMs: Date.now() - started, ...await footprint(session), heap,
      workers: page.workers().map(worker => worker.url()),
      page: await page.evaluate(() => ({ prefetch: window.__ws_gridPrefetch?.() ?? null,
        resources: performance.getEntriesByType('resource').length, href: location.href })) };
  };
  for (const second of [10, 60, 120]) {
    await page.waitForTimeout(Math.max(0, second * 1000 - (Date.now() - started)));
    result.samples.push(await sample(`${second}s`));
  }
  result.memoryDumps = [await memoryDump(session, '120s-unmodified')];
  // Diagnostic only, AFTER the acceptance samples. CacheStorage stays intact.
  await cdp.send('Network.clearBrowserCache'); await page.waitForTimeout(5000);
  result.afterHttpCacheClear = await sample('after-http-cache-clear');
  result.memoryDumps.push(await memoryDump(session, 'after-http-cache-clear'));
}
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: floor ? 'block' : 'allow' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
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
  if (floor) await floors(page, context);
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
finally { await browser.close(); writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result)); }
if (result.errors.length > 0) process.exitCode = 1;
