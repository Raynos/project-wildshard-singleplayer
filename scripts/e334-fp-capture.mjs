#!/usr/bin/env node
// e334-fp-capture.mjs — E334 evidence: the first-person sword, hands and swimming hands on an iPhone 16 Pro portrait
// (402 × 874 at 3×, touch, phone tier, muted, Metal), and what the viewmodel costs.
//
//   scripts/browser-lane.sh node scripts/e334-fp-capture.mjs --url=<build> --out=<dir> --tag=<before|after>
//        [--chunk=driftwood-isle|nine-dragon-stack] [--scenes=…] [--measure]
//
// scenes: idle (the sword at rest) · light (the first light cut at 130 ms) · heavy (a charged heavy at 170 ms) · iron (the
// iron sword at rest, Driftwood) · swim (swimming ahead, mid-stroke) · tread (swimming, still) · wendell (talking to Wendell:
// the sword stowed, E129). A frame mid-swing is held by the game's own hit-stop (the world at 4 % speed) while it is
// taken; the HUD is hidden. Writes <out>/<tag>-<chunk>-<scene>.jpg.
// --measure: per held pose, the viewmodel's draws and triangles (renderer.info with the weapons / hands shown vs hidden,
// the same frame) and its GPU ms (the frame drawn 12× back to back with one real sync, shown vs hidden alternating, the
// median difference; the method of scripts/pine-hollow-gpu.mjs), plus the page's JS heap after a GC once loaded and the
// bytes of the arm rig fetched → <out>/<tag>-<chunk>-measure.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4402');
const OUT = resolvePath(flag('out', '/tmp/e334'));
const TAG = flag('tag', 'after');
const CHUNK = flag('chunk', 'driftwood-isle');
const SCENES = flag('scenes', CHUNK === 'driftwood-isle' ? 'idle,light,heavy,swim,tread,wendell,iron' : 'idle,light,heavy').split(',').filter((x) => x !== '');
const MEASURE = argv.includes('--measure');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const measures = { heap: {}, rigBytes: {} };
const saveMeasures = () => { if (MEASURE) writeFileSync(resolvePath(OUT, `${TAG}-${CHUNK}-measure.json`), JSON.stringify(measures, null, 1)); };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const load = async (weapon) => {
    const page = await ctx.newPage();
    const rig = { bytes: 0, urls: [] };
    page.on('pageerror', (e) => { console.log('pageerror', e.message.slice(0, 200)); });
    page.on('console', (m) => { if (/arms (rig )?did not load|arms rig/.test(m.text())) console.log('console', m.text().slice(0, 300)); });
    page.on('response', async (r) => {
      if (!/fp-arms|fp-rig|viewmodel/.test(r.url())) return;
      try { const b = await r.body(); rig.bytes += b.length; rig.urls.push(`${r.url().replace(URL_BASE, '')} ${b.length}`); } catch { /* a redirect */ }
    });
    await page.goto(`${URL_BASE}/?chunk=${CHUNK}&mute=1&nolock=1&skipintro=1&touch=1&tier=phone${weapon ? `&weapon=${weapon}` : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__wildshard?.world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
    await sleep(6000);
    // the HUD out of the frame: everything but the canvas and what holds it
    await page.addStyleTag({ content: '.e334-hide{visibility:hidden!important}' });
    await page.evaluate(() => { const gc = window.__wildshard.world.game.renderer.domElement; for (const e of document.querySelectorAll('body *')) if (e !== gc && e.querySelector('canvas') !== gc) e.classList.add('e334-hide'); });
    if (MEASURE) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('HeapProfiler.collectGarbage');
      await sleep(500);
      const h = await cdp.send('Runtime.getHeapUsage');
      measures.heap[weapon ?? 'default'] = { usedMB: Number((h.usedSize / 1e6).toFixed(1)), totalMB: Number((h.totalSize / 1e6).toFixed(1)) };
      measures.rigBytes[weapon ?? 'default'] = rig;
      console.log('heap', weapon ?? 'default', JSON.stringify(measures.heap[weapon ?? 'default']), 'rig bytes', rig.bytes);
      await cdp.detach();
    }
    return page;
  };
  const shot = async (page, name) => { const f = resolvePath(OUT, `${TAG}-${CHUNK}-${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 86 })); console.log(f); };
  /** a quiet view from the spawn, level */
  const pose = (page) => page.evaluate(() => { const p = window.__wildshard.world.player; p.pitch = -0.06; p.velocity.set(0, 0, 0); p.keys.clear(); });
  /** hold the world still (hit-stop) — the swing / the stroke stays where it is for the shot */
  const hold = (page) => page.evaluate(() => { window.__wildshard.world.game.hitStop(30); });
  const release = (page) => page.evaluate(() => { window.__wildshard.world.game.stopLeft = 0; });
  const measure = async (page, name) => {
    if (!MEASURE) return;
    const m = await page.evaluate(async () => {
      const w = window.__wildshard?.world, g = w.game, r = g.renderer, gl = r.getContext();
      const px = new Uint8Array(4);
      const draw = () => { g.composer.render(1 / 30); };
      const sync = () => { r.setRenderTarget(null); r.setScissor(0, 0, 1, 1); r.setScissorTest(true); r.clear(true, false, false); r.setScissorTest(false); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      const gate = g.frameGate; g.frameGate = () => false; // the loop paused: this frame, drawn by hand
      const shown = [w.weapons.visible, w.hands.group.visible];
      const set = (on) => { w.weapons.visible = on && shown[0]; w.hands.group.visible = on && shown[1]; };
      const info = () => { r.info.autoReset = false; r.info.reset(); draw(); const c = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; return c; };
      set(true); const a = info(); set(false); const b = info(); set(true);
      const thr = (k) => { draw(); sync(); const t0 = performance.now(); for (let i = 0; i < k; i++) draw(); sync(); return (performance.now() - t0) / k; };
      const on = [], off = [];
      for (let round = 0; round < 9; round++) { set(true); on.push(thr(12)); set(false); off.push(thr(12)); await new Promise((resolve) => { setTimeout(resolve, 30); }); }
      set(true);
      g.frameGate = gate;
      const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
      return { calls: a.calls - b.calls, tris: a.tris - b.tris, frameCalls: a.calls, frameTris: a.tris, gpuMsWith: Number(med(on).toFixed(3)), gpuMsWithout: Number(med(off).toFixed(3)), gpuMsViewmodel: Number((med(on) - med(off)).toFixed(3)), buffer: [r.domElement.width, r.domElement.height] };
    });
    measures[name] = m;
    console.log(name, JSON.stringify(m));
    saveMeasures();
  };
  const swing = (page, heavy, at) => page.evaluate(async ({ heavy: hv, at: when }) => {
    const held = window.__wildshard.world.weapons.current, s = held.bow ?? held; // the held Sword (its Weapons wrapper's `bow`): the iron one once selected
    if (hv) { s.adsHeld = true; await new Promise((resolve) => { setTimeout(resolve, 700); }); s.adsHeld = false; } else s.tryFire();
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => { if ((s.move !== null && s.swingT >= when) || performance.now() - t0 > 3000) { window.__wildshard.world.game.hitStop(30); resolve(null); } else requestAnimationFrame(tick); };
      tick();
    });
    return { move: s.move?.name ?? null, t: s.swingT };
  }, { heavy, at });

  const page = await load(null);
  for (const scene of SCENES) {
    if (scene === 'iron') continue;
    if (scene === 'idle') {
      await pose(page); await sleep(1500); await hold(page); await sleep(300); await shot(page, 'idle'); await measure(page, 'idle'); await release(page);
    } else if (scene === 'light' || scene === 'heavy') {
      await pose(page); await sleep(1200);
      const r = await swing(page, scene === 'heavy', scene === 'light' ? 0.13 : 0.17);
      console.log(scene, JSON.stringify(r));
      await sleep(250); await shot(page, scene); await measure(page, scene); await release(page); await sleep(1200);
    } else if (scene === 'wendell') {
      // walk up to Wendell (his group is named for the face capture, E304), face him, and talk (E): the sword eases down (E129)
      const ok = await page.evaluate(async () => {
        const w = window.__wildshard?.world, p = w.player, c = w.game.scene.getObjectByName('npc-castaway') ?? w.game.scene.getObjectByName('castaway');
        if (c === undefined) return false;
        const f = c.getWorldDirection(c.position.clone()).setY(0).normalize();
        const x = c.position.x + f.x * 2.4, z = c.position.z + f.z * 2.4;
        p.spawn(x, z, Math.atan2(x - c.position.x, z - c.position.z)); // forward is (−sin yaw, −cos yaw) p.velocity.set(0, 0, 0); p.pitch = -0.05;
        await new Promise((resolve) => { setTimeout(resolve, 1500); });
        return true;
      });
      if (!ok) { console.log('wendell: not found'); continue; }
      await page.keyboard.press('KeyE');
      await sleep(400);
      console.log('wendell: stowed', await page.evaluate(() => window.__wildshard.world.weapons.stowed));
      await sleep(2200);
      await shot(page, 'wendell');
      await page.keyboard.press('Escape'); await sleep(300);
    } else if (scene === 'swim' || scene === 'tread') {
      // into deep water off the spawn (a ring of candidates round it: the first the player swims in), facing out
      const ok = await page.evaluate(async (moving) => {
        const w = window.__wildshard?.world, p = w.player;
        if (!p.swimming) {
          const sx = p.position.x, sz = p.position.z;
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
        }
        p.pitch = -0.1;
        p.keys.clear();
        if (moving) p.keys.add('KeyW');
        await new Promise((resolve) => { setTimeout(resolve, moving ? 2600 : 3000); });
        if (moving) {
          // mid-stroke: the hands sweeping out (phase ~0.3 of the cycle)
          const t0 = performance.now();
          await new Promise((resolve) => {
            const tick = () => { const ph = w.hands.phase ?? 0; if ((ph > 0.28 && ph < 0.34) || performance.now() - t0 > 4000) { w.game.hitStop(30); resolve(null); } else requestAnimationFrame(tick); };
            tick();
          });
        } else w.game.hitStop(30);
        p.keys.clear();
        return true;
      }, scene === 'swim');
      if (!ok) { console.log('swim: no deep water found'); continue; }
      await sleep(250); await shot(page, scene); await measure(page, scene); await release(page);
    }
  }
  saveMeasures();
  await page.close();
  if (SCENES.includes('iron')) {
    const p2 = await load('iron');
    await pose(p2); await sleep(1500); await hold(p2); await sleep(300); await shot(p2, 'iron'); await measure(p2, 'iron'); await release(p2);
    await sleep(600);
    const r = await swing(p2, false, 0.13);
    console.log('iron-light', JSON.stringify(r));
    await sleep(250); await shot(p2, 'iron-light'); await release(p2);
    saveMeasures();
    await p2.close();
  }
} finally {
  await browser.close();
}
