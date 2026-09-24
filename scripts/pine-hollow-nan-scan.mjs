#!/usr/bin/env node
// pine-hollow-nan-scan.mjs — the NaN sweep (PH-0.4, the E67 / E91 class: one NaN pixel that bloom smears into a black
// square). At every camera of a pine-hollow-views cameras JSON, render the plain scene (no post) into a FloatType target
// and count the non-finite channel values; on a hit, hide the scene's top-level children one at a time to name it.
//
//   node scripts/pine-hollow-nan-scan.mjs --url=http://localhost:4186 --tier=phone   # a vite preview of a clean export
//
// Validated by injecting NaN (a tree material's colour set to NaN reads 382 non-finite values at the gate). One muted
// headless Chromium on Metal, closed at the end.
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const url = flag('url', 'http://localhost:4186'), tier = flag('tier', 'phone');
const DEF = JSON.parse(readFileSync(resolvePath(ROOT, flag('cameras', 'art/pine-hollow/round-0-baseline/cameras.json')), 'utf8'));
const b = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal'] });
const ip = devices['iPhone 16 Pro'];
const ctxOpts = tier === 'phone'
  ? { userAgent: ip.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } }
  : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 };
const p = await (await b.newContext(ctxOpts)).newPage();
await p.goto(`${url}/?chunk=pine-hollow&mute=1&nolock=1&skipintro=1&sw=0&tier=${tier}${tier === 'phone' ? '&touch' : ''}&perf=0`);
await p.waitForFunction(() => Boolean(window.__world?.forest), undefined, { timeout: 300000 });
await p.evaluate(() => {
  const w = window.__world; w.animals.calm = true;
  window.__nan = { pose: null };
  w.game.onLate(() => {
    const c = window.__nan.pose; if (!c) return;
    const cam = w.game.camera; cam.position.set(c.pos[0], c.pos[1], c.pos[2]);
    if (c.up) cam.up.set(c.up[0], c.up[1], c.up[2]); else cam.up.set(0, 1, 0);
    cam.lookAt(c.look[0], c.look[1], c.look[2]); cam.up.set(0, 1, 0); cam.updateMatrixWorld(true);
  });
  window.__scan = () => {
    const g = w.game, r = g.renderer, W = 320, H = Math.round(320 * innerHeight / innerWidth);
    const RT = g.composer.inputBuffer.constructor;
    const rt = window.__nanRT ??= new RT(W, H, { type: 1015 }); // FloatType
    const count = () => {
      const prev = r.getRenderTarget(); r.setRenderTarget(rt); r.render(g.scene, g.camera); r.setRenderTarget(prev);
      const px = new Float32Array(W * H * 4); r.readRenderTargetPixels(rt, 0, 0, W, H, px);
      let n = 0; for (let i = 0; i < px.length; i++) if (!Number.isFinite(px[i])) n++;
      return n;
    };
    const total = count();
    const culprits = [];
    if (total > 0) for (const ch of g.scene.children) {
      if (!ch.visible) continue;
      ch.visible = false; const n = count(); ch.visible = true;
      if (n < total) culprits.push(`${ch.name === "" ? ch.type : ch.name}:${total - n}`);
    }
    return { total, culprits };
  };
});
await new Promise((resolve) => { setTimeout(resolve, 6000); });
let hits = 0, shots = 0;
for (const a of DEF.anchors) for (const c of a.cameras) {
  await p.evaluate((cc) => {
    const w = window.__world;
    if (cc.mode === 'god') { w.player.spawn(cc.look[0], cc.look[2], 0); w.freeCamera = true; window.__nan.pose = cc; }
    else { window.__nan.pose = null; w.freeCamera = false; w.player.spawn(cc.x, cc.z, cc.yaw); w.player.pitch = cc.pitch; }
  }, c);
  await new Promise((resolve) => { setTimeout(resolve, 2500); });
  const res = await p.evaluate(() => window.__scan());
  shots++;
  if (res.total > 0) { hits++; console.log(`${a.id} ${c.n} ${c.id}: ${res.total} non-finite · ${res.culprits.join(' ')}`); }
}
console.log(`${tier}: ${shots} cameras, ${hits} with non-finite pixels`);
await b.close();
