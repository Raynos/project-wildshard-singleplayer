#!/usr/bin/env node
// coat-diff.mjs — SHARD-PLATFORM G226 (E435): Nalati's baked coats against the procedural paint, per coat, per tier.
//
// On an IMAGES page per tier (the phone as "iPhone 16 Pro", the desktop at 1440×900; muted), once Nalati is up:
//   paint   the `harness.shard.nalati-grasslands` handle's coats(): coats.ts paintCoat, painted fresh (never the bake)
//   file    the tier's baked coat file (the lossless WebP the images path loads), decoded unflipped
//   diff    texels whose RGBA differs, and the largest channel difference (lossless: both must be 0)
//   runtime what the game's creatures actually wear: every coat texture in the scene, by source type (ImageBitmap =
//           adopted bake, HTMLCanvasElement = painted at entry)
// The KTX2 stand-ins are compared offline (ktx2-diff.py).
//
//   scripts/browser-lane.sh node progress/shard-platform/nalati-coats/coat-diff.mjs <preview-url> [--tiers=phone,desktop]
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'))?.replace(/\/$/u, '');
const tiers = (argv.find((a) => a.startsWith('--tiers='))?.slice(8) ?? 'phone,desktop').split(',');
if (!url) throw new Error('Usage: coat-diff.mjs <preview-url> [--tiers=phone,desktop]');
const report = { url, tiers: {} };
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const tier of tiers) {
    const context = await browser.newContext(tier === 'phone'
      ? { ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await context.addInitScript(saveFixtureCode({ scope: 'global', key: 'settings', data: { tier, fps: 'auto', tex: 'img' }, merge: true }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${url}/?chunk=nalati-grasslands&mute=1&skipintro=1&nolock=1&sw=0`);
    await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
    const result = await page.evaluate(async () => {
      const pixels = async (src) => {
        const bmp = await createImageBitmap(src, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        const c = new OffscreenCanvas(bmp.width, bmp.height), ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0);
        return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
      };
      const handle = window.__wildshard.world.game.app.debug.snapshot()['harness.shard.nalati-grasslands'];
      const coats = [];
      for (const s of handle.coats()) {
        const paint = await pixels(await (await fetch(s.png)).blob());
        const res = await fetch(s.url);
        if (!res.ok) { coats.push({ url: s.url, missing: res.status }); continue; }
        const file = await pixels(await res.blob());
        let diff = 0, max = 0;
        if (file.w === paint.w && file.h === paint.h) {
          for (let i = 0; i < paint.d.length; i += 4) {
            let m = 0;
            for (let c = 0; c < 4; c++) m = Math.max(m, Math.abs(paint.d[i + c] - file.d[i + c]));
            if (m > 0) diff++;
            max = Math.max(max, m);
          }
        }
        coats.push({ url: s.url, size: `${paint.w}x${paint.h}`, fileSize: `${file.w}x${file.h}`, texelsDiffering: diff, maxChannelDiff: max });
      }
      const runtime = {};
      window.__wildshard.world.game.scene.traverse((o) => {
        const mats = o.material === undefined ? [] : Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          const map = m?.map;
          if (!map || !/:(horse|wolf|kokbori|argymaq):/u.test(map.name)) continue;
          runtime[map.name] = map.image?.constructor?.name ?? String(map.image);
        }
      });
      return { coats, runtime };
    });
    await context.close();
    report.tiers[tier] = { ...result, errors };
    const bad = result.coats.filter((c) => c.missing !== undefined || c.texelsDiffering !== 0 || c.size !== c.fileSize);
    const painted = Object.values(result.runtime).filter((t) => t !== 'ImageBitmap');
    console.log(`coat-diff ${tier}: ${result.coats.length} coats, ${bad.length} differ · runtime ${Object.keys(result.runtime).length} coat textures, ${painted.length} not baked · ${errors.length} errors`);
  }
} finally { await browser.close(); }
writeFileSync(resolve(import.meta.dirname, 'coat-diff.json'), `${JSON.stringify(report, null, 1)}\n`);
