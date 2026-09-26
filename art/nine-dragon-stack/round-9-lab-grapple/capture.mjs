// capture.mjs — lab P9 "grapple": one headless Chromium (Metal, muted), iPhone portrait 402×874 @3× = 1206×2622.
//   node capture.mjs <outdir> <tag> '<jobs json>'
//   jobs: [{ take:'hook'|'miss', t:1.2, name:'x', set?:{k:v}, pr?:3 }] | [{ bench: 60, take, t }] |
//         [{ video: true, take, from, to, fps, pr, dir }]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = await import('/Users/raynos/projects/games/wildshard-singleplayer/node_modules/playwright/index.mjs');

const [outdir, tag, jobsJson] = process.argv.slice(2);
const jobs = JSON.parse(jobsJson ?? '[{"take":"hook","t":0.6,"name":"lock"}]');
const URL = process.env.LAB_URL ?? 'http://localhost:5173/dev/nd-lab-grapple.html';
mkdirSync(outdir, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`pageerror: ${e.message.slice(0, 600)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`console.${m.type()}: ${m.text().slice(0, 600)}`); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  let pr = 3;
  // the dev server can full-reload the page mid-run (another agent's edit): wait for the lab again and redo the job
  const ensure = async () => {
    await page.waitForFunction(() => window.__ndGrapple !== undefined, undefined, { timeout: 120000 });
    await page.evaluate(() => window.__ndGrapple.ready);
    await page.evaluate(() => { window.__ndGrapple.play(false); });
    await page.evaluate((r) => { window.__ndGrapple.pixelRatio(r); }, pr);
  };
  await ensure();
  const all = jobs;
  for (let ji = 0, tries = 0; ji < all.length; ji++) {
    const j = all[ji];
    try {
      await runJob(j);
      tries = 0;
    } catch (e) {
      if (++tries > 3) throw e;
      console.error(`retry job ${ji} after: ${String(e).slice(0, 120)}`);
      await page.waitForTimeout(1500);
      await ensure();
      ji--;
    }
  }
  async function runJob(j) {
    if (j.pr && j.pr !== pr) { pr = j.pr; await page.evaluate((r) => { window.__ndGrapple.pixelRatio(r); }, pr); }
    if (j.set) for (const [k, v] of Object.entries(j.set)) await page.evaluate(([kk, vv]) => { window.__ndGrapple.set(kk, vv); }, [k, v]);
    if (j.bench) {
      await page.evaluate(([tk, t]) => { window.__ndGrapple.seek(tk, t); }, [j.take ?? 'hook', j.t ?? 1.8]);
      await page.evaluate(() => window.__ndGrapple.bench(20));
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await page.evaluate((n) => window.__ndGrapple.bench(n), j.bench));
      runs.sort((a, b) => a - b);
      const st = await page.evaluate(() => window.__ndGrapple.stats());
      console.log(`bench ${j.take}@${j.t}: ${runs.map((x) => x.toFixed(2)).join(' / ')} ms/frame (median ${runs[1].toFixed(2)}) at ${st.width}x${st.height}, ${st.calls} calls, ${st.triangles} tris (vm ${st.vmTris}, set ${st.worldTris})`);
      return;
    }
    if (j.video) {
      const dir = join(outdir, j.dir ?? `${tag}-${j.take}`);
      mkdirSync(dir, { recursive: true });
      const n = Math.round((j.to - j.from) * j.fps);
      const w = Math.round(402 * pr), h = Math.round(874 * pr);
      for (let i = 0; i <= n; i++) {
        const t = j.from + i / j.fps;
        await page.evaluate(([tk, tt]) => { window.__ndGrapple.seek(tk, tt); }, [j.take, t]);
        const url = await page.evaluate(([ww, hh]) => window.__ndGrapple.snapshot(ww, hh, 0.9), [w - (w % 2), h - (h % 2)]);
        writeFileSync(join(dir, `${String(j.offset ? i + j.offset : i).padStart(4, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      }
      console.log('video frames', dir, n + 1);
      return;
    }
    await page.evaluate(([tk, t]) => { window.__ndGrapple.seek(tk, t); }, [j.take, j.t]);
    const url = await page.evaluate(([ww, hh]) => window.__ndGrapple.snapshot(ww, hh, 0.9), [Math.round(402 * pr), Math.round(874 * pr)]);
    const out = join(outdir, `${tag}-${j.name}.jpg`);
    writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    const st = await page.evaluate(() => window.__ndGrapple.stats());
    console.log('wrote', out, JSON.stringify(st));
  }
  await context.close();
} finally {
  await browser.close();
}
