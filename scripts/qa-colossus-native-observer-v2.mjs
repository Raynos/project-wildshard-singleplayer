/** Actual Colossus-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.COLOSSUS_QA_OUT ?? 'tmp/colossus-native-observer-build2';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.colossus.combat-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.COLOSSUS_QA_DIST ?? 'tmp/colossus-native-preview-dist-build1');
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4470, '127.0.0.1', resolve); });
let browser = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.COLOSSUS_QA_URL ?? 'http://127.0.0.1:4470/', { waitUntil: 'domcontentloaded' });
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
    window.__colossusRenderTrace = []; window.__colossusCombatEvents = [];
    const instances = new WeakMap(); let instance = 0;
    g.viewmodel.visible = false;
    const label = document.createElement('div');
    label.style.cssText = 'position:fixed;top:200px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace';
    document.body.append(label);
    g.composer.render = (...args) => {
      const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
      const a = d.arena.activeTargets[0];
      if (!a) return render(...args);
      if (!instances.has(a)) {
        instances.set(a, ++instance);
        const owner = d.arena.opponent, actorInstance = instance;
        const identify = target => ({ id: target.id, isCurrentEnemy: target === a.combatActor(), isCurrentPlayer: target === owner.practicePlayer.health });
        owner.events.on('damage.dealt', ({ req, dealt }) => { window.__colossusCombatEvents.push({ event: 'damage.dealt', actorInstance, gameTime: g.frameTime, target: identify(req.target), dealt }); }, owner.bout);
        owner.events.on('actor.died', ({ actor }) => { window.__colossusCombatEvents.push({ event: 'actor.died', actorInstance, gameTime: g.frameTime, target: identify(actor) }); }, owner.bout);
      }
      g.camera.position.set(a.position.x + 5.5, a.position.y + 5.5, a.position.z + 8.5);
      g.camera.lookAt(a.position.x, a.position.y + 3, a.position.z);
      g.camera.updateMatrixWorld(true); a.mesh.updateMatrixWorld(true);
      const strike = JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike;
      window.__colossusRenderTrace.push({ actorId: a.entityId, meshUuid: a.mesh.uuid, actorInstance: instances.get(a), frame: g.frameCount, gameTime: g.frameTime, wallTime: performance.now(),
        stage: a.mem['tg-state'], exposed: a.mem['tg-exposed'], clock: a.mem['tg-clock'], strike, speed: a.speed, gait: a.phase,
        flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
        ragdoll: a.ragdoll ? { build: a.ragdoll.build, state: a.ragdoll.state, bodies: a.ragdoll.bodies } : null,
        world: a.mesh.matrixWorld.toArray(),
        bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, [...bone.position, ...bone.quaternion, ...bone.scale]])) });
      label.textContent = `COLOSSUS MOTION1 · LIVE AI / COMBAT · OBSERVER CAMERA · frame ${g.frameCount} · ${g.frameTime.toFixed(2)}s · ${strike.phase} · death ${a.deathT.toFixed(2)}`;
      try { return render(...args); }
      finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
    };
    return { scope: 'Camera temporarily offset during rendering and restored immediately. Full body capture; enemy/health/time unmodified. Read-only actual actor IDs/instances and damage/death subjects captured. All 22 weighted joints captured including scales.' };
  });
  report.entry = await sample(); save(); await capture('entry');
  report.checks.onlyColossus = report.entry.enemy.kind === 'tideRootColossus' && report.entry.targets === 1;
  // Observe unchanged decision and both actual attack stages before player attacks.
  await place(4.0);
  const stages = new Set(), end = Date.now() + 100000;
  while (Date.now() < end) {
    await aim(); await page.waitForTimeout(500); const row = await sample(); report.samples.push({ phase: 'defense', ...row });
    stages.add(row.enemy.mem['tg-state']); save();
    if (stages.has(1) && stages.has(2) && stages.has(3) && row.player.health?.health < 100) break;
    if (row.player.health?.health === 0) break;
  }
  report.defense = await sample(); await capture('both-strikes-observation');
  report.checks.leftSweep = stages.has(1);
  report.checks.rightSweep = stages.has(2);
  report.checks.slam = stages.has(3);
  report.checks.actualPlayerDamage = report.defense.player.health?.health < 100;
  report.storageAfterDefense = await storage();
  report.stateAfterDefense = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600);
  report.retryAfterDefense = await sample();
  // Wait for genuine slam recovery, then send one normal sword tap to measure exposed guard.
  await place(4);
  const exposedDeadline = Date.now() + 45000;
  while (Date.now() < exposedDeadline) {
    await page.waitForTimeout(100); const row = await sample();
    report.samples.push({ phase: 'guard-wait', ...row }); save();
    if (row.enemy.mem['tg-exposed'] === 1 && row.enemy.strike.phase === 'recover') break;
    if (row.player.health?.health === 0) break;
  }
  report.guardBefore = await sample();
  if (report.guardBefore.enemy.mem['tg-exposed'] === 1) {
    await place(2.2, 0, .03); await page.locator('.ws-touch-attack').tap();
    await page.waitForTimeout(550); report.guardAfter = await sample();
    report.guardDamage = report.guardBefore.enemy.hp - report.guardAfter.enemy.hp;
    report.checks.exposedSwordMultiplier = report.guardDamage === 18;
  } else report.checks.exposedSwordMultiplier = false;
  save();
  // Normal sword inputs; repositioning stays explicit and does not bypass collision or damage admission.
  for (let attempt = 0; attempt < 60; attempt++) {
    const current = await sample(); if (!current.enemy.alive || current.player.health?.health === 0) break;
    await place(2.2, 0, .03); await page.locator('.ws-touch-attack').tap();
    for (let beat = 0; beat < 10; beat++) { await page.waitForTimeout(100); const row = await sample(); report.samples.push({ phase: 'sword', ...row }); stages.add(row.enemy.mem['tg-state']); save(); }
  }
  report.afterSword = await sample(); await capture('sword-result');
  report.checks.actualEnemyDamage = report.afterSword.enemy.hp < 480;
  report.checks.enemyDefeated = report.afterSword.enemy.alive === false;
  if (report.checks.enemyDefeated) {
    await place(1.4); const hp = report.afterSword.player.health?.health;
    const endDeath = Date.now() + 30000;
    while (Date.now() < endDeath) {
      await page.waitForTimeout(1000); const row = await sample(); report.samples.push({ phase: 'corpse-reward', ...row }); save();
      if (row.loot?.complete === true) break;
    }
    await page.waitForTimeout(8000);
    report.corpse = await sample(); await capture('corpse-reward');
    report.checks.noPostDeathStrike = report.corpse.player.health?.health === hp;
    report.checks.boutLocalReward = report.corpse.loot?.scope === 'practice' && report.corpse.loot?.coins === 35 && report.corpse.loot?.complete === true;
  }
  report.storageAfterReward = await storage();
  report.stateAfterReward = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  report.checks.retry = report.retry.enemy.hp === 480 && report.retry.enemy.alive === true && report.retry.player.health?.health === 100
    && report.retry.loot?.coins === 0 && report.retry.loot?.complete === false;
  report.storageAfterRetry = await storage();
  report.stateAfterRetry = await stateStore();
  // A second fresh bout observes real enemy-caused player defeat, with no health or damage injection.
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
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.finalRetry = await sample();
  report.checks.finalRetry = report.finalRetry.enemy.hp === 480 && report.finalRetry.player.health?.health === 100;
  report.storageAfterDefeatRetry = await storage();
  report.stateAfterDefeatRetry = await stateStore();
  report.checks.emptyStorage = [report.storageBefore, report.storageAfterDefense, report.storageAfterReward, report.storageAfterRetry, report.storageAfterDefeatRetry]
    .every(row => Object.keys(row.local).length === 0 && Object.keys(row.session).length === 0);
  const states = [report.stateBeforeCombat, report.stateAfterDefense, report.stateAfterReward, report.stateAfterRetry, report.stateAfterDefeatRetry];
  report.checks.emptyUnchangedStateStore = states.every(row => JSON.stringify(row) === JSON.stringify(states[0])
    && Object.keys(row.shard).length === 0 && row.generation === 0
    && Object.values(row.docs).every(doc => Object.keys(doc.keys).length === 0));
  writeFileSync(`${out}/render-trace.json`, JSON.stringify(await page.evaluate(() => window.__colossusRenderTrace)));
  writeFileSync(`${out}/combat-events.json`, JSON.stringify(await page.evaluate(() => window.__colossusCombatEvents)));
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#practice-start').tap();
  await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
  report.reentry = await sample(); report.storageAfterReentry = await storage(); report.stateAfterReentry = await stateStore();
  report.checks.reentry = report.reentry.enemy.kind === 'tideRootColossus' && report.reentry.enemy.hp === 480 && report.reentry.player.health?.health === 100;
  report.checks.reentryPersistence = JSON.stringify(report.stateAfterReentry) === JSON.stringify(report.stateBeforeCombat) && JSON.stringify(report.storageAfterReentry) === JSON.stringify(report.storageBefore);
  const allStages = new Set(report.samples.map(row => row.enemy?.mem?.['tg-state']));
  report.checks.leftSweep = allStages.has(1); report.checks.rightSweep = allStages.has(2); report.checks.slam = allStages.has(3);
  report.checks.exposed = report.samples.some(row => row.enemy?.mem?.['tg-exposed'] === 1 && row.enemy.mem['tg-state'] === 3 && row.enemy.strike?.phase === 'recover');
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await context.close();
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
