#!/usr/bin/env node
// Real held-claim model, pinned cosmetic clocks, original lighting and exact buffer/transform observations.
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installInit } from './parity/init.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), out = arg('out');
if (url === undefined || out === undefined) throw new Error('--url and --out required');
mkdirSync(out, { recursive: true });
const version = await (await fetch(new URL('/version.json', url))).json(), rows = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  for (const tier of ['phone', 'desktop']) {
    const context = await browser.newContext(tier === 'phone' ? { ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 }
      : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await installInit(context, { lane: 'held-claim', sha: version.build, browser: 'chromium', capture: 30, tier });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
    await page.goto(new URL(`/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}`, url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.weapons?.pickup('weapon.sword-iron'), undefined, { timeout: 240000 });
    for (const atTime of [.5, 2.5, 5]) {
      const shot = await page.evaluate(async time => {
        const w = window.__wildshard.world, g = w.game, renderer = g.renderer, camera = g.camera, scene = g.rootScene ?? g.scene;
        g.frameGate = () => false;
        const drop = w.weapons.pickup('weapon.sword-iron'), root = drop?.holder?.children[0];
        if (root === undefined) throw new Error('Missing actual held claim');
        drop.pulse = .7; drop.approach = 0; drop.near = false; drop.bob = .5;
        drop.update(0, time, renderer, camera);
        const at = drop.interactable.position;
        camera.position.set(at.x + 2, at.y + 1.1, at.z + 2); camera.lookAt(at.x, at.y, at.z); camera.updateMatrixWorld();
        scene.traverse(node => { if (node.isMesh || node.isSprite || node.isPoints) node.visible = false; });
        camera.traverse(node => { if (node.isMesh) node.visible = false; });
        root.traverse(node => { node.visible = true; }); root.visible = true;
        const parts = [];
        root.updateWorldMatrix(true, true);
        root.traverse(node => {
          const geometry = node.geometry;
          if (geometry === undefined) return;
          parts.push({ name: node.name, matrix: node.matrixWorld.toArray(), position: node.position.toArray(),
            quaternion: node.quaternion.toArray(), scale: node.scale.toArray(),
            attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([key, attribute]) => [key,
              { itemSize: attribute.itemSize, count: attribute.count, values: Array.from({ length: attribute.count }, (_point, i) =>
                Array.from({ length: attribute.itemSize }, (_component, c) => attribute.getComponent(i, c))) }])),
            index: geometry.index === null ? null : Array.from(geometry.index.array) });
        });
        renderer.shadowMap.autoUpdate = false;
        g.snapshot(1); renderer.info.reset(); g.snapshot(1);
        const gl = renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
        let data = ''; for (let i = 0; i < pixels.length; i += 0x8000) data += String.fromCodePoint(...pixels.subarray(i, i + 0x8000));
        return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, data: btoa(data),
          pixels: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''), parts,
          calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      }, atTime);
      const { data, ...shape } = shot, raw = join(out, `${tier}-${atTime}.rgba`);
      writeFileSync(raw, Buffer.from(data, 'base64'));
      rows.push({ slug: 'driftwood-isle', tier, pose: `claim-${atTime}`, ...shape, raw });
    }
    await context.close(); console.log(`held-claim: ${tier}: 3 poses`);
  }
} finally { await browser.close(); }
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ build: version.build, rows, errors }, null, 2)}\n`);
if (errors.length > 0) throw new Error(errors.join('\n'));
