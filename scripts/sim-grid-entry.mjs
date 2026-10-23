#!/usr/bin/env node
// G622 M1: the iOS Simulator grid-entry recording (round 40's method, art/grid/round-40-sim-grid-entry/) as a script.
// Run it inside the Simulator lane; each official reading owns its quiet window:
//   scripts/sim-lane.sh run --max 45 wildshard-iphone node scripts/sim-grid-entry.mjs --base=<url> | --rev=<sha>
//     [--runs=3] [--modes=cold,warm] [--out=tmp/sim-grid-entry/<label>] [--keep-video]
//     [--shard=sunscar-dunes] selects the explicit compiled card, never legacy.
// --base drives a served build or live; --rev serves that commit (scripts/serve-build.sh --rev) and stops it after.
// Each run: Safari terminated; a cold run clears the worker, every cache and the prefetch markers (a warm run keeps
// them); the title; Developer on; six seconds on the menu (its prefetch starts 4 s in); tap INFINITE WILDSHARD; record
// the screen. The page's own clocks give the times from the tap: the loader's first paint (first contentful paint of
// the entry page), each loader row (data-key / data-ms and its detail) and the step totals shown, the download % shown, the loader's
// end, the reveal's start and the controls (the reveal's end), and the worst frame in the 8 s after the controls. The
// video is read only for the broken-frame check: between the loader's end and the reveal, a frame like neither the last
// loader frame nor the first reveal frame (round 40's HUD over orange / blue triangles). Medians per mode at the end.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { soakInspector } from './soak/inspector.mjs';
import { loadingCardIndex, loadingShardName } from './loading-benchmark/catalogue.mjs';
import { observeTransport } from './loading-benchmark/transport.mjs';
import { accuracyRecorder } from './loading-benchmark/accuracy-data.mjs';
import { requireCompiledEntry, downloadEvidence, transportEvidence } from './loading-benchmark/sim-shard.mjs';
import { saveFixtureCode } from './debug-settings.mjs';

const REPO = resolvePath(import.meta.dirname, '..');
/** @type {Partial<Record<string, string>>} */
const args = Object.fromEntries(process.argv.slice(2).map(arg => /^--([^=]+)(?:=(.*))?$/u.exec(arg)).filter(match => match !== null).map(match => [match[1], match.at(2) ?? '1']));
const udid = process.env.SIM_UDID;
if (udid === undefined || udid === '') throw new Error('Run under scripts/sim-lane.sh run (it sets SIM_UDID)');
if ((args.base === undefined) === (args.rev === undefined)) throw new Error('Pass exactly one of --base=<url> or --rev=<sha>');
/** The official reader is the only quiet owner; builds happen before take. */
function quiet(action) {
  const result = spawnSync('python3', [resolvePath(REPO, 'scripts/sim-quiet.py'), action, String(process.pid)], { cwd: REPO, encoding: 'utf8' });
  if (result.status !== 0) { const message=result.stderr.trim();throw new Error(message.length===0?'Simulator quiet refused':message); }
}
const shard = args.shard;
if (shard !== undefined) loadingShardName(shard);
if (shard !== undefined && args.base !== undefined && new URL(args.base).protocol !== 'http:') throw new Error('Compiled byte observation requires a local HTTP served build');
quiet('verify');
const runs = Number(args.runs ?? 3), modes = (args.modes ?? 'cold,warm').split(','), keepVideo = args['keep-video'] === '1';
if (!Number.isSafeInteger(runs) || runs < 1 || runs > 3 || new Set(modes).size !== modes.length || modes.some(mode => !['cold', 'warm'].includes(mode))) throw new Error('Expected 1..3 runs and unique cold/warm modes');
const out = resolvePath(REPO, args.out ?? `tmp/sim-grid-entry/${args.rev ?? 'base'}`);
mkdirSync(out, { recursive: true });

