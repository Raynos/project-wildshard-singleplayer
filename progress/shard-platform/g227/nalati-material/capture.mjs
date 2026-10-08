// G227 (E435): today's Nalati terrain vs the same terrain redrawn as 62.5 m tiles with the painterly family's painted-terrain
// layer (the probe's `shard.terrainTiles` handle: look/terrainTiles.ts at e2fa752de, taken out of the shard after the
// capture so the shard keeps no test-only engine edges; re-apply it from that commit to re-run). iPhone 16 Pro portrait, muted, fixed poses, both
// tiers. Per pose: today twice (the noise floor: grass, clouds and water move), `slice` (vertex-identical tiles) and
// `lattice` (each tile resampled on the 33 × 33 L0 lattice, as the bake writes it); pixel diffs against the first frame.
//   scripts/browser-lane.sh node progress/shard-platform/g227/nalati-material/capture.mjs --url=<served build> --tier=desktop|phone
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
const arg = (key) => process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? '';
const base = arg('url'), tier = arg('tier') || 'desktop', out = dirname(fileURLToPath(import.meta.url));
if (!base) throw new Error('Pass --url');
mkdirSync(out, { recursive: true });
const POSES = [
  { name: 'road', x: 88, z: 205, yaw: Math.PI, pitch: -0.6 },
  { name: 'glacier', x: -30, z: -70, yaw: 1.6, pitch: -0.2 },
  { name: 'river', x: -10, z: -140, yaw: 0.3, pitch: -0.7 },
  { name: 'crags', x: -120, z: -60, yaw: 2.2, pitch: -0.05 },
];
const report = { base, tier, poses: [], errors: [] };
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  page.on('pageerror', (e) => { report.errors.push(e.message); });
  await page.goto(`${base}/?chunk=nalati-grasslands&mute=1&nolock=1&skipintro=1&sw=0&weather=clear&tod=0.5&clock=0&tier=${tier}`, { waitUntil: 'domcontentloaded', timeout: 300_000 });
  await page.waitForFunction(() => Boolean(window.__wildshard?.world && window.__wildshard?.shard?.terrainTiles) && !document.querySelector('.ws-load'), undefined, { timeout: 300_000, polling: 1000 });
  await page.waitForTimeout(4000);
  report.version = await page.evaluate(async () => (await fetch('/version.json')).json()).catch(() => null);
  const diffPage = await context.newPage();
  const diff = (a, b) => diffPage.evaluate(async ([pa, pb]) => {
    const load = async (b64) => createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.codePointAt(0) ?? 0)], { type: 'image/png' }));
    const [ia, ib] = await Promise.all([load(pa), load(pb)]);
    const px = (bm) => { const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height).data; };
    const A = px(ia), B = px(ib);
    let sum = 0, over8 = 0, over24 = 0, max = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      sum += d; if (d > 8) over8++; if (d > 24) over24++; if (d > max) max = d;
    }
    const n = A.length / 4;
    return { meanAbs: +(sum / n).toFixed(3), over8: +(over8 / n * 100).toFixed(3), over24: +(over24 / n * 100).toFixed(3), max };
  }, [a.toString('base64'), b.toString('base64')]);
  const shot = async (file) => { const png = await page.screenshot({ type: 'png' }); await page.screenshot({ path: join(out, file), type: 'jpeg', quality: 70 }); return png; };
  const set = (mode) => page.evaluate((m) => window.__wildshard.shard.terrainTiles.set(m), mode);
  for (const pose of POSES) {
    await set('off');
    await page.evaluate((p) => window.__wildshard.pose({ ...p }), pose);
    await page.waitForTimeout(3500);
    const today = await shot(`${tier}-${pose.name}-today.jpg`);
    await page.waitForTimeout(700);
    const today2 = await page.screenshot({ type: 'png' });
    const slice = await set('slice');
    await page.waitForTimeout(1500);
    const tiled = await shot(`${tier}-${pose.name}-tiled.jpg`);
    const lattice = await set('lattice');
    await page.waitForTimeout(1500);
    const latticed = await shot(`${tier}-${pose.name}-lattice.jpg`);
    await set('off');
    await page.waitForTimeout(800);
    const back = await page.screenshot({ type: 'png' });
    report.poses.push({ pose, slice, lattice, noise: await diff(today, today2), tiled: await diff(today, tiled), lattice: await diff(today, latticed), back: await diff(today, back),
      fps: await page.evaluate(() => window.__wildshard?.world?.game?.fps ?? null).catch(() => null) });
  }
  await context.close();
} catch (e) { report.failure = String(e?.stack ?? e); }
finally { await browser.close(); writeFileSync(join(out, `${tier}-report.json`), `${JSON.stringify(report, null, 2)}\n`); }
console.log(JSON.stringify({ failure: report.failure ?? null, errors: report.errors, poses: report.poses.map((p) => ({ name: p.pose.name, noise: p.noise, tiled: p.tiled, lattice: p.lattice, back: p.back })) }, null, 1));
if (report.failure || report.errors.length) process.exitCode = 1;
