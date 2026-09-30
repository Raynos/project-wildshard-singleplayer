#!/usr/bin/env node
// e334-look-review-capture.mjs — Jake's Driftwood look review (2026-09-30; E334 castaway arms + E314 stage 3 keepsakes):
// the before / after frames for one iPhone-portrait sheet, and the phone-tier cost of charm III's glow.
//
//   scripts/browser-lane.sh node scripts/e334-look-review-capture.mjs --url=<build> --out=<dir> --tag=<before|after>
//        [--scenes=hand,swim,chime,night,lowsun,nd] [--measure]
//
// iPhone 16 Pro portrait (402 × 874 at 3×), touch, phone tier, muted, Metal; the HUD hidden. Scenes:
//   hand    the sword at rest, the off hand in frame (Jake: "a relaxed, half-open hand, not the pointing look")
//   swim    swimming ahead, mid-stroke (the hands sweeping out; "the sleeves above the water")
//   chime   the sea glass chime with all 15 pieces, from the path up to the hut and close, under the eave (+ its lowest
//           point over the hut floor, the door opening's top is 2.14 m)
//   night   charm III at night: the wooden sword, then the iron one
//   lowsun  a low sun behind you on open sand, looking down: the arms and the body's shadow on the sand
//   nd      Nine Dragon Stack's idle (it shares the arm player and the Sword: unchanged)
// Writes <out>/<tag>-<scene>.jpg. --measure: at night, the glow's draws / triangles and GPU ms (the frame drawn 12× back to
// back with one real sync, glow shown vs hidden alternating, the median difference — the method of
// scripts/e334-fp-capture.mjs) for each sword → <out>/<tag>-measure.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4413');
const OUT = resolvePath(flag('out', 'progress/e334-look'));
const TAG = flag('tag', 'after');
const SCENES = flag('scenes', 'hand,swim,chime,night,lowsun,nd').split(',').filter((x) => x !== '');
const MEASURE = argv.includes('--measure');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const measures = {};
const ID = 'chunk://local/driftwood-isle';
const seed = { 'ws.flags.v1': { [ID]: ['talked:castaway', 'seen:pier', 'seen:hut'] } };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript((s) => { try { if (sessionStorage.getItem('e334look') === null) { sessionStorage.setItem('e334look', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); } } catch { /* private mode */ } }, seed);
  const errors = [];
  const load = async (chunk) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.goto(`${URL_BASE}/?chunk=${chunk}&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((c) => window.__world?.player !== undefined && (c !== 'driftwood-isle' || window.__keepsakes !== undefined) && !document.getElementById('hud')?.classList.contains('intro'), chunk, { timeout: 300000, polling: 1000 });
    await sleep(6000);
    await page.addStyleTag({ content: '.e334-hide{visibility:hidden!important}' });
    await page.evaluate(() => { const gc = window.__world.game.renderer.domElement; for (const e of document.querySelectorAll('body *')) if (e !== gc && e.querySelector('canvas') !== gc) e.classList.add('e334-hide'); });
    await page.evaluate(() => { const p = window.__world.player.position; window.e334Spawn = [p.x, p.z]; }); // the pier: deep water round it
    return page;
  };
  const shot = async (page, name) => { const f = resolvePath(OUT, `${TAG}-${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 88 })); console.log(f); };
  const time = (page, t) => page.evaluate((x) => { window.__world.sky.dayNight?.setTime(x); }, t);
  const hold = (page) => page.evaluate(() => { window.__world.game.hitStop(30); });
  const release = (page) => page.evaluate(() => { window.__world.game.stopLeft = 0; });
  /** stand at hut-local (x, z), looking at hut-local (tx, ty over the floor, tz) */
  const hutView = (page, hx, hz, htx, hty, htz) => page.evaluate(({ x, z, tx, ty, tz }) => {
    const adv = window.__adventure, p = window.__world.player;
    const a = adv.place({ poi: 'hut', x, z }), b = adv.place({ poi: 'hut', x: tx, z: tz });
    const floor = adv.place({ poi: 'hut', anchor: 'hut.door', x: 0, z: -2.7 }).y;
    p.spawn(a.x, a.z, Math.atan2(-(b.x - a.x), -(b.z - a.z)));
    p.velocity.set(0, 0, 0); p.keys?.clear();
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    return new Promise((resolve) => { setTimeout(() => { p.pitch = Math.atan2(floor + ty - (p.position.y + 1.68), d); resolve({ d: Number(d.toFixed(2)) }); }, 400); });
  }, { x: hx, z: hz, tx: htx, ty: hty, tz: htz });
  /** open sand west of the hut (E314 stage 3's spot), facing away from the sun */
  const sand = (page, pitch) => page.evaluate((pp) => {
    const w = window.__world, p = w.player;
    p.spawn(-9.9, -57.3, Math.atan2(w.sky.sunDir.x, w.sky.sunDir.z));
    p.velocity.set(0, 0, 0); p.pitch = pp;
  }, pitch);

  const nd = SCENES.includes('nd');
  const dw = SCENES.filter((s) => s !== 'nd');
  if (dw.length > 0) {
    const page = await load('driftwood-isle');
    for (const scene of dw) {
      if (scene === 'hand') {
        await time(page, 'midday');
        await page.evaluate(() => { const p = window.__world.player; p.spawn(-9.9, -57.3, 0.9); p.velocity.set(0, 0, 0); p.pitch = -0.06; });
        await sleep(2000); await hold(page); await sleep(300); await shot(page, 'hand'); await release(page);
      } else if (scene === 'swim') {
        await time(page, 'midday');
        const ok = await page.evaluate(async () => {
          const w = window.__world, p = w.player;
          const [sx, sz] = window.e334Spawn;
          let found = false;
          for (const rr of [22, 30, 40, 55]) {
            for (let k = 0; k < 16 && !found; k++) {
              const a = (k / 16) * Math.PI * 2, x = sx + Math.cos(a) * rr, z = sz + Math.sin(a) * rr;
              p.spawn(x, z, Math.atan2(x - sx, z - sz)); p.velocity.set(0, 0, 0);
              await new Promise((resolve) => { setTimeout(resolve, 900); });
              if (p.swimming) found = true;
            }
            if (found) break;
          }
          if (!found) return false;
          p.pitch = -0.1; p.keys.clear(); p.keys.add('KeyW');
          await new Promise((resolve) => { setTimeout(resolve, 2600); });
          const t0 = performance.now();
          await new Promise((resolve) => {
            const tick = () => { const ph = w.hands.phase ?? 0; if ((ph > 0.28 && ph < 0.34) || performance.now() - t0 > 4000) { w.game.hitStop(30); resolve(null); } else requestAnimationFrame(tick); };
            tick();
          });
          p.keys.clear();
          return true;
        });
        if (!ok) { console.log('swim: no deep water'); continue; }
        await sleep(250); await shot(page, 'swim'); await release(page);
        await page.evaluate(() => { window.__world.player.spawn(-9.9, -57.3, 0); });
        await sleep(1500);
      } else if (scene === 'chime') {
        await time(page, 'midday');
        await page.evaluate(() => { window.__keepsakes.glass(15); });
        await sleep(9000); // the adventure's and the charms' toasts
        console.log('chime path', JSON.stringify(await hutView(page, 0.8, -12, 0, 2.3, -2.9)));
        await sleep(1800); await shot(page, 'chime-path');
        console.log('chime close', JSON.stringify(await hutView(page, 0.35, -5.2, 0, 2.75, -2.9)));
        await sleep(1800); await shot(page, 'chime-close');
        console.log('chime', JSON.stringify(await page.evaluate(() => {
          const c = window.__keepsakes.chime, adv = window.__adventure;
          if (!c) return null;
          const floor = adv.place({ poi: 'hut', anchor: 'hut.door', x: 0, z: -2.7 }).y;
          c.geometry.computeBoundingBox();
          const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
          return { pieces: c.pieces, lowestOverFloor: Number((b.min.y - floor).toFixed(3)), hookOverFloor: Number((c.getWorldPosition(b.min.clone()).y - floor).toFixed(3)), size: b.getSize(b.min.clone()).toArray().map((v) => Number(v.toFixed(2))) };
        })));
      } else if (scene === 'night') {
        await page.evaluate(() => { window.__keepsakes.glass(15); });
        await time(page, 'night');
        await sand(page, -0.05); await sleep(2500);
        console.log('glow', JSON.stringify(await page.evaluate(() => ({ night: window.__world.sky.night, glow: window.__world.crossbow.bladeGlow }))));
        await shot(page, 'night-wood');
        if (MEASURE) measures.wood = await measureGlow(page);
        await page.evaluate(() => { const ws = window.__world.weapons; ws.unlock('sword-iron'); ws.select('sword-iron', true); });
        await sleep(2200); await shot(page, 'night-iron');
        if (MEASURE) measures.iron = await measureGlow(page);
        await page.evaluate(() => { const ws = window.__world.weapons; ws.select(ws.available[0].id, true); });
        await time(page, 'midday'); await sleep(1500);
      } else if (scene === 'lowsun') {
        await time(page, 'golden');
        await sand(page, -0.42);
        await sleep(9000); // the time jump's shadow fade settles
        console.log('sun', JSON.stringify(await page.evaluate(() => window.__world.sky.sunDir.toArray().map((v) => Number(v.toFixed(3))))));
        await shot(page, 'lowsun');
      }
    }
    await page.close();
  }
  if (nd) {
    const page = await load('nine-dragon-stack');
    await page.evaluate(() => { const p = window.__world.player; p.pitch = -0.06; p.velocity.set(0, 0, 0); p.keys.clear(); });
    await sleep(1500); await hold(page); await sleep(300); await shot(page, 'nd-idle'); await release(page);
    await page.close();
  }
  if (MEASURE) writeFileSync(resolvePath(OUT, `${TAG}-measure.json`), JSON.stringify(measures, null, 1));
  if (errors.length > 0) console.log(`page errors: ${errors.slice(0, 6).join(' | ')}`);
} finally {
  await browser.close();
}

