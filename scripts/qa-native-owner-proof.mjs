/** PRIVATE complete-cycle engineering capture. Run through browser-lane.sh against the exact built fixture. */
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, extname, sep } from 'node:path';
import { ROOT, OUTPUT, PIN, hash, inventory, verifyPin } from './native-owner-proof-pin.mjs';
import { installNativeOwnerObservation } from './qa-native-owner-observation.mjs';

const pin = verifyPin(), dist = resolve(ROOT, OUTPUT, 'dist'), out = resolve(ROOT, OUTPUT, 'capture');
if (existsSync(out)) throw new Error('Preserve the prior complete capture');
const receiptBytes = readFileSync(join(dist, 'native-owner-proof.json')), receipt = JSON.parse(receiptBytes);
const actual = inventory(dist); delete actual['native-owner-proof.json'];
if (receipt.schema !== 'wildshard.native-owner.private-host.v1' || receipt.synthetic !== true
  || receipt.modelAdmission !== false || receipt.publicAdmission !== false || receipt.pinSha256 !== hash(readFileSync(resolve(ROOT, PIN)))
  || JSON.stringify(receipt.pin) !== JSON.stringify(pin) || JSON.stringify(receipt.hostFiles) !== JSON.stringify(actual))
  throw new Error('Private built bytes do not match reviewed identity');
const chrome = resolve(ROOT, 'tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell');
if (process.env.CHROME_PATH !== chrome) throw new Error('Use only the already installed approved Chrome shell');
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.native-owner.private-capture.v1', startedAt: new Date().toISOString(),
  hostReceiptSha256: hash(receiptBytes), synthetic: true, modelAdmission: false, publicAdmission: false,
  errors: [], requests: [], deniedRequests: [], placements: [], samples: [], checks: {},
  clocks: 'Trace frame is completed draws before Game increments after composer.render, not the owning fixed tick; nativeClock is authoritative.',
  limitations: 'Synthetic tetrahedron cannot establish surface coverage/contact quality. Non-art time/entry witness cannot establish animation quality. Cloud browser is not phone performance.' };
