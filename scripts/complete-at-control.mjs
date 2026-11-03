#!/usr/bin/env node
// DL17 (download mini-plan, G1000): the complete-at-control gate. Jake's hard rule: the level is complete when the player
// gets control: no level content streams after control, no placeholder or far proxy stands in where the player can reach
// on foot, on the hoverboard or at boost.
//
// scripts/browser-lane.sh node scripts/complete-at-control.mjs --base=URL --rev=SHA --flow=<shard slug>|grid
//   [--engine=chromium|webkit] [--lap=<seconds, default 20>] [--out=<new json under ./tmp>]
//
// One cold visit of a served build (`scripts/serve-build.sh --rev`), phone tier, 2x, muted iPhone 16 Pro, Developer on.
//   1. Requests: every request is timed on the Node side; control is the page's `ws:control-ready` plus its next frame.
//      A level-content request still open at control, or started after it, fails the gate.
//   2. Stand-ins at control: the grid's rings (far / l1 / l0 in flight or queued, cells showing a far proxy, tiles or near
//      placeholders), the shardfile residency, and the spawn-view refinement queue (`wildshard.spawn-view*` marks) must
//      show nothing pending and nothing standing in.
//   3. A boost lap: the hoverboard at Developer boost (56 m/s) round a square of `reach` metres from spawn, sampling the
//      same residency every 250 ms; any tile, refinement job, scene object or level request added during the lap is a pop.
// Exit 0 = complete at control, 1 = the gate fails (the report lists every violation), 2 = no reading.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, webkit, devices } from 'playwright';
import { developerSettings, saveFixture, harnessPins, hideDeveloperOverlays } from './debug-settings.mjs';

const { values } = parseArgs({ options: Object.fromEntries(['base', 'rev', 'flow', 'engine', 'lap', 'out', 'reach'].map(key => [key, { type: 'string' }])) });
const base = values.base, rev = values.rev, flow = values.flow;
if (!base || !rev || !/^[0-9a-f]{7,40}$/u.test(rev) || !flow || !/^(grid|[a-z0-9]+(?:-[a-z0-9]+)*)$/u.test(flow)) {
  console.error('usage: complete-at-control.mjs --base=URL --rev=SHA --flow=<shard slug>|grid [--engine=chromium|webkit] [--lap=20] [--reach=220] [--out=tmp/<file>.json]');
  process.exit(2);
}
const engine = values.engine ?? 'chromium', lapSeconds = Number(values.lap ?? '20'), reach = Number(values.reach ?? '220');
if (!['chromium', 'webkit'].includes(engine) || !(lapSeconds > 0) || !(reach > 0)) { console.error('bad --engine / --lap / --reach'); process.exit(2); }
const out = resolve(values.out ?? `tmp/complete-at-control/${flow}-${rev.slice(0, 10)}-${engine}.json`);
if (!out.startsWith(`${resolve('tmp')}/`)) { console.error('--out must be under ./tmp'); process.exit(2); }
if (existsSync(resolve('.git/quiet'))) { console.error('Official Simulator quiet is active'); process.exit(2); }

/** The level's own content: its shardfile files and its shard's assets. Other shards' precache and the app shell are not. */
const levelSlugs = new Set(flow === 'grid' ? [] : [flow]);
const isLevelContent = (url) => {
  const path = new URL(url).pathname;
  if (flow === 'grid') return /^\/(shardfiles|assets\/(baked|open-plots|kit)|world|tiles)\//u.test(path) || /\.(glb|ktx2|bin|webp|png|jpg)$/u.test(path);
  for (const slug of levelSlugs) {
    if (path.startsWith(`/shardfiles/${slug}/`) || path.startsWith(`/assets/${slug}/`) || path.startsWith(`/assets/baked/${slug}/`)) return true;
    if (path.startsWith(`/assets/horizon/${slug}-`)) return true; // the level's sky panorama is on screen from the first frame
  }
  return false;
};

