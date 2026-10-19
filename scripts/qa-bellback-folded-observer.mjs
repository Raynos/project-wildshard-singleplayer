/** Actual Bellback-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.BELLBACK_QA_OUT ?? 'tmp/bellback-folded-qa-build1';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.bellback.folded-observer.v2', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.BELLBACK_QA_DIST ?? 'tmp/bellback-folded-preview-dist-build1');
const baseline = JSON.parse(readFileSync('tmp/bellback-folded-preview/motion2-build1/preview.json'));
if (!process.env.CAPTURE_SOURCE || baseline.sourceHash !== process.env.CAPTURE_SOURCE) throw new Error('Fresh candidate source hash mismatch');
report.baseline = { sourceHash: baseline.sourceHash, host: 'fresh anatomy candidate2 host including early hit drain',
  previewSha256: createHash('sha256').update(readFileSync('tmp/bellback-folded-preview/motion2-build1/preview.json')).digest('hex') };
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4471, '127.0.0.1', resolve); });
let browser = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.BELLBACK_QA_URL ?? 'http://127.0.0.1:4471/', { waitUntil: 'domcontentloaded' });
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
  const capture = async name => {
    const envelope = await page.evaluate(() => { const a = window.__practiceDemo.arena.activeTargets[0]; if (!a) return null; const point = a.position.clone(); let minY = Infinity, maxY = -Infinity, count = 0; a.mesh.updateMatrixWorld(true); a.mesh.traverse(mesh => { if (!mesh.isSkinnedMesh) return; mesh.skeleton.update(); const positions = mesh.geometry.getAttribute('position'); for (let i = 0; i < positions.count; i++) { mesh.getVertexPosition(i, point); mesh.localToWorld(point); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); count++; } }); return { minY, maxY, count, root: a.mesh.position.toArray(), body: a.bones.body.getWorldPosition(a.position.clone()).toArray(), alive: a.alive, deathT: a.deathT, scale: a.scale, floor: 900 }; });
    report.samples.push({ phase: 'world-envelope', capture: name, envelope }); save();
    await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85, scale: 'css' }); };
  report.observerCamera = await page.evaluate(() => {
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
        stage: a.mem['tg-state'], clock: a.mem['tg-clock'], strike, speed: a.speed, gait: a.phase,
        flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
        ragdoll: a.ragdoll ? { build: a.ragdoll.build, state: a.ragdoll.state, bodies: a.ragdoll.bodies } : null,
        world: a.mesh.matrixWorld.toArray(),
        bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, [...bone.position, ...bone.quaternion]])) });
      label.textContent = `BELLBACK ANATOMY2 · LIVE AI / COMBAT · OBSERVER CAMERA · frame ${g.frameCount} · ${g.frameTime.toFixed(2)}s · ${strike.phase} · death ${a.deathT.toFixed(2)}`;
      try { return render(...args); }
      finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
    };
    return { scope: 'Camera temporarily offset during rendering and restored immediately. Full body capture; enemy/health/time unmodified. Fresh candidate2 includes PracticeCreature early hit drain; compare exact source pins.' };
  });
  report.entry = await sample(); save(); await capture('entry');
  report.checks.onlyBellback = report.entry.enemy.kind === 'bellback' && report.entry.targets === 1;
  await page.waitForTimeout(2000);
  const stages = new Set();
  // Normal sword inputs; repositioning stays explicit and does not bypass collision or damage admission.
  for (let attempt = 0; attempt < 24; attempt++) {
    const current = await sample(); if (!current.enemy.alive || current.player.health?.health === 0) break;
    await place(2.2, 0, .03); await page.locator('.ws-touch-attack').tap();
    for (let beat = 0; beat < 10; beat++) { await page.waitForTimeout(100); const row = await sample(); report.samples.push({ phase: 'sword', ...row }); stages.add(row.enemy.mem['tg-state']); save(); }
  }
  report.afterSword = await sample(); await capture('sword-result');
  report.checks.actualEnemyDamage = report.afterSword.enemy.hp < 180;
  report.checks.enemyDefeated = report.afterSword.enemy.alive === false;
  if (report.checks.enemyDefeated) {
    await place(1.4); const hp = report.afterSword.player.health?.health;
    const endDeath = Date.now() + 30000;
    while (Date.now() < endDeath) {
      await page.waitForTimeout(1000); const row = await sample(); report.samples.push({ phase: 'corpse-reward', ...row }); save();
      if (row.loot?.complete === true) break;
    }
    await place(6); await page.waitForTimeout(8000);
    report.corpse = await sample(); await capture('corpse-reward');
    report.checks.noPostDeathStrike = report.corpse.player.health?.health === hp;
    report.checks.boutLocalReward = report.corpse.loot?.scope === 'practice' && report.corpse.loot?.coins === 12 && report.corpse.loot?.complete === true;
  }
  report.storageAfterReward = await storage();
  report.stateAfterReward = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  report.checks.retry = report.retry.enemy.hp === 180 && report.retry.enemy.alive === true && report.retry.player.health?.health === 100
    && report.retry.loot?.coins === 0 && report.retry.loot?.complete === false;
  report.storageAfterRetry = await storage();
  report.stateAfterRetry = await stateStore();
  await capture('retry'); await page.waitForTimeout(4000);
  report.checks.emptyStorage = [report.storageBefore, report.storageAfterReward, report.storageAfterRetry]
    .every(row => Object.keys(row.local).length === 0 && Object.keys(row.session).length === 0);
  const states = [report.stateBeforeCombat, report.stateAfterReward, report.stateAfterRetry];
  report.checks.emptyUnchangedStateStore = states.every(row => JSON.stringify(row) === JSON.stringify(states[0])
    && Object.keys(row.shard).length === 0 && row.generation === 0
    && Object.values(row.docs).every(doc => Object.keys(doc.keys).length === 0));
  const trace = await page.evaluate(() => window.__bellbackRenderTrace);
  writeFileSync(`${out}/render-trace.json`, JSON.stringify(trace));
  report.traceSha256 = createHash('sha256').update(readFileSync(`${out}/render-trace.json`)).digest('hex');
  report.checks.allEightBonesPerFrame = trace.length > 0 && trace.every(row => Object.keys(row.bones).length === 8 && row.world.length === 16);
  report.checks.collapseAndSettle = trace.some(row => !row.alive && row.deathT < .95) && trace.some(row => !row.alive && row.ragdoll?.state === 'frozen');
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await context.close();
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
