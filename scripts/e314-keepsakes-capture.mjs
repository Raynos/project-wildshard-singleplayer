#!/usr/bin/env node
// e314-keepsakes-capture.mjs — E314 stage 3 evidence: Driftwood's keepsakes and the body shadow on an iPhone 16 Pro
// portrait (402 × 874 at 3×, touch, phone tier, muted, Metal), and what the body shadow costs.
//
//   scripts/browser-lane.sh node scripts/e314-keepsakes-capture.mjs --url=<build> --out=<dir> [--scenes=…] [--measure]
//
// scenes (in this order, on one fresh save; each writes <out>/<scene>.jpg):
//   chime       the sea glass chime left of Wendell's door at 0 → the charm I toast → 5 → 15 pieces (chime-0 / toast / chime-5 / chime-15)
//   drops       on open sand: the bear claw and the boar tusk dropped as a kill drops them (drop-claw / drop-tusk), then taken (take-claw)
//   plaques     from the hut's doorway, the back wall's plaques filled (plaques)
//   hat         the captain's hat's drop (drop-hat), taken and worn (take-hat), in the Bag's GEAR tab (gear)
//   shadow      golden hour, the sun behind you, looking down: the body shadow bare (shadow-bare), with the hat + cape
//               (shadow-dressed), walking (shadow-walk), and the held sword under it (shadow-sword)
//   night       charm III's glow on the wooden sword and the iron one (night-wood / night-iron)
//   hides       the body shown / hidden for swim · hover · carried (zipline) · ride · practice room (logged, no image)
// --measure (in `shadow`): the body shadow's draws / triangles (renderer.info, shown vs hidden, the same frame), split main
//   pass vs shadow pass (the shadow map's autoUpdate off), and its GPU ms (the frame drawn 12× back to back with one real
//   sync, shown vs hidden alternating, the median difference; scripts/e334-fp-capture.mjs's method) → <out>/measure.json.
// The HUD stays on (the toasts and the chip are part of the evidence). Run it inside scripts/browser-lane.sh.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4405');
const OUT = resolvePath(flag('out', '/tmp/e314-s3'));
const SCENES = flag('scenes', 'chime,drops,plaques,hat,shadow,night,hides').split(',').filter((x) => x !== '');
const MEASURE = argv.includes('--measure');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const measures = {};

