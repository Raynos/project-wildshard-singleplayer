#!/usr/bin/env node
// SF23 far view board: builds test/fixtures/sim-level/far (the dev-mode 3 × 3 grid's far proxies streamed by the render
// rings through the one allocator), turns a camera on the centre cell to each of the eight neighbours in Chromium as an
// iPhone 16 Pro (portrait, render scale 2, muted) and writes progress/shard-platform/sf23/{board.jpg,board.json}.
// Run through scripts/browser-lane.sh; no dev server.
import { build } from 'vite';
import { chromium, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, rmSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { Buffer } from 'node:buffer';

const repo = resolve(import.meta.dirname, '../..'), tag = `sf23-far-${process.pid}`, scratch = `/private/tmp/claude-501/sp-builders/sf23/${tag}`;
const out = resolve(repo, 'progress/shard-platform/sf23');
mkdirSync(scratch, { recursive: true }); mkdirSync(out, { recursive: true }); symlinkSync(join(repo, 'node_modules'), join(scratch, 'node_modules'));
const env = { ...process.env, CLAUDE_CODE_SESSION_ID: tag, SERVE_BUILD_DIR: join(scratch, 'serve') };
/** @type {import('playwright').Browser | undefined} */ let browser;
/** @type {string | undefined} */ let url;
try {
  const served = execFileSync(join(repo, 'scripts/serve-build.sh'), ['--name', tag, '--hours', '1'], { cwd: scratch, env, encoding: 'utf8', timeout: 600000 });
  url = /http:\/\/127\.0\.0\.1:\d+/u.exec(served)?.[0]; if (url === undefined) throw new Error('No preview URL');
  const port = new URL(url).port, registry = readFileSync(join(homedir(), '.dev-servers', port), 'utf8').trim().split(/\s+/u), root = registry.at(2); if (root === undefined) throw new Error('Missing preview folder');
  await build({ configFile: false, root: join(repo, 'test/fixtures/sim-level/far'), logLevel: 'silent', base: './', publicDir: false, build: { target: 'esnext', minify: false, assetsInlineLimit: 0, outDir: join(root, 'dist', 'sf23-far'), emptyOutDir: true } });
  browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }), page = await context.newPage();
  /** @type {string[]} */ const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.error(e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error(m.text()); } });
  await page.goto(`${url}/sf23-far/`);
  await page.waitForFunction(() => window.farView?.ready(), undefined, { timeout: 120000, polling: 250 });
  const keys = await page.evaluate(() => window.farView.views());
  /** @type {{ key: string; shot: Buffer }[]} */ const shots = [];
  for (const key of keys) {
    await page.evaluate((k) => { window.farView.show(k); }, key);
    await page.waitForTimeout(400);
    shots.push({ key, shot: await page.screenshot({ type: 'jpeg', quality: 85 }) });
  }
  const stats = await page.evaluate(() => window.farView.stats());
  // board order: N row first, as the neighbours sit around the centre
  const order = ['-1,1', '0,1', '1,1', '1,0', '1,-1', '0,-1', '-1,-1', '-1,0'], sorted = order.map((k) => shots.find((s) => s.key === k)).filter((s) => s !== undefined);
  const board = await page.evaluate(async (frames) => {
    const images = await Promise.all(frames.map(async (data) => { const im = new Image(); im.src = `data:image/jpeg;base64,${data}`; await im.decode(); return im; }));
    const w = 250, h = Math.round(w * images[0].height / images[0].width), gap = 6, canvas = document.createElement('canvas'); canvas.width = w * 4 + gap * 3; canvas.height = (h + gap) * 2 + 34;
    const g = canvas.getContext('2d'); if (g === null) throw new Error('no 2d context');
    g.fillStyle = '#15181d'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#e8e8e8'; g.font = 'bold 15px sans-serif';
    g.fillText('SF23 far view: from the centre cell (Driftwood) to each neighbour · far proxies only · iPhone 16 Pro portrait', 6, 22);
    images.forEach((im, i) => { g.drawImage(im, (i % 4) * (w + gap), 32 + Math.floor(i / 4) * (h + gap), w, h); });
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? '';
  }, sorted.map((s) => s.shot.toString('base64')));
  const file = join(out, 'board.jpg'); writeFileSync(file, Buffer.from(board, 'base64'));
  const evidence = { views: sorted.map((s) => s.key), ...stats, boardKB: Math.round(statSync(file).size / 1000), errors,
    source: 'test/fixtures/sim-level/far via scripts/bake/far-board.mjs; Chromium (Metal), iPhone 16 Pro portrait, render scale 2, muted; camera 32 m over the centre cell, far plane FAR_RING.drawDistance' };
  writeFileSync(join(out, 'board.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  if (url !== undefined) execFileSync(join(repo, 'scripts/serve-build.sh'), ['stop', new URL(url).port], { cwd: scratch, env, stdio: 'pipe' });
  rmSync(scratch, { recursive: true, force: true });
}
