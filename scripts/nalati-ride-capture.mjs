#!/usr/bin/env node
// nalati-ride-capture.mjs — N17: frames of a mounted turn at a gallop (phone portrait, muted, headless), composed into one
// JPEG strip, plus the numbers per frame (horse heading, camera yaw, the view's offset off the heading).
//
//   node scripts/nalati-ride-capture.mjs --tag=before [--url=http://127.0.0.1:5188] [--out=progress/nalati-riding] [--desktop]
//
// Scenario: `?ride=gallop` (on the camp horse at the spawn, down the north road) → the free look first: cantering 3 s,
// a 70° glance left, frames every 0.6 s as it drifts back (<tag>-free-look.jpg) → GALLOP held + stick forward 3 s →
// stick up-right (x 0.8, y 0.6) for 3 s, a frame every 0.75 s from the turn's start → stick released 5 s (the coast to a stop).
// Then a standing pivot: stick hard left 2 s. Every page is muted (--mute-audio + &mute=1) and rendered on Metal.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const OUT = resolvePath(flag('out', 'progress/nalati-riding'));
const TAG = flag('tag', 'now');
const DESKTOP = argv.includes('--desktop');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext(DESKTOP ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?chunk=nalati-grasslands&ride=gallop&mute=1&nolock=1&skipintro=1${DESKTOP ? '' : '&touch=1&tier=phone'}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.ride?.mounted === true, undefined, { timeout: 300000, polling: 1000 });
  await sleep(4000);
  const input = (sx, sy, gallop) => page.evaluate(({ x, y, g }) => { const w = window.__world; w.player.touchMove.x = x; w.player.touchMove.y = y; w.ride.mount.touchGallop = g; }, { x: sx, y: sy, g: gallop });
  const state = () => page.evaluate(() => {
    const w = window.__world, m = w.ride.mount, h = m.horse;
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const heading = h === null ? 0 : h.yaw, look = w.player.yaw + Math.PI;
    const r1 = (v) => Math.round(v * 10) / 10;
    return { heading: r1(heading * 180 / Math.PI), off: r1(wrap(look - heading) * 180 / Math.PI), speed: r1(h?.speed ?? 0), gait: m.gait };
  });
  const frames = [], log = [];
  const shot = async (label) => {
    const s = await state();
    log.push({ label, ...s });
    frames.push({ label: `${label} · ${s.gait} ${s.speed} m/s · view ${s.off > 0 ? '+' : ''}${s.off}° off the horse`, b64: (await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64') });
  };
  // the free look: cantering straight, glance 70° left (a LOOK drag), then let go — the view drifts back behind the ears
  const look = [];
  const start = await page.evaluate(() => { const h = window.__world.ride.mount.horse; return { x: h.position.x, z: h.position.z, yaw: h.yaw }; });
  await input(0, 1, false);
  await sleep(3000);
  await page.evaluate(() => { window.__world.player.yaw += 1.22; });
  for (let i = 0; i < 5; i++) {
    const s = await state();
    log.push({ label: `free look +${(i * 0.6).toFixed(1)} s`, ...s });
    look.push({ label: `looked left, +${(i * 0.6).toFixed(1)} s · ${s.gait} ${s.speed} m/s · view ${s.off > 0 ? '+' : ''}${s.off}° off the horse`, b64: (await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64') });
    await sleep(600);
  }
  await input(0, 0, false);
  // back to the start (the free look's canter ends near the brook, and a horse wades at a walk)
  await page.evaluate((st) => { window.__world.ride.mount.teleport(st.x, st.z, st.yaw); }, start);
  await sleep(500);
  await input(0, 1, true);
  await sleep(3000);
  await shot('t 0.0 s: gallop, turn starts');
  await input(0.8, 0.6, true);
  for (let i = 1; i <= 4; i++) { await sleep(750); await shot(`t ${(i * 0.75).toFixed(2)} s into the turn`); }
  await input(0, 0, false);
  await sleep(2000);
  log.push({ label: 'released 2 s', ...(await state()) });
  await sleep(3000);
  log.push({ label: 'released 5 s', ...(await state()) });
  await input(-1, 0, false);
  await sleep(2000);
  await shot('standing, stick hard left 2 s');
  await input(0, 0, false);
  // compose: one row, each frame at half its device size, a caption bar under each
  const W = DESKTOP ? 640 : 390, H = DESKTOP ? 360 : 844;
  const strip = await ctx.newPage();
  await strip.setViewportSize({ width: 800, height: 600 });
  const compose = (list) => strip.evaluate(async ({ fs, w, h }) => {
    const cv = document.createElement('canvas'); cv.width = w * fs.length; cv.height = h + 44;
    const g = cv.getContext('2d'); g.fillStyle = '#0d1b26'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < fs.length; i++) {
      const im = new Image(); im.src = `data:image/jpeg;base64,${fs[i].b64}`; await im.decode();
      g.drawImage(im, i * w, 0, w - 4, h);
      g.fillStyle = '#8fe3ff'; g.font = '13px monospace';
      const words = fs[i].label.split(' · ');
      g.fillText(words[0], i * w + 6, h + 17); g.fillStyle = '#c9d3da'; g.fillText(words.slice(1).join(' · '), i * w + 6, h + 35);
    }
    return cv.toDataURL('image/jpeg', 0.72).slice('data:image/jpeg;base64,'.length);
  }, { fs: list, w: W, h: H });
  for (const [name, list] of [['gallop-turn', frames], ['free-look', look]]) {
    const file = resolvePath(OUT, `${TAG}-${name}${DESKTOP ? '-desktop' : ''}.jpg`);
    writeFileSync(file, Buffer.from(await compose(list), 'base64'));
    console.log(file);
  }
  for (const l of log) console.log(`${l.label.padEnd(34)} heading ${String(l.heading).padStart(7)}°  view off ${String(l.off).padStart(7)}°  ${l.gait} ${l.speed} m/s`);
  if (errors.length > 0) console.log(`page errors:\n  ${errors.slice(0, 5).join('\n  ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
