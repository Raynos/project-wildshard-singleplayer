/** Actual Mantis-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.MANTIS_QA_OUT ?? 'tmp/mantis-phase-idle-qa';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.mantis.combat-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.MANTIS_QA_DIST ?? 'tmp/mantis-phase-preview-dist');
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4467, '127.0.0.1', resolve); });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.MANTIS_QA_URL ?? 'http://127.0.0.1:4467/', { waitUntil: 'domcontentloaded' });
  const storage = () => page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])) }));
  report.storageBefore = await storage();
  await page.locator('#practice-start').tap();
  await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true || !document.querySelector('#practice-start')?.disabled);
  if (!await page.evaluate(() => window.__practiceDemo?.arena.entered === true)) throw new Error(await page.locator('#practice-status').textContent() ?? 'Boot failed');
  const stateStore = () => page.evaluate(() => {
    const saves = window.__practiceDemo.game.app.saves;
    return { docs: JSON.parse(saves.exportAll()).docs,
      shard: saves.inspectShard({ id: 'driftwood-isle' }),
      generation: saves.inspectShardGeneration({ id: 'driftwood-isle' }) };
  });
  report.stateBeforeCombat = await stateStore();
  report.diagnostic = await page.evaluate(() => {
    const d = window.__practiceDemo, g = d.game, a = d.arena.activeTargets[0];
    g.hold = true; g.viewmodel.visible = false;
    const mem = { ...a.mem, 'mantis-st': 0, 'mantis-pose-phase': 0, 'mantis-pose-clock': 0 };
    window.__mantisIdle = { started: performance.now(), trace: [], context: {
      bones: a.bones, dims: a.dims, dt: 0, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0,
      state: 'idle', alive: true, deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: a.position.clone(), lookWeight: 0,
      position: a.position, yaw: a.yaw, mem, animal: { mem, position: a.position, yOffset: 0 } } };
    const label = document.createElement('div'); label.id = 'idle-diagnostic';
    label.style.cssText = 'position:fixed;top:220px;left:8px;right:8px;color:white;background:#000d;z-index:99999;padding:8px;font:12px monospace';
    document.body.append(label);
    return { scope: 'Explicit idle pose diagnostic, not AI gameplay. Simulation held; copied pose context advances by wall clock. Exact loaded native geometry and authored pose function.', period: 2 * Math.PI / 1.8 };
  });
  let elapsed = 0;
  while (elapsed < 7.2) {
    elapsed = await page.evaluate(() => {
      const d = window.__practiceDemo, g = d.game, a = d.arena.activeTargets[0], s = window.__mantisIdle;
      const t = (performance.now() - s.started) / 1000;
      s.context.dt = t - s.context.t; s.context.t = t;
      a.model.species.animate(s.context); a.mesh.updateMatrixWorld(true);
      g.camera.position.set(a.position.x + 4, a.position.y + 3, a.position.z + 6);
      g.camera.lookAt(a.position.x, a.position.y + 1.8, a.position.z); g.camera.updateMatrixWorld(true);
      document.querySelector('#idle-diagnostic').textContent = `POSE DIAGNOSTIC ONLY · idle t=${t.toFixed(3)}s · simulation held`;
      g.composer.render(0);
      s.trace.push({ frame: s.trace.length, gameTime: g.frameTime, wallTime: performance.now(), poseTime: t, alive: true, stage: 0, hp: a.hp,
        world: a.mesh.matrixWorld.toArray(), bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, [...bone.position, ...bone.quaternion]])) });
      return t;
    });
    await page.waitForTimeout(80);
  }
  await page.screenshot({ path: `${out}/idle-diagnostic.jpg`, type: 'jpeg', quality: 85, scale: 'css' });
  await page.waitForTimeout(5000);
  writeFileSync(`${out}/render-trace.json`, JSON.stringify(await page.evaluate(() => window.__mantisIdle.trace)));
  report.stateAfterDiagnostic = await stateStore(); report.storageAfterDiagnostic = await storage();
  report.checks.emptyUnchangedStateStore = JSON.stringify(report.stateBeforeCombat) === JSON.stringify(report.stateAfterDiagnostic);
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await context.close();
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
