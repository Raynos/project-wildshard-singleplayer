/** Actual Mantis-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.MANTIS_QA_OUT ?? 'tmp/mantis-early-knee-motion-qa';
if (existsSync(out)) throw new Error('Capture output must be new; preserve failed runs');
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.mantis.combat-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], deaths: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.MANTIS_QA_DIST ?? 'tmp/mantis-early-knee-preview-dist');
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4476, '127.0.0.1', resolve); });
let observedPage = null;
const preserve = async () => { if (observedPage !== null && !observedPage.isClosed()) {
  writeFileSync(`${out}/render-trace.json`, JSON.stringify(await observedPage.evaluate(() => window.__mantisRenderTrace ?? [])));
  writeFileSync(`${out}/hit-events.json`, JSON.stringify(await observedPage.evaluate(() => window.__mantisHitEvents ?? [])));
  writeFileSync(`${out}/aim-events.json`, JSON.stringify(await observedPage.evaluate(() => window.__mantisAimEvents ?? [])));
} };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); observedPage = page; page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.MANTIS_QA_URL ?? 'http://127.0.0.1:4476/', { waitUntil: 'domcontentloaded' });
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
  const sample = async () => { await preserve(); return page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    return { time: d.game.frameTime, state: d.game.app.state, targets: d.arena.activeTargets.length,
      enemy: { kind: a?.kind, hp: a?.hp, maxHp: a?.maxHp, alive: a?.alive, state: a?.state,
        mem: { ...a?.mem }, position: a?.position.toArray(), yaw: a?.yaw,
        bones: Object.fromEntries(Object.entries(a?.bones ?? {}).map(([name, bone]) => [name, { position: bone.position.toArray(), rotation: bone.rotation.toArray().slice(0, 3) }])) },
      player: { health: d.arena.playerVitals, position: d.player.position.toArray(), carried: d.player.carried },
      loot: d.arena.opponent?.loot?.receipt, status: document.querySelector('#practice-status')?.textContent };
  }); };
  const place = async (placementDistance, placementAngle = 0, placementPitch = .08) => {
    report.placements.push(await page.evaluate(({ distance, angle, pitch }) => {
      const d = window.__practiceDemo, a = d.arena.activeTargets[0];
      d.player.spawn(a.position.x + Math.sin(angle) * distance, a.position.z + Math.cos(angle) * distance, angle, a.position.y);
      d.player.pitch = pitch;
      return { wallTime: performance.now(), gameTime: d.game.frameTime, phase: window.__mantisCapturePhase, reason: 'Diagnostic player/camera placement; aim also follows the enemy during defense; no enemy/health/time edits', distance, angle, pitch, position: d.player.position.toArray() };
    }, { distance: placementDistance, angle: placementAngle, pitch: placementPitch }));
  };
  const aim = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    const dx = d.player.position.x - a.position.x, dz = d.player.position.z - a.position.z;
    d.player.yaw = Math.atan2(dx, dz); d.player.pitch = Math.atan2(.4, Math.hypot(dx, dz));
    window.__mantisAimEvents.push({ wallTime: performance.now(), gameTime: d.game.frameTime, phase: window.__mantisCapturePhase, yaw: d.player.yaw, pitch: d.player.pitch });
  });
  const capture = async name => { await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85, scale: 'css' }); };
  report.observerCamera = await page.evaluate(() => {
    const d = window.__practiceDemo, g = d.game, render = g.composer.render.bind(g.composer);
    window.__mantisRenderTrace = []; window.__mantisCapturePhase = 'entry';
    window.__mantisHitEvents = []; window.__mantisAimEvents = [];
    const poseInputs = new WeakMap(), observedAnimals = new WeakSet();
    const species = d.arena.activeTargets[0].model.species, originalAnimate = species.animate;
    species.animate = function animate(poseContext) {
      const result = originalAnimate.call(this, poseContext);
      poseInputs.set(poseContext.animal, { boutTime: poseContext.t, dt: poseContext.dt, speed: poseContext.speed, gait: poseContext.phase,
        deathT: poseContext.deathT, flinch: poseContext.flinch, alive: poseContext.alive, state: poseContext.state,
        mem: { ...poseContext.mem }, capturedAt: performance.now() });
      return result;
    };
    let previousWallTime = null;
    g.viewmodel.visible = false;
    const label = document.createElement('div'); label.textContent = 'LIVE AI / COMBAT · RENDER-ONLY OBSERVER CAMERA';
    label.style.cssText = 'pointer-events:none;position:fixed;top:220px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace';
    document.body.append(label);
    g.composer.render = (...args) => {
      const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
      const a = d.arena.activeTargets[0];
      if (!observedAnimals.has(a)) {
        observedAnimals.add(a); const originalOnDamaged = a.onDamaged;
        a.onDamaged = function onDamaged(body, amount, point, direction, died) {
          window.__mantisHitEvents.push({ phase: window.__mantisCapturePhase, frame: g.frameCount, wallTime: performance.now(),
            boutTime: d.arena.opponent.elapsed, amount, point: point.toArray(), direction: direction.toArray(), died,
            hp: a.hp, yaw: a.yaw, position: a.position.toArray(), poseInputs: poseInputs.get(a) ?? null,
            strike: JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike,
            mem: { ...a.mem } });
          return originalOnDamaged?.call(this, body, amount, point, direction, died);
        };
      }
      g.camera.position.set(a.position.x + 4, a.position.y + 3, a.position.z + 6);
      g.camera.lookAt(a.position.x, a.position.y + 1.8, a.position.z);
      g.camera.updateMatrixWorld(true);
      const trace = window.__mantisRenderTrace;
      const control = d.arena.opponent.callbacks.control(a);
      const strike = JSON.parse(control.snapshot()).strike;
      const wallTime = performance.now(), renderDeltaMs = previousWallTime === null ? null : wallTime - previousWallTime; previousWallTime = wallTime;
      trace.push({ poseInputs: poseInputs.get(a) ?? null, renderDeltaMs, hitEventCount: window.__mantisHitEvents.length, phase: window.__mantisCapturePhase, floor: 900, boutTime: d.arena.opponent.elapsed, playerHealth: d.arena.playerVitals, playerPosition: d.player.position.toArray(), frame: g.frameCount, gameTime: g.frameTime, wallTime: performance.now(), stage: a.mem['mantis-st'], clock: a.mem['regular-clock'], strike, posePhase: a.mem['mantis-pose-phase'], poseClock: a.mem['mantis-pose-clock'], speed: a.speed, gait: a.phase, flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
        position: a.position.toArray(), yaw: a.yaw, world: a.mesh.matrixWorld.toArray(), bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, [...bone.position, ...bone.quaternion]])) });
      label.textContent = `LIVE AI / COMBAT · DIAGNOSTIC CAMERA · frame ${g.frameCount} · game ${g.frameTime.toFixed(2)}s · ${strike.phase}:${Number(strike.elapsed ?? 0).toFixed(3)} / observed ${a.mem['mantis-pose-phase']}:${Number(a.mem['mantis-pose-clock'] ?? 0).toFixed(3)}`;
      try { return render(...args); }
      finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
    };
    return { scope: 'Camera is temporarily offset only during compositor rendering and restored immediately. Player placement is diagnostic. Enemy state/health/clock untouched.' };
  });
  const phase = name => page.evaluate(value => { window.__mantisCapturePhase = value; }, name);
  report.entry = await sample(); save(); await capture('entry');
  report.checks.onlyMantis = report.entry.enemy.kind === 'splinter-mantis' && report.entry.targets === 1;
  // Observe unchanged decision and both actual attack stages before player attacks.
  await phase('approach-defense'); await place(8);
  const stages = new Set(), end = Date.now() + 100000;
  while (Date.now() < end) {
    await aim(); await page.waitForTimeout(500); const row = await sample(); report.samples.push({ phase: 'defense', ...row });
    stages.add(row.enemy.mem['mantis-st']); save();
    if (stages.has(1) && stages.has(3) && stages.has(2) && row.player.health?.health < 100) break;
    if (row.player.health?.health === 0) break;
  }
  await page.waitForTimeout(5000);
  report.defense = await sample(); await capture('both-strikes-observation');
  report.checks.firstAndSecond = stages.has(1) && stages.has(3);
  report.checks.actualPlayerDamage = (await page.evaluate(() => window.__mantisRenderTrace)).some(row => row.phase === 'approach-defense' && row.playerHealth?.health < 100);
  report.storageAfterDefense = await storage();
  report.stateAfterDefense = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600);
  report.retryAfterDefense = await sample();
  await phase('stop'); await place(2.1); await aim(); await page.waitForTimeout(2000); report.stop = await sample();
  await phase('resume'); await place(8); await aim(); await page.waitForTimeout(2000); report.resume = await sample();
  await phase('stop-again'); await place(2.1); await aim(); await page.waitForTimeout(2000); report.stopAgain = await sample();
  await phase('sword-interruptions');
  // Normal sword inputs; repositioning stays explicit and does not bypass collision or damage admission.
  for (let attempt = 0; attempt < 24; attempt++) {
    const current = await sample(); if (!current.enemy.alive || current.player.health?.health === 0) break;
    await place(2.2, 0, .03); await page.locator('.ws-touch-attack').tap();
    await page.waitForTimeout(700); report.samples.push({ phase: 'sword', ...await sample() }); save();
  }
  report.afterSword = await sample(); await capture('sword-result');
  report.checks.actualEnemyDamage = report.afterSword.enemy.hp < 55;
  report.checks.enemyDefeated = report.afterSword.enemy.alive === false;
  if (report.checks.enemyDefeated) {
    await phase('death-settle-reward'); await place(6); const hp = report.afterSword.player.health?.health;
    const endDeath = Date.now() + 30000;
    while (Date.now() < endDeath) {
      await page.waitForTimeout(1000); const row = await sample(); report.samples.push({ phase: 'corpse-reward', ...row }); save();
      if (row.loot?.complete === true) break;
    }
    const settleUntil = (await sample()).time + 6;
    while ((await sample()).time < settleUntil) { await page.waitForTimeout(500); report.samples.push({ phase: 'settle-tail', ...await sample() }); save(); }
    report.corpse = await sample(); await capture('corpse-reward');
    report.checks.noPostDeathStrike = (await page.evaluate(() => window.__mantisRenderTrace)).filter(row => row.phase === 'death-settle-reward').every(row => row.playerHealth?.health >= hp);
    report.checks.boutLocalReward = report.corpse.loot?.scope === 'practice' && report.corpse.loot?.coins === 3 && report.corpse.loot?.complete === true;
  }
  report.deaths.push({ label: 'front-stopped', result: report.afterSword, corpse: report.corpse });
  for (const variant of [{ label: 'side-recent-movement', angle: Math.PI / 2, distance: 2.25, pitch: .1 },
    { label: 'opposite-oblique', angle: -2.2, distance: 2.05, pitch: -.03 }]) {
    await page.locator('#practice-retry').tap(); await page.waitForTimeout(600);
    await phase(`${variant.label}-approach`); await place(8, variant.angle); await aim(); await page.waitForTimeout(2200);
    await phase(`${variant.label}-hits`);
    for (let attempt = 0; attempt < 32; attempt++) {
      const current = await sample(); if (!current.enemy.alive || current.player.health?.health === 0) break;
      await place(variant.distance, variant.angle, variant.pitch); await page.locator('.ws-touch-attack').tap();
      await page.waitForTimeout(650); report.samples.push({ phase: variant.label, ...await sample() }); save();
    }
    const result = await sample(); await phase(`${variant.label}-settle`);
    const settleUntil = result.time + 8;
    while ((await sample()).time < settleUntil) { await page.waitForTimeout(500); report.samples.push({ phase: `${variant.label}-settle`, ...await sample() }); save(); }
    const corpse = await sample(); report.deaths.push({ label: variant.label, result, corpse }); await capture(variant.label); save();
  }
  report.checks.threeGenuineDeaths = report.deaths.length === 3 && report.deaths.every(row => row.result.enemy.alive === false && row.corpse.enemy.alive === false);
  report.storageAfterReward = await storage();
  report.stateAfterReward = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  report.checks.retry = report.retry.enemy.hp === 55 && report.retry.enemy.alive === true && report.retry.player.health?.health === 100
    && report.retry.loot?.coins === 0 && report.retry.loot?.complete === false;
  report.storageAfterRetry = await storage();
  report.stateAfterRetry = await stateStore();
  await capture('retry');
  await phase('real-player-defeat');
  const defeatDeadline = Date.now() + 180000;
  while (Date.now() < defeatDeadline) {
    const row = await sample(); if (row.player.health?.health === 0) break;
    await place(.85, 0, .15); await aim(); await page.waitForTimeout(1600);
    report.samples.push({ phase: 'player-defeat', ...await sample() }); save();
  }
  report.playerDefeat = await sample(); report.checks.playerDefeated = report.playerDefeat.player.health?.health === 0;
  await capture('player-defeat');
  if (report.checks.playerDefeated) {
    await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(600);
    report.afterDefeatedAttack = await sample();
    report.checks.defeatedAttackBlocked = report.afterDefeatedAttack.enemy.hp === report.playerDefeat.enemy.hp;
  }
  await phase('defeat-retry'); await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.finalRetry = await sample();
  report.checks.finalRetry = report.finalRetry.enemy.hp === 55 && report.finalRetry.player.health?.health === 100;
  report.storageAfterDefeatRetry = await storage(); report.stateAfterDefeatRetry = await stateStore();
  const trace = await page.evaluate(() => window.__mantisRenderTrace);
  report.hitEvents = await page.evaluate(() => window.__mantisHitEvents);
  report.aimEvents = await page.evaluate(() => window.__mantisAimEvents);
  report.checks.poseInputs = trace.filter(row => row.phase !== 'entry').every(row => row.poseInputs !== null);
  report.checks.realApproach = trace.some(row => row.phase === 'approach-defense' && row.speed > .1);
  report.checks.realStop = trace.some(row => row.phase === 'stop' && row.speed < .05);
  report.checks.realResume = trace.some(row => row.phase === 'resume' && row.speed > .1);
  report.checks.realSecondStop = trace.some(row => row.phase === 'stop-again' && row.speed < .05);
  await preserve();
  // Keep the original complete pre-reload trace; the new page has no injected pose observer.
  observedPage = null;
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#practice-start').tap();
  await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
  report.reentry = await sample(); report.storageAfterReentry = await storage(); report.stateAfterReentry = await stateStore();
  report.checks.reentry = report.reentry.enemy.kind === 'splinter-mantis' && report.reentry.enemy.hp === 55 && report.reentry.player.health?.health === 100;
  await capture('reload-reentry');
  report.checks.emptyStorage = [report.storageBefore, report.storageAfterDefense, report.storageAfterReward, report.storageAfterRetry, report.storageAfterDefeatRetry, report.storageAfterReentry]
    .every(row => Object.keys(row.local).length === 0 && Object.keys(row.session).length === 0);
  const states = [report.stateBeforeCombat, report.stateAfterDefense, report.stateAfterReward, report.stateAfterRetry, report.stateAfterDefeatRetry, report.stateAfterReentry];
  report.checks.emptyUnchangedStateStore = states.every(row => JSON.stringify(row) === JSON.stringify(states[0])
    && Object.keys(row.shard).length === 0 && row.generation === 0
    && Object.values(row.docs).every(doc => Object.keys(doc.keys).length === 0));
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await preserve();
  await context.close();
} catch (error) { report.fatal = error.stack; process.exitCode = 1; try { await preserve(); } catch (captureError) { report.traceFailure = captureError.message; } }
finally { await browser.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