/** In-page residency snapshot: everything that could still change what is drawn near the player. */
function snapshot() {
  const api = window.__wildshard, grid = api?.shard?.grid, file = api?.shard?.shardfile;
  const marks = performance.getEntriesByType('mark').filter(m => m.name.startsWith('wildshard.spawn-view')).map(m => ({ name: m.name, detail: m.detail }));
  let scene = null;
  try {
    const world = api.requireWorld(); let meshes = 0, visible = 0; const ids = [];
    world.game.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return;
      meshes++; if (o.visible) visible++;
      const chain = []; for (let q = o; q && chain.length < 4; q = q.parent) chain.push(q.name === '' ? q.type : q.name);
      ids.push(`${o.uuid}|${chain.join('<')}|${o.geometry?.attributes?.position?.count ?? 0}`);
    });
    const p = world.player.position, v = world.player.velocity;
    scene = { meshes, visible, ids, player: [p.x, p.y, p.z], speed: Math.hypot(v.x, v.z), hover: world.player.hover === true, boost: world.player.hoverBoost === true };
  } catch (error) { scene = { error: String(error) }; }
  let gridState = null;
  if (grid !== undefined) {
    try {
      const s = grid.state();
      gridState = { rings: s.rings, ringsReady: s.ringsReady, near: s.near, cells: (s.cells ?? []).map(c => ({ id: c.instance ?? c.id ?? c.slug, shows: c.shows, drawn: c.drawn })) };
    } catch (error) { gridState = { error: String(error) }; }
  }
  let fine = null, residency = null;
  try { fine = file?.fine ? [...file.fine].map(String).sort((a, b) => a.localeCompare(b)) : null; } catch { fine = null; }
  try {
    const raw = api?.shard?.shardfileResidency;
    residency = raw ? JSON.parse(JSON.stringify(typeof raw === 'function' ? raw() : raw, (_key, value) => (typeof value === 'function' ? undefined : value))) : null;
  } catch (error) { residency = { error: String(error) }; }
  return { at: performance.now(), marks, scene, grid: gridState, fine, residency };
}

