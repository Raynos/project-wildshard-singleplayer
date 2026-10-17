#!/usr/bin/env node
// G285: Nine Dragon's layout bake, HEAD against a candidate on identical world pixels. One run captures one served build:
// per tier (phone, desktop), the three standing mockup poses (A spawn rail, B Well edge, C stair-street), each a plain
// scene render (no post) at one frozen time with the movers and the viewmodel hidden, read back whole and hashed, with the
// render's draws and triangles; the WebGL allocation census's total GPU bytes; the linked program count and any shader
// compile error; every registered piece's colliders, hashed.
// `--compare=a.json,b.json` diffs two captures. Through browser-lane; only summary numbers are saved.
//   scripts/browser-lane.sh node scripts/proof-nine-layout-parity.mjs --url=<DEVSERVER preview> --output=<summary.json>
//   node scripts/proof-nine-layout-parity.mjs --compare=<base.json>,<candidate.json>
import { chromium, webkit, devices } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { MOCKUP_CAMERAS } from '../src/shards/nine-dragon-stack/mockupCameras.ts';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const compare = arg('compare');
if (compare !== undefined) {
  const [a, b] = compare.split(',').map(path => JSON.parse(readFileSync(path, 'utf8')));
  const diffs = [];
  for (const [i, row] of a.rows.entries()) {
    const other = b.rows[i];
    for (const key of ['tier', 'pose', 'pixels', 'calls', 'triangles', 'width', 'height']) if (row[key] !== other?.[key]) diffs.push(`${row.tier}/${row.pose}: ${key} ${row[key]} ≠ ${other?.[key]}`);
  }
  for (const key of ['gpuBytes', 'colliders', 'pieces', 'colliderCount', 'programs']) for (const tier of Object.keys(a.tiers)) if (a.tiers[tier][key] !== b.tiers[tier]?.[key]) diffs.push(`${tier}: ${key} ${a.tiers[tier][key]} ≠ ${b.tiers[tier]?.[key]}`);
  // G433: memory is report-only. Weak backing-store observations are separate
  // from native resident memory, and WebKit cannot force collection.
  for (const tier of Object.keys(a.tiers)) console.log(`${tier}: observed CPU backing bytes ${a.tiers[tier].cpuBackingBytes} → ${b.tiers[tier]?.cpuBackingBytes}`);
  console.log(diffs.length === 0 ? `nine-layout-parity: ${a.build} = ${b.build} on ${a.rows.length} poses (pixels, draws, triangles), GPU bytes and colliders` : diffs.join('\n'));
  process.exit(diffs.length === 0 ? 0 : 1);
}
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<DEVSERVER preview> --output=<summary.json> (or --compare=a,b)');
const version = await (await fetch(new URL('/version.json', url))).json();
const extended = process.argv.includes('--extended'), engine = arg('browser') ?? 'chromium', screens = arg('screens');
if (!['chromium', 'webkit'].includes(engine)) throw new Error('Nine proof supports chromium or webkit');
if (screens !== undefined) mkdirSync(screens, { recursive: true });
const poses = (extended ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C']).map(key => {
  const c = MOCKUP_CAMERAS[key], yaw = (c.yaw * Math.PI) / 180, pitch = (c.pitch * Math.PI) / 180;
  return { pose: key, eye: c.eye, look: [c.eye[0] + Math.sin(yaw) * Math.cos(pitch) * 20, c.eye[1] + Math.sin(pitch) * 20, c.eye[2] - Math.cos(yaw) * Math.cos(pitch) * 20] };
});
if (extended) poses.push(
  { pose: 'upper-stair', eye: [50, 143.68, 6], look: [80, 154, 6] },
  { pose: 'lower-well', eye: [-16, 92, 4], look: [-16, 96, -30] },
);
const signPoses = [
  { pose: 'sign-lightboxes', eye: [18, 128.1, -8.5], look: [18, 128, -18.25] },
  { pose: 'sign-plaque-paper', eye: [15.2, 127.1, -17.1], look: [15.2, 126.7, -20.13] },
];
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rows = [], tiers = {}, errors = [];
const browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  for (const tier of ['phone', 'desktop']) {
    const context = await browser.newContext(devices['iPhone 16 Pro']);
    await installInit(context, { lane: 'nine-layout-parity', sha: version.build, browser: engine, tier });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
    // a shader that fails to compile is a console error from three, not a page error
    page.on('console', message => { if (message.type() === 'error' && /Shader Error|Program Info Log|WebGLProgram/u.test(message.text())) errors.push(message.text().slice(0, 400)); });
    await page.goto(new URL(`/?chunk=nine-dragon-stack&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}`, url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__wildshard?.world?.chunk?.slug === 'nine-dragon-stack' && (window.__wildshard.world.game?.lastFrame?.calls ?? 0) > 60 && !document.querySelector('.ws-load'), undefined, { timeout: 400000, polling: 1000 });
    await sleep(4000);
    tiers[tier] = await page.evaluate(() => {
      const w = window.__wildshard.world, pieces = w.game.app.registry.pieceList();
      const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
      const list = pieces.filter(p => (p.colliders?.length ?? 0) > 0).map(p => ({ id: p.id, active: p.active?.() ?? true, surface: p.surface ?? null, owner: p.colliderOwner ?? null, colliders: copy(p.colliders) })).sort((a, b) => a.id.localeCompare(b.id));
      window.__ndp = { pose: null };
      w.game.onLate(() => {
        const p = window.__ndp.pose, cam = w.game.camera;
        if (!p) return;
        cam.position.set(p.eye[0], p.eye[1], p.eye[2]); cam.up.set(0, 1, 0); cam.lookAt(p.look[0], p.look[1], p.look[2]); cam.updateMatrixWorld(true);
      });
      w.freeCamera = true;
      return { colliderJson: JSON.stringify(list), pieces: list.length, colliderCount: list.reduce((n, r) => n + r.colliders.length, 0) };
    });
    tiers[tier].colliders = sha(tiers[tier].colliderJson); delete tiers[tier].colliderJson;
    for (const p of extended && tier === 'phone' ? poses.concat(signPoses) : poses) {
      await page.evaluate(() => { const g = window.__wildshard.world.game; if (window.__ndpGate !== undefined) g.frameGate = window.__ndpGate; });
      await page.evaluate(v => {
        const w = window.__wildshard.world;
        try { w.player.position.set(v.eye[0], Math.max(125, v.eye[1] - 1.62), v.eye[2]); w.player.velocity.set(0, 0, 0); } catch { /* a free camera without a body */ }
        window.__ndp.pose = v;
      }, p);
      await sleep(3000);
      await page.evaluate(() => { const g = window.__wildshard.world.game; window.__ndpGate ??= g.frameGate; g.frameGate = () => false; });
      await sleep(300);
      const shot = await page.evaluate(async v => {
        const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene, cam = g.camera;
        cam.position.set(v.eye[0], v.eye[1], v.eye[2]); cam.up.set(0, 1, 0); cam.lookAt(v.look[0], v.look[1], v.look[2]); cam.updateMatrixWorld(true);
        const hidden = [];
        for (const child of cam.children) if (child.visible) { child.visible = false; hidden.push(child); }
        scene.traverse(o => { if (o.name === 'movers' && o.visible) { o.visible = false; hidden.push(o); } });
        scene.traverse(o => {
          for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
            const u = m.uniforms;
            if (u?.uTime !== undefined && typeof u.uTime.value === 'number') u.uTime.value = 10;
            if (u?.time !== undefined && typeof u.time.value === 'number') u.time.value = 10;
          }
        });
        r.setRenderTarget(null); r.setScissorTest(false);
        const ratio = r.getPixelRatio(); r.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
        r.clear(true, true, true); r.render(scene, cam);
        r.info.reset(); r.clear(true, true, true); r.render(scene, cam);
        const calls = r.info.render.calls, triangles = r.info.render.triangles;
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        for (const o of hidden) o.visible = true;
        let lit = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 0) lit++;
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
        return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, calls, triangles, lit, pixels: Array.from(digest, x => x.toString(16).padStart(2, '0')).join('') };
      }, p);
      rows.push({ tier, pose: p.pose, width: shot.width, height: shot.height, calls: shot.calls, triangles: shot.triangles, lit: shot.lit, pixels: shot.pixels });
      if (screens !== undefined) await page.screenshot({ path: join(screens, `${tier}-${p.pose}.jpg`), type: 'jpeg', quality: 85 });
      console.log(`${tier} ${p.pose}: ${shot.calls} draws, ${shot.triangles} triangles, ${shot.lit} lit pixels`);
    }
    const census = await page.evaluate(() => window.__sc_gl().reduce((n, row) => n + row.totalBytes, 0));
    tiers[tier].gpuBytes = census;
    if (engine === 'chromium') {
      const memory = await context.newCDPSession(page);
      try { await memory.send('HeapProfiler.collectGarbage'); } finally { await memory.detach(); }
    }
    // The engine's scalar RAM projection counts observed backing stores, distinct from native process footprint.
    tiers[tier].cpuBackingBytes = await page.evaluate(() => window.__wildshard.memory?.().totals.ram ?? null);
    // the linked programs after the three poses (the renderer's cache: a split or merged program shows here)
    tiers[tier].programs = await page.evaluate(() => window.__wildshard.world.game.renderer.info.programs?.length ?? -1);
    await context.close();
  }
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: `iPhone 16 Pro / DPR3 / ${engine}; plain scene render, time 10, movers and viewmodel hidden`, tiers, rows }, null, 2)}\n`);
} finally { await browser.close(); }
