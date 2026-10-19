/** Actual Mantis-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.MANTIS_QA_OUT ?? 'tmp/mantis-early-knee-moving1';
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
await new Promise(resolve => { server.listen(4478, '127.0.0.1', resolve); });
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
  await page.goto(process.env.MANTIS_QA_URL ?? 'http://127.0.0.1:4478/', { waitUntil: 'domcontentloaded' });
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
  // Keep all per-render observations in browser memory until the settled hold is complete.
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
    window.__mantisHitEvents = []; window.__mantisAimEvents = [];
    const poseInputs = new WeakMap(), observedAnimals = new WeakSet(), observedSpecies = new WeakSet();
    const attachObservers = () => {
      const a = d.arena.activeTargets[0], species = a.model.species;
      if (!observedSpecies.has(species)) {
        observedSpecies.add(species); const originalAnimate = species.animate;
        species.animate = function animate(poseContext) {
          const result = originalAnimate.call(this, poseContext);
          poseInputs.set(poseContext.animal, { boutTime: poseContext.t, dt: poseContext.dt, speed: poseContext.speed, gait: poseContext.phase,
            deathT: poseContext.deathT, flinch: poseContext.flinch, alive: poseContext.alive, state: poseContext.state,
            mem: { ...poseContext.mem }, capturedAt: performance.now() });
          return result;
        };
      }
      if (!observedAnimals.has(a)) {
        observedAnimals.add(a); const originalOnDamaged = a.onDamaged;
        a.onDamaged = function onDamaged(body, amount, point, direction, died) {
          window.__mantisHitEvents.push({ phase: window.__mantisCapturePhase, frame: g.frameCount, wallTime: performance.now(),
            boutTime: d.arena.opponent.elapsed, amount, point: point.toArray(), direction: direction.toArray(), died,
            hp: a.hp, yaw: a.yaw, position: a.position.toArray(), poseInputs: poseInputs.get(a) ?? null,
            strike: JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike, mem: { ...a.mem } });
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
    label.style.cssText = 'pointer-events:none;position:fixed;top:220px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace';
    document.body.append(label);
    g.composer.render = (...args) => {
      const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
      const a = d.arena.activeTargets[0];
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
  // Same frozen product; one bounded genuine bout. Main moving death was launched
  // near first-strike active onset and landed at active .5667 with speed3.2725.
  // Wait for that actual AI phase, not an injected animation or simulated motion.
  await phase('moving-death-approach'); await place(8, -2.2); await aim(); await page.waitForTimeout(2200);
  await phase('moving-death-hits');
  const deadline = Date.now() + 75000;
  for (let attempt = 0; attempt < 10 && Date.now() < deadline; attempt++) {
    const current = await sample(); if (!current.enemy.alive || current.player.health?.health === 0) break;
    await place(2.05, -2.2, -.03);
    try {
      await page.waitForFunction(() => {
        const d = window.__practiceDemo, a = d.arena.activeTargets[0];
        const strike = JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike;
        return !a.alive || d.arena.playerVitals.health === 0 ||
          (strike.currentId === 'strike.splinter-mantis.first' && strike.phase === 'active' && strike.elapsed <= .2);
      }, undefined, { timeout: 12000, polling: 'raf' });
    } catch { report.phaseWaitTimeout = true; break; }
    const ready = await sample(); if (!ready.enemy.alive || ready.player.health?.health === 0) break;
    // Refresh only player placement/aim at observed onset. No enemy or simulation edits.
    await place(2.05, -2.2, -.03);
    await page.locator('.ws-touch-attack').tap();
    await page.waitForTimeout(1000);
    report.samples.push({ phase: 'moving-death-hits', ...await sample() });
  }
  report.afterSword = await sample(); report.checks.enemyDefeated = report.afterSword.enemy.alive === false;
  await phase('moving-death-settle');
  await page.waitForTimeout(6500);
  report.corpse = await sample();
  report.deaths.push({ label: 'actual-first-active-moving-attempt', result: report.afterSword, corpse: report.corpse });
  await capture('moving-death-settled');
  const trace = await page.evaluate(() => window.__mantisRenderTrace);
  report.hitEvents = await page.evaluate(() => window.__mantisHitEvents);
  report.aimEvents = await page.evaluate(() => window.__mantisAimEvents);
  report.checks.poseInputs = trace.filter(row => row.phase !== 'entry').every(row => row.poseInputs !== null);
  const lethal = report.hitEvents.find(row => row.died);
  const preLethal = lethal === undefined ? undefined : trace.findLast(row => row.wallTime < lethal.wallTime);
  report.checks.movingLethal = preLethal !== undefined && preLethal.speed > .1;
  report.checks.lethalPoseOwned = lethal !== undefined && lethal.poseInputs !== null;
  report.checks.settledHold = trace.filter(row => !row.alive && row.deathT === 1).length >= 10;
  report.checks.completeDeathClock = trace.some(row => !row.alive && row.deathT === 0)
    && trace.some(row => !row.alive && row.deathT === 1);
  report.storageAfter = await storage(); report.stateAfter = await stateStore();
  report.checks.unchangedStores = JSON.stringify(report.storageBefore) === JSON.stringify(report.storageAfter)
    && JSON.stringify(report.stateBeforeCombat) === JSON.stringify(report.stateAfter);
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await preserve();
  await context.close();
} catch (error) { report.fatal = error.stack; process.exitCode = 1; try { await preserve(); } catch (captureError) { report.traceFailure = captureError.message; } }
finally { await browser.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
