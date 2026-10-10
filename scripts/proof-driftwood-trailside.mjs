#!/usr/bin/env node
// G262: numeric original/baked comparisons on the native trail, its material and shadows.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { originalTrailside } from './bake/driftwoodTrailside.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<candidate preview> --output=<summary.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const original = originalTrailside(), geometry = original.geometry;
if (geometry.getIndex() !== null) throw new Error('Original trail is no longer triangle soup');
const source = { attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key,
  { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }])) };
const vertexAt = (x, z) => {
  const position = geometry.getAttribute('position');
  let closest = 0, distance = Infinity;
  for (let i = 0; i < position.count; i++) {
    const next = Math.hypot(position.getX(i) - x, position.getZ(i) - z);
    if (next < distance) { closest = i; distance = next; }
  }
  return { x: position.getX(closest), y: position.getY(closest), z: position.getZ(closest) };
};
// The trestles are the weld's own geometry, rather than placed plank models: frame their actual vertices.
const flights = [{ name: 'lookout trestle', at: vertexAt(13.1, -18.2), lift: 0.2 },
  { name: 'shrine trestle', at: vertexAt(-56.85, -17.95), lift: 0.2 }];
geometry.dispose();
const nearest = (rows, x, z) => rows.reduce((a, b) => Math.hypot(a.x - x, a.z - z) <= Math.hypot(b.x - x, b.z - z) ? a : b);
// Aim at the actual source placement rows: signs, fence ropes and both trestle flights.
const targets = [
  ...original.metadata.signs.pls.map(row => ({ name: `sign ${row.x},${row.z}`, at: row, lift: 0.9 })),
  { name: 'plateau fence', at: nearest(original.metadata.posts.pls, -36, -128), lift: 0.8 },
  { name: 'shrine fence', at: nearest(original.metadata.posts.pls, -80, 45), lift: 0.8 },
  ...flights,
];
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'trailside-parity', sha: version.build, browser: 'chromium', tier: 'phone' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.registry?.get('trailside') !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const rows = await page.evaluate(inputs => {
    const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene;
    const mesh = g.app.registry.get('trailside').object;
    if (!mesh?.isMesh) throw new Error('Actual Trailside mesh missing');
    const baked = mesh.geometry, old = baked.clone();
    if (baked.getIndex() !== null || Object.keys(baked.attributes).sort().join(',') !== Object.keys(inputs.source.attributes).sort().join(',')) throw new Error('Native trail attribute/index layout differs');
    for (const [key, attribute] of Object.entries(inputs.source.attributes)) {
      const resident = baked.getAttribute(key);
      if (resident.count * resident.itemSize !== attribute.array.length || resident.itemSize !== attribute.itemSize || resident.normalized !== attribute.normalized) throw new Error(`Attribute layout differs: ${key}`);
      const Attribute = resident.constructor, ArrayType = resident.array.constructor;
      old.setAttribute(key, new Attribute(new ArrayType(attribute.array), attribute.itemSize, attribute.normalized));
    }
    old.computeBoundingBox(); old.computeBoundingSphere();
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
      for (const target of inputs.targets) {
        const { x, y, z } = target.at, eye = [x + 3.5, y + 2.5, z + 4.5], aim = [x, y + target.lift, z];
        g.camera.position.set(...eye); g.camera.lookAt(...aim); g.camera.updateMatrixWorld(true);
        mesh.geometry = old; frame(); const before = frame();
        mesh.geometry = baked; frame(); const after = frame();
        const visible = mesh.visible; mesh.visible = false; const absent = frame(); mesh.visible = visible;
        const result = { pose: target.name, eye, aim, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, ...difference(before, after), visiblePixels: difference(after, absent).changedPixels };
        if (result.visiblePixels < 20 || result.changedPixels !== 0) throw new Error(`Trailside pixel parity failed: ${JSON.stringify(result)}`);
        results.push(result);
      }
    } finally {
      mesh.geometry = baked; old.dispose();
      for (const child of hidden) child.visible = true;
      g.camera.position.copy(cameraPosition); g.camera.quaternion.copy(cameraRotation); g.shardFrame();
    }
    return results;
  }, { source, targets });
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / Metal', method: 'original versus baked geometry on the actual trail; native material, shadows, placement and frozen clock; both signs, rope fences and trestle stairs', rows }, null, 2)}\n`);
  console.log(`trailside-parity: ${rows.length} visible native views, 0 changed pixels`);
  await context.close();
} finally { await browser.close(); }
