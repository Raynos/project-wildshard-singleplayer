/** Actual Conch-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { installConchReadableObservation } from './qa-conch-readable-observation.mjs';
import { admitConchReviewedBuild } from './conch-readable-build-pin.mjs';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

if (process.env.CHROME_PATH !== resolvePath('tmp/dot-audit/tools/chrome-headless-shell-linux64/chrome-headless-shell')) throw new Error('Only the installed approved Chrome shell may be used');
const admitted = admitConchReviewedBuild(resolvePath('.'));
const out = process.env.CONCH_QA_OUT ?? 'tmp/conch-readable-qa/motion4-windup-interruptions';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.conch.fullbody-motion-observation.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, buildPin: admitted.buildPin, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const writeJson = (path, value) => { const text = JSON.stringify(value); if (Buffer.byteLength(text) > 5000000) throw new Error(`Whole JSON exceeds 5 MB: ${path}`); writeFileSync(path, text); };
const save = () => writeJson(`${out}/report.json`, report);
const preserve = async page => {
  const data = await page.evaluate(() => ({ trace: window.__conchRenderTrace ?? [], events: window.__conchEvents ?? [], geometry: window.__conchRuntimeGeometry ?? [] }));
  // Preserve complete unfragmented streams in native Site sources. Repository receives only receipts/summaries.
  report.evidence = {};
  for (const [kind, rows] of Object.entries(data)) {
    const text = JSON.stringify(rows), path = `${out}/${kind}.json`;
    writeFileSync(path, text);
    report.evidence[kind] = { count: rows.length, file: `${kind}.json`, bytes: Buffer.byteLength(text),
      sha256: createHash('sha256').update(text).digest('hex'), wholeStream: true, repositoryEligible: Buffer.byteLength(text) <= 5000000 };
  }
  return data.trace;
};
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.CONCH_QA_DIST ?? 'tmp/conch-readable-preview-dist');
const buildManifestBytes = readFileSync('docs/reviews/conch-motion4-capture/build-manifest.json');
const manifestSha = createHash('sha256').update(buildManifestBytes).digest('hex');
if (manifestSha !== 'faa5e042547e36ad4f72fe65f89451a35ce9265465a731213e7c5ac51de9cdaa') throw new Error('Manifest changed');
const manifest = JSON.parse(buildManifestBytes);
if (manifest.sourceHash !== 'e41d1e7600a94074384a00fca22b58f634c060f5eb0458c5d34ec2bf44db6cb8') throw new Error('Source changed');
for (const [file, expected] of Object.entries(manifest.files)) {
  const bytes = readFileSync(`${built}/${file}`);
  if (bytes.length !== expected.bytes || createHash('sha256').update(bytes).digest('hex') !== expected.sha256) throw new Error(`Build changed: ${file}`);
}
report.executedBuild = { sourceHash: manifest.sourceHash, manifestSha, verifiedFiles: Object.keys(manifest.files).length };
report.executedPreview = JSON.parse(readFileSync(`${built}/conch-preview.json`, 'utf8'));
report.executedPreviewSha256 = createHash('sha256').update(readFileSync(`${built}/conch-preview.json`)).digest('hex');
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4468, '127.0.0.1', resolve); });
let browser = null, observedPage = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  report.videoContextCreatedAt = new Date().toISOString();
  const page = await context.newPage();
  report.videoPageCreatedAt = new Date().toISOString(); observedPage = page; page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.CONCH_QA_URL ?? 'http://127.0.0.1:4468/', { waitUntil: 'domcontentloaded' });
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
      return { wallTime: performance.now(), gameTime: d.game.frameTime, boutTime: d.arena.opponent.elapsed, phase: window.__conchPhase, reason: 'Diagnostic player/camera placement; aim also follows the enemy during defense; no enemy/health/time edits', distance, angle, pitch, position: d.player.position.toArray() };
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
  report.observerCamera = await page.evaluate(installConchReadableObservation);
  const phase = name => page.evaluate(value => { window.__conchPhase = value; }, name);
  report.trials = [];
  const button = await page.locator('.ws-touch-attack').boundingBox();
  if (!button) throw new Error('Attack control missing');
  for (const trial of [{ name: 'early-ordinary', elapsed: 0 }, { name: 'late-ordinary', elapsed: .15 }]) {
    await phase(trial.name);
    await page.locator('#practice-retry').tap();
    await page.waitForTimeout(300);
    await place(trial.name === 'early-ordinary' ? 3 : 2.1); await aim();
    if (trial.name !== 'early-ordinary') await page.waitForFunction(min => {
      const d = window.__practiceDemo, a = d.arena.activeTargets[0];
      const strike = JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike;
      return a.mem['conch-st'] === 1 && strike.phase === 'windup' && strike.elapsed >= min;
    }, trial.elapsed, { timeout: 15000 });
    const before = await sample();
    await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
    if (trial.name === 'early-ordinary') { await place(2.1); await aim(); }
    await page.waitForFunction(name => window.__conchEvents.some(row => row.phase === name && row.kind === 'enemy-damage-before-presentation'), trial.name, {timeout: 10000});
    // Preserve the whole legal hit transition, queued counter, rest, and next ordinary cycle.
    await page.waitForFunction(name => window.__conchRenderTrace.some(row => row.phase === name && row.stage === 2 && row.strike.phase === 'idle'), trial.name, {timeout: 15000});
    const rest = await sample();
    await page.waitForFunction(() => { const d = window.__practiceDemo, a = d.arena.activeTargets[0]; return a.mem['conch-st'] === 1 && JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike.phase === 'windup'; }, null, {timeout: 15000});
    const nextStart = await sample();
    await page.waitForFunction(() => { const d = window.__practiceDemo, a = d.arena.activeTargets[0]; return a.mem['conch-st'] === 2 && JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike.phase === 'idle'; }, null, {timeout: 15000});
    await page.waitForTimeout(400);
    const after = await sample();
    report.trials.push({ ...trial, before, rest, nextStart, after }); save();
    await capture(trial.name);
  }
  const trace = await preserve(page);
  const events = await page.evaluate(() => window.__conchEvents);
  report.actualHits = events.filter(row => row.kind === 'enemy-damage-before-presentation').map(row => ({phase:row.phase, sampleIndex:row.sampleIndex, frame:row.frame, gameTime:row.gameTime, boutTime:row.boutTime, stage:row.stage, guard:row.guard, clock:row.clock, strike:row.strike, dealt:row.dealt}));
  report.checks.earlyWindupHit = report.actualHits.some(row => row.phase === 'early-ordinary' && row.stage === 1 && row.strike.phase === 'windup' && row.strike.elapsed < .3);
  report.checks.lateWindupHit = report.actualHits.some(row => row.phase === 'late-ordinary' && row.stage === 1 && row.strike.phase === 'windup' && row.strike.elapsed >= .3);
  report.checks.errors = report.errors.length === 0;
  report.scope = 'Supplementary legal ordinary-windup hits and subsequent complete cycles. Guard is omnidirectional and enabled until behavior clock .6; no unguarded cancellation claim. Normal touchscreen attack, diagnostic player positioning only. No enemy, state, damage or clock injection.';
  if (Object.values(report.checks).some(value => value !== true)) process.exitCode = 1;
  const video = page.video(); await context.close(); report.videoPath = await video.path();
} catch (error) {
  report.fatal = error.message; process.exitCode = 1;
  if (observedPage !== null && !observedPage.isClosed()) {
    try {
      await preserve(observedPage);
    } catch (captureError) { report.partialCaptureError = captureError.message; }
  }
}
finally { await browser?.close(); await new Promise(resolve => { server.close(resolve); }); report.endedAt = new Date().toISOString(); save(); }
