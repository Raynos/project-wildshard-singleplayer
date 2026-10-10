#!/usr/bin/env node
// G262: numeric original/baked comparisons on the actual cove, its native materials and frozen animated pools.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { originalCove } from './bake/driftwoodCove.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<candidate preview> --output=<summary.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const sources = {}, original = originalCove();
for (const [name, geometry] of Object.entries(original.geometry)) {
  const index = geometry.getIndex();
  sources[name] = { index: index === null ? null : Array.from(index.array),
    attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }])) };
  geometry.dispose();
}
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'cove-parity', sha: version.build, browser: 'chromium', tier: 'phone' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.registry?.get('cove') !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const rows = await page.evaluate(inputs => {
    const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene;
    const cove = g.app.registry.get('cove').object, [structure, rocks, glow, pools] = cove.children;
    if (!structure?.isMesh || rocks?.name !== 'cove-rocks' || glow?.name !== 'cove-glow' || !pools?.isMesh) throw new Error('Actual cove mesh order changed');
    const views = {
      structure: { mesh: structure, eyes: [[142, 5, 7], [142, 1.8, 16.5], [142, 2.6, 21.5]], aims: [[142, 2, 16], [142, 1.7, 19.2], [142, 2.5, 23.3]] },
      rocks: { mesh: rocks, eyes: [[130, 2, 1], [121, 5, 20], [133, 2, -12]], aims: [[130, 0.6, 4], [123, 2, 21], [133, 0.5, -8]] },
      glow: { mesh: glow, eyes: [[142, 1.8, 17], [142, 2.6, 21.5], [142, 1.8, 18.2]], aims: [[144.5, 2.2, 17.5], [142, 2.3, 22.8], [139.6, 1.1, 18.1]] },
      pools: { mesh: pools, eyes: [[130, 3, 1], [133, 3, -11], [140.7, 1.8, 15.7]], aims: [[130, 0.3, 4], [133, 0.2, -8], [140.7, 0.4, 16.7]] },
    };
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
    const results = [], originals = [];
    try {
      for (const [part, { mesh, eyes, aims }] of Object.entries(views)) {
        const baked = mesh.geometry, old = baked.clone(), source = inputs[part];
        for (const [key, attribute] of Object.entries(source.attributes)) {
          const resident = baked.getAttribute(key);
          if (resident.count * resident.itemSize !== attribute.array.length || resident.itemSize !== attribute.itemSize || resident.normalized !== attribute.normalized) throw new Error(`Attribute layout differs: ${part}:${key}`);
          const Attribute = resident.constructor, ArrayType = resident.array.constructor;
          old.setAttribute(key, new Attribute(new ArrayType(attribute.array), attribute.itemSize, attribute.normalized));
        }
        const residentIndex = baked.getIndex();
        if (source.index === null) old.setIndex(null);
        else {
          if (residentIndex === null || residentIndex.count !== source.index.length) throw new Error('Native pool index layout differs');
          const Attribute = residentIndex.constructor, ArrayType = residentIndex.array.constructor;
          old.setIndex(new Attribute(new ArrayType(source.index), 1));
        }
        old.computeBoundingBox(); old.computeBoundingSphere(); originals.push({ mesh, baked, old });
        for (const [pose, eye] of eyes.entries()) {
          g.camera.position.set(...eye); g.camera.lookAt(...aims[pose]); g.camera.updateMatrixWorld(true);
          mesh.geometry = old; frame(); const before = frame();
          mesh.geometry = baked; frame(); const after = frame();
          const visible = mesh.visible; mesh.visible = false; const absent = frame(); mesh.visible = visible;
          const result = { part, pose, eye, aim: aims[pose], width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, ...difference(before, after), visiblePixels: difference(after, absent).changedPixels };
          if (result.visiblePixels < 20 || result.changedPixels !== 0) throw new Error(`Cove pixel parity failed: ${JSON.stringify(result)}`);
          results.push(result);
        }
      }
    } finally {
      for (const item of originals) { item.mesh.geometry = item.baked; item.old.dispose(); }
      for (const child of hidden) child.visible = true;
      g.camera.position.copy(cameraPosition); g.camera.quaternion.copy(cameraRotation); g.shardFrame();
    }
    return results;
  }, sources);
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / Metal', method: 'original versus baked geometry on the actual cove; native materials, pools, shadows, placement and frozen clock; exterior, cave floor and alcove views', rows }, null, 2)}\n`);
  console.log(`cove-parity: ${rows.length} visible native views, 0 changed pixels`);
  await context.close();
} finally { await browser.close(); }
