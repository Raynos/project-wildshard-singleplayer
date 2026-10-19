/** Bounded standalone arena proof, not the Explorer physics-baseline gate.
 * Only diagnostic player placement, yaw and ordinary inputs are written. */
import { chromium, devices } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve as resolvePath, relative, extname, sep } from 'node:path';

const required = name => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
const url = required('BELLBACK_QA_URL'), out = required('BELLBACK_QA_OUT');
const previewPath = required('BELLBACK_QA_PREVIEW'), manifestPath = required('BELLBACK_QA_MANIFEST');
const hostPinPath = required('BELLBACK_QA_HOST_PINS');
const source = required('CAPTURE_SOURCE'), dist = resolvePath(required('BELLBACK_QA_DIST'));
const executablePath = required('CHROME_PATH');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const preview = JSON.parse(readFileSync(previewPath, 'utf8'));
if (preview.sourceHash !== source || preview.mode !== 'pose-following4') throw new Error('Candidate4 product pin mismatch');
const files = JSON.parse(readFileSync(manifestPath, 'utf8'));
const hostPins = JSON.parse(readFileSync(hostPinPath, 'utf8'));
if (hostPins.sourceHash !== source) throw new Error('Host pin product mismatch');
const verifyHost = () => { for (const row of hostPins.files) { const bytes = readFileSync(row.path); if (hash(bytes) !== row.sha256 || bytes.length !== row.bytes) throw new Error(`Host drift: ${row.path}`); } };
verifyHost();
for (const row of files) { const bytes = readFileSync(row.path); if (hash(bytes) !== row.sha256 || bytes.length !== row.bytes) throw new Error(`Build drift: ${row.path}`); }
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.bellback.arena-walk.v1', source, url, started: new Date().toISOString(),
  pins: { host: hash(readFileSync(hostPinPath)), preview: hash(readFileSync(previewPath)), manifest: hash(readFileSync(manifestPath)), script: hash(readFileSync(new URL(import.meta.url))) },
  scope: 'Standalone arena only. Explorer physics-baseline and six-shard coverage remain open. Cloud diagnostic, not physical phone acceptance.',
  errors: [], legs: [], placements: [], servedPins: [], checks: {} };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