/** the glow on the held sword: shown vs hidden on the same paused frame (the halo / shell meshes, and the blade's rim) */
async function measureGlow(page) {
  const m = await page.evaluate(async () => {
    const w = window.__world, g = w.game, r = g.renderer, gl = r.getContext();
    const px = new Uint8Array(4);
    const draw = () => { g.composer.render(1 / 30); };
    const sync = () => { r.setRenderTarget(null); r.setScissor(0, 0, 1, 1); r.setScissorTest(true); r.clear(true, false, false); r.setScissorTest(false); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    const gate = g.frameGate; g.frameGate = () => false;
    const shells = [], rims = [];
    g.scene.traverse((o) => {
      if (o.name.startsWith('blade-glow') && o.visible) shells.push(o);
      const mat = o.material;
      if (mat && !Array.isArray(mat) && mat.userData?.rim && mat.userData.rim.value > 0) rims.push([mat.userData.rim, mat.userData.rim.value]);
    });
    const set = (on) => { for (const s of shells) s.visible = on; for (const [u, v] of rims) u.value = on ? v : 0; };
    const info = () => { r.info.autoReset = false; r.info.reset(); draw(); const c = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; return c; };
    set(true); const a = info(); set(false); const b = info(); set(true);
    const thr = (k) => { draw(); sync(); const t0 = performance.now(); for (let i = 0; i < k; i++) draw(); sync(); return (performance.now() - t0) / k; };
    const on = [], off = [];
    for (let round = 0; round < 11; round++) { set(true); on.push(thr(12)); set(false); off.push(thr(12)); await new Promise((resolve) => { setTimeout(resolve, 30); }); }
    set(true); g.frameGate = gate;
    const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
    return { shells: shells.map((s) => s.name), rims: rims.length, calls: a.calls - b.calls, tris: a.tris - b.tris, frameCalls: a.calls, gpuMsWith: Number(med(on).toFixed(3)), gpuMsWithout: Number(med(off).toFixed(3)), gpuMsGlow: Number((med(on) - med(off)).toFixed(3)), buffer: [r.domElement.width, r.domElement.height] };
  });
  console.log('measure', JSON.stringify(m));
  return m;
}
