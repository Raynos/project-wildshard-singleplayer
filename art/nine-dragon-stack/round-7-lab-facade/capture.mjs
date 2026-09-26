// capture.mjs — lab P3 facade (E169): one headless Chromium (Metal, muted), shots via window.__ndFacade (no URL
// switches). Run it under the lab's browser lock; the dev server must be up.
//   lockf -k <scratchpad>/browser.lock node art/nine-dragon-stack/round-7-lab-facade/capture.mjs --out=<dir> \
//     [--shots=canyon,wall,wall-high,spawn,shaft,shaft-across] [--dpr=2|3] [--bench] [--pieces] [--url=http://localhost:5173]
// Prints per shot: canvas size, draw calls, triangles, the facade's draws / tris / instances / windows / shell tris,
// and with --bench the GPU-synced ms/frame (3 runs × 40 frames, readPixels each frame).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const OUT = flag('out', '.');
const PAGE = `${flag('url', 'http://localhost:5173')}/dev/nd-lab-facade.html`;
const DPR = Number(flag('dpr', '2'));
const SHOTS = flag('shots', 'canyon,wall,wall-high,spawn,shaft,shaft-across').split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 400)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`console.${m.type()}: ${m.text().slice(0, 600)}`); });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ndFacade !== undefined, undefined, { timeout: 120000 });
  await page.evaluate(() => window.__ndFacade.ready);
  for (const s of SHOTS) {
    await page.evaluate((n) => window.__ndFacade.shot(n), s);
    await page.waitForTimeout(200);
    const out = join(OUT, `${s}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
    const st = await page.evaluate(() => { const x = window.__ndFacade.stats(); return { calls: x.calls, tris: x.triangles, w: x.width, h: x.height, buildMs: Math.round(x.buildMs), f: x.facade }; });
    let ms = '';
    if (argv.includes('--bench')) {
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await page.evaluate(() => window.__ndFacade.bench(40)));
      runs.sort((a, b) => a - b);
      ms = ` ${runs.map((x) => x.toFixed(2)).join('/')} ms (median ${runs[1].toFixed(2)})`;
    }
    if (argv.includes('--pieces')) console.log(JSON.stringify(st.f.perPiece));
    console.log(`${s}: ${st.w}x${st.h} calls ${st.calls} tris ${Math.round(st.tris / 1000)}k build ${st.buildMs}ms | facade draws ${st.f.draws} tris ${Math.round(st.f.tris / 1000)}k inst ${st.f.instances} win ${st.f.windows} shell ${Math.round(st.f.shellTris / 1000)}k${ms}`);
  }
  await ctx.close();
} finally {
  await browser.close();
}
