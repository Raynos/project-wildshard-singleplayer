#!/usr/bin/env node
// e350-hale-capture.mjs — E350 F-X3: Ranger Hale as the iPhone draws him (390×844 CSS at 3×, touch, tier=phone, midday,
// clear), on one build: his point (talking, the quest's point held — the E322 board's row-1 framing, off his right
// shoulder) and standing (front, and his right side). Run it on a before and an after build and compare.
//   <label>-point.jpg  <label>-point-crop.jpg  <label>-stand-front.jpg  <label>-stand-side.jpg
//
//   node scripts/e350-hale-capture.mjs --url=http://127.0.0.1:<port> --label=before|after [--out=<dir>]
// Run it inside scripts/browser-lane.sh. One headless Chromium on Metal (--mute-audio, mute=1), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const LABEL = flag('label', 'after');
const OUT = resolvePath(flag('out', 'progress/e350-hale'));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** the player's eye at `eye` looking at `at` */
async function lookFrom(page, eye, at) {
  await page.evaluate(([e, a]) => {
    const p = window.__world.player;
    p.position.set(e.x, e.y ?? p.position.y, e.z);
    p.velocity?.set(0, 0, 0);
    p.yaw = Math.atan2(-(a.x - e.x), -(a.z - e.z));
  }, [eye, at]);
  await sleep(700);
  await page.evaluate((a) => {
    const p = window.__world.player, cam = window.__world.game.camera;
    const c = cam.getWorldPosition(cam.position.clone());
    const dx = a.x - c.x, dz = a.z - c.z;
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2(a.y - c.y, Math.hypot(dx, dz));
    p.velocity?.set(0, 0, 0);
  }, at);
  await sleep(300);
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(`${URL_BASE}/?chunk=pine-hollow&touch=1&tier=phone&skipintro=1&nolock=1&mute=1&time=13&clock=0&weather=clear`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.player && window.__pineQuest?.people?.length === 3), undefined, { timeout: 300000, polling: 1000 });
  await page.waitForFunction(() => window.__pineQuest.people.every((q) => q.fig.group.children.some((c) => c.isSkinnedMesh)), undefined, { timeout: 120000, polling: 500 });
  await sleep(4000);
  const build = await page.evaluate(async () => { try { return (await (await fetch('/version.json')).json()).build; } catch { return null; } });
  await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,.ws-touch *,[class*="elite"],[class*="banner"],[class*="quest"],[class*="toast"],[class*="crosshair"],[class*="reticle"],[class*="boss"],[class*="dialog"],[class*="prompt"]{visibility:hidden!important}' });
  await page.evaluate(() => { for (const c of window.__world.game.camera.children) c.traverse((o) => { o.layers.disableAll(); }); });
  const h = await page.evaluate(() => { const g = window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.group; return { x: g.position.x, y: g.position.y, z: g.position.z, yaw: g.rotation.y }; });
  const mesh = await page.evaluate(() => { const m = window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.group.children.find((c) => c.isSkinnedMesh); return { verts: m.geometry.getAttribute('position').count, tris: (m.geometry.getIndex()?.count ?? 0) / 3 }; });
  const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), rx = -Math.cos(h.yaw), rz = Math.sin(h.yaw);
  // standing, before anyone talks: front and his right side
  await lookFrom(page, { x: h.x + fx * 3.2, y: h.y + 0.2, z: h.z + fz * 3.2 }, { x: h.x, y: h.y + 1.0, z: h.z });
  await sleep(500);
  writeFileSync(resolvePath(OUT, `${LABEL}-stand-front.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
  await lookFrom(page, { x: h.x + rx * 3.2, y: h.y + 0.2, z: h.z + rz * 3.2 }, { x: h.x, y: h.y + 1.0, z: h.z });
  await sleep(500);
  writeFileSync(resolvePath(OUT, `${LABEL}-stand-side.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
  // the point (the E322 board's row 1): talking, the quest's point from 5.5 s to 8 s of every 9 s, shot at ≈ 7 s
  await lookFrom(page, { x: h.x + fx * 1.7 + rx * 0.9, y: h.y + 0.2, z: h.z + fz * 1.7 + rz * 0.9 }, { x: h.x, y: h.y + 1.45, z: h.z });
  await page.evaluate(() => { window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.talking = true; });
  await sleep(5600);
  const sh = await page.evaluate(() => {
    const m = window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.group.children.find((c) => c.isSkinnedMesh);
    const b = m.skeleton.bones.find((x) => x.name === 'shoulderR'), w = b.getWorldPosition(b.position.clone());
    return { x: w.x, y: w.y, z: w.z };
  });
  await lookFrom(page, { x: h.x + fx * 1.7 + rx * 0.9, y: h.y + 0.2, z: h.z + fz * 1.7 + rz * 0.9 }, { x: sh.x, y: sh.y - 0.05, z: sh.z });
  writeFileSync(resolvePath(OUT, `${LABEL}-point.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
  // and from his right side, a step back: the sheet hung under the arm there
  await lookFrom(page, { x: h.x + rx * 2.6 + fx * 0.6, y: h.y + 0.2, z: h.z + rz * 2.6 + fz * 0.6 }, { x: sh.x, y: sh.y - 0.35, z: sh.z });
  writeFileSync(resolvePath(OUT, `${LABEL}-point-side.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
  console.log(JSON.stringify({ label: LABEL, build, mesh, errors: errors.slice(0, 3) }));
  await ctx.close();
} finally {
  await browser.close();
}
