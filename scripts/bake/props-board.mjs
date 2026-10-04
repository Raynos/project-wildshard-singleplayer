#!/usr/bin/env node
// SF9b real portrait comparisons. Run through scripts/browser-lane.sh; no dev server, no screenshot substitutions.
import { build } from 'vite';
import { chromium, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { compare } from '../parity/compare.mjs';
import { imageScore } from '../parity/record.mjs';

const repo = resolve(import.meta.dirname, '../..'), tag = `sf9b-${process.pid}`, scratch = `/private/tmp/claude-501/sp-builders/sp-x1/${tag}`, out = resolve(repo, 'progress/props', tag);
mkdirSync(scratch, { recursive: true }); mkdirSync(out, { recursive: true }); symlinkSync(join(repo, 'node_modules'), join(scratch, 'node_modules'));
const env = { ...process.env, CLAUDE_CODE_SESSION_ID: tag, SERVE_BUILD_DIR: join(scratch, 'serve') };
/** @type {import('playwright').Browser | undefined} */ let browser;
/** @type {string | undefined} */ let url;
try {
  await build({ configFile: false, logLevel: 'silent', build: { target: 'esnext', outDir: join(scratch, 'generator'), emptyOutDir: true, lib: { entry: join(repo, 'test/fixtures/sim-level/props/build.ts'), formats: ['es'], fileName: 'build' }, rolldownOptions: { platform: 'node', external: [/^node:/u, 'vite'] } } });
  const generator = await import(pathToFileURL(join(scratch, 'generator/build.js')).href);
  await generator.buildPropsFixture(join(scratch, 'data'));
  const served = execFileSync(join(repo, 'scripts/serve-build.sh'), ['--name', tag, '--hours', '1'], { cwd: scratch, env, encoding: 'utf8', timeout: 180000 });
  url = /http:\/\/127\.0\.0\.1:\d+/u.exec(served)?.[0]; if (url === undefined) throw new Error('No preview URL');
  const port = new URL(url).port, registry = readFileSync(join(homedir(), '.dev-servers', port), 'utf8').trim().split(/\s+/u), root = registry.at(2); if (root === undefined) throw new Error('Missing preview folder'); const output = join(root, 'dist');
  await build({ configFile: false, root: join(repo, 'test/fixtures/sim-level/props'), logLevel: 'silent', base: './', build: { target: 'esnext', outDir: join(output, 'sf9b-fixture'), emptyOutDir: true } });
  cpSync(join(scratch, 'data'), join(output, 'sf9b-fixture'), { recursive: true });
  browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }), page = await context.newPage(), scoring = await context.newPage();
  /** @type {string[]} */ const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.error(e.message); });
  await page.goto(`${url}/sf9b-fixture/`); await page.waitForFunction('window.propsFixture?.ready === true', undefined, { timeout: 60000 });
  /** @type {Record<string, {ssim:number}>} */ const poses = {};
  for (const pose of ['hut', 'scatter', 'course', 'lantern']) {
    for (const mode of ['original', 'baked']) { await page.evaluate(async (selection) => { const fixturePort = Reflect.get(window, 'propsFixture'); await fixturePort.select(selection.mode, selection.pose); }, { mode, pose }); await page.screenshot({ path: join(out, `${pose}.${mode}.jpg`), type: 'jpeg', quality: 88 }); }
    const score = await imageScore(scoring, join(out, `${pose}.original.jpg`), join(out, `${pose}.baked.jpg`), []); poses[pose] = { ssim: score.ssim ?? 0 };
  }
  const diagnostic = await page.evaluate(() => Reflect.get(window, 'propsFixture').diagnostic()), boot = { errors, renderer: diagnostic.renderer, scene: { totals: { batched: diagnostic.batched } } };
  const baseline = { boot, poses: Object.fromEntries(Object.keys(poses).map((p) => [p, { ssim: 1 }])), selfMin: Object.fromEntries(Object.keys(poses).map((p) => [p, 1])) }, verdict = compare(baseline, { boot, poses });
  const texture = await page.evaluate(() => { const fixturePort = Reflect.get(window, 'propsFixture'); return fixturePort.texture(); });
  const report = JSON.parse(readFileSync(join(scratch, 'data/report.json'), 'utf8'));
  writeFileSync(join(out, 'evidence.json'), `${JSON.stringify({ poses, verdict, boot, errors, texture, report, source: 'actual template generators + admitted baked GLBs, fixed cameras, iPhone 16 Pro viewport, render scale 2' }, null, 2)}\n`);
  if (errors.length > 0 || verdict.verdict !== 'green') throw new Error(`Props parity failed: ${JSON.stringify({ errors, poses, verdict })}`);
  console.log(JSON.stringify({ out, poses, texture, verdict: verdict.verdict }));
} finally {
  await browser?.close();
  if (url !== undefined) execFileSync(join(repo, 'scripts/serve-build.sh'), ['stop', new URL(url).port], { cwd: scratch, env, stdio: 'pipe' });
  rmSync(scratch, { recursive: true, force: true });
}
