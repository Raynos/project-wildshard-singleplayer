// capture.mjs — lab P5 texture (E169): one headless Chromium (Metal, muted), cameras via window.__tex (no URL switches).
// Run it under the lab's browser lock with a dev server up:
//   lockf -k <scratchpad>/browser.lock node art/nine-dragon-stack/round-9-lab-texture/tools/capture.mjs --out=<dir> \
//     [--cams=corner,panel,down,shop,gate,tower,far] [--dpr=2|3] [--ab] [--bench] [--url=http://localhost:5243] [--tag=x]
//     [--paint=1,1,1,1] [--paint2=0.5,0.35,1,1]
// --ab also grabs every camera with the paint off (uPaintK.x = 0: the round-8 flat washes) as <cam>-off.jpg.
// --bench prints GPU-synced ms/frame at 1206×2622 (DPR 3), paint on vs off (6 interleaved runs × 20 frames each,
// medians, readPixels sync).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(new URL('../../../../package.json', import.meta.url));
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const OUT = flag('out', '.');
const PAGE = `${flag('url', 'http://localhost:5243')}/dev/nd-lab-texture.html`;
const DPR = Number(flag('dpr', '2'));
const CAMS = flag('cams', 'corner,panel,down,shop,gate,roof,tower,far').split(',');
const TAG = flag('tag', '');
const PAINT = flag('paint', '1,1,1,1').split(',').map(Number);
const PAINT2 = flag('paint2', '');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 600)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`console.${m.type()}: ${m.text().slice(0, 1600)}`); });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__tex !== undefined, undefined, { timeout: 120000 });
  await page.evaluate(() => window.__tex.ready);
  await page.evaluate((k) => window.__tex.paint(k), PAINT);
  if (PAINT2 !== '') await page.evaluate((k) => window.__tex.paint2(k), PAINT2.split(',').map(Number));
  const grab = async (name) => {
    const url = await page.evaluate(([w, h]) => window.__tex.snapshot(w, h, 0.9), [402 * DPR, 874 * DPR]);
    writeFileSync(join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
  };
  for (const c of CAMS) {
    await page.evaluate((n) => window.__tex.cam(n), c);
    await grab(`${c}${TAG}.jpg`);
    if (argv.includes('--ab')) {
      await page.evaluate(() => window.__tex.paint([0, 1, 1, 1]));
      await grab(`${c}-off.jpg`);
      await page.evaluate((k) => window.__tex.paint(k), PAINT);
    }
    const st = await page.evaluate(() => window.__tex.stats());
    console.log(`${c}: ${st.width}x${st.height} calls ${st.calls} tris ${Math.round(st.triangles / 1000)}k`);
  }
  if (argv.includes('--bench')) {
    await page.evaluate(() => window.__tex.pixelRatio(3));
    for (const c of ['corner', 'down', 'shop', 'far']) {
      await page.evaluate((n) => window.__tex.cam(n), c);
      // interleaved on / off runs (A B A B …): the GPU is shared with other agents' jobs, so drift hits both alike
      const runs = { on: [], off: [] };
      for (let i = 0; i < 6; i++) {
        for (const [label, k] of [['on', PAINT], ['off', [0, 1, 1, 1]]]) {
          await page.evaluate((kk) => window.__tex.paint(kk), k);
          runs[label].push(await page.evaluate(() => window.__tex.bench(20)));
        }
      }
      const med = (xs) => { const ys = [...xs].sort((a, b) => a - b); return (ys[2] + ys[3]) / 2; };
      const res = { on: med(runs.on), off: med(runs.off) };
      const st = await page.evaluate(() => window.__tex.stats());
      console.log(`bench ${c} ${st.width}x${st.height}: paint on ${res.on.toFixed(2)} ms, off ${res.off.toFixed(2)} ms (+${(res.on - res.off).toFixed(2)}), calls ${st.calls}`);
    }
    console.log(JSON.stringify(await page.evaluate(() => window.__tex.paintInfo())));
  }
  await ctx.close();
} finally {
  await browser.close();
}
