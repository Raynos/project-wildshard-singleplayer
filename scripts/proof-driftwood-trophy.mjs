#!/usr/bin/env node
// G262: exact baked/original pixels on the native wall plaques and their live loose-drop controller.
// Run through browser-lane; identical pixels produce only a summary, no board or raw image archive.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { installInit } from './parity/init.mjs';
import { saveFixture } from './debug-settings.mjs';
import { plaquesGeometry } from '../src/shards/driftwood-isle/generators/trophyPlaques.ts';
import { PLAQUE_GAP } from '../src/shards/driftwood-isle/models/trophyPlaques.ts';
import { counterGeometry } from '../src/shards/driftwood-isle/generators/tradeCounter.ts';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), output = arg('output');
if (url === undefined || output === undefined) throw new Error('Requires --url=<candidate preview> --output=<summary.json>');
const version = await (await fetch(new URL('/version.json', url))).json();
const original = {};
for (const [name, gap] of [['wall', PLAQUE_GAP], ['drop', 0]]) {
  const { geometry } = plaquesGeometry(gap);
  original[name] = Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }]));
  geometry.dispose();
}
const counter = counterGeometry();
original.counter = Object.fromEntries(Object.entries(counter.attributes).map(([key, attribute]) => [key, { itemSize: attribute.itemSize, normalized: attribute.normalized, array: Array.from(attribute.array) }]));
counter.dispose();
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await installInit(context, { lane: 'trophy-parity', sha: version.build, browser: 'chromium', tier: 'phone' });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.registry?.get('trophy-plaques') !== undefined && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const rows = await page.evaluate(sources => {
    const world = window.__wildshard.world, g = world.game, r = g.renderer, gl = r.getContext(), scene = g.rootScene ?? g.scene;
    const wall = g.app.registry.get('trophy-plaques').object;
    if (wall.name !== 'trophy-plaques' || typeof wall.setFilled !== 'function') throw new Error('Actual wall trophy controller missing');
    const filled = { bear: wall.filled('bear'), boar: wall.filled('boar') };
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
    const results = [], drops = [], originals = [];
    try {
      const targets = [{ name: 'wall', mesh: wall, source: sources.wall, states: [[], ['bear'], ['bear', 'boar'], ['boar']], aim: 0.25, eyes: [[0, 0.3, 1.3], [0.55, 0.4, 0.9]] }];
      for (const id of ['bear', 'boar']) {
        // The real constructor used by buildTrophy, including its gap-zero template and exact slot rewrite.
        const Drop = wall.constructor, drop = new Drop(0, wall.material, {});
        drop.trophyOnly(id); drop.position.copy(world.player.position).add(g.camera.position.clone().set(2, 1, 0));
        drop.visible = false; scene.add(drop); drops.push(drop);
        targets.push({ name: `drop-${id}`, mesh: drop, source: sources.drop, states: [[id]], aim: 0.25, eyes: [[0, 0.3, 1.3], [0.55, 0.4, 0.9]] });
      }
      const counters = [];
      g.app.registry.get('trade-counter')?.object?.traverse(node => { if (node.isMesh) counters.push(node); });
      if (counters.length !== 1) throw new Error('Actual single-mesh trade counter missing');
      targets.push({ name: 'counter', mesh: counters[0], source: sources.counter, states: [['stocked']], aim: 0.85, eyes: [[0, 1.2, 2], [1.1, 1.5, 1.2], [-0.9, 1.6, -1.2]] });
      for (const { name, mesh, source, states, aim, eyes } of targets) {
        mesh.visible = true;
        const baked = mesh.geometry, old = baked.clone();
        for (const [key, attribute] of Object.entries(source)) {
          const resident = baked.getAttribute(key);
          if (resident.count * resident.itemSize !== attribute.array.length || resident.itemSize !== attribute.itemSize || resident.normalized !== attribute.normalized) throw new Error(`Attribute layout differs: ${name}:${key}`);
          // The renderer may have released uploaded CPU arrays. Restore original arrays independently.
          const Attribute = resident.constructor, ArrayType = resident.array.constructor;
          old.setAttribute(key, new Attribute(new ArrayType(attribute.array), attribute.itemSize, attribute.normalized));
        }
        old.computeBoundingBox(); old.computeBoundingSphere(); originals.push({ mesh, baked, old });
        for (const state of states) {
          if (mesh === wall) for (const id of ['bear', 'boar']) mesh.setFilled(id, state.includes(id));
          const index = baked.getIndex();
          old.setIndex(index === null ? null : index.clone()); old.setDrawRange(baked.drawRange.start, baked.drawRange.count);
          mesh.updateWorldMatrix(true, false);
          for (const [pose, eye] of eyes.entries()) {
            g.camera.position.set(...eye).applyMatrix4(mesh.matrixWorld);
            g.camera.lookAt(g.camera.position.clone().set(0, aim, 0.04).applyMatrix4(mesh.matrixWorld));
            g.camera.updateMatrixWorld(true);
            mesh.geometry = old; frame(); const before = frame();
            mesh.geometry = baked; frame(); const after = frame();
            const visible = mesh.visible; mesh.visible = false; const absent = frame(); mesh.visible = visible;
            const result = { model: name, state: state.join('+') || 'empty', pose, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, ...difference(before, after), visiblePixels: difference(after, absent).changedPixels };
            if (result.visiblePixels < 20 || result.changedPixels !== 0) throw new Error(`Trophy pixel parity failed: ${JSON.stringify(result)}`);
            results.push(result);
          }
        }
        if (drops.includes(mesh)) mesh.visible = false;
      }
    } finally {
      for (const item of originals) { item.mesh.geometry = item.baked; item.old.dispose(); }
      for (const drop of drops) { drop.removeFromParent(); drop.geometry.dispose(); }
      for (const id of ['bear', 'boar']) wall.setFilled(id, filled[id]);
      for (const child of hidden) child.visible = true;
      g.camera.position.copy(cameraPosition); g.camera.quaternion.copy(cameraRotation); g.shardFrame();
    }
    return results;
  }, original);
  if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
  writeFileSync(output, `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro / phone / DPR2 / Metal', method: 'original versus baked vertices on native wall plaques, live gap-zero drop controller and native trade counter; all wall states, both drops and cloth wind, identical material/transforms/frozen clock', rows }, null, 2)}\n`);
  console.log(`trophy-parity: ${rows.length} visible native poses, 0 changed pixels`);
  await context.close();
} finally { await browser.close(); }
