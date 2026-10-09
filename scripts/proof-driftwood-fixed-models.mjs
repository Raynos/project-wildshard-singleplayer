#!/usr/bin/env node
// G262: compare the original builder with the offline geometry on the actual placed meshes, at one frozen clock.
// Through browser-lane; only summary numbers are saved (pixel parity needs no board).
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { captainHatGeometry } from '../src/shards/driftwood-isle/generators/captainHat.ts';
import { chimeGeometry } from '../src/shards/driftwood-isle/generators/seaGlassChime.ts';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<candidate preview> --output=<summary.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const original = {};
for (const [name, geometry] of [['captain-hat', captainHatGeometry()], ['sea-glass-chime', chimeGeometry().geometry]]) {
  original[name] = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }]));
  geometry.dispose();
}
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'fixed-model-parity', sha: version.build, browser: 'chromium', tier: 'phone' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.debug.snapshot()['driftwood.keepsakes']?.chime !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const rows = await page.evaluate(sources => {
    const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene;
    const keepsakes = g.app.debug.snapshot()['driftwood.keepsakes'];
    keepsakes.drop('captain-hat');
    const hat = scene.getObjectByName('captain-hat'), chime = keepsakes.chime;
    if (!hat?.isMesh || !chime?.isMesh) throw new Error('Actual hat/chime mesh is missing');
    const cameraPosition = g.camera.position.clone(), cameraRotation = g.camera.quaternion.clone();
    const hidden = g.camera.children.filter(child => child.visible);
    for (const child of hidden) child.visible = false;
    const frame = () => {
      g.shardFrame(); r.setRenderTarget(null); r.setScissorTest(false);
      const ratio = r.getPixelRatio(); r.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
      r.clear(true, true, true); r.render(scene, g.camera);
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const difference = (before, after) => {
      let changedPixels = 0, maxChannelDifference = 0;
      for (let i = 0; i < before.length; i += 4) {
        let changed = false;
        for (let c = 0; c < 4; c++) { const d = Math.abs(before[i + c] - after[i + c]); if (d > 0) changed = true; maxChannelDifference = Math.max(maxChannelDifference, d); }
        if (changed) changedPixels++;
      }
      return { changedPixels, maxChannelDifference };
    };
    const results = [];
    try {
      for (const mesh of [hat, chime]) {
        for (const count of mesh === chime ? [0, 5, 10, 15] : [null]) {
          if (count !== null) chime.setCount(count);
          const baked = mesh.geometry, old = baked.clone();
          for (const [key, attribute] of Object.entries(sources[mesh.name])) {
            const restored = baked.getAttribute(key).clone();
            restored.array.set(attribute.array); restored.needsUpdate = true;
            if (restored.itemSize !== attribute.itemSize || restored.normalized !== attribute.normalized) throw new Error(`Attribute layout differs: ${mesh.name}:${key}`);
            old.setAttribute(key, restored);
          }
          old.computeBoundingBox(); old.computeBoundingSphere();
          mesh.updateWorldMatrix(true, false);
          for (const side of [-1, 1]) {
            const centre = g.camera.position.clone().set(0, mesh === chime ? (count === 0 ? -0.15 : -0.55) : 0, 0).applyMatrix4(mesh.matrixWorld);
            const eye = g.camera.position.clone().set(side * 0.3, mesh === chime ? -1.5 : 0.3, mesh === chime ? -1.8 : side).applyMatrix4(mesh.matrixWorld);
            g.camera.position.copy(eye); g.camera.lookAt(centre); g.camera.updateMatrixWorld(true);
            mesh.geometry = old; frame(); const before = frame();
            mesh.geometry = baked; frame(); const after = frame();
            mesh.visible = false; const absent = frame(); mesh.visible = true;
            const result = { model: mesh.name, count, side, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, vertices: baked.getAttribute('position').count, ...difference(before, after), visiblePixels: difference(after, absent).changedPixels };
            if (result.visiblePixels < 20 || result.changedPixels !== 0) throw new Error(`Fixed-model pixel parity failed: ${JSON.stringify({ ...result, drawRange: baked.drawRange, indexCount: baked.index?.count, camera: g.camera.position.toArray(), world: mesh.matrixWorld.elements.slice(12, 15), visible: mesh.visible })}`);
            results.push(result);
          }
          mesh.geometry = baked; old.dispose();
        }
      }
    } finally {
      for (const child of hidden) child.visible = true;
      g.camera.position.copy(cameraPosition); g.camera.quaternion.copy(cameraRotation); g.shardFrame();
    }
    return results;
  }, original);
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  const result = { build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / Metal', method: 'original and baked geometry on actual native meshes; identical runtime materials, transforms and frozen clock', rows };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`fixed-model-parity: ${rows.length} visible native poses, 0 changed pixels`);
  await context.close();
} finally { await browser.close(); }
