#!/usr/bin/env node
// e304-faces-capture.mjs — E304: every faced model of a shard, close up, as the iPhone draws it (the sibling of
// scripts/nalati-faces-capture.mjs, for the King and the other three shards).
//
// Per face variant (a Debug option: nalatiFaces / pineFaces / driftwoodFaces / nineDragonFaces) it boots the shard as the
// phone (390×844 CSS at 3×, touch, tier=phone, midday, clear), finds each target (TARGETS below: its feet, facing and
// head, in the page), stands --dist in front of it looking at the face, hides the HUD and saves the portrait frame plus
// a square crop round the head: <out>/<variant>-<target>-{frame,face}.jpg. scripts/e304-faces-board.py lays them out.
//
//   node scripts/e304-faces-capture.mjs --url=http://127.0.0.1:4400 --shard=nalati-grasslands --key=nalatiFaces \
//        --variants=current,hunyuan --targets=king [--dist=2.5] [--out=progress/e304-faces/raw]
//
// Run it inside scripts/browser-lane.sh. One headless Chromium on Metal (--mute-audio, mute=1), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const SHARD = flag('shard', 'nalati-grasslands');
const KEY = flag('key', 'nalatiFaces');
const VARIANTS = flag('variants', 'current').split(',').filter(Boolean);
const IDS = flag('targets', '').split(',').filter(Boolean);
const DIST = Number(flag('dist', '2.5'));
const EXTRA = flag('params', '');
const OUT = resolvePath(ROOT, flag('out', 'progress/e304-faces/raw'));
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * page-side locators: (id) => { feet: {x,y,z}, yaw, head: {x,y,z} } | null, as a function body string (runs in the page,
 * `id` in scope). yaw = the way the target faces (0 = +z). `head` = the face's centre.
 */
const TARGETS = {
  // the Golden King: one spawned in the open steppe by the camp (he lives in the kurgan; the same rig and file), held still
  'nalati-grasslands': `
    const w = window.__world, p = w.player;
    let a = window.__e304king;
    if (!a) {
      const yaw = p.yaw + Math.PI;
      a = w.animals.spawn('golden-king', p.position.x - Math.sin(p.yaw) * 6, p.position.z - Math.cos(p.yaw) * 6, yaw, 'king');
      a.aggressive = false; a.desiredSpeed = 0;
      window.__e304king = a;
    }
    a.desiredSpeed = 0; a.speed = 0; a.desiredYaw = a.yaw; a.state = 'idle';
    a.mesh.updateMatrixWorld(true);
    const hb = a.mesh.skeleton.bones.find((b) => b.name === 'head');
    const h = hb.getWorldPosition(hb.position.clone());
    return { feet: { x: a.position.x, y: a.position.y, z: a.position.z }, yaw: a.yaw, head: { x: h.x, y: h.y + 0.14 * a.scale, z: h.z } };`,
  // the hamlet's people (ranger / trader / miller): the quest's figures, their talk point is the head
  'pine-hollow': `
    const per = window.__pineQuest.people.find((q) => q.kind === id);
    if (!per) return null;
    const g = per.fig.group, t = per.fig.talkPoint;
    return { feet: { x: g.position.x, y: g.position.y, z: g.position.z }, yaw: g.rotation.y, head: { x: t.x, y: t.y + 0.03, z: t.z } };`,
  // Wendell (the castaway, by name) · the Drowned Sailor and the Captain: one of each spawned in the open by the player,
  // held still (the sailor rises in the wreck at night, the Captain at the altar: the same species, rig and file)
  'driftwood-isle': `
    const w = window.__world, p = w.player;
    if (id === 'wendell') {
      const g = w.game.scene.getObjectByName('npc-castaway');
      if (!g) return null;
      g.updateMatrixWorld(true);
      const h = g.localToWorld(g.position.clone().set(0, 1.66, 0.05));
      return { feet: { x: g.position.x, y: g.position.y, z: g.position.z }, yaw: g.rotation.y, head: { x: h.x, y: h.y, z: h.z } };
    }
    window.__e304 = window.__e304 || {};
    let a = window.__e304[id];
    if (!a) {
      const yaw = p.yaw + Math.PI;
      a = w.animals.spawn(id, p.position.x - Math.sin(p.yaw) * 6, p.position.z - Math.cos(p.yaw) * 6, yaw);
      a.aggressive = false;
      window.__e304[id] = a;
    }
    a.desiredSpeed = 0; a.speed = 0; a.desiredYaw = a.yaw; a.state = 'idle';
    a.mesh.updateMatrixWorld(true);
    const hb = a.mesh.skeleton.bones.find((b) => b.name === 'head');
    const h = hb.getWorldPosition(hb.position.clone());
    return { feet: { x: a.position.x, y: a.position.y, z: a.position.z }, yaw: a.yaw, head: { x: h.x, y: h.y + 0.08 * a.scale, z: h.z } };`,
  // Lantern Square (layout.ts coordinates are the scene's): the noodle stall's cook and the hawker's (world/stalls.ts,
  // hero/figures.ts, merged into the square's kit: no handle, so their spots from the layout), a TRELLIS mahjong sitter
  'nine-dragon-stack': `
    const T = {
      cook: { feet: { x: 18.0, y: 125, z: -16.65 }, yaw: 0, head: { x: 18.0, y: 126.72, z: -16.57 } },
      hawker: { feet: { x: 7.5, y: 125, z: -2.45 }, yaw: 0, head: { x: 7.5, y: 126.72, z: -2.37 } },
      sitter: { feet: { x: 4.58, y: 125, z: -0.37 }, yaw: 0.15, head: { x: 4.59, y: 126.28, z: -0.3 } },
    };
    return T[id] || null;`,
};

