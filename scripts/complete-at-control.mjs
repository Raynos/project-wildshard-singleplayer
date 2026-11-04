#!/usr/bin/env node
// DL17 (download mini-plan, G1000): the complete-at-control gate. Jake's hard rule: the level is complete when the player
// gets control: no level content streams after control, no placeholder or far proxy stands in where the player can reach
// on foot, on the hoverboard or at boost.
//
// scripts/browser-lane.sh node scripts/complete-at-control.mjs --base=URL --rev=SHA --flow=<shard slug>|grid
//   [--engine=chromium|webkit] [--sw=on|off] [--link=none|phone] [--level-download=shardfile|packs] [--lap=<seconds>]
//   [--reach=<m, 220>] [--out=<json under ./tmp>]
//   --warm=on: timing only (no lap): the cold visit's tap-to-control, an exit and re-entry 1 s after control while the
//   service worker's post-control precache still runs (039d's trap), and a re-entry once the worker has gone quiet
//
// One cold visit of a served build (`scripts/serve-build.sh --rev`), phone tier, 2x, muted iPhone 16 Pro, Developer on,
// the service worker ON by default (a fresh context, so it installs during the visit, as a player's first visit does).
//   1. Requests: every request of the context is timed on the Node side, the page's, its dedicated workers' and (Chromium)
//      the service worker's own fetches; control is the page's `ws:control-ready` plus its next frame. Level content is
//      every same-origin request that does not name another level (its hashed JS, shared code, common and canonical audio
//      all count); a level-content request still open at control, or started after it, fails the gate. A post-control
//      fetch of a URL the visit already fetched before control (the worker's precache) is listed as a re-fetch, not a pop.
//   2. Stand-ins at control: the grid's rings (far / l1 / l0 in flight or queued, cells showing a far proxy, tiles or near
//      placeholders), the shardfile residency, and the spawn-view refinement queue (`wildshard.spawn-view*` marks) must
//      show nothing pending and nothing standing in.
//   3. A boost lap: the hoverboard at Developer boost (56 m/s) round a square of `reach` metres from spawn, sampling the
//      same residency every 250 ms; any tile, refinement job, scene object or level request added during the lap is a pop.
// Exit 0 = complete at control, 1 = the gate fails (the report lists every violation), 2 = no reading.
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, webkit, devices } from 'playwright';
import { developerSettings, saveFixture, harnessPins, hideDeveloperOverlays } from './debug-settings.mjs';
import { FLOOR_GRID_ENTER } from './frame-floor-navigation.mjs';
import { startSharedLink } from './phone-loading/link.ts';
import { profiles } from './phone-loading/model.ts';

// the service worker's own fetches reach context 'request' events (Chromium), as scripts/bench-load.mjs does
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';
const { values } = parseArgs({ options: Object.fromEntries(['base', 'rev', 'flow', 'engine', 'lap', 'out', 'reach', 'sw', 'warm', 'link', 'level-download'].map(key => [key, { type: 'string' }])) });
const base = values.base, rev = values.rev, flow = values.flow;
if (!base || !rev || !/^[0-9a-f]{7,40}$/u.test(rev) || !flow || !/^(grid|[a-z0-9]+(?:-[a-z0-9]+)*)$/u.test(flow)) {
  console.error('usage: complete-at-control.mjs --base=URL --rev=SHA --flow=<shard slug>|grid [--engine=chromium|webkit] [--sw=on|off] [--link=none|phone] [--warm=on] [--lap=<s>] [--reach=220] [--out=tmp/<file>.json]');
  process.exit(2);
}
const engine = values.engine ?? 'chromium', reach = Number(values.reach ?? '220'), sw = values.sw ?? 'on', linkName = values.link ?? 'none';
// --lap overrides each boost-lap leg's time bound (default: the leg's length at 20 m/s plus 15 s)
const lapSeconds = Number(values.lap ?? '60');
if (![undefined, 'shardfile', 'packs'].includes(values['level-download'])) { console.error('bad --level-download'); process.exit(2); }
if (!['chromium', 'webkit'].includes(engine) || !['on', 'off'].includes(sw) || !['none', 'phone'].includes(linkName) || !(lapSeconds > 0) || !(reach > 0)) { console.error('bad --engine / --sw / --link / --lap / --reach'); process.exit(2); }
if (values.warm === 'on' && (linkName !== 'phone' || engine !== 'chromium' || sw !== 'on')) { console.error('--warm=on needs --link=phone, Chromium and the worker on: a localhost link finishes the precache before any re-entry'); process.exit(2); }
const out = resolve(values.out ?? `tmp/complete-at-control/${flow}-${rev.slice(0, 10)}-${engine}.json`);
if (!out.startsWith(`${resolve('tmp')}/`)) { console.error('--out must be under ./tmp'); process.exit(2); }
if (existsSync(resolve('.git/quiet'))) { console.error('Official Simulator quiet is active'); process.exit(2); }

