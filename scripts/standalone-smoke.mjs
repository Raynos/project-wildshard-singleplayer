#!/usr/bin/env node
// P1-E5.2: the standalone target in a real module Web Worker. Bundles test/standalone/ (it never ships), serves it beside a
// built shard, and plays: the server ticks on the worker's own 60 Hz clock, the page decodes its 30 Hz frames and checks
// them against the worker's exact creature state, then a save made in the worker survives a real reload.
//
//   python3 scripts/heavy-lane.py build -- scripts/browser-lane.sh node scripts/standalone-smoke.mjs [--slug=sunscar-dunes] [--browser=chromium|webkit] [--seconds=10]
import { createReadStream, existsSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve as resolveFile, sep } from 'node:path';
import { devices, chromium, webkit } from 'playwright';
import { build } from 'vite';
import { rapierAlias } from '../vite/rapier.ts';
import { readBuiltShardfile } from './built-product.mjs';

const ROOT = resolveFile(import.meta.dirname, '..'), OUT = join(ROOT, 'tmp', 'standalone-smoke');
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const slug = option('slug', 'sunscar-dunes'), engine = option('browser', 'chromium'), seconds = Number(option('seconds', '10'));

rmSync(OUT, { recursive: true, force: true });
await build({ configFile: false, root: join(ROOT, 'test/standalone'), logLevel: 'warn', publicDir: false, resolve: { alias: rapierAlias }, assetsInclude: ['**/*.bin', '**/*.wasm'],
  define: { __TITLE_ASSET_URLS__: '{}', __BUILD_ID__: '"smoke"' }, worker: { format: 'es' }, build: { outDir: OUT, emptyOutDir: true, target: 'es2022', minify: false, sourcemap: false } });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
const product = readBuiltShardfile(ROOT, slug), physics = join(ROOT, 'public/assets/physics');
const resolvePath = path => {
  const inside = (root, tail) => { const file = resolveFile(root, `.${tail}`); return file === root || file.startsWith(root + sep) ? file : null; };
  if (path.startsWith(`/shards/${slug}/`)) return inside(resolveFile(product), path.slice(`/shards/${slug}`.length));
  if (path.startsWith('/assets/physics/')) return inside(physics, path.slice('/assets/physics'.length));
  return inside(OUT, path === '/' ? '/index.html' : path);
};
const server = createServer((request, response) => {
  const file = resolvePath(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (file === null || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }); // no COOP / COEP (J59 Q8)
  createReadStream(file).pipe(response);
});
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
const address = server.address(), origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}/`;

const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true, args: engine === 'webkit' ? [] : ['--mute-audio'] });
const failures = [];
const check = (name, passed, detail) => { if (!passed) failures.push(`${name}: ${JSON.stringify(detail)}`); };
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], ...(engine === 'webkit' ? {} : { isMobile: false, defaultBrowserType: 'chromium' }) });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => { errors.push(String(error)); });
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(origin);
  const first = await page.evaluate(name => window.standaloneProof.boot(name), slug);
  const report = await page.evaluate(run => window.standaloneProof.play(run), seconds);
  const saved = await page.evaluate(() => window.standaloneProof.save());
  const stored = await page.evaluate(name => window.standaloneProof.stored(name), slug);
  await page.reload();
  const second = await page.evaluate(name => window.standaloneProof.boot(name), slug);
  const resumed = await page.evaluate(() => window.standaloneProof.play(2));
  check('fresh boot', first.tick === 0 && !first.restored, first);
  // Headless WebKit wakes a worker's 16.7 ms timer only every ~100 ms here, with no game code loaded (Node's timers on the
  // same machine hold 17 ms), so the 3-step catch-up cap (§6.3.2) lands it at 30–40 ticks/s. Safari's rate is E5.4's gate.
  const floor = engine === 'webkit' ? 25 : 50;
  check('server tick rate near 60 Hz', report.ticksPerSecond > floor && report.ticksPerSecond < 62, report.ticksPerSecond);
  check('frame rate near 30 Hz', report.framesPerSecond > floor / 2 && report.framesPerSecond < 31, report.framesPerSecond);
  check('frames all decoded', report.dropped === 0, report.dropped);
  check('rows checked against the worker', report.probes >= seconds * 2 && report.matched > 0, report);
  check('rows within one quantisation step', report.worstError <= report.step, { worst: report.worstError, step: report.step });
  check('no cross-origin isolation', !report.crossOriginIsolated, report.crossOriginIsolated);
  check('commands reached the worker', report.positionMoved > 5, report.positionMoved);
  check('save durable', saved.ok && stored > 0, { saved, stored });
  check('save survives the reload', second.restored && second.tick === saved.tick, { second, saved });
  check('resumed server keeps ticking', resumed.tick > saved.tick + 60, resumed.tick);
  check('page stayed clean', errors.length === 0, errors.slice(0, 5));
  console.log(JSON.stringify({ gate: 'standalone-smoke', slug, engine, pass: failures.length === 0, report, saved, stored, second, resumedTick: resumed.tick, failures }, null, 1));
} finally {
  await browser.close();
  server.close();
  rmSync(OUT, { recursive: true, force: true });
}
process.exitCode = failures.length === 0 ? 0 : 1;
