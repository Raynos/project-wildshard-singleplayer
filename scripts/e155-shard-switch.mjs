#!/usr/bin/env node
// e155-shard-switch.mjs — SHARD-CACHE (E155 / E159): switch shards from the title deck in ONE page and prove it.
//
//   node scripts/e155-shard-switch.mjs [--url=http://127.0.0.1:5321] [--phone] [--cap=2 (the host's setCap: 3 keeps all three)]
//        [--route=driftwood-isle,nalati-grasslands,driftwood-isle,pine-hollow,nalati-grasslands,pine-hollow]
//        [--out=progress/e155] [--tag=desktop] [--sheet=progress/262-e155-shard-switch-desktop.jpg]
//        [--baseline]   each shard of the route also loaded fresh (its own page, as a reload did): its frame vs the in-page build's
//        [--lose]       at the end: a parked shard loses its WebGL context — it must be evicted, the running one play on
//        [--tex=ktx2|img]  Debug ▸ GPU textures for the run (the saved setting, written before the page loads — no URL switch)
//        [--debugcard]  at the end: pause ▸ Settings ▸ Debug ▸ Memory read on the page, then Shards in memory 2 → 1 (evicts at
//                       once) → 2
//
// Against a `vite preview` of the build. One browser page drives the real title deck: ENTER WORLD, a few seconds in
// the world, the view turned (a pose of its own), pause → "Exit to main menu", the next shard's card + ENTER WORLD (the
// deck's switch — src/shard/ShardHost.ts). For every step it records:
//   - that the page never navigated (a window marker set on the first load; document loads counted)
//   - whether the loading screen appeared (a MutationObserver on <body> for `.ws-load`) — never on a resident return
//   - the switch's time (the host's own timing) and the time to the first world frame after the click
//   - on a resident return: the pose and the weapon vs what the player left (must match), and the frame vs the frame they
//     left (mean abs difference of a 64×36 thumbnail, 0–255: a broken shader patch or a missing HUD reads large)
//   - on a rebuild: the frame vs the shard's first visit (the same spawn)
//   - page errors
//   - memory: performance.memory after forced GCs, the live Game / Scene / Physics / WebGLRenderer instances (CDP
//     queryObjects: an evicted shard's must be gone), the host's per-shard renderer.info + texture estimate, the evictions
//     (each evicted renderer's context must be lost)
// Headless Chromium, muted (--mute-audio + &mute=1), on Metal; the one browser is closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5321');
const PHONE = argv.includes('--phone');
const BASELINE = argv.includes('--baseline');
const LOSE = argv.includes('--lose');
const CAP = flag('cap', '');
const ROUTE = flag('route', 'driftwood-isle,nalati-grasslands,driftwood-isle,pine-hollow,nalati-grasslands,pine-hollow').split(',');
const OUT = resolvePath(flag('out', 'progress/e155'));
const TAG = flag('tag', PHONE ? 'phone' : 'desktop');
const SHEET = flag('sheet', '');
const TEX = flag('tex', '');
const DEBUGCARD = argv.includes('--debugcard');
mkdirSync(OUT, { recursive: true });
const SLUGS = ['driftwood-isle', 'pine-hollow', 'nalati-grasslands']; // the deck's order (src/chunks/registry.ts CHUNKS)
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const round = (v, k = 1) => Math.round(v * 10 ** k) / 10 ** k;

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const report = { tag: TAG, url: URL_BASE, phone: PHONE, cap: CAP === '' ? 'default (2)' : CAP, route: ROUTE, steps: [], baseline: {}, lose: null, errors: [], navigations: 0, ok: true, failures: [] };
const fail = (msg) => { report.ok = false; report.failures.push(msg); console.log(`  FAIL ${msg}`); };
const query = (slug) => `chunk=${slug}&mute=1&nolock=1${PHONE ? '&touch=1&tier=phone' : ''}`;
const contextOpts = PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1600, height: 900 } };
const titleWait = (page, slug) => page.waitForFunction((s) => {
  const host = window.__shardHost, hud = document.getElementById('hud');
  return host !== undefined && host.active === s && !host.switching && hud?.classList.contains('intro') === true && document.querySelector('#hud .ws-menu:not(.hide) .ws-menu-play') !== null && document.querySelector('.ws-load') === null;
}, slug, { timeout: Number(process.env.E155_TITLE_MS ?? 420000), polling: 250 });
// …and when it never comes, where the build stopped (the loader's step, its last rows and foot line)
const titleUp = async (page, slug) => {
  try { await titleWait(page, slug); } catch (e) {
    const at = await page.evaluate(async () => {
      const raf = await Promise.race([new Promise((resolve) => { requestAnimationFrame(() => { resolve('raf ok'); }); }), new Promise((resolve) => { window.setTimeout(() => { resolve('raf NONE in 2 s'); }, 2000); })]);
      const l = document.querySelector('.ws-load'); const host = window.__shardHost; const where = { active: host?.active, slugs: host?.slugs, switching: host?.switching, intro: document.getElementById('hud')?.classList.contains('intro'), entered: window.__world?.hud.entered, last: host?.timings.at(-1) }; return l === null ? { loader: 'none', ...where } : { raf, visible: document.visibilityState, error: document.querySelector('#wserr')?.textContent.replaceAll(/\s+/g, ' ').slice(0, 400) ?? null, step: l.dataset.step, setup: l.dataset.setup, download: l.dataset.download, foot: l.querySelector('[data-el="foot"]')?.textContent, rows: [...l.querySelectorAll('[data-el="rows"] > div')].map((d) => d.textContent).slice(-3) }; }).catch(() => 'unreadable');
    throw new Error(`${slug}: no title (${e instanceof Error ? e.message.split('\n')[0] : String(e)}) — the loader: ${JSON.stringify(at)}`, { cause: e });
  }
};
const shots = {};
const shoot = async (page, name) => {
  const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
  const file = resolvePath(OUT, `${TAG}-${name}.jpg`);
  writeFileSync(file, buf);
  shots[name] = buf.toString('base64');
  return file;
};
// mean abs difference (0–255) of two JPEGs at 64×36, drawn in a page
const diff = (page, a, b) => page.evaluate(async ([x, y]) => {
  const load = (b64) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = `data:image/jpeg;base64,${b64}`; });
  const [ia, ib] = await Promise.all([load(x), load(y)]);
  const px = (im) => { const c = document.createElement('canvas'); c.width = 64; c.height = 36; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 64, 36); return g.getImageData(0, 0, 64, 36).data; };
  const da = px(ia), db = px(ib); let s = 0, n = 0;
  for (let k = 0; k < da.length; k += 4) { s += Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]); n += 3; }
  return Math.round((s / n) * 10) / 10;
}, [shots[a], shots[b]]);

