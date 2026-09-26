#!/usr/bin/env node
// Lab P1 ink capture (E169): one headless Chromium (Metal, muted), iPhone portrait 402×874 @3× = 1206×2622, driven
// through window.__ink (dev/nd-lab-ink.html; no URL switches). Run it under the lab browser lock:
//   lockf -k <lock> node capture.mjs --url=http://localhost:5173 --out=<dir> --jobs=<jobs.json>
// jobs.json: [{ name, shot: street|drop|stair, set: {lines, sil, wash, preset}, u: {uniform: value}, cam: t,
//               motion: bool (3 frames 1/30 s apart × speed), speed: 1, bench: bool, dpr: 3 }]
// Frames are grabbed from the canvas (toDataURL), not page.screenshot (that hung once after a bench).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = await import(new URL('../../../../node_modules/playwright/index.mjs', import.meta.url).href);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const OUT = flag('out', '.');
const URL = `${flag('url', 'http://localhost:5173')}/dev/nd-lab-ink.html`;
const jobs = JSON.parse(readFileSync(flag('jobs', 'jobs.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 400)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`console.${m.type()}: ${m.text().slice(0, 600)}`); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ink !== undefined, undefined, { timeout: 90000 });
  await page.evaluate(() => window.__ink.ready);
  for (const j of jobs) {
    await page.evaluate((jj) => {
      const ink = window.__ink;
      ink.pixelRatio(jj.dpr ?? 3);
      ink.set(jj.set ?? {});
      for (const [k, v] of Object.entries(jj.u ?? {})) ink.u(k, v);
      ink.cam(jj.cam ?? 0, jj.shot ?? 'street');
    }, j);
    await page.waitForTimeout(300);
    const shots = j.motion === true ? [0, 1, 2] : [0];
    for (const k of shots) {
      await page.evaluate((t) => window.__ink.cam(t), (j.cam ?? 0) + (k / 30) * (j.speed ?? 1));
      const file = join(OUT, j.motion === true ? `${j.name}-m${k}.png` : `${j.name}.png`);
      const url = await page.evaluate(() => window.__ink.grab());
      writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      console.log('wrote', file);
    }
    results.push({ name: j.name });
  }
  for (const j of jobs) {
    if (j.bench !== true) continue;
    await page.evaluate((jj) => {
      const ink = window.__ink;
      ink.pixelRatio(jj.dpr ?? 3);
      ink.set(jj.set ?? {});
      for (const [k, v] of Object.entries(jj.u ?? {})) ink.u(k, v);
      ink.cam(jj.cam ?? 0, jj.shot ?? 'street');
    }, j);
    await page.waitForTimeout(200);
    const r = results.find((x) => x.name === j.name) ?? { name: j.name };
    {
      await page.evaluate((t) => window.__ink.cam(t), j.cam ?? 0);
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await page.evaluate(() => window.__ink.bench(60)));
      runs.sort((a, b) => a - b);
      const st = await page.evaluate(() => window.__ink.stats());
      const parts = [];
      for (let i = 0; i < 3; i++) parts.push(await page.evaluate(() => window.__ink.benchParts(40)));
      const med = (k) => parts.map((p) => p[k]).sort((a, b) => a - b)[1];
      Object.assign(r, { ms: runs, median: runs[1], world: med('world'), post: med('post'), ...st });
      console.log(`  parts ${j.name}: world ${med('world').toFixed(3)} ms, post ${med('post').toFixed(3)} ms`);
      console.log(`bench ${j.name} ${st.width}×${st.height}: ${runs.map((x) => x.toFixed(2)).join(' / ')} ms, ${st.calls} calls, ${st.triangles} tris`);
    }
  }
  await context.close();
} finally {
  await browser.close();
}
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));
