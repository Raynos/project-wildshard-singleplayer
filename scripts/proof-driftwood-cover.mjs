#!/usr/bin/env node
// G262: lossless near/far templates on the native instancing and wind material; summary only when pixels match.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { coverGeometry } from '../src/shards/driftwood-isle/generators/groundCover.ts';
import { area } from '../src/shards/driftwood-isle/world/blenderArea.ts';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<candidate preview> --output=<summary.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const original = {};
for (const [name, geometry] of Object.entries(coverGeometry().geometry)) {
  original[name] = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }]));
  geometry.dispose();
}
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'cover-parity', sha: version.build, browser: 'chromium', tier: 'phone' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game?.scene?.getObjectByName?.('ground-cover') && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  await page.evaluate(() => window.__parity.advance(40));
  const rows = await page.evaluate(({ sources, outsideX }) => {
    const world = window.__wildshard.world, g = world.game, cover = g.scene.getObjectByName('ground-cover');
    const r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene;
    const cameraPosition = g.camera.position.clone(), cameraRotation = g.camera.quaternion.clone(), fov = g.camera.fov;
    const hidden = g.camera.children.filter(child => child.visible);
    for (const child of hidden) child.visible = false;
    const meshes = cover.children.filter(node => node.isInstancedMesh), visibility = meshes.map(mesh => mesh.visible);
    for (const mesh of meshes) mesh.visible = false;
    g.shardFrame();
    const frame = () => {
      r.setRenderTarget(null); r.setScissorTest(false);
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
      for (const [name, source] of Object.entries(sources)) {
        const far = name.endsWith('Far'), id = far ? `${name.slice(0, -3)}-far` : name;
        const mesh = meshes.find(node => node.name === `ground-cover-${id}`);
        if (mesh === undefined) throw new Error(`Missing native cover tier: ${name}`);
        const baked = mesh.geometry, old = baked.clone(), count = mesh.count;
        // Keep the runtime's instance channels and material; replace only original fixed vertex channels.
        for (const [key, attribute] of Object.entries(source)) {
          const resident = baked.getAttribute(key);
          if (resident.count * resident.itemSize !== attribute.array.length || resident.itemSize !== attribute.itemSize || resident.normalized !== attribute.normalized) throw new Error(`Attribute layout differs: ${name}:${key}`);
          const Attribute = resident.constructor, ArrayType = resident.array.constructor;
          old.setAttribute(key, new Attribute(new ArrayType(attribute.array), attribute.itemSize, attribute.normalized));
        }
        old.computeBoundingBox(); old.computeBoundingSphere();
        const channels = [mesh.instanceMatrix, mesh.instanceColor, ...['aGround', 'aCover', 'aNrm'].map(key => baked.getAttribute(key))].filter(Boolean);
        const saved = channels.map(attribute => Array.from(attribute.array.slice(0, attribute.itemSize)));
        originals.push({ mesh, baked, old, count, channels, saved });
        // The spawn lies inside the Blender replacement, where this native material intentionally clips instances.
        const at = world.player.position.clone(); at.x = outsideX; at.y += 6;
        const yaw = Math.PI, c = Math.cos(yaw), s = Math.sin(yaw);
        mesh.instanceMatrix.array.set([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, at.x, at.y, at.z, 1]);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) { mesh.instanceColor.array.set([1, 1, 1]); mesh.instanceColor.needsUpdate = true; }
        for (const [key, values] of [['aGround', [0.25, 0.35, 0.2]], ['aCover', [0.25, 0.35, 0.2, 0.2]], ['aNrm', [0, 1, 0, 0.2]]]) {
          const attribute = baked.getAttribute(key); attribute.array.set(values); attribute.needsUpdate = true;
          // The twin under test shares exactly these runtime channels with the baked mesh.
          old.setAttribute(key, attribute);
        }
        mesh.count = 1; mesh.visible = true;
        for (let pose = 0; pose < 2; pose++) {
          const distance = far ? (name === 'daisyFar' ? 24 : 35) : 3;
          g.camera.fov = far ? 4 : 42; g.camera.updateProjectionMatrix();
          g.camera.position.copy(at).add(g.camera.position.clone().set(pose === 0 ? 0 : distance * 0.6, 0.5, pose === 0 ? distance : distance * 0.8));
          g.camera.lookAt(at.clone().add(g.camera.position.clone().set(0, 0.25, 0))); g.camera.updateMatrixWorld(true);
          mesh.geometry = old; frame(); const before = frame();
          mesh.geometry = baked; frame(); const after = frame();
          mesh.visible = false; const absent = frame(); mesh.visible = true;
          const result = { model: name, pose, distance, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, ...difference(before, after), visiblePixels: difference(after, absent).changedPixels };
          if (result.visiblePixels < 20 || result.changedPixels !== 0) throw new Error(`Cover pixel parity failed: ${JSON.stringify(result)}`);
          results.push(result);
        }
        mesh.visible = false;
      }
    } finally {
      for (const item of originals) {
        item.mesh.geometry = item.baked; item.mesh.count = item.count;
        item.channels.forEach((attribute, i) => { attribute.array.set(item.saved[i]); attribute.needsUpdate = true; });
        item.old.dispose();
      }
      meshes.forEach((mesh, i) => { mesh.visible = visibility[i]; });
      for (const child of hidden) child.visible = true;
      g.camera.position.copy(cameraPosition); g.camera.quaternion.copy(cameraRotation); g.camera.fov = fov; g.camera.updateProjectionMatrix(); g.shardFrame();
    }
    return results;
  }, { sources: original, outsideX: area.x1 + 15 });
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / Metal', method: 'original versus baked fixed vertex channels on every native instanced near/far cover tier; unchanged native wind material and shared runtime instance channels, frozen clock; two visible poses per model', rows }, null, 2)}\n`);
  console.log(`cover-parity: ${rows.length} visible native poses, 0 changed pixels`);
  await context.close();
} finally { await browser.close(); }
