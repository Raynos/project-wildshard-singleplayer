#!/usr/bin/env node
// e322-npc-rig-capture.mjs — E322 F-M3: Pine Hollow's people on rig A (today) and rig B (legs, clavicle + twist, the walk),
// as the iPhone draws them (390×844 CSS at 3×, touch, tier=phone, midday, clear). Per variant (Debug ▸ Creatures & NPCs ▸
// NPC rig = pineNpcRig a / b):
//   <v>-point.jpg / <v>-point-crop.jpg   Hale talking, his point toward the old-growth held: a close-up on his right shoulder
//   <v>-walk-<kind>-<k>.jpg              each person sent 5 m out front of his post (NpcFigure.walkTo), shot from the side
//                                         mid-walk (k = 0 … 2, 0.3 s apart; A slides, B steps)
//
//   node scripts/e322-npc-rig-capture.mjs --url=http://127.0.0.1:4401 [--variants=a,b] [--out=<dir>]
//
// Run it inside scripts/browser-lane.sh. One headless Chromium on Metal (--mute-audio, mute=1), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const VARIANTS = flag('variants', 'a,b').split(',').filter(Boolean);
const KINDS = flag('kinds', 'ranger,miller,trader').split(',').filter(Boolean);
const OUT = resolvePath(flag('out', 'progress/e322-npc-rig'));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** put the player's eye at `eye` (x, z; y is where the floor puts it) looking at `at` */
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
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    await debugSettings(ctx, { pineNpcRig: v });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    await page.goto(`${URL_BASE}/?chunk=pine-hollow&touch=1&tier=phone&skipintro=1&nolock=1&mute=1&time=13&clock=0&weather=clear`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.player && window.__pineQuest?.people?.length === 3), undefined, { timeout: 300000, polling: 1000 });
    await page.waitForFunction(() => window.__pineQuest.people.every((q) => q.fig.group.children.some((c) => c.isSkinnedMesh)), undefined, { timeout: 120000, polling: 500 });
    await sleep(4000);
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,.ws-touch *,[class*="elite"],[class*="banner"],[class*="quest"],[class*="toast"],[class*="crosshair"],[class*="reticle"],[class*="boss"],[class*="dialog"],[class*="prompt"]{visibility:hidden!important}' });
    await page.evaluate(() => { for (const c of window.__world.game.camera.children) c.traverse((o) => { o.layers.disableAll(); }); });
    // every post and the way it faces, before anyone turns to the player
    const posts = await page.evaluate(() => Object.fromEntries(window.__pineQuest.people.map((q) => [q.kind, { x: q.fig.group.position.x, y: q.fig.group.position.y, z: q.fig.group.position.z, yaw: q.fig.group.rotation.y }])));
    const bones = await page.evaluate(() => window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.group.children.find((c) => c.isSkinnedMesh).skeleton.bones.map((b) => b.name));
    console.log(`${v}: bones ${bones.join(' ')}`);

    // ── Hale's point, on his right shoulder ──
    {
      const h = posts.ranger, fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), rx = -Math.cos(h.yaw), rz = Math.sin(h.yaw);
      await lookFrom(page, { x: h.x + fx * 1.7 + rx * 0.9, z: h.z + fz * 1.7 + rz * 0.9 }, { x: h.x, y: h.y + 1.45, z: h.z });
      await page.evaluate(() => { window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.talking = true; });
      await sleep(7000);
      const sh = await page.evaluate(() => {
        const g = window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.group;
        const m = g.children.find((c) => c.isSkinnedMesh);
        const b = m.skeleton.bones.find((x) => x.name === 'shoulderR');
        const w = b.getWorldPosition(b.position.clone());
        return { x: w.x, y: w.y, z: w.z };
      });
      await lookFrom(page, { x: h.x + fx * 1.7 + rx * 0.9, z: h.z + fz * 1.7 + rz * 0.9 }, { x: sh.x, y: sh.y - 0.05, z: sh.z });
      await sleep(900);
      const box = await page.evaluate((s) => {
        const cam = window.__world.game.camera; cam.updateMatrixWorld();
        const a = cam.position.clone().set(s.x, s.y, s.z).project(cam);
        return { x: (a.x + 1) / 2 * window.innerWidth, y: (1 - a.y) / 2 * window.innerHeight };
      }, sh);
      writeFileSync(resolvePath(OUT, `${v}-point.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
      const S = 300, cx = Math.max(S / 2, Math.min(390 - S / 2, box.x)), cy = Math.max(S / 2, Math.min(844 - S / 2, box.y));
      writeFileSync(resolvePath(OUT, `${v}-point-crop.jpg`), await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: cx - S / 2, y: cy - S / 2, width: S, height: S } }));
      await page.evaluate(() => { window.__pineQuest.people.find((q) => q.kind === 'ranger').fig.talking = false; });
      console.log(`${v} point: shoulder at ${box.x.toFixed(0)},${box.y.toFixed(0)}`);
    }

    // ── each person walking, from the side ──
    for (const kind of KINDS) {
      const h = posts[kind], fx = Math.sin(h.yaw), fz = Math.cos(h.yaw), rx = -Math.cos(h.yaw), rz = Math.sin(h.yaw);
      const to = { x: h.x + fx * 5, z: h.z + fz * 5 };
      // the floor at the far end: stand the player there
      await lookFrom(page, to, { x: h.x, y: h.y + 1, z: h.z });
      await sleep(600);
      const ty = await page.evaluate(() => window.__world.player.position.y);
      const mid = { x: h.x + fx * 3.0, z: h.z + fz * 3.0 };
      const eye = { x: mid.x + rx * 3.6 + fx * 0.6, z: mid.z + rz * 3.6 + fz * 0.6 };
      await lookFrom(page, eye, { x: mid.x, y: h.y + 0.95, z: mid.z });
      await page.evaluate(([k, t]) => { window.__pineQuest.people.find((q) => q.kind === k).fig.walkTo(t.x, t.y, t.z); }, [kind, { x: to.x, y: Math.min(ty, h.y + 0.6), z: to.z }]);
      await page.waitForFunction(([k, s]) => { const g = window.__pineQuest.people.find((q) => q.kind === k).fig.group.position; return Math.hypot(g.x - s.x, g.z - s.z) > 2.6; }, [kind, h], { timeout: 20000, polling: 50 });
      for (let k = 0; k < 3; k++) {
        writeFileSync(resolvePath(OUT, `${v}-walk-${kind}-${k}.jpg`), await page.screenshot({ type: 'jpeg', quality: 88 }));
        await sleep(300);
      }
      console.log(`${v} walk ${kind}: done`);
    }
    if (errors.length > 0) console.log(`${v} page errors:`, errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
