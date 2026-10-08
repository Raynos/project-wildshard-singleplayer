// SF57 PMREM: Chromium (muted, iPhone 16 Pro, Developer on) drives the D -> P -> N -> template -> D cell circuit N times
// and reads the live PMREM cube-UV GL allocations (scripts/parity/glbytes.mjs census) after every leg; screenshots two
// fixed poses at home after circuits 1 and N for the pixel diff.
//   scripts/browser-lane.sh node drive.mjs --base=http://127.0.0.1:44xx/ --out=<dir> [--circuits=4]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { GL_INIT } = await import(`${ROOT}/scripts/parity/glbytes.mjs`);
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
const result = { base: BASE, circuits: CIRCUITS, samples: [], shots: [], errors: [] };
const save = () => { writeFileSync(join(OUT, 'result.json'), `${JSON.stringify(result, null, 2)}\n`); };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  await context.addInitScript(`${GL_INIT};${fixtures};window.__wildshardHarness={seed:357,capture:null};`);
  const page = await context.newPage();
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
  await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...route.plans[0], start: route.reference })},${JSON.stringify(documentOrigin)})`);
  const sample = async (cycle, leg) => {
    const row = await page.evaluate(() => {
      const ctx = window.__sc_gl()[0];
      const pm = ctx.resources.filter((r) => String(r.asset).startsWith('PMREM') || String(r.asset).includes('/PMREM'));
      const cube = pm.filter((r) => String(r.asset).includes('PMREM.cubeUv'));
      const s = window.__wildshard.shard.grid.state();
      return { totalGL: ctx.totalBytes, pmremCount: pm.length, pmremBytes: pm.reduce((a, r) => a + r.bytes, 0),
        cubeUvCount: cube.length, cubeUvBytes: cube.reduce((a, r) => a + r.bytes, 0),
        pmrem: pm.map((r) => `${r.kind}:${r.asset}:${r.owner}:${r.bytes}:${r.id}`), current: s.live?.live?.current ?? null, residents: s.live?.live?.residents ?? [] };
    });
    const out = { cycle, leg, at: Date.now() / 1000, ...row };
    result.samples.push(out); save();
    console.log(JSON.stringify({ cycle, leg, current: row.current, cubeUv: row.cubeUvCount, cubeUvMB: (row.cubeUvBytes / 1e6).toFixed(3), pmrem: row.pmremCount, glMB: (row.totalGL / 1e6).toFixed(1) }));
  };
  const shoot = async (cycle) => {
    for (const [name, yaw, pitch] of [['home-east', Math.PI / 2, 0.06], ['home-north', 0, -0.04]]) {
      await page.evaluate(async ({ yaw: y, pitch: p, ref }) => {
        const api = window.__wildshard, live = api.shard.grid.state().live.live, player = api.world.player;
        const origin = { x: live.worldFeet.x - player.position.x, z: live.worldFeet.z - player.position.z };
        await api.pose({ x: ref.x - origin.x, y: 0.55, z: ref.z - origin.z, yaw: y, pitch: p });
      }, { yaw, pitch, ref: route.reference });
      await sleep(4000);
      const file = join(OUT, `c${cycle}-${name}.png`);
      await page.screenshot({ path: file });
      result.shots.push({ cycle, name, file });
    }
    // back to the route's reference pose for the next circuit's first leg
    await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...route.plans[0], start: route.reference })},${JSON.stringify(documentOrigin)})`);
  };
  await sleep(5000);
  await sample(0, 'start');
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
    if (cycle === 1 || cycle === CIRCUITS) await shoot(cycle);
  }
} catch (error) {
  result.failure = String(error?.stack ?? error); console.error(result.failure);
} finally {
  save();
  await browser.close();
}
