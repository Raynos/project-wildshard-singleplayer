// Capture the neon lab (E169 lab P2): node art/nine-dragon-stack/round-7-lab-neon/capture.mjs <jobs.json>, dev server up, under the
// lab browser lock (lockf -k <scratchpad>/browser.lock node ...). One headless Chromium, Metal, muted, iPhone portrait 402x874 @3x.
// Every set() patch is a window.__lab.set() call: { streak, spill, sign, ground, bleed, hide }.
// jobs.json = { url?, time?, jobs: [{ out, shot, set?, w?, h? }], bench?: [{ name, shot, set? }] }
import { readFileSync, writeFileSync } from 'node:fs';

const { chromium } = await import('playwright');
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const URL = `${cfg.url ?? 'http://localhost:5173'}/dev/nd-lab-neon.html`;
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const t0 = Date.now();
try {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 400)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`console.${m.type()}: ${m.text().slice(0, 600)}`); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__lab !== undefined, undefined, { timeout: 90000 });
  await page.evaluate(() => window.__lab.ready);
  await page.evaluate((t) => { window.__lab.time(t); window.__lab.pixelRatio(3); }, cfg.time ?? 4.2);
  for (const j of cfg.jobs ?? []) {
    await page.evaluate(([s, set]) => { if (set) window.__lab.set(set); return window.__lab.shot(s); }, [j.shot, j.set ?? null]);
    await page.waitForTimeout(150);
    const url = await page.evaluate(([w, h]) => window.__lab.snapshot(w, h, 0.9), [j.w ?? 1206, j.h ?? 2622]);
    writeFileSync(j.out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (j.reset) await page.evaluate((r) => window.__lab.set(r), j.reset);
    console.log('wrote', j.out);
  }
  for (const b of cfg.bench ?? []) {
    await page.evaluate(([s, set]) => { if (set) window.__lab.set(set); return window.__lab.shot(s); }, [b.shot, b.set ?? null]);
    if (b.pr) await page.evaluate((r) => window.__lab.pixelRatio(r), b.pr);
    const runs = [];
    for (let i = 0; i < (b.runs ?? 5); i++) runs.push(await page.evaluate(() => window.__lab.bench(60)));
    runs.sort((a, c) => a - c);
    const st = await page.evaluate(() => window.__lab.stats());
    const extra = b.probe ? await page.evaluate(() => ({ od: window.__lab.overdraw(), nan: window.__lab.nanScan() })) : null;
    console.log(`bench ${b.name.padEnd(14)} min ${runs[0].toFixed(2)} med ${runs[Math.floor(runs.length / 2)].toFixed(2)} ms  ${st.width}x${st.height} calls ${st.calls} tris ${st.triangles}` + (extra ? `  overdraw(additive) mean ${extra.od.mean.toFixed(2)} max ${extra.od.max} cover ${(extra.od.covered * 100).toFixed(0)}%  NaN texels ${extra.nan}` : ''));
    if (b.pr) await page.evaluate(() => window.__lab.pixelRatio(3));
    if (b.reset) await page.evaluate((r) => window.__lab.set(r), b.reset);
  }
  await context.close();
} finally {
  await browser.close();
  console.log(`closed after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
