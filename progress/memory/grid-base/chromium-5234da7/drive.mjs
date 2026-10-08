// grid-base: Chromium (muted, iPhone 16 Pro, Developer on, phone tier, 2x, Memory saver on) attribution of the grid page's
// overhead at Pine. Grid: home settled -> Pine entry -> Pine centre (the native ruler's pine-centre route). Standalone:
// ?chunk=pine-hollow at the cell centre. At every pose: 3x forced GC, JS heap usage, the SF64 ledger aggregated by owner.
// Optional heap snapshot at the centre poses (--heap=1).
//   scripts/browser-lane.sh node drive.mjs --base=http://127.0.0.1:44xx/ --out=<dir> [--mode=grid|standalone] [--heap=1]
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixtureCode } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { gridFloorDocumentIdentity, gridFloorPlans, runFloorGridRoute, gridFloorWitnessFailures } = await import(`${ROOT}/scripts/frame-floor-grid.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);

const flag = (name, d) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? d;
const BASE = flag('base'), OUT = flag('out'), MODE = flag('mode', 'grid'), HEAP = flag('heap', '0') === '1', TAG = flag('tag', MODE);
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const fixtures = [
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'on', volume: 0 }, merge: true }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
].join(';');

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'] });
const result = { base: BASE, mode: MODE, poses: [], errors: [] };
const save = () => { writeFileSync(join(OUT, `${TAG}.json`), `${JSON.stringify(result, null, 2)}\n`); };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await context.addInitScript(`${fixtures};window.__wildshardHarness={seed:357,capture:null};`);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', (e) => { result.errors.push(e.message.slice(0, 300)); });
  page.setDefaultTimeout(600000);
  const readPose = async (label) => {
    await sleep(6000);
    for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(400); }
    const usage = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters').catch(() => null);
    const pose = await page.evaluate(() => {
      const api = window.__wildshard;
      const snap = api.memory?.() ?? null;
      const s = api.shard?.grid?.state?.() ?? null;
      return { snap, state: s === null ? null : { inside: s.inside, cells: s.cells, live: s.live?.live ? { current: s.live.live.current, residents: s.live.live.residents } : null },
        renderer: (() => { const r = api.requireWorld?.().game?.renderer ?? api.world?.game?.renderer; return r ? { memory: r.info.memory, programs: r.info.programs?.length } : null; })() };
    });
    const row = { label, usedMB: usage.usedSize / 1e6, totalMB: usage.totalSize / 1e6, dom, ...pose };
    result.poses.push(row); save();
    console.log(label, 'heap', row.usedMB.toFixed(1), 'ledger', JSON.stringify(pose.snap?.totals ?? pose.snap?.attribution?.totals ?? null));
    if (HEAP && /centre/.test(label)) {
      const path = join(OUT, `${TAG}-${label}.heapsnapshot`), stream = createWriteStream(path);
      const onChunk = ({ chunk }) => { stream.write(chunk); };
      cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
      await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
      await new Promise((r) => { stream.end(r); });
      row.heapSnapshot = path; save();
    }
  };
  if (MODE === 'grid') {
    await page.goto(`${BASE}plain.html?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('.ws-main-grid')), null, { timeout: 240000 });
    await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid').click(); }, 100); });
    await sleep(3000);
    await page.waitForFunction(() => Boolean(!document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live), null, { timeout: 240000, polling: 500 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 60000, polling: 500 });
    result.version = await page.evaluate(() => fetch('/version.json').then((r) => r.json()));
    const documentOrigin = await page.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
    await readPose('home-settled');
    const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
    const plan = gridFloorPlans(state, 'runtime-travel')[0];
    const w = await runFloorGridRoute(page, plan, documentOrigin);
    const f = gridFloorWitnessFailures(w); if (f.length) throw new Error(f.join('; '));
    await readPose('pine-entry');
    const cell = state.cells.find((c) => c.instance === plan.to);
    const w2 = await runFloorGridRoute(page, { name: 'pine-centre', from: plan.to, to: plan.to, waypoints: [{ x: cell.cell[0] * 555, z: cell.cell[1] * 555 }], requiredResidents: [plan.to] }, documentOrigin);
    const f2 = gridFloorWitnessFailures(w2); if (f2.length) throw new Error(f2.join('; '));
    await readPose('pine-centre');
  } else {
    await page.goto(`${BASE}plain.html?chunk=pine-hollow&skipintro=1&mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(!document.querySelector('.ws-load') && window.__wildshard?.world?.player), null, { timeout: 240000, polling: 500 });
    await sleep(4000);
    result.version = await page.evaluate(() => fetch('/version.json').then((r) => r.json()));
    await readPose('standalone-spawn');
    await page.evaluate(async () => { await window.__wildshard.pose({ x: 0.92, y: 0.55, z: -0.92, yaw: 0, pitch: -0.08 }); });
    await readPose('standalone-centre');
  }
} catch (error) {
  result.failure = String(error?.stack ?? error); console.error(result.failure);
} finally {
  save();
  await browser.close();
}