/** Every level's slug: the grid's cells and the shard folders. */
const ALL_SLUGS = new Set([
  ...JSON.parse(readFileSync(resolve('src/game/grid/singleplayer.json'), 'utf8')).grid.cells.map(cell => cell.slug),
  ...readdirSync(resolve('src/shards'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name),
]);
/** The level a URL names, or null for shared content: its shardfile files, its assets, baked files, music, sfx, horizon,
 *  an open plot's asset folder, or a Rolldown chunk named after the shard. */
function slugOf(path) {
  const named = [/^\/shardfiles\/([^/]+)\//u, /^\/assets\/(?:baked\/|music\/|sfx\/)?([^/]+)\//u, /^\/assets\/horizon\/(.+?)-(?:day|night|dusk|dawn)/u,
    /^\/assets\/shard-(.+?)-/u];
  for (const pattern of named) {
    const slug = pattern.exec(path)?.[1];
    if (slug !== undefined && ALL_SLUGS.has(slug)) return slug;
  }
  const plot = /^\/assets\/open-plots\/([^/]+)\//u.exec(path)?.[1];
  if (plot !== undefined && ALL_SLUGS.has(`open-plot-${plot}`)) return `open-plot-${plot}`;
  // flat hashed files named after a level: its chunks (`shard-<slug>-…`) and its card art (`<slug>-…`, an open plot's `<idea>-…`)
  for (const slug of ALL_SLUGS) {
    const idea = slug.replace(/^open-plot-/u, '');
    if (path.startsWith(`/assets/shard-${slug}-`) || path.startsWith(`/assets/${slug}-`) || path.startsWith(`/assets/${idea}-`)) return slug;
  }
  return null;
}
/** The level's dependency set: every same-origin request that names no other level. In the grid the level is every cell a
 *  boost lap from spawn can reach (filled in at control from the grid's state). */
const levelSlugs = new Set(flow === 'grid' ? [] : [flow]);
const origin = new URL(base).origin;
const isLevelContent = (url) => {
  const at = new URL(url);
  // blob: and data: URLs are in-memory reads, not downloads
  if (!at.protocol.startsWith('http') || at.origin !== origin || at.pathname === '/version.json') return false;
  // SHARD SELECT card art (a level's thumb, portrait and landscape cards) is menu art, never drawn in the level
  if (/^\/assets\/[a-z0-9-]+?-(?:landscape|portrait)-[\w-]+\.(?:jpg|webp)$/u.test(at.pathname) || /^\/assets\/card-[\w-]+\.jpg$/u.test(at.pathname)) return false;
  const slug = slugOf(at.pathname);
  return slug === null || levelSlugs.has(slug);
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
      // the player's own viewmodel (held weapons, arms, the board) hangs under the camera: not level content
      for (let q = o.parent; q; q = q.parent) if (q.isCamera) return;
      meshes++; if (o.visible) visible++;
      const chain = []; for (let q = o; q && chain.length < 4; q = q.parent) chain.push(q.name === '' ? q.type : q.name);
      ids.push(`${o.uuid}|${chain.join('<')}|${o.geometry?.attributes?.position?.count ?? 0}`);
    });
    const p = world.player.position, v = world.player.velocity;
    scene = { meshes, visible, ids, player: [p.x, p.y, p.z], speed: Math.hypot(v.x, v.z), hover: world.player.hover, boost: world.player.hoverBoost };
  } catch (error) { scene = { error: String(error) }; }
  let gridState = null;
  if (grid !== undefined) {
    try {
      const s = grid.state();
      gridState = { pitch: s.pitch, feet: s.feet, home: s.home, rings: s.rings, ringsReady: s.ringsReady, near: s.near,
        cells: (s.cells ?? []).map(c => ({ id: c.instance, slug: c.slug, cell: c.cell, shows: c.shows, drawn: c.drawn })) };
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
// --link=phone: DL0's one shared downlink (scripts/phone-loading/link.ts) at the phone preset's rate, page and service worker
// on the same proxy, loopback included (latency and CPU stay unshaped here)
const link = linkName === 'phone' ? await startSharedLink(profiles.phone.down) : null;
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true, args: engine === 'chromium'
  ? ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', ...(link === null ? [] : [`--proxy-server=${link.proxy}`, '--proxy-bypass-list=<-loopback>'])] : [] });
const report = { schema: 1, gate: 'DL17 complete-at-control', rev, base, flow, engine, reach, lapSeconds, levelDownload: values['level-download'] ?? null, link: link === null ? null : { preset: 'phone', bytesPerSecond: link.bytesPerSecond },
  when: new Date().toISOString(), violations: [], errors: [] };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 } });
  await developerSettings(context, { tier: 'phone', volume: 0 });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  // DL16's Debug ▸ Loading & memory ▸ Level download (src/engine/boot/loadingPacks.ts), read once at boot
  if (values['level-download'] !== undefined) await saveFixture(context, { scope: 'device', key: 'debug.levelDownload', data: values['level-download'] });
  await context.addInitScript(hideDeveloperOverlays);
  await harnessPins(context, { seed: 357, browser: `${engine} / iPhone 16 Pro`, lane: 'dl17', sha: rev });
  const control = { at: null };
  await context.exposeBinding('__dl17Control', () => { control.at ??= Date.now(); });
  await context.addInitScript(() => {
    document.addEventListener('ws:control-ready', () => { requestAnimationFrame(() => { Reflect.apply(Reflect.get(window, '__dl17Control'), window, []); }); }, { once: true });
  });
  // the whole context's requests: the page's, its dedicated workers' and the service worker's own fetches
  const open = new Map();
  context.on('request', req => {
    const row = { url: req.url(), start: Date.now(), end: null, failed: null, by: req.serviceWorker() === null ? 'page' : 'service-worker' };
    open.set(req, row); requests.push(row);
  });
  context.on('requestfinished', req => { const row = open.get(req); if (row) row.end = Date.now(); });
  context.on('requestfailed', req => { const row = open.get(req); if (row) { row.end = Date.now(); row.failed = req.failure()?.errorText ?? 'failed'; } });
  if (engine === 'webkit' && sw === 'on') report.limitations = ['Playwright WebKit reports no service-worker network events: worker-owned fetches are not counted'];
  const page = await context.newPage();
  page.setDefaultTimeout(240000);
  page.on('pageerror', error => report.errors.push(error.message));
  const version = await (await fetch(new URL('/version.json', base))).json();
  if (typeof version.build !== 'string' || !version.build.startsWith(rev.slice(0, 7))) throw new Error(`Served build ${version.build} is not ${rev}`);
  report.build = version.build;
  // the grid's title route (frame-floor's, but with the worker on unless --sw=off) or the shard's direct chunk route
  const url = new URL('/', base);
  const query = flow === 'grid' ? { mute: '1', nolock: '1' } : { chunk: flow, tier: 'phone', skipintro: '1', nolock: '1', mute: '1' };
  for (const [key, value] of Object.entries({ ...query, ...(sw === 'off' ? { sw: '0' } : {}) })) url.searchParams.set(key, value);
  report.sw = sw; report.url = url.href;
  /** One visit from navigation to control (the grid by its title tap and the HUD's own entry, the goldens' route); ms. */
  const enter = async () => {
    control.at = null;
    const start = Date.now();
    await page.goto(url.href, { waitUntil: 'load' });
    if (flow === 'grid') {
      await page.locator('.ws-main-grid').click();
      await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live.live.gameplayReady === true, undefined, { timeout: 240000 });
      await page.evaluate(FLOOR_GRID_ENTER);
    }
    await page.waitForFunction(() => window.__wildshard?.world?.hud?.entered === true, undefined, { timeout: 240000 });
    const deadline = Date.now() + 30000;
    while (control.at === null && Date.now() < deadline) await page.waitForTimeout(100);
    if (control.at === null) throw new Error('No ws:control-ready within 30 s of entry');
    return { start, control: control.at, ms: control.at - start };
  };
  const cold = await enter();
  controlAt = cold.control;
  report.tapToControlMs = cold.ms;
  if (values.warm === 'on') {
    // 039d-style warm check (sp-x6's risk): exit and re-enter while the post-control precache still runs, then again once
    // the worker has gone quiet; 'warm no slower' must hold on both, not only on a settled warm visit
    const workerOpen = () => requests.filter(r => r.by === 'service-worker' && r.end === null).length;
    await page.waitForTimeout(1000);
    const busy = { workerFetchesOpen: workerOpen(), workerFetchesSoFar: requests.filter(r => r.by === 'service-worker').length };
    // the case counts only if the precache is really running when the player comes back
    if (busy.workerFetchesOpen === 0) report.errors.push('no service-worker fetch was open at the re-entry: the mid-precache return was not exercised');
    const during = await enter();
    const quietBy = Date.now() + 180000;
    for (;;) {
      const lastStart = Math.max(0, ...requests.filter(r => r.by === 'service-worker').map(r => r.start));
      if ((workerOpen() === 0 && Date.now() - lastStart > 5000) || Date.now() > quietBy) break;
      await page.waitForTimeout(500);
    }
    const settledOpen = workerOpen(), settled = await enter();
    report.warm = { coldMs: cold.ms, duringPrecacheMs: during.ms, atReentry: busy, settledMs: settled.ms, settledWorkerFetchesOpen: settledOpen,
      workerBytesRequests: requests.filter(r => r.by === 'service-worker').length };
    report.pass = report.errors.length > 0 ? null : true;
  } else {
    report.atControl = await page.evaluate(snapshot);
    const gridAt = report.atControl.grid;
    if (flow === 'grid' && gridAt && !gridAt.error) {
      // the cells whose square meets the lap's box round spawn (a cell's centre is its index times the pitch)
      const half = gridAt.pitch / 2, fx = gridAt.feet.x, fz = gridAt.feet.z;
      const inReach = (gridAt.cells ?? []).filter(c => Math.abs(c.cell[0] * gridAt.pitch - fx) < half + reach && Math.abs(c.cell[1] * gridAt.pitch - fz) < half + reach);
      for (const c of inReach) levelSlugs.add(c.slug);
      report.reachCells = inReach.map(c => ({ id: c.id, slug: c.slug, shows: c.shows }));
    }

    // the boost lap: the level's own walk legs (scripts/physics-route.json: courses known to be drivable) that start within
    // `reach` of spawn, each driven on the hoverboard at Developer boost; the grid drives its home cell's legs, moved by the
    // cell's offset (a cell's centre is its index times the pitch)
    const lap = [];
    const homeCell = flow === 'grid' ? (gridAt?.cells ?? []).find(c => c.id === gridAt.home) : undefined;
    const homeSlug = flow === 'grid' ? homeCell?.slug : flow;
    const [ox, oz] = homeCell === undefined ? [0, 0] : [homeCell.cell[0] * gridAt.pitch, homeCell.cell[1] * gridAt.pitch];
    const [px, , pz] = report.atControl.scene?.player ?? [ox, 0, oz];
    const allLegs = JSON.parse(readFileSync(resolve('scripts/physics-route.json'), 'utf8'))[homeSlug ?? ''] ?? [];
    const legs = allLegs.map(leg => ({ name: leg.name, start: { ...leg.start, x: leg.start.x + ox, z: leg.start.z + oz }, points: leg.waypoints.map(w => [w.x + ox, w.z + oz]) }))
      .filter(leg => Math.hypot(leg.start.x - px, leg.start.z - pz) <= reach);
    if (legs.length === 0) throw new Error(`No walk leg of ${homeSlug} starts within ${reach} m of spawn: the boost lap needs scripts/physics-route.json`);
    report.lapRoute = { slug: homeSlug, legs: [] };
    report.lapResults = [];
    for (const leg of legs) {
      let metres = 0;
      for (let i = 0, from = [leg.start.x, leg.start.z]; i < leg.points.length; from = leg.points[i], i++) metres += Math.hypot(leg.points[i][0] - from[0], leg.points[i][1] - from[1]);
      // its time bound: the leg at 20 m/s (a walk course turns often) plus 15 s, so only a stuck board runs out of time
      const seconds = values.lap === undefined ? Math.ceil(metres / 20 + 15) : lapSeconds;
      report.lapRoute.legs.push({ leg: leg.name, waypoints: leg.points.length, metres: Math.round(metres), seconds });
      await page.evaluate(() => { window.__wildshard.requireWorld().player.hoverBoost = true; });
      const walk = page.evaluate(l => window.__wildshard.walkLeg({ name: `dl17-${l.name}`, start: { ...l.start, hover: true }, waypoints: l.points.map(([x, z]) => ({ x, z })), timeout: l.seconds, stuckSeconds: 5 }), { ...leg, seconds });
      const legEnd = Date.now() + seconds * 1000 + 2000, finished = { done: false };
      const settledWalk = (async () => {
        try { return await walk; } catch (error) { report.errors.push(`lap ${leg.name}: ${String(error)}`); return null; } finally { finished.done = true; }
      })();
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.__wildshard.requireWorld().player.hoverBoost = true; }); // walkLeg's start pose may reset the board
      while (!finished.done && Date.now() < legEnd) { lap.push(await page.evaluate(snapshot)); await page.waitForTimeout(250); }
      const result = await settledWalk;
      // a leg counts only when it is driven: at its last waypoint, never stuck (sp-x1's review: a timed-out drive is no lap)
      const [lx, lz] = leg.points.at(-1) ?? [leg.start.x, leg.start.z];
      const off = result?.end === undefined ? Infinity : Math.hypot(result.end.x - lx, result.end.z - lz);
      const complete = result !== null && off <= 15 && (result.stuck ?? []).length === 0;
      report.lapResults.push({ leg: leg.name, complete, result });
      if (!complete) report.errors.push(`the boost lap's ${leg.name} leg did not complete: ended ${Number.isFinite(off) ? `${off.toFixed(0)} m from its last waypoint` : 'with no result'}, ${(result?.stuck ?? []).length} stuck, ${result?.seconds?.toFixed(1) ?? '?'} of ${seconds} s`);
    }
    report.lapSamples = lap.length;
    report.lapComplete = report.lapResults.every(r => r.complete);
    report.afterLap = await page.evaluate(snapshot);

    // verdict
    const path = r => new URL(r.url).pathname;
    // Who asked decides a shared file: the page (or its workers) fetching it means the running level needs it; the service
    // worker fetching it alone is its precache (DL1), which no draw waits on. A file named after this level counts either way.
    const precache = r => r.by === 'service-worker' && slugOf(path(r)) === null;
    const level = requests.filter(r => isLevelContent(r.url) && !precache(r));
    const fetchedBefore = new Set(level.filter(r => r.start < controlAt && r.end !== null && r.end <= controlAt && r.failed === null).map(path));
    const pending = level.filter(r => r.start < controlAt && (r.end === null || r.end > controlAt));
    const lateAll = level.filter(r => r.start >= controlAt), refetch = lateAll.filter(r => fetchedBefore.has(path(r))), after = lateAll.filter(r => !fetchedBefore.has(path(r)));
    const shared = requests.filter(r => isLevelContent(r.url) && precache(r));
    const row = r => ({ url: r.url, by: r.by, msAfterControl: r.start - controlAt });
    report.requests = { total: requests.length, beforeControl: requests.filter(r => r.start < controlAt).length, byServiceWorker: requests.filter(r => r.by === 'service-worker').length, level: level.length,
      pendingAtControl: pending.map(r => ({ url: r.url, by: r.by })), afterControl: after.map(row), refetchAfterControl: refetch.map(row),
      precacheOpenAtControl: shared.filter(r => r.start < controlAt && (r.end === null || r.end > controlAt)).map(r => r.url),
      precacheAfterControl: shared.filter(r => r.start >= controlAt).length,
      otherAfterControl: requests.filter(r => r.start >= controlAt && !isLevelContent(r.url)).map(r => ({ url: r.url, by: r.by })) };
    if (report.requests.precacheOpenAtControl.length > 0) report.warnings = [`${report.requests.precacheOpenAtControl.length} service-worker precache fetches still open at control (they compete with the level's download: DL1's target, not a pop)`];
    if (pending.length > 0) report.violations.push(`${pending.length} level-content requests still open at control`);
    if (after.length > 0) report.violations.push(`${after.length} level-content requests started after control (first: ${after.slice(0, 3).map(r => path(r)).join(', ')})`);
    const g = report.atControl.grid;
    if (g && !g.error) {
      const rings = g.rings ?? {};
      if ((rings.inFlight ?? 0) > 0 || (rings.queued ?? 0) > 0) report.violations.push(`grid rings at control: ${rings.inFlight ?? 0} in flight, ${rings.queued ?? 0} queued`);
      const reachIds = new Set((report.reachCells ?? []).map(c => c.id));
      const standIns = (g.cells ?? []).filter(c => reachIds.has(c.id) && ['far proxy', 'tiles', 'loading', 'near', 'frozen'].includes(c.shows));
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
    // grid tiles join batched meshes, so a ring pop shows as a reach cell's drawn layers changing, not as a new mesh
    const lapReach = new Set((report.reachCells ?? []).map(c => c.id)), drawnAt = new Map((report.atControl.grid?.cells ?? []).map(c => [c.id, c.drawn]));
    const cellPops = new Map();
    for (const sample of [...lap, report.afterLap]) for (const c of sample.grid?.cells ?? []) {
      const before = drawnAt.get(c.id);
      if (!lapReach.has(c.id) || before === undefined || c.drawn === undefined) continue;
      if (c.drawn.l0 > before.l0 || c.drawn.l1 > before.l1 || c.drawn.far !== before.far || c.drawn.near !== before.near) {
        cellPops.set(c.id, `${c.id}: l0 ${before.l0}->${c.drawn.l0}, l1 ${before.l1}->${c.drawn.l1}, far ${before.far}->${c.drawn.far}, near ${before.near}->${c.drawn.near}`);
      }
    }
    report.lapAdds.cellPops = [...cellPops.values()];
    if (cellPops.size > 0) report.violations.push(`${cellPops.size} reach cells changed what they draw during the boost lap: ${[...cellPops.values()].join('; ')}`);
    if (addedMeshes.size > 0) report.violations.push(`${addedMeshes.size} meshes added during the boost lap: ${[...addedMeshes.values()].slice(0, 6).join('; ')}`);
    report.pass = report.errors.length > 0 ? null : report.violations.length === 0;
  }
} catch (error) {
  report.errors.push(String(error)); report.pass = null;
} finally {
  await browser.close();
  if (link !== null) { report.link.errors = link.errors.slice(0, 10); await link.close(); }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
}
const verdict = report.warm === undefined ? (report.pass ? 'COMPLETE AT CONTROL' : 'FAIL') : `WARM cold ${report.warm.coldMs} ms, re-entry during precache ${report.warm.duringPrecacheMs} ms (${report.warm.atReentry.workerFetchesOpen} worker fetches open), settled ${report.warm.settledMs} ms`;
console.log(`DL17 ${flow} ${engine} ${report.build ?? rev}: ${report.pass === null ? 'NO READING' : verdict}${report.violations.length > 0 ? `\n  - ${report.violations.join('\n  - ')}` : ''}${report.errors.length > 0 ? `\n  errors: ${report.errors.slice(0, 3).join(' | ')}` : ''}\n  report ${out}`);
process.exit(report.pass === null ? 2 : report.pass ? 0 : 1);