try {
  const ctx = await browser.newContext(contextOpts);
  // the saved settings the page reads at load: the texture mode (E157) and developer mode (the Debug card shows only in it)
  if (TEX !== '' || DEBUGCARD) {
    await ctx.addInitScript(({ tex, dev }) => {
      try {
        const k = 'ws.settings.v1', saved = JSON.parse(localStorage.getItem(k) ?? '{}');
        if (tex !== '' && saved.tex === undefined) saved.tex = tex;
        localStorage.setItem(k, JSON.stringify(saved));
        if (dev) localStorage.setItem('ws.dev', '1');
      } catch { /* storage blocked: defaults */ }
    }, { tex: TEX, dev: DEBUGCARD });
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { report.errors.push(e.message.slice(0, 300)); console.log(`  pageerror: ${e.message.slice(0, 200)}`); });
  page.on('console', (m) => { const t = m.text(); if (/\[shard\]|\[gl\]/.test(t)) console.log(`  console: ${t.slice(0, 200)}`); });
  page.on('domcontentloaded', () => { report.navigations++; }); // a document load (a switch's history.replaceState is not one)
  await page.goto(`${URL_BASE}/?${query(ROUTE[0])}`, { waitUntil: 'domcontentloaded' });
  // the marker + the loading-screen watch, set on the first load: a navigation would wipe both
  await page.evaluate(() => {
    window.__e155 = { mark: Math.random(), loads: [] };
    new MutationObserver((recs) => { for (const r of recs) for (const n of r.addedNodes) if (n instanceof Element && n.classList.contains('ws-load')) window.__e155.loads.push(performance.now()); }).observe(document.body, { childList: true });
  });
  const mark = await page.evaluate(() => window.__e155.mark);
  // --cap: the host's test knob (no URL switch — AGENTS.md), set once the host exists
  if (CAP !== '') await page.waitForFunction((n) => { const h = window.__shardHost; if (h === undefined) return false; h.setCap(n); return true; }, Number(CAP), { timeout: 60000, polling: 50 });
  const waitFrames = async (n, t0) => {
    const f0 = await page.evaluate(() => window.__world?.game.frameCount ?? -1);
    await page.waitForFunction((a) => (window.__world?.game.frameCount ?? -1) >= a, f0 + n, { timeout: 60000, polling: 16 });
    return Math.round(performance.now() - t0);
  };
  const heap = () => page.evaluate(async () => {
    for (let i = 0; i < 3; i++) { window.gc?.(); await new Promise((resolve) => { setTimeout(resolve, 120); }); }
    const m = performance.memory; return m ? Math.round(m.usedJSHeapSize / 1e5) / 10 : null;
  });
  const pose = () => page.evaluate(() => { const w = window.__world; const p = w.player.position; return { x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)), z: Number(p.z.toFixed(3)), yaw: Number(w.player.yaw.toFixed(4)), weapon: w.weapons.current.id }; });
  // the deck: select the target's card (a script click selects it); ENTER WORLD is then pressed with a real click (the gesture)
  const selectCard = async (slug) => {
    await page.evaluate((k) => { document.querySelector(`#hud .ws-menu:not(.hide) .ws-menu-card[data-i="${k}"]`)?.click(); }, SLUGS.indexOf(slug));
    await sleep(450);
  };
  // live instances of a class (CDP queryObjects runs a GC first): an evicted shard's Game / Scene / Physics must be gone
  const cdp = await ctx.newCDPSession(page);
  const liveCount = async (expr) => {
    const { result } = await cdp.send('Runtime.evaluate', { expression: expr, objectGroup: 'e155' });
    if (result.objectId === undefined) return null;
    const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId, objectGroup: 'e155' });
    const { result: n } = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function () { return this.length; }', returnByValue: true });
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'e155' });
    return n.value;
  };
  const instances = async () => ({
    Game: await liveCount('Object.getPrototypeOf(window.__world.game)'),
    Scene: await liveCount('Object.getPrototypeOf(window.__world.game.scene)'),
    Physics: await liveCount('Object.getPrototypeOf(window.__world.physics)'),
    WebGLRenderer: await liveCount('Object.getPrototypeOf(window.__world.game.renderer)'),
  });
  const firstShot = {}, leaveShot = {}, lastPose = {}, visits = {};

  for (let s = 0; s < ROUTE.length; s++) {
    const slug = ROUTE[s];
    const step = { n: s, slug };
    console.log(`\n── step ${s}: ${slug}`);
    const loadsBefore = await page.evaluate(() => window.__e155.loads.length);
    const wasResident = s > 0 && await page.evaluate((x) => window.__shardHost.has(x), slug);
    step.kind = s === 0 ? 'first' : wasResident ? 'resident' : (visits[slug] ?? 0) > 0 ? 'rebuild' : 'build';
    if (s > 0) await selectCard(slug);
    const t0 = performance.now();
    if (s === 0) {
      await titleUp(page, slug);
      step.toTitleMs = await page.evaluate(() => Math.round(performance.now())); // since the navigation began
      await page.click('#hud .ws-menu:not(.hide) .ws-menu-play');
    } else {
      await page.click('#hud .ws-menu:not(.hide) .ws-menu-play');
      if (!wasResident) {
        await titleUp(page, slug);
        step.toTitleMs = Math.round(performance.now() - t0);
        await sleep(300);
        await page.click('#hud .ws-menu:not(.hide) .ws-menu-play'); // a shard built in the page lands on its title, as a reload did
      }
    }
    await page.waitForFunction((x) => window.__shardHost.active === x && window.__world?.hud.entered === true, slug, { timeout: 60000, polling: 16 });
    step.toFirstFrameMs = await waitFrames(2, t0);
    const timing = await page.evaluate(() => window.__shardHost.timings.at(-1));
    step.hostMs = Math.round(timing.ms); step.hostKind = timing.kind; step.evicted = timing.evicted; step.bootSteps = timing.steps ?? null;
    step.loadingShown = (await page.evaluate((k) => window.__e155.loads.length - k, loadsBefore)) > 0;
    if (wasResident && step.loadingShown) fail(`step ${s} ${slug}: the loading screen showed on a resident return`);
    if (wasResident && timing.kind !== 'resident') fail(`step ${s} ${slug}: the host did not switch in place (${timing.kind})`);
    const now = await pose();
    step.pose = now;
    if (wasResident && lastPose[slug] !== undefined) {
      const was = lastPose[slug];
      step.poseDelta = { d: round(Math.hypot(now.x - was.x, now.z - was.z), 3), dy: round(Math.abs(now.y - was.y), 3), dyaw: round(Math.abs(now.yaw - was.yaw), 4), weapon: `${was.weapon} → ${now.weapon}` };
      if (step.poseDelta.d > 0.5 || step.poseDelta.dyaw > 0.02 || was.weapon !== now.weapon) fail(`step ${s} ${slug}: the pose did not persist (${JSON.stringify(step.poseDelta)})`);
    }
    const name = `${String(s).padStart(2, '0')}-${slug}-${step.kind}`;
    if (wasResident && leaveShot[slug] !== undefined) {
      await sleep(900); // the title's fade-out (HUD.enter: ~0.7 s), as after any ENTER WORLD
      step.shot = await shoot(page, name);
      step.diffVsLeft = await diff(page, leaveShot[slug], name);
      if (step.diffVsLeft > 12) fail(`step ${s} ${slug}: the frame after the return differs from the one left (${step.diffVsLeft} / 255)`);
      await sleep(1600);
    } else {
      await sleep(2500);
      step.shot = await shoot(page, name);
      if (firstShot[slug] === undefined) firstShot[slug] = name;
      else {
        step.diffVsFirst = await diff(page, firstShot[slug], name);
        if (step.diffVsFirst > 12) fail(`step ${s} ${slug}: the rebuilt shard's frame differs from its first visit (${step.diffVsFirst} / 255)`);
      }
    }
    visits[slug] = (visits[slug] ?? 0) + 1;
    step.markOk = (await page.evaluate(() => window.__e155?.mark)) === mark;
    if (!step.markOk) fail(`step ${s} ${slug}: the page navigated (the marker is gone)`);
    step.heapMB = await heap();
    step.resident = await page.evaluate(() => window.__shardHost.slugs);
    step.stats = await page.evaluate(() => window.__shardHost.stats());
    step.evictions = await page.evaluate(() => window.__shardHost.evictions.map((e) => `${e.slug}:${e.contextLost ? 'lost' : 'LIVE'}`));
    for (const e of step.evicted) if (!step.evictions.includes(`${e}:lost`)) fail(`step ${s}: evicted ${e} but its WebGL context was not lost (${step.evictions.join(', ')})`);
    // KTX2 (E157): a compressed texture in the running scene whose mips were dropped after another renderer's upload and
    // that this renderer never uploaded would draw nothing (or throw at upload): a module cache shared across renderers
    step.unuploadable = await page.evaluate(() => {
      const w = window.__world, props = w.game.renderer.properties, bad = new Set();
      w.game.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) for (const v of Object.values(m)) if (v?.isCompressedTexture === true && v.mipmaps.length === 0 && props.get(v).__webglTexture === undefined) bad.add(v.name !== '' ? v.name : v.uuid.slice(0, 8)); });
      return [...bad];
    });
    if (step.unuploadable.length > 0) fail(`step ${s} ${slug}: ${step.unuploadable.length} KTX2 textures lost their mips to another renderer (${step.unuploadable.slice(0, 5).join(', ')})`);
    step.live = await instances();
    if (step.live.Game !== null && step.live.Game > step.resident.length) fail(`step ${s}: ${step.live.Game} Game instances alive for ${step.resident.length} resident shards (an evicted world is retained)`);
    console.log(`  ${step.kind}: host ${step.hostMs} ms (${step.hostKind})${step.toTitleMs === undefined ? '' : ` · title ${step.toTitleMs} ms`} · first frame ${step.toFirstFrameMs} ms · loading ${step.loadingShown ? 'SHOWN' : 'no'} · evicted [${step.evicted.join(', ')}]`);
    console.log(`  resident [${step.resident.join(', ')}] · heap ${step.heapMB} MB · evictions [${step.evictions.join(', ')}] · live ${JSON.stringify(step.live)}`);
    for (const st of step.stats) console.log(`    ${st.slug.padEnd(18)} ${st.running ? 'running' : 'parked '} geo ${st.geometries} tex ${st.textures} programs ${st.programs} ~${st.textureMB} MB textures${st.contextLost ? ' LOST' : ''}`);
    if (step.bootSteps !== null && step.kind !== 'resident') console.log(`  boot steps: ${Object.entries(step.bootSteps).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    if (step.poseDelta !== undefined) console.log(`  pose after return: Δ ${step.poseDelta.d} m, Δy ${step.poseDelta.dy}, Δyaw ${step.poseDelta.dyaw}, weapon ${step.poseDelta.weapon}`);
    if (step.diffVsFirst !== undefined) console.log(`  frame vs first visit: mean |Δ| ${step.diffVsFirst} / 255`);
    if (step.diffVsLeft !== undefined) console.log(`  frame vs the one the player left: mean |Δ| ${step.diffVsLeft} / 255`);
    report.steps.push(step);
    // leave a pose of this visit's own: the view turned; the frame the player leaves; then pause → "Exit to main menu"
    await page.evaluate(() => { window.__world.player.yaw += 0.35; });
    await sleep(700);
    lastPose[slug] = await pose();
    leaveShot[slug] = `${name}-leave`;
    await shoot(page, leaveShot[slug]);
    await page.evaluate(() => { window.__world.hud.exitToMenu(); });
    await sleep(600);
  }

  if (LOSE) {
    // a parked shard loses its context (the browser's context limit, an iOS memory squeeze): evicted, no reload, no resume screen
    console.log('\n── a parked shard loses its WebGL context');
    const running = await page.evaluate(() => window.__shardHost.active);
    const parked = await page.evaluate(() => window.__shardHost.slugs.find((x) => x !== window.__shardHost.active) ?? null);
    if (parked === null) fail('--lose: no parked shard to lose');
    else {
      await page.evaluate((x) => { window.__shardHost.debugLoseContext(x); }, parked);
      await sleep(1500);
      const after = await page.evaluate(() => ({ slugs: window.__shardHost.slugs, active: window.__shardHost.active, resume: document.querySelector('.ws-resume')?.classList.contains('show') ?? false, mark: window.__e155?.mark }));
      report.lose = { parked, running, ...after };
      console.log(`  lost ${parked} while ${running} ran → resident [${after.slugs.join(', ')}], running ${after.active}, resume screen ${after.resume ? 'SHOWN' : 'no'}`);
      if (after.slugs.includes(parked)) fail(`--lose: ${parked} lost its context while parked but is still resident`);
      if (after.active !== running || after.resume || after.mark !== mark) fail('--lose: the running shard was disturbed (a reload, the resume screen or a switch)');
      // …and it plays on
      await selectCard(running); await page.click('#hud .ws-menu:not(.hide) .ws-menu-play');
      await page.waitForFunction(() => window.__world?.hud.entered === true, undefined, { timeout: 30000 });
      await waitFrames(3, performance.now());
      await page.evaluate(() => { window.__world.hud.exitToMenu(); });
      await sleep(400);
    }
  }
  if (DEBUGCARD) {
    console.log('\n── pause ▸ Settings ▸ Debug ▸ Memory');
    // two resident first (the context-loss check may have left one): build another shard in the page
    if ((await page.evaluate(() => window.__shardHost.slugs.length)) < 2) {
      const other = await page.evaluate((all) => all.find((x) => !window.__shardHost.has(x)) ?? null, SLUGS);
      if (other !== null) { await selectCard(other); await page.click('#hud .ws-menu:not(.hide) .ws-menu-play'); await titleUp(page, other); }
    }
    const slug = await page.evaluate(() => window.__shardHost.active);
    await selectCard(slug); await page.click('#hud .ws-menu:not(.hide) .ws-menu-play');
    await page.waitForFunction(() => window.__world?.hud.entered === true, undefined, { timeout: 30000 });
    await page.evaluate(() => { window.__world.hud.setPaused(true); });
    await sleep(2600);
    const read = () => page.evaluate(() => document.querySelector('.ws-gmenu-mem')?.textContent ?? null);
    report.debugCard = { before: await read() };
    console.log(`  readout:\n    ${String(report.debugCard.before).replaceAll('\n', '\n    ')}`);
    if (report.debugCard.before === null || !String(report.debugCard.before).includes('Resident')) fail('--debugcard: no memory readout in the Debug card');
    const before = await page.evaluate(() => window.__shardHost.slugs.length);
    const pick = (v) => page.evaluate((x) => {
      const row = [...document.querySelectorAll('.ws-gmenu-row')].find((r) => r.textContent.includes('Shards in memory'));
      row?.querySelector(`.ws-gmenu-segbtn[data-v="${x}"]`)?.click();
      return row !== undefined;
    }, v);
    if (!(await pick('1'))) fail('--debugcard: no Shards in memory picker');
    await sleep(2300);
    const after = await page.evaluate(() => ({ slugs: window.__shardHost.slugs, cap: window.__shardHost.cap }));
    report.debugCard.drop = { before, after };
    report.debugCard.after = await read();
    console.log(`  Shards in memory → 1: resident ${before} → [${after.slugs.join(', ')}] (cap ${after.cap})\n    ${String(report.debugCard.after).replaceAll('\n', '\n    ')}`);
    if (after.slugs.length !== 1 || after.cap !== 1) fail('--debugcard: lowering Shards in memory to 1 did not evict down at once');
    await pick('2');
    await page.evaluate(() => { window.__world.hud.setPaused(false); });
    await sleep(300);
    const timer = await page.evaluate(() => window.__world.hud.menu.isOpen);
    if (timer) fail('--debugcard: the menu did not close');
  }
  if (report.navigations > 1) fail(`the page loaded ${report.navigations} documents`);

  if (BASELINE) {
    // each shard loaded fresh, as its own page (what a reload did): its first frame vs the in-page build's first visit
    for (const slug of new Set(ROUTE)) {
      console.log(`\n── baseline: ${slug} loaded fresh`);
      const p = await ctx.newPage();
      p.on('pageerror', (e) => { report.errors.push(`baseline ${slug}: ${e.message.slice(0, 300)}`); });
      await p.goto(`${URL_BASE}/?${query(slug)}`, { waitUntil: 'domcontentloaded' });
      await titleUp(p, slug);
      await p.click('#hud .ws-menu:not(.hide) .ws-menu-play');
      await p.waitForFunction(() => window.__world?.hud.entered === true, undefined, { timeout: 60000 });
      await sleep(2500);
      const name = `baseline-${slug}`;
      await shoot(p, name);
      const d = await diff(page, firstShot[slug], name);
      report.baseline[slug] = d;
      console.log(`  in-page first visit (${firstShot[slug]}) vs a fresh page: mean |Δ| ${d} / 255`);
      if (d > 12) fail(`baseline ${slug}: the in-page build looks different from a fresh load (${d} / 255)`);
      await p.close();
    }
  }

  if (SHEET !== '') {
    // a contact sheet: every visit's frame, captioned, 3 per row
    const names = Object.keys(shots).filter((n) => !n.endsWith('-leave'));
    const sheet = await page.evaluate(async ({ list, phone }) => {
      const W = phone ? 260 : 480, H = phone ? 563 : 270, cols = 3, rows = Math.ceil(list.length / cols), pad = 8, cap = 22;
      const c = document.createElement('canvas'); c.width = cols * (W + pad) + pad; c.height = rows * (H + cap + pad) + pad;
      const g = c.getContext('2d'); g.fillStyle = '#0d1b26'; g.fillRect(0, 0, c.width, c.height);
      g.font = '600 14px ui-monospace, monospace'; g.fillStyle = '#8fe3ff';
      for (let i = 0; i < list.length; i++) {
        const [label, b64] = list[i];
        const im = await new Promise((resolve) => { const x = new Image(); x.onload = () => resolve(x); x.src = `data:image/jpeg;base64,${b64}`; });
        const x = pad + (i % cols) * (W + pad), y = pad + Math.floor(i / cols) * (H + cap + pad);
        g.fillText(label.toUpperCase(), x, y + 15);
        g.drawImage(im, x, y + cap, W, H);
      }
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, { list: names.map((n) => [n, shots[n]]), phone: PHONE });
    writeFileSync(resolvePath(SHEET), Buffer.from(sheet, 'base64'));
    console.log(`\nsheet: ${SHEET}`);
  }
} catch (e) {
  fail(`the run threw: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await browser.close();
}
writeFileSync(resolvePath(OUT, `${TAG}-report.json`), JSON.stringify(report, null, 1));
console.log(`\n${report.ok ? 'PASS' : 'FAIL'} · ${report.steps.length} steps · page errors ${report.errors.length} · document loads ${report.navigations}`);
for (const f of report.failures) console.log(`  - ${f}`);
process.exit(report.ok ? 0 : 1);
