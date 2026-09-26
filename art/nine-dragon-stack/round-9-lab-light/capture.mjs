#!/usr/bin/env node
// Lab P6 "light" (E169): shoots the clean room's 9 look-loop cameras on the lab page (dev/nd-lab-light.html, a frozen
// copy of the clean room with the light + grade modules wired in), with a lab setting per run. One headless Chromium
// (Metal, muted); run it under the lab browser lock:
//
//   lockf -k <scratchpad>/browser.lock node art/nine-dragon-stack/round-9-lab-light/capture.mjs \
//     --out=<dir> --tag=<name> [--set='{"pools":1,"glow":1,"grade":1}'] [--only=1,2,3] [--bench] [--url=http://localhost:5173]
//
// Writes <out>/<tag>-<k>.jpg (FP 1–6: portrait 402×874 @2 = 804×1748; 7–9: aerial 1600×900, like round-8-look-loop)
// and prints draw calls / triangles per frame; --bench also times the spawn at 1206×2622 (402×874 @3) for every
// setting in --bench-sets (a JSON list), interleaved, 3 × 60 frames each.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const has = (n) => argv.includes(`--${n}`);
const PAGE = `${flag('url', 'http://localhost:5173')}/dev/nd-lab-light.html`;
const OUT = flag('out', '.');
const TAG = flag('tag', 'cap');
const SET = JSON.parse(flag('set', '{}'));
const ONLY = flag('only', '1,2,3,4,5,6,7,8,9').split(',').map(Number).filter((k) => k >= 1 && k <= 9);
const TIME = Number(flag('time', '6.5'));

async function open(context) {
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 400)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.type() === 'info') console.error(`console.${m.type()}: ${m.text().slice(0, 400)}`); });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ndLight !== undefined && window.__light !== undefined, undefined, { timeout: 150000 });
  await page.evaluate(() => window.__ndLight.ready);
  await page.evaluate(() => window.__light.ready);
  await page.evaluate((t) => { window.__ndLight.time(t); }, TIME);
  return page;
}

const stats = [];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const fpK = ONLY.filter((k) => k <= 6), godK = ONLY.filter((k) => k >= 7);
  if (fpK.length > 0) {
    const fp = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 });
    const page = await open(fp);
    await page.evaluate((s) => { window.__ndLight.pixelRatio(2); window.__ndLight.hud(false); window.__ndLight.style('jiehua'); window.__light.set(s); }, SET);
    for (const k of fpK) {
      await page.evaluate((n) => window.__ndLight.shot(n), `loop-${k}`);
      await page.waitForTimeout(300);
      const out = join(OUT, `${TAG}-${k}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
      const st = await page.evaluate(() => window.__ndLight.stats());
      stats.push(`${TAG}-${k}: ${st.calls} calls, ${Math.round(st.triangles / 1000)}k tris`);
    }
    await fp.close();
  }
  if (godK.length > 0) {
    const god = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const gp = await open(god);
    await gp.evaluate((s) => { window.__ndLight.pixelRatio(1); window.__ndLight.hud(false); window.__ndLight.style('jiehua'); window.__light.set(s); }, SET);
    for (const k of godK) {
      await gp.evaluate((n) => window.__ndLight.shot(n), `loop-${k}`);
      await gp.waitForTimeout(300);
      const out = join(OUT, `${TAG}-${k}.jpg`);
      await gp.screenshot({ path: out, type: 'jpeg', quality: 90 });
      const st = await gp.evaluate(() => window.__ndLight.stats());
      stats.push(`${TAG}-${k}: ${st.calls} calls, ${Math.round(st.triangles / 1000)}k tris`);
    }
    await god.close();
  }
  if (has('bench')) {
    const sets = JSON.parse(flag('bench-sets', '[{}]'));
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 });
    const page = await open(ctx);
    await page.evaluate(() => { window.__ndLight.pixelRatio(3); window.__ndLight.hud(false); return window.__ndLight.shot('loop-1'); });
    const res = sets.map(() => []);
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < sets.length; i++) {
        await page.evaluate((s) => { window.__light.set(s); }, sets[i]);
        res[i].push(await page.evaluate(() => window.__ndLight.bench(60)));
      }
    }
    const st = await page.evaluate(() => window.__ndLight.stats());
    sets.forEach((s, i) => {
      const r = res[i].slice().sort((a, b) => a - b);
      stats.push(`bench ${JSON.stringify(s)} ${st.width}×${st.height}: ${r.map((x) => x.toFixed(2)).join(' / ')} ms (median ${r[1].toFixed(2)}), ${st.calls} calls`);
    });
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(stats.join('\n'));
writeFileSync(join(OUT, `${TAG}-stats.txt`), `${stats.join('\n')}\n`);