/** Serve a commit for the run; the preview is stopped when the script ends. */
function serve(rev) {
  const result = spawnSync('bash', [resolvePath(REPO, 'scripts/serve-build.sh'), '--rev', rev, '--hours', '2', '--name', 'sim-grid-entry'], { cwd: REPO, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  writeFileSync(resolvePath(out, 'serve.stdout.log'), result.stdout ?? '');
  writeFileSync(resolvePath(out, 'serve.stderr.log'), result.stderr ?? '');
  const url = (result.stdout ?? '').split('\n').findLast(line => /^https?:/u.test(line));
  if (result.status !== 0 || url === undefined) throw new Error(`serve-build failed (${result.status}, ${result.error?.message ?? 'see retained serve logs'}): ${(result.stderr ?? '').slice(-800)}`);
  return { url: url.replace(/\/$/u, ''), stop: () => { spawnSync('bash', [resolvePath(REPO, 'scripts/serve-build.sh'), 'stop', new URL(url).port], { cwd: REPO, stdio: 'ignore' }); } };
}

const served = args.rev === undefined ? null : serve(args.rev);
const upstream = served?.url ?? (args.base ?? '').replace(/\/$/u, '');
// The existing independent HTTP observer injects a first-HTML recorder only.
// Asset and worker bytes pass through unchanged. Grid recordings keep their URL.
const transport = shard === undefined ? null : await observeTransport(upstream, { recorder: accuracyRecorder });
const BASE = (transport?.base ?? upstream).replace(/\/$/u, '');
const sock = execFileSync('xcrun', ['simctl', 'getenv', udid, 'RWI_LISTEN_SOCKET'], { encoding: 'utf8' }).trim();
const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${sock}`, '-c', 'null:9221,:9232-9240'], { stdio: 'ignore' });

let page = null;
async function connect(prefix) {
  if (page !== null) { page.close(); page = null; }
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    for (let port = 9232; port <= 9240; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const found = pages.find(row => typeof row.url === 'string' && row.url.startsWith(prefix));
        if (found !== undefined) { page = soakInspector(found.webSocketDebuggerUrl); await page.opened; await sleep(700); await page.evaluate('1'); return found.url; }
      } catch { if (page !== null) { page.close(); page = null; } }
    }
    await sleep(300);
  }
  throw new Error(`No inspector page for ${prefix}`);
}
/** A user-gesture evaluation (the menu tap and the Developer toggle need one). */
async function gesture(expression) {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, emulateUserGesture: true });
  if (result.wasThrown) throw new Error(result.result?.description ?? 'Safari evaluation threw');
  return result.result?.value;
}
async function until(expression, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (await page.evaluate(expression)) return true; } catch { /* the page navigates */ } await sleep(250); }
  return false;
}
/** A promise in the page, polled (the inspector does not await on WebKit). */
async function settle(body, ms = 30000) {
  await page.evaluate(`window.__simCap = null; (${body})().then(v => { window.__simCap = { v }; }, e => { window.__simCap = { v: 'ERR ' + String(e) }; }); 1`);
  const end = Date.now() + ms;
  while (Date.now() < end) { const value = await page.evaluate('window.__simCap ? JSON.stringify(window.__simCap.v) : null'); if (value !== null) return JSON.parse(value); await sleep(250); }
  return 'timeout';
}

// the entry page's own watcher, installed as soon as the inspector reaches it: one rAF loop, read by the polls
const WATCH = `window.__simEntry ??= (() => {
  const s = { seen: false, gone: null, rows: [], totals: [], downloads: [], worst: 0, worstAt: null };
  let last = performance.now();
  const tick = t => {
    const gap = t - last; last = t;
    const l = document.querySelector('.ws-load');
    const shown = l !== null && l.isConnected && l.getClientRects().length > 0 && getComputedStyle(l).display !== 'none' && getComputedStyle(l).opacity !== '0';
    if (shown) {
      s.seen = true;
      s.rows = [...l.querySelectorAll('[data-key]')].map(e => [e.dataset.key, Number(e.dataset.ms), (e.children[0]?.textContent ?? '').trim(), (e.children[1]?.textContent ?? '').trim()]);
      const total = /(\\d+)\\s*\\/\\s*(\\d+)/u.exec(l.querySelector('[data-el="suFact"]')?.textContent ?? '')?.[2];
      if (total !== undefined && s.totals.at(-1) !== Number(total)) s.totals.push(Number(total));
      const dl = Number(l.dataset.download);
      if (Number.isFinite(dl) && s.downloads.at(-1) !== dl) s.downloads.push(dl);
    } else if (s.seen && s.gone === null) s.gone = t;
    const r = window.__wsReveal;
    if (r != null && r.endedMs != null) { const at = r.startedAt + r.endedMs; if (t > at && t < at + 8000 && gap > s.worst) { s.worst = gap; s.worstAt = t - at; } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return s;
})(); 1`;
const READ = `JSON.stringify({ origin: performance.timeOrigin, entry: window.__simEntry ?? null, reveal: window.__wsReveal ?? null,
  fcp: performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')?.startTime ?? null, href: location.href,
  tap: Number(sessionStorage.getItem('sim.tap')) })`;

/** Raw 48 x 88 RGB frames of the video between two times (seconds), 30 fps. */
function frames(video, from, to) {
  const W = 48, H = 88, result = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, from)), '-to', String(to), '-i', video,
    '-vf', `fps=30,scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 512 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${String(result.stderr).slice(-400)}`);
  const size = W * H * 3, list = [];
  for (let at = 0; at + size <= result.stdout.length; at += size) list.push(result.stdout.subarray(at, at + size));
  return list;
}
const distance = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0)); return sum / a.length; };
/** Frames between the loader's end and the reveal's start that look like neither (mean RGB distance, 0..255). */
function brokenFrames(video, loaderEnd, revealStart) {
  // 1.5 s of loader before (the video is placed by the recorder's start message, a few hundred ms late at worst)
  const list = frames(video, loaderEnd - 1.5, revealStart + 0.5), loader = list.at(0), world = list.at(-1);
  if (loader === undefined || world === undefined) return { checked: 0, broken: [] };
  const broken = [];
  list.forEach((frame, index) => {
    const dl = distance(frame, loader), dw = distance(frame, world);
    // round 40's broken frames sat at 33-39 from both for ~0.4 s; the loader fade and the reveal's motion stay under 28
    if (Math.min(dl, dw) > 30) broken.push({ at: Number((loaderEnd - 1.5 + index / 30).toFixed(2)), loader: Math.round(dl), world: Math.round(dw) });
  });
  return { checked: list.length, broken };
}

function log(file, row) { appendFileSync(file, `${JSON.stringify({ t: Date.now(), ...row })}\n`); }

async function run(mode, index) {
  const label = `${mode}-${index}`, file = resolvePath(out, `${label}.jsonl`), video = resolvePath(out, `${label}.mp4`);
  rmSync(file, { force: true });
  try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* not running */ }
  await sleep(2000);
  execFileSync('xcrun', ['simctl', 'openurl', udid, `${BASE}/version.json`]);
  await connect(`${BASE}/version.json`);
  log(file, { ev: 'version', v: await page.evaluate('document.body.innerText') });
  if (mode === 'cold') log(file, { ev: 'cold-reset', r: await settle(`async () => {
    const regs = await navigator.serviceWorker.getRegistrations(); for (const g of regs) await g.unregister();
    const keys = await caches.keys(); for (const k of keys) await caches.delete(k);
    let markers = 0; for (const k of Object.keys(localStorage)) if (k.startsWith('ktx2set:') || k.includes('prefetch')) { localStorage.removeItem(k); markers++; }
    const http = await fetch('/clear-cache.json?sw=0', { cache: 'no-store' }).then(r => r.status).catch(e => String(e));
    return { regs: regs.length, caches: keys.length, markers, http, usage: (await navigator.storage.estimate()).usage };
  }`) });
  else log(file, { ev: 'warm-keys', r: await settle(`async () => ({ caches: (await caches.keys()).length, usage: (await navigator.storage.estimate()).usage, sw: (await navigator.serviceWorker.getRegistrations()).length })`) });
  log(file, { ev: 'volume', r: await page.evaluate(`JSON.parse(localStorage.getItem('wildshard.save.v2.global') || '{}').keys?.settings?.data?.volume ?? null`) });
  const recorder = spawn('xcrun', ['simctl', 'io', udid, 'recordVideo', '--codec=h264', '--force', video], { stdio: ['ignore', 'pipe', 'pipe'] });
  const recordingAt = await new Promise(resolve => {
    const on = data => { if (/Recording started/iu.test(String(data))) resolve(Date.now()); };
    recorder.stdout.on('data', on); recorder.stderr.on('data', on); setTimeout(() => { resolve(Date.now()); }, 8000);
  });
  let sample = null, compiled = null;
  try {
    await sleep(1000);
    const setup = shard === undefined ? '' : [
      saveFixtureCode({ scope: 'device', key: 'devMode', data: true }),
      saveFixtureCode({ scope: 'device', key: 'debug.global.legacyShardButtons', data: 'on' }),
      saveFixtureCode({ scope: 'global', key: 'settings', merge: true, data: { volume: 0, tier: 'phone' } }),
      saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } }),
    ].join(';');
    await page.evaluate(`${setup};setTimeout(() => location.replace('/'), 50); true`);
    await sleep(800); await connect(`${BASE}/`);
    if (!await until(`!!document.querySelector('.ws-main-dev')`, 180000)) throw new Error('The title never showed its Developer switch');
    if (shard === undefined && !await page.evaluate(`!!document.querySelector('.ws-main-grid')`)) {
      await gesture(`document.querySelector('.ws-main-dev').click(); 1`); await sleep(1500);
      try { await page.evaluate('1'); } catch { await connect(`${BASE}/`); }
    }
    let button = '.ws-main-grid';
    if (shard !== undefined) {
      await gesture(`document.querySelector('.ws-main-select').click(); true`);
      if (!await until(`document.querySelectorAll('.ws-menu-card').length > 0`, 30000)) throw new Error('No shard cards');
      const titles = JSON.parse(await page.evaluate(`JSON.stringify([...document.querySelectorAll('.ws-menu-card')].map(card => card.querySelector('b')?.textContent ?? ''))`));
      const selected = loadingCardIndex(titles, shard);
      await gesture(`document.querySelector('.ws-menu-dots i[data-i="${selected}"]').click(); true`);
      if (!await until(`document.querySelector('.ws-menu-card.selected')?.dataset.i === '${selected}'`, 30000)) throw new Error('Requested shard card not selected');
      button = '.ws-menu-shardfile';
    }
    if (!await until(`(() => { const b = document.querySelector('${button}'); return !!b && b.getClientRects().length > 0; })()`, 30000)) throw new Error('Missing real entry control');
    await sleep(6000);
    await gesture(`(() => { sessionStorage.setItem('sim.tap', String(performance.timeOrigin + performance.now())); setTimeout(() => document.querySelector('${button}').click(), 0); return true; })()`);
    const tapAt = Date.now(); log(file, { ev: 'tap', at: tapAt });
    await sleep(300);
    let ended = null;
    while (Date.now() < tapAt + 240000) {
      try {
        if (page === null) await connect(BASE);
        await page.evaluate(WATCH);
        sample = JSON.parse(await page.evaluate(READ));
        log(file, { ev: 'poll', ...sample });
        if (shard !== undefined) {
          compiled = JSON.parse(await page.evaluate(`JSON.stringify({ href: location.href, origin: performance.timeOrigin, at: performance.now(), accuracy: window.__loadingAccuracy ?? null,
            ready: !!window.__wildshard?.world?.hud.entered && !window.__wildshard.world.hud.paused && window.__wildshard.world.game.frameGate() && ![...document.querySelectorAll('.ws-load')].some(panel => getComputedStyle(panel).display !== 'none' && Number(getComputedStyle(panel).opacity) > .05),
            measures: performance.getEntriesByType('measure').map(row => ({ name: row.name, start: row.startTime, ms: row.duration })) })`));
          if ((compiled.accuracy?.readyAt > 0 && compiled.ready) || compiled.accuracy?.errors.length > 0) break;
        }
        if (typeof sample.reveal?.endedMs === 'number' && ended === null) ended = Date.now();
        if (ended !== null && Date.now() - ended > 8500) break;
      } catch (error) { log(file, { ev: 'poll-error', e: String(error).slice(0, 160) }); try { await connect(BASE); } catch { /* retried next poll */ } }
      await sleep(500);
    }
  } finally {
    recorder.kill('SIGINT'); await new Promise(resolve => { recorder.once('exit', resolve); setTimeout(resolve, 15000); });
  }
  if (shard !== undefined) {
    if (compiled === null || !compiled.ready) throw new Error(`${label}: compiled entry never reached controls`);
    requireCompiledEntry(compiled.href, shard, compiled.accuracy);
    const receipts = transport.receipts.filter(row => row.endedAt >= compiled.origin && row.endedAt <= compiled.origin + compiled.accuracy.readyAt);
    const result = { mode, run: index, shard, href: compiled.href, accuracy: compiled.accuracy, measures: compiled.measures,
      download: downloadEvidence(compiled.accuracy.samples), transportUnits: transportEvidence(receipts), transportReceipts: receipts, htmlFixtures: transport.htmlFixtures,
      rows: compiled.accuracy.final.rows.flatMap(row => Number.isFinite(Number(row.ms)) ? [{ key: row.key, ms: Number(row.ms), label: row.label, detail: row.detail }] : []),
      loaderPaintMs: sample.fcp === null ? null : Math.round(compiled.origin + sample.fcp - sample.tap),
      loaderEndMs: Math.round(compiled.origin + compiled.accuracy.readyAt - sample.tap),
      controlsMs: Math.round(compiled.origin + compiled.at - sample.tap), controlsObservationIntervalMs: 500 };
    if (!keepVideo) rmSync(video, { force: true });
    writeFileSync(resolvePath(out, `${label}.json`), `${JSON.stringify(result, null, 1)}\n`);
    return result;
  }
  if (typeof sample?.reveal?.endedMs !== 'number' || sample.entry === null) throw new Error(`${label}: the entry never reached the controls`);
  const { origin, entry, reveal, fcp, tap } = sample, from = at => Math.round(origin + at - tap);
  const result = { mode, run: index, href: sample.href,
    loaderPaintMs: fcp === null ? null : from(fcp), loaderEndMs: entry.gone === null ? null : from(entry.gone),
    revealStartMs: from(reveal.startedAt), controlsMs: from(reveal.startedAt + reveal.endedMs), revealSkipped: reveal.skipped,
    worstFrameAfterControlsMs: Math.round(entry.worst), worstFrameAt: entry.worstAt === null ? null : Math.round(entry.worstAt),
    stepTotals: entry.totals, downloadShown: entry.downloads, downloadDrops: entry.downloads.filter((value, i) => i > 0 && value < (entry.downloads[i - 1] ?? 0)).length,
    rows: entry.rows.map(([key, ms, text, detail]) => ({ key, ms: Math.round(ms), label: text, detail })) };
  // video seconds of a page time: the recording started at recordingAt (wall clock), the tap at tapAt
  const videoAt = ms => (tap + ms - recordingAt) / 1000;
  result.brokenFrames = result.loaderEndMs === null ? null : brokenFrames(video, videoAt(result.loaderEndMs), videoAt(result.revealStartMs));
  if (!keepVideo) rmSync(video, { force: true });
  writeFileSync(resolvePath(out, `${label}.json`), `${JSON.stringify(result, null, 1)}\n`);
  return result;
}

const median = values => { const sorted = values.filter(value => typeof value === 'number').sort((a, b) => a - b); return sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)]; };
const results = [];
try {
  for (const { mode, index } of modes.flatMap(visit => Array.from({ length: runs }, (_, at) => ({ mode: visit, index: at + 1 })))) {
    quiet('take');
    try { results.push(await run(mode, index)); }
    catch (error) { results.push({ mode, run: index, error: String(error) }); break; }
    finally { quiet('release'); }
    const last = results.at(-1); console.info(JSON.stringify(last).slice(0, 600));
  }
} finally {
  page?.close(); proxy.kill();
  try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* Already closed. */ }
  await transport?.close(); served?.stop();
}

const summary = { shard: shard ?? null, base: BASE, rev: args.rev ?? null, at: new Date().toISOString(), modes: Object.fromEntries(modes.map(mode => {
  const rows = results.filter(row => row.mode === mode && row.error === undefined);
  const keys = ['loaderPaintMs', 'loaderEndMs', 'revealStartMs', 'controlsMs', 'worstFrameAfterControlsMs'];
  const steps = [...new Set(rows.flatMap(row => (row.rows ?? []).map(step => step.key)))];
  return [mode, { runs: rows.length, failed: results.filter(row => row.mode === mode && row.error !== undefined).length,
    ...Object.fromEntries(keys.map(key => [key, median(rows.map(row => row[key]))])),
    // the first total (1) is the modules-only path the loader shows before the entry sets its own
    stepTotalGrew: shard === undefined ? rows.some(row => (row.stepTotals ?? []).filter(total => total > 1).length > 1) : null, downloadDrops: rows.reduce((sum, row) => sum + (row.download?.downloadDrops ?? row.downloadDrops), 0),
    brokenFrames: shard === undefined ? rows.reduce((sum, row) => sum + (row.brokenFrames?.broken.length ?? 0), 0) : null,
    steps: Object.fromEntries(steps.map(key => [key, median(rows.map(row => (row.rows ?? []).find(step => step.key === key)?.ms))])) }];
})) };
writeFileSync(resolvePath(out, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
for (const [mode, row] of Object.entries(summary.modes)) console.info(`${mode}: ${row.runs} runs (${row.failed} failed) · loader ${row.loaderPaintMs} ms · loader end ${row.loaderEndMs} · reveal ${row.revealStartMs} · controls ${row.controlsMs} ms · worst frame after controls ${row.worstFrameAfterControlsMs} ms · step total grew ${row.stepTotalGrew} · download drops ${row.downloadDrops} · broken frames ${row.brokenFrames}`);
console.info(`summary: ${resolvePath(out, 'summary.json')}`);
if (results.some(row => row.error !== undefined)) process.exitCode = 1;
