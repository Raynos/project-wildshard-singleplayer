#!/usr/bin/env node
// SF15a view board: today's template ground + props vs the template shardfile through the loader's views, same renderer,
// fixed poses, iPhone 16 Pro viewport at render scale 2. Run through scripts/browser-lane.sh; no dev server.
import { build } from 'vite';
import { chromium, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, symlinkSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { Buffer } from 'node:buffer';
import { imageScore } from '../parity/record.mjs';

const repo = resolve(import.meta.dirname, '../..'), tag = `sf15a-view-${process.pid}`, scratch = `/private/tmp/claude-501/sp-builders/sf15a-view/${tag}`;
const out = resolve(repo, 'progress/shard-platform/sf15a-view'), shots = join(scratch, 'shots');
mkdirSync(scratch, { recursive: true }); mkdirSync(out, { recursive: true }); mkdirSync(shots, { recursive: true }); symlinkSync(join(repo, 'node_modules'), join(scratch, 'node_modules'));
const env = { ...process.env, CLAUDE_CODE_SESSION_ID: tag, SERVE_BUILD_DIR: join(scratch, 'serve') };
/** @type {import('playwright').Browser | undefined} */ let browser;
/** @type {string | undefined} */ let url;
try {
  const served = execFileSync(join(repo, 'scripts/serve-build.sh'), ['--name', tag, '--hours', '1'], { cwd: scratch, env, encoding: 'utf8', timeout: 600000 });
  url = /http:\/\/127\.0\.0\.1:\d+/u.exec(served)?.[0]; if (url === undefined) throw new Error('No preview URL');
  const port = new URL(url).port, registry = readFileSync(join(homedir(), '.dev-servers', port), 'utf8').trim().split(/\s+/u), root = registry.at(2); if (root === undefined) throw new Error('Missing preview folder'); const output = join(root, 'dist');
  await build({ configFile: false, root: join(repo, 'test/fixtures/sim-level/views'), logLevel: 'silent', base: './', build: { target: 'esnext', minify: false, outDir: join(output, 'sf15a-views'), emptyOutDir: true } });
  for (const file of readdirSync(join(repo, 'src/shards/_template/assets'))) cpSync(join(repo, 'src/shards/_template/assets', file), join(output, 'sf15a-views', file));
  browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }), page = await context.newPage(), scoring = await context.newPage();
  /** @type {string[]} */ const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.error(e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error(m.text()); } });
  await page.goto(`${url}/sf15a-views/`); await page.waitForFunction('window.viewsBoard?.ready === true', undefined, { timeout: 90000 });
  /** @type {Record<string, unknown>} */ const poses = {};
  for (const pose of ['spawn', 'hut', 'overview', 'horizon']) {
    /** @type {Record<string, unknown>} */ const draws = {};
    for (const mode of ['today', 'views']) { draws[mode] = await page.evaluate((s) => window.viewsBoard.select(s.mode, s.pose), { mode, pose }); await page.screenshot({ path: join(shots, `${pose}.${mode}.jpg`), type: 'jpeg', quality: 88 }); }
    const score = await imageScore(scoring, join(shots, `${pose}.today.jpg`), join(shots, `${pose}.views.jpg`), []); poses[pose] = { ssim: score.ssim ?? 0, draws };
  }
  // one portrait board: a row per pose, today | views, labelled with the pose and its SSIM
  const cells = ['spawn', 'hut', 'overview', 'horizon'].flatMap((pose) => ['today', 'views'].map((mode) => ({ pose, mode, data: readFileSync(join(shots, `${pose}.${mode}.jpg`)).toString('base64') })));
  const board = await scoring.evaluate(async ({ cells: frames, ssim }) => {
    const images = await Promise.all(frames.map(async (c) => { const im = new Image(); im.src = `data:image/jpeg;base64,${c.data}`; await im.decode(); return im; }));
    const w = 300, h = Math.round(w * images[0].height / images[0].width), head = 34, canvas = document.createElement('canvas'); canvas.width = w * 2 + 6; canvas.height = (h + head) * 4 + 40;
    const g = canvas.getContext('2d'); g.fillStyle = '#15181d'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#e8e8e8'; g.font = 'bold 15px sans-serif';
    g.fillText('SF15a views: today (left) vs template shardfile through the views (right)', 8, 25);
    frames.forEach((c, i) => { const row = Math.floor(i / 2), col = i % 2, x = col * (w + 6), y = 40 + row * (h + head);
      g.fillStyle = '#e8e8e8'; g.font = '13px sans-serif'; g.fillText(`${c.pose} · ${c.mode}${col === 1 ? ` · SSIM ${ssim[c.pose].toFixed(3)}` : ''}`, x + 6, y + 22); g.drawImage(images[i], x, y + head, w, h); });
    return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
  }, { cells, ssim: Object.fromEntries(Object.entries(poses).map(([k, v]) => [k, v.ssim])) });
  writeFileSync(join(out, 'board.jpg'), Buffer.from(board, 'base64'));
  const census = await page.evaluate(() => window.viewsBoard.census()), fps = await page.evaluate(() => window.viewsBoard.fps(5000));
  writeFileSync(join(out, 'evidence.json'), `${JSON.stringify({ poses, census, fps, errors, source: 'today = template terrainPainter + world generators; views = src/shards/_template shardfile via clientMaterials/clientViews/clientWorld; one renderer, template look numbers, iPhone 16 Pro viewport, render scale 2' }, null, 2)}\n`);
  console.log(JSON.stringify({ shots, poses, census, fps, errors }));
} finally {
  await browser?.close();
  if (url !== undefined) execFileSync(join(repo, 'scripts/serve-build.sh'), ['stop', new URL(url).port], { cwd: scratch, env, stdio: 'pipe' });
  rmSync(scratch, { recursive: true, force: true });
}
