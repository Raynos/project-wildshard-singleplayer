#!/usr/bin/env node
// nalati-walk.mjs — the Nalati walk-around check (port-v2.md rule 4: validate by MOVING, never one matching screenshot).
//
// One page load, first person at the phone tier (390×844 @1.5, HUD hidden), and ~30 frames that each look for what a
// single screenshot hides — cutouts that turn with you, seams, popping, a sky that breaks looking up or down:
//   orbit    12 frames round the camp (95, 205) at r 25 m, the player on the circle facing the centre
//   path      6 frames walking the camp spur track (CAMP_SPUR) from the N road to the camp, looking along it
//   up        4 frames at pitch +1.2 while turning (N, E, S, W) — the zenith blend, the u = 0 / 1 wrap at north
//   down      2 frames at pitch −1.2 — the grass at your feet
//   eagle     4 frames on Eagle Rock (170, −20) looking N, E, S, W — the slab edge, the range, the valley
//   plateau   2 frames on the Sky Grassland (0, −120) looking S and W
// Writes progress/nalati-look/walk/<tag>-strip.jpg (a labelled grid, ≤ 500 KB) and <tag>-walk.json (calls / tris each).
//
//   node scripts/nalati-walk.mjs --tag=v2-step1 --look=v2 --url=http://127.0.0.1:5191
//   node scripts/nalati-walk.mjs --tag=v1 --only=orbit,up
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const OUT = resolvePath(ROOT, 'progress/nalati-look/walk');
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5188');
const TAG = flag('tag', 'latest');
const LOOK = flag('look', '');
const EXTRA = flag('query', '');
const SETTLE = Number(flag('settle', '2.5')) * 1000;
const only = flag('only', '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

// the frames: [group, label, x, z, yaw, pitch] (yaw 0 faces −z = south, +π/2 faces east — Player.yaw)
const face = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
const frames = [];
const C = { x: 95, z: 205 };
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2, x = C.x + Math.cos(a) * 25, z = C.z + Math.sin(a) * 25;
  frames.push(['orbit', `orbit ${i * 30}°`, x, z, face(x, z, C.x, C.z), -0.08]);
}
const SPUR = [[0, 196], [40, 202], [81, 205]];
for (let i = 0; i < 6; i++) {
  const t = i / 5 * 2, k = Math.min(1, Math.floor(t)), f = t - k;
  const a = SPUR[k], b = SPUR[k + 1];
  const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
  frames.push(['path', `path ${i}`, x, z, face(a[0], a[1], b[0], b[1]), -0.12]);
}
const COMPASS = [['N', Math.PI], ['E', Math.PI / 2], ['S', 0], ['W', -Math.PI / 2]];
for (const [n, y] of COMPASS) frames.push(['up', `up ${n}`, 68, 204.3, y, 1.2]);
frames.push(['down', 'down S', 68, 204.3, 0, -1.2], ['down', 'down W', 68, 204.3, -Math.PI / 2, -1.2]);
for (const [n, y] of COMPASS) frames.push(['eagle', `eagle ${n}`, 170, -20, y, -0.15]);
frames.push(['plateau', 'plateau S', 0, -120, 0, 0.0], ['plateau', 'plateau W', 0, -120, -Math.PI / 2, 0.0]);
const list = frames.filter((f) => only.length === 0 || only.includes(f[0]));

const query = ['chunk=nalati-grasslands', 'nolock=1', 'skipintro=1', 'weather=clear', 'clock=0', 'perf=0', 'tier=phone', 'x=68', 'z=204.3', 'yaw=-0.95', LOOK ? `look=${LOOK}` : '', EXTRA].filter(Boolean).join('&');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world && window.__weather), undefined, { timeout: 240000, polling: 1000 });
  await page.evaluate(() => { window.__weather.clock.paused = true; });
  await page.addStyleTag({ content: '#hud,#hud *{display:none!important}' });
  await new Promise((resolve) => { setTimeout(resolve, 12000); });
  for (const [group, label, x, z, yaw, pitch] of list) {
    const y = group === 'eagle' ? 50.2 : -1; // Eagle Rock: stand on its summit terrace (EAGLE_ROCK.top)
    await page.evaluate((a) => {
      const w = window.__world; w.player.spawn(a.x, a.z, a.yaw); w.player.pitch = a.pitch;
      if (a.y > 0) { w.player.position.y = a.y; if (w.player.velocity) w.player.velocity.set(0, 0, 0); }
    }, { x, z, yaw, pitch, y });
    await new Promise((resolve) => { setTimeout(resolve, SETTLE); });
    const perf = await page.evaluate(() => { const g = window.__world.game; return { calls: g.lastFrame.calls, tris: g.lastFrame.triangles }; });
    const shot = await page.screenshot({ type: 'jpeg', quality: 80, scale: 'css' });
    rows.push({ group, label, ...perf, img: `data:image/jpeg;base64,${shot.toString('base64')}` });
    console.log(`${label.padEnd(12)} ${String(perf.calls).padStart(4)} calls · ${(perf.tris / 1e6).toFixed(2)} M tris`);
  }
  if (errors.length > 0) console.error(`page errors: ${[...new Set(errors)].join(' | ')}`);
  await ctx.close();

  // the strip: a labelled grid, 7 across
  const sheet = await (await browser.newContext({ viewport: { width: 7 * 196, height: 400 } })).newPage();
  const html = `<body style="margin:0;background:#111;font:11px ui-monospace,monospace;color:#9fe">
    <div style="display:grid;grid-template-columns:repeat(7,196px)">${rows.map((r) => `<figure style="margin:0;position:relative">
    <img src="${r.img}" style="width:196px;display:block"><figcaption style="position:absolute;left:3px;top:3px;background:#000a;padding:1px 4px">${r.label} · ${r.calls}c</figcaption></figure>`).join('')}</div>
    <div style="padding:4px">${TAG}${LOOK ? ` · look=${LOOK}` : ''} · walk-around (orbit / path / up / down / Eagle Rock / plateau)</div></body>`;
  await sheet.setContent(html);
  await sheet.waitForTimeout(300);
  const buf = await sheet.screenshot({ type: 'jpeg', quality: 72, fullPage: true });
  writeFileSync(resolvePath(OUT, `${TAG}-strip.jpg`), buf);
  writeFileSync(resolvePath(OUT, `${TAG}-walk.json`), JSON.stringify(rows.map(({ img: _i, ...r }) => r), null, 1));
  console.log(`wrote progress/nalati-look/walk/${TAG}-strip.jpg (${(buf.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
}
