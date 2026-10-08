// E435: actual title -> standalone and title -> owned grid smoke for UUID-less target admission.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { installResources } from '../../../scripts/parity/resources.mjs';
const [base, out] = process.argv.slice(2), started = Date.now();
const report = { version: await (await fetch(new URL('version.json', base))).json(), boots: [], errors: [] };
const save = () => writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const grid of [false, true]) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    await context.addInitScript(installResources);
    await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() }; });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: grid });
    await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto' }, merge: true });
    const page = await context.newPage(), row = { mode: grid ? 'owned-grid-developer' : 'standalone-public', errors: [], consoleErrors: [] };
    report.boots.push(row); page.setDefaultTimeout(90000);
    page.on('pageerror', error => { row.errors.push(String(error)); save(); });
    page.on('console', message => { if (message.type() === 'error') row.consoleErrors.push(message.text()); });
    await context.route('**/api/errors', route => route.fulfill({ status: 204, body: '' }));
    try {
      await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit' });
      await page.waitForFunction(() => Boolean(document.querySelector('.ws-main-select')) || document.documentElement.dataset.wsState === 'error', null, { timeout: 90000 });
      row.title = await page.evaluate(() => ({ state: document.documentElement.dataset.wsState, body: document.body.innerText, dev: document.documentElement.hasAttribute('data-dev') })); save();
      if (row.title.state === 'error') throw Error(row.title.body);
      await page.locator(grid ? '.ws-main-grid' : '.ws-main-select').click();
      if (!grid) await page.locator('.ws-menu-play').click();
      await page.waitForFunction(grid => document.documentElement.dataset.wsState === 'error' || (!document.querySelector('.ws-load') && window.__wildshard?.world !== undefined && (!grid || window.__wildshard.shard.grid?.state().live?.live !== undefined)), grid, { timeout: 180000 });
      await page.evaluate(() => window.__wildshard.requireWorld().hud.enterNow());
      await page.waitForTimeout(2000);
      row.active = await page.evaluate(() => { const api = window.__wildshard, world = api.requireWorld(); return { level: world.game.level.id, appState: world.game.app.state, bodies: world.game.app.physics.world.bodies.len(), colliders: world.game.app.physics.world.colliders.len(), grid: api.shard.grid?.state() ?? null }; });
      if (row.active.level !== (grid ? 'platform.grid' : 'driftwood-isle')) throw Error('Wrong actual boot world');
      row.leak = await page.evaluate(() => window.__wildshard.leak());
      row.pass = row.errors.length === 0 && row.consoleErrors.length === 0 && row.leak.disposalErrors.length === 0 && row.leak.after.bodies === 0 && row.leak.after.colliders === 0 && Object.values(row.leak.scope).every(count => count === 0);
      if (!row.pass) throw Error('Real boot/unload census failed');
    } catch (error) { row.pass = false; row.failure = String(error.stack ?? error); row.lastPage = await page.evaluate(() => document.body.innerText).catch(() => null); throw error; }
    finally { await context.close(); save(); }
  }
  report.pass = report.boots.length === 2 && report.boots.every(row => row.pass);
} catch (error) { report.pass = false; report.errors.push(String(error.stack ?? error)); }
finally { await browser.close(); report.seconds = (Date.now() - started) / 1000; save(); console.log(JSON.stringify({ pass: report.pass, seconds: report.seconds, errors: report.errors })); }
if (!report.pass) process.exitCode = 1;
