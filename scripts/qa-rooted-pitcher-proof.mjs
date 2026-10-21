/** ISOLATED complete-cycle engineering capture. Run through browser-lane.sh against the exact built fixture. */
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, extname, sep } from 'node:path';
import { ROOT, OUTPUT, PIN, hash, inventory, verifyPin } from './rooted-pitcher-proof-pin.mjs';
import { installNativeOwnerObservation } from './qa-native-owner-observation.mjs';
import { nativeOwnerPersistenceEmpty } from './native-owner-proof-persistence.ts';

const pin = verifyPin();
if (pin.browserAllowed !== true) throw new Error('Root browser GO required');
const dist = resolve(ROOT, OUTPUT, 'dist'), out = resolve(ROOT, OUTPUT, 'capture');
if (existsSync(out)) throw new Error('Preserve the prior complete capture');
const receiptBytes = readFileSync(join(dist, 'rooted-pitcher-proof.json')), receipt = JSON.parse(receiptBytes);
const actual = inventory(dist); delete actual['rooted-pitcher-proof.json'];
if (receipt.schema !== 'wildshard.rooted-pitcher.isolated-host.v1' || receipt.synthetic !== false
  || receipt.modelAdmission !== false || receipt.publicAdmission !== false || receipt.pinSha256 !== hash(readFileSync(resolve(ROOT, PIN)))
  || JSON.stringify(receipt.pin) !== JSON.stringify(pin) || JSON.stringify(receipt.hostFiles) !== JSON.stringify(actual))
  throw new Error('Isolated built bytes do not match reviewed identity');
const chrome = resolve(ROOT, 'tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell');
if (process.env.CHROME_PATH !== chrome) throw new Error('Use only the already installed approved Chrome shell');
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.rooted-pitcher.isolated-capture.v1', startedAt: new Date().toISOString(),
  hostReceiptSha256: hash(receiptBytes), synthetic: false, modelAdmission: false, publicAdmission: false,
  errors: [], requests: [], deniedRequests: [], placements: [], samples: [], checks: {},
  clocks: 'Trace frame is completed draws before Game increments after composer.render, not the owning fixed tick; nativeClock is authoritative.',
  limitations: 'WIP ROOTED PITCHER; HELD DEATH/NO FOLD; NOT YET ADMITTED. Real retained seven-bone pack. Cloud browser is not phone performance. Logged diagnostic player positioning is not a player-only navigation proof.' };
