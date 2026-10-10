#!/usr/bin/env node
// SHARD-PLATFORM M3: Sky Reach's look, a base build against a candidate on identical world pixels (modelled on
// scripts/proof-sky-look-parity.mjs). One run captures one served build: per tier (phone, desktop), six poses round the
// archipelago (Sunrest toward the low sun and the crown, Sunrest east and back, the windmill isle down onto the cloud sea,
// the storm crown, the roost), each a plain scene render (no post) with every material's time and cloud time at 10 and the sun shafts' pulse at 1, the
// viewmodel hidden, read back whole and hashed, with the render's draws and triangles; the WebGL allocation census's total
// GPU bytes; the linked program count and a hash of every shader source the page compiled; any shader compile error;
// every registered piece's colliders, hashed. The harness init pins Math.random (scripts/parity/init.mjs), so the
// session's seeded choices repeat. Creatures keep moving between captures, so two runs of one build can differ by a few
// hundred pixels: `--raw=<dir>` keeps each frame's RGBA so `--compare` can count the differing pixels.
//   scripts/browser-lane.sh node scripts/proof-sky-look-parity.mjs --url=<preview> --output=<summary.json> [--raw=<dir>]
//   node scripts/proof-sky-look-parity.mjs --compare=<base.json>,<candidate.json>
import { chromium, devices } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installInit } from './parity/init.mjs';

/** yaw 0 looks south (−z, toward the low sun and the crown), +π/2 east (−x); x / y / z in metres (y a little over the deck:
 *  the spawn drops onto it) */
