// One real Simulator Safari pair, invoked by safari-matched through sim-lane. One Inspector, always closed.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { soakInspector } from '../soak/inspector.mjs';
import { installSafariFixture } from './safari-fixture.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const udid = process.env.SIM_UDID, shard = arg('shard'), out = arg('out'), timeout = Number(arg('timeout') ?? 180) * 1000;
if (!udid || !shard || !out) throw new Error('Requires SIM_UDID (sim-lane), --shard and --out');
const names = { 'driftwood-isle': 'Driftwood Isle', 'nalati-grasslands': 'Nalati', 'pine-hollow': 'Pine Hollow', _template: 'Template shard', 'far-reach': 'Sky Reach', 'sunscar-dunes': 'Signal Dunes', 'nine-dragon-stack': 'Nine Dragon' };
if (!Object.hasOwn(names, shard)) throw new Error('Unknown benchmark shard');
const arms = ['before', 'after'].map(name => ({ name, base: arg(name), pin: arg(`${name}-pin`), dist: arg(`${name}-dist`) }));
if (arg('order') === 'after') arms.reverse();
for (const arm of arms) {
  if (!arm.base || !arm.dist || !/^[a-f0-9]{40}$/u.test(arm.pin ?? '')) throw new Error('Both arms require base, pin, dist');
  const http = await (await fetch(new URL('/version.json', arm.base))).json();
  const disk = JSON.parse(execFileSync('cat', [resolvePath(arm.dist, 'version.json')], { encoding: 'utf8' }));
  if (!http.build?.startsWith(arm.pin.slice(0, 7)) || http.build !== disk.build) throw new Error('HTTP/disk preview pin mismatch');
}
mkdirSync(out, { recursive: true });
const socket = execFileSync('xcrun', ['simctl', 'getenv', udid, 'RWI_LISTEN_SOCKET'], { encoding: 'utf8' }).trim();
const proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', 'null:9221,:9232-9240'], { stdio: ['ignore', 'ignore', 'pipe'] });
const proxyErrors = []; proxy.stderr.on('data', value => { if (proxyErrors.length < 100) proxyErrors.push(String(value)); });
let inspector = null;
function closeInspector() { if (inspector) { inspector.close(); inspector = null; } }
async function connect(base) {
  if (inspector) { inspector.close(); inspector = null; }
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const pages = await (await fetch('http://127.0.0.1:9232/json')).json(), page = pages.find(row => row.url?.startsWith(base));
      if (page) { inspector = soakInspector(page.webSocketDebuggerUrl); await inspector.opened; await inspector.evaluate('performance.now()'); return; }
    } catch { if (inspector) { inspector.close(); inspector = null; } }
    await sleep(300);
  }
  throw new Error('Safari Inspector page did not become ready');
}
async function gesture(expression) {
  const result = await inspector.send('Runtime.evaluate', { expression, returnByValue: true, emulateUserGesture: true });
  if (result.wasThrown) throw new Error(result.result?.description ?? 'Safari control action threw');
}
async function wait(expression, base) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const value = await inspector.evaluate(expression); if (value) return value; }
    catch { await connect(base); }
    await sleep(100);
  }
  throw new Error(`Safari loading timeout: ${expression.slice(0, 100)}`);
}
try {
for (const arm of arms) {
  const fixture = installSafariFixture(arm.dist); fixture.start(shard === '_template');
  try {
  for (const cache of ['cold', 'warm']) {
    const result = { pin: arm.pin, shard, cache, status: 'failed', capturedAt: new Date().toISOString(), fixture: { originalSHA256: fixture.originalSHA256, injectedSHA256: fixture.injectedSHA256 }, protocolErrors: [], timeline: [], profiles: [], console: [] };
    const file = resolvePath(out, `${arm.name}-${shard}-${cache}.json`);
    try {
      if (cache === 'cold') {
        execFileSync('xcrun', ['simctl', 'openurl', udid, new URL('/sf67-start.html', arm.base).href]);
        await connect(arm.base);
      } else {
        // Reuse this exact tab/cache context; opening another tab could attach to the old playing page.
        try { await inspector.evaluate(`location.replace('/')`); } catch { /* process swap; wait reconnects below */ }
      }
      await wait(`document.querySelector('.ws-main-select') !== null`, arm.base);
      await gesture(`document.querySelector('.ws-main-select').click()`);
      await wait(`document.querySelectorAll('.ws-menu-card').length > 0`, arm.base);
      await sleep(1500);
      const index = await inspector.evaluate(`(() => { const cards = [...document.querySelectorAll('.ws-menu-card')]; return cards.findIndex(card => (card.querySelector('b')?.textContent ?? '').toLowerCase().includes(${JSON.stringify(names[shard].toLowerCase())})); })()`);
      if (typeof index !== 'number' || index < 0) throw new Error('Selected shard card absent');
      await gesture(`document.querySelector('.ws-menu-dots i[data-i="${index}"]').click()`);
      await sleep(600);
      await wait(`document.querySelector('.ws-menu-card.selected')?.dataset.i === '${index}'`, arm.base);
      const offTimeline = inspector.on('Timeline.eventRecorded', row => result.timeline.push(row));
      const offProfile = inspector.on('ScriptProfiler.trackingComplete', row => result.profiles.push(row));
      const offConsole = inspector.on('Console.messageAdded', row => result.console.push(row));
      for (const { method, params } of [{ method: 'Console.enable', params: {} }, { method: 'Timeline.enable', params: {} }, { method: 'Timeline.setAutoCaptureEnabled', params: { enabled: true } }, { method: 'Timeline.start', params: { maxCallStackDepth: 12 } }, { method: 'ScriptProfiler.startTracking', params: { includeSamples: true } }]) {
        try { await inspector.send(method, params); } catch (error) { result.protocolErrors.push(`${method}: ${String(error)}`); }
      }
      await gesture(`(() => { sessionStorage.setItem('sf67.tap', String(performance.timeOrigin + performance.now())); const compiled = document.querySelector('.ws-menu-shardfile'); const button = compiled && getComputedStyle(compiled).display !== 'none' && !compiled.disabled ? compiled : document.querySelector('.ws-menu-play'); button.click(); })()`);
      await wait(`location.search.includes('chunk=${shard}') && window.__sf67?.play > 0`, arm.base);
      const raw = await inspector.evaluate(`JSON.stringify({ data: window.__sf67, tapEpoch: Number(sessionStorage.getItem('sf67.tap')), ua: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, sw: !!navigator.serviceWorker?.controller, resources: performance.getEntriesByType('resource').map(row => ({ url: row.name, at: row.startTime, duration: row.duration, transferred: row.transferSize, encoded: row.encodedBodySize })) })`);
      Object.assign(result, JSON.parse(raw));
      if (!(result.data.origin >= result.tapEpoch) || !result.data.url.includes(`chunk=${shard}`)) throw new Error('Stale document after shard selection');
      result.status = 'ok';
      for (const method of ['ScriptProfiler.stopTracking', 'Timeline.stop']) try { await inspector.send(method); } catch (error) { result.protocolErrors.push(`${method}: ${String(error)}`); }
      await sleep(100);
      offTimeline(); offProfile(); offConsole();
      console.log(`${arm.name} ${shard} ${cache}: ${(result.data.origin + result.data.play - result.tapEpoch).toFixed(1)}ms`);
    } catch (error) {
      result.failure = String(error); console.error(result.failure);
      try { result.partial = JSON.parse(await inspector.evaluate(`JSON.stringify({ data: window.__sf67, href: location.href, diagnostics: document.querySelector('.ws-load')?.textContent ?? '' })`)); } catch { /* retain the original failure if its document is gone */ }
    }
    finally { writeFileSync(file, JSON.stringify(result)); }
    if (result.status !== 'ok') break; // preserve failed cold; do not call its retry warm
  }
  } finally {
    try { await inspector.evaluate(`location.replace('about:blank')`); } catch { /* unload or a lost document */ }
    closeInspector();
    try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* already closed */ }
    fixture.close();
  }
}
} finally {
  closeInspector();
  proxy.kill('SIGTERM');
  try { execFileSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari'], { stdio: 'ignore' }); } catch { /* already closed */ }
  writeFileSync(resolvePath(out, `${shard}-proxy.log`), proxyErrors.join(''));
}
