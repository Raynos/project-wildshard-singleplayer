/** TEST ONLY: timing-perturbed caught-exception diagnosis, never playability evidence.
 * Read-only measurements plus real UI input against the retained app3, never a rebuild.
 * Root must checkpoint/review this file and authorize the canonical browser lane before running.
 * ROOTED_PITCHER_DIAGNOSTIC_GO=reviewed-lethal-refusal-diagnostic is an execution guard, not approval.
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
const out = join(ROOT, 'tmp/rooted-pitcher-app3/lethal-refusal-diagnostic');
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
  await runDiagnostic();
}
async function runDiagnostic() {
  if (process.env.ROOTED_PITCHER_DIAGNOSTIC_GO !== 'reviewed-lethal-refusal-diagnostic') throw new Error('Root review/checkpoint and browser GO required');
  const chrome = join(ROOT, 'tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell');
  if (process.env.CHROME_PATH !== chrome) throw new Error('Use installed approved Chrome shell only');
  if (existsSync(out)) throw new Error('Preserve existing supplemental evidence');
  mkdirSync(out);
  const report = { schema: 'wildshard.rooted-pitcher.lethal-refusal-diagnostic.v1', sourceCommit,
    hostReceiptSha256: hash(receiptBytes), pinSha256: hash(pinBytes), historicalFiles,
    testSha256: hash(readFileSync(import.meta.filename)), startedAt: new Date().toISOString(),
    synthetic: false, modelAdmission: false, publicAdmission: false, stores: [], contacts: [], inputs: [],
    errors: [], requests: [], deniedRequests: [], checks: {},
    method: 'Frozen app3, real joystick/LOOK/attack only. CDP pauses on caught exceptions; source and lexical shape verified before read-only capture. First verified refusal ends the attack sequence. No state injections or prepare/animate/applyDamage/setter calls.',
    limitations: 'TEST ONLY, timing perturbed by debugger. Not playability, performance, motion-quality or admission evidence. No repair or parameter search. Caller scope graphs are bounded and omit getters.',
    exceptions: [], refusal: /** @type {Record<string, unknown> | null} */ (null), diagnosticOnly: true };
  const save = () => writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
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
  let browser, context, page, video, debuggerSession;
  let pauseWork = Promise.resolve();
  const control = { stopAttacks: false };
  const shouldStop = () => control.stopAttacks;
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
      const aim = d.player.sampleAimCommand(), ray = new n.host.physics.R.Ray(aim.origin, aim.direction);
      const inspect = c => ({ centre: { ...c.translation() }, rotation: { ...c.rotation() },
        radius: c.radius(), enabled: c.isEnabled(), originInside: c.containsPoint(aim.origin),
        centreRayToiSolid: c.castRay(ray, 2.2, true) });
      return { alive: n.actor.alive, hp: n.actor.hp, health: d.arena.playerVitals.health,
        player: d.player.position.toArray(), yaw: d.player.yaw, pitch: d.player.pitch,
        lookMult: d.player.lookMult, aim, target: n.actor.position.toArray(),
        hitboxes: Array.from(d.arena.opponent.bodies.boxes.values()).map(b => ({
          body: { ...inspect(b.body), halfHeight: b.body.halfHeight() },
          head: inspect(b.head) })),
        nativeClock: { frame: n.host.clock.frame, now: n.host.clock.now }, loot: d.arena.opponent.loot.receipt,
        owner: n.corpse.diagnostic() };
    });
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
    // App3 omitted look input entirely. Distance to an actor root is not a weapon aim test.
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
    debuggerSession = await context.newCDPSession(page);
    const marker = 'Anchored corpse has obstructed lethal hull';
    const bundlePath = 'assets/lastEnd-CK9obz-c.js';
    const bundleSource = readFileSync(join(dist, bundlePath), 'utf8');
    if (!bundleSource.includes(marker)) throw new Error('Retained refusal marker absent');
    // Descriptor reads do not invoke accessors. Caller object graphs are explicitly bounded.
    const properties = async objectId => (await debuggerSession.send('Runtime.getProperties', {
      objectId, ownProperties: true, accessorPropertiesOnly: false, generatePreview: false,
    })).result;
    const snapshotRemote = async (remote, depth = 0, seen = new Set()) => {
      if (!remote) return null;
      if (Object.hasOwn(remote, 'value')) return remote.value;
      if (!remote.objectId) return { type: remote.type, description: remote.description, unserializableValue: remote.unserializableValue };
      if (depth >= 3 || seen.has(remote.objectId) || remote.type === 'function') return { type: remote.type, description: remote.description, truncated: true };
      seen.add(remote.objectId);
      const rows = await properties(remote.objectId), values = {};
      for (const p of rows.slice(0, 80)) values[p.name] = p.value ? await snapshotRemote(p.value, depth + 1, seen) : { accessorOmitted: true };
      return { description: remote.description, values, truncated: rows.length > 80 };
    };
    const evaluate = async (frame, expression, throwOnSideEffect = true) => {
      const response = await debuggerSession.send('Debugger.evaluateOnCallFrame', {
        callFrameId: frame.callFrameId, expression, returnByValue: true, silent: true,
        throwOnSideEffect,
      });
      if (response.exceptionDetails) throw new Error(`Read-only snapshot refused: ${JSON.stringify(response.exceptionDetails)}`);
      return response.result.value;
    };
    const paused = async event => {
      let matched = false;
      try {
        const description = event.data?.description ?? '';
        if (report.refusal || !description.includes(marker)) return;
        for (const frame of event.callFrames) {
          const { scriptSource } = await debuggerSession.send('Debugger.getScriptSource', { scriptId: frame.location.scriptId });
          if (scriptSource !== bundleSource || !scriptSource.includes(marker)) continue;
          const offset = scriptSource.split('\n').slice(0, frame.location.lineNumber).reduce((sum, line) => sum + line.length + 1, 0) + frame.location.columnNumber;
          // Do not identify frames by a possibly minified function name.
          if (Math.abs(offset - scriptSource.indexOf(marker)) > 250) continue;
          matched = true; control.stopAttacks = true;
          const scopes = [];
          for (const scope of frame.scopeChain.filter(item => ['local', 'block'].includes(item.type))) {
            scopes.push({ type: scope.type, rows: await properties(scope.object.objectId) });
          }
          const bindings = new Map();
          for (const scope of scopes) for (const row of scope.rows) if (!bindings.has(row.name)) bindings.set(row.name, row.value);
          const expected = { r: 'object', t: 'object', i: 'object', a: 'object', e: 'object', n: 'object', c: 'object' };
          for (const [name, type] of Object.entries(expected)) if (bindings.get(name)?.type !== type || !bindings.get(name)?.objectId) throw new Error(`Refusal lexical binding mismatch: ${name}`);
          const keys = {};
          for (const name of Object.keys(expected)) keys[name] = (await properties(bindings.get(name).objectId)).map(p => p.name);
          const required = { r: ['mode','position','rotation','scale','joints','retiringCollider'], t: ['bone','pose','desc'], i: ['x','y','z'], a: ['_x','_y','_z','_w'], e: ['handle'], n: ['distance','point1','point2','normal1','normal2'], c: ['length'] };
          for (const [name, names] of Object.entries(required)) if (!names.every(key => keys[name].includes(key))) throw new Error(`Refusal lexical shape mismatch: ${name}`);
          const lexicalShape = await evaluate(frame, `({ input: r.mode === 'anchored-held' && Number.isFinite(r.scale) && Array.isArray(r.joints), part: typeof t.bone === 'string' && !!t.pose.position && !!t.pose.rotation && !!t.desc.shape, contact: Number.isFinite(n.distance) && n.distance < -1e-6, prepared: Array.isArray(c) && c.includes(t) })`);
          if (Object.values(lexicalShape).some(value => value !== true)) throw new Error('Refusal lexical semantic mismatch');
          // Rapier getters cross WASM and are rejected by V8 side-effect analysis.
          // Only this fixed, reviewed read-only getter expression relaxes that analysis.
          const snapshot = await evaluate(frame, `(() => {
            const vector = v => v == null ? null : ({ x:v.x, y:v.y, z:v.z, ...(v.w === undefined ? {} : {w:v.w}) });
            const collider = v => {
              if (!v) return null;
              const parent = v.parent();
              return { handle:v.handle, groups:v.collisionGroups(), solverGroups:v.solverGroups(), enabled:v.isEnabled(), sensor:v.isSensor(), shapeType:v.shapeType(), translation:vector(v.translation()), rotation:vector(v.rotation()), shape:{ type:v.shape.type, vertices:v.shape.vertices ? Array.from(v.shape.vertices) : null, halfExtents:vector(v.shape.halfExtents), radius:v.shape.radius, halfHeight:v.shape.halfHeight }, parent:parent ? {handle:parent.handle, bodyType:parent.bodyType(), enabled:parent.isEnabled(), translation:vector(parent.translation()), rotation:vector(parent.rotation())} : null };
            };
            const d=window.__practiceDemo, native=d.arena.opponent.native;
            return { contact:{distance:n.distance, point1:vector(n.point1), point2:vector(n.point2), normal1:vector(n.normal1), normal2:vector(n.normal2)}, part:{bone:t.bone, localPose:{position:vector(t.pose.position),rotation:vector(t.pose.rotation)}, vertices:Array.from(t.desc.shape.vertices), worldPosition:vector(i), worldRotation:vector(a)}, input:{mode:r.mode,position:vector(r.position),rotation:vector(r.rotation),scale:r.scale,velocity:vector(r.velocity),dir:vector(r.dir),damage:r.damage,dims:{...r.dims}, joints:r.joints.map(j=>({name:j.name,parent:j.parent,position:vector(j.position),rotation:vector(j.rotation),scale:vector(j.scale)}))}, blockingCollider:collider(e), retiringCollider:collider(r.retiringCollider), playerCollider:collider(d.player.motor.collider), nativeClock:{frame:native.host.clock.frame,now:native.host.clock.now}, hp:native.actor.hp, alive:native.actor.alive, playerHealth:d.arena.playerVitals.health, preparedBones:c.map(p=>p.bone) };
          })()`, false);
          const callers = [];
          for (const caller of event.callFrames.slice(0, 12)) {
            const locals = [];
            for (const scope of caller.scopeChain.filter(item => ['local', 'block'].includes(item.type))) {
              const rows = await properties(scope.object.objectId);
              const callerBindings = [];
              for (const row of rows.slice(0, 24)) {
                const value = row.value;
                const entry = { name:row.name, type:value?.type, description:value?.description, value:value?.value };
                if (value?.objectId && value.type === 'object') {
                  const fields = await properties(value.objectId), names = fields.map(field => field.name);
                  entry.keys = names.slice(0, 80);
                  // Shape-based caller input identification, not minified parameter names.
                  if (['amount','target','point','dir'].every(name => names.includes(name))) {
                    entry.damageRequest = {};
                    for (const field of fields.filter(item => ['amount','point','dir','from','sourceTags','throughWalls'].includes(item.name))) {
                      entry.damageRequest[field.name] = await snapshotRemote(field.value);
                    }
                    entry.damageRequest.target = fields.find(field => field.name === 'target')?.value?.description;
                    entry.damageRequest.source = fields.find(field => field.name === 'source')?.value?.description;
                  }
                }
                callerBindings.push(entry);
              }
              locals.push({ type:scope.type, bindings:callerBindings, truncated:rows.length > 24 });
            }
            callers.push({ functionName:caller.functionName, location:caller.location, url:caller.url, locals });
          }
          report.refusal = { wallDateNow:Date.now(), reason:event.reason, description, bundlePath, bundleSha256:hash(scriptSource), sourceOffset:offset, frameLocation:frame.location, lexicalKeys:keys, lexicalShape, snapshot, callers };
          save();
          break;
        }
        if (!matched) report.exceptions.push({ reason:event.reason, description, matched:false });
      } catch (error) {
        control.stopAttacks = true; report.captureError = String(error); save();
      } finally {
        try { if (shouldStop()) await debuggerSession.send('Debugger.setPauseOnExceptions', { state:'none' }); }
        finally { await debuggerSession.send('Debugger.resume'); }
      }
    };
    debuggerSession.on('Debugger.paused', event => {
      pauseWork = (async () => {
        try { await paused(event); }
        catch (error) { control.stopAttacks = true; report.debuggerError = String(error); save(); }
      })();
    });
    await debuggerSession.send('Debugger.enable');
    await debuggerSession.send('Debugger.setPauseOnExceptions', { state:'all' });
    await page.goto(origin, { waitUntil:'domcontentloaded' });
    await boot(); await shot('01-start'); report.initial = await state();
    report.touchApproach = await approach(2.2);
    if (!report.touchApproach) throw new Error('Real touch approach blocked; no placement fallback');
    for (let attempt = 0; attempt < 20; attempt++) {
      if (shouldStop()) break;
      const before = await state();
      if (!before.alive || before.health === 0) break;
      if (!await approach(2.2, 15000)) throw new Error('Real touch approach blocked');
      if (!await aimAtBody()) throw new Error('Real LOOK alignment did not converge');
      if (shouldStop()) break;
      report.inputs.push({ type:'attack-tap', wallDateNow:Date.now(), state:await state() });
      await page.locator('.ws-touch-attack').tap();
      await page.waitForTimeout(750); await pauseWork; save();
    }
    await pauseWork;
    report.afterDiagnostic = await state(); await shot('02-diagnostic');
    report.checks.verifiedRefusalCaptured = report.refusal !== null;
    report.checks.hitCallerInputCaptured = report.refusal?.callers.some(caller => caller.locals.some(scope => scope.bindings.some(binding => binding.damageRequest))) === true;
    report.checks.onlyOwnedLocalRequests = report.deniedRequests.length === 0 && report.requests.every(url => new URL(url).origin === origin);
    report.checks.noCaptureError = !report.captureError && !report.debuggerError;
    if (Object.values(report.checks).some(value => value !== true)) throw new Error('Bounded diagnostic ended without a complete verified capture');
  } catch (error) {
    report.fatal = String(error); process.exitCode = 1;
    if (page && !page.isClosed()) try { await page.screenshot({ path: join(out, 'failure.jpg'), type: 'jpeg', quality: 82 }); } catch (e) { report.failureScreenshotError = String(e); }
  } finally {
    if (debuggerSession) {
      try { await debuggerSession.send('Debugger.setPauseOnExceptions', { state:'none' }); }
      catch (error) { report.debuggerCleanupError = String(error); }
      try { await debuggerSession.send('Debugger.resume'); } catch { /* Already running is expected. */ }
      await pauseWork;
      try { await debuggerSession.send('Debugger.disable'); } catch (error) { report.debuggerDisableError = String(error); }
    }
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
