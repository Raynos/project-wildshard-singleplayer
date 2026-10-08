import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { driveFloorGrid, gridFloorPlans } from '../../../scripts/frame-floor-grid.mjs';

const [base, out] = process.argv.slice(2);
const report = { version: await (await fetch(new URL('version.json', base))).json(),
  protocol: 'One muted Chromium/Metal iPhone 16 Pro, Developer ON, live input crossings. Claims count retained resources; hidden is not freed.',
  driverHash: createHash('sha256').update(driveFloorGrid.toString()).digest('hex'), snapshots: [], routes: [], errors: [], console: [] };
const save = () => writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto' }, merge: true });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => {
    window.__wildshardHarness = { seed: 357, capture: null };
    window.__gridAdmissionLongTasks = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__gridAdmissionLongTasks.push({ start: entry.startTime, ms: entry.duration,
        live: window.__wildshard?.shard?.grid?.state().live?.live });
    }).observe({ entryTypes: ['longtask'] });
  });
  const page = await context.newPage();
  page.on('requestfailed', request => { report.console.push(`REQUEST FAILED ${request.url()} ${request.failure()?.errorText}`); });
  page.on('pageerror', error => { report.errors.push(String(error)); save(); });
  page.on('console', message => { if (['error', 'warn'].includes(message.type())) report.console.push(message.text().slice(0, 1200)); });
  const snapshot = async label => {
    const value = await page.evaluate(() => {
      const api = window.__wildshard, grid = api.shard.grid;
      const roots = [];
      api.world.game.rootScene.traverse(object => {
        if (object.isMesh && object.name.startsWith('grid-')) roots.push({ name: object.name, visible: object.visible,
          vertices: object.geometry?.attributes.position?.count, indices: object.geometry?.index?.count });
      });
      return { state: grid.state(), residency: grid.residency(), road: grid.roadResident(), roots, longTasks: window.__gridAdmissionLongTasks,
        runtime: { texture: api.world.game.level.assets?.texture, level: api.world.game.level.id },
        reveal: window.__wsReveal };
    });
    report.stage = label; report.snapshots.push({ label, ...value }); save(); console.log(label, value.state.playingMB, 'MB', value.state.live?.live.current);
  };
  try {
    await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 180000 });
    report.stage = 'title'; save(); console.log('title navigation');
    await page.locator('.ws-main-grid').waitFor({ timeout: 120000 });
    await page.locator('.ws-main-grid').click();
    report.stage = 'grid-loading'; save(); console.log('grid title tapped');
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
      || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)), null, { timeout: 240000 });
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow());
    await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 45000 });
    await page.waitForTimeout(5000); await snapshot('home-settled');
    const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
    const plans = gridFloorPlans(state, 'runtime-travel');
    for (const original of plans) {
      const plan = { ...original, requiredResidents: [original.to] };
      report.stage = `route:${plan.name}`; save();
      // Entry-edge poses first, then a real-input route into each cell centre. No diagnostic teleport across a seam.
      report.routes.push(await page.evaluate(driveFloorGrid, plan));
      await page.waitForTimeout(5000); await snapshot(`${plan.to}-entry`);
      const cell = state.cells.find(row => row.instance === plan.to); if (!cell) throw new Error('Missing destination');
      report.routes.push(await page.evaluate(driveFloorGrid, { name: `${plan.to}-centre`, from: plan.to, to: plan.to,
        waypoints: [{ x: cell.cell[0] * 555, z: cell.cell[1] * 555 }], requiredResidents: [plan.to] }));
      await page.waitForTimeout(5000); await snapshot(`${plan.to}-centre`);
    }
  } catch (error) {
    report.failure = String(error);
    report.diagnostic = await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(-6000),
      boot: window.__wildshard?.world?.game?.app?.state, grid: window.__wildshard?.shard?.grid?.state(), reveal: window.__wsReveal,
      longTasks: window.__gridAdmissionLongTasks,
      resources: performance.getEntriesByType('resource').slice(-20).map(row => ({ name: row.name, duration: row.duration })) })).catch(() => null);
    save(); console.error(report.failure); process.exitCode = 1;
  }
  finally { await context.close(); }
} finally { await browser.close(); report.closed = true; save(); }
