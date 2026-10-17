#!/usr/bin/env node
// Isolated rendering of the actual camera-held hierarchy and original lights, excluding animated world geometry.
// Six actual held presentations per shard/tier: rest, light/heavy phases and secondary/caught deformation.
// scripts/browser-lane.sh node scripts/proof-held-recipes.mjs --url=<preview> --out=<directory>
// scripts/browser-lane.sh node scripts/proof-held-recipes.mjs --compare=<before.json>,<after.json>
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ssim } from './parity/ssim.mjs';
import { isDeepStrictEqual } from 'node:util';
import { installInit } from './parity/init.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const compare = arg('compare');
if (compare !== undefined) {
  const [before, after] = compare.split(',').map(file => JSON.parse(readFileSync(file, 'utf8')));
  let same = before.rows.length === after.rows.length && before.errors.length === 0 && after.errors.length === 0;
  const imageBrowser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const imagePage = await imageBrowser.newPage();
  const image = row => execFileSync('magick', ['-size', `${row.width}x${row.height}`, '-depth', '8', `rgba:${row.raw}`, 'png:-']).toString('base64');
  let minimumSsim = 1;
  try {
  for (const [index, row] of before.rows.entries()) {
    const other = after.rows[index];
    const { pixels: beforeHash, raw: beforeRaw, ...shape } = row;
    const { pixels: afterHash, raw: afterRaw, ...otherShape } = other ?? {};
    if (!isDeepStrictEqual(shape, otherShape)) same = false;
    if (beforeHash !== afterHash) {
      const a = readFileSync(beforeRaw), b = readFileSync(afterRaw);
      let maxDelta = 0, changed = 0;
      if (a.length !== b.length) same = false;
      for (let byte = 0; byte < a.length; byte++) {
        const delta = Math.abs(a[byte] - b[byte]); maxDelta = Math.max(maxDelta, delta); changed += Number(delta > 0);
      }
      console.log(`${row.slug}/${row.tier}/${row.pose}: ${changed} channels differ, max delta ${maxDelta}`);
      const score = await imagePage.evaluate(ssim, { a: image(row), b: image(other) });
      const similarity = score.full; minimumSsim = Math.min(minimumSsim, similarity);
      console.log(`  SSIM ${similarity}`);
      if (similarity < 0.9995) same = false;
    }
  }
  } finally { await imageBrowser.close(); }
  console.log(`held-recipes: ${before.build} -> ${after.build}: ${same ? 'PASS' : 'DIFFERENT'} (${before.rows.length} poses, min SSIM ${minimumSsim}, floor .9995)`);
  const report = arg('report');
  if (report !== undefined) writeFileSync(report, `${JSON.stringify({ before: before.build, after: after.build, poses: before.rows.length, minimumSsim, floor: .9995, passed: same }, null, 2)}\n`);
  process.exit(same ? 0 : 1);
}
const url = arg('url'), out = arg('out');
if (url === undefined || out === undefined) throw new Error('--url and --out required');
mkdirSync(out, { recursive: true });
const version = await (await fetch(new URL('/version.json', url))).json(), rows = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  for (const [slug, ownerKey, weaponKey] of [['sunscar-dunes', 'sunscar', 'whip'], ['far-reach', 'farReach', 'fan']]) {
    for (const tier of ['phone', 'desktop']) {
      const context = await browser.newContext(tier === 'phone' ? { ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 }
        : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
      await installInit(context, { lane: 'held-recipes', sha: version.build, browser: 'chromium', capture: 30, tier });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
      await page.goto(new URL(`/?chunk=${slug}&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}`, url).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(({ owner, name }) => window.__wildshard?.shard?.[owner]?.[name]?.model !== undefined
        && !document.querySelector('.ws-load'), { owner: ownerKey, name: weaponKey }, { timeout: 400000 });
      for (let poseIndex = 0; poseIndex < 6; poseIndex++) {
        const shot = await page.evaluate(async ({ owner, name, pose }) => {
          const w = window.__wildshard, plugin = w.shard[owner], weapon = plugin[name], playback = weapon.presentation;
          const recipe = plugin.runtimeRows.melee.recipe, tip = recipe.tip ?? [0, 0, 0];
          const g = w.world.game, renderer = g.renderer, camera = g.camera, scene = g.rootScene ?? g.scene;
          g.frameGate = () => false;
          if (playback.time > 10) throw new Error('Held proof clock passed its pin');
          playback.beginFrame(10 - playback.time);
          const values = { phase: [1, .25, .7, .25, .7, .5][pose], charge: 0, spring: 0, holster: 0, stowed: 0,
            ext: [0, .25, 1, 1, 1, 1][pose], slack: [0, 0, 0, .5, 1, 0][pose],
            tipX: tip[0], tipY: tip[1], tipZ: tip[2],
            gripX: 0, gripY: 0, gripZ: 0, modelX: weapon.model.position.x, modelY: weapon.model.position.y, reach: recipe.phases.reach?.[0] ?? 0, taut: Number(pose === 5), caughtX: 0, caughtY: 1, caughtZ: -4 };
          if (name === 'fan') playback.apply(pose === 5 ? 'gust' : pose >= 3 ? 'heavy' : 'swing', values);
          else {
            playback.apply('root', values); playback.apply(pose === 0 ? 'rest' : 'active', values);
            playback.part('coil').visible = pose === 0; playback.part('cord').visible = pose !== 0;
            if (pose !== 0) {
              const grip = playback.part('grip').position; values.gripX = grip.x; values.gripY = grip.y; values.gripZ = grip.z;
              playback.apply('cord', values);
            }
          }
          weapon.model.updateWorldMatrix(true, true);
          const heldScene = scene.clone(false), heldCamera = camera.clone(true);
          heldScene.add(heldCamera);
          scene.traverse(part => {
            if (part.isLight === true) {
              const light = part.clone(false); part.updateWorldMatrix(true, false);
              part.matrixWorld.decompose(light.position, light.quaternion, light.scale); heldScene.add(light);
            }
          });
          renderer.setRenderTarget(null); renderer.setScissorTest(false);
          const gl = renderer.getContext(), ratio = renderer.getPixelRatio();
          renderer.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
          renderer.clear(true, true, true); renderer.render(heldScene, heldCamera);
          renderer.info.reset(); renderer.clear(true, true, true); renderer.render(heldScene, heldCamera);
          const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
          const parts = []; weapon.model.traverse(part => { parts.push({ name: part.name, visible: part.visible, matrix: part.matrix.toArray() }); });
          let data = ''; for (let index = 0; index < pixels.length; index += 0x8000) data += String.fromCodePoint(...pixels.subarray(index, index + 0x8000));
          return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, data: btoa(data), pixels: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''), parts,
            calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
        }, { owner: ownerKey, name: weaponKey, pose: poseIndex });
        const { data, ...observation } = shot, raw = join(out, `${slug}-${tier}-${poseIndex}.rgba`);
        writeFileSync(raw, Buffer.from(data, 'base64'));
        rows.push({ slug, tier, pose: poseIndex, ...observation, raw });
      }
      console.log(`held-recipes: ${slug}/${tier}: 6 poses`);
      await context.close();
    }
  }
} finally { await browser.close(); }
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ build: version.build, rows, errors })}\n`);
if (errors.length > 0) throw new Error(errors.join('\n'));
