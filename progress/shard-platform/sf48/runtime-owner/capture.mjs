import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';
import { installResources } from '../../../../scripts/parity/resources.mjs';
import { gridFloorDocumentIdentity, runFloorGridRoute } from '../../../../scripts/frame-floor-grid.mjs';
const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('Pass preview URL and output directory');
mkdirSync(out, { recursive: true });
const report = { base, device: 'iPhone 16 Pro', errors: [], stages: [] };
const stage = value => { report.stages.push(value); console.log('stage', value.stage); };
let page;
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'allow' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(installResources);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null, resources: () => window.__parityResources() }; });
  page = await context.newPage();
  page.on('pageerror', error => { report.errors.push(error.stack ?? error.message); });
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  const enter = async () => {
    await page.waitForFunction(() => window.__wildshard?.world?.game && !document.querySelector('.ws-load'), null, { timeout: 240000 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); });
    await page.waitForFunction(() => window.__wildshard.world.game.app.state === 'play' && !window.__wildshard.world.hud.paused, null, { timeout: 120000 });
  };
  await page.goto(`${base}?chunk=nalati-grasslands&tier=phone&touch=1&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
  await enter();
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json());
  stage(await page.evaluate(() => {
    const api = window.__wildshard, rt = api.shard.nalati;
    if (!rt?.persistence) throw new Error(`Nalati bound state missing: ${Object.keys(api.shard)}`);
    const state = rt.persistence, weapons = api.world.weapons;
    const rows = weapons.list.map(weapon => ({ id: weapon.id, row: weapon.row.id, context: weapon.row.ui.inputContext, ammo: weapon.state.ammo }));
    if (!rows.some(row => row.id === 'bow' && row.row === 'weapon.bow')) throw new Error('Native bow identity changed');
    state.horseNames.write({ 'Camp horse|horse:camp-bay': 'Kara' });
    for (const flag of ['talked:elder', 'tamed:horse', 'won:kokpar', 'told:tulpar']) state.flags.set(flag);
    if (!state.flags.has('quest:tulpar') || !state.facts.achievement('tulpar')?.earned) throw new Error('Bound quest did not emit its ledger reward');
    if (!state.facts.flush()) throw new Error('Ledger checkpoint refused');
    return { stage: 'standalone', rows, horseNames: state.horseNames.read(), quest: state.flags.has('quest:tulpar'), achievement: state.facts.achievement('tulpar') };
  }));
  await page.screenshot({ path: `${out}/standalone.jpg`, type: 'jpeg', quality: 65 });
  await page.reload({ waitUntil: 'domcontentloaded' }); await enter();
  stage(await page.evaluate(() => {
    const state = window.__wildshard.shard.nalati.persistence;
    if (state.horseNames.read()['Camp horse|horse:camp-bay'] !== 'Kara' || !state.flags.has('quest:tulpar')) throw new Error('Standalone reload lost bound state');
    return { stage: 'standalone-reload', horseNames: state.horseNames.read(), achievement: state.facts.achievement('tulpar') };
  }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.ws-main-grid').click({ timeout: 240000 }); await enter();
  await page.waitForFunction(() => window.__wsReveal?.endedMs != null && window.__wildshard.shard.grid.state().live?.live?.gameplayReady, null, { timeout: 180000 });
  const documentOrigin = await page.evaluate(gridFloorDocumentIdentity);
  const plans = await page.evaluate(() => {
    const cell = window.__wildshard.shard.grid.state().cells.find(row => row.slug === 'nalati-grasslands');
    if (!cell) throw new Error('Developer grid has no Nalati');
    const home = window.__wildshard.shard.grid.state().cells.find(row => row.instance === window.__wildshard.shard.grid.state().home);
    if (!home) throw new Error('Grid has no home');
    const h = { x: home.cell[0] * 555, z: home.cell[1] * 555 };
    const origin = { x: cell.cell[0] * 555, z: cell.cell[1] * 555 };
    const road = { x: origin.x - 277.5, z: origin.z }, entry = { x: origin.x - 218.5, z: origin.z };
    return [{ name: 'nalati-bound-entry', from: home.instance, to: cell.instance, borrowedHome: home.instance, movement: 'road-hover', start: { x: h.x + 230, z: h.z }, waypoints: [road, entry], requiredResidents: [cell.instance] },
      { name: 'nalati-bound-return', from: cell.instance, to: null, movement: 'road-hover', waypoints: [road], requiredResidents: [] }];
  });
  stage({ stage: 'grid-entry', route: await runFloorGridRoute(page, plans[0], documentOrigin) });
  stage(await page.evaluate(() => {
    const api = window.__wildshard, handle = api.shard['harness.shard.nalati-grasslands'], rt = handle?.nalati;
    if (!rt?.persistence) throw new Error(`Regional Nalati state missing: ${Object.keys(api.shard)}`);
    const state = rt.persistence;
    if (state.horseNames.read()['Camp horse|horse:camp-bay'] !== 'Kara' || !state.flags.has('quest:tulpar')) throw new Error('Grid and SHARD SELECT do not share progress');
    return { stage: 'grid-bound-state', horseNames: state.horseNames.read(), achievement: state.facts.achievement('tulpar'), ready: api.shard.grid.state().live.live.gameplayReady };
  }));
  await page.screenshot({ path: `${out}/grid-entry.jpg`, type: 'jpeg', quality: 65 });
  stage({ stage: 'grid-return', route: await runFloorGridRoute(page, plans[1], documentOrigin) });
  report.leak = await page.evaluate(() => window.__wildshard.leak());
  if (report.leak.disposalErrors.length) throw new Error(`Unload failed: ${report.leak.disposalErrors}`);
  await context.close();
} catch (error) { report.failure = String(error?.stack ?? error); if (page) { report.failurePage = { url: page.url(), text: await page.locator('body').innerText().catch(() => '') }; await page.screenshot({ path: `${out}/failure.jpg`, type: 'jpeg', quality: 65 }).catch(() => undefined); } }
finally { await browser.close(); writeFileSync(`${out}/browser-run.json`, JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors, stages: report.stages.map(row => row.stage) }));
if (report.failure || report.errors.length) process.exitCode = 1;
