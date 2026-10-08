#!/usr/bin/env node
// SF67 loading audit (E461): SHARD SELECT -> shard load in the iOS Simulator's Safari, through Web Inspector.
// The caller holds the Simulator lease (scripts/sim-lane.sh lease) and passes its UDID. Per run: open the bare title,
// tap the shard's card + ENTER WORLD (Runtime.evaluate), and on the navigation's process swap start WebKit's
// ScriptProfiler (sampling) and install a rAF-gap + loading-step recorder. Done when the loader is gone + 2 s.
// Writes <out>/<shard>-<run>.sim.json: steps, rAF gaps (a main-thread freeze as the loading screen sees it), the
// profiler samples (url/line/column, mapped later by sim-analyze in analyze.mjs --sim).
//
//   node progress/loading/audit-2026-10-08/sim.mjs --udid=$U --base=http://127.0.0.1:4406 --shard=driftwood-isle --run=first --out=<dir>
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const U = arg('udid', ''); const BASE = arg('base', 'http://127.0.0.1:4406'); const SHARD = arg('shard', 'driftwood-isle');
const RUN = arg('run', 'first'); const OUT = resolve(arg('out', '.')); const TIMEOUT = Number(arg('timeout', '300')) * 1000;
const NAMES = { 'driftwood-isle': 'Driftwood Isle', 'pine-hollow': 'Pine Hollow', 'nalati-grasslands': 'Nalati', _template: 'Template shard' };
mkdirSync(OUT, { recursive: true });
if (!U) throw new Error('--udid required (scripts/sim-lane.sh lease)');

