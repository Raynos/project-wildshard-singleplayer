/** Observe actual Puffer damage/defeat against an idle player; never mutate health, AI or simulation time. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.env.PRACTICE_QA_OUT ?? 'tmp/practice-puffer-defense';
mkdirSync(out, { recursive: true });
const report = { source: process.env.CAPTURE_SOURCE, runnerSha256: process.env.CAPTURE_QA_SHA,
  startedAt: new Date().toISOString(), samples: [], errors: [], visualStatus: 'Rejected mechanics fixture' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.PRACTICE_QA_URL ?? 'http://127.0.0.1:4455/practice/', { waitUntil: 'domcontentloaded' });
  const storage = () => page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])) }));
  report.storageBefore = await storage();
  await page.locator('#practice-start').tap();
  await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
  const sample = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    return { time: d.game.frameTime, state: d.game.app.state, targets: d.arena.activeTargets.length,
      enemy: { kind: a?.kind, hp: a?.hp, state: a?.state, position: a?.position.toArray() },
      player: { health: d.arena.playerVitals, position: d.player.position.toArray(), carried: d.player.carried },
      status: document.querySelector('#practice-status')?.textContent };
  });
  report.before = await sample();
  report.diagnosticPose = await page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    d.player.spawn(a.position.x, a.position.z + 1.6, 0, a.position.y); d.player.pitch = -0.08;
    return { position: d.player.position.toArray(), yaw: d.player.yaw, pitch: d.player.pitch };
  });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const row = await sample(); report.samples.push(row); save();
    if (row.player.health.health <= 0 || row.time - report.before.time >= 65) break;
  }
  report.after = await sample(); report.defeated = report.after.player.health.health === 0;
  await page.screenshot({ path: `${out}/puffer-defense.jpg`, type: 'jpeg', quality: 82, scale: 'css' });
  if (report.defeated) {
    await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(600);
    report.afterDefeatedAttack = await sample();
    await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  }
  report.storageAfter = await storage(); report.storageUnchanged = JSON.stringify(report.storageBefore) === JSON.stringify(report.storageAfter);
  if (!report.defeated || !report.storageUnchanged || report.errors.length > 0 ||
      report.retry?.player.health.health !== 100 || report.retry?.enemy.hp !== 45 ||
      report.afterDefeatedAttack?.enemy.hp !== report.after.enemy.hp) process.exitCode = 1;
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser.close(); report.endedAt = new Date().toISOString(); save(); }
