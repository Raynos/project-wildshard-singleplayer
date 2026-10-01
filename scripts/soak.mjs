#!/usr/bin/env node
// E357 nightly wanderer. Caller holds browser-lane.sh; always closes Chromium.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { debugSettings } from './debug-settings.mjs';
import { soakVerdict } from './gpu-perf/report.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const root = resolve(new URL('..', import.meta.url).pathname);
const shard = flag('shard', '');
const minutes = Number(flag('minutes', '20'));
const out = resolve(flag('out', join(root, 'progress/soak', `${shard}-${Date.now()}`)));
if (!/^[a-z0-9-]+$/.test(shard) || !Number.isFinite(minutes) || minutes < 20) throw new Error('--shard and --minutes >= 20 required for the growth window');
mkdirSync(out, { recursive: true });
const errors = [], stuck = [], samples = [];
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--mute-audio'] });
const control = { stop: false, wandering: false };
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { control.stop = true; void browser.close(); });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  // Reuse F2's seeded harness and GL-API allocation instrumentation, never renderer.info as a byte proxy.
  const { installInit } = await import('./parity/init.mjs');
  const version = await (await fetch(new URL('version.json', flag('url', '')))).json();
  await installInit(context, { lane: 'm5', sha: version.sha ?? version.commit ?? '', browser: browser.version(), capture: null });
  await debugSettings(page, shard === 'pine-hollow' ? { weather: args.includes('--weather') ? 'rain' : 'clear' } : {});
  const url = new URL(flag('url', ''));
  url.search = new URLSearchParams({ chunk: shard, tier: 'phone', touch: '1', skipintro: '1', nolock: '1', mute: '1', sw: '0', ...(args.includes('--weather') && shard === 'nalati-grasslands' ? { weather: 'storm' } : {}) }).toString();
  await page.goto(url.href);
  await page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  const metal = await page.evaluate(() => { const gl = window.__wildshard.world.game.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; });
  if (!/Metal/i.test(metal)) throw new Error(`renderer is not Metal: ${metal}`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const routes = JSON.parse(readFileSync(join(root, 'scripts/physics-route.json'), 'utf8'))[shard];
  let seed = 0x2545f491;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const position = () => page.evaluate(() => { const p = window.__wildshard.world.player.position; return { x: p.x, y: p.y, z: p.z }; });
  const start = Date.now();
  const wander = async () => {
    while (!control.stop) {
      const current = await position();
      const leg = await page.evaluate(({ origin, index, routeList }) => {
        const probe = window.__wildshard;
        if (!probe.nav) return routeList?.[index % routeList.length] ?? null;
        const target = probe.nav.randomPoint(origin, 30, 80);
        const path = target ? probe.nav.path(origin, target) : null;
        return path?.length ? { name: 'soak-nav', start: { ...origin, yaw: probe.world.player.yaw }, waypoints: path, timeout: 120 } : null;
      }, { origin: current, index: Math.floor(random() * 10000), routeList: routes });
      if (!leg) throw new Error(`no reachable navmesh target or route for ${shard}`);
      leg.stuckSeconds = 5;
      control.wandering = true;
      try {
        const result = await page.evaluate((route) => window.__wildshard.walkLeg(route), leg);
        for (const point of result.stuck) { stuck.push({ seconds: (Date.now() - start) / 1000, pos: point, source: 'autopilot' }); await page.screenshot({ path: join(out, `stuck-${stuck.length}.jpg`), type: 'jpeg', quality: 75 }); }
      } finally { control.wandering = false; }
    }
  };
  let lastPos = await position(), progressAt = Date.now(), nextSample = 0, nextAttack = 60, nextPause = 300;
  let lastFrame = await page.evaluate(() => window.__wildshard.world.game.renderer.info.render.frame), frameAt = Date.now();
  const walkTask = (async () => { try { await wander(); } catch (error) { errors.push(String(error)); control.stop = true; } })();
  while (!control.stop && Date.now() - start <= minutes * 60_000 + 1000) {
    const seconds = (Date.now() - start) / 1000;
    if (seconds >= nextSample) {
      await cdp.send('HeapProfiler.collectGarbage');
      const metrics = await cdp.send('Performance.getMetrics');
      const heapBytes = metrics.metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value;
      if (heapBytes === undefined) throw new Error('missing forced-GC heap measurement');
      const snapshot = await page.evaluate(() => { const p = window.__wildshard, f = p.fingerprint(), r = p.world.game.renderer; let objects = 0; p.world.game.scene.traverse(() => { objects++; }); return { gpuBytes: f.gpuBytes.total, ...r.info.memory, objects, frame: r.info.render.frame }; });
      const now = Date.now(), fps = (snapshot.frame - lastFrame) / ((now - frameAt) / 1000);
      lastFrame = snapshot.frame; frameAt = now;
      // Nominal sample slots make the minute-5/20 endpoints deterministic; wall time is retained too.
      samples.push({ seconds: nextSample, wallSeconds: seconds, heapBytes, ...snapshot, fps }); nextSample += 30;
      writeFileSync(join(out, 'samples.json'), JSON.stringify(samples, null, 2));
    }
    if (seconds >= nextAttack) {
      await page.evaluate(() => {
        const p = window.__wildshard, state = p.state(), near = state.player.pos;
        const creatures = state.creatures.filter((c) => c.hp > 0 && Math.hypot(c.pos.x - near.x, c.pos.y - near.y, c.pos.z - near.z) <= 15).toSorted((a, b) => Math.hypot(a.pos.x - near.x, a.pos.z - near.z) - Math.hypot(b.pos.x - near.x, b.pos.z - near.z));
        const dummies = p.world.arena.isActive ? p.world.arena.targets.filter((dummy) => Math.hypot(dummy.position.x - near.x, dummy.position.z - near.z) <= 15).toSorted((a, b) => a.position.distanceToSquared(p.world.player.position) - b.position.distanceToSquared(p.world.player.position)) : [];
        const target = creatures[0] ?? (dummies[0] ? { pos: dummies[0].position } : null); if (!target) return;
        const player = p.world.player; player.yaw = Math.atan2(-(target.pos.x - near.x), -(target.pos.z - near.z));
        const disc = document.querySelector('.ws-touch-attack'); if (!disc) throw new Error('missing attack disc');
        for (const type of ['pointerdown', 'pointerup']) disc.dispatchEvent(new PointerEvent(type, { pointerId: 81, pointerType: 'touch', isPrimary: true, bubbles: true }));
      }); nextAttack += 60;
    }
    if (seconds >= nextPause) {
      await page.evaluate(() => document.dispatchEvent(new Event('ws:pause'))); await sleep(5000);
      if (await page.evaluate(() => window.__wildshard.state().appState) !== 'paused') throw new Error('pause did not enter paused state');
      await page.evaluate(() => document.dispatchEvent(new Event('ws:pause')));
      if (await page.evaluate(() => window.__wildshard.state().appState) === 'paused') throw new Error('resume stayed paused');
      progressAt = Date.now(); lastPos = await position(); nextPause += 300;
    }
    const nowPos = await position();
    if (Math.hypot(nowPos.x - lastPos.x, nowPos.y - lastPos.y, nowPos.z - lastPos.z) >= 0.3 || !control.wandering) { lastPos = nowPos; progressAt = Date.now(); }
    else if (Date.now() - progressAt >= 5000) {
      stuck.push({ seconds, pos: nowPos }); await page.screenshot({ path: join(out, `stuck-${stuck.length}.jpg`), type: 'jpeg', quality: 75 });
      await page.evaluate(() => { const p = window.__wildshard, player = p.world.player; const target = p.nav?.randomPoint(player.position, 30, 80); if (target) player.spawn(target.x, target.z, player.yaw, target.y); });
      progressAt = Date.now(); lastPos = await position();
    }
    await sleep(200);
  }
  control.stop = true;
  await Promise.race([walkTask, sleep(1000)]);
} catch (error) { errors.push(String(error)); }
finally { control.stop = true; await browser.close(); }
const report = { shard, minutes, samples, errors, stuck, ...soakVerdict(samples, errors, stuck) };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ shard, verdict: report.verdict, failures: report.failures }));
process.exitCode = report.verdict === 'success' ? 0 : 1;
