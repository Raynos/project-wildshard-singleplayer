/** Actual isolated demo smoke. Run through browser-lane.sh against a pinned --practice-demo preview. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.env.PRACTICE_QA_OUT ?? 'tmp/practice-demo-qa';
mkdirSync(out, { recursive: true });
const report = { source: process.env.CAPTURE_SOURCE, runnerSha256: process.env.CAPTURE_QA_SHA, startedAt: new Date().toISOString(), encounters: [], errors: [], requests: [], visualStatus: 'Rejected mechanics fixtures' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  page.on('request', request => { report.requests.push(new URL(request.url()).pathname); });
  await page.goto(process.env.PRACTICE_QA_URL ?? 'http://127.0.0.1:4455/', { waitUntil: 'domcontentloaded' });
  report.storageBefore = await page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])), session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])) }));
  if (process.env.PRACTICE_QA_FAILURE === '1') {
    await page.route('**/blobs/wasm/*.wasm', route => route.abort('failed'));
    await page.locator('#practice-start').tap();
    await page.waitForFunction(() => !document.querySelector('#practice-start')?.disabled);
    report.firstFailurePage = await page.locator('#practice-status').textContent(); save();
    report.failedFirstLoad = await page.locator('#practice-status').textContent();
    await page.unroute('**/blobs/wasm/*.wasm');
  }
  await page.locator('#practice-start').tap();
  await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true || !document.querySelector('#practice-start')?.disabled);
  if (!await page.evaluate(() => window.__practiceDemo?.arena.entered === true)) throw new Error(await page.locator('#practice-status').textContent() ?? 'Arena did not enter');
  const sample = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    return { state: d.game.app.state, targets: d.arena.activeTargets.length, kind: a?.kind, hp: a?.hp,
      enemyState: a?.state, localHealth: d.arena.playerVitals, player: { position: d.player.position.toArray(), yaw: d.player.yaw, pitch: d.player.pitch },
      dummies: d.arena.targets.map(t => t.model.root.visible), status: document.querySelector('#practice-status')?.textContent };
  });
  const choices = await page.locator('#practice-opponent option').evaluateAll(options => options.map(option => ({ id: option.value, label: option.textContent })));
  const selected = process.env.PRACTICE_QA_ENEMY ?? 'brine-puffer';
  for (const choice of choices.filter(row => row.id.split(':')[0] === selected)) {
    await page.locator('#practice-opponent').selectOption(choice.id);
    await page.waitForFunction(id => window.__practiceDemo?.arena.entered && window.__practiceDemo.arena.activeTargets[0]?.kind === id.split(':')[0], choice.id);
    const row = { id: choice.id, before: await sample() }; report.encounters.push(row); save();
    await page.screenshot({ path: `${out}/${choice.id.split(':')[0]}-entry.jpg`, type: 'jpeg', quality: 82, scale: 'css' });
    row.diagnosticPose = await page.evaluate(() => {
      const d = window.__practiceDemo, a = d.arena.activeTargets[0];
      d.player.spawn(a.position.x, a.position.z + 1.6, 0, a.position.y); d.player.pitch = -0.08;
      return { position: d.player.position.toArray(), yaw: d.player.yaw, pitch: d.player.pitch };
    });
    for (let i = 0; i < 8; i++) { await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(650); }
    row.after = await sample();
    await page.locator('#practice-retry').tap(); await page.waitForTimeout(500); row.retry = await sample(); save();
  }
  report.storageAfter = await page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])), session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])) }));
  const mount = process.env.PRACTICE_QA_REQUIRE_MOUNT;
  report.assetPathsContained = mount === undefined || report.requests.every(path => path === '/' || path.startsWith(mount));
  report.storageUnchanged = JSON.stringify(report.storageBefore) === JSON.stringify(report.storageAfter);
  if (report.errors.length > 0 || !report.assetPathsContained || !report.storageUnchanged || report.encounters.some(row => row.before.targets !== 1 || row.before.dummies.some(Boolean))) process.exitCode = 1;
} catch (error) {
  report.fatal = error.message; process.exitCode = 1;
  const page = browser.contexts().at(0)?.pages().at(0);
  if (page !== undefined) {
    report.lastPage = await page.evaluate(() => ({ status: document.querySelector('#practice-status')?.textContent, start: document.querySelector('#practice-start')?.outerHTML, body: document.body.textContent }));
    await page.screenshot({ path: `${out}/failure.jpg`, type: 'jpeg', quality: 82, scale: 'css' });
  }
}
finally { await browser.close(); report.endedAt = new Date().toISOString(); save(); }
