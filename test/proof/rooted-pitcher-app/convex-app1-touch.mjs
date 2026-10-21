/** Read-only measurements plus real UI input against the newly pinned convex1, never a rebuild.
 * Root must checkpoint/review this file and authorize the canonical browser lane before running.
 * ROOTED_PITCHER_CONVEX_GO=reviewed-convex1-touch-contact-persistence is an execution guard, not approval.
 */
// Node-only test driver: never bundled into the game or a public host.
/* eslint-disable import/no-nodejs-modules */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, extname, sep } from 'node:path';
import process from 'node:process';
import { chromium, devices } from 'playwright';

const ROOT = resolve(import.meta.dirname, '../../..');
const dist = join(ROOT, 'tmp/rooted-pitcher-convex1/dist');
const out = join(ROOT, 'tmp/rooted-pitcher-convex1/touch-contact-persistence');
const hash = b => createHash('sha256').update(b).digest('hex');
const pinPath = 'docs/reviews/rooted-pitcher-app/ROOTED-PITCHER-CONVEX-PIN1.json';
const pinBytes = readFileSync(join(ROOT, pinPath)), pin = JSON.parse(pinBytes);
const receiptBytes = readFileSync(join(dist, 'rooted-pitcher-proof.json')), receipt = JSON.parse(receiptBytes);
const sourceCommit = '82bf5559ff71324f6a0a0fe1327367932912130e';
const git = args => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const inventory = (dir, prefix = '') => Object.fromEntries(readdirSync(dir).sort().flatMap(name => {
  const path = join(dir, name), stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error('Symlink in retained host');
  return stat.isDirectory() ? Object.entries(inventory(path, `${prefix}${name}/`)) : [[`${prefix}${name}`, hash(readFileSync(path))]];
}));
const same = (a, b) => JSON.stringify(Object.entries(a).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0)) === JSON.stringify(Object.entries(b).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0));
const hostFiles = inventory(dist); delete hostFiles['rooted-pitcher-proof.json'];
if (hash(pinBytes) !== '19686876ac71d5150da5afda950336f57e9cf1f6b6275b8192d7f577c2ba549f'
  || (!/^[a-f0-9]{64}$/u.test(process.env.ROOTED_PITCHER_RECEIPT_SHA256 ?? '') || hash(receiptBytes) !== process.env.ROOTED_PITCHER_RECEIPT_SHA256)
  || pin.sourceCommit !== sourceCommit || String(git(['rev-parse', `${sourceCommit}^{tree}`])).trim() !== pin.sourceTree
  || receipt.pinSha256 !== hash(pinBytes) || JSON.stringify(receipt.pin) !== JSON.stringify(pin)
  || !same(hostFiles, receipt.hostFiles) || pin.synthetic !== false || receipt.synthetic !== false
  || receipt.modelAdmission !== false || receipt.publicAdmission !== false) throw new Error('Frozen convex1 identity mismatch');
const historicalFiles = ['src/rootedPitcherProof.ts', 'src/rootedPitcherProofBoot.ts',
  'src/engine/practice/TrainingArena.ts', 'src/engine/physics/nativeRigidCorpse.ts',
  'src/game/practice/PracticeNativeActor.ts', 'src/game/practice/practiceConvexBody.ts',
  'src/engine/entities/AnimalSim.ts', 'src/engine/physics/CharacterMotor.ts', 'src/game/plugin/animation.ts'];
for (const path of historicalFiles) if (hash(git(['show', `${sourceCommit}:${path}`])) !== pin.sourceFiles[path])
  throw new Error(`Historical source mismatch: ${path}`);
