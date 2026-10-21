/** Root-GO only, under browser-lane.sh. Immutable-host functional prototype proof, NOT quality/native admission.
 * node this-file BUILT NEW_OUT smoke|cycles RECEIPT_SHA256 INVENTORY_SHA256 [KIND]
 * KIND restricts diagnostic reruns and can never establish all-nine completion.
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { digest, inventory } from './candidate-inputs.mjs';

const [hostArg, outArg, mode, receiptHash, inventoryHash, onlyKind] = process.argv.slice(2);
if (!hostArg || !outArg || !['smoke', 'cycles'].includes(mode) || ![receiptHash, inventoryHash].every(s => /^[a-f0-9]{64}$/u.test(s))) throw new Error('Supply BUILT NEW_OUT smoke|cycles RECEIPT_SHA INVENTORY_SHA [KIND]');
const built = resolve(hostArg), out = resolve(outArg);
const kinds = [['splinter-mantis', 3], ['conch-duelist', 3], ['tideRootColossus', 35], ['brine-puffer', 2], ['bellback', 5], ['brine-pitcher-matriarch', 5], ['pearlglass-medusa', 5], ['keelmaw', 5], ['bloomthroat-iguana', 5]];
if (onlyKind && !kinds.some(([kind]) => kind === onlyKind)) throw new Error('Unknown KIND');
if (out === built || out.startsWith(`${built}${sep}`) || built.startsWith(`${out}${sep}`)) throw new Error('Evidence must be outside immutable host');
function verify() {
  const r = readFileSync(resolve(built, 'prototype-nine-build.json')), i = readFileSync(resolve(built, 'candidate-inventory.json'));
  const receipt = JSON.parse(r), manifest = JSON.parse(i), actual = inventory(built); delete actual['candidate-inventory.json'];
  if (digest(r) !== receiptHash || digest(i) !== inventoryHash || !isDeepStrictEqual(actual, manifest.files)
    || receipt.schema !== 'wildshard.prototype-nine.build.v1' || receipt.products.length !== 9
    || receipt.products.some(p => p.currentSdkValidation !== 'passed')) throw new Error('Exact host receipt/inventory/SDK identity mismatch');
  return { built, receiptHash, inventoryHash, receipt, fileCount: Object.keys(actual).length };
}
const identity = verify(); mkdirSync(out, { recursive: false });
const report = { schema: 'wildshard.prototype-nine.functional-qa.v1', mode, onlyKind, identity, startedAt: new Date().toISOString(), checks: {}, enemies: [], errors: [], consoleErrors: [], stores: [],
  method: 'Muted cloud Chromium, iPhone 16 Pro portrait. Real trusted touch controls and actual damage pipeline. Explicit logged player-only placements test functional combat, NOT player navigation. No HP, clock, enemy AI, pose or callback writes. Retained opponent.targets proves despawn death. Observed RAF cadence and recorder cadence are separate, neither physical-phone FPS. Smoke is NOT complete cycles; neither mode establishes likeness, animation quality or native corpse admission.' };
const save = () => writeFileSync(resolve(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
let browser, context, page, server;
let stopRequested = false;
process.on('SIGINT', () => { stopRequested = true; });
const stopFile = resolve(out, 'STOP');
const assertRunning = () => {
  if (stopRequested || existsSync(stopFile)) { report.interrupted = true; report.interruption = { at: new Date().toISOString(), reason: stopRequested ? 'SIGINT' : 'STOP file' }; throw new Error('Cooperative interruption; incomplete checks remain unproven'); }
};
try {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost'), name = url.pathname === '/' ? 'arena.html' : url.pathname.slice(1), path = resolve(built, name);
    if (!path.startsWith(`${built}${sep}`) || !identity.receipt || !Object.hasOwn(JSON.parse(readFileSync(resolve(built, 'candidate-inventory.json'))).files, name)) { res.writeHead(403).end(); return; }
    try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' })[extname(path)] ?? 'application/octet-stream'); res.end(readFileSync(path)); } catch { res.writeHead(404).end(); }
  });
  await new Promise(_resolve => { server.listen(0, '127.0.0.1', () => { _resolve(); }); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No local server address');
  const { chromium, devices } = await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1, recordVideo: { dir: resolve(out, 'video'), size: { width: 402, height: 874 } } });
  page = await context.newPage(); page.setDefaultTimeout(90000); page.on('pageerror', e => { report.errors.push(String(e)); save(); });
  page.on('console', message => { if (message.type() === 'error') { report.consoleErrors.push({ at: new Date().toISOString(), text: message.text() }); save(); } });
  const cdp = await context.newCDPSession(page);
  const storage = async () => { const s = await page.evaluate(async () => {
    const saves = window.__practiceDemo?.game.app.saves;
    return { local: Object.keys(localStorage), session: Object.keys(sessionStorage), caches: await caches.keys(), databases: await indexedDB.databases(), workers: (await navigator.serviceWorker.getRegistrations()).length,
      world: saves ? { docs: JSON.parse(saves.exportAll()).docs, shard: saves.inspectShard({ id: 'driftwood-isle' }), generation: saves.inspectShardGeneration({ id: 'driftwood-isle' }) } : null };
  }); report.stores.push(s); return s; };
  await page.goto(`http://127.0.0.1:${address.port}/arena.html`, { waitUntil: 'domcontentloaded' }); await storage();
  report.checks.lazy = await page.evaluate(() => !window.__practiceDemo && document.querySelectorAll('canvas').length === 1);
  report.checks.nineEnabled = await page.evaluate(expected => expected.every(kind => { const o = document.querySelector(`option[value="${kind}"]`); return o && !o.disabled; }), kinds.map(([k]) => k));
  await page.locator('#arena-start').tap(); await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
  await page.evaluate(() => {
    const q = window.__nineQA = { game: window.__practiceDemo.game, frames: [], poses: [], hits: [], inputs: [], errors: [], phase: 'start', recording: true, bout: null, lastPose: -Infinity };
    q.read = (pose = false) => {
      const d = window.__practiceDemo, o = d?.arena.opponent, a = o?.targets[0], c = a?.rigCtx, control = a && o?.callbacks?.control?.(a);
      return { wall: performance.now(), phase: q.phase, frame: d?.game.frameTime, clock: d?.game.app.clock.snapshot(), elapsed: o?.elapsed,
        systems: d ? Object.entries(d.game.app.systemsByPhase()).flatMap(([phaseName, specs]) => specs.map(spec => {
          const fault = d.game.faultSystems.get(spec);
          return { phase: phaseName, id: spec.id, observed: Boolean(fault), on: fault?.on, faults: fault?.faults, streak: fault?.streak, lastFrame: fault?.lastFrame };
        })) : [], gameDead: d?.game.dead,
        sameGame: d?.game === q.game, entered: d?.arena.entered, targets: d?.arena.activeTargets.length, canvas: document.querySelectorAll('canvas').length, iframes: document.querySelectorAll('iframe').length,
        player: d?.arena.playerVitals, playerPosition: d?.player.position.toArray(), yaw: d?.player.yaw, pitch: d?.player.pitch, loot: o?.loot?.receipt,
        enemy: a ? { kind: a.kind, hp: a.hp, maxHp: a.maxHp, alive: a.alive, hidden: a.hidden, visible: a.mesh.visible, state: a.state, mem: { ...a.mem }, position: a.position.toArray(), control: control ? JSON.parse(control.snapshot()) : null,
          poseInputs: c ? Object.fromEntries(['dt', 't', 'speed', 'strafe', 'phase', 'state', 'alive', 'deathT', 'flinch', 'brace', 'attack', 'yaw'].map(key => [key, c[key]])) : null,
          ...(pose ? { root: { position: a.mesh.position.toArray(), quaternion: a.mesh.quaternion.toArray(), world: a.mesh.matrixWorld.toArray() }, bones: Object.entries(a.bones).map(([name, b]) => ({ name, position: b.position.toArray(), quaternion: b.quaternion.toArray(), world: b.matrixWorld.toArray() })) } : {}) } : null };
    };
    document.addEventListener('pointerdown', e => { if (e.target instanceof Element && e.target.closest('.ws-touch')) q.inputs.push({ wall: performance.now(), phase: q.phase, trusted: e.isTrusted, type: e.pointerType, x: e.clientX, y: e.clientY, target: e.target.className }); }, { capture: true });
    const label = document.createElement('div'); label.style.cssText = 'position:fixed;bottom:2px;left:3px;z-index:9999;background:#000b;color:white;font:10px monospace;pointer-events:none'; document.body.append(label);
    const tick = () => {
      if (!q.recording) return;
      try {
        const o = window.__practiceDemo?.arena.opponent;
        if (o?.bout && o.bout !== q.bout) { q.bout = o.bout; o.events.on('damage.dealt', ({ req, dealt, killed }) => q.hits.push({ ...q.read(), damage: { source: req.source === 'env' ? 'env' : req.source.id, target: req.target.id, dealt, killed, weaponId: req.weaponId ?? null } }), o.bout); }
        const s = q.read(); q.frames.push(s);
        if (s.wall - q.lastPose >= 250) { q.poses.push(q.read(true)); q.lastPose = s.wall; }
        label.textContent = `WIP functional QA | ${q.phase} | ${s.frame?.toFixed(2)}s`;
      } catch (e) { q.errors.push(String(e)); }
      requestAnimationFrame(tick);
    }; tick();
  });
  const sample = () => { assertRunning(); return page.evaluate(() => window.__nineQA.read()); };
  const fresh = s => s.enemy?.alive === true && s.enemy.hp === s.enemy.maxHp && s.player?.health === 100 && s.targets === 1 && s.loot?.coins === 0 && s.loot?.complete === false;
  for (const [kind, coins] of kinds.filter(([k]) => !onlyKind || k === onlyKind)) {
    assertRunning(); await page.selectOption('#arena-opponent', kind); await page.waitForFunction(k => window.__practiceDemo?.arena.activeTargets[0]?.kind === k && !document.querySelector('#arena-opponent').disabled, kind);
    const row = { kind, coins, checks: {}, actions: [], entry: await sample() }; report.enemies.push(row);
    const phase = async name => { row.phase = name; await page.evaluate(p => { window.__nineQA.phase = p; }, `${kind}:${name}`); save(); };
    const screenshot = name => page.screenshot({ path: resolve(out, `${kind}-${name}.jpg`), type: 'jpeg', quality: 78, scale: 'css' });
    const place = async (placementDistance, reason, placementPitch = .08) => { const value = await page.evaluate(({ distance, pitch }) => {
      const d = window.__practiceDemo, a = d.arena.opponent?.targets[0]; if (!a) throw new Error('Retained actor absent: cannot place or infer death');
      const before = d.player.position.toArray(); d.player.spawn(a.position.x, a.position.z + distance, 0, a.position.y); d.player.pitch = pitch;
      return { wall: performance.now(), before, after: d.player.position.toArray(), actor: a.position.toArray(), pitch };
    }, { distance: placementDistance, pitch: placementPitch }); row.actions.push({ type: 'diagnostic-player-placement', reason, ...value }); };
    const retry = async () => { await page.locator('#arena-retry').tap(); await page.waitForFunction(() => window.__practiceDemo?.arena.activeTargets[0]?.alive && !document.querySelector('#arena-retry').disabled); return sample(); };
    row.checks.freshSpawn = fresh(row.entry); await phase('idle-and-real-movement'); await screenshot('spawn');
    const beforeMove = await sample(), box = await page.locator('.ws-touch-stick').boundingBox(); if (!box) throw new Error('Joystick absent');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 22, y: y - 18, id: 1 }] });
    await page.waitForTimeout(1000); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    row.afterMove = await sample(); row.checks.realJoystickMovement = Math.hypot(...row.afterMove.playerPosition.map((v, i) => v - beforeMove.playerPosition[i])) > .05;
    await phase('observe-ai-locomotion'); await place(kind === 'tideRootColossus' ? .85 : 7, kind === 'tideRootColossus' ? 'Stationary colossus attack observation, no translation expectation' : 'AI approach setup only; no enemy movement writes'); row.aiStart = await sample(); await page.waitForTimeout(6000); row.aiEnd = await sample();
    row.observedTranslation = Math.hypot(...row.aiEnd.enemy.position.map((v, i) => v - row.aiStart.enemy.position[i]));
    row.movementContract = kind === 'tideRootColossus' ? 'Authored colossus.face speed0: stationary AI/attack, NOT locomotion' : 'AI approach must translate';
    row.checks.livingOpponentClockAdvances = Number.isFinite(row.aiStart.elapsed) && Number.isFinite(row.aiEnd.elapsed) && row.aiEnd.elapsed > row.aiStart.elapsed + .1;
    if (kind !== 'tideRootColossus') row.checks.aiLocomotion = row.observedTranslation > .05;
    if (mode === 'cycles') {
      await phase('sword-kill'); row.killStart = await retry(); const deadline = Date.now() + 180000; row.attackCount = 0;
      while (Date.now() < deadline) {
        const s = await sample(); if (s.enemy?.alive === false || s.player?.health === 0) break;
        if (!s.enemy) throw new Error('Missing actor does not prove death');
        await place(kind === 'tideRootColossus' ? 2.2 : 1.8, 'Sword functional range; actual touch attack', kind === 'tideRootColossus' ? .03 : .08);
        await page.locator('.ws-touch-attack').tap(); row.attackCount++; await page.waitForTimeout(750);
      }
      row.killed = await sample(); row.checks.actualEnemyDeath = row.killed.enemy?.alive === false && row.killed.enemy.hp <= 0; await screenshot('death');
      row.checks.prototypeDespawn = !kinds.slice(4).some(([k]) => k === kind) || (row.checks.actualEnemyDeath && row.killed.targets === 0 && row.killed.enemy.hidden && !row.killed.enemy.visible);
      await phase('local-loot');
      if (row.checks.actualEnemyDeath) { const lootDeadline = Date.now() + 45000; while (Date.now() < lootDeadline) { await place(.7, 'Actual coin pickup setup, no reward injection'); await page.waitForTimeout(500); if ((await sample()).loot?.complete) break; } }
      row.loot = await sample(); row.checks.localLoot = row.loot.loot?.scope === 'practice' && row.loot.loot.coins === coins && row.loot.loot.complete;
      row.checks.noPostDeathDamage = row.checks.actualEnemyDeath && row.loot.player.health === row.killed.player.health; await screenshot('loot'); await storage();
      await phase('retry-after-kill'); row.retryKill = await retry(); row.checks.retryAfterKill = fresh(row.retryKill);
      await phase('player-defeat'); const defeatDeadline = Date.now() + 180000;
      while (Date.now() < defeatDeadline) { if ((await sample()).player?.health === 0) break; await place(kind === 'brine-puffer' ? 1.6 : .85, 'Enemy attack functional range, no player attack'); await page.waitForTimeout(1200); }
      row.defeat = await sample(); row.checks.actualPlayerDefeat = row.defeat.player?.health === 0; await screenshot('player-defeat');
      await phase('defeated-attack'); await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(750); row.afterDefeatedAttack = await sample();
      row.checks.defeatedAttackBlocked = row.checks.actualPlayerDefeat && row.afterDefeatedAttack.enemy?.hp === row.defeat.enemy?.hp;
      await phase('retry-after-defeat'); row.retryDefeat = await retry(); row.checks.retryAfterDefeat = fresh(row.retryDefeat);
    } else { row.cycleStatus = 'UNTESTED: smoke does not test damage/death/loot/defeat'; }
    await phase('back-start'); await page.locator('#arena-back').tap(); row.back = await sample(); row.checks.back = !row.back.entered && row.back.targets === 0 && row.back.sameGame;
    await page.locator('#arena-start').tap(); await page.waitForFunction(() => window.__practiceDemo?.arena.entered && !document.querySelector('#arena-opponent').disabled); row.restart = await sample(); row.checks.restart = fresh(row.restart) && row.restart.sameGame;
    await storage(); await screenshot('retry');
    const trace = await page.evaluate(() => { const q = window.__nineQA, recorded = { frames: q.frames, poses: q.poses, hits: q.hits, inputs: q.inputs, errors: q.errors }; q.frames = []; q.poses = []; q.hits = []; q.inputs = []; q.errors = []; return recorded; });
    writeFileSync(resolve(out, `${kind}-trace.json`), `${JSON.stringify(trace)}\n`, { flag: 'wx' });
    row.frameCount = trace.frames.length; row.cadence = { first: trace.frames[0]?.wall, last: trace.frames.at(-1)?.wall, rafDeltasMs: trace.frames.slice(1).map((s, i) => s.wall - trace.frames[i].wall) };
    row.checks.noHandledSystemFaults = trace.frames.length > 1 && trace.frames.every(s => s.gameDead === false && s.systems.every(system => !system.observed || (system.on === true && system.faults === 0)));
    row.checks.trainingArenaObservedRunning = trace.frames.some(s => s.entered && s.systems.some(system => system.id === 'training-arena' && system.observed && system.on && system.faults === 0));
    if (kind === 'tideRootColossus') row.checks.stationaryAttackObserved = row.checks.livingOpponentClockAdvances && trace.frames.some(s => s.phase === `${kind}:observe-ai-locomotion` && ['windup', 'active', 'recover'].includes(s.enemy?.control?.strike?.phase));
    row.checks.liveClock = trace.frames.length > 1 && trace.frames.every(s => s.clock?.captureFps === null && s.clock?.scale === 1);
    row.checks.sameGameCanvas = trace.frames.length > 1 && trace.frames.every(s => s.sameGame && s.canvas === 1 && s.iframes === 0);
    row.checks.poseWorldEvidence = trace.poses.some(s => s.enemy?.bones?.length > 0 && s.enemy?.poseInputs && s.enemy.root.world.length === 16);
    row.checks.trustedInputs = trace.inputs.length > 0 && trace.inputs.every(s => s.trusted && s.type === 'touch'); row.checks.observationErrors = trace.errors.length === 0;
    if (mode === 'cycles') {
      row.checks.swordDamage = trace.hits.some(s => s.phase === `${kind}:sword-kill` && s.damage.weaponId && s.damage.dealt > 0 && s.damage.target === `practice.${kind}`);
      row.checks.lethalSwordHit = trace.hits.some(s => s.phase === `${kind}:sword-kill` && s.damage.weaponId && s.damage.killed && s.damage.target === `practice.${kind}`);
      row.checks.enemyDamage = trace.hits.some(s => s.phase === `${kind}:player-defeat` && s.damage.dealt > 0 && s.damage.target !== `practice.${kind}`);
      row.checks.attackCycle = ['windup', 'active', 'recover'].every(p => trace.frames.some(s => s.phase === `${kind}:player-defeat` && s.enemy?.control?.strike?.phase === p));
    }
    save(); console.log(JSON.stringify({ kind, checks: row.checks }));
  }
  await page.evaluate(() => { window.__nineQA.recording = false; }); await page.reload({ waitUntil: 'domcontentloaded' });
  report.checks.reloadLazy = await page.evaluate(() => !window.__practiceDemo && !document.querySelector('#arena-start').hidden); await storage();
  await page.locator('#arena-start').tap(); await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
  report.checks.reloadPlayable = await page.evaluate(() => window.__practiceDemo.arena.activeTargets.length === 1 && window.__practiceDemo.arena.playerVitals.health === 100); await storage();
  report.checks.emptyStores = report.stores.length > 3 && report.stores.every(s => s.local.length === 0 && s.session.length === 0 && s.caches.length === 0 && s.databases.length === 0 && s.workers === 0 && (!s.world || (s.world.generation === 0 && Object.keys(s.world.shard).length === 0 && Object.values(s.world.docs).every(d => Object.keys(d.keys).length === 0))));
  report.checks.noConsoleErrors = report.consoleErrors.length === 0; report.checks.noPageErrors = report.errors.length === 0; report.identityAfter = verify(); report.checks.exactBytesUnchanged = true;
} catch (e) { report.fatal = String(e); if (page) { try { const partial = await page.evaluate(() => { const q = window.__nineQA; if (!q) return null; q.recording = false; return { frames: q.frames, poses: q.poses, hits: q.hits, inputs: q.inputs, errors: q.errors }; }); writeFileSync(resolve(out, 'failure-trace.json'), JSON.stringify(partial), { flag: 'wx' }); } catch (captureError) { report.captureError = String(captureError); } } }
finally {
  try { if (context) { await context.close(); if (page?.video()) { const path = await page.video().path(); const probe = JSON.parse(execFileSync(process.env.FFPROBE_PATH ?? '/usr/bin/ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,r_frame_rate,avg_frame_rate,duration:format=duration', '-of', 'json', path], { encoding: 'utf8' })); report.video = { path, bytes: statSync(path).size, sha256: digest(readFileSync(path)), probe }; report.checks.videoFinalized = Number(probe.streams[0]?.nb_read_frames) > 0; } } } catch (e) { report.videoError = String(e); }
  if (browser) await browser.close(); if (server) await new Promise(_resolve => { server.close(() => { _resolve(); }); });
  report.endedAt = new Date().toISOString(); report.passed = !report.interrupted && !report.fatal && !report.videoError && Object.values(report.checks).every(v => v === true) && report.enemies.length === (onlyKind ? 1 : 9) && report.enemies.every(r => Object.values(r.checks).every(v => v === true));
  report.allNineCompleteCycles = mode === 'cycles' && !onlyKind && report.passed;
  save(); writeFileSync(resolve(out, 'completed-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  if (!report.passed) process.exitCode = 1; console.log(JSON.stringify({ out, passed: report.passed, allNineCompleteCycles: report.allNineCompleteCycles, fatal: report.fatal }));
}