const POSES = [
  { id: 'sunrest-sun', x: 0, y: 31, z: 3, yaw: 0, pitch: 0.02 },
  { id: 'sunrest-east', x: 0, y: 31, z: 3, yaw: Math.PI / 2, pitch: -0.1 },
  { id: 'sunrest-back', x: 0, y: 31, z: 3, yaw: Math.PI, pitch: -0.15 },
  { id: 'windmill-sea', x: 6, y: 31, z: -60, yaw: -Math.PI / 2, pitch: -0.35 },
  { id: 'crown', x: 0, y: 45, z: -190, yaw: Math.PI, pitch: 0 },
  { id: 'roost', x: 60, y: 35, z: -12, yaw: Math.PI / 4, pitch: -0.2 },
];

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const compare = arg('compare');
if (compare !== undefined) {
  const [a, b] = compare.split(',').map(path => JSON.parse(readFileSync(path, 'utf8')));
  const diffs = [];
  for (const [i, row] of a.rows.entries()) {
    const other = b.rows[i];
    for (const key of ['tier', 'pose', 'calls', 'triangles', 'width', 'height']) if (row[key] !== other?.[key]) diffs.push(`${row.tier}/${row.pose}: ${key} ${row[key]} ≠ ${other?.[key]}`);
    if (row.pixels !== other?.pixels) {
      // the differing pixel count when both runs kept their frames
      const fa = row.raw === undefined ? null : row.raw, fb = other?.raw ?? null;
      if (fa !== null && fb !== null && existsSync(fa) && existsSync(fb)) {
        const pa = readFileSync(fa), pb = readFileSync(fb);
        let n = 0;
        for (let p = 0; p < pa.length; p += 4) if (pa[p] !== pb[p] || pa[p + 1] !== pb[p + 1] || pa[p + 2] !== pb[p + 2]) n++;
        console.log(`${row.tier}/${row.pose}: ${n} of ${pa.length / 4} pixels differ`);
      } else diffs.push(`${row.tier}/${row.pose}: pixels differ`);
    }
  }
  for (const key of ['gpuBytes', 'colliders', 'pieces', 'colliderCount', 'programs', 'shaders']) for (const tier of Object.keys(a.tiers)) if (a.tiers[tier][key] !== b.tiers[tier]?.[key]) diffs.push(`${tier}: ${key} ${a.tiers[tier][key]} ≠ ${b.tiers[tier]?.[key]}`);
  console.log(diffs.length === 0 ? `sky-look-parity: ${a.build} = ${b.build} on ${a.rows.length} poses (draws, triangles), GPU bytes, programs, shader sources and colliders` : diffs.join('\n'));
  process.exit(diffs.length === 0 ? 0 : 1);
}
const url = arg('url'), output = arg('output'), raw = arg('raw');
if (url === undefined || output === undefined) throw new Error('Requires --url=<DEVSERVER preview> --output=<summary.json> (or --compare=a,b)');
if (raw !== undefined) mkdirSync(raw, { recursive: true });
const version = await (await fetch(new URL('/version.json', url))).json();
const sleep = ms => new Promise(resolve => { setTimeout(resolve, ms); });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rows = [], tiers = {}, errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  for (const tier of ['phone', 'desktop']) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
    await installInit(context, { lane: 'sky-look-parity', sha: version.build, browser: 'chromium', tier });
    // every shader source the page compiles, hashed (a byte that moved in any program shows here)
    await context.addInitScript(() => {
      const seen = new Set();
      window.__slpShaders = seen;
      for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
        const original = Reflect.get(proto, 'shaderSource');
        proto.shaderSource = function shaderSource(shader, source) { seen.add(source); Reflect.apply(original, this, [shader, source]); };
      }
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error' && /Shader Error|Program Info Log|WebGLProgram/u.test(message.text())) errors.push(message.text().slice(0, 400)); });
    await page.goto(new URL(`/?chunk=far-reach&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}`, url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const w = window.__wildshard?.world;
      return (w?.animals?.animals?.length ?? 0) > 0 && w?.game?.app?.physics !== undefined && !document.querySelector('.ws-load');
    }, undefined, { timeout: 400000, polling: 1000 });
    await sleep(4000);
    tiers[tier] = await page.evaluate(() => {
      const w = window.__wildshard.world, pieces = w.game.app.registry.pieceList();
      const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
      const list = pieces.filter(p => (p.colliders?.length ?? 0) > 0).map(p => ({ id: p.id, active: p.active?.() ?? true, surface: p.surface ?? null, owner: p.colliderOwner ?? null, colliders: copy(p.colliders) })).sort((a, b) => a.id.localeCompare(b.id));
      return { colliderJson: JSON.stringify(list), pieces: list.length, colliderCount: list.reduce((n, r) => n + r.colliders.length, 0) };
    });
    tiers[tier].colliders = sha(tiers[tier].colliderJson); delete tiers[tier].colliderJson;
    for (const p of POSES) {
      const { yaw, pitch } = p;
      await page.evaluate(() => { const g = window.__wildshard.world.game; if ('__slpGate' in window) g.frameGate = window.__slpGate; });
      await page.evaluate(a => {
        const w = window.__wildshard.world;
        w.player.spawn(a.x, a.z, a.yaw, a.y); w.player.pitch = a.pitch;
      }, { x: p.x, y: p.y, z: p.z, yaw, pitch });
      await sleep(5000);
      await page.evaluate(() => { const g = window.__wildshard.world.game; if (!('__slpGate' in window)) window.__slpGate = g.frameGate; g.frameGate = () => false; });
      await sleep(300);
      const shot = await page.evaluate(async v => {
        const w = window.__wildshard.world, g = w.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene, cam = g.camera;
        // the camera at the player's eye where the spawn put it, looking along the pose (yaw 0 = south, −z; +π/2 = east, −x)
        const at = w.player.position, cp = Math.cos(v.pitch);
        cam.position.set(at.x, at.y + 1.62, at.z); cam.up.set(0, 1, 0);
        cam.lookAt(at.x - Math.sin(v.yaw) * cp * 20, at.y + 1.62 + Math.sin(v.pitch) * 20, at.z - Math.cos(v.yaw) * cp * 20); cam.updateMatrixWorld(true);
        const hidden = [];
        for (const child of cam.children) if (child.visible) { child.visible = false; hidden.push(child); }
        scene.traverse(o => {
          for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
            const u = m.uniforms;
            if (u?.uTime !== undefined && typeof u.uTime.value === 'number') u.uTime.value = 10;
            if (u?.time !== undefined && typeof u.time.value === 'number') u.time.value = 10;
            if (u?.uCloudTime !== undefined && typeof u.uCloudTime.value === 'number') u.uCloudTime.value = 10;
            // the sun shafts' slow pulse (look time), held at full
            if (u?.uPulse !== undefined && typeof u.uPulse.value === 'number') u.uPulse.value = 1;
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
        let bin = ''; for (let i = 0; i < pixels.length; i += 0x8000) bin += String.fromCodePoint(...pixels.subarray(i, i + 0x8000));
        return { player: [Math.round(at.x * 10) / 10, Math.round(at.y * 10) / 10, Math.round(at.z * 10) / 10], width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, calls, triangles, lit, pixels: Array.from(digest, x => x.toString(16).padStart(2, '0')).join(''), data: btoa(bin) };
      }, { yaw, pitch });
      const row = { tier, pose: p.id, player: shot.player, width: shot.width, height: shot.height, calls: shot.calls, triangles: shot.triangles, lit: shot.lit, pixels: shot.pixels };
      if (raw !== undefined) { row.raw = join(raw, `${tier}-${p.id}.rgba`); writeFileSync(row.raw, Buffer.from(shot.data, 'base64')); }
      rows.push(row);
      console.log(`${tier} ${p.id} at ${shot.player.join(',')}: ${shot.calls} draws, ${shot.triangles} triangles, ${shot.lit} lit pixels`);
    }
    tiers[tier].gpuBytes = await page.evaluate(() => window.__sc_gl().reduce((n, row) => n + row.totalBytes, 0));
    tiers[tier].programs = await page.evaluate(() => window.__wildshard.world.game.renderer.info.programs?.length ?? -1);
    const sources = await page.evaluate(() => [...window.__slpShaders].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    tiers[tier].shaderCount = sources.length;
    tiers[tier].shaders = sha(sources.join('\u0000'));
    await context.close();
  }
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / DPR2 / Metal; plain scene render, time and cloud time 10, sun-shaft pulse 1, viewmodel hidden', tiers, rows }, null, 2)}\n`);
} finally { await browser.close(); }
