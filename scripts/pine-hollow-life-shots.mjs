#!/usr/bin/env node
// pine-hollow-life-shots.mjs — the evidence frames of Pine Hollow's ambient life + the skinning beat (PINE-HOLLOW-REMASTER
// PH-M5 / F2): ravens feeding at a fresh kill, a hare, the woodpecker on its trunk, the jays' breadcrumb pass, the owl at
// night, and a frame strip of the skinning beat. Phone tier, iPhone 16 Pro (UA, DPR 3, touch, 390×844), HUD on for the
// first-person frames, hidden for the close-ups.
//
//   node scripts/pine-hollow-life-shots.mjs --url=http://127.0.0.1:5301 [--only=ravens,hare,wood,crumbs,beat,owl] [--tag=01]
//                                           [--x= --z=]   (the day scenes' spot; default: the most open glade near the Hollow)
//
// Writes progress/pine-hollow-life-<tag>-<shot>.jpg (≤ 490 KB each). One headless Chromium on Metal, muted, two page loads
// (day, night), closed at the end.
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5301');
const TAG = flag('tag', '01');
const only = flag('only', '').split(',').filter(Boolean);
const want = (s) => only.length === 0 || only.includes(s);
const FR = resolvePath(tmpdir(), 'pine-hollow-life'); mkdirSync(FR, { recursive: true });
const OUT = resolvePath(ROOT, 'progress'); mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const BASE = 'chunk=pine-hollow&mute=1&nolock=1&skipintro=1&sw=0&perf=0&tier=phone&touch&clock=1000000';
const SPOT = { x: Number(flag('x', 'NaN')), z: Number(flag('z', 'NaN')) };