const save = () => writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost'), path = resolve(dist, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${dist}${sep}`)) { response.writeHead(403).end(); return; }
  try { response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream'); response.end(readFileSync(path)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(_resolve => { server.listen(0, '127.0.0.1', _resolve); });
const address = server.address(); if (address === null || typeof address === 'string') throw new Error('Missing isolated server address');
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
    if (!await page.evaluate(() => window.__practiceDemo?.arena.entered)) throw new Error(await page.locator('#practice-status').textContent() ?? 'Isolated boot failed');
    return page.evaluate(installNativeOwnerObservation, { synthetic: false, clockOverlay: true });
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
  report.videoAnchor = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, performanceNow: performance.now(), wallDateNow: Date.now() }));
  report.videoSampling = 'Browser recording cadence is measured by ffprobe. Correlate decoded frame overlay PERF/BOUT/NATIVE with complete render trace rows. Overlay changes only DOM after the actual draw. Recorder may repeat or omit draws. Wall anchors and container start_time do not establish exact PTS-to-native-tick mapping.';
  report.storesBefore = await stores(); report.observer = await boot();
  await phase('living'); await place(5); await page.waitForTimeout(2500); await sample('living'); await capture('01-living');
  const beforeControls = await sample('before-real-controls');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  const afterControls = await sample('after-real-controls');
  report.checks.realMovement = Math.hypot(...afterControls.player.position.map((v, i) => v - beforeControls.player.position[i])) > .1;

  await phase('sword-kill');
  for (let press = 0; press < 60; press++) {
    const current = await sample(`sword-${press}`); if (!current.actor.alive || current.player.vitals.health === 0) break;
    await place(2.2); await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(750);
  }
  const killed = await sample('after-sword'); report.checks.swordKilled = !killed.actor.alive;
  if (!report.checks.swordKilled) throw new Error('Real sword inputs did not produce a lethal handoff');
  await phase('held-death'); await capture('02-held-death');
  await page.waitForFunction(() => window.__nativeOwnerSample().owner?.resource === 'frozen', null, { timeout: 60000 });
  await place(1.2); await page.waitForTimeout(2500);
  const frozen = await sample('frozen-with-loot'); await capture('03-frozen');
  report.checks.corpseFrozen = frozen.pose.physical.frozen && frozen.actor.motor === null;
  report.checks.localLoot = frozen.loot.complete && frozen.loot.coins > 0;
  await page.waitForTimeout(1500);
  const held = await sample('held-death-still-solid');
  report.checks.heldDeathUnchanged = JSON.stringify(held.view) === JSON.stringify(frozen.view);
  report.checks.exactSevenBoneFixedBody = await page.evaluate(() => {
    const resource = window.__practiceDemo.arena.opponent.native.corpse.resource;
    return resource.body.isFixed() && resource.body.numColliders() === 7 && resource.body.isEnabled();
  });
  await phase('retry-after-corpse'); await page.locator('#practice-retry').tap();
  await page.waitForTimeout(250); const retry = await sample('fresh-retry'); await capture('04-retry');
  report.checks.freshRetry = retry.actor.alive && retry.owner.lease === 'reserved' && retry.actor.hp > 0;
  await phase('player-defeat'); await place(1.6);
  await page.waitForFunction(() => window.__practiceDemo.arena.playerVitals.health === 0, null, { timeout: 120000 });
  await sample('player-defeated'); await capture('05-player-defeated');
  report.checks.playerDefeated = true;
  await phase('retry-after-defeat'); await page.locator('#practice-retry').tap(); await page.waitForTimeout(250);
  const retryDefeat = await sample('retry-after-defeat'); report.checks.defeatRetry = retryDefeat.player.vitals.health === retryDefeat.player.vitals.maxHealth;
  report.storesAfterCycle = await stores(); report.faults = await page.evaluate(() => window.__rootedPitcherFaults);
  report.checks.noSystemFaults = report.faults.length === 0; const cycle = await preserve('cycle');
  report.checks.actualEnemyReceipts = cycle.events.some(row => row.event === 'damage.dealt' && row.target === 'enemy' && row.killed);
  const strikes = cycle.fixed.map(row => typeof row.control === 'string' ? JSON.parse(row.control).strikes : null);
  report.checks.bothRealStrikes = ['strike.pitcher.crown', 'strike.pitcher.bilateral'].every(id => strikes.some(row => row?.currentId === id && row.phase === 'active'));
  report.checks.actualPlayerReceipts = cycle.events.some(row => row.event === 'damage.dealt' && row.target === 'player');
  report.checks.retryClockReset = cycle.lifecycle.filter(row => row.event === 'attached').slice(1, 3).length === 2
    && cycle.lifecycle.filter(row => row.event === 'attached').slice(1, 3).every(row => row.nativeClock.frame === 0);
  report.checks.disposedPriorOwners = cycle.lifecycle.filter(row => row.event === 'dispose-after').length >= 2
    && cycle.lifecycle.filter(row => row.event === 'dispose-after').every(row => row.scopeClosed && row.owner.lease === 'released');
  const closingFaults = await page.evaluateHandle(() => window.__rootedPitcherFaults);
  await page.locator('#practice-back').tap();
  await page.waitForFunction(() => !window.__practiceDemo);
  const backDisposal = await preserve('back-disposal');
  report.backDisposalFaults = await closingFaults.jsonValue(); await closingFaults.dispose();
  report.checks.noSystemFaults &&= report.backDisposalFaults.length === 0;
  const finalDisposal = backDisposal.lifecycle.findLast(row => row.event === 'dispose-after');
  report.checks.backDisposed = await page.locator('#practice-start').isVisible()
    && backDisposal.lifecycle.filter(row => row.event === 'dispose-after').length >= 3
    && finalDisposal?.outcome === 'returned' && finalDisposal.scopeClosed && finalDisposal.owner.lease === 'released';
  report.backObserver = await boot();
  const restarted = await sample('fresh-back-start');
  report.checks.backFresh = restarted.actor.alive && restarted.owner.lease === 'reserved' && restarted.loot.coins === 0;
  await capture('06-back-start'); const backStart = await preserve('back-start');
  report.backFaults = await page.evaluate(() => window.__rootedPitcherFaults);
  report.checks.noSystemFaults &&= report.backFaults.length === 0;
  await page.reload({ waitUntil: 'domcontentloaded' }); report.storesAfterReloadBeforeStart = await stores();
  report.reloadObserver = await boot(); await page.waitForTimeout(250); const reloaded = await sample('fresh-reload'); await capture('06-reloaded');
  report.checks.reloadFresh = reloaded.actor.alive && reloaded.owner.lease === 'reserved' && reloaded.loot.coins === 0;
  report.storesAfterReload = await stores(); const reload = await preserve('reload');
  report.reloadFaults = await page.evaluate(() => window.__rootedPitcherFaults);
  report.checks.noSystemFaults &&= report.reloadFaults.length === 0;
  report.checks.emptyPersistence = nativeOwnerPersistenceEmpty(report.storesBefore, 'preboot')
    && nativeOwnerPersistenceEmpty(report.storesAfterCycle, 'running')
    && nativeOwnerPersistenceEmpty(report.storesAfterReloadBeforeStart, 'preboot')
    && nativeOwnerPersistenceEmpty(report.storesAfterReload, 'running');
  report.checks.noObserverOverflow = [cycle, backDisposal, backStart, reload].every(trace => !trace.overflow);
  report.checks.noObserverErrors = [cycle, backDisposal, backStart, reload].every(trace => trace.errors.length === 0);
  report.checks.onlyOwnedLocalRequests = report.deniedRequests.length === 0 && report.requests.every(url => new URL(url).origin === origin);
  const video = page.video();
  await context.close();
  if (video === null) throw new Error('Missing recorded video');
  const videoPath = await video.path();
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration,start_time:format=duration,start_time',
    '-of', 'json', videoPath], { encoding: 'utf8' }));
  const stream = probe.streams?.[0], duration = Number(probe.format?.duration ?? stream?.duration);
  report.videoReceipt = { file: videoPath.slice(out.length + 1), sha256: hash(readFileSync(videoPath)),
    bytes: readFileSync(videoPath).byteLength, probe, frameCount: Number(stream?.nb_read_frames), duration,
    measuredAverageFps: Number(stream?.nb_read_frames) / duration };
  report.checks.recordedVideo = Number.isFinite(duration) && duration > 0 && report.videoReceipt.frameCount > 0
    && stream?.width === 402 && stream?.height === 874;
  if (report.errors.length > 0 || Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
} catch (error) { report.fatal = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
finally {
  if (report.fatal !== undefined && observedPage !== undefined && !observedPage.isClosed()) {
    try {
      const trace = await observedPage.evaluate(() => window.__nativeOwnerTrace ?? null), text = JSON.stringify(trace);
      writeFileSync(join(out, 'failure-complete-trace.json'), text);
      report.failureTrace = { bytes: Buffer.byteLength(text), sha256: hash(text) };
      report.failureFaults = await observedPage.evaluate(() => window.__rootedPitcherFaults ?? []);
      await observedPage.screenshot({ path: join(out, 'failure.jpg'), type: 'jpeg', quality: 82, scale: 'css' });
    } catch (error) { report.preservationError = error instanceof Error ? error.message : String(error); }
  }
  await browser?.close(); await new Promise(_resolve => { server.close(_resolve); }); report.finishedAt = new Date().toISOString(); save();
}