const sock = execFileSync('xcrun', ['simctl', 'getenv', U, 'RWI_LISTEN_SOCKET']).toString().trim();
const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${sock}`, '-c', 'null:9221,:9232-9240'], { stdio: 'ignore' });
const stopProxy = () => { try { proxy.kill('SIGTERM'); } catch { /* gone */ } };
process.on('exit', stopProxy);

const INSTALL = `(() => { const W = window; if (W.__s_inst) return performance.now(); W.__s_inst = performance.now(); W.__s_steps = []; W.__s_gaps = []; W.__s_ready = 0;
  let last = ''; const read = () => { const r = document.querySelector('.ws-load'); if (!r) return null; return (r.getAttribute('data-step') || '') + ' | ' + (r.getAttribute('data-download') || '?') + '/' + (r.getAttribute('data-setup') || '?') + ' | ' + (r.querySelector('[data-el="slug"]')?.textContent ?? '') + ' | ' + (r.querySelector('[data-el="line"]')?.textContent ?? ''); };
  const on = () => { const s = read(); if (s && s !== last) { last = s; const t = Math.round(performance.now()); W.__s_steps.push([t, s]); if (!W.__s_ready && s.includes('| 100/100 |')) W.__s_ready = t; } };
  new MutationObserver(on).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true }); on();
  let prev = 0; const raf = (t) => { if (prev && t - prev > 50) W.__s_gaps.push([Math.round(prev), Math.round(t - prev)]); prev = t; requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  return W.__s_inst; })()`;
const STATE = `JSON.stringify({ ready: window.__s_ready || 0, shown: [...document.querySelectorAll('.ws-load')].some((e) => getComputedStyle(e).display !== 'none' && Number(getComputedStyle(e).opacity) > 0.05), href: location.href, n: (window.__s_steps || []).length, now: performance.now(), inst: window.__s_inst || 0 })`;

async function pageWs() {
  for (let i = 0; i < 60; i++) {
    try { const pages = await (await fetch('http://127.0.0.1:9232/json')).json(); const p = pages.find((x) => typeof x.url === 'string' && x.url.startsWith(BASE)); if (p) return p.webSocketDebuggerUrl; } catch { /* starting */ }
    await sleep(1000);
  }
  throw new Error('no Safari page in the Web Inspector list');
}

execFileSync('xcrun', ['simctl', 'openurl', U, `${BASE}/`]);
await sleep(3000);
const ws = new WebSocket(await pageWs());
let seq = 0; let target = null; const pending = new Map(); const events = [];
let onCommit = null;
const raw = (m) => ws.send(JSON.stringify(m));
const send = (method, params = {}) => { const id = ++seq; const p = new Promise((res, rej) => pending.set(id, { res, rej }));
  if (target) raw({ id: ++seq, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify({ id, method, params }) } }); else raw({ id, method, params }); return p; };
const inner = (m) => { if (m.method) { events.push(m); return; } const p = pending.get(m.id); if (p) { pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); } };
ws.addEventListener('message', (e) => { const m = JSON.parse(String(e.data));
  if (m.method === 'Target.targetCreated' && m.params.targetInfo.type === 'page') { target = m.params.targetInfo.targetId; return; }
  if (m.method === 'Target.didCommitProvisionalTarget') { target = m.params.newTargetId; onCommit?.(); return; }
  if (m.method === 'Target.dispatchMessageFromTarget') { inner(JSON.parse(m.params.message)); return; } inner(m); });
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
console.error('connected', target);
await sleep(1500);
const evaluate = async (expression) => { const r = await Promise.race([send('Runtime.evaluate', { expression, returnByValue: true }), sleep(5000).then(() => null)]); return r?.result?.value; };

const isTitle = `document.documentElement.classList.contains('title-first') && document.querySelectorAll('.ws-menu-card').length > 0`;
const waitTitle = async () => { for (let i = 0; i < 120; i++) { if (await evaluate(isTitle)) return true; await sleep(1000); } return false; };
// a fresh renderer-free title in this tab (a previous run may have left a shard running in it)
await evaluate(`location.replace('/')`); await sleep(3000);
if (!await waitTitle()) throw new Error('no title');
if (SHARD.startsWith('_')) { await evaluate(saveFixtureCode({ scope: 'device', key: 'devMode', data: true })); await evaluate(`location.replace('/')`); await sleep(3000); await waitTitle(); }
console.error('title ready');
await sleep(2000);
const idx = await evaluate(`(() => { const cards = [...document.querySelectorAll('.ws-menu-card')]; return cards.findIndex((c) => (c.querySelector('b')?.textContent ?? '').toLowerCase().includes(${JSON.stringify((NAMES[SHARD] ?? SHARD).toLowerCase())})); })()`);
if (typeof idx !== 'number' || idx < 0) throw new Error(`no card for ${SHARD}`);
await evaluate(`document.querySelector('.ws-menu-card[data-i="${idx}"]')?.click()`);
await sleep(600);
let committed = false; let instAt = 0;
// ScriptProfiler sampling. Through ios_webkit_debug_proxy every timestamp (samples, Timeline records) reads 0, so the
// samples are an untimed aggregate of the whole load: where Safari's JS time goes, not which freeze it belongs to.
const startRec = async () => { try { await send('ScriptProfiler.startTracking', { includeSamples: true }); } catch (e) { console.error('profiler', e.message); } };
onCommit = () => { committed = true; void startRec(); };
await startRec();
const tapAt = Date.now();
await evaluate(`document.querySelector('.ws-menu-play')?.click()`);
// the new document: poll until it answers with ?chunk and no recorder yet, then install the recorder
for (let i = 0; i < 400 && !instAt; i++) { const v = await evaluate(`location.search.includes('chunk=') ? ${INSTALL} : 0`); instAt = typeof v === 'number' ? v : 0; if (!instAt) await sleep(50); }
const trackingAt = instAt;
console.error('installed', instAt, 'swap', committed);
let state = null; const t0 = Date.now();
while (Date.now() - t0 < TIMEOUT) { const s = await evaluate(STATE); if (s) { state = JSON.parse(s); if (state.ready && !state.shown) break; } if (Date.now() % 10 < 1) console.error('state', JSON.stringify(state)); await sleep(500); }
console.error('loaded', JSON.stringify(state));
await sleep(2500);
const rec = JSON.parse((await evaluate(`JSON.stringify({ steps: window.__s_steps, gaps: window.__s_gaps, ready: window.__s_ready, inst: window.__s_inst, now: performance.now(), href: location.href, ua: navigator.userAgent, programs: window.__wildshard?.world?.game?.renderer?.info?.programs?.length ?? null })`)) ?? '{}');
let profile = null;
try {
  await send('ScriptProfiler.stopTracking');
  for (let i = 0; i < 60 && !profile; i++) { profile = events.find((e) => e.method === 'ScriptProfiler.trackingComplete')?.params ?? null; if (!profile) await sleep(500); }
} catch (e) { console.error('profiler stop', e.message); }
const startEv = events.filter((e) => /recordingStarted|trackingStart/.test(e.method)).map((e) => ({ m: e.method, p: e.params }));
const playAt = state?.ready ? Math.round(state.now) : null;
writeFileSync(resolve(OUT, `${SHARD}-${RUN}.sim.json`), JSON.stringify({ shard: SHARD, run: RUN, tapAt, committed, instAt: trackingAt, playAt, state, ...rec, trackingStart: startEv, profile }, null, 0));
const gaps = (rec.gaps ?? []).filter((g) => g[0] < (rec.ready ?? Infinity) + 1500);
console.log(`${SHARD} ${RUN}: ready=${rec.ready} play~${playAt} inst=${Math.round(trackingAt)} gaps>50=${gaps.length} max=${Math.max(0, ...gaps.map((g) => g[1]))} sum=${gaps.reduce((s, g) => s + g[1], 0)} samples=${profile?.samples?.stackTraces?.length ?? 0}`);
ws.close(); stopProxy();
process.exit(0);
