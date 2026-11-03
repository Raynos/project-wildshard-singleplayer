// Capture the blockout as iPhone-portrait JPEGs (labels burned in).
//   scripts/browser-lane.sh node art/showcase-template/round-1-blockout/capture.mjs
// Serves the repo root on a loopback port (three comes from node_modules), opens index.html muted as an
// "iPhone 16 Pro" home-screen PWA (402 x 874 CSS px), shoots each view, then sips shrinks it under the storage caps.
import { createServer } from 'node:http';
import { readFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const scratch = join(root, 'tmp/showcase-blockout/raw');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
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
  ['02-budget', 'budget', 1748, 72, 250_000],
  ['03-aerial', 'aerial', 1748, 62, 250_000],
  ['04-ground-hub', 'hub', 1748, 62, 250_000],
  ['05-ground-west-cluster', 'dense', 1748, 62, 250_000],
  ['06-ground-east-band-1', 'band1', 1748, 62, 250_000],
  ['07-ground-boss-arena', 'boss', 1748, 62, 250_000],
  ['08-ground-from-road', 'edge', 1748, 62, 250_000],
];
await mkdir(scratch, { recursive: true });
const phone = devices['iPhone 16 Pro'];
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ ...phone, viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/art/showcase-template/round-1-blockout/index.html`);
  await page.waitForFunction(() => window.labReady === true, null, { timeout: 120_000 });
  await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; });
  console.log('budget', JSON.stringify(await page.evaluate(() => window.lab.budget())), 'chain m', await page.evaluate(() => Math.round(window.lab.chainLength())));
  for (const [name, view, edge, q, cap] of SHOTS) {
    await page.evaluate(v => window.lab.show(v), view);
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
