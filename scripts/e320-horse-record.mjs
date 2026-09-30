#!/usr/bin/env node
// e320-horse-record.mjs — E320: a real-resolution canvas recording (canvas.captureStream + MediaRecorder) of riding, iPhone
// portrait 390×844 at 3×, touch, phone tier, muted: the bow held (stand, walk, gallop), then the sabre (stand, gallop).
//
//   scripts/browser-lane.sh node scripts/e320-horse-record.mjs --url=http://127.0.0.1:4412 --out=<dir> --tag=before \
//     [--where=track|steppe] [--settings='{"<option>":"<value>"}']
//
// track = Explore ▸ Horse playground (the HORSE TRACK the user rode, E307: title → EXPLORE WORLD → the card → USE mounts);
// steppe = `?ride=gallop` on the north road (for a build older than the playground). Writes <tag>.webm, <tag>.mp4 (the phone
// encode) and one JPEG still per beat (<tag>-bow-stand.jpg …) into --out.
import { mkdirSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { bootToTitle, encodePhone, enterPlayground, flags, openHub, sleep, startRecording, stopRecording, tap, VITE_STUB } from './playground-harness.mjs';

const { chromium } = await import('playwright');
const flag = flags();
const BASE = flag('url', 'http://127.0.0.1:4412');
const OUT = resolvePath(flag('out', 'progress/e320-reins'));
const TAG = flag('tag', 'now');
const WHERE = flag('where', 'track');
const SETTINGS = JSON.parse(flag('settings', '{}'));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((picks) => {
    try { localStorage.setItem('ws.dev', '1'); const k = 'ws.settings.v1'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) ?? '{}'), ...picks })); } catch { /* defaults */ }
  }, SETTINGS);
  const page = await ctx.newPage();
  await page.route('**/@vite/client', (r) => r.fulfill({ contentType: 'application/javascript', body: VITE_STUB }));
  page.on('pageerror', (e) => { console.log(`pageerror: ${e.message.slice(0, 200)}`); });
  if (WHERE === 'track') {
    console.log(`title in ${await bootToTitle(page, BASE, 'nalati-grasslands')} s`);
    await openHub(page);
    await enterPlayground(page, 'horse');
    await sleep(2000);
    await tap(page, '.ws-touch-use');
    await page.waitForFunction(() => window.__world.ride.mounted === true, undefined, { timeout: 10000, polling: 100 });
  } else {
    await page.goto(`${BASE}/?chunk=nalati-grasslands&ride=gallop&tier=phone&touch=1&mute=1&nolock=1&skipintro=1&sw=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__world?.ride?.mounted === true, undefined, { timeout: 480000, polling: 1000 });
  }
  await sleep(2500);
  const input = (x, y, g) => page.evaluate(({ sx, sy, sg }) => { const w = window.__world; w.player.touchMove.x = sx; w.player.touchMove.y = sy; w.ride.mount.touchGallop = sg; }, { sx: x, sy: y, sg: g });
  const weapon = (id) => page.evaluate((wid) => { window.__world.weapons.select(wid, true); }, id);
  const still = (name) => page.screenshot({ path: join(OUT, `${TAG}-${name}.jpg`), type: 'jpeg', quality: 80 });
  await weapon('bow');
  await sleep(800);
  await startRecording(page);
  await sleep(1500); await still('bow-stand'); await sleep(1000);
  await input(0, 0.3, false); await sleep(1500); await still('bow-walk'); await sleep(1000);
  await input(0, 1, true); await sleep(3000); await still('bow-gallop'); await sleep(1000);
  await input(0, -1, false); await sleep(1500); await input(0, 0, false);
  await weapon('sabre');
  await sleep(1500); await still('sabre-stand'); await sleep(500);
  await input(0, 1, true); await sleep(2500); await still('sabre-gallop'); await sleep(500);
  await input(0, -1, false); await sleep(1200); await input(0, 0, false);
  const size = await stopRecording(page, join(OUT, `${TAG}.webm`));
  const probe = encodePhone(join(OUT, `${TAG}.webm`), join(OUT, `${TAG}.mp4`));
  console.log(`recorded ${size.join('×')} → ${TAG}.mp4 ${JSON.stringify(probe.format)}`);
} finally {
  await browser.close();
}
