#!/usr/bin/env node
// Focused real WebKit compile/discard regression. Run through browser-lane.sh.
// An owned quiet may set WS_QUIET_OWNER; all build output stays in an owned temporary directory.
import { webkit, devices } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve as resolvePath } from 'node:path';

const repo = resolvePath(import.meta.dirname, '..');
const quietPath = join(repo, '.git/quiet');
if (existsSync(quietPath)) {
  const quiet = JSON.parse(readFileSync(quietPath, 'utf8'));
  if (quiet.owner !== process.env.WS_QUIET_OWNER) throw new Error('Another lane owns quiet; hold CPU work');
}
const scratch = mkdtempSync(join(tmpdir(), 'wildshard-coarse-mask-'));
let server = null;
let browser = null;
try {
  writeFileSync(join(scratch, 'index.html'), `<meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="${repo}/test/fixtures/coarse-mask-webkit/entry.js"></script>`);
  // The machine-wide build lane owns this child, including its Vite build.
  if (process.argv.includes('--build-child')) {
    await build({ configFile: false, root: scratch, base: './', publicDir: false, logLevel: 'warn',
      define: { __FIXTURE_VERSION__: JSON.stringify('focused-webkit'), __DEVSERVER__: 'false', __DEV__: 'false', __BUILD_ID__: JSON.stringify('coarse-mask-regression'), __SAVE_NAMESPACES__: '[]' },
      build: { outDir: process.env.WS_COARSE_DIST, target: 'es2022', reportCompressedSize: false, chunkSizeWarningLimit: 100000 },
    });
  } else {
    const dist = join(scratch, 'dist');
    execFileSync('python3', [join(repo, 'scripts/heavy-lane.py'), 'build', '--', process.execPath, import.meta.filename, '--build-child'], {
      cwd: repo, env: { ...process.env, WS_COARSE_DIST: dist }, stdio: 'inherit',
    });
    server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/result') { req.resume(); res.writeHead(204); res.end(); return; }
      const pathname = (req.url ?? '/').split('?')[0];
      const file = resolvePath(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(`${dist}/`) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': extname(file) === '.html' ? 'text/html' : 'text/javascript' });
      res.end(readFileSync(file));
    });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('No fixture address');
    browser = await webkit.launch({ headless: true });
    const { defaultBrowserType: _type, ...phone } = devices['iPhone 16 Pro'];
    const context = await browser.newContext({ ...phone, serviceWorkers: 'block' });
    const rows = [];
    for (const kind of ['classic', 'raw', 'pastel-plain', 'ink-cel-valley']) {
      const page = await context.newPage();
      await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
      const pageError = new Promise((_resolve, reject) => { page.once('pageerror', reject); });
      await page.goto(`http://127.0.0.1:${address.port}/#${kind}`);
      await Promise.race([page.waitForFunction(() => window.graphMaskResult !== undefined, null, { timeout: 60000 }), pageError]);
      const row = await page.evaluate(() => window.graphMaskResult);
      if (row.glError !== 0 || row.errors.some((error) => error.level === 'error')) throw new Error(`${kind}: shader/GL failure`);
      if (row.quadrants.some((quadrant) => quadrant.pixels < 100)) throw new Error(`${kind}: quadrant discard missing`);
      if (kind === 'classic' && row.noMaskDifference.bytes !== 0) throw new Error('Classic coarse pixels changed');
      rows.push({ kind, size: row.size, noMaskDifference: row.noMaskDifference, quadrants: row.quadrants });
      await page.close();
    }
    console.log(JSON.stringify({ gate: 'coarse-mask-webkit', pass: true, rows }));
  }
} finally {
  if (browser !== null) await browser.close();
  if (server !== null) await new Promise((resolve) => { server.close(resolve); });
  rmSync(scratch, { recursive: true, force: true });
}