const save = () => writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost'), path = resolve(dist, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${dist}${sep}`)) { response.writeHead(403).end(); return; }
  try { response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream'); response.end(readFileSync(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(_resolve => { server.listen(0, '127.0.0.1', _resolve); });
const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Missing private server address');
const origin = `http://127.0.0.1:${address.port}`;
let browser, observedPage;
try {
  browser = await chromium.launch({ executablePath: chrome, headless: true,
    args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    serviceWorkers: 'block',
    recordVideo: { dir: join(out, 'video'), size: { width: 402, height: 874 } } });
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { report.deniedRequests.push(route.request().url()); await route.abort('blockedbyclient'); }
  });
  const page = await context.newPage(); observedPage = page; page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  page.on('request', request => { report.requests.push(request.url()); });
  const stores = () => page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])),
    saved: window.__practiceDemo ? JSON.parse(window.__practiceDemo.game.app.saves.exportAll()).docs : null }));
  const boot = async () => {
    await page.locator('#practice-start').tap();
    await page.waitForFunction(() => (window.__practiceDemo?.arena.entered === true) || (document.querySelector('#practice-start')?.disabled === false));
    if (!await page.evaluate(() => window.__practiceDemo?.arena.entered)) throw new Error(await page.locator('#practice-status').textContent() ?? 'Private boot failed');
    return page.evaluate(installNativeOwnerObservation);
  };
  const sample = async label => { const row = await page.evaluate(() => window.__nativeOwnerSample()); report.samples.push({ label, ...row }); save(); return row; };
  const phase = value => page.evaluate(name => { window.__nativeOwnerPhase = name; }, value);
  const capture = name => page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 82, scale: 'css' });
  const place = async distance => {
    report.placements.push(await page.evaluate(value => {
      const d = window.__practiceDemo, target = d.arena.activeTargets[0];
      if (!target) throw new Error('Missing target for logged player positioning');
      const before = { position: d.player.position.toArray(), yaw: d.player.yaw, pitch: d.player.pitch };
      d.player.spawn(target.position.x, target.position.z + value, 0, target.position.y); d.player.pitch = .03;
      return { reason: 'Explicit diagnostic PLAYER placement only', time: performance.now(), nativeTick: d.arena.opponent.native.host.clock.frame,
        before, after: { position: d.player.position.toArray(), yaw: d.player.yaw, pitch: d.player.pitch }, distance: value };
    }, distance)); save();
  };
  const preserve = async label => {
    const trace = await page.evaluate(() => window.__nativeOwnerTrace);
    const text = JSON.stringify(trace), name = `${label}-complete-trace.json`;
    writeFileSync(join(out, name), text);
    report[`${label}Trace`] = { file: name, bytes: Buffer.byteLength(text), sha256: hash(text),
      fixed: trace.fixed.length, rendered: trace.render.length, events: trace.events.length, lifecycle: trace.lifecycle.length, overflow: trace.overflow };
    return trace;
  };
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  report.storesBefore = await stores(); report.observer = await boot();
  await phase('living'); await place(5); await page.waitForTimeout(2500); await sample('living'); await capture('01-living');
  await phase('sword-kill');
  for (let press = 0; press < 30; press++) {
    const current = await sample(`sword-${press}`); if (!current.actor.alive || current.player.vitals.health === 0) break;
    await place(1.6); await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(750);
  }
  const killed = await sample('after-sword'); report.checks.swordKilled = !killed.actor.alive;
  if (!report.checks.swordKilled) throw new Error('Real sword inputs did not produce a lethal handoff');
  await phase('physical-collapse'); await capture('02-physical-collapse');
  await page.waitForFunction(() => window.__nativeOwnerSample().owner?.resource === 'frozen', null, { timeout: 60000 });
  await place(1.2); await page.waitForTimeout(2500);
  const frozen = await sample('frozen-with-loot'); await capture('03-frozen');
  report.checks.corpseFrozen = frozen.pose.physical.frozen && frozen.actor.motor === null;
  report.checks.localLoot = frozen.loot.complete && frozen.loot.coins > 0;
  await phase('retry-after-corpse'); await page.locator('#practice-retry').tap();
  await page.waitForTimeout(250); const retry = await sample('fresh-retry'); await capture('04-retry');
  report.checks.freshRetry = retry.actor.alive && retry.owner.lease === 'reserved' && retry.actor.hp > 0;
  await phase('player-defeat'); await place(1.6);
  await page.waitForFunction(() => window.__practiceDemo.arena.playerVitals.health === 0, null, { timeout: 120000 });
  await sample('player-defeated'); await capture('05-player-defeated');
  report.checks.playerDefeated = true;
  await phase('retry-after-defeat'); await page.locator('#practice-retry').tap(); await page.waitForTimeout(250);
  const retryDefeat = await sample('retry-after-defeat'); report.checks.defeatRetry = retryDefeat.player.vitals.health === retryDefeat.player.vitals.maxHealth;
  await phase('reselection');
  const attachedBefore = await page.evaluate(() => window.__nativeOwnerTrace.lifecycle.filter(row => row.event === 'attached').length);
  await page.locator('#practice-opponent').selectOption('conch-duelist:conch-duelist');
  await page.waitForFunction(before => window.__nativeOwnerTrace.lifecycle.filter(row => row.event === 'attached').length > before, attachedBefore);
  const reselected = await sample('fresh-reselection'); report.checks.reselectionFresh = reselected.actor.alive && reselected.owner.lease === 'reserved';
  report.storesAfterCycle = await stores(); report.faults = await page.evaluate(() => window.__nativeOwnerFaults);
  report.checks.noSystemFaults = report.faults.length === 0; const cycle = await preserve('cycle');
  report.checks.actualEnemyReceipts = cycle.events.some(row => row.event === 'damage.dealt' && row.target === 'enemy' && row.killed);
  report.checks.actualPlayerReceipts = cycle.events.some(row => row.event === 'damage.dealt' && row.target === 'player');
  report.checks.retryClockReset = cycle.lifecycle.filter(row => row.event === 'attached').slice(1, 3).length === 2
    && cycle.lifecycle.filter(row => row.event === 'attached').slice(1, 3).every(row => row.nativeClock.frame === 0);
  report.checks.disposedPriorOwners = cycle.lifecycle.filter(row => row.event === 'dispose-after').length >= 3
    && cycle.lifecycle.filter(row => row.event === 'dispose-after').every(row => row.scopeClosed && row.owner.lease === 'released');
  await page.reload({ waitUntil: 'domcontentloaded' }); report.storesAfterReloadBeforeStart = await stores();
  report.reloadObserver = await boot(); await page.waitForTimeout(250); const reloaded = await sample('fresh-reload'); await capture('06-reloaded');
  report.checks.reloadFresh = reloaded.actor.alive && reloaded.owner.lease === 'reserved' && reloaded.loot.coins === 0;
  report.storesAfterReload = await stores(); const reload = await preserve('reload');
  report.reloadFaults = await page.evaluate(() => window.__nativeOwnerFaults);
  report.checks.noSystemFaults &&= report.reloadFaults.length === 0;
  const empty = value => value !== null && typeof value === 'object' && Object.keys(value).length === 0;
  report.checks.emptyPersistence = [report.storesBefore, report.storesAfterCycle, report.storesAfterReloadBeforeStart, report.storesAfterReload]
    .every(row => empty(row.local) && empty(row.session) && (row.saved === null || empty(row.saved)));
  report.checks.noObserverOverflow = !cycle.overflow && !reload.overflow;
  report.checks.noObserverErrors = cycle.errors.length === 0 && reload.errors.length === 0;
  report.checks.onlyOwnedLocalRequests = report.deniedRequests.length === 0 && report.requests.every(url => new URL(url).origin === origin);
  await context.close();
  if (report.errors.length > 0 || Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
} catch (error) { report.fatal = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
finally {
  if (report.fatal !== undefined && observedPage !== undefined && !observedPage.isClosed()) {
    try {
      const trace = await observedPage.evaluate(() => window.__nativeOwnerTrace ?? null), text = JSON.stringify(trace);
      writeFileSync(join(out, 'failure-complete-trace.json'), text);
      report.failureTrace = { bytes: Buffer.byteLength(text), sha256: hash(text) };
      report.failureFaults = await observedPage.evaluate(() => window.__nativeOwnerFaults ?? []);
      await observedPage.screenshot({ path: join(out, 'failure.jpg'), type: 'jpeg', quality: 82, scale: 'css' });
    } catch (error) { report.preservationError = error instanceof Error ? error.message : String(error); }
  }
  await browser?.close(); await new Promise(_resolve => { server.close(_resolve); }); report.finishedAt = new Date().toISOString(); save();
}
