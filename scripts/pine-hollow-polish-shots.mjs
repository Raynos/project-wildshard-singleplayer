#!/usr/bin/env node
// pine-hollow-polish-shots.mjs — the polish lane's evidence frames (PINE-HOLLOW-REMASTER §5 "Polish"): the HUD's toast
// stack against the elite banner / pinned bar / the cabin wall, the birds up close, the skinning beat. Phone = iPhone 16 Pro
// (UA, DPR 3, touch, 390×844); the HUD set also takes a desktop frame (1600×900) and Driftwood's toasts (phone + desktop).
//
//   node scripts/pine-hollow-polish-shots.mjs --url=http://127.0.0.1:5311 --tag=after [--only=hud,birds,beat,driftwood]
//
// Writes PNG frames to --out (default: $TMPDIR/pine-hollow-polish/<tag>/<name>.png) — the board step (magick) lays the
// before / after pairs out. One headless Chromium on Metal, muted (`--mute-audio` + `mute=1`), closed at the end.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:5311');
const TAG = flag('tag', 'after');
const OUT = flag('out', resolvePath(tmpdir(), 'pine-hollow-polish', TAG)); mkdirSync(OUT, { recursive: true });
const only = flag('only', '').split(',').filter(Boolean);
const want = (s) => only.length === 0 || only.includes(s);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const BASE = 'mute=1&nolock=1&skipintro=1&sw=0&perf=0&clock=1000000';
const iphone = devices['iPhone 16 Pro'];
const PHONE = { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } };
const DESK = { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 };
const TOASTS = ['Journal · new page: The Ghost Stag', 'Journal · new place: Ranger\'s Cabin', 'Achievement · First blood in the Hollow', 'Journal · new page: Black bear'];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
async function open(ctxOpts, q, ready = 'window.__world?.hud && window.__pineLife') {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[pageerror] ${e.message.slice(0, 300)}`));
  const t0 = Date.now();
  await page.goto(`${URL_BASE}/?${BASE}&${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(`Boolean(${ready})`, undefined, { timeout: 300_000, polling: 1000 });
  console.error(`[${q.slice(0, 60)}] ready in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await sleep(6000);
  return { ctx, page };
}
const save = async (page, name) => { const f = resolvePath(OUT, `${name}.png`); writeFileSync(f, await page.screenshot({ type: 'png' })); console.error(`  → ${f}`); };
const toasts = (page, n) => page.evaluate(([list, k]) => { for (let i = 0; i < k; i++) setTimeout(() => { window.__world.hud.toast(list[i % list.length]); }, i * 120); }, [TOASTS, n]);

try {
  if (want('hud')) {
    // 1. the Ghost Stag 60 m off: aware (its name over its head) + the NAMED ELITE NEARBY banner, three toasts at once
    const { ctx, page } = await open(PHONE, 'chunk=pine-hollow&tier=phone&touch&tod=0.4&elite=ghost-stag&from=60');
    // the banner fired on the approach (first aware inside 80 m) and faded while the page settled: show it again now
    await page.evaluate(() => { window.__world.animals.calm = true; window.__world.player.pitch = 0.02; window.__pineElites.elites.bar.banner('The Ghost Stag', 'The Pale One'); });
    await sleep(600);
    await toasts(page, 3); await sleep(1300);
    await save(page, 'hud-banner');
    // 2. step in: engaged, the bar pinned under the minimap, three more toasts
    await page.evaluate(() => {
      const w = window.__world, e = window.__pineElites.elites.entries.find((x) => x.script.def.id === 'ghost-stag'), a = e?.script.animal;
      if (!a) return;
      const p = w.player.position, dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz) || 1;
      const x = a.position.x + dx / d * 24, z = a.position.z + dz / d * 24;
      w.player.spawn(x, z, Math.atan2(-(a.position.x - x), -(a.position.z - z)));
    });
    await sleep(3500);
    await toasts(page, 3); await sleep(1300);
    await save(page, 'hud-pinned');
    await ctx.close();
  }
  if (want('hud')) {
    // 3. inside cabin 1 by the lever-action's pickup, Old Ironhide aware outside, beyond the wall — his name must not show
    const { ctx, page } = await open(PHONE, 'chunk=pine-hollow&tier=phone&touch&tod=0.4&elite=ironhide&from=40');
    const ok = await page.evaluate(() => {
      const w = window.__world; w.animals.calm = true;
      const found = [];
      w.game.scene.traverse((m) => { if (found.length > 0 || !m.isMesh || m.material?.name !== 'lever-steel') return; let p = m; while (p.parent && p.parent !== w.game.scene) p = p.parent; if (p === w.game.camera || p.position.y < -100) return; found.push(m.getWorldPosition(m.position.clone())); });
      const e = window.__pineElites.elites.entries.find((x) => x.script.def.id === 'ironhide'), a = e?.script.animal, at = found[0];
      if (at === undefined || !a) return false;
      // the pickup's room, looking from it toward Ironhide (through the wall)
      const x = at.x, z = at.z + 0.01;
      w.player.spawn(x, z, Math.atan2(-(a.position.x - x), -(a.position.z - z))); w.player.pitch = 0;
      return true;
    });
    console.error(`  cabin: ${ok}`);
    await sleep(2500);
    await toasts(page, 2); await sleep(1300);
    await save(page, 'hud-cabin');
    await ctx.close();
  }
  if (want('hud')) {
    const { ctx, page } = await open(DESK, 'chunk=pine-hollow&tier=desktop&tod=0.4&elite=ghost-stag&from=24');
    await page.evaluate(() => { window.__world.animals.calm = true; });
    await sleep(3000);
    await toasts(page, 3); await sleep(1300);
    await save(page, 'hud-desktop');
    await ctx.close();
  }
  if (want('driftwood')) {
    for (const run of [{ name: 'driftwood-phone', opts: PHONE, q: 'tier=phone&touch' }, { name: 'driftwood-desktop', opts: DESK, q: 'tier=desktop' }]) {
      const { name, opts, q } = run;
      const { ctx, page } = await open(opts, `chunk=driftwood-isle&${q}`, 'window.__world?.hud');
      await toasts(page, 4); await sleep(1300);
      await save(page, name);
      await ctx.close();
    }
  }
  if (want('birds') || want('beat')) {
    const { ctx, page } = await open(PHONE, `chunk=pine-hollow&tier=phone&touch&tod=0.33${flag('birdq', '') ? `&${flag('birdq', '')}` : ''}`);
    await page.evaluate(() => {
      const w = window.__world; w.animals.calm = true; window.__ls = { pose: null };
      const L = () => window.__pineLife, at = (b) => (b ? { x: b.pose.x, y: b.pose.y, z: b.pose.z, yaw: b.pose.yaw } : null);
      window.__lsT = {
        raven: () => at(L().ravens.find((b) => b.mode === 'ground')),
        guide: () => at(L().guides.find((b) => b.mode !== 'off')),
        wood: () => at(L().wood),
      };
      w.game.onLate(() => {
        const p = window.__ls.pose, cam = w.game.camera;
        if (!p) return;
        const t = window.__lsT[p.subject]();
        // the offset is in the bird's frame (right, up, forward): the same side of it whichever way it faces
        const fx = Math.sin(t?.yaw ?? 0), fz = Math.cos(t?.yaw ?? 0);
        if (t) { cam.position.set(t.x - fz * p.off[0] + fx * p.off[2], t.y + p.off[1], t.z + fx * p.off[0] + fz * p.off[2]); cam.up.set(0, 1, 0); cam.lookAt(t.x, t.y, t.z); }
        window.__ls.vis ??= cam.children.map((ch) => ch.visible);
        window.__ls.fov0 ??= cam.fov;
        for (const ch of cam.children) ch.visible = false;
        cam.updateMatrixWorld(true);
        if (Math.abs(cam.fov - p.fov) > 0.01) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
      });
    });
    // a deer killed in an open glade near the Hollow, well away from the elites' lairs; the player 34 m off
    const kill = await page.evaluate(() => {
      const w = window.__world, H = window.__hf, trees = w.forest.trees, T = w.game.camera.position.constructor;
      const lairs = window.__pineElites.elites.entries.map((e) => e.script.def.lair);
      let best = { x: -30, z: -118 }, bs = -1e9;
      for (let i = 0; i < 1600; i++) {
        const x = -90 + (i % 40) * 4.5, z = -150 + Math.floor(i / 40) * 4.5;
        if (lairs.some((l) => Math.hypot(l.x - x, l.z - z) < 70)) continue;
        if (H.heightAt(x, z) < H.waterLevel() + 0.5 || H.cabinMask(x, z) > 0.01 || H.pondMask(x, z) > 0.01 || H.normalAt(x, z)[1] < 0.95 || H.trailDistance(x, z) < 4) continue;
        let near = 99, ring = 0;
        for (const t of trees) { const d = Math.hypot(t.x - x, t.z - z); if (d < near) near = d; if (d < 26) ring++; }
        if (near < 8) continue;
        const score = Math.min(ring, 14) - Math.abs(near - 10) * 0.3;
        if (score > bs) { bs = score; best = { x, z }; }
      }
      const a = w.animals.spawn('deer', best.x, best.z, 0.6, 'hind');
      a.applyDamage(9999, new T(best.x, H.heightAt(best.x, best.z) + 0.8, best.z), new T(1, 0, 0));
      window.__deer = a;
      w.player.spawn(best.x + 34, best.z + 20, 0);
      return best;
    });
    console.error(`  deer down at ${kill.x}, ${kill.z}`);
    const closeUp = async (name, subject, off, fov) => {
      await page.evaluate((pose) => { window.__world.freeCamera = true; window.__ls.pose = pose; }, { subject, off, fov });
      await page.addStyleTag({ content: '#hud,#hud *,.ws-touch{display:none!important}' });
      await sleep(1500);
      await save(page, name);
    };
    if (want('birds')) {
      await page.evaluate(() => window.__pineLife.ravensTo());
      await page.waitForFunction(() => window.__pineLife.ravens.filter((r) => r.mode === 'ground').length >= 2, undefined, { timeout: 70_000, polling: 500 }).catch(() => console.error('  ravens: not down'));
      await sleep(2500);
      await closeUp('birds-ravens', 'raven', [1.0, 0.5, 0.35], 42);
      // the flight pose: a breadcrumb flock overtaking, tracked from beside
      await page.evaluate(() => { window.__ls.pose = null; window.__world.freeCamera = false; window.__pineLife.crumbs(); });
      await sleep(2500);
      await closeUp('birds-flying', 'guide', [1.2, 0.8, -1.4], 45);
      await page.evaluate(() => { window.__ls.pose = null; window.__world.freeCamera = false; window.__pineLife.woodNow(); });
      await page.waitForFunction(() => window.__pineLife.wood.mode === 'perch', undefined, { timeout: 40_000, polling: 500 }).catch(() => console.error('  woodpecker: not perched'));
      await sleep(1500);
      await closeUp('birds-woodpecker', 'wood', [0.75, 0.05, -0.45], 40);
    }
    if (want('beat')) {
      await page.evaluate(() => { document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('#hud,#hud *')) s.remove(); }); });
      await page.evaluate(() => {
        const w = window.__world, cam = w.game.camera; window.__ls.pose = null; w.freeCamera = false;
        const vis = window.__ls.vis; if (vis) cam.children.forEach((ch, i) => { ch.visible = vis[i] ?? ch.visible; });
        if (window.__ls.fov0) { cam.fov = window.__ls.fov0; cam.updateProjectionMatrix(); }
        const a = window.__deer.position, px = a.x + 1.8, pz = a.z + 0.4;
        w.player.spawn(px, pz, Math.atan2(-(a.x - px), -(a.z - pz))); w.player.pitch = -0.25;
      });
      await sleep(1800);
      // the harvest itself: [E] at its prompt (or, when the ragdoll lies out of the prompt's 2.6 m, the prompt's call)
      await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })));
      await sleep(50);
      await page.evaluate(() => { if (window.__pineLife.beat() < 0) window.__world.pineLife.harvest(window.__deer, () => undefined); });
      let i = 0;
      for (const at of [0.2, 0.42, 0.62, 0.86, 1.05, 1.4]) {
        await page.waitForFunction((a) => window.__pineLife.beat() < 0 || window.__pineLife.beat() >= a, at, { timeout: 5000, polling: 16 }).catch(() => undefined);
        await save(page, `beat-${i++}`);
      }
    }
    await ctx.close();
  }
  if (want('owl')) {
    const { ctx, page } = await open(PHONE, 'chunk=pine-hollow&tier=phone&touch&tod=0.93');
    await page.evaluate(() => {
      const w = window.__world; w.animals.calm = true; window.__ls = { pose: null };
      w.game.onLate(() => {
        const p = window.__ls.pose, cam = w.game.camera;
        if (!p) return;
        // from where the player stands (the owl's head follows the player): its face
        const o = window.__pineLife.owl.pose, pl = w.player.position, d = Math.hypot(pl.x - o.x, pl.z - o.z) || 1;
        const fx = (pl.x - o.x) / d, fz = (pl.z - o.z) / d;
        cam.position.set(o.x - fz * p.off[0] + fx * p.off[2], o.y + p.off[1], o.z + fx * p.off[0] + fz * p.off[2]); cam.up.set(0, 1, 0); cam.lookAt(o.x, o.y + 0.1, o.z);
        for (const ch of cam.children) ch.visible = false;
        cam.updateMatrixWorld(true);
        if (Math.abs(cam.fov - p.fov) > 0.01) { cam.fov = p.fov; cam.updateProjectionMatrix(); }
      });
      window.__pineLife.owlNow();
    });
    await page.waitForFunction(() => window.__pineLife.owl.mode === 'perch', undefined, { timeout: 60_000, polling: 500 }).catch(() => console.error('  owl: not perched'));
    await sleep(1500);
    await page.evaluate(() => { window.__world.freeCamera = true; window.__ls.pose = { off: [0.4, -0.2, 1.6], fov: 40 }; });
    await page.addStyleTag({ content: '#hud,#hud *,.ws-touch{display:none!important}' });
    await sleep(1500);
    await save(page, 'birds-owl');
    await ctx.close();
  }
} finally {
  await browser.close();
}
