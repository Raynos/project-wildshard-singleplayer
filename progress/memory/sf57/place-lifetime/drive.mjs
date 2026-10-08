// SF57 place-lifetime: Chromium (muted, iPhone 16 Pro, Developer on, phone tier, 2x) drives the D -> P -> N -> template
// -> D cell circuit N times (the pmrem lane's ../pmrem/drive.mjs route). After every leg it reads the placement census
// (the probe's `app.placement`: live worlds, model records, groups, per-frame cullers). At home after each circuit it
// stands at one fixed Driftwood pose, forces a full GC over CDP and reads the JS heap.
//   scripts/browser-lane.sh node drive.mjs --base=http://127.0.0.1:44xx/ --out=<dir> [--circuits=4]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixtureCode } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { ownedSoakPlans } = await import(`${ROOT}/scripts/soak/owned.mjs`);
const { gridFloorDocumentIdentity, stageFloorGrid, runFloorGridRoute, gridFloorWitnessFailures } = await import(`${ROOT}/scripts/frame-floor-grid.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);

const flag = (name, d) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? d;
const BASE = flag('base'), OUT = flag('out'), CIRCUITS = Number(flag('circuits', '4'));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const fixtures = [
  saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0, time: 'midday' } }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
].join(';');

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const result = { base: BASE, circuits: CIRCUITS, samples: [], heap: [], errors: [] };
const save = () => { writeFileSync(join(OUT, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await context.addInitScript(`${fixtures};window.__wildshardHarness={seed:357,capture:null};`);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  page.on('pageerror', (e) => { result.errors.push(e.message.slice(0, 300)); });
  page.setDefaultTimeout(600000);
  await page.goto(`${BASE}?mute=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('.ws-main-grid')), null, { timeout: 240000 });
  await page.evaluate(() => { setTimeout(() => { document.querySelector('.ws-main-grid').click(); }, 100); });
  await sleep(3000);
  await page.waitForFunction(() => Boolean(!document.querySelector('.ws-load') && window.__wildshard?.shard?.grid?.state().live?.live), null, { timeout: 240000, polling: 500 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 60000, polling: 500 });
  result.version = await page.evaluate(() => fetch('/version.json').then((r) => r.json()));
  const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
  const route = ownedSoakPlans(state, 'cells', 'prepared');
  result.route = route.plans.map((p) => p.name);
  const documentOrigin = await page.evaluate(`(${gridFloorDocumentIdentity.toString()})()`);
  const stage = () => page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...route.plans[0], start: route.reference })},${JSON.stringify(documentOrigin)})`);
  await stage();
  const census = () => page.evaluate(() => {
    const s = window.__wildshard.shard.grid.state();
    return { placement: window.__wildshard.app.placement ?? null, current: s.live?.live?.current ?? null, residents: s.live?.live?.residents ?? [] };
  });
  const sample = async (cycle, leg) => {
    const row = { cycle, leg, at: Date.now() / 1000, ...(await census()) };
    result.samples.push(row); save();
    console.log(JSON.stringify({ cycle, leg, current: row.current, placement: row.placement }));
  };
  const heap = async (cycle) => {
    // one fixed Driftwood pose (the pmrem lane's home-east), settled, then a forced full GC
    await page.evaluate(async ({ ref }) => {
      const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.world.player;
      const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
      await api.pose({ x: ref.x - origin.x, y: 0.55, z: ref.z - origin.z, yaw: Math.PI / 2, pitch: 0.06 });
    }, { ref: route.reference });
    await sleep(8000);
    for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await sleep(500); }
    const usage = await cdp.send('Runtime.getHeapUsage');
    const row = { cycle, usedMB: usage.usedSize / 1e6, totalMB: usage.totalSize / 1e6, ...(await census()) };
    result.heap.push(row); save();
    console.log(JSON.stringify({ heap: cycle, usedMB: row.usedMB.toFixed(2), placement: row.placement }));
    await stage();
  };
  await sleep(5000);
  await sample(0, 'start');
  await heap(0);
  for (let cycle = 1; cycle <= CIRCUITS; cycle++) {
    for (const plan of route.plans) {
      const witness = await runFloorGridRoute(page, plan, documentOrigin);
      const failures = gridFloorWitnessFailures(witness);
      if (failures.length > 0) throw new Error(`${plan.name}: ${failures.join('; ')}`);
      await sleep(3000);
      await sample(cycle, plan.name);
    }
    await sleep(5000);
    await sample(cycle, 'settled');
    await heap(cycle);
  }
} catch (error) {
  result.failure = String(error?.stack ?? error); console.error(result.failure);
} finally {
  save();
  await browser.close();
}
