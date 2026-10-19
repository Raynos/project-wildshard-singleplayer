/** Actual Bellback-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.BELLBACK_QA_OUT ?? 'tmp/bellback-anatomy3-natural-approach';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.bellback.natural-approach.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.BELLBACK_QA_DIST ?? 'tmp/bellback-tucked-preview-dist-build1');
const baseline = JSON.parse(readFileSync('tmp/bellback-tucked-preview/motion3-build1/preview.json'));
if (baseline.sourceHash !== process.env.CAPTURE_SOURCE) throw new Error('Product pin mismatch');
const buildFiles = JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3/build1/build-files.json'));
report.buildValidation = buildFiles.map(row => { const bytes = readFileSync(row.path); const actual = createHash('sha256').update(bytes).digest('hex'); if (actual !== row.sha256 || bytes.length !== row.bytes) throw new Error(`Build drift: ${row.path}`); return row; });
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4473, '127.0.0.1', resolve); });
let browser = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.BELLBACK_QA_URL ?? 'http://127.0.0.1:4473/', { waitUntil: 'domcontentloaded' });
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
  const sample = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    return { time: d.game.frameTime, state: d.game.app.state, targets: d.arena.activeTargets.length,
      enemy: { kind: a?.kind, hp: a?.hp, maxHp: a?.maxHp, alive: a?.alive, state: a?.state,
        mem: { ...a?.mem }, position: a?.position.toArray(), yaw: a?.yaw,
        bones: Object.fromEntries(Object.entries(a?.bones ?? {}).map(([name, bone]) => [name, { position: bone.position.toArray(), rotation: bone.rotation.toArray().slice(0, 3) }])) },
      player: { health: d.arena.playerVitals, position: d.player.position.toArray(), carried: d.player.carried },
      loot: d.arena.opponent?.loot?.receipt, status: document.querySelector('#practice-status')?.textContent };
  });
  const capture = async name => {
    const envelope = await page.evaluate(() => { const a = window.__practiceDemo.arena.activeTargets[0]; if (!a) return null; const point = a.position.clone(); let minY = Infinity, maxY = -Infinity, count = 0; a.mesh.updateMatrixWorld(true); a.mesh.traverse(mesh => { if (!mesh.isSkinnedMesh) return; mesh.skeleton.update(); const positions = mesh.geometry.getAttribute('position'); for (let i = 0; i < positions.count; i++) { mesh.getVertexPosition(i, point); mesh.localToWorld(point); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); count++; } }); return { minY, maxY, count, root: a.mesh.position.toArray(), body: a.bones.body.getWorldPosition(a.position.clone()).toArray(), alive: a.alive, deathT: a.deathT, scale: a.scale, floor: 900 }; });
    report.samples.push({ phase: 'world-envelope', capture: name, envelope }); save();
    await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85, scale: 'css' }); };
  const installObserver = () => page.evaluate(() => {
    const d = window.__practiceDemo, g = d.game, render = g.composer.render.bind(g.composer);
    window.__bellbackRenderTrace = [];
    g.viewmodel.visible = false;
    const label = document.createElement('div');
    label.style.cssText = 'position:fixed;top:200px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace';
    document.body.append(label);
    g.composer.render = (...args) => {
      const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
      const a = d.arena.activeTargets[0];
      if (!a) return render(...args);
      g.camera.position.set(a.position.x + 6, a.position.y + 4.5, a.position.z + 8);
      g.camera.lookAt(a.position.x, a.position.y + 1.6, a.position.z);
      g.camera.updateMatrixWorld(true); a.mesh.updateMatrixWorld(true);
      const strike = JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike;
      window.__bellbackRenderTrace.push({ frame: g.frameCount, gameTime: g.frameTime, wallTime: performance.now(),
        scenario: window.__combatScenario ?? 'entry', player: { health: d.arena.playerVitals.health, position: d.player.position.toArray() }, stage: a.mem['tg-state'], clock: a.mem['tg-clock'], strike, speed: a.speed, gait: a.phase,
        flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
        ragdoll: a.ragdoll ? { build: a.ragdoll.build, state: a.ragdoll.state, bodies: a.ragdoll.bodies } : null,
        world: a.mesh.matrixWorld.toArray(),
        bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, [...bone.position, ...bone.quaternion]])) });
      label.textContent = `BELLBACK ANATOMY3 · LIVE AI / COMBAT · OBSERVER CAMERA · frame ${g.frameCount} · ${g.frameTime.toFixed(2)}s · ${strike.phase} · death ${a.deathT.toFixed(2)}`;
      try { return render(...args); }
      finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
    };
    return { scope: 'Camera temporarily offset during rendering and restored immediately. Full body capture; enemy/health/time unmodified. Fresh candidate3 includes PracticeCreature early hit drain; compare exact source pins.' };
  });
  report.observerCamera = await installObserver();
  const scenario = scenarioName => page.evaluate(value => { window.__combatScenario = value; }, scenarioName);
  await scenario('natural-approach-stop-resume');
  report.entry = await sample(); await capture('entry');
  await page.keyboard.down('s'); await page.waitForTimeout(1200); await page.keyboard.up('s');
  await page.waitForFunction(() => window.__practiceDemo.arena.activeTargets[0].speed > .1);
  await page.waitForFunction(() => window.__practiceDemo.arena.activeTargets[0].mem['tg-state'] === 1, undefined, { timeout: 45000 });
  report.stopped = await sample(); await capture('attack-stop');
  await page.keyboard.down('s'); await page.waitForTimeout(2500); await page.keyboard.up('s');
  await page.waitForFunction(() => window.__practiceDemo.arena.activeTargets[0].speed > .1, undefined, { timeout: 45000 });
  await page.waitForTimeout(1200);
  report.resumed = await sample(); await capture('approach-resumed');
  const trace = await page.evaluate(() => window.__bellbackRenderTrace);
  writeFileSync(`${out}/render-trace.json`, JSON.stringify(trace));
  const moving = trace.findIndex(r => r.speed > .1);
  const stopped = trace.findIndex((r,i) => i > moving && r.speed < .01 && r.stage === 1);
  report.checks.approachStopResume = moving !== -1 && stopped > moving && trace.slice(stopped + 1).some(r => r.speed > .1);
  report.checks.playerMovedWithKeyboard = Math.hypot(...[0,2].map(i => report.resumed.player.position[i] - report.entry.player.position[i])) > 1;
  report.checks.noDiagnosticPlacements = report.placements.length === 0;
  report.checks.noEnemyDamage = report.resumed.enemy.hp === 180;
  report.checks.allEightBonesPerFrame = trace.every(r => Object.keys(r.bones).length === 8);
  report.checks.errors = report.errors.length === 0;
  report.storageAfter = await storage(); report.stateAfter = await stateStore();
  report.checks.emptyStores = JSON.stringify(report.storageAfter) === JSON.stringify(report.storageBefore) && JSON.stringify(report.stateAfter) === JSON.stringify(report.stateBeforeCombat);
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await context.close();
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