let browser;
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', url).pathname;
  const path = resolvePath(dist, pathname === '/' ? 'index.html' : `.${pathname}`);
  if (!path.startsWith(`${dist}${sep}`)) { response.writeHead(403).end(); return; }
  try { response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream'); response.end(readFileSync(path)); }
  catch { response.writeHead(404).end(); }
});
try {
  await new Promise(resolve => { server.listen(Number(new URL(url).port), '127.0.0.1', resolve); });
  for (const row of files) {
    const path = relative(dist, resolvePath(row.path)); if (path.startsWith('..')) continue;
    const response = await fetch(new URL(path, url));
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || hash(bytes) !== row.sha256 || bytes.length !== row.bytes) throw new Error(`Served byte mismatch: ${path}`);
    report.servedPins.push({ path, sha256: row.sha256, bytes: row.bytes });
  }
  if (report.servedPins.length === 0) throw new Error('No served build files verified');
  browser = await chromium.launch({ executablePath, headless: true, args: ['--mute-audio'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  const boot = async () => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.locator('#practice-start').tap(); await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true, undefined, { timeout: 120000 }); };
  const sample = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0], world = d.player.physics.world, colliders = [];
    world.forEachCollider(c => colliders.push({ handle: c.handle, groups: c.collisionGroups(), solver: c.solverGroups(), sensor: c.isSensor(), enabled: c.isEnabled(), shape: c.shapeType(), position: c.translation() }));
    return { frame: d.game.frameCount, time: d.game.frameTime, player: d.player.position.toArray(), health: d.arena.playerVitals.health,
      enemy: { hp: a.hp, alive: a.alive, position: a.position.toArray(), ragdoll: a.ragdoll ? { state: a.ragdoll.state, bodies: a.ragdoll.bodies } : null },
      colliders, loot: d.arena.opponent.loot.receipt,
      persistence: { local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])), session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])), docs: JSON.parse(d.game.app.saves.exportAll()).docs,
        shard: d.game.app.saves.inspectShard({ id: 'driftwood-isle' }), generation: d.game.app.saves.inspectShardGeneration({ id: 'driftwood-isle' }) } };
  });
  const place = async (placeX, placeZ, placeYaw = 0) => { report.placements.push(await page.evaluate(({ x, z, yaw }) => {
    const d = window.__practiceDemo; d.game.app.input.clear(); d.player.spawn(x, z, yaw, 900);
    return { reason: 'Diagnostic player placement only; subsequent movement uses real CharacterMotor', x, z, yaw, frame: d.game.frameCount };
  }, { x: placeX, z: placeZ, yaw: placeYaw })); await page.waitForTimeout(600); };
  const walk = async (legName, targetX, targetZ, wallLeg = false) => {
    const leg = await page.evaluate(async ({ name, x, z, wall }) => {
      const d = window.__practiceDemo, p = d.player, trace = [], stuck = [];
      let t = 0, last = { t: 0, distance: Infinity }, reached = false;
      await new Promise(resolve => {
        let stop = () => undefined;
        stop = d.game.watchFrames(dt => {
          t += dt; const dx = x - p.position.x, dz = z - p.position.z, distance = Math.hypot(dx, dz);
          const debris = []; p.physics.world.forEachCollider(c => { if (c.collisionGroups() >>> 16 === 64) debris.push(c.translation()); });
          trace.push({ t, feet: p.position.toArray(), ground: p.onGround, frame: d.game.frameCount, debris });
          if (distance < .8) reached = true;
          if (distance < last.distance - .3) last = { t, distance };
          const blocked = t - last.t > 2;
          if (blocked && !wall) stuck.push({ t, feet: p.position.toArray() });
          if (reached || blocked || t > 20) { d.game.app.input.clear(); stop(); resolve(); return; }
          p.yaw = Math.atan2(-dx, -dz); d.game.app.input.setHeld('move.forward', true);
        });
      });
      return { name, target: [x, z], reached, wall, stuck, trace };
    }, { name: legName, x: targetX, z: targetZ, wall: wallLeg });
    report.legs.push(leg); save(); return leg;
  };
  await boot(); report.entry = await sample();
  report.baselineCompatibility = await page.evaluate(() => ({ explorerWorld: window.__wildshard?.world !== undefined, arena: window.__practiceDemo !== undefined }));
  await place(-20, 20); await walk('free-east', -12, 20);
  await walk('free-north', -12, 12);
  await place(46, 20); const wall = await walk('east-wall-containment', 55, 20, true);
  report.checks.wallContains = !wall.reached && wall.trace.length > 0 && wall.trace.every(row => row.feet[0] < 50 && row.feet[1] > 899.8);
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600);
  for (let attempt = 0; attempt < 24; attempt++) {
    const row = await sample(); if (!row.enemy.alive || row.health === 0) break;
    const [x, , z] = row.enemy.position; await place(x, z + 2.2);
    await page.evaluate(() => { window.__practiceDemo.player.pitch = .03; });
    await page.locator('.ws-touch-attack').tap();
    for (let beat = 0; beat < 10; beat++) { await page.waitForTimeout(100); if (!(await sample()).enemy.alive) break; }
  }
  report.afterCombat = await sample(); report.checks.realDefeat = !report.afterCombat.enemy.alive;
  if (report.checks.realDefeat) {
    report.corpse = await sample();
    const debris = report.corpse.colliders.filter(c => c.groups >>> 16 === 64);
    report.checks.eightCorpseColliders = debris.length === 8;
    report.checks.debrisWorldOnly = debris.length === 8 && debris.every(c => c.groups === 4194305 && c.solver === 4194305 && !c.sensor);
    report.sensorEvidence = { sensors: report.corpse.colliders.filter(c => c.sensor), note: 'No sensor added or triggered artificially. Filter proof only if no authored sensor exists.' };
    const center = debris.reduce((v, c) => [v[0] + c.position.x / debris.length, v[1] + c.position.z / debris.length], [0, 0]);
    if (debris.length === 8) {
      await place(center[0], center[1] + 3); await walk('corpse-north-crossing', center[0], center[1] - 3);
      await place(center[0] - 3, center[1]); await walk('corpse-east-crossing', center[0] + 3, center[1]);
    }
    report.checks.liveCorpseCrossed = report.legs.filter(leg => leg.name.startsWith('corpse')).some(leg => leg.trace.some(row => row.debris.some(c => Math.hypot(row.feet[0] - c.x, row.feet[2] - c.z) < .6)));
    report.afterCrossings = await sample();
    report.checks.corpseNoDamage = report.afterCrossings.health === report.corpse.health;
    await page.waitForTimeout(6000); report.settled = await sample();
    report.checks.nativeFreezeRemovesBodies = report.settled.enemy.ragdoll?.state === 'frozen' && !report.settled.colliders.some(c => c.groups >>> 16 === 64);
  }
  await page.locator('#practice-retry').tap(); await page.waitForTimeout(600); report.retry = await sample();
  report.checks.retryClearsCorpse = report.retry.enemy.alive && report.retry.enemy.hp === 180 && report.retry.health === 100 && !report.retry.colliders.some(c => c.groups >>> 16 === 64);
  report.checks.emptyStore = Object.keys(report.entry.persistence.local).length === 0 && Object.keys(report.entry.persistence.session).length === 0 && report.entry.persistence.generation === 0 && Object.keys(report.entry.persistence.shard).length === 0 && Object.values(report.entry.persistence.docs).every(doc => Object.keys(doc.keys).length === 0);
  report.checks.persistenceUnchanged = JSON.stringify(report.entry.persistence) === JSON.stringify(report.retry.persistence);
  await boot(); report.reentry = await sample();
  report.checks.reentry = report.reentry.enemy.alive && report.reentry.enemy.hp === 180 && report.reentry.health === 100;
  report.checks.reentryPersistence = JSON.stringify(report.entry.persistence) === JSON.stringify(report.reentry.persistence);
  report.checks.zeroStuck = report.legs.filter(leg => !leg.wall).length === 4 && report.legs.filter(leg => !leg.wall).every(leg => leg.reached && leg.stuck.length === 0);
  report.checks.errors = report.errors.length === 0;
  verifyHost(); report.checks.hostPinsUnchanged = true;
  await context.close();
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
} catch (error) { report.fatal = error instanceof Error ? error.message : String(error); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => { server.close(resolve); }); report.ended = new Date().toISOString(); save(); }
