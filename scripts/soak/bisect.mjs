// SF57 local Mac WebKit instrumentation control. One muted browser at a time via browser-lane.sh.
// node scripts/soak/bisect.mjs <cdad base> <output.json>
// This first-crossing diagnostic never supplies Simulator, cap or soak evidence.
import { webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { GL_INIT } from '../parity/glbytes.mjs';
import { installResources } from '../parity/resources.mjs';
import { saveFixtureCode } from '../debug-settings.mjs';
import { installSoakGl, installSoakWasm, installLoadingGlJournal, installSoakDiagnostics } from './gl.mjs';
import { ownedSoakPlans } from './owned.mjs';
import { gridFloorDocumentIdentity, stageFloorGrid, runFloorGridRoute, gridFloorWitnessFailures } from '../frame-floor-grid.mjs';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('Supply the historical cdad preview and a fresh output JSON');
const version = await (await fetch(new URL('version.json', base))).json();
if (!version.build.startsWith('cdad597')) throw new Error('Instrumentation bisection requires the historical cdad runtime');
const historical = execFileSync('git', ['show', 'c2b285ab9:scripts/parity/glbytes.mjs'], { encoding: 'utf8' });
const historicalGl = historical.slice(historical.indexOf('String.raw`') + 11, historical.lastIndexOf('`;'));
const cases = [
  { name: 'historical-census', gl: historicalGl, journal: false, diagnostics: false },
  { name: 'historical-journal', gl: historicalGl, journal: true, diagnostics: false },
  { name: 'light-journal', gl: GL_INIT, journal: true, diagnostics: false },
  { name: 'light-diagnostics', gl: GL_INIT, journal: true, diagnostics: true },
];
const report = { purpose: 'Local Mac WebKit first-crossing instrumentation bisection; never a Simulator/cap/soak pass',
  version, harness: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), cases: [] };
const save = () => writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const fixtures = [saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', volume: 0 } }),
  saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
  saveFixtureCode({ scope: 'device', key: 'devMode', data: true })].join(';');

for (const config of cases) {
  const row = { name: config.name, journal: config.journal, diagnostics: config.diagnostics, errors: [], consoleErrors: [], console: [], documents: [] };
  report.cases.push(row); save(); console.log(config.name);
  const browser = await webkit.launch();
  let page;
  try {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    await context.addInitScript(`${config.gl};(${installSoakWasm.toString()})();(${installResources.toString()})();
      window.__wildshardHarness={seed:357,capture:null,resources:()=>window.__parityResources()};
      window.__sf57Errors=[];window.__sf57DocumentId=Date.now()+':'+Math.random();window.__sf57={cycles:0};
      ${config.journal ? `(${installLoadingGlJournal.toString()})();` : ''}
      ${config.diagnostics ? `(${installSoakDiagnostics.toString()})();` : ''}
      (${installSoakGl.toString()})();${fixtures};`);
    page = await context.newPage(); page.setDefaultTimeout(240000);
    page.on('pageerror', error => { row.errors.push(String(error)); save(); });
    page.on('console', message => {
      if (message.type() === 'error') row.consoleErrors.push(message.text());
      row.console.push({ at: Date.now() / 1000, type: message.type(), text: message.text().slice(0, 4000) });
      if (row.console.length > 128) row.console.shift();
    });
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) { row.documents.push(frame.url()); save(); } });
    await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit' });
    await page.locator('.ws-main-grid').click();
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
      || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)));
    const fatal = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent);
    if (fatal) throw new Error(fatal);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow());
    await page.waitForFunction(() => typeof window.__wsReveal?.endedMs === 'number');
    row.origin = await page.evaluate(gridFloorDocumentIdentity);
    const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
    const route = ownedSoakPlans(state, 'cells', 'prepared'), first = route.plans[0];
    await page.evaluate(`(${stageFloorGrid.toString()})(${JSON.stringify({ ...first, start: route.reference })},${JSON.stringify(row.origin)})`);
    await page.waitForTimeout(20000);
    row.bootDocuments = row.documents.length;
    row.route = await runFloorGridRoute(page, first, row.origin);
    row.failures = gridFloorWitnessFailures(row.route);
    row.pass = row.failures.length === 0 && row.errors.length === 0 && row.consoleErrors.length === 0 && row.documents.length === row.bootDocuments;
  } catch (error) { row.pass = false; row.failure = String(error.stack ?? error); }
  finally {
    if (page && !page.isClosed()) row.final = await page.evaluate(() => ({
      href: location.href, diagnostics: window.__sf57Diagnostics ?? [], errors: window.__sf57Errors ?? [],
      journalEvents: window.__sf57GLEvents?.length ?? 0, samples: window.__sf57GL?.length ?? 0,
      current: window.__wildshard?.shard?.grid?.state().live?.live?.current ?? null,
      body: document.body.textContent.slice(0, 4000),
    })).catch((/** @type {unknown} */ error) => ({ failure: String(error) }));
    await browser.close(); row.closed = true; save();
  }
  console.log(JSON.stringify({ name: row.name, pass: row.pass, failure: row.failure }));
}