const locate = TARGETS[SHARD];
if (!locate) { console.error(`no TARGETS for ${SHARD}`); process.exit(2); }

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const v of VARIANTS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    await debugSettings(ctx, { [KEY]: v });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    const q = [`chunk=${SHARD}`, 'touch=1', 'tier=phone', 'skipintro=1', 'nolock=1', 'mute=1', 'time=13', 'clock=0', 'weather=clear', ...(EXTRA ? [EXTRA] : [])].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.player && window.__world?.game), undefined, { timeout: 300000, polling: 1000 });
    await sleep(8000);
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,.ws-touch *,[class*="elite"],[class*="banner"],[class*="quest"],[class*="toast"],[class*="crosshair"],[class*="reticle"],[class*="boss"]{visibility:hidden!important}' });
    for (const id of IDS) {
      const expr = `((id) => { ${locate} })(${JSON.stringify(id)})`;
      let t0 = null;
      try { t0 = await page.evaluate(expr); } catch (error) { console.log(`${v} ${id}: locate failed: ${String(error).slice(0, 200)}`); }
      if (!t0) continue;
      await page.evaluate(([t, d]) => {
        const p = window.__world.player;
        const x = t.feet.x + Math.sin(t.yaw) * d, z = t.feet.z + Math.cos(t.yaw) * d;
        p.position.set(x, t.feet.y + 0.2, z);
        p.velocity?.set(0, 0, 0);
        p.yaw = Math.atan2(-(t.feet.x - x), -(t.feet.z - z));
        p.pitch = 0;
      }, [t0, DIST]);
      await sleep(3000);
      const t = await page.evaluate(expr);
      await page.evaluate((tt) => {
        const p = window.__world.player, cam = window.__world.game.camera;
        const c = cam.getWorldPosition(cam.position.clone());
        const dx = tt.head.x - c.x, dz = tt.head.z - c.z;
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = Math.atan2(tt.head.y - c.y, Math.hypot(dx, dz));
      }, t);
      await sleep(2500);
      const box = await page.evaluate((tt) => {
        const cam = window.__world.game.camera;
        cam.updateMatrixWorld();
        const V = cam.position.constructor;
        const a = new V(tt.head.x, tt.head.y, tt.head.z).project(cam), b = new V(tt.head.x, tt.head.y + 0.3, tt.head.z).project(cam);
        const W = window.innerWidth, H = window.innerHeight;
        return { x: (a.x + 1) / 2 * W, y: (1 - a.y) / 2 * H, r: Math.abs((b.y - a.y) / 2 * H) };
      }, t);
      writeFileSync(resolvePath(OUT, `${v}-${id}-frame.jpg`), await page.screenshot({ type: 'jpeg', quality: 85 }));
      const s = Math.min(390, box.r * 2.6), cx = Math.max(s / 2, Math.min(390 - s / 2, box.x)), cy = Math.max(s / 2, Math.min(844 - s / 2, box.y - box.r * 0.1));
      writeFileSync(resolvePath(OUT, `${v}-${id}-face.jpg`), await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: cx - s / 2, y: cy - s / 2, width: s, height: s } }));
      console.log(`${v} ${id}: head at ${box.x.toFixed(0)},${box.y.toFixed(0)} r ${box.r.toFixed(0)} css px`);
    }
    // proof the variant's files loaded (a preview can be swapped under a run: the machine-wide preview cap)
    const faces = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/faces-')).map((n) => n.replace(/^.*\/assets\//, '')));
    console.log(`${v} face files: ${faces.length > 0 ? faces.join(' ') : 'none'}`);
    if (errors.length > 0) console.log(`${v} page errors:`, errors.slice(0, 4).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
