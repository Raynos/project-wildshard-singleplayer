#!/usr/bin/env node
// e322-hands-capture.mjs — E322 F-M6 evidence: Pine Hollow's crossbow and lever-action held in the hunter's gloved hands
// (src/player/hunterHands.ts), on an iPhone 16 Pro portrait (402 × 874 at 3×, touch, phone tier, muted, Metal), and what
// the hands cost.
//
//   scripts/browser-lane.sh node scripts/e322-hands-capture.mjs --url=<build> --out=<dir> [--tag=<t>] [--weapons=crossbow,lever] [--desktop]
//
// Per weapon and pose (rest · aim · reload; the lever also cycle), one frame held still and shot twice — the hands hidden
// (a) and shown (b) — into <out>/<tag>-<weapon>-<pose>-<a|b>.jpg; the crossbow's reload is held mid-draw (its reload clock
// stopped), the lever's with a cartridge at the gate (hit-stop). HUD hidden. Then <out>/measure.json: per weapon and pose,
// the draws and triangles the hands add (renderer.info, the same frame drawn with them shown and hidden), the frame's
// GPU ms with / without (the frame drawn 12× back to back with one real sync, median of 7 rounds — scripts/e334-fp-capture.mjs's
// method), and the hands' geometry (vertices, triangles, bytes).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4402');
const OUT = resolvePath(flag('out', '/tmp/e322-hands'));
const DESKTOP = argv.includes('--desktop');
const TAG = flag('tag', 'hands');
const WEAPONS = flag('weapons', 'crossbow,lever').split(',');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const POSES = { crossbow: ['rest', 'aim', 'reload'], lever: ['rest', 'aim', 'reload', 'cycle'] };
const measures = {};

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = DESKTOP
    ? await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    : await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('pageerror', e.message.slice(0, 200)); });
  await page.goto(`${URL_BASE}/?chunk=pine-hollow&mute=1&nolock=1&skipintro=1${DESKTOP ? '' : '&touch=1&tier=phone'}&weapon=rifle`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.player !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
  await sleep(6000);
  console.log('build', await page.evaluate(() => fetch('/version.json').then((r) => r.json()).then((j) => j.build)));
  await page.addStyleTag({ content: '.e322-hide{visibility:hidden!important}' });
  await page.evaluate(() => { const gc = window.__world.game.renderer.domElement; for (const e of document.querySelectorAll('body *')) if (e !== gc && e.querySelector('canvas') !== gc) e.classList.add('e322-hide'); });

  /** put the weapon in the pose and hold it still */
  const pose = (which, state) => page.evaluate(async ({ which: w0, state: st }) => {
    const w = window.__world, p = w.player, sl = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
    p.pitch = -0.06; p.velocity.set(0, 0, 0); p.keys?.clear?.();
    const id = w0 === 'crossbow' ? 'crossbow' : 'rifle', wp = w0 === 'crossbow' ? w.crossbow : w.weapons.get('rifle');
    if (w.weapons.current.id !== id) { w.weapons.select(id, true); await sl(700); }
    wp.adsHeld = false; if (w0 === 'lever') wp.freezeCycle = null;
    if (st === 'aim') { wp.adsHeld = true; await sl(900); }
    else if (st === 'cycle') { wp.freezeCycle = 0.45; await sl(700); }
    else if (st === 'reload' && w0 === 'crossbow') {
      wp.reloadScale = 1; if (wp.state.loaded) wp.fire(); await sl(200); wp.reload();
      const t0 = performance.now(); while (wp.state.reloadProgress < 0.5 && performance.now() - t0 < 4000) await sl(16);
      wp.reloadScale = 1e9; await sl(600);
    } else if (st === 'reload') {
      if (wp.tube >= 6) { wp.tryFire(); await sl(1200); }
      wp.reload();
      const t0 = performance.now();
      while (performance.now() - t0 < 4000) { const inT = wp.phaseT - 0.22, k = (inT % 0.4) / 0.4; if (wp.phase === 'reload' && wp.round.visible && inT > 0 && k > 0.3 && k < 0.45) break; await sl(8); }
    } else await sl(900);
    w.game.hitStop(30);
    await sl(250);
    return { held: w.weapons.current.id, ads: wp.state.ads, reloading: wp.state.reloading };
  }, { which, state });
  const release = (which) => page.evaluate(async (w0) => {
    const w = window.__world, wp = w0 === 'crossbow' ? w.crossbow : w.weapons.get('rifle');
    w.game.stopLeft = 0; wp.adsHeld = false; if (w0 === 'crossbow') wp.reloadScale = 1; else wp.freezeCycle = null;
    await new Promise((resolve) => { setTimeout(resolve, 1600); });
  }, which);
  const showHands = (which, on) => page.evaluate(async ({ w0, on: o }) => {
    const w = window.__world, wp = w0 === 'crossbow' ? w.crossbow : w.weapons.get('rifle');
    wp.hands.group.visible = o;
    await new Promise((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(resolve); }); });
  }, { w0: which, on });
  const measure = (which) => page.evaluate(async (w0) => {
    const w = window.__world, g = w.game, r = g.renderer, gl = r.getContext(), wp = w0 === 'crossbow' ? w.crossbow : w.weapons.get('rifle');
    const px = new Uint8Array(4);
    const draw = () => { g.composer.render(1 / 30); };
    const sync = () => { r.setRenderTarget(null); r.setScissor(0, 0, 1, 1); r.setScissorTest(true); r.clear(true, false, false); r.setScissorTest(false); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    const gate = g.frameGate; g.frameGate = () => false;
    const set = (on) => { wp.hands.group.visible = on; };
    const info = () => { r.info.autoReset = false; r.info.reset(); draw(); const c = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; return c; };
    set(true); const a = info(); set(false); const b = info(); set(true);
    const thr = (k) => { draw(); sync(); const t0 = performance.now(); for (let i = 0; i < k; i++) draw(); sync(); return (performance.now() - t0) / k; };
    const on = [], off = [];
    for (let round = 0; round < 7; round++) { set(true); on.push(thr(12)); set(false); off.push(thr(12)); await new Promise((resolve) => { setTimeout(resolve, 30); }); }
    set(true); g.frameGate = gate;
    const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
    return { calls: a.calls - b.calls, tris: a.tris - b.tris, frameCalls: a.calls, frameTris: a.tris, gpuMsWith: Number(med(on).toFixed(3)), gpuMsWithout: Number(med(off).toFixed(3)), gpuMsHands: Number((med(on) - med(off)).toFixed(3)), geometry: wp.handsCost, buffer: [r.domElement.width, r.domElement.height] };
  }, which);

  for (const [which, list] of Object.entries(POSES).filter(([w]) => WEAPONS.includes(w))) {
    for (const state of list) {
      const info = await pose(which, state);
      for (const [tag, on] of [['a', false], ['b', true]]) {
        await showHands(which, on);
        const f = resolvePath(OUT, `${TAG}-${which}-${state}-${tag}.jpg`);
        writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 88 }));
        console.log(f, JSON.stringify(info));
      }
      measures[`${which}-${state}`] = await measure(which);
      console.log(which, state, JSON.stringify(measures[`${which}-${state}`]));
      writeFileSync(resolvePath(OUT, `${TAG}-measure.json`), JSON.stringify(measures, null, 1));
      await release(which);
    }
  }
} finally {
  await browser.close();
}
