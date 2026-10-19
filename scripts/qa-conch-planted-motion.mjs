/** Actual Conch-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.CONCH_QA_OUT ?? 'tmp/conch-motion-observer-motion3-build1';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.conch.fullbody-motion-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.CONCH_QA_DIST ?? 'tmp/conch-planted-preview-dist-build1');
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
let browser = null, observedPage = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); observedPage = page; page.setDefaultTimeout(120000);
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
      enemy: { kind: a?.kind, hp: a?.hp, maxHp: a?.maxHp, alive: a?.alive, state: a?.state, strike: a ? JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike : null,
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
  report.observerCamera = await page.evaluate(() => {
    const d = window.__practiceDemo, g = d.game, render = g.composer.render.bind(g.composer);
    window.__conchRenderTrace = []; window.__conchRuntimeGeometry = null;
    window.__conchPhase = 'entry';
    g.viewmodel.visible = false;
    const label = document.createElement('div');
    label.style.cssText = 'position:fixed;top:200px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace';
    document.body.append(label);
    g.composer.render = (...args) => {
      const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
      const a = d.arena.activeTargets[0];
      if (!a) return render(...args);
      g.camera.position.set(a.position.x + 4.4, a.position.y + 3.2, a.position.z + 6.4);
      g.camera.lookAt(a.position.x, a.position.y + 1.05, a.position.z);
      g.camera.updateMatrixWorld(true); a.mesh.updateMatrixWorld(true);
      const meshes = [];
      a.mesh.traverse(mesh => { if (mesh.isSkinnedMesh) { mesh.skeleton.update(); meshes.push(mesh); } });
      if (window.__conchRuntimeGeometry === null) window.__conchRuntimeGeometry = meshes.map(mesh => ({
        name: mesh.name, positions: Array.from(mesh.geometry.getAttribute('position').array),
        indices: Array.from(mesh.geometry.getAttribute('skinIndex').array), weights: Array.from(mesh.geometry.getAttribute('skinWeight').array),
        triangles: Array.from(mesh.geometry.index?.array ?? []),
        bones: mesh.skeleton.bones.map(b => b.name), inverses: mesh.skeleton.boneInverses.map(m => m.toArray()),
        bind: mesh.bindMatrix.toArray(), bindInverse: mesh.bindMatrixInverse.toArray()
      }));
      const strike = JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike;
      window.__conchRenderTrace.push({ frame: g.frameCount, gameTime: g.frameTime, wallTime: performance.now(),
        phase: window.__conchPhase, stage: a.mem['conch-st'], guard: a.mem['conch-guard'], clock: a.mem['regular-clock'],
        poseInput: { t: a.rigCtx.t, dt: a.rigCtx.dt, speed: a.rigCtx.speed, phase: a.rigCtx.phase, flinch: a.rigCtx.flinch, deathT: a.rigCtx.deathT, alive: a.rigCtx.alive, state: a.rigCtx.state },
        strike, speed: a.speed, gait: a.phase, flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
        playerHp: d.arena.playerVitals.health, world: a.mesh.matrixWorld.toArray(),
        bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, {
          local: [...bone.position, ...bone.quaternion, ...bone.scale], world: bone.matrixWorld.toArray() }])),
        meshes: meshes.map(mesh => ({ world: mesh.matrixWorld.toArray(), bindInverse: mesh.bindMatrixInverse.toArray(),
          boneWorld: mesh.skeleton.bones.map(b => b.matrixWorld.toArray()) })) });
      label.textContent = `CONCH MOTION3 · LIVE COMBAT · OBSERVER CAMERA · ${window.__conchPhase} · frame ${g.frameCount} · ${g.frameTime.toFixed(2)}s · ${strike.phase}`;
      try { return render(...args); }
      finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
    };
    return { scope: 'Render-only camera offset restored immediately; full 15-bone local/world transforms and exact runtime four-weight skin data. No health, AI, clock, or damage edits. Updated retained-dead and borrowed-subject host; poseInput records the rig context separately from actor observations.' };
  });
  const phase = name => page.evaluate(value => { window.__conchPhase = value; }, name);
  await phase('idle'); await place(14); await page.waitForTimeout(3500);
  await phase('approach'); await place(5); await page.waitForTimeout(3500);
  report.entry = await sample(); save(); await capture('entry');
  report.checks.onlyConch = report.entry.enemy.kind === 'conch-duelist' && report.entry.targets === 1;
  // Observe unchanged decision and both actual attack stages before player attacks.
  await phase('thrust-defense'); await place(2.1);
  const stages = new Set(), end = Date.now() + 100000;
  while (Date.now() < end) {
    await aim(); await page.waitForTimeout(500); const row = await sample(); report.samples.push({ phase: 'defense', ...row });
    stages.add(row.enemy.mem['conch-st']); save();
    if (stages.has(1) && row.player.health?.health < 100) break;
    if (row.player.health?.health === 0) break;
  }
  // Keep the full first recovery/rest rather than retrying on the active damage frame.
  await page.waitForFunction(() => window.__practiceDemo.arena.activeTargets[0]?.mem['conch-st'] === 2, null, { timeout: 15000 });
  await page.waitForTimeout(900);
  report.defense = await sample(); await capture('both-strikes-observation');
  report.checks.thrust = stages.has(1);
  report.checks.actualPlayerDamage = report.defense.player.health?.health < 100;
  report.storageAfterDefense = await storage();
  report.stateAfterDefense = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600);
  report.retryAfterDefense = await sample();
  // Genuine guarded sword collision triggers the queued counter, no state injection.
  await phase('guard-counter');
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.locator('#practice-retry').tap(); await page.waitForTimeout(300);
    await place(2.1); await aim();
    await page.waitForFunction(() => {
      const a = window.__practiceDemo.arena.activeTargets[0];
      return a?.mem['conch-st'] === 1 && a?.mem['regular-clock'] < .25;
    }, null, { timeout: 30000 });
    report.samples.push({ phase: 'before-guard-hit', ...await sample() });
    await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(4500);
    report.samples.push({ phase: 'after-guard-hit', ...await sample() }); save();
    if (await page.evaluate(() => window.__conchRenderTrace.some(row => row.stage === 3))) break;
  }
  await capture('guard-counter');
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600);
  await phase('sword-death');
  // Normal sword inputs; repositioning stays explicit and does not bypass collision or damage admission.
  for (let attempt = 0; attempt < 24; attempt++) {
    const current = await sample(); if (!current.enemy.alive || current.player.health?.health === 0) break;
    await place(2.2, 0, .03); await page.locator('.ws-touch-attack').tap();
    for (let beat = 0; beat < 10; beat++) { await page.waitForTimeout(100); const row = await sample(); report.samples.push({ phase: 'sword', ...row }); stages.add(row.enemy.mem['conch-st']); save(); }
  }
  report.checks.counter = stages.has(3);
  report.checks.guardObserved = report.samples.some(row => row.enemy?.mem?.['conch-guard'] === 1);
  report.afterSword = await sample(); await capture('sword-result');
  report.checks.actualEnemyDamage = report.afterSword.enemy.hp < 60;
  report.checks.enemyDefeated = report.afterSword.enemy.alive === false;
  if (report.checks.enemyDefeated) {
    await place(1.4);
    const endDeath = Date.now() + 30000;
    while (Date.now() < endDeath) {
      await page.waitForTimeout(1000); const row = await sample(); report.samples.push({ phase: 'corpse-reward', ...row }); save();
      if (row.loot?.complete === true) break;
    }
    await phase('corpse-settle'); await page.waitForTimeout(8000);
    report.corpse = await sample(); await capture('corpse-reward');
    report.checks.retainedOwnDeathDelivered = report.corpse.enemy.mem['conch-st'] === 5 && report.corpse.enemy.mem['conch-guard'] === 0 && report.corpse.enemy.strike.phase === 'idle';
    report.checks.boutLocalReward = report.corpse.loot?.scope === 'practice' && report.corpse.loot?.coins === 3 && report.corpse.loot?.complete === true;
  }
  report.storageAfterReward = await storage();
  report.stateAfterReward = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  report.checks.retry = report.retry.enemy.hp === 60 && report.retry.enemy.alive === true && report.retry.player.health?.health === 100
    && report.retry.loot?.coins === 0 && report.retry.loot?.complete === false;
  report.storageAfterRetry = await storage();
  report.stateAfterRetry = await stateStore();
  // A second fresh bout observes real enemy-caused player defeat, with no health or damage injection.
  await phase('player-defeat');
  const defeatDeadline = Date.now() + 180000;
  while (Date.now() < defeatDeadline) {
    const row = await sample(); if (row.player.health?.health === 0) break;
    await place(.85, 0, .15); await aim(); await page.waitForTimeout(1600);
    report.samples.push({ phase: 'player-defeat', ...await sample() }); save();
  }
  report.playerDefeat = await sample(); report.checks.playerDefeated = report.playerDefeat.player.health?.health === 0;
  await capture('player-defeat');
  if (report.checks.playerDefeated) {
    await page.waitForTimeout(2000);
    await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(600);
    report.afterDefeatedAttack = await sample();
    report.checks.defeatedAttackBlocked = report.afterDefeatedAttack.enemy.hp === report.playerDefeat.enemy.hp;
  }
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.finalRetry = await sample();
  report.checks.finalRetry = report.finalRetry.enemy.hp === 60 && report.finalRetry.player.health?.health === 100;
  report.storageAfterDefeatRetry = await storage();
  report.stateAfterDefeatRetry = await stateStore();
  report.checks.emptyStorage = [report.storageBefore, report.storageAfterDefense, report.storageAfterReward, report.storageAfterRetry, report.storageAfterDefeatRetry]
    .every(row => Object.keys(row.local).length === 0 && Object.keys(row.session).length === 0);
  const states = [report.stateBeforeCombat, report.stateAfterDefense, report.stateAfterReward, report.stateAfterRetry, report.stateAfterDefeatRetry];
  report.checks.emptyUnchangedStateStore = states.every(row => JSON.stringify(row) === JSON.stringify(states[0])
    && Object.keys(row.shard).length === 0 && row.generation === 0
    && Object.values(row.docs).every(doc => Object.keys(doc.keys).length === 0));
  const trace = await page.evaluate(() => window.__conchRenderTrace);
  writeFileSync(`${out}/render-trace.json`, JSON.stringify(trace));
  writeFileSync(`${out}/runtime-geometry.json`, JSON.stringify(await page.evaluate(() => window.__conchRuntimeGeometry)));
  report.checks.counter = trace.some(row => row.stage === 3);
  report.checks.counterPending = trace.some(row => row.stage === 4);
  report.checks.guardObserved = trace.some(row => row.guard === 1);
  const deadRows = trace.filter(row => !row.alive), settledRows = deadRows.filter(row => row.deathT >= 1);
  report.checks.noPostDeathStrike = deadRows.length > 0 && deadRows.every(row => row.strike.phase === 'idle') && deadRows.every((row,i) => i === 0 || row.playerHp >= deadRows[i-1].playerHp);
  report.checks.settledOwnDeathDelivered = settledRows.length > 0 && settledRows.every(row => row.stage === 5 && row.guard === 0);
  const playerDeadRows = trace.filter(row => row.playerHp === 0);
  report.checks.playerDeathDoesNotKillEnemy = playerDeadRows.length > 0 && playerDeadRows.every(row => row.alive && row.hp === 60 && row.stage !== 5 && row.deathT < 0);
  report.checks.renderedPoseInputRecorded = trace.every(row => Number.isFinite(row.poseInput.t) && Number.isFinite(row.poseInput.flinch));
  report.checks.all15Bones = trace.every(row => Object.keys(row.bones).length === 15);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#practice-start').tap();
  await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
  report.reentry = await sample(); report.storageAfterReentry = await storage(); report.stateAfterReentry = await stateStore();
  report.checks.reentry = report.reentry.enemy.kind === 'conch-duelist' && report.reentry.enemy.hp === 60 && report.reentry.player.health?.health === 100;
  report.checks.reentryPersistence = JSON.stringify(report.stateAfterReentry) === JSON.stringify(report.stateBeforeCombat) && JSON.stringify(report.storageAfterReentry) === JSON.stringify(report.storageBefore);
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await context.close();
} catch (error) {
  report.fatal = error.message; process.exitCode = 1;
  if (observedPage !== null && !observedPage.isClosed()) {
    try {
      const partial = await observedPage.evaluate(() => ({ trace: window.__conchRenderTrace, geometry: window.__conchRuntimeGeometry }));
      if (partial.trace) writeFileSync(`${out}/render-trace.json`, JSON.stringify(partial.trace));
      if (partial.geometry) writeFileSync(`${out}/runtime-geometry.json`, JSON.stringify(partial.geometry));
    } catch (captureError) { report.partialCaptureError = captureError.message; }
  }
}
finally { await browser?.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
