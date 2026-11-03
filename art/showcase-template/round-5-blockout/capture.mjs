// Capture the round-5 blockout as iPhone-portrait JPEGs (labels burned in).
//   scripts/browser-lane.sh node art/showcase-template/round-5-blockout/capture.mjs [view,view...]
// Serves the repo root on a loopback port (three comes from node_modules), opens index.html muted as an
// "iPhone 16 Pro" home-screen PWA (402 x 874 CSS px), shoots each view, then sips shrinks it under the storage caps.
// For 08 it first shoots round 4's SE bottom top-down (round-4-blockout/index.html, lab.topdown) into the scratch dir.
import { createServer } from 'node:http';
import { readFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const scratch = join(root, 'tmp/ks-blockout-r5/raw');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// name, view, long-edge px for sips, JPEG quality, byte cap
const SHOTS = [
  ['01-plan', 'plan', 1748, 72, 250_000],
  ['02-se-close-up', 'seplan', 1748, 74, 250_000],
  ['03-section', 'section', 1748, 72, 250_000],
  ['04-titan-arena-plan', 'arenaplan', 1748, 72, 250_000],
  ['05-titan-gate', 'tgate', 1748, 64, 250_000],
  ['06-gauntlet-entry', 'gentry', 1748, 64, 250_000],
  ['07-titan-arena-eye', 'arena', 1748, 64, 250_000],
  ['08-round-4-vs-round-5', 'compare', 1748, 72, 250_000],
  ['09-budget', 'budget', 1748, 72, 250_000],
];
await mkdir(scratch, { recursive: true });
const phone = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const only = process.argv[2]?.split(',');
  if (!only || only.includes('compare')) {   // round 4's SE bottom, top-down, x 0..250, z 112..250 (aspect 250:138)
    const p4 = await browser.newPage({ ...phone, viewport: { width: 402, height: 222 } });
    await p4.goto(`http://127.0.0.1:${port}/art/showcase-template/round-4-blockout/index.html`);
    await p4.waitForFunction(() => window.labReady === true, null, { timeout: 120_000 });
    await p4.evaluate(() => window.lab.topdown(0, 250, 112, 250));
    await p4.screenshot({ path: join(scratch, 'r4-se.png') }); await p4.close();
  }
  const page = await browser.newPage({ ...phone, viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/art/showcase-template/round-5-blockout/index.html`);
  await page.waitForFunction(() => window.labReady === true, null, { timeout: 120_000 });
  await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
  const st = await page.evaluate(() => window.lab.stats());
  console.log('stats', JSON.stringify({ budget: st.budget, gauntlet: st.gauntlet, gauntletView: st.gauntletView, se: st.se, titanArena: st.titanArena }));
  for (const [name, view, edge, q, cap] of SHOTS) {
    if (only && !only.includes(view)) continue;
    await page.evaluate(async v => { await window.lab.show(v); document.getElementById('ui').style.display = 'none'; }, view);
    await page.waitForTimeout(400);
    const raw = join(scratch, name + '.png');
    await page.screenshot({ path: raw });
    let quality = q, out = join(here, name + '.jpg');
    for (;;) {
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), '-Z', String(edge), raw, '--out', out], { stdio: 'ignore' });
      const { size } = await stat(out);
      if (size <= cap || quality <= 35) { console.log(name, size, 'q' + quality); break; }
      quality -= 6;
    }
  }
} finally {
  await browser.close(); server.close();
  await rm(scratch, { recursive: true, force: true });
}
