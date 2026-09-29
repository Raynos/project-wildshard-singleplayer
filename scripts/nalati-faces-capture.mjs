#!/usr/bin/env node
// nalati-faces-capture.mjs — NALATI-FINISH B5 / E302: every Nalati human's face, close up, as the iPhone draws it.
//
// For each face variant (pause ▸ Settings ▸ Debug ▸ Creatures & NPCs ▸ Camp faces, the `nalatiFaces` option) it boots the
// shard as the phone (390×844 CSS at 3×, touch, tier=phone, midday, clear), walks up to each camp person (~2.5 m, in
// front, looking at the face), hides the HUD and saves the whole portrait frame plus a square crop round the head.
// Then scripts/nalati-faces-board.py lays the crops out as the decision board.
//
//   node scripts/nalati-faces-capture.mjs --url=http://127.0.0.1:5311 --variants=current,hunyuan,trellis,painted \
//        [--people=elder,cook] [--dist=2.5] [--out=progress/e302-faces/raw]
//
// One headless Chromium on Metal (--mute-audio, mute=1), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5311');
const VARIANTS = flag('variants', 'current').split(',').filter(Boolean);
const PEOPLE = flag('people', 'elder,herderGate,herderRail,child,cook').split(',').filter(Boolean);
const DIST = Number(flag('dist', '2.5'));
const OUT = resolvePath(ROOT, flag('out', 'progress/e302-faces/raw'));
mkdirSync(OUT, { recursive: true });
const NOSHADOW = argv.includes('--noshadow'), TAG = NOSHADOW ? '-noshadow' : '';
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    await debugSettings(ctx, { nalatiFaces: v });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const q = ['chunk=nalati-grasslands', 'touch=1', 'tier=phone', 'skipintro=1', 'nolock=1', 'mute=1', 'time=13', 'clock=0', 'weather=clear'].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world && window.__nalatiQuest?.people), undefined, { timeout: 300000, polling: 1000 });
    // the generated figures replace the procedural batch once loaded
    await page.waitForFunction(() => window.__nalatiQuest.people.group.children.some((o) => o.name === 'nalati-camp-people-gen'), undefined, { timeout: 180000, polling: 1000 })
      .catch(() => { console.log(`${v}: the generated people never loaded (procedural fallback)`); });
    if (NOSHADOW) {   // diagnosis: the people stop receiving shadows (is the blotching the phone's shadow map?)
      await page.evaluate(() => { window.__nalatiQuest.people.group.traverse((o) => { if (o.isMesh) { o.receiveShadow = false; o.material.needsUpdate = true; } }); });
    }
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,.ws-touch *,[class*="elite"],[class*="banner"],[class*="quest"],[class*="toast"],[class*="crosshair"],[class*="reticle"]{visibility:hidden!important}' });
    for (const id of PEOPLE) {
      // stand DIST in front of the figure (along its idle facing), look at its face
      await page.evaluate(([pid, d]) => {
        const f = window.__nalatiQuest.people.fig[pid], p = window.__world.player;
        const x = f.feet.x + Math.sin(f.yaw) * d, z = f.feet.z + Math.cos(f.yaw) * d;
        p.position.set(x, f.feet.y + 0.2, z);
        p.yaw = Math.atan2(-(f.feet.x - x), -(f.feet.z - z));
        p.pitch = 0;
      }, [id, DIST]);
      await sleep(2500);
      // aim at the face (the talk point sits 0.12 m over the neck: the face is about there)
      await page.evaluate((pid) => {
        const f = window.__nalatiQuest.people.fig[pid], p = window.__world.player, cam = window.__world.game.camera;
        const c = cam.getWorldPosition(cam.position.clone());
        const dx = f.headWorld.x - c.x, dz = f.headWorld.z - c.z;
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = Math.atan2(f.headWorld.y - c.y, Math.hypot(dx, dz));
      }, id);
      await sleep(2000);
      const box = await page.evaluate((pid) => {
        const f = window.__nalatiQuest.people.fig[pid], cam = window.__world.game.camera;
        cam.updateMatrixWorld();
        const a = f.headWorld.clone().project(cam), b = f.headWorld.clone().add({ x: 0, y: 0.3, z: 0 }).project(cam);
        const W = window.innerWidth, H = window.innerHeight;
        return { x: (a.x + 1) / 2 * W, y: (1 - a.y) / 2 * H, r: Math.abs((b.y - a.y) / 2 * H) };
      }, id);
      writeFileSync(resolvePath(OUT, `${v}${TAG}-${id}-frame.jpg`), await page.screenshot({ type: 'jpeg', quality: 85 }));
      const s = Math.min(390, box.r * 2.6), cx = Math.max(s / 2, Math.min(390 - s / 2, box.x)), cy = Math.max(s / 2, Math.min(844 - s / 2, box.y - box.r * 0.1));
      writeFileSync(resolvePath(OUT, `${v}${TAG}-${id}-face.jpg`), await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: cx - s / 2, y: cy - s / 2, width: s, height: s } }));
      console.log(`${v} ${id}: head at ${box.x.toFixed(0)},${box.y.toFixed(0)} r ${box.r.toFixed(0)} css px`);
    }
    if (errors.length > 0) console.log(`${v} page errors:`, errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