if (process.argv.includes('--verify-only')) {
  console.info('Retained host inventory, exact supplied receipt/convex PIN1, historical tree and measurement source identity verified; no browser launched.');
} else {
  await runSupplement();
}
async function runSupplement() {
  if (process.env.ROOTED_PITCHER_CONVEX_GO !== 'reviewed-convex1-touch-contact-persistence') throw new Error('Root review/checkpoint and browser GO required');
  const chrome = join(ROOT, 'tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell');
  if (process.env.CHROME_PATH !== chrome) throw new Error('Use installed approved Chrome shell only');
  if (existsSync(out)) throw new Error('Preserve existing supplemental evidence');
  mkdirSync(out);
  const report = { schema: 'wildshard.rooted-pitcher.convex1-touch-contact.v1', sourceCommit,
    hostReceiptSha256: hash(receiptBytes), pinSha256: hash(pinBytes), historicalFiles,
    testSha256: hash(readFileSync(import.meta.filename)), startedAt: new Date().toISOString(),
    synthetic: false, modelAdmission: false, publicAdmission: false, stores: [], contacts: [], inputs: [], traceFiles: [],
    errors: [], requests: [], deniedRequests: [], checks: {},
    method: 'Empty isolated browser context. Service workers blocked, but getRegistrations explicitly queried. No enemy HP, clock or pose writes. Real joystick, LOOK drags and attack UI. Read-only hitbox centres guide the LOOK input; per-collider origin containment and centre-ray queries are diagnostic, not the full sword sweep or broadphase; no game state setters or direct attack invocation. RAF observer copies clocks, last pose inputs and existing world transforms without advancing any owner. Query shape-to-shape distance, not solver impulses: fixed-fixed bodies need not produce solver contact pairs.',
    limitations: 'Engineering supplement only. Held-death/no-fold, not model or public admission. Persistence result covers this fresh origin/context only. Cloud touch emulation is not physical iPhone navigation/performance.' };
  const save = () => writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  async function readStores() {
    const query = async (api, run) => { try { return { api, ok: true, value: await run() }; }
      catch (error) { return { api, ok: false, error: String(error) }; } };
    return { performanceNow: performance.now(),
      local: await query('Object.keys(localStorage)/getItem', () => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]))),
      session: await query('Object.keys(sessionStorage)/getItem', () => Object.fromEntries(Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)]))),
      indexedDB: await query('indexedDB.databases()', () => indexedDB.databases()),
      caches: await query('caches.keys()', () => caches.keys()),
      serviceWorkers: await query('navigator.serviceWorker.getRegistrations()', async () =>
        (await navigator.serviceWorker.getRegistrations()).map(r => ({ scope: r.scope, active: r.active?.scriptURL ?? null, waiting: r.waiting?.scriptURL ?? null, installing: r.installing?.scriptURL ?? null }))),
      saveStore: await query('game.app.saves.exportAll().docs', () => window.__practiceDemo ? JSON.parse(window.__practiceDemo.game.app.saves.exportAll()).docs : null) };
  }
  function readContact() {
    const d = window.__practiceDemo, native = d.arena.opponent.native, resource = native.corpse.resource;
    const body = resource.body, world = native.host.physics.world, R = native.host.physics.R;
    const piece = d.game.app.registry.get('practice-arena');
    const desc = piece?.colliders?.[0];
    if (desc?.kind !== 'box' || desc.hx !== 50 || desc.hy !== 2 || desc.hz !== 50) throw new Error('Actual arena floor descriptor unavailable');
    const close = (a, b) => Math.abs(a - b) < 1e-5;
    const floors = [];
    world.forEachCollider(c => {
      if (c.shapeType() !== R.ShapeType.Cuboid || !c.isEnabled() || c.isSensor()) return;
      const p = c.translation(), h = c.halfExtents(), q = c.rotation();
      if (close(p.x, desc.x) && close(p.y, desc.y) && close(p.z, desc.z)
        && close(h.x, desc.hx) && close(h.y, desc.hy) && close(h.z, desc.hz)
        && close(q.x, 0) && close(q.y, 0) && close(q.z, 0) && close(Math.abs(q.w), 1)) floors.push(c);
    });
    if (floors.length !== 1) throw new Error(`Expected one matching actual arena slab, found ${floors.length}`);
    const floor = floors[0], floorY = floor.translation().y + floor.halfExtents().y;
    const root = d.arena.opponent.targets[0].mesh;
    const transform = (c, v) => root.position.clone().set(v[0], v[1], v[2])
      .applyQuaternion(c.rotation()).add(c.translation()).toArray();
    const colliders = Array.from({ length: body.numColliders() }, (_, i) => {
      const c = body.collider(i), vertices = c.vertices();
      if (!vertices || vertices.length < 12) throw new Error('Native convex collider vertices unavailable');
      const worldVertices = [];
      for (let j = 0; j < vertices.length; j += 3) worldVertices.push(transform(c, vertices.slice(j, j + 3)));
      const contact = c.contactCollider(floor, 100), playerContact = c.contactCollider(d.player.motor.collider, 100);
      if (!playerContact || !Number.isFinite(playerContact.distance)) throw new Error('Native player distance unavailable');
      if (!contact || !Number.isFinite(contact.distance)) throw new Error('Native floor distance unavailable');
      return { handle: c.handle, bone: resource.parts.find(p => p.collider.handle === c.handle)?.bone ?? null,
        shapeType: c.shapeType(), enabled: c.isEnabled(), sensor: c.isSensor(), groups: c.collisionGroups(),
        translation: { ...c.translation() }, rotation: { ...c.rotation() }, localVertices: Array.from(vertices), worldVertices,
        worldMinY: Math.min(...worldVertices.map(v => v[1])), playerContact: { distance: playerContact.distance, point1: { ...playerContact.point1 }, point2: { ...playerContact.point2 } }, contact: { distance: contact.distance,
          point1: { ...contact.point1 }, point2: { ...contact.point2 }, normal1: { ...contact.normal1 }, normal2: { ...contact.normal2 } } };
    });
    // Read existing rendered matrixWorld and per-vertex skinning; do NOT update matrices, skeleton or pose.
    const meshes = [];
    root.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
      const p = root.position.clone(), count = mesh.geometry.attributes.position.count;
      let minY = Infinity, minVertex = null;
      for (let i = 0; i < count; i++) { mesh.getVertexPosition(i, p); p.applyMatrix4(mesh.matrixWorld);
        if (p.y < minY) { minY = p.y; minVertex = p.toArray(); } }
      meshes.push({ name: mesh.name, skinned: mesh.isSkinnedMesh === true, vertices: count,
        matrixWorld: mesh.matrixWorld.toArray(), minY, minVertex });
    });
    if (meshes.length === 0 || meshes.some(m => !Number.isFinite(m.minY))) throw new Error('Source mesh world minimum unavailable');
    return { performanceNow: performance.now(), nativeClock: { frame: native.host.clock.frame, now: native.host.clock.now },
      body: { handle: body.handle, fixed: body.isFixed(), enabled: body.isEnabled(), translation: { ...body.translation() }, rotation: { ...body.rotation() } },
      floor: { descriptor: desc, handle: floor.handle, translation: { ...floor.translation() }, rotation: { ...floor.rotation() }, halfExtents: { ...floor.halfExtents() }, floorY },
      playerCollider: { handle: d.player.motor.collider.handle, radius: d.player.motor.collider.radius(), halfHeight: d.player.motor.collider.halfHeight(), translation: { ...d.player.motor.collider.translation() } },
      colliders, meshes, minimumPlayerDistance: Math.min(...colliders.map(c => c.playerContact.distance)), minimumColliderClearance: Math.min(...colliders.map(c => c.worldMinY - floorY)),
      minimumMeshClearance: Math.min(...meshes.map(m => m.minY - floorY)),
      minimumContactDistance: Math.min(...colliders.map(c => c.contact.distance)) };
  }
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = resolve(dist, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
    if (!path.startsWith(`${dist}${sep}`) || !Object.hasOwn(hostFiles, path.slice(dist.length + 1))) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' })[extname(path)] ?? 'application/octet-stream');
    const bytes = readFileSync(path);
    if (hash(bytes) !== hostFiles[path.slice(dist.length + 1)]) { response.writeHead(409).end(); return; }
    response.end(bytes);
  });
  await new Promise(_resolve => { server.listen(0, '127.0.0.1', () => { _resolve(); }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser, context, page, video;
  const preserveRaf = async label => {
    if (!page || page.isClosed()) return;
    const trace = await page.evaluate(() => window.__convexTouchTrace ?? null);
    if (!trace) throw new Error('Missing read-only RAF observations');
    const bytes = Buffer.from(JSON.stringify(trace));
    writeFileSync(join(out, `${label}-trace.json`), bytes, { flag: 'wx' });
    report.traceFiles.push({ file: `${label}-trace.json`, bytes: bytes.length, sha256: hash(bytes), rows: trace.rows.length,
      errors: trace.errors, overflow: trace.overflow });
    report.checks.traceComplete = report.traceFiles.every(t => !t.overflow && t.errors.length === 0);
    const living = trace.rows.filter(r => r.alive && r.motor.enabled);
    const near = (a, b) => a.length === b.length && a.every((n, i) => Math.abs(n - b[i]) <= 1e-6);
    report.checks.livingRootEquality = report.checks.livingRootEquality !== false && living.length > 0 && living.every(r => near(r.actor, r.motor.position));
    report.checks.viewInterpolation = report.checks.viewInterpolation !== false && trace.rows.length > 0 && trace.rows.every(r => near(r.view.position, r.expectedView));
    report.checks.liveClocks = report.checks.liveClocks !== false && trace.rows.length > 0 && trace.rows.every(r => r.clock.captureFps === null && r.clock.scale === 1 && !r.clock.paused);
    save();
  };
  try {
    browser = await chromium.launch({ executablePath: chrome, headless: true,
      args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
      serviceWorkers: 'block', recordVideo: { dir: join(out, 'video'), size: { width: 402, height: 874 } } });
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin === origin) await route.continue();
      else { report.deniedRequests.push(route.request().url()); await route.abort('blockedbyclient'); }
    });
    await context.addInitScript(() => {
      const trace = { rows: [], errors: [], overflow: false };
      window.__convexTouchTrace = trace;
      const sample = () => {
        try {
          const d = window.__practiceDemo, n = d?.arena?.opponent?.native, view = d?.arena?.opponent?.targets?.[0];
          if (n && view && !n.scope.disposed && n.actor.motor) {
            if (trace.rows.length >= 18000) trace.overflow = true;
            else {
              const h = n.pose.history, blend = n.pose.physicalFrozen ? 1 : d.game.alpha;
              if (!h) throw new Error('Missing actual published root interpolation history');
              const input = n.pose.law.input, motorPosition = n.actor.motor.collider.translation();
              trace.rows.push({ wall: performance.now(), dateNow: Date.now(), draw: d.game.frameCount,
                clock: n.host.clock.snapshot(), alpha: d.game.alpha, alive: n.actor.alive, hp: n.actor.hp,
                playerHealth: d.arena.playerVitals.health, actor: n.actor.position.toArray(),
                motor: { enabled: n.actor.motor.collider.isEnabled(), position: [motorPosition.x, motorPosition.y, motorPosition.z] },
                poseInput: { ...input, position: { ...input.position }, lookTarget: { ...input.lookTarget } },
                publishedRoot: Array.from(h.root), previousRoot: Array.from(h.previousRoot),
                expectedView: [0, 1, 2].map(i => h.previousRoot[i] + (h.root[i] - h.previousRoot[i]) * blend),
                view: { position: view.mesh.position.toArray(), matrixWorld: view.mesh.matrixWorld.toArray(),
                  bones: Object.fromEntries(Object.entries(view.bones).map(([name, bone]) => [name, { matrixWorld: bone.matrixWorld.toArray(), position: bone.position.toArray(), quaternion: bone.quaternion.toArray() }])) } });
            }
          }
        } catch (error) { if (trace.errors.length < 100) trace.errors.push(String(error)); else trace.overflow = true; }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    page = await context.newPage(); video = page.video(); page.setDefaultTimeout(120000);
    page.on('request', r => { report.requests.push(r.url()); });
    page.on('pageerror', e => { report.errors.push(e.message); save(); });
    page.on('console', m => { writeFileSync(join(out, 'console.log'), `${m.type()} ${m.text()}\n`, { flag: 'a' }); });
    const state = () => page.evaluate(() => {
      const d = window.__practiceDemo, n = d.arena.opponent.native;
      const aim = d.player.sampleAimCommand(), ray = new n.host.physics.R.Ray(aim.origin, aim.direction);
      const inspect = c => ({ centre: { ...c.translation() }, rotation: { ...c.rotation() },
        radius: c.radius(), enabled: c.isEnabled(), originInside: c.containsPoint(aim.origin),
        centreRayToiSolid: c.castRay(ray, 2.2, true) });
      return { alive: n.actor.alive, hp: n.actor.hp, health: d.arena.playerVitals.health,
        player: d.player.position.toArray(), yaw: d.player.yaw, pitch: d.player.pitch,
        lookMult: d.player.lookMult, aim,
        playerCollider: { radius: d.player.motor.collider.radius(), halfHeight: d.player.motor.collider.halfHeight() },
        root: { actor: n.actor.position.toArray(), collider: { ...n.actor.motor.collider.translation() }, view: d.arena.opponent.targets[0].mesh.position.toArray(), authority: n.actor.motor.rootAuthority }, target: n.actor.position.toArray(),
        hitboxes: Array.from(d.arena.opponent.bodies.boxes.values()).map(b => ({
          body: { ...inspect(b.body), halfHeight: b.body.halfHeight() },
          head: inspect(b.head) })),
        nativeClock: { frame: n.host.clock.frame, now: n.host.clock.now }, loot: d.arena.opponent.loot.receipt,
        owner: n.corpse.diagnostic() };
    });
    const stores = async label => { report.stores.push({ label, ...await page.evaluate(readStores) }); save(); };
    const shot = label => page.screenshot({ path: join(out, `${label}.jpg`), type: 'jpeg', quality: 82, scale: 'css' });
    const boot = async () => {
      await page.locator('#practice-start').tap();
      await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true);
    };
    const touch = await context.newCDPSession(page);
    const approach = async (distance, budget = 60000, minimum = 0) => {
      const box = await page.locator('.ws-touch-stick').boundingBox();
      if (!box) throw new Error('Real movement stick unavailable');
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }, start = Date.now();
      async function send(type, points) {
        report.inputs.push({ type, points, wallDateNow: Date.now(), state: await state() });
        await touch.send('Input.dispatchTouchEvent', { type, touchPoints: points });
      }
      try {
        await send('touchStart', [{ ...center, id: 1 }]);
        for (;;) {
          const s = await state(), dx = s.target[0] - s.player[0], dz = s.target[2] - s.player[2], r = Math.hypot(dx, dz);
          if (r <= distance && r >= minimum) return true;
          if (s.health === 0 || Date.now() - start > budget) return false;
          if (r < 1e-6) throw new Error('Cannot choose a real navigation bearing at coincident roots');
          const scale = (r < minimum ? -20 : 36) / r;
          await send('touchMove', [{ x: center.x + (dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw)) * scale,
            y: center.y + (dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)) * scale, id: 1 }]);
          await page.waitForTimeout(250);
        }
      } finally { await send('touchEnd', []); save(); }
    };
    // Retain the app4 LOOK correction: distance to an actor root is not a weapon aim test.
    // Correct only the driver: close the loop using ordinary LOOK-pad touch drags.
    const aimAtBody = async () => {
      const box = await page.locator('.ws-touch-lookpad').boundingBox();
      if (!box) throw new Error('Real LOOK pad unavailable');
      const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      for (let i = 0; i < 24; i++) {
        const s = await state(), body = s.hitboxes[0]?.body;
        if (!s.alive) return true;
        if (!body?.enabled || !Number.isFinite(s.lookMult) || s.lookMult <= 0) throw new Error('Live aim measurements unavailable');
        const dx = body.centre.x - s.aim.origin.x, dy = body.centre.y - s.aim.origin.y, dz = body.centre.z - s.aim.origin.z;
        const yawError = Math.atan2(Math.sin(Math.atan2(-dx, -dz) - s.yaw), Math.cos(Math.atan2(-dx, -dz) - s.yaw));
        const desiredPitch = Math.max(-1.4, Math.min(1.4, Math.atan2(dy, Math.hypot(dx, dz))));
        const pitchError = desiredPitch - s.pitch;
        if (Math.abs(yawError) < 0.025 && Math.abs(pitchError) < 0.025) return true;
        // Normal look rate is 0.0095 * lookMult, with assist friction 0.45..1.
        // Bounded iterative gestures observe the resulting actual heading; never assign it.
        const rate = 0.0095 * s.lookMult;
        const end = { x: centre.x + Math.max(-24, Math.min(24, -yawError / rate)),
          y: centre.y + Math.max(-24, Math.min(24, -pitchError / rate)), id: 2 };
        report.inputs.push({ type: 'look-drag', wallDateNow: Date.now(), state: s,
          start: centre, end, yawError, pitchError });
        try {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...centre, id: 2 }] });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
        } finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
        await page.waitForTimeout(100);
      }
      return false;
    };
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await stores('before-start'); await boot(); await stores('after-start'); await shot('01-start');
    report.initial = await state();
    report.checks.actualPlayerGeometry = Math.abs(report.initial.playerCollider.radius - .38) < 1e-7 && Math.abs(report.initial.playerCollider.halfHeight - .52) < 1e-7;
    report.checks.collisionAuthority = report.initial.root.authority === 'collision';
    if (!report.checks.actualPlayerGeometry || !report.checks.collisionAuthority) throw new Error('Actual player geometry or collision root authority differs from reviewed experiment');
    report.touchApproach = await approach(2.2);
    // No placement fallback: navigation, aim, damage and loot must happen through the real controls.
    if (!report.touchApproach) throw new Error('Real touch approach blocked or player defeated; no placement fallback executed');
    let priorHp = Infinity, misses = 0;
    for (let i = 0; i < 60; i++) {
      const s = await state(); if (!s.alive || s.health === 0) break;
      misses = s.hp < priorHp ? 0 : misses + 1; priorHp = s.hp;
      // Two consecutive misses trigger a real backstep, not 48 identical failed attacks.
      if (misses >= 2 && !await approach(3.2, 15000, 2.8)) throw new Error('Real touch backstep blocked');
      if (!await approach(misses >= 2 ? 3.2 : 2.2, 15000)) throw new Error('Real touch re-approach blocked');
      if (!await aimAtBody()) throw new Error('Real LOOK alignment did not converge');
      report.inputs.push({ type: 'attack-tap', wallDateNow: Date.now(), state: await state() });
      await page.locator('.ws-touch-attack').tap(); await page.waitForTimeout(750); save();
    }
    report.afterSword = await state();
    if (report.afterSword.alive) throw new Error('Real sword controls did not kill target');
    await page.waitForFunction(() => window.__practiceDemo.arena.opponent.native.corpse.diagnostic().resource === 'frozen');
    report.contacts.push({ label: 'after-lethal', ...await page.evaluate(readContact) }); save(); await shot('02-lethal');
    report.lootApproach = await approach(1.2, 15000);
    // A fixed corpse can obstruct this approach. Still wait for the real coin attraction, never change its state.
    await page.waitForFunction(() => window.__practiceDemo.arena.opponent.loot.receipt.complete, null, { timeout: 30000 });
    report.afterLoot = await state(); await stores('after-genuine-kill-loot');
    report.contacts.push({ label: 'after-loot', ...await page.evaluate(readContact) }); save(); await shot('03-loot');
    const beforeRetryOwner = await page.evaluateHandle(() => window.__practiceDemo.arena.opponent.native);
    await page.locator('#practice-retry').tap(); await page.waitForTimeout(250);
    report.afterRetry = await state(); await stores('after-retry'); await shot('04-retry');
    report.checks.retryDisposed = await beforeRetryOwner.evaluate(old => old.scope.disposed && old !== window.__practiceDemo.arena.opponent.native);
    await beforeRetryOwner.dispose();
    const beforeBackOwner = await page.evaluateHandle(() => window.__practiceDemo.arena.opponent.native);
    await page.locator('#practice-back').tap(); await page.waitForFunction(() => !window.__practiceDemo);
    report.checks.backDisposed = await beforeBackOwner.evaluate(old => old.scope.disposed);
    await beforeBackOwner.dispose();
    await stores('after-back-before-start'); await boot(); report.afterBackStart = await state();
    await stores('after-back-start'); await shot('05-back-start');
    await preserveRaf('before-reload');
    await page.reload({ waitUntil: 'domcontentloaded' }); await stores('after-reload-before-start');
    await boot(); report.afterReload = await state(); await stores('after-reload-start'); await shot('06-reload');
    report.checks.allStorageApisSucceeded = report.stores.every(s => ['local', 'session', 'indexedDB', 'caches', 'serviceWorkers', 'saveStore'].every(k => s[k].ok));
    report.checks.persistenceEmpty = report.checks.allStorageApisSucceeded && report.stores.every(s =>
      ['local', 'session', 'indexedDB', 'caches', 'serviceWorkers'].every(k => Object.keys(s[k].value).length === 0)
      && (['before-start', 'after-back-before-start', 'after-reload-before-start'].includes(s.label)
        ? s.saveStore.value === null
        : s.saveStore.value !== null && Object.keys(s.saveStore.value).join(',') === 'global'
          && Object.keys(s.saveStore.value.global).join(',') === 'keys'
          && Object.keys(s.saveStore.value.global.keys).length === 0));
    report.checks.genuineKillLoot = !report.afterSword.alive && report.afterLoot.loot.complete && report.afterLoot.loot.coins > 0;
    report.checks.freshBoundaries = [report.afterRetry, report.afterBackStart, report.afterReload].every(s => s.alive && s.hp === report.initial.hp && s.health === report.initial.health && s.loot.coins === 0);
    report.checks.fixedSevenNativeColliders = report.contacts.every(s => s.body.fixed && s.body.enabled && s.colliders.length === 7 && s.colliders.every(c => c.bone !== null) && new Set(s.colliders.map(c => c.bone)).size === 7);
    report.checks.nonPenetratingPlayer = report.contacts.length >= 2 && report.contacts.every(s => s.colliders.every(c => c.playerContact.distance >= -1e-6));
    report.checks.nonPenetratingFloor = report.contacts.every(s => s.colliders.every(c => c.contact.distance >= -1e-6));
    report.contactQualification = report.contacts.map(s => ({ label: s.label,
      classification: s.minimumContactDistance < -1e-6 ? 'penetrating' : s.minimumContactDistance <= 1e-4 ? 'touching-within-0.1mm' : 'separated',
      minimumContactDistance: s.minimumContactDistance, minimumPlayerDistance: s.minimumPlayerDistance, minimumColliderClearance: s.minimumColliderClearance,
      minimumMeshClearance: s.minimumMeshClearance }));
    report.checks.onlyOwnedLocalRequests = report.deniedRequests.length === 0 && report.requests.every(url => new URL(url).origin === origin);
    report.checks.noPageErrors = report.errors.length === 0;
    if (Object.values(report.checks).some(v => v !== true)) process.exitCode = 1;
  } catch (error) {
    report.fatal = String(error); process.exitCode = 1;
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(out, 'failure.jpg'), type: 'jpeg', quality: 82 }); } catch (e) { report.failureScreenshotError = String(e); }
  } finally {
    try { await preserveRaf('final'); } catch (error) { report.traceError = String(error); process.exitCode = 1; }
    try {
      await context?.close();
      if (!video) {
        report.videoError = 'Missing recorded video'; process.exitCode = 1;
      } else {
        const path = await video.path();
        report.video = { path: path.slice(out.length + 1), sha256: hash(readFileSync(path)), bytes: readFileSync(path).length };
        const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames,r_frame_rate,width,height:format=duration', '-of', 'json', path], { encoding: 'utf8', timeout: 120000 }));
        report.video.probe = probe;
        report.checks.videoFinalized = Number(probe.streams?.[0]?.nb_read_frames) > 0 && Number(probe.format?.duration) > 0;
      }
    } catch (error) { report.videoError = String(error); process.exitCode = 1; }
    try { await browser?.close(); } catch (error) { report.browserCloseError = String(error); process.exitCode = 1; }
    await new Promise(_resolve => { server.close(error => {
      if (error) { report.serverCloseError = String(error); process.exitCode = 1; }
      _resolve();
    }); });
    const endInventory = inventory(dist); delete endInventory['rooted-pitcher-proof.json'];
    report.checks.exactBytesUnchanged = same(endInventory, hostFiles) && hash(readFileSync(join(dist, 'rooted-pitcher-proof.json'))) === hash(receiptBytes);
    if (report.fatal || Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
    report.finishedAt = new Date().toISOString(); save(); console.info(JSON.stringify({ out, checks: report.checks, fatal: report.fatal }));
  }
}
