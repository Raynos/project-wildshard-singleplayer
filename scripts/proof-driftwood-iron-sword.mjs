#!/usr/bin/env node
// G262: original and baked vertices on the real guarded iron sword pickup, frozen clock; exact pixels need no board.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { ironSwordGeometry } from '../src/shards/driftwood-isle/generators/ironSword.ts';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<candidate preview> --output=<summary.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const original = {};
for (const [part, geometry] of Object.entries(ironSwordGeometry())) {
  original[part] = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }]));
  geometry.dispose();
}
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'iron-sword-parity', sha: version.build, browser: 'chromium', tier: 'phone' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const g = window.__wildshard?.world?.game;
    const found = []; g?.scene.traverse(node => { if (node.material?.name === 'iron-sword-steel') found.push(node); });
    return found.length === 1 && !document.querySelector('.ws-load');
  }, null, { timeout: 240000 });
  const rows = await page.evaluate(sources => {
    const g = window.__wildshard.world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene;
    const meshes = {};
    scene.traverse(node => {
      if (node.isMesh && node.material?.name === 'iron-sword-steel') meshes.blade = node;
      if (node.isMesh && node.material?.name === 'iron-sword-fittings') meshes.fittings = node;
    });
    if (!meshes.blade || !meshes.fittings || meshes.blade.parent !== meshes.fittings.parent) throw new Error('Actual two-part iron sword pickup missing');
    const cameraPosition = g.camera.position.clone(), cameraRotation = g.camera.quaternion.clone();
    const pickup = meshes.blade.parent.parent?.parent;
    if (!pickup || pickup === scene) throw new Error('Native pickup hierarchy missing');
    const pickupPosition = pickup.position.clone();
    // The wreck's hold blocks views from behind the rack. Lift the actual pickup for this reversible
    // geometry comparison, preserving its holder, centring, scale, tilt and native metallic materials.
    // Restore it before any physics/spots/map capture. This is a numeric probe, not a game screenshot.
    pickup.position.y += 8;
    const meshVisibility = Object.values(meshes).map(mesh => [mesh, mesh.visible]);
    for (const [mesh] of meshVisibility) mesh.visible = true;
    const hidden = g.camera.children.filter(child => child.visible), ancestors = [];
    for (const child of hidden) child.visible = false;
    // The frozen pickup was culled from the spawn camera; expose its existing draw hierarchy for the probe.
    for (let node = meshes.blade.parent; node; node = node.parent) { ancestors.push([node, node.visible]); node.visible = true; }
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
      for (const [part, mesh] of Object.entries(meshes)) {
        const baked = mesh.geometry, old = baked.clone(), source = sources[part];
        for (const [key, attribute] of Object.entries(source)) {
          const resident = baked.getAttribute(key);
          if (resident.count * resident.itemSize !== attribute.array.length || resident.itemSize !== attribute.itemSize || resident.normalized !== attribute.normalized) throw new Error(`Attribute layout differs: ${part}:${key}`);
          const Attribute = resident.constructor, ArrayType = resident.array.constructor;
          old.setAttribute(key, new Attribute(new ArrayType(attribute.array), attribute.itemSize, attribute.normalized));
        }
        old.computeBoundingBox(); old.computeBoundingSphere(); originals.push({ mesh, baked, old });
        mesh.updateWorldMatrix(true, false);
        for (const [pose, eye] of [[0.7, 0.75, 1.3], [-0.8, 0.6, 1.1], [0.6, 0.65, -1.2]].entries()) {
          g.camera.position.set(...eye).applyMatrix4(mesh.matrixWorld);
          g.camera.lookAt(g.camera.position.clone().set(0, 0.35, 0).applyMatrix4(mesh.matrixWorld)); g.camera.updateMatrixWorld(true);
          mesh.geometry = old; frame(); const before = frame();
          mesh.geometry = baked; frame(); const after = frame();
          const visible = mesh.visible; mesh.visible = false; const absent = frame(); mesh.visible = visible;
          const result = { part, pose, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, ...difference(before, after), visiblePixels: difference(after, absent).changedPixels };
          if (result.visiblePixels < 20 || result.changedPixels !== 0) throw new Error(`Iron sword pixel parity failed: ${JSON.stringify(result)}`);
          results.push(result);
        }
      }
    } finally {
      for (const item of originals) { item.mesh.geometry = item.baked; item.old.dispose(); }
      for (const [node, visible] of ancestors) node.visible = visible;
      for (const [mesh, visible] of meshVisibility) mesh.visible = visible;
      pickup.position.copy(pickupPosition);
      for (const child of hidden) child.visible = true;
      g.camera.position.copy(cameraPosition); g.camera.quaternion.copy(cameraRotation); g.shardFrame();
    }
    return results;
  }, original);
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / Metal', method: 'original versus baked blade/fittings on the actual guarded pickup, temporarily lifted 8 m above the occluding wreck; native metallic materials, scale, tilt, local centring and frozen clock; original position and visibility restored', rows }, null, 2)}\n`);
  console.log(`iron-sword-parity: ${rows.length} visible native poses, 0 changed pixels`);
  await context.close();
} finally { await browser.close(); }