const requests = [];
let controlAt = null;
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true, args: engine === 'chromium' ? ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] : [] });
const report = { schema: 1, gate: 'DL17 complete-at-control', rev, base, flow, engine, reach, lapSeconds, when: new Date().toISOString(), violations: [], errors: [] };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 } });
  await developerSettings(context, { tier: 'phone', volume: 0 });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await context.addInitScript(hideDeveloperOverlays);
  await harnessPins(context, { seed: 357, browser: `${engine} / iPhone 16 Pro`, lane: 'dl17', sha: rev });
  const control = { at: null };
  await context.exposeBinding('__dl17Control', () => { control.at ??= Date.now(); });
  await context.addInitScript(() => {
    document.addEventListener('ws:control-ready', () => { requestAnimationFrame(() => { Reflect.apply(Reflect.get(window, '__dl17Control'), window, []); }); }, { once: true });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  page.on('pageerror', error => report.errors.push(error.message));
  const open = new Map();
  page.on('request', req => { const row = { url: req.url(), start: Date.now(), end: null, failed: null }; open.set(req, row); requests.push(row); });
  page.on('requestfinished', req => { const row = open.get(req); if (row) row.end = Date.now(); });
  page.on('requestfailed', req => { const row = open.get(req); if (row) { row.end = Date.now(); row.failed = req.failure()?.errorText ?? 'failed'; } });
  const version = await (await fetch(new URL('/version.json', base))).json();
  if (typeof version.build !== 'string' || !version.build.startsWith(rev.slice(0, 7))) throw new Error(`Served build ${version.build} is not ${rev}`);
  report.build = version.build;
  const url = new URL('/', base);
  if (flow !== 'grid') url.searchParams.set('chunk', flow);
  for (const [key, value] of Object.entries({ tier: 'phone', skipintro: '1', nolock: '1', sw: '0', mute: '1' })) url.searchParams.set(key, value);
  const t0 = Date.now();
  await page.goto(url.href, { waitUntil: 'load' });
  if (flow === 'grid') await page.locator('.ws-main-grid').click();
  await page.waitForFunction(() => window.__wildshard?.world?.hud?.entered === true, undefined, { timeout: 240000 });
  const deadline = Date.now() + 30000;
  while (control.at === null && Date.now() < deadline) await page.waitForTimeout(100);
  if (control.at === null) throw new Error('No ws:control-ready within 30 s of entry');
  controlAt = control.at;
  report.tapToControlMs = controlAt - t0;
  report.atControl = await page.evaluate(snapshot);

  // the boost lap: hoverboard, Developer boost, a square of `reach` metres round spawn
  const lap = [];
  const [sx, , sz] = report.atControl.scene?.player ?? [0, 0, 0];
  const corners = [[sx + reach, sz], [sx + reach, sz + reach], [sx - reach, sz + reach], [sx - reach, sz - reach], [sx + reach, sz - reach], [sx, sz]];
  await page.evaluate(() => { const w = window.__wildshard.requireWorld(); w.player.hoverBoost = true; });
  const walk = page.evaluate(leg => window.__wildshard.walkLeg({ name: 'dl17-boost-lap', start: { x: leg.x, z: leg.z, yaw: 0, hover: true }, waypoints: leg.points.map(([x, z]) => ({ x, z })), timeout: leg.seconds, stuckSeconds: leg.seconds }), { x: sx, z: sz, points: corners, seconds: lapSeconds });
  const lapEnd = Date.now() + lapSeconds * 1000 + 2000, finished = { done: false };
  const settledWalk = (async () => {
    try { return await walk; } catch (error) { report.errors.push(`lap: ${String(error)}`); return null; } finally { finished.done = true; }
  })();
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__wildshard.requireWorld().player.hoverBoost = true; }); // walkLeg's start pose may reset the board
  while (!finished.done && Date.now() < lapEnd) { lap.push(await page.evaluate(snapshot)); await page.waitForTimeout(250); }
  report.lapResult = await settledWalk;
  report.lapSamples = lap.length;
  report.afterLap = await page.evaluate(snapshot);

  // verdict
  const level = requests.filter(r => isLevelContent(r.url));
  const pending = level.filter(r => r.start < controlAt && (r.end === null || r.end > controlAt));
  const after = level.filter(r => r.start >= controlAt);
  report.requests = { total: requests.length, level: level.length, pendingAtControl: pending.map(r => r.url), afterControl: after.map(r => ({ url: r.url, msAfterControl: r.start - controlAt })), otherAfterControl: requests.filter(r => r.start >= controlAt && !isLevelContent(r.url)).map(r => r.url) };
  if (pending.length > 0) report.violations.push(`${pending.length} level-content requests still open at control`);
  if (after.length > 0) report.violations.push(`${after.length} level-content requests started after control`);
  const g = report.atControl.grid;
  if (g && !g.error) {
    const rings = g.rings ?? {};
    if ((rings.inFlight ?? 0) > 0 || (rings.queued ?? 0) > 0) report.violations.push(`grid rings at control: ${rings.inFlight ?? 0} in flight, ${rings.queued ?? 0} queued`);
    const standIns = (g.cells ?? []).filter(c => ['far proxy', 'tiles', 'loading', 'near'].includes(c.shows));
    if (standIns.length > 0) report.violations.push(`cells standing in at control: ${standIns.map(c => `${c.id}=${c.shows}`).join(', ')}`);
  }
  const settled = report.atControl.marks.findLast(m => m.name === 'wildshard.spawn-view.settled')?.detail;
  const waiting = (detail) => Array.isArray(detail) ? detail.reduce((n, q) => n + (Number(q?.waiting) || 0), 0) : Number(detail?.waiting) || 0;
  if (settled !== undefined && waiting(settled) > 0) report.violations.push(`spawn-view refinement still waiting at control: ${waiting(settled)} jobs`);
  // pops during the lap: anything added after control
  const fineAt = new Set(report.atControl.fine), addedFine = new Set();
  let meshesMax = report.atControl.scene?.meshes ?? 0;
  for (const s of [...lap, report.afterLap]) {
    for (const key of s.fine ?? []) if (!fineAt.has(key)) addedFine.add(key);
    meshesMax = Math.max(meshesMax, s.scene?.meshes ?? 0);
  }
  const idsAt = new Set(report.atControl.scene?.ids), addedMeshes = new Map();
  let speedMax = 0;
  for (const sample of [...lap, report.afterLap]) {
    for (const id of sample.scene?.ids ?? []) if (!idsAt.has(id)) addedMeshes.set(id.split('|')[0], id.split('|').slice(1).join('|'));
    speedMax = Math.max(speedMax, sample.scene?.speed ?? 0);
  }
  report.lapAdds = { fineTiles: [...addedFine], meshesAtControl: report.atControl.scene?.meshes ?? null, meshesMax, addedMeshes: [...addedMeshes.values()], speedMax };
  for (const sample of [report.atControl, ...lap, report.afterLap]) if (sample.scene) delete sample.scene.ids;
  if (speedMax < 45) report.errors.push(`the lap never reached boost speed (max ${speedMax.toFixed(1)} m/s < 45): no boost reading`);
  if (addedFine.size > 0) report.violations.push(`${addedFine.size} fine tiles became resident during the boost lap`);
  if (addedMeshes.size > 0) report.violations.push(`${addedMeshes.size} meshes added during the boost lap: ${[...addedMeshes.values()].slice(0, 6).join('; ')}`);
  report.pass = report.errors.length > 0 ? null : report.violations.length === 0;
} catch (error) {
  report.errors.push(String(error)); report.pass = null;
} finally {
  await browser.close();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
}
console.log(`DL17 ${flow} ${engine} ${report.build ?? rev}: ${report.pass === null ? 'NO READING' : report.pass ? 'COMPLETE AT CONTROL' : 'FAIL'}${report.violations.length > 0 ? `\n  - ${report.violations.join('\n  - ')}` : ''}${report.errors.length > 0 ? `\n  errors: ${report.errors.slice(0, 3).join(' | ')}` : ''}\n  report ${out}`);
process.exit(report.pass === null ? 2 : report.pass ? 0 : 1);
