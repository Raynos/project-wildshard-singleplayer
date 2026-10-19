/** Actual Conch-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.CONCH_QA_OUT ?? 'tmp/conch-counter-qa';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.conch.counter-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.CONCH_QA_DIST ?? 'tmp/conch-grounded-preview-dist');
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4468, '127.0.0.1', resolve); });
let browser = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.CONCH_QA_URL ?? 'http://127.0.0.1:4468/', { waitUntil: 'domcontentloaded' });
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
  const place = async (placementDistance, placementAngle = 0, placementPitch = .08) => {
    report.placements.push(await page.evaluate(({ distance, angle, pitch }) => {
      const d = window.__practiceDemo, a = d.arena.activeTargets[0];
      d.player.spawn(a.position.x + Math.sin(angle) * distance, a.position.z + Math.cos(angle) * distance, angle, a.position.y);
      d.player.pitch = pitch;
      return { reason: 'Diagnostic player/camera placement; aim also follows the enemy during defense; no enemy/health/time edits', distance, angle, pitch, position: d.player.position.toArray() };
    }, { distance: placementDistance, angle: placementAngle, pitch: placementPitch }));
  };
  const aim = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    const dx = d.player.position.x - a.position.x, dz = d.player.position.z - a.position.z;
    d.player.yaw = Math.atan2(dx, dz); d.player.pitch = Math.atan2(.4, Math.hypot(dx, dz));
  });
  const capture = async name => {
    const envelope = await page.evaluate(() => { const a = window.__practiceDemo.arena.activeTargets[0]; if (!a) return null; const point = a.position.clone(); let minY = Infinity, maxY = -Infinity, count = 0; a.mesh.updateMatrixWorld(true); a.mesh.traverse(mesh => { if (!mesh.isSkinnedMesh) return; mesh.skeleton.update(); const positions = mesh.geometry.getAttribute('position'); for (let i = 0; i < positions.count; i++) { mesh.getVertexPosition(i, point); mesh.localToWorld(point); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); count++; } }); return { minY, maxY, count, root: a.mesh.position.toArray(), body: a.bones.body.getWorldPosition(a.position.clone()).toArray(), alive: a.alive, deathT: a.deathT, scale: a.scale, floor: 900 }; });
    report.samples.push({ phase: 'world-envelope', capture: name, envelope }); save();
    await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85, scale: 'css' }); };
  report.entry = await sample(); await capture('entry');
  await page.evaluate(() => {
    window.__counterFrames = [];
    let last = -1;
    const record = () => {
      const d = window.__practiceDemo, a = d.arena.activeTargets[0];
      if (d.game.frameTime !== last) {
        last = d.game.frameTime;
        window.__counterFrames.push({time:last, enemyHp:a?.hp, playerHp:d.arena.playerVitals.health, mem:{...a?.mem}});
      }
      window.__counterRecord = requestAnimationFrame(record);
    };
    window.__counterRecord = requestAnimationFrame(record);
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('#practice-retry').tap(); await page.waitForTimeout(300);
    await place(2.1); await aim();
    await page.waitForFunction(() => {
      const a = window.__practiceDemo.arena.activeTargets[0];
      return a?.mem['conch-st'] === 1 && a?.mem['regular-clock'] < .25;
    }, null, {timeout:30000});
    report.samples.push({phase:'before-guard-hit', ...await sample()});
    await page.locator('.ws-touch-attack').tap();
    await page.waitForTimeout(4500);
    const frames = await page.evaluate(() => window.__counterFrames);
    report.samples.push({phase:'after-guard-hit', ...await sample()});
    save();
    if (frames.some(row => row.mem['conch-st'] === 3)) break;
  }
  report.renderFrames = await page.evaluate(() => {cancelAnimationFrame(window.__counterRecord); return window.__counterFrames;});
  report.checks.guard = report.renderFrames.some(row => row.mem['conch-guard'] === 1);
  report.checks.counterPending = report.renderFrames.some(row => row.mem['conch-st'] === 4);
  report.checks.counter = report.renderFrames.some(row => row.mem['conch-st'] === 3);
  report.stateAfter = await stateStore(); report.storageAfter = await storage();
  report.checks.persistenceUnchanged = JSON.stringify(report.stateAfter) === JSON.stringify(report.stateBeforeCombat) && JSON.stringify(report.storageAfter) === JSON.stringify(report.storageBefore);
  await capture('counter-result');
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await page.waitForTimeout(1500);
  await context.close();
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
