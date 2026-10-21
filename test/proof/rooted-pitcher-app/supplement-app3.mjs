/** Read-only measurements plus real UI input against the retained app3, never a rebuild.
 * Root must checkpoint/review this file and authorize the canonical browser lane before running.
 * ROOTED_PITCHER_SUPPLEMENT_GO=reviewed-app3-contact-persistence is an execution guard, not approval.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, join, extname, sep } from 'node:path';
import process from 'node:process';
import { chromium, devices } from 'playwright';

const ROOT = resolve(import.meta.dirname, '../../..');
const dist = join(ROOT, 'tmp/rooted-pitcher-app3/dist');
const out = join(ROOT, 'tmp/rooted-pitcher-app3/supplement-contact-persistence');
const hash = b => createHash('sha256').update(b).digest('hex');
const pinPath = 'docs/reviews/rooted-pitcher-app/ROOTED-PITCHER-BUILD-PIN3.json';
const pinBytes = readFileSync(join(ROOT, pinPath)), pin = JSON.parse(pinBytes);
const receiptBytes = readFileSync(join(dist, 'rooted-pitcher-proof.json')), receipt = JSON.parse(receiptBytes);
const sourceCommit = 'ab08f79d2652b93bcbcb448a22f9d47fe0d0b0b1';
const git = args => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const inventory = (dir, prefix = '') => Object.fromEntries(readdirSync(dir).sort().flatMap(name => {
  const path = join(dir, name), stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error('Symlink in retained host');
  return stat.isDirectory() ? Object.entries(inventory(path, `${prefix}${name}/`)) : [[`${prefix}${name}`, hash(readFileSync(path))]];
}));
const same = (a, b) => JSON.stringify(Object.entries(a).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0)) === JSON.stringify(Object.entries(b).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0));
const hostFiles = inventory(dist); delete hostFiles['rooted-pitcher-proof.json'];
if (hash(pinBytes) !== '1937b36352e0dc930cc91327b2802f47e1d844d36410159dbc35f840a81b2eaf'
  || hash(receiptBytes) !== '71c686ee720b4667ad4de42c25b2ca022a005f4d6b6644422f22852cb7b1b2aa'
  || pin.sourceCommit !== sourceCommit || String(git(['rev-parse', `${sourceCommit}^{tree}`])).trim() !== pin.sourceTree
  || receipt.pinSha256 !== hash(pinBytes) || JSON.stringify(receipt.pin) !== JSON.stringify(pin)
  || !same(hostFiles, receipt.hostFiles) || pin.synthetic !== false || receipt.synthetic !== false
  || receipt.modelAdmission !== false || receipt.publicAdmission !== false) throw new Error('Frozen app3 identity mismatch');
const historicalFiles = ['src/rootedPitcherProof.ts', 'src/rootedPitcherProofBoot.ts',
  'src/engine/practice/TrainingArena.ts', 'src/engine/physics/nativeRigidCorpse.ts',
  'src/game/practice/PracticeNativeActor.ts', 'scripts/qa-native-owner-observation.mjs'];
for (const path of historicalFiles) if (hash(git(['show', `${sourceCommit}:${path}`])) !== pin.sourceFiles[path])
  throw new Error(`Historical source mismatch: ${path}`);
if (process.argv.includes('--verify-only')) {
  console.info('Retained host inventory, exact receipt/PIN3, historical tree and measurement source identity verified; no browser launched.');
} else {
  await runSupplement();
}
async function runSupplement() {
  if (process.env.ROOTED_PITCHER_SUPPLEMENT_GO !== 'reviewed-app3-contact-persistence') throw new Error('Root review/checkpoint and browser GO required');
  const chrome = join(ROOT, 'tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell');
  if (process.env.CHROME_PATH !== chrome) throw new Error('Use installed approved Chrome shell only');
  if (existsSync(out)) throw new Error('Preserve existing supplemental evidence');
  mkdirSync(out);
  const report = { schema: 'wildshard.rooted-pitcher.app3-supplement.v1', sourceCommit,
    hostReceiptSha256: hash(receiptBytes), pinSha256: hash(pinBytes), historicalFiles,
    testSha256: hash(readFileSync(import.meta.filename)), startedAt: new Date().toISOString(),
    synthetic: false, modelAdmission: false, publicAdmission: false, stores: [], contacts: [], inputs: [],
    errors: [], requests: [], deniedRequests: [], checks: {},
    method: 'Empty isolated browser context. Service workers blocked, but getRegistrations explicitly queried. No enemy HP, clock or pose writes. Real joystick and attack UI. Query shape-to-shape distance, not solver impulses: fixed-fixed bodies need not produce solver contact pairs.',
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
      const contact = c.contactCollider(floor, 100);
      if (!contact || !Number.isFinite(contact.distance)) throw new Error('Native floor distance unavailable');
      return { handle: c.handle, bone: resource.parts.find(p => p.collider.handle === c.handle)?.bone ?? null,
        shapeType: c.shapeType(), enabled: c.isEnabled(), sensor: c.isSensor(), groups: c.collisionGroups(),
        translation: { ...c.translation() }, rotation: { ...c.rotation() }, localVertices: Array.from(vertices), worldVertices,
        worldMinY: Math.min(...worldVertices.map(v => v[1])), contact: { distance: contact.distance,
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
      colliders, meshes, minimumColliderClearance: Math.min(...colliders.map(c => c.worldMinY - floorY)),
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
  try {
    browser = await chromium.launch({ executablePath: chrome, headless: true,
      args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
      serviceWorkers: 'block', recordVideo: { dir: join(out, 'video'), size: { width: 402, height: 874 } } });
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin === origin) await route.continue();
      else { report.deniedRequests.push(route.request().url()); await route.abort('blockedbyclient'); }
    });
    page = await context.newPage(); video = page.video(); page.setDefaultTimeout(120000);
    page.on('request', r => { report.requests.push(r.url()); });
    page.on('pageerror', e => { report.errors.push(e.message); save(); });
    page.on('console', m => { writeFileSync(join(out, 'console.log'), `${m.type()} ${m.text()}\n`, { flag: 'a' }); });
    const state = () => page.evaluate(() => {
      const d = window.__practiceDemo, n = d.arena.opponent.native;
      return { alive: n.actor.alive, hp: n.actor.hp, health: d.arena.playerVitals.health,
        player: d.player.position.toArray(), yaw: d.player.yaw, target: n.actor.position.toArray(),
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
    const approach = async (distance, budget = 60000) => {
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
          if (r <= distance) return true;
          if (s.health === 0 || Date.now() - start > budget) return false;
          const scale = 36 / r;
          await send('touchMove', [{ x: center.x + (dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw)) * scale,
            y: center.y + (dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)) * scale, id: 1 }]);
          await page.waitForTimeout(250);
        }
      } finally { await send('touchEnd', []); save(); }
    };
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await stores('before-start'); await boot(); await stores('after-start'); await shot('01-start');
    report.initial = await state();
    report.touchApproach = await approach(2.2);
    // Optional fallback is deliberately absent: root can review an exact diagnostic placement if actual touch fails.
    if (!report.touchApproach) throw new Error('Real touch approach blocked or player defeated; no placement fallback executed');
    for (let i = 0; i < 60; i++) {
      const s = await state(); if (!s.alive || s.health === 0) break;
      if (!await approach(2.2, 15000)) throw new Error('Real touch re-approach blocked');
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
    await page.locator('#practice-retry').tap(); await page.waitForTimeout(250);
    report.afterRetry = await state(); await stores('after-retry'); await shot('04-retry');
    await page.locator('#practice-back').tap(); await page.waitForFunction(() => !window.__practiceDemo);
    await stores('after-back-before-start'); await boot(); report.afterBackStart = await state();
    await stores('after-back-start'); await shot('05-back-start');
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
    report.checks.freshBoundaries = [report.afterRetry, report.afterBackStart, report.afterReload].every(s => s.alive && s.hp > 0 && s.loot.coins === 0);
    report.checks.fixedSevenNativeColliders = report.contacts.every(s => s.body.fixed && s.body.enabled && s.colliders.length === 7);
    report.checks.nonPenetratingFloor = report.contacts.every(s => s.colliders.every(c => c.contact.distance >= -1e-6));
    report.contactQualification = report.contacts.map(s => ({ label: s.label,
      classification: s.minimumContactDistance < -1e-6 ? 'penetrating' : s.minimumContactDistance <= 1e-4 ? 'touching-within-0.1mm' : 'separated',
      minimumContactDistance: s.minimumContactDistance, minimumColliderClearance: s.minimumColliderClearance,
      minimumMeshClearance: s.minimumMeshClearance }));
    report.checks.onlyOwnedLocalRequests = report.deniedRequests.length === 0 && report.requests.every(url => new URL(url).origin === origin);
    report.checks.noPageErrors = report.errors.length === 0;
    if (Object.values(report.checks).some(v => v !== true)) process.exitCode = 1;
  } catch (error) {
    report.fatal = String(error); process.exitCode = 1;
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(out, 'failure.jpg'), type: 'jpeg', quality: 82 }); } catch (e) { report.failureScreenshotError = String(e); }
  } finally {
    try {
      await context?.close();
      if (!video) {
        report.videoError = 'Missing recorded video'; process.exitCode = 1;
      } else {
        const path = await video.path();
        report.video = { path: path.slice(out.length + 1), sha256: hash(readFileSync(path)) };
      }
    } catch (error) { report.videoError = String(error); process.exitCode = 1; }
    try { await browser?.close(); } catch (error) { report.browserCloseError = String(error); process.exitCode = 1; }
    await new Promise(_resolve => { server.close(error => {
      if (error) { report.serverCloseError = String(error); process.exitCode = 1; }
      _resolve();
    }); });
    report.finishedAt = new Date().toISOString(); save(); console.info(JSON.stringify({ out, checks: report.checks, fatal: report.fatal }));
  }
}
