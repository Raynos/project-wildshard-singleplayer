#!/usr/bin/env node
// e322-beaver-pool-capture.mjs — E322 F-L6's evidence: Pine Hollow's beaver pool behind the dam, full and drained, in the
// real build, iPhone 16 Pro portrait (touch, phone tier, muted, Metal). One page: the two bank views with the pool full,
// then the two logs heaved off the sluice through the quest's own flags (so the latching door raises open:dam-sluice),
// frames mid-drain and drained, a wade probe at both levels, a reload that must come back drained, and walks across the
// bowl and down its channel at both levels.
//   scripts/browser-lane.sh --max 20 node scripts/e322-beaver-pool-capture.mjs --url=http://127.0.0.1:4400 --out=<dir>
// Writes <out>/<view>-{full,mid,drained,reload}.png and prints the probes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = resolvePath(flag('out', 'progress/e322-beaver-pool'));
mkdirSync(OUT, { recursive: true });
// standing on the banks (feet on the ground, the player's own eye): upstream looking down the pool to the dam, and by the
// dam's west end looking back up the pool to the riffle and the pond
const VIEWS = { upstream: { x: -121.6, z: 72.2, yaw: 1.107, pitch: -0.2 }, dam: { x: -131.4, z: 61.3, yaw: -2.932, pitch: -0.22 } };
// wade probes: the channel mid-pool, and the mud flat 3.5 m off it
const PROBES = [{ name: 'channel', x: -133.4, z: 70.9 }, { name: 'flat', x: -130.5, z: 68.9 }];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const url = `${URL_BASE}/?chunk=pine-hollow&touch=1&tier=phone&mute=1&nolock=1&skipintro=1&sw=0&tod=day&clock=1e6&x=-121.6&z=72.2`;
const ready = async (page) => {
  await page.waitForFunction(() => Boolean(window.__world?.player && window.__pineQuest) && window.__world?.hud?.entered === true, undefined, { timeout: 300000, polling: 1000 });
  await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="banner"],[class*="toast"],[class*="prompt"]{display:none!important}' });
  await page.waitForTimeout(2500);
};
const shoot = async (page, tag) => {
  for (const [name, view] of Object.entries(VIEWS)) {
    await page.evaluate((v) => {
      const p = window.__world.player;
      p.spawn(v.x, v.z, v.yaw); p.pitch = v.pitch; p.velocity.set(0, 0, 0);
    }, view);
    await page.waitForTimeout(1500);
    writeFileSync(`${OUT}/${name}-${tag}.png`, await page.screenshot({ type: 'png' }));
  }
};
const probe = (page, label) => page.evaluate(async ({ probes, tag }) => {
  const w = window.__world, p = w.player, out = { tag, sluice: window.__pineQuest.flags.has('open:dam-sluice') };
  for (const q of probes) {
    p.spawn(q.x, q.z, 0); p.velocity.set(0, 0, 0);
    await new Promise((resolve) => { setTimeout(resolve, 1200); });
    const ws = p.waterSurfaceAt(q.x, q.z), r = (v) => Math.round(v * 100) / 100;
    out[q.name] = { surface: ws === null ? null : r(ws), feet: r(p.position.y), depth: r(p.depth ?? 0), wading: p.wading, swimming: p.swimming, onGround: p.onGround };
  }
  return out;
}, { probes: PROBES, tag: label });

// walks across the bowl bank to bank and down the channel riffle to sluice (the in-page autopilot holds W toward each
// waypoint, as physics-baseline.mjs does): a leg that makes < 0.3 m of progress in 2 s is stuck
const LEGS = [
  { name: 'across', from: { x: -124.73, z: 67.68 }, to: [{ x: -132.22, z: 72.67 }, { x: -139.71, z: 77.66 }] },
  { name: 'channel', from: { x: -126.4, z: 80.8 }, to: [{ x: -131.0, z: 74.0 }, { x: -136.1, z: 66.85 }] },
];
const walk = (page, label) => page.evaluate(async ({ legs, tag }) => {
  const w = window.__world, p = w.player, out = { tag };
  for (const leg of legs) {
    p.spawn(leg.from.x, leg.from.z, 0); p.velocity.set(0, 0, 0);
    await new Promise((resolve) => { setTimeout(resolve, 800); });
    out[leg.name] = await new Promise((resolve) => {
      const t0 = performance.now(), r = (v) => Math.round(v * 100) / 100;
      let wi = 0, best = { t: t0, d: Infinity }, minY = Infinity, swam = false, stuck = 0;
      const tick = () => {
        const wp = leg.to[wi], now = performance.now();
        if (!wp || now - t0 > 40000) { p.keys.clear(); resolve({ reached: wi, of: leg.to.length, stuck, minY: r(minY), swam, s: r((now - t0) / 1000) }); return; }
        const dx = wp.x - p.position.x, dz = wp.z - p.position.z, d = Math.hypot(dx, dz);
        minY = Math.min(minY, p.position.y); swam ||= p.swimming;
        if (d < 0.8) { wi++; best = { t: now, d: Infinity }; requestAnimationFrame(tick); return; }
        if (d < best.d - 0.3) best = { t: now, d };
        else if (now - best.t > 2000) { stuck++; wi++; best = { t: now, d: Infinity }; }
        p.yaw = Math.atan2(-dx, -dz); p.keys.add('KeyW');
        requestAnimationFrame(tick);
      };
      tick();
    });
  }
  return out;
}, { legs: LEGS, tag: label });

try {
  const { defaultBrowserType: _b, ...iphone } = devices['iPhone 16 Pro'];
  const ctx = await browser.newContext(iphone);
  // a fresh quest: the sluice shut
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('e322-pool')) { sessionStorage.setItem('e322-pool', '1'); localStorage.removeItem('ws.flags.v1'); } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 200)); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await shoot(page, 'full');
  console.log(JSON.stringify(await probe(page, 'full')));
  console.log(JSON.stringify(await walk(page, 'full')));
  // heave both logs: the kit latches the sluice open and raises open:dam-sluice, the pool starts draining
  await page.evaluate(() => { const f = window.__pineQuest.flags; f.set('talked:ranger'); f.set('lever:dam-log-a'); f.set('lever:dam-log-b'); });
  await page.waitForFunction(() => window.__pineQuest.flags.has('open:dam-sluice'), undefined, { timeout: 10000 });
  await page.evaluate((v) => { const p = window.__world.player; p.spawn(v.x, v.z, v.yaw); p.pitch = v.pitch; }, VIEWS.upstream);
  await page.waitForTimeout(3000);
  writeFileSync(`${OUT}/upstream-mid.png`, await page.screenshot({ type: 'png' }));
  await page.waitForTimeout(7000);
  await shoot(page, 'drained');
  console.log(JSON.stringify(await probe(page, 'drained')));
  // a reload with the flag saved comes back drained
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await shoot(page, 'reload');
  console.log(JSON.stringify(await probe(page, 'reload')));
  console.log(JSON.stringify(await walk(page, 'drained')));
  await ctx.close();
} finally {
  await browser.close();
}
