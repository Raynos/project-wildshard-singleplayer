#!/usr/bin/env node
// Clay or hologram renders of open-plots holograms (open-plots-mini-plan P5 review, P6 board): one 480 x 480 render per
// idea at yaw 35, labelled, plus a contact sheet. Run through the browser lane, muted:
//   bash scripts/browser-lane.sh node scripts/open-plots/clay-review.mjs --out=<dir> [--mode=clay|holo] [--yaw=35] [--title=<heading>] <glb> [<glb> ...]
// Serves the repository read-only on 127.0.0.1 for the page's three.js and GLBs; stops it when done.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { chromium, devices } from 'playwright';

const root = resolve(import.meta.dirname, '../..');
const option = (name) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = resolve(option('out') ?? 'tmp/open-plots/review'), yaw = option('yaw') ?? '35', mode = option('mode') ?? 'clay', title = option('title');
const models = process.argv.slice(2).filter(arg => !arg.startsWith('--')).map(file => resolve(file));
if (models.length === 0) throw new Error('Name at least one hologram GLB');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer((request, response) => {
  const path = resolve(root, `.${decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname)}`);
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  void (async () => {
    try { response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(await readFile(path)); }
    catch { response.writeHead(404).end(); }
  })();
});
await new Promise((_resolve) => { server.listen(0, '127.0.0.1', () => { _resolve(undefined); }); });
const address = server.address(), port = typeof address === 'object' && address !== null ? address.port : 0;
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const labelled = [], font = '/System/Library/Fonts/Helvetica.ttc';
try {
  execFileSync('mkdir', ['-p', out]);
  for (const model of models) {
    const idea = basename(dirname(model)), raw = resolve(out, `${idea}.png`), done = resolve(out, `${idea}.jpg`);
    const { defaultBrowserType: _engine, ...phone } = devices['iPhone 16 Pro'];
    const context = await browser.newContext({ ...phone, viewport: { width: 480, height: 480 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/scripts/open-plots/clay.html?model=/${relative(root, model)}&yaw=${yaw}&mode=${mode}`);
    await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 60_000 });
    await page.screenshot({ path: raw });
    await context.close();
    execFileSync('magick', [raw, '-gravity', 'North', '-background', '#101218', '-splice', '0x36', '-font', font,
      '-fill', '#ffb24a', '-pointsize', '20', '-annotate', '+0+8', `${idea.replaceAll('-', ' ').toUpperCase()} · ${mode} · yaw ${yaw}`, '-strip', '-quality', '80', done]);
    labelled.push(done);
    console.info(`${mode}: ${done}`);
  }
  const sheet = resolve(out, 'sheet.jpg');
  execFileSync('magick', ['montage', ...labelled, '-tile', '4x', '-geometry', '360x396+4+4', '-background', '#101218', '-quality', '78', sheet]);
  if (title !== undefined) execFileSync('magick', [sheet, '-gravity', 'North', '-background', '#101218', '-splice', '0x56', '-font', font,
    '-fill', '#ffffff', '-pointsize', '26', '-annotate', '+0+14', title, '-strip', '-quality', '78', sheet]);
  console.info(`${mode} sheet: ${sheet}`);
} finally {
  await browser.close();
  server.close();
}
