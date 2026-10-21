/** Exact retained four-product/current-runtime diagnostic. NOT admission or visual acceptance.
 * Run only after root GO, under scripts/browser-lane.sh; --verify-only never opens a browser.
 * No enemy/state/pose/clock writes. Only real touch input and explicitly logged player placement.
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { digest, inventory } from './candidate-inputs.mjs';

const built = resolve(process.argv[2] ?? 'tmp/shared-arena-candidates/current-four-1553');
const output = process.argv[3] ?? '--verify-only';
const snapshotPath = resolve('tmp/dot-audit/shared-candidate-1553-snapshot.json');
const expected = {
  snapshot: '0bb568623d4b8ab3837b576996e7fa3fc50c9aafa3ffb647fe249d90a24f28cf',
  receipt: 'fa72471f89ac5cde9121a1c7744e799e29b17bdd5c41fc6887bf7322dfc2a0b0',
  inventory: '0adff09450aa8e46fd937b35fa0ccbd0badf07718a89ef4d85c82282f277d2a6',
};
function verify() {
  const receiptBytes = readFileSync(resolve(built, 'shared-arena-build.json'));
  const inventoryBytes = readFileSync(resolve(built, 'candidate-inventory.json'));
  const receipt = JSON.parse(receiptBytes), manifest = JSON.parse(inventoryBytes);
  const snapshot = JSON.parse(readFileSync(snapshotPath));
  const actual = inventory(built); delete actual['candidate-inventory.json'];
  if (digest(receiptBytes) !== expected.receipt || digest(inventoryBytes) !== expected.inventory
    || digest(Buffer.from(JSON.stringify(snapshot))) !== expected.snapshot
    || receipt.sourceSnapshotSha256 !== expected.snapshot || !isDeepStrictEqual(actual, manifest.files)
    || receipt.admitted !== false || receipt.localOnly !== true || receipt.products.length !== 4
    || receipt.products.some(row => row.currentSdkValidation !== 'passed')) throw new Error('Exact candidate identity/inventory refusal');
  // The test is a later source-only addition. Never pretend a newly frozen tree produced these bytes.
  return { built, snapshotPath, expected, receipt, fileCount: Object.keys(actual).length,
    sourceClaim: 'Archived build snapshot, not current working-tree parity. Exact served bytes verified before and after run.' };
}
const identity = verify();
if (output === '--verify-only') {
  console.log(JSON.stringify({ status: 'verified; browser NOT run', identity }, null, 2));
} else {
  await run(resolve(output));
}
async function run(out) {
  mkdirSync(out, { recursive: false });
  const report = { schema: 'wildshard.conch-current-candidate.qa.v1', identity, startedAt: new Date().toISOString(),
    acceptance: 'NOT ADMITTED; no model, visual, phone-performance or public acceptance',
    method: 'Muted cloud Chromium iPhone 16 Pro portrait. Engineering player spawn/pitch setup plus genuine touch taps. Legacy PracticeCreature fixed borrowed decision, AnimalView authored numeric pose, NOT PracticeNativeActor. RAF samples are observed cadence, not every fixed tick. Video is Playwright recorder cadence, not native gameplay FPS. No clock overrides, enemy writes, forced hits or forced callbacks.',
    checks: {}, phases: [], actions: [], errors: [] };
  const save = () => writeFileSync(resolve(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  save();
  let browser, context, page, server;
  try {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = resolve(built, url.pathname === '/' ? 'arena.html' : `.${url.pathname}`);
      if (!path.startsWith(`${built}${sep}`)) { res.writeHead(403).end(); return; }
      try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json' })[extname(path)] ?? 'application/octet-stream'); res.end(readFileSync(path)); }
      catch { res.writeHead(404).end(); }
    });
    await new Promise(_resolve => { server.listen(0, '127.0.0.1', () => { _resolve(); }); });
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('No local server address');
    const { chromium, devices } = await import('playwright');
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
      args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
      recordVideo: { dir: resolve(out, 'video'), size: { width: 402, height: 874 } } });
    page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', error => { report.errors.push(error.message); save(); });
    const storage = () => page.evaluate(async () => {
      const saves = window.__practiceDemo?.game.app.saves;
      return { local: Object.keys(localStorage), session: Object.keys(sessionStorage), caches: await caches.keys(),
        databases: await indexedDB.databases(), workers: (await navigator.serviceWorker.getRegistrations()).length,
        world: saves ? { docs: JSON.parse(saves.exportAll()).docs, shard: saves.inspectShard({ id: 'driftwood-isle' }), generation: saves.inspectShardGeneration({ id: 'driftwood-isle' }) } : null };
    });
    await page.goto(`http://127.0.0.1:${address.port}/arena.html`, { waitUntil: 'domcontentloaded' });
    report.storageBefore = await storage();
    report.checks.lazy = await page.evaluate(() => !window.__practiceDemo && document.querySelectorAll('canvas').length === 1);
    await page.locator('#arena-start').tap();
    await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
    await page.selectOption('#arena-opponent', 'conch-duelist');
    await page.waitForFunction(() => window.__practiceDemo?.arena.activeTargets[0]?.kind === 'conch-duelist' && !document.querySelector('#arena-opponent').disabled);
    await page.evaluate(() => {
      const d = window.__practiceDemo;
      // Diagnostics own only this object and this label. Gameplay references are read-only.
      const q = window.__conchQA = { game: d.game, phase: 'entry', frames: [], hits: [], errors: [], recording: true, bout: null, retired: [] };
      const label = document.createElement('div'); label.style.cssText = 'position:fixed;bottom:3px;left:4px;z-index:9999;background:#000c;color:white;font:10px monospace;pointer-events:none'; document.body.append(label);
      q.read = () => {
        const demo = window.__practiceDemo, opponent = demo?.arena.opponent, a = demo?.arena.activeTargets[0];
        const control = a && opponent?.callbacks?.control?.(a);
        const c = a?.rigCtx;
        return { wall: performance.now(), phase: q.phase, frame: demo?.game.frameTime, clock: demo?.game.app.clock.snapshot(),
          entered: demo?.arena.entered, targets: demo?.arena.activeTargets.length, sameGame: demo?.game === q.game,
          canvas: document.querySelectorAll('canvas').length, iframes: document.querySelectorAll('iframe').length,
          legacyOwner: opponent ? opponent.native === null && Boolean(opponent.callbacks) : null,
          legacyElapsed: opponent?.elapsed, fixedRemainder: opponent?.fixedTime,
          player: demo?.arena.playerVitals, loot: opponent?.loot?.receipt,
          enemy: a ? { hp: a.hp, maxHp: a.maxHp, alive: a.alive, state: a.state, stunned: a.stunned, mem: { ...a.mem }, position: a.position.toArray(),
            control: control ? JSON.parse(control.snapshot()) : null,
            poseInputs: c ? structuredClone(Object.fromEntries(['dt', 't', 'speed', 'strafe', 'phase', 'state', 'alive', 'deathT', 'flinch', 'brace', 'attack', 'yaw'].map(key => [key, c[key]]))) : null,
            root: { position: a.mesh.position.toArray(), quaternion: a.mesh.quaternion.toArray(), world: a.mesh.matrixWorld.toArray() },
            bones: Object.entries(a.bones).map(([name, bone]) => ({ name, position: bone.position.toArray(), quaternion: bone.quaternion.toArray(), world: bone.matrixWorld.toArray() })) } : null };
      };
      q.watchBout = () => {
        const opponent = window.__practiceDemo.arena.opponent;
        if (!opponent?.bout || opponent.bout === q.bout) return;
        q.bout = opponent.bout;
        opponent.events.on('damage.dealt', ({ req, dealt, killed }) => {
          q.hits.push({ ...q.read(), damage: { source: req.source === 'env' ? 'env' : req.source.id, target: req.target.id,
            amount: req.amount, dealt, killed, weaponId: req.weaponId ?? null, moveId: req.moveId ?? null, sourceTags: [...req.sourceTags] } });
        }, opponent.bout, { order: -1000 });
      };
      const tick = () => {
        if (!q.recording) return;
        try { q.watchBout(); const row = q.read(); q.frames.push(row); label.textContent = `NOT ADMITTED | engineering placement | ${q.phase} | ${row.frame?.toFixed(2)}s`; }
        catch (error) { q.errors.push(String(error)); }
        requestAnimationFrame(tick);
      }; tick();
    });
    const sample = () => page.evaluate(() => window.__conchQA.read());
    const phase = async name => { report.phases.push({ name, start: await sample() }); await page.evaluate(value => { window.__conchQA.phase = value; }, name); save(); };
    const place = async (distance, reason) => {
      const placement = await page.evaluate(placementDistance => {
        const d = window.__practiceDemo, a = d.arena.activeTargets[0];
        const before = d.player.position.toArray(); d.player.spawn(a.position.x, a.position.z + placementDistance, 0, a.position.y); d.player.pitch = .08;
        return { wall: performance.now(), before, after: d.player.position.toArray(), yaw: 0, pitch: .08 };
      }, distance);
      report.actions.push({ type: 'diagnostic-player-placement', reason, ...placement }); save();
    };
    const tap = async () => { report.actions.push({ type: 'real-touch-attack', before: await sample() }); save(); await page.locator('.ws-touch-attack').tap(); };
    const wait = async (predicate, milliseconds) => {
      const until = Date.now() + milliseconds;
      do { const row = await sample(); if (predicate(row)) return row; await page.waitForTimeout(40); } while (Date.now() < until);
      return null;
    };
    const retry = async label => {
      await phase(label);
      await page.evaluate(() => { const q = window.__conchQA, o = window.__practiceDemo.arena.opponent; q.retired.push({ actor: o.targets[0], bout: o.bout, fixed: o.fixed }); });
      await page.locator('#arena-retry').tap();
      const fresh = await wait(row => row.enemy?.alive && row.enemy.hp === row.enemy.maxHp && row.player.health === 100, 10000);
      report.checks[label] = Boolean(fresh && fresh.loot?.coins === 0 && fresh.loot?.complete === false && fresh.sameGame);
      report.checks[`${label}-retired`] = await page.evaluate(() => { const q = window.__conchQA, old = q.retired.at(-1), a = window.__practiceDemo.arena.activeTargets[0]; return old.bout.disposed && old.actor !== a && !old.actor.alive && old.actor.mesh.parent === null; });
      await page.evaluate(() => window.__conchQA.watchBout());
    };
    report.entry = await sample(); report.checks.legacyOwner = report.entry.legacyOwner === true;
    if (!report.checks.legacyOwner) throw new Error('Exact candidate does not expose inspected legacy owner; no guessed native fallback');
    await phase('uninterrupted-thrust-cycle'); await place(1.8, 'Observe genuine thrust and player damage without attack input');
    report.thrustDamage = await wait(row => row.player.health < 100, 35000);
    await page.waitForTimeout(4000);
    report.checks.thrustDamage = Boolean(report.thrustDamage);
    await retry('retry-after-thrust');
    await phase('guard-real-hit-counter'); await place(1.8, 'Real sword hit during naturally occurring guard');
    const guardEnd = Date.now() + 60000;
    let guardAttempt = 0;
    while (Date.now() < guardEnd && guardAttempt < 12) {
      const guard = await wait(row => row.enemy?.alive && row.enemy.mem['conch-guard'] === 1 && row.enemy.control?.strike.currentId === 'strike.conch-duelist.thrust', 8000);
      if (!guard) break;
      await tap(); guardAttempt++;
      const counter = await wait(row => row.enemy?.control?.strike.currentId === 'strike.conch-duelist.counter', 5000);
      if (counter) { report.counter = counter; await page.waitForTimeout(3500); break; }
      const current = await sample(); if (!current.enemy?.alive || current.player.health === 0) break;
      await place(1.8, 'Reacquire actual sword range after real stagger');
    }
    report.guardAttempts = guardAttempt;
    await retry('retry-before-lethal');
    await phase('real-hit-and-lethal-interruption');
    const killEnd = Date.now() + 120000;
    let attacks = 0;
    while (Date.now() < killEnd && attacks < 40) {
      const current = await sample(); if (!current.enemy?.alive || current.player.health === 0) break;
      await place(1.8, 'Real sword range; no enemy health/state mutation');
      // Seek a genuine live attack window; unavailable phases remain genuine failures.
      const attacking = await wait(row => !row.enemy?.alive || ['windup', 'active'].includes(row.enemy?.control?.strike.phase), 6000);
      if (!attacking?.enemy?.alive) break;
      await tap(); attacks++; await page.waitForTimeout(550);
    }
    report.afterLethal = await sample(); report.attackCount = attacks;
    report.checks.enemyKilled = report.afterLethal.enemy?.alive === false;
    await phase('post-death-nearby-observation');
    if (report.checks.enemyKilled) await place(.85, 'Stay inside real attack range after enemy death');
    await page.waitForTimeout(6500); report.afterDeathWait = await sample();
    report.checks.noPostDeathDamage = report.checks.enemyKilled && report.afterDeathWait.player.health >= report.afterLethal.player.health;
    await page.screenshot({ path: resolve(out, 'post-death.jpg'), type: 'jpeg', quality: 80 });
    report.storageAfterDeath = await storage();
    await retry('retry-after-lethal');
    await phase('back-cleanup');
    await page.evaluate(() => { const q = window.__conchQA, o = window.__practiceDemo.arena.opponent; q.backOwner = { actor: o.targets[0], bout: o.bout, opponent: o }; });
    await page.locator('#arena-back').tap();
    report.back = await sample();
    report.checks.backDisposed = await page.evaluate(() => { const old = window.__conchQA.backOwner; return old.bout.disposed && !old.actor.alive && old.actor.mesh.parent === null && old.opponent.fixed.size === 0 && old.opponent.targets.length === 0; });
    report.checks.back = report.back.entered === false && report.back.targets === 0 && report.back.sameGame;
    await phase('restart-shared-game'); await page.locator('#arena-start').tap();
    await page.waitForFunction(() => window.__practiceDemo?.arena.entered && !document.querySelector('#arena-opponent').disabled);
    report.restart = await sample();
    report.checks.restart = report.restart.sameGame && report.restart.player.health === 100 && report.restart.enemy?.hp === report.restart.enemy?.maxHp;
    report.storageAfterRestart = await storage();
    await page.evaluate(() => { window.__conchQA.recording = false; });
    const trace = await page.evaluate(() => { const q = window.__conchQA; return { frames: q.frames, hits: q.hits, errors: q.errors }; });
    writeFileSync(resolve(out, 'trace.json'), `${JSON.stringify(trace)}\n`, { flag: 'wx' });
    const frames = trace.frames, hits = trace.hits;
    const weaponHits = hits.filter(row => row.damage.target === 'practice.conch-duelist' && row.damage.dealt > 0 && row.damage.weaponId !== null);
    const liveGuardHits = weaponHits.filter(row => row.phase === 'guard-real-hit-counter' && !row.damage.killed && row.enemy.mem['conch-guard'] === 1);
    report.checks.realWeaponHit = weaponHits.length > 0;
    report.checks.guardCounter = liveGuardHits.some(hit => frames.some(row => row.phase === hit.phase && row.wall > hit.wall && row.enemy?.control?.strike.currentId === 'strike.conch-duelist.counter'));
    report.checks.counterRecovery = frames.some(row => row.phase === 'guard-real-hit-counter' && row.enemy?.control?.strike.currentId === 'strike.conch-duelist.counter' && row.enemy.control.strike.phase === 'recover');
    report.checks.counterDamage = hits.some(row => row.phase === 'guard-real-hit-counter' && row.damage.target !== 'practice.conch-duelist' && row.damage.dealt > 0 && row.enemy?.control?.strike.currentId === 'strike.conch-duelist.counter');
    report.checks.realHitInterruption = weaponHits.some(hit => !hit.damage.killed && frames.some(row => row.wall > hit.wall && row.wall - hit.wall < 2000 && row.phase === hit.phase && row.enemy?.stunned === true && [2, 4].includes(row.enemy.mem['conch-st'])));
    report.checks.counterActive = frames.some(row => row.phase === 'guard-real-hit-counter' && row.enemy?.control?.strike.currentId === 'strike.conch-duelist.counter' && row.enemy.control.strike.phase === 'active');
    report.checks.thrustCycle = ['windup', 'active', 'recover'].every(strikePhase => frames.some(row => row.phase === 'uninterrupted-thrust-cycle' && row.enemy?.control?.strike.currentId === 'strike.conch-duelist.thrust' && row.enemy.control.strike.phase === strikePhase));
    report.lethalEvidence = weaponHits.filter(row => row.damage.killed).map(hit => ({ hit, precedingFrame: frames.findLast(row => row.wall <= hit.wall && row.enemy?.alive) }));
    report.checks.lethalInterruption = report.lethalEvidence.some(({ hit, precedingFrame: before }) => before && hit.wall - before.wall <= 500 && ['windup', 'active'].includes(before.enemy.control?.strike.phase));
    report.checks.noPostDeathDamageEvents = report.checks.enemyKilled && !hits.some(row => row.phase === 'post-death-nearby-observation' && row.damage.dealt > 0);
    report.checks.singleGame = frames.every(row => row.sameGame && row.canvas === 1 && row.iframes === 0);
    report.checks.liveClock = frames.every(row => row.clock?.captureFps === null && row.clock?.scale === 1);
    report.checks.poseObserved = frames.some(row => row.enemy?.poseInputs && row.enemy.bones.length > 0);
    report.cadence = { samples: frames.length, rafDeltasMs: frames.slice(1).map((row, index) => row.wall - frames[index].wall),
      simulationDeltas: frames.slice(1).map((row, index) => row.frame - frames[index].frame), method: 'Observed RAF intervals; no fixed-rate or physical-device claim' };
    report.observationErrors = trace.errors;
    report.evidenceCounts = { weaponHits: weaponHits.length, liveGuardHits: liveGuardHits.length, lethalHits: report.lethalEvidence.length };
    report.unavailableOrFailed = Object.entries(report.checks).filter(([, passed]) => !passed).map(([check]) => ({ check, outcome: 'Not established by bounded genuine input/observation; inspect trace. No synthesized phase or callback.' }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    report.checks.reloadLazy = await page.evaluate(() => !window.__practiceDemo && !document.querySelector('#arena-start').hidden);
    report.storageAfterReload = await storage();
    report.checks.emptyStores = [report.storageBefore, report.storageAfterDeath, report.storageAfterRestart, report.storageAfterReload].every(s => s.local.length === 0 && s.session.length === 0 && s.caches.length === 0 && s.databases.length === 0 && s.workers === 0
      && (!s.world || (s.world.generation === 0 && Object.keys(s.world.shard).length === 0 && Object.values(s.world.docs).every(doc => Object.keys(doc.keys).length === 0))));
    report.checks.noErrors = report.errors.length === 0 && trace.errors.length === 0;
    report.identityAfter = verify(); report.checks.exactBytesUnchanged = true;
  } catch (error) {
    report.fatal = String(error); process.exitCode = 1;
    if (page) {
      try { const partial = await page.evaluate(() => { const q = window.__conchQA; if (!q) return null; q.recording = false; return { frames: q.frames, hits: q.hits, errors: q.errors }; }); writeFileSync(resolve(out, 'failure-trace.json'), `${JSON.stringify(partial)}\n`, { flag: 'wx' }); }
      catch (captureError) { report.failureCaptureError = String(captureError); }
    }
  } finally {
    try { if (context) { await context.close(); if (page?.video()) { const path = await page.video().path(); report.video = { path, bytes: statSync(path).size, sha256: digest(readFileSync(path)), method: 'Playwright complete-context video; recorder cadence differs from observed game cadence' }; report.checks.videoFinalized = report.video.bytes > 0; } } } catch (error) { report.videoCloseError = String(error); }
    try { if (browser) await browser.close(); } finally { if (server) await new Promise(_resolve => { server.close(() => { _resolve(); }); }); }
    report.endedAt = new Date().toISOString(); report.passed = !report.fatal && !report.videoCloseError && Object.values(report.checks).every(value => value === true);
    if (!report.passed) process.exitCode = 1;
    save(); writeFileSync(resolve(out, 'completed-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ out, passed: report.passed, checks: report.checks, fatal: report.fatal }));
  }
}
