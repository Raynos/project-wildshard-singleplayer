#!/usr/bin/env node
// G262: original and baked attributes on the native boat and the actual Explorer cape, at one frozen clock.
// browser-lane, iPhone portrait; identical pixels need only this summary, no board or raw captures.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { boatGeometry } from '../src/shards/driftwood-isle/generators/boat.ts';
import { sailclothCapeGeometry } from '../src/shards/driftwood-isle/generators/sailclothCape.ts';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<candidate preview> --output=<summary.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const original = {};
for (const [name, geometry] of Object.entries({ ...boatGeometry(), cape: sailclothCapeGeometry() })) {
  original[name] = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }]));
  geometry.dispose();
}
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'boat-cape-parity', sha: version.build, browser: 'chromium', tier: 'phone' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.boat?.group !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const rows = await page.evaluate(sources => {
    const world = window.__wildshard.world, g = world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene;
    const boat = world.boat.group, meshes = {};
    boat.traverse(node => { if (node.isMesh) meshes[node.castShadow ? (node.receiveShadow ? 'hull' : 'sail') : 'gear'] = node; });
    if (Object.keys(meshes).length !== 3) throw new Error('Native three-mesh boat hierarchy is missing');
    const entry = g.app.registry.models().find(model => model.id === 'driftwood-isle/sailcloth-cape');
    if (entry === undefined) throw new Error('Native cape catalog entry is missing');
    const specimen = entry.object(), capes = [];
    specimen.traverse(node => { if (node.isMesh) capes.push(node); });
    const cape = capes[0];
    if (cape === undefined) throw new Error('Native cape specimen is missing');
    const parent = specimen.parent, position = specimen.position.clone();
    specimen.position.copy(world.player.position).add(g.camera.position.clone().set(2, 1, 0));
    scene.add(specimen);
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
      for (const [name, mesh] of Object.entries({ ...meshes, cape })) {
        const baked = mesh.geometry, old = baked.clone();
        for (const [key, attribute] of Object.entries(sources[name])) {
          const resident = baked.getAttribute(key);
          if (resident.count * resident.itemSize !== attribute.array.length) throw new Error(`Attribute count differs: ${name}:${key}`);
          if (resident.itemSize !== attribute.itemSize || resident.normalized !== attribute.normalized) throw new Error(`Attribute layout differs: ${name}:${key}`);
          // Uploaded static meshes may have released their CPU arrays; render the baked resident GPU buffers unchanged.
          // Reconstruct the original independently instead of cloning the released array.
          const Attribute = resident.constructor, ArrayType = resident.array.constructor;
          const restored = new Attribute(new ArrayType(attribute.array), attribute.itemSize, attribute.normalized);
          restored.needsUpdate = true;
          old.setAttribute(key, restored);
        }
        old.computeBoundingBox(); old.computeBoundingSphere(); originals.push({ name, mesh, baked, old });
      }
      for (const [model, object, poses] of [
        ['boat', boat, [[-5, 3, -6], [5, 3, 6], [0.9, 2.2, 0.3], [-3, 6, 1]]],
        ['cape', specimen, [[0.5, 0.6, -1.4], [-0.5, 0.6, -1.4], [0.6, 0.8, 1.4]]],
      ]) {
        object.updateWorldMatrix(true, true);
        for (const [pose, eye] of poses.entries()) {
          g.camera.position.set(...eye).applyMatrix4(object.matrixWorld);
          const centre = g.camera.position.clone().set(0, model === 'boat' ? 1.8 : 0.55, 0).applyMatrix4(object.matrixWorld);
          g.camera.lookAt(centre); g.camera.updateMatrixWorld(true);
          for (const item of originals) item.mesh.geometry = item.old;
          frame(); const before = frame();
          for (const item of originals) item.mesh.geometry = item.baked;
          frame(); const after = frame();
          const wasVisible = object.visible; object.visible = false;
          const absent = frame(); object.visible = wasVisible;
          const result = { model, pose, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, ...difference(before, after), visiblePixels: difference(after, absent).changedPixels };
          if (result.visiblePixels < 20 || result.changedPixels !== 0) throw new Error(`Boat/cape pixel parity failed: ${JSON.stringify(result)}`);
          results.push(result);
        }
      }
    } finally {
      for (const item of originals) { item.mesh.geometry = item.baked; item.old.dispose(); }
      specimen.removeFromParent(); specimen.position.copy(position); if (parent !== null) parent.add(specimen);
      for (const child of hidden) child.visible = true;
      g.camera.position.copy(cameraPosition); g.camera.quaternion.copy(cameraRotation); g.shardFrame();
    }
    return results;
  }, original);
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / Metal', method: 'original versus baked geometry on native three-mesh boat and registered Explorer cape; identical materials, transforms and frozen clock', rows }, null, 2)}\n`);
  console.log(`boat-cape-parity: ${rows.length} visible native poses, 0 changed pixels`);
  await context.close();
} finally { await browser.close(); }
