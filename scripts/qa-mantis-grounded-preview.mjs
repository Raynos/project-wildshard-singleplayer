/** Actual Mantis-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.MANTIS_QA_OUT ?? 'tmp/mantis-grounded-qa';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.mantis.combat-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.MANTIS_QA_DIST ?? 'tmp/mantis-grounded-preview-dist');
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4467, '127.0.0.1', resolve); });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.MANTIS_QA_URL ?? 'http://127.0.0.1:4467/', { waitUntil: 'domcontentloaded' });
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
  const capture = async name => { await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85, scale: 'css' }); };
  report.entry = await sample(); save(); await capture('entry');
  report.checks.onlyMantis = report.entry.enemy.kind === 'splinter-mantis' && report.entry.targets === 1;
  // Observe unchanged decision and both actual attack stages before player attacks.
  await place(3.2);
  const stages = new Set(), end = Date.now() + 100000;
  while (Date.now() < end) {
    await aim(); await page.waitForTimeout(500); const row = await sample(); report.samples.push({ phase: 'defense', ...row });
    stages.add(row.enemy.mem['mantis-st']); save();
    if (stages.has(1) && stages.has(3) && row.player.health?.health < 100) break;
    if (row.player.health?.health === 0) break;
  }
  report.defense = await sample(); await capture('both-strikes-observation');
  report.checks.firstAndSecond = stages.has(1) && stages.has(3);
  report.checks.actualPlayerDamage = report.defense.player.health?.health < 100;
  report.storageAfterDefense = await storage();
  report.stateAfterDefense = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600);
  report.retryAfterDefense = await sample();
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
    await place(1.4); const hp = report.afterSword.player.health?.health;
    const endDeath = Date.now() + 30000;
    while (Date.now() < endDeath) {
      await page.waitForTimeout(1000); const row = await sample(); report.samples.push({ phase: 'corpse-reward', ...row }); save();
      if (row.loot?.complete === true) break;
    }
    report.corpse = await sample(); await capture('corpse-reward');
    report.checks.noPostDeathStrike = report.corpse.player.health?.health === hp;
    report.checks.boutLocalReward = report.corpse.loot?.scope === 'practice' && report.corpse.loot?.coins === 3 && report.corpse.loot?.complete === true;
  }
  report.storageAfterReward = await storage();
  report.stateAfterReward = await stateStore();
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  report.checks.retry = report.retry.enemy.hp === 55 && report.retry.enemy.alive === true && report.retry.player.health?.health === 100
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
  report.checks.finalRetry = report.finalRetry.enemy.hp === 55 && report.finalRetry.player.health?.health === 100;
  report.storageAfterDefeatRetry = await storage();
  report.stateAfterDefeatRetry = await stateStore();
  report.checks.emptyStorage = [report.storageBefore, report.storageAfterDefense, report.storageAfterReward, report.storageAfterRetry, report.storageAfterDefeatRetry]
    .every(row => Object.keys(row.local).length === 0 && Object.keys(row.session).length === 0);
  const states = [report.stateBeforeCombat, report.stateAfterDefense, report.stateAfterReward, report.stateAfterRetry, report.stateAfterDefeatRetry];
  report.checks.emptyUnchangedStateStore = states.every(row => JSON.stringify(row) === JSON.stringify(states[0])
    && Object.keys(row.shard).length === 0 && row.generation === 0
    && Object.values(row.docs).every(doc => Object.keys(doc.keys).length === 0));
  report.checks.errors = report.errors.length === 0;
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  await context.close();
} catch (error) { report.fatal = error.message; process.exitCode = 1; }
finally { await browser.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
