/** Real pre-contact portrait captures. Run through browser-lane.sh against a pinned serve-build preview.
 * Diagnostic player poses are recorded; scene, materials, HUD and creature state are not overridden. */
import { chromium, devices } from 'playwright';
import { developerSettings, harnessPins } from './debug-settings.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.env.PRACTICE_QA_OUT ?? 'tmp/practice-portraits';
mkdirSync(out, { recursive: true });
const report = { source: process.env.CAPTURE_SOURCE, startedAt: new Date().toISOString(), captures: [], errors: [], visualStatus: 'Owner-rejected mechanics fixtures; no visual acceptance' };
const save = () => writeFileSync(`${out}/portraits-report.json`, JSON.stringify(report, null, 2));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 });
  await developerSettings(context, {}); await harnessPins(context, {});
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(`${process.env.PRACTICE_QA_URL ?? 'http://127.0.0.1:4455/'}?chunk=driftwood-isle&explore=hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world !== undefined, undefined, { timeout: 240000 });
  for (const [kind, variant, distance] of [['tideRootColossus', 'tide-root-colossus', 10], ['conch-duelist', 'conch-duelist', 5]]) {
    console.log(new Date().toISOString(), `portrait:${kind}`);
    if (!await page.locator('.ws-practice-picker').evaluate(el => el.open)) await page.locator('.ws-practice-picker summary').tap();
    await page.locator('.ws-practice-picker select').selectOption(`${kind}:${variant}`);
    await page.waitForFunction(() => document.querySelector('.ws-practice-picker p')?.textContent.includes('One opponent ready'));
    await page.locator('.ws-practice-picker summary').tap();
    await page.locator('.ws-x-card[data-m="practice"]').tap();
    await page.waitForFunction(() => window.__wildshard.world.arena.entered && window.__wildshard.world.arena.activeTargets.length === 1);
    const diagnosticPose = await page.evaluate(async spacing => {
      const p = window.__wildshard, a = p.world.arena.activeTargets[0];
      const pose = { x: a.position.x, y: 900, z: a.position.z + spacing, yaw: 0, pitch: 0 };
      await p.pose(pose); return pose;
    }, distance);
    await page.waitForTimeout(600);
    const sample = () => page.evaluate(() => {
      const p = window.__wildshard, a = p.world.arena.activeTargets[0];
      return { state: p.state().appState, player: p.state().player, opponent: { kind: a.kind, hp: a.hp, position: a.position.toArray(), state: a.state, flash: a.flash },
        materials: (Array.isArray(a.mesh.material) ? a.mesh.material : [a.mesh.material]).map(m => ({ color: m.color?.toArray(), emissive: m.emissive?.toArray() })),
        targets: p.world.arena.activeTargets.length, dummies: p.world.arena.targets.map(t => t.model.root.visible) };
    });
    const row = { kind, diagnosticPose, before: await sample() }; report.captures.push(row); save();
    await page.screenshot({ path: `${out}/portrait-${kind}.jpg`, type: 'jpeg', quality: 86, scale: 'css' });
    row.after = await sample(); save();
    if (!await page.evaluate(() => window.__wildshard.world.hud.paused)) await page.keyboard.press('Escape');
    await page.locator('.ws-gmenu-exit').tap();
    await page.waitForFunction(() => !window.__wildshard.world.arena.entered);
  }
  if (report.errors.length > 0) process.exitCode = 1;
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser.close(); report.endedAt = new Date().toISOString(); save(); }