const ID = 'chunk://local/driftwood-isle';
const seed = { 'ws.flags.v1': { [ID]: ['talked:castaway', 'seen:pier', 'seen:hut'] } };

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await ctx.addInitScript((s) => { try { if (sessionStorage.getItem('e314s3') === null) { sessionStorage.setItem('e314s3', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); } } catch { /* */ } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(`${URL_BASE}/?chunk=driftwood-isle&mute=1&nolock=1&skipintro=1&touch=1&tier=phone`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__world?.player !== undefined && window.__keepsakes !== undefined && !document.getElementById('hud')?.classList.contains('intro'), undefined, { timeout: 300000, polling: 1000 });
  await sleep(5000);
  const shot = async (name) => { const f = resolvePath(OUT, `${name}.jpg`); writeFileSync(f, await page.screenshot({ type: 'jpeg', quality: 86 })); console.log(f); };
  const time = (t) => page.evaluate((x) => { window.__world.sky.dayNight?.setTime(x); }, t);
  /** stand at hut-local (x, z), looking at hut-local (tx, ty over the floor, tz) */
  const hutView = (hx, hz, htx, hty, htz) => page.evaluate(({ x, z, tx, ty, tz }) => {
    const adv = window.__adventure, p = window.__world.player;
    const a = adv.place({ poi: 'hut', x, z }), b = adv.place({ poi: 'hut', x: tx, z: tz });
    const floor = adv.place({ poi: 'hut', anchor: 'hut.door', x: 0, z: -2.7 }).y;
    p.spawn(a.x, a.z, Math.atan2(-(b.x - a.x), -(b.z - a.z)));
    p.velocity.set(0, 0, 0); p.keys?.clear();
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    return new Promise((resolve) => { setTimeout(() => { p.pitch = Math.atan2(floor + ty - (p.position.y + 1.68), d); resolve({ at: [a.x, a.z], d }); }, 400); });
  }, { x: hx, z: hz, tx: htx, ty: hty, tz: htz });
  /** open sand: one fixed spot west of the hut, facing away from the sun (the body's shadow ahead) */
  const sand = () => page.evaluate(() => {
    const w = window.__world, p = w.player;
    const face = Math.atan2(w.sky.sunDir.x, w.sky.sunDir.z); // forward (−sin yaw, −cos yaw) = away from the sun: the shadow ahead
    p.spawn(-9.9, -57.3, face); // open sand and grass west of the hut, nothing built in front
    p.velocity.set(0, 0, 0); p.pitch = -0.5;
    return { at: [p.position.x, p.position.y, p.position.z] };
  });

  /** turn to the settled drop (a kill's toss lands it anywhere round you) and look down at it */
  const faceDrop = (id) => page.evaluate((k) => {
    const d = window.__keepsakes.drops.get(k), p = window.__world.player;
    if (!d) return false;
    const g = d.group.position, dx = g.x - p.position.x, dz = g.z - p.position.z, dist = Math.hypot(dx, dz);
    p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(g.y + 0.8 - (p.position.y + 1.68), dist);
    return Number(dist.toFixed(2));
  }, id);
  for (const scene of SCENES) {
    if (scene === 'chime') {
      await time('midday');
      await page.evaluate(() => { window.__keepsakes.glass(0); });
      console.log('chime wide', JSON.stringify(await hutView(1.2, -10.5, -0.6, 1.6, -2.86)));
      await sleep(1500); await shot('chime-wide');
      console.log('chime view', JSON.stringify(await hutView(-0.2, -6.3, -1.05, 2.2, -2.86)));
      await sleep(1500); await shot('chime-0');
      await page.evaluate(() => { window.__keepsakes.glass(4); });
      await sleep(3200); // the adventure's own "Sea glass · 4 / 15" toast clears
      await page.evaluate(() => { window.__keepsakes.glass(5); });
      await sleep(1700); await shot('toast');
      await sleep(3500); await shot('chime-5');
      await page.evaluate(() => { window.__keepsakes.glass(15); });
      await sleep(7500); await shot('chime-15');
      console.log('owned', JSON.stringify(await page.evaluate(() => window.__loot.owned.all)), 'dodge scale', await page.evaluate(() => window.__world.player.dodgeCooldownScale));
      continue;
    }
    if (scene === 'drops') {
      await time('midday');
      console.log('sand', JSON.stringify(await sand()));
      await sleep(800);
      await page.evaluate(() => { const p = window.__world.player; p.pitch = -0.28; window.__keepsakes.drop('bear-claw'); });
      await sleep(2600); console.log('drop-claw at', await faceDrop('bear-claw')); await sleep(400); await shot('drop-claw');
      const took = await page.evaluate(async () => {
        const k = window.__keepsakes, p = window.__world.player, d = k.drops.get('bear-claw');
        if (!d) return 'gone';
        p.spawn(d.group.position.x, d.group.position.z + 0.3, p.yaw);
        await new Promise((resolve) => { setTimeout(resolve, 900); });
        return window.__loot.owned.has('bear-claw');
      });
      console.log('claw taken', took);
      await sleep(300); await shot('take-claw');
      await sleep(3500);
      await page.evaluate(() => { const p = window.__world.player; p.pitch = -0.28; window.__keepsakes.drop('boar-tusk'); });
      await sleep(2600); console.log('drop-tusk at', await faceDrop('boar-tusk')); await sleep(400); await shot('drop-tusk');
      console.log('tusk taken', await page.evaluate(async () => {
        const k = window.__keepsakes, p = window.__world.player, d = k.drops.get('boar-tusk');
        if (!d) return 'gone';
        p.spawn(d.group.position.x, d.group.position.z + 0.3, p.yaw);
        await new Promise((resolve) => { setTimeout(resolve, 900); });
        return window.__loot.owned.has('boar-tusk');
      }));
      console.log('heavyMult', await page.evaluate(() => window.__world.crossbow.heavyMult));
      await sleep(3000);
      continue;
    }
    if (scene === 'plaques') {
      await time('midday');
      console.log('plaques view', JSON.stringify(await hutView(0, -3.4, 0.3, 1.28, 2.655)));
      await sleep(1500); await shot('plaques');
      continue;
    }
    if (scene === 'hat') {
      await time('midday');
      await sand(); await sleep(600);
      await page.evaluate(() => { const p = window.__world.player; p.pitch = -0.28; window.__keepsakes.drop('captain-hat'); });
      await sleep(2600); console.log('drop-hat at', await faceDrop('captain-hat')); await sleep(400); await shot('drop-hat');
      console.log('hat taken', await page.evaluate(async () => {
        const k = window.__keepsakes, p = window.__world.player, d = k.drops.get('captain-hat');
        if (!d) return 'gone';
        p.spawn(d.group.position.x, d.group.position.z + 0.3, p.yaw);
        await new Promise((resolve) => { setTimeout(resolve, 900); });
        return window.__loot.owned.worn('captain-hat');
      }));
      await sleep(300); await shot('take-hat');
      await sleep(3000);
      await page.evaluate(() => {
        const bag = document.querySelector('.ws-minimap-bag');
        if (!document.querySelector('.ws-gmenu.show')) bag?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        const b = [...document.querySelectorAll('.ws-gmenu-tab')].find((x) => x.dataset.tab === 'gear' && !x.hidden);
        b?.click();
      });
      await sleep(900); await shot('gear');
      await page.keyboard.press('Escape'); await sleep(300);
      await page.evaluate(() => { document.querySelector('.ws-gmenu-close, .ws-gmenu [data-close]')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); window.__world.hud.menu?.close?.(); });
      await sleep(600);
      continue;
    }
    if (scene === 'shadow') {
      await time('golden');
      console.log('sand', JSON.stringify(await sand()));
      await page.evaluate(() => { const o = window.__loot.owned; for (const id of ['captain-hat', 'cape']) if (o.worn(id)) o.toggleWorn(id); });
      await sleep(1500); await shot('shadow-bare');
      if (MEASURE) {
        await sleep(8000); // the time jump's shadow fade (shadowFade.ts ghosts) settles first
        measures.shadow = await page.evaluate(async () => {
          const w = window.__world, g = w.game, r = g.renderer, gl = r.getContext();
          const root = g.scene.getObjectByName('body-shadow-root');
          if (!root) return { error: 'no body-shadow-root' };
          const px = new Uint8Array(4);
          const draw = () => { g.composer.render(1 / 30); };
          const sync = () => { r.setRenderTarget(null); r.setScissor(0, 0, 1, 1); r.setScissorTest(true); r.clear(true, false, false); r.setScissorTest(false); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
          const gate = g.frameGate; g.frameGate = () => false;
          const set = (on) => { root.visible = on; };
          const info = () => { r.info.autoReset = false; r.info.reset(); if (r.shadowMap.autoUpdate) r.shadowMap.needsUpdate = true; draw(); const c = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; return c; };
          const auto = r.shadowMap.autoUpdate;
          set(true); const a = info(); set(false); const b = info();
          r.shadowMap.autoUpdate = false;
          set(true); const am = info(); set(false); const bm = info();
          r.shadowMap.autoUpdate = auto;
          const thr = (k) => { draw(); sync(); const t0 = performance.now(); for (let i = 0; i < k; i++) draw(); sync(); return (performance.now() - t0) / k; };
          const med = (xs) => { const s = [...xs].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
          const run = async () => { const on = [], off = []; for (let round = 0; round < 11; round++) { set(true); on.push(thr(12)); set(false); off.push(thr(12)); await new Promise((resolve) => { setTimeout(resolve, 30); }); } return { on: med(on), off: med(off) }; };
          const all = await run();
          r.shadowMap.autoUpdate = false; const main = await run(); r.shadowMap.autoUpdate = auto;
          set(true); g.frameGate = gate;
          const mainCalls = am.calls - bm.calls, mainTris = am.tris - bm.tris;
          return {
            calls: a.calls - b.calls, tris: a.tris - b.tris, mainPassCalls: mainCalls, shadowPassCalls: a.calls - b.calls - mainCalls, shadowPassTris: a.tris - b.tris - mainTris,
            frameCalls: a.calls, frameTris: a.tris,
            gpuMsWith: Number(all.on.toFixed(3)), gpuMsWithout: Number(all.off.toFixed(3)), gpuMsBody: Number((all.on - all.off).toFixed(3)),
            gpuMsBodyMainOnly: Number((main.on - main.off).toFixed(3)), gpuMsBodyShadowPass: Number((all.on - all.off - (main.on - main.off)).toFixed(3)),
            buffer: [r.domElement.width, r.domElement.height], shadowMap: r.shadowMap.enabled, cascades: 'phone 1 × 1024²',
            shadowMaps: (() => { let n = 0; g.scene.traverse((o) => { if (o.isLight && o.castShadow && o.shadow?.autoUpdate !== false) n++; }); return n; })(),
          };
        });
        console.log('measure bare', JSON.stringify(measures.shadow));
      }
      await page.evaluate(() => { const o = window.__loot.owned; o.grant('captain-hat'); o.grant('cape'); for (const id of ['captain-hat', 'cape']) if (!o.worn(id)) o.toggleWorn(id); });
      await sleep(1200); await shot('shadow-dressed');
      if (MEASURE) {
        measures.dressed = await page.evaluate(() => {
          const g = window.__world.game, r = g.renderer, root = g.scene.getObjectByName('body-shadow-root');
          if (!root) return null;
          const gate = g.frameGate; g.frameGate = () => false;
          const info = () => { r.info.autoReset = false; r.info.reset(); g.composer.render(1 / 30); const c = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; return c; };
          root.visible = true; const a = info(); root.visible = false; const b = info(); root.visible = true; g.frameGate = gate;
          return { calls: a.calls - b.calls, tris: a.tris - b.tris };
        });
        console.log('measure dressed', JSON.stringify(measures.dressed));
      }
      // walking: hold W a second, the shot mid-stride
      await page.keyboard.down('KeyW'); await sleep(1100); await shot('shadow-walk'); await page.keyboard.up('KeyW');
      await sleep(600);
      // the held sword under the body: the sun high behind, looking level (does the head's shadow fall on the blade)
      await time('midday');
      await page.evaluate(() => { const w = window.__world, p = w.player; p.yaw = Math.atan2(w.sky.sunDir.x, w.sky.sunDir.z); p.pitch = -0.05; });
      await sleep(1200); await shot('shadow-sword');
      console.log('sun (midday)', JSON.stringify(await page.evaluate(() => window.__world.sky.sunDir.toArray().map((v) => Number(v.toFixed(3))))));
      continue;
    }
    if (scene === 'night') {
      await page.evaluate(() => { window.__keepsakes.glass(15); });
      await time('night');
      await sand(); await sleep(400);
      await page.evaluate(() => { window.__world.player.pitch = -0.05; });
      await sleep(2500);
      console.log('glow', JSON.stringify(await page.evaluate(() => ({ night: window.__world.sky.night, glow: window.__world.crossbow.bladeGlow }))));
      await shot('night-wood');
      await page.evaluate(() => { const ws = window.__world.weapons; ws.unlock('sword-iron'); ws.select('sword-iron', true); });
      await sleep(2000); await shot('night-iron');
      await page.evaluate(() => { const ws = window.__world.weapons; ws.select(ws.available[0].id, true); });
      await time('midday');
      continue;
    }
    if (scene === 'hides') {
      const r = await page.evaluate(async () => {
        const w = window.__world, p = w.player, root = w.game.scene.getObjectByName('body-shadow-root');
        const frames = () => new Promise((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(null); }); }); });
        const out = { base: root?.visible };
        for (const [k, on, off] of [['carried', true, false]]) {
          p[k] = on; await frames(); out[k] = root?.visible; p[k] = off; await frames();
        }
        return out;
      });
      console.log('hides', JSON.stringify(r));
      continue;
    }
  }
  if (MEASURE) writeFileSync(resolvePath(OUT, 'measure.json'), JSON.stringify(measures, null, 1));
  if (errors.length > 0) console.log(`page errors: ${errors.slice(0, 6).join(' | ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
