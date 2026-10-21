#!/usr/bin/env node
// G475: actual timed held-tool hierarchy, pinned poses on portrait phone and desktop.
// scripts/browser-lane.sh node scripts/proof-held-tool.mjs --url=<preview> --out=<scratch>
// Compare summaries with scripts/proof-held-recipes.mjs --compare=<before>,<after>.
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
    await installInit(context, { lane: 'held-tool', sha: version.build, browser: 'chromium', capture: 30, tier });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
    await page.goto(new URL(`/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}`, url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__wildshard?.world?.weapons?.list.length === 3
      && !document.querySelector('.ws-load'), undefined, { timeout: 400000 });
    await page.evaluate(() => {
      const w = window.__wildshard.world, g = w.game; g.frameGate = () => false;
      for(let frame=0;frame<45;frame++){g.app.scheduler.beginFrame(1/60,w.player.position);g.runPhase('update',1/60,10);}
    });
    await page.waitForFunction(() => {
      const root = window.__wildshard.world.game.camera.getObjectByName('skin-knife');
      return root?.children[0]?.children[0]?.material?.normalScale?.y === -1;
    }, undefined, { timeout: 120000 });
    for (const weapon of ['knife']) {
      const poses = ['raise','cut-a','cut-b','return','holstered'];
      for (const pose of poses) {
        const shot = await page.evaluate(async ({ pose: heldPose }) => {
          const w = window.__wildshard.world, g = w.game, renderer = g.renderer, camera = g.camera, scene = g.rootScene ?? g.scene;
          g.frameGate = () => false;
          for (const held of w.weapons.list) held.model.visible = false;
          w.hands.group.visible = false;
          const life = g.app.debug.snapshot()['harness.shard.pine-hollow'].objects.pineLife;
          const carcass = w.animals.animals[0];
          const root = camera.getObjectByName('skin-knife');
          if (life === undefined || carcass === undefined || root === undefined) throw new Error('Missing real held tool/harvest owner');
          const step = dt => { g.app.scheduler.beginFrame(dt, w.player.position); g.runPhase('update', dt, 10); };
          life.harvest(carcass, () => { /* Pose observation does not grant inventory. */ });
          const seconds = { raise:.15, 'cut-a':.42, 'cut-b':.86, return:1.3, holstered:1.6 }[heldPose];
          const frames = Math.round(seconds * 60);
          for (let frame=0;frame<frames;frame++) step(1/60);
          for (const held of w.weapons.list) held.model.visible = false;
          w.hands.group.visible = false;
          root.updateWorldMatrix(true, true);
          // Keep the real CSM lights and their populated shadow maps; cloned lights have no depth texture.
          // Hide world meshes for this observation, retaining the camera's actual held rigs and ancestors.
          const hidden = [];
          scene.traverse(part => {
            if (part.isMesh !== true) return;
            let held = false;
            for (let ancestor = part; ancestor !== null; ancestor = ancestor.parent) if (ancestor === camera) held = true;
            if (!held && part.visible) { hidden.push(part); part.visible = false; }
          });
          const shadowUpdate = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
          renderer.setRenderTarget(null); renderer.setScissorTest(false);
          const gl = renderer.getContext(), ratio = renderer.getPixelRatio();
          renderer.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
          g.snapshot(1);
          renderer.info.reset(); g.snapshot(1);
          for (const part of hidden) part.visible = true;
          renderer.shadowMap.autoUpdate = shadowUpdate;
          const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
          const parts = []; root.traverse(part => { parts.push({ name: part.name, visible: part.visible, matrix: part.matrix.toArray(),
            ...(part.isSkinnedMesh === true ? { bones: Array.from(part.skeleton.boneMatrices) } : {}) }); });
          let data = ''; for (let index = 0; index < pixels.length; index += 0x8000) data += String.fromCodePoint(...pixels.subarray(index, index + 0x8000));
          return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, data: btoa(data),
            pixels: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''), parts,
            calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
        }, { id: weapon, pose });
        const { data, ...observation } = shot, raw = join(out, `${tier}-${weapon}-${pose}.rgba`);
        writeFileSync(raw, Buffer.from(data, 'base64'));
        rows.push({ slug: 'pine-hollow', tier, weapon, pose, ...observation, raw });
      }
    }
    console.log(`held-tool: ${tier}: 5 poses`);
    await context.close();
  }
} finally { await browser.close(); }
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ build: version.build, rows, errors })}\n`);
if (errors.length > 0) throw new Error(errors.join('\n'));