const iphone = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const saved = [];
/** a JPEG under the size cap */
function save(name, buf) {
  const raw = resolvePath(FR, `${name}.png`); writeFileSync(raw, buf);
  const out = resolvePath(OUT, `pine-hollow-life-${TAG}-${name}.jpg`);
  for (const q of [82, 74, 66, 58]) { execFileSync('magick', [raw, '-resize', '780x', '-quality', String(q), out]); if (statSync(out).size < 490_000) break; }
  saved.push(out); console.error(`  → ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
}
/** frames side by side, one JPEG */
function strip(name, bufs) {
  const files = bufs.map((b, i) => { const f = resolvePath(FR, `${name}-${i}.png`); writeFileSync(f, b); return f; });
  const out = resolvePath(OUT, `pine-hollow-life-${TAG}-${name}.jpg`);
  for (const q of [80, 70, 60, 50]) { execFileSync('magick', [...files, '-resize', '390x', '+append', '-quality', String(q), out]); if (statSync(out).size < 490_000) break; }
  saved.push(out); console.error(`  → ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
}

async function open(tod) {
  const ctx = await browser.newContext({ userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message.slice(0, 300)}`));
  const t0 = Date.now();
  const at = Number.isFinite(SPOT.x) ? `&x=${SPOT.x}&z=${SPOT.z}` : '';
  await page.goto(`${URL_BASE}/?${BASE}&tod=${tod}${at}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.animals && window.__pineLife && window.__hf), undefined, { timeout: 300_000, polling: 1000 });
  console.error(`[${tod}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.evaluate(() => {
    const w = window.__world;
    w.animals.calm = true;
    window.__ls = { pose: null };
    const H = window.__hf;
    /** the close-ups' subjects, by name: (life, world) → a world point or null */
    window.__lsT = {
      ravens: (L) => { const ps = L.ravens.filter((r) => r.mode === 'ground').map((r) => r.pose); if (ps.length === 0) return null; const x = ps.reduce((a, p) => a + p.x, 0) / ps.length, z = ps.reduce((a, p) => a + p.z, 0) / ps.length; return { x, y: H.heightAt(x, z) + 0.2, z }; },
      hare: (L, W) => { const p = W.player.position, h = L.hares.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; return h && h.x < 1e4 ? { x: h.x, y: H.heightAt(h.x, h.z) + 0.18, z: h.z } : null; },
      wood: (L) => ({ x: L.wood.pose.x, y: L.wood.pose.y, z: L.wood.pose.z }),
      owl: (L) => ({ x: L.owl.pose.x, y: L.owl.pose.y + 0.1, z: L.owl.pose.z }),
    };
    w.game.onLate(() => {
      const p = window.__ls.pose, cam = w.game.camera;
      if (!p) return;
      if (p.track) { const t = p.track(window.__pineLife, w); if (t) { p.look = [t.x, t.y + 0.05, t.z]; p.pos = [t.x + p.off[0], t.y + p.off[1], t.z + p.off[2]]; } }
      for (const ch of cam.children) ch.visible = false;
      cam.position.set(p.pos[0], p.pos[1], p.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(p.look[0], p.look[1], p.look[2]); cam.updateMatrixWorld(true);
      if (Math.abs(cam.fov - p.fov) > 0.01) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
    });
  });
  await sleep(6000);
  if (!Number.isFinite(SPOT.x)) {
    const s = await page.evaluate(() => {
      const w = window.__world, H = window.__hf, trees = w.forest.trees;
      let best = null, bs = -1;
      for (let i = 0; i < 1600; i++) {
        const x = -90 + (i % 40) * 4.5, z = -150 + Math.floor(i / 40) * 4.5;
        const y = H.heightAt(x, z);
        if (y < H.waterLevel() + 0.5 || H.cabinMask(x, z) > 0.01 || H.pondMask(x, z) > 0.01 || H.normalAt(x, z)[1] < 0.93 || H.trailDistance(x, z) < 4) continue;
        let near = 99, ring = 0;
        for (const t of trees) { const d = Math.hypot(t.x - x, t.z - z); if (d < near) near = d; if (d < 26) ring++; }
        if (near < 8) continue;
        const score = Math.min(ring, 14) - Math.abs(near - 10) * 0.3;
        if (score > bs) { bs = score; best = { x, z }; }
      }
      return best;
    });
    if (s) { SPOT.x = s.x; SPOT.z = s.z; }
    console.error(`  spot ${SPOT.x}, ${SPOT.z}`);
  }
  return { ctx, page };
}

/**
 * A close-up: the camera `back` m from the target at `up` m over it, looking at it, from whichever of 16 bearings sees it
 * clear (a Rapier ray from the target to the eye that hits no collider); the player stays where it is.
 */
async function closeUp(page, subject, back, up, fov) {
  const clear = await page.evaluate(([name, dist, rise, fovV]) => {
    const w = window.__world, get = window.__lsT[name], t = get(window.__pineLife, w);
    if (!t) return -1;
    const P = w.physics;
    const base = Math.atan2(w.player.position.z - t.z, w.player.position.x - t.x);
    let best = null, bestScore = -2;
    for (let k = 0; k < 16; k++) {
      const ang = base + (k * Math.PI * 2) / 16;
      const px = t.x + Math.cos(ang) * dist, pz = t.z + Math.sin(ang) * dist;
      const py = Math.max(t.y + rise, window.__hf.heightAt(px, pz) + 0.4);
      let c = 1;
      if (P?.R && P.world) {
        // from 0.4 m out of the target (a bird on a trunk sits inside the trunk's collider margin)
        const ex = px - t.x, ey = py - t.y - 0.15, ez = pz - t.z, el = Math.hypot(ex, ey, ez);
        const o = { x: t.x + (ex / el) * 0.4, y: t.y + 0.15 + (ey / el) * 0.4, z: t.z + (ez / el) * 0.4 }, dx = px - o.x, dy = py - o.y, dz = pz - o.z, len = Math.hypot(dx, dy, dz);
        const hit = P.world.castRay(new P.R.Ray(o, { x: dx / len, y: dy / len, z: dz / len }), len, true);
        if (hit) c = (hit.timeOfImpact ?? hit.toi ?? 0) / len;
      }
      // the terrain between them too (a rise in the ground)
      for (let s = 1; s < 8 && c === 1; s++) { const u = s / 8, x = t.x + (px - t.x) * u, z = t.z + (pz - t.z) * u; if (window.__hf.heightAt(x, z) > t.y + 0.15 + (py - t.y - 0.15) * u) c = u; }
      const score = c - k * 0.001;
      if (score > bestScore) { bestScore = score; best = [px, py, pz]; }
      if (c === 1) break;
    }
    w.freeCamera = true;
    // the camera keeps its offset from the target as the target moves (a hare hops, a raven hops)
    window.__ls.pose = { pos: best, look: [t.x, t.y + 0.05, t.z], fov: fovV, off: [best[0] - t.x, best[1] - t.y, best[2] - t.z], track: get };
    return bestScore;
  }, [subject, back, up, fov]);
  console.error(`  close-up clear ${clear.toFixed(2)}`);
  await page.addStyleTag({ content: '#hud,#hud *,.ws-touch{display:none!important}' });
  await sleep(1200);
}
const showHud = (page) => page.evaluate(() => { document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('#hud,#hud *')) s.remove(); }); });

try {
  if (['ravens', 'hare', 'wood', 'crumbs', 'beat'].some(want)) {
    const { ctx, page } = await open('0.33');
    // a deer, killed on the spot: the carcass the ravens come to (and the beat skins); the player waits 40 m off
    const kill = await page.evaluate(([x, z]) => {
      const w = window.__world, T = w.game.camera.position.constructor;
      const a = w.animals.spawn('deer', x, z, 0.6, 'hind');
      a.applyDamage(9999, new T(x, window.__hf.heightAt(x, z) + 0.8, z), new T(1, 0, 0));
      w.player.spawn(x + 34, z + 20, 0);
      return { x: a.position.x, z: a.position.z };
    }, [SPOT.x, SPOT.z]);
    console.error(`  deer down at ${kill.x.toFixed(1)}, ${kill.z.toFixed(1)}`);
    if (want('ravens')) {
      await page.evaluate(() => window.__pineLife.ravensTo());
      const t0 = Date.now();
      await page.waitForFunction(() => window.__pineLife.ravens.filter((r) => r.mode === 'ground').length >= 2, undefined, { timeout: 60_000, polling: 500 }).catch(() => console.error('  ravens: not down in 60 s'));
      console.error(`  ravens down after ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      await sleep(2500);
      await closeUp(page, 'ravens', 3.0, 2.4, 55);
      save('ravens', await page.screenshot({ type: 'png' }));
    }
    if (want('hare')) {
      await closeUp(page, 'hare', 1.9, 0.3, 40);
      save('hare', await page.screenshot({ type: 'png' }));
    }
    if (want('wood')) {
      await page.evaluate(() => window.__pineLife.woodNow());
      await page.waitForFunction(() => window.__pineLife.wood.mode === 'perch', undefined, { timeout: 40_000, polling: 500 }).catch(() => console.error('  woodpecker: not perched'));
      await sleep(1500);
      await closeUp(page, 'wood', 2.2, 0.1, 40);
      save('woodpecker', await page.screenshot({ type: 'png' }));
    }
    if (want('crumbs')) {
      await showHud(page);
      await page.evaluate(([x, z]) => { const w = window.__world; window.__ls.pose = null; w.freeCamera = false; w.player.spawn(x + 30, z + 10, 0); w.player.pitch = 0.22; }, [SPOT.x, SPOT.z]);
      await sleep(1500);
      const target = await page.evaluate(() => { const t = window.__pineLife.crumbs(); if (!t) return null; const w = window.__world, p = w.player.position; w.player.yaw = Math.atan2(-(t.x - p.x), -(t.z - p.z)); return t; });
      console.error(`  crumbs → ${target ? target.id : 'none'}`);
      const frames = [];
      for (let i = 0; i < 3; i++) { await sleep(i === 0 ? 1100 : 800); frames.push(await page.screenshot({ type: 'png' })); }
      strip('crumbs', frames);
    }
    if (want('beat')) {
      await showHud(page);
      // stand 1.8 m off the carcass, facing it, and press E
      await page.evaluate(([x, z]) => {
        const w = window.__world; window.__ls.pose = null; w.freeCamera = false;
        const px = x + 1.8, pz = z + 0.4;
        w.player.spawn(px, pz, Math.atan2(-(x - px), -(z - pz))); w.player.pitch = -0.25;
      }, [kill.x, kill.z]);
      await sleep(1500);
      await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })));
      const frames = [];
      for (const at of [0.05, 0.35, 0.5, 0.9, 1.3, 1.75]) {
        await page.waitForFunction((a) => window.__pineLife.beat() < 0 || window.__pineLife.beat() >= a, at, { timeout: 5000, polling: 16 }).catch(() => undefined);
        frames.push(await page.screenshot({ type: 'png' }));
      }
      strip('skinning', frames);
    }
    await ctx.close();
  }
  if (want('owl')) {
    const { ctx, page } = await open('night');
    // the most open snag near the Hollow (sky behind it), the player 30 m off it; the owl onto its top
    const snag = await page.evaluate(() => {
      const w = window.__world, trees = w.forest.trees;
      let best = null, bs = Infinity;
      for (const t of trees) {
        if (t.species !== 'snag' || Math.hypot(t.x, t.z + 60) > 140) continue;
        let n = 0; for (const o of trees) if (o !== t && Math.hypot(o.x - t.x, o.z - t.z) < 9) n += o.species === 'sapling' ? 0.2 : 1;
        if (n < bs) { bs = n; best = t; }
      }
      if (!best) return null;
      w.player.spawn(best.x + 30, best.z + 4, 0);
      return { x: best.x, z: best.z, n: bs };
    });
    console.error(`  snag ${JSON.stringify(snag)}`);
    await sleep(1500);
    await page.evaluate((s) => (s ? window.__pineLife.owlNow(s.x, s.z) : window.__pineLife.owlNow()), snag);
    await page.waitForFunction(() => window.__pineLife.owl.mode === 'perch', undefined, { timeout: 60_000, polling: 500 }).catch(() => console.error('  owl: not perched'));
    await sleep(2000);
    await closeUp(page, 'owl', 4.5, -1.6, 40);
    save('owl', await page.screenshot({ type: 'png' }));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(saved.join('\n'));
