/** Actual Mantis-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

// Fail closed until the coordinator supplies the exact frozen app tuple and slot.
for (const key of ['CAPTURE_SOURCE', 'CAPTURE_PRODUCT', 'CAPTURE_PREVIEW_SHA256', 'MANTIS_QA_DIST', 'MANTIS_QA_OUT']) {
  if (!process.env[key]) throw new Error(`Missing exact capture pin: ${key}`);
}
const built = resolvePath(process.env.MANTIS_QA_DIST);
const receiptBytes = readFileSync(`${built}/mantis-preview.json`), receipt = JSON.parse(receiptBytes);
const receiptHash = createHash('sha256').update(receiptBytes).digest('hex');
if (receiptHash !== process.env.CAPTURE_PREVIEW_SHA256 || receipt.sourceHash !== process.env.CAPTURE_PRODUCT || receipt.mode !== 'motion7') throw new Error('Frozen candidate7 tuple mismatch');
const out = process.env.MANTIS_QA_OUT;
if (existsSync(out)) throw new Error('Capture output must be new; preserve failed runs');
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.mantis.combat-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, product: receipt.sourceHash, previewSha256: receiptHash, errors: [], samples: [], placements: [], deaths: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(Number(process.env.MANTIS_QA_PORT ?? 4487), '127.0.0.1', resolve); });
let observedPage = null;
const preserve = async () => { if (observedPage !== null && !observedPage.isClosed()) {
  writeFileSync(`${out}/render-trace.json`, JSON.stringify(await observedPage.evaluate(() => window.__mantisRenderTrace ?? [])));
  writeFileSync(`${out}/damage-events.json`, JSON.stringify(await observedPage.evaluate(() => window.__mantisDamageEvents ?? [])));
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
  await page.goto(`http://127.0.0.1:${process.env.MANTIS_QA_PORT ?? 4487}/`, { waitUntil: 'domcontentloaded' });
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
  // Samples stay compact; complete traces serialize only at phase boundaries/failure.
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
    window.__mantisHitEvents = []; window.__mantisAimEvents = []; window.__mantisDamageEvents = [];
    let bout = 0, currentAnimal = null, poseIndex = 0;
    const poseInputs = new WeakMap(), observedAnimals = new WeakSet(), observedSpecies = new WeakSet();
    const attachObservers = () => {
      const a = d.arena.activeTargets[0]; if (!a) return;
      if (a !== currentAnimal) { currentAnimal = a; bout++; }
      const species = a.model.species;
      if (!observedSpecies.has(species)) {
        observedSpecies.add(species); const originalAnimate = species.animate;
        species.animate = function animate(poseContext) {
          // Copy the evaluator's own inputs BEFORE evaluation; never reconstruct attack from a runner clock.
          const input = { bout, poseIndex: ++poseIndex, t: poseContext.t, boutTime: d.arena.opponent.elapsed,
            dt: poseContext.dt, attack: poseContext.attack, speed: poseContext.speed, phase: poseContext.phase, gait: poseContext.phase,
            deathT: poseContext.deathT, flinch: poseContext.flinch, alive: poseContext.alive, state: poseContext.state,
            stage: poseContext.mem['mantis-st'], clock: poseContext.mem['regular-clock'],
            posePhase: poseContext.mem['mantis-pose-phase'], poseClock: poseContext.mem['mantis-pose-clock'],
            mem: { ...poseContext.mem }, capturedAt: performance.now() };
          const result = originalAnimate.call(this, poseContext);
          poseInputs.set(poseContext.animal, input);
          return result;
        };
      }
      if (!observedAnimals.has(a)) {
        observedAnimals.add(a);
        const owner = d.arena.opponent;
        owner.events.on('damage.dealt', ({ req, dealt }) => {
          window.__mantisDamageEvents.push({ bout, phase: window.__mantisCapturePhase, frame: g.frameCount,
            wallTime: performance.now(), gameTime: g.frameTime, boutTime: owner.elapsed, dealt,
            target: req.target === owner.practicePlayer.health ? 'player' : 'enemy',
            playerHealth: { ...d.arena.playerVitals }, hp: a.hp, poseInputs: poseInputs.get(a) ?? null,
            runner: JSON.parse(owner.callbacks.control(a).snapshot()) });
        }, owner.bout);
        const originalOnDamaged = a.onDamaged;
        a.onDamaged = function onDamaged(body, amount, point, direction, died) {
          window.__mantisHitEvents.push({ phase: window.__mantisCapturePhase, frame: g.frameCount, wallTime: performance.now(),
            boutTime: d.arena.opponent.elapsed, amount, point: point.toArray(), direction: direction.toArray(), died,
            bout, hp: a.hp, speed: a.speed, stage: a.mem['mantis-st'], yaw: a.yaw, position: a.position.toArray(), poseInputTiming: 'last evaluated pose before damage presentation', poseInputs: poseInputs.get(a) ?? null,
            runner: JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()), strike: JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike, mem: { ...a.mem } });
          return originalOnDamaged?.call(this, body, amount, point, direction, died);
        };
      }
    };
    attachObservers();
    const opponent = d.arena.opponent, originalUpdate = opponent.update;
    opponent.update = function update(...args) { attachObservers(); return originalUpdate.apply(this, args); };
    let previousWallTime = null;
    g.viewmodel.visible = false;
    const label = document.createElement('div'); label.textContent = 'LIVE AI / COMBAT · RENDER-ONLY OBSERVER CAMERA';
    label.style.cssText = 'pointer-events:none;position:fixed;bottom:105px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace';
    document.body.append(label);
    g.composer.render = (...args) => {
      const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
      attachObservers();
      const a = d.arena.activeTargets[0];
      a.mesh.updateMatrixWorld(true);
      g.camera.position.set(a.position.x + 4, a.position.y + 3, a.position.z + 6);
      g.camera.lookAt(a.position.x, a.position.y + 1.8, a.position.z);
      g.camera.updateMatrixWorld(true);
      const trace = window.__mantisRenderTrace;
      const control = d.arena.opponent.callbacks.control(a);
      const runner = JSON.parse(control.snapshot()), strike = runner.strike;
      const wallTime = performance.now(), renderDeltaMs = previousWallTime === null ? null : wallTime - previousWallTime; previousWallTime = wallTime;
      trace.push({ bout, runner, strikeSpec: control.current === null ? null : { ...control.current }, camera: { position: g.camera.position.toArray(), quaternion: g.camera.quaternion.toArray(), projection: g.camera.projectionMatrix.toArray() }, poseInputs: poseInputs.get(a) ?? null, renderDeltaMs, hitEventCount: window.__mantisHitEvents.length, phase: window.__mantisCapturePhase, floor: 900, boutTime: d.arena.opponent.elapsed, playerHealth: { ...d.arena.playerVitals }, playerPosition: d.player.position.toArray(), frame: g.frameCount, gameTime: g.frameTime, wallTime: performance.now(), stage: a.mem['mantis-st'], clock: a.mem['regular-clock'], strike, posePhase: a.mem['mantis-pose-phase'], poseClock: a.mem['mantis-pose-clock'], speed: a.speed, gait: a.phase, flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
        position: a.position.toArray(), yaw: a.yaw, world: a.mesh.matrixWorld.toArray(), bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, [...bone.position, ...bone.quaternion]])),
        boneTransforms: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, { position: bone.position.toArray(), quaternion: bone.quaternion.toArray(), scale: bone.scale.toArray(), local: bone.matrix.toArray(), world: bone.matrixWorld.toArray() }])) });
      label.textContent = `LIVE AI / COMBAT · DIAGNOSTIC CAMERA · frame ${g.frameCount} · bout ${bout} · a${Number(poseInputs.get(a)?.attack ?? -2).toFixed(3)} · game ${g.frameTime.toFixed(2)}s · ${strike.phase}:${Number(strike.elapsed ?? 0).toFixed(3)} / observed ${a.mem['mantis-pose-phase']}:${Number(a.mem['mantis-pose-clock'] ?? 0).toFixed(3)}`;
      try { return render(...args); }
      finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
    };
    return { scope: 'Camera is temporarily offset only during compositor rendering and restored immediately. Player placement is diagnostic. Enemy state/health/clock untouched.' };
  });
  const phase = name => page.evaluate(value => { window.__mantisCapturePhase = value; }, name);
  report.entry = await sample(); save(); await capture('entry');
  report.checks.onlyMantis = report.entry.enemy.kind === 'splinter-mantis' && report.entry.targets === 1;
  const retry = async name => { await phase(name); await page.locator('#practice-retry').tap(); await page.waitForTimeout(500); };
  const inwardAngle = () => page.evaluate(() => {
    const a = window.__practiceDemo.arena.activeTargets[0];
    return Math.hypot(a.position.x, a.position.z) > 20 ? Math.atan2(-a.position.x, -a.position.z) : -2.2;
  });
  const waitStrike = async (id, minimum, maximum, strikePhase = 'windup') => {
    try { await page.waitForFunction(criteria => {
      const d = window.__practiceDemo, a = d.arena.activeTargets[0];
      const strike = JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike;
      return !a.alive || d.arena.playerVitals.health === 0 || (strike.currentId === criteria.id && strike.phase === criteria.strikePhase && strike.elapsed >= criteria.minimum && strike.elapsed <= criteria.maximum);
    }, { id, minimum, maximum, strikePhase }, { timeout: 14000, polling: 'raf' }); return true;
    } catch (error) { report.samples.push({ phaseWaitFailure: error.message, id, minimum, maximum, strikePhase }); save(); return false; }
  };
  // A real first -> second -> rest cycle, with damage. No per-render trace serialization.
  await phase('two-strike-cycle'); await place(3, await inwardAngle()); await aim();
  const cycleDeadline = Date.now() + 60000;
  while (Date.now() < cycleDeadline) {
    await page.waitForTimeout(500); const observation = await sample();
    report.samples.push({ phase: 'two-strike-cycle', ...observation });
    const complete = await page.evaluate(() => {
      const rows = window.__mantisRenderTrace.filter(row => row.phase === 'two-strike-cycle');
      const first = rows.findIndex(row => row.strike.currentId === 'strike.splinter-mantis.first' && row.strike.phase === 'windup');
      const second = rows.findIndex((row, index) => index > first && row.strike.currentId === 'strike.splinter-mantis.second' && row.strike.phase === 'windup');
      return first !== -1 && second > first
        && ['strike.splinter-mantis.first', 'strike.splinter-mantis.second'].every(id => ['windup', 'active', 'recover'].every(part => rows.some(row => row.strike.currentId === id && row.strike.phase === part)))
        && rows.some((row, index) => index > second && row.stage === 2) && rows.some(row => row.playerHealth.health < 100);
    });
    if (complete || observation.player.health.health === 0) { report.checks.twoStrikeCycle = complete; break; }
    // Redirect only after a complete rest if approaching the wall; never alter an active lane.
    if (observation.enemy.mem['mantis-st'] === 2) await place(3, await inwardAngle());
  }
  report.checks.twoStrikeCycle ??= false;
  report.defense = await sample(); await capture('two-strike-cycle'); await preserve();
  report.storageAfterDefense = await storage(); report.stateAfterDefense = await stateStore();
  // These are requests for legal input timing; actual damage phase is measured, never assumed.
  for (const trial of [{ label: 'early-windup-hit', min: 0, max: .15 }, { label: 'late-windup-hit', min: .3, max: .48 }]) {
    await retry(`${trial.label}-retry`); await phase(trial.label); await place(2.05, await inwardAngle(), -.03); await aim();
    if (await waitStrike('strike.splinter-mantis.first', trial.min, trial.max)) {
      report.samples.push({ phase: `${trial.label}-input`, ...await sample() });
      await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(2600);
    }
    await capture(trial.label); await preserve();
  }
  // Reuse the proven moving-lethal approach: normal input near authoritative first-active onset.
  await retry('moving-death-retry'); await phase('moving-death-approach');
  await place(8, -2.2); await aim(); await page.waitForTimeout(2200); await phase('moving-death-hits');
  const movingDeadline = Date.now() + 75000;
  for (let attempt = 0; attempt < 10 && Date.now() < movingDeadline; attempt++) {
    const current = await sample(); if (!current.enemy.alive || current.player.health.health === 0) break;
    await place(2.05, -2.2, -.03);
    if (!await waitStrike('strike.splinter-mantis.first', 0, .2, 'active')) break;
    const ready = await sample(); if (!ready.enemy.alive || ready.player.health.health === 0) break;
    await place(2.05, -2.2, -.03); await page.locator('.ws-touch-attack').tap();
    await page.waitForTimeout(1000); report.samples.push({ phase: 'moving-death-hits', ...await sample() }); save();
  }
  report.afterSword = await sample(); report.checks.enemyDefeated = report.afterSword.enemy.alive === false;
  await phase('moving-death-settle'); await page.waitForTimeout(8000);
  report.corpse = await sample(); report.deaths.push({ label: 'post-retry-moving-attempt', result: report.afterSword, corpse: report.corpse });
  report.checks.boutLocalReward = report.corpse.loot?.scope === 'practice' && report.corpse.loot?.coins === 3 && report.corpse.loot?.complete === true;
  await capture('moving-death-settled'); await preserve();
  report.storageAfterReward = await storage();
  report.stateAfterReward = await stateStore();
  await phase('reward-retry'); await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  report.checks.retry = (await page.evaluate(() => window.__mantisRenderTrace)).some(row => row.phase === 'reward-retry' && row.boutTime < 1 && row.hp === 55 && row.alive === true && row.playerHealth.health === 100)
    && report.retry.loot?.coins === 0 && report.retry.loot?.complete === false;
  report.storageAfterRetry = await storage();
  report.stateAfterRetry = await stateStore();
  await capture('retry');
  await phase('real-player-defeat');
  const defeatDeadline = Date.now() + 180000;
  while (Date.now() < defeatDeadline) {
    const row = await sample(); if (row.player.health?.health === 0) break;
    const defeatAngle = await page.evaluate(() => {
      const a = window.__practiceDemo.arena.activeTargets[0];
      return Math.hypot(a.position.x, a.position.z) > 20 ? Math.atan2(-a.position.x, -a.position.z) : 0;
    });
    await place(.85, defeatAngle, .15); await aim(); await page.waitForTimeout(1000);
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
  report.checks.finalRetry = (await page.evaluate(() => window.__mantisRenderTrace)).some(row => row.phase === 'defeat-retry' && row.boutTime < 1 && row.hp === 55 && row.alive === true && row.playerHealth.health === 100);
  report.storageAfterDefeatRetry = await storage(); report.stateAfterDefeatRetry = await stateStore();
  const trace = await page.evaluate(() => window.__mantisRenderTrace);
  report.hitEvents = await page.evaluate(() => window.__mantisHitEvents);
  report.damageEvents = await page.evaluate(() => window.__mantisDamageEvents);
  report.aimEvents = await page.evaluate(() => window.__mantisAimEvents);
  report.checks.poseInputs = trace.filter(row => row.phase !== 'entry').every(row => row.poseInputs !== null && Number.isFinite(row.poseInputs.attack) && row.poseInputs.bout === row.bout);
  report.checks.earlyLegalHit = report.hitEvents.some(row => row.phase === 'early-windup-hit' && row.strike.phase === 'windup' && row.strike.elapsed < .375);
  report.checks.lateLegalHit = report.hitEvents.some(row => row.phase === 'late-windup-hit' && row.strike.phase === 'windup' && row.strike.elapsed >= .375);
  report.checks.completeDeathClock = trace.some(row => !row.alive && row.deathT === 0) && trace.some(row => !row.alive && row.deathT === 1);
  report.checks.settledHold = trace.filter(row => !row.alive && row.deathT === 1).length >= 10;
  report.qualityAcceptance = false;
  const lethal = report.hitEvents.find(row => row.died);
  const preLethal = lethal === undefined ? undefined : trace.findLast(row => row.wallTime < lethal.wallTime);
  report.checks.movingLethal = preLethal !== undefined && preLethal.speed > .1;
  report.checks.lethalPoseOwned = lethal !== undefined && lethal.poseInputs !== null;
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
