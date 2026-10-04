#!/usr/bin/env node
// SF18b browser drive: builds test/fixtures/sim-level/rings (the render rings streaming a 3 × 3 grid through the one
// allocator, decode workers, a modelled 5 Mbit/s link with a 10 s stall), drives it 60 s at 30 m/s in Chromium as an
// iPhone 16 Pro (render scale 2, muted), and writes progress/shard-platform/sf18b/{browser-drive.json,drive.jpg}.
// Run through scripts/browser-lane.sh; no dev server.
import { build } from 'vite';
import { chromium, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { Buffer } from 'node:buffer';

const repo = resolve(import.meta.dirname, '../..'), tag = `sf18b-rings-${process.pid}`, scratch = `/private/tmp/claude-501/sp-builders/sf18b/${tag}`;
const out = resolve(repo, 'progress/shard-platform/sf18b');
mkdirSync(scratch, { recursive: true }); mkdirSync(out, { recursive: true }); symlinkSync(join(repo, 'node_modules'), join(scratch, 'node_modules'));
const env = { ...process.env, CLAUDE_CODE_SESSION_ID: tag, SERVE_BUILD_DIR: join(scratch, 'serve') };
/** @type {import('playwright').Browser | undefined} */ let browser;
/** @type {string | undefined} */ let url;
try {
  const served = execFileSync(join(repo, 'scripts/serve-build.sh'), ['--name', tag, '--hours', '1'], { cwd: scratch, env, encoding: 'utf8', timeout: 600000 });
  url = /http:\/\/127\.0\.0\.1:\d+/u.exec(served)?.[0]; if (url === undefined) throw new Error('No preview URL');
  const port = new URL(url).port, registry = readFileSync(join(homedir(), '.dev-servers', port), 'utf8').trim().split(/\s+/u), root = registry.at(2); if (root === undefined) throw new Error('Missing preview folder');
  await build({ configFile: false, root: join(repo, 'test/fixtures/sim-level/rings'), logLevel: 'silent', base: './', worker: { format: 'es' }, build: { target: 'esnext', minify: false, outDir: join(root, 'dist', 'sf18b-rings'), emptyOutDir: true } });
  browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }), page = await context.newPage();
  /** @type {string[]} */ const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.error(e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error(m.text()); } });
  await page.goto(`${url}/sf18b-rings/`);
  /** @type {Buffer[]} */ const shots = [];
  for (const at of [5, 25, 45]) {
    await page.waitForFunction((s) => window.ringsDrive.elapsed() >= s, at, { timeout: 120000, polling: 250 });
    shots.push(await page.screenshot({ type: 'jpeg', quality: 80 }));
  }
  await page.waitForFunction(() => window.ringsDrive.done, undefined, { timeout: 120000, polling: 500 });
  const result = await page.evaluate(() => window.ringsDrive.result);
  const sorted = [...result.frameMs].sort((a, b) => a - b), pick = (/** @type {number} */ q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const board = await page.evaluate(async (frames) => {
    const images = await Promise.all(frames.map(async (data) => { const im = new Image(); im.src = `data:image/jpeg;base64,${data}`; await im.decode(); return im; }));
    const w = 260, h = Math.round(w * images[0].height / images[0].width), canvas = document.createElement('canvas'); canvas.width = w * 3 + 12; canvas.height = h + 36;
    const g = canvas.getContext('2d'); if (g === null) throw new Error('no 2d context');
    g.fillStyle = '#15181d'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#e8e8e8'; g.font = 'bold 14px sans-serif';
    g.fillText('SF18b rings drive, 30 m/s: 5 s · 25 s · 45 s (HUD: holes, resident MB)', 6, 22);
    images.forEach((im, i) => { g.drawImage(im, i * (w + 6), 32, w, h); });
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1] ?? '';
  }, shots.map((s) => s.toString('base64')));
  writeFileSync(join(out, 'drive.jpg'), Buffer.from(board, 'base64'));
  const { frameMs: _frameMs, ...rest } = result;
  const evidence = { ...rest, fps: { median: Math.round(1000 / pick(0.5)), p95ms: Number(pick(0.95).toFixed(2)) }, errors,
    source: 'test/fixtures/sim-level/rings via scripts/bake/rings-drive.mjs; Chromium (Metal), iPhone 16 Pro viewport, render scale 2, muted; 5 Mbit/s serial link model with a 10 s stall; frame ms are rAF-paced (display-capped)' };
  writeFileSync(join(out, 'browser-drive.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  if (url !== undefined) execFileSync(join(repo, 'scripts/serve-build.sh'), ['stop', new URL(url).port], { cwd: scratch, env, stdio: 'pipe' });
  rmSync(scratch, { recursive: true, force: true });
}
