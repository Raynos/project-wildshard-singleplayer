#!/usr/bin/env node
// G475: actual launcher, firearm and bow hierarchies, pinned poses on portrait phone and desktop.
// scripts/browser-lane.sh node scripts/proof-held-catalogue.mjs --url=<preview> --out=<scratch>
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
    await installInit(context, { lane: 'held-catalogue', sha: version.build, browser: 'chromium', capture: 30, tier });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error)));
    await page.goto(new URL(`/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}`, url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__wildshard?.world?.weapons?.list.length === 3
      && !document.querySelector('.ws-load'), undefined, { timeout: 400000 });
    for (const weapon of ['crossbow', 'rifle', 'bow']) {
      const poses = ['rest','sighted','action','reload','holstered'];
      for (const pose of poses) {
        const shot = await page.evaluate(async ({ id, pose: heldPose }) => {
          const w = window.__wildshard.world, g = w.game, renderer = g.renderer, camera = g.camera, scene = g.rootScene ?? g.scene;
          g.frameGate = () => false;
          for (const held of w.weapons.list) held.model.visible = false;
          w.hands.group.visible = false;
          const heldWeapon = w.weapons.list.find(held => held.id === id);
          w.weapons.unlock(id); w.weapons.select(id,true);
          heldWeapon.setActive(true); heldWeapon.enabled=true;
          heldWeapon.adsHeld = heldPose === 'sighted'; heldWeapon.holster=heldPose==='holstered'?1:0;
          if (id==='rifle') heldWeapon.freezeCycle=heldPose==='action'?.45:0;
          if (heldPose==='reload') heldWeapon.reload();
          if (id==='bow') heldWeapon.freezeDraw=heldPose==='action'?.8:0;
          for(let frame=0;frame<6;frame++)heldWeapon.update(1/30,10+frame/30);
          heldWeapon.model.visible=true;
          const root = heldWeapon.model;
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
    console.log(`held-catalogue: ${tier}: 15 poses`);
    await context.close();
  }
} finally { await browser.close(); }
writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ build: version.build, rows, errors })}\n`);
if (errors.length > 0) throw new Error(errors.join('\n'));
