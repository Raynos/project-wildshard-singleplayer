#!/usr/bin/env node
/** Actual product CacheStorage regression across a page reload:
 * scripts/browser-lane.sh node scripts/library-cache/run.mjs
 * Uses one muted owned agent-browser, closes it and removes the temporary bundle. */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const quiet = process.env.WS_QUIET_FILE ?? join(root, '.git/quiet');
const assertQuiet = () => {
  if (!existsSync(quiet)) return;
  /** @type {unknown} */
  const row = JSON.parse(readFileSync(quiet, 'utf8'));
  if (typeof row !== 'object' || row === null || !('pid' in row) || typeof row.pid !== 'number' || !('owner' in row)) throw new Error('Invalid quiet owner');
  if (String(row.pid) !== process.env.WS_QUIET_OWNER_PID || row.owner !== process.env.WS_QUIET_OWNER) throw new Error('Another lane owns quiet');
  process.kill(row.pid, 0);
};
assertQuiet();
// Node's native promise adapter preserves stdout/stderr and rejects child errors.
/** @type {typeof execFile.__promisify__} */
const execute = Reflect.get(execFile, promisify.custom);
const bundle = process.argv[2];
const productBase = bundle === '--bundle' ? process.argv.at(4) : process.argv.at(2);
if (productBase === undefined || !/^http:\/\/127\.0\.0\.1:[0-9]+\/shardfiles\/[a-z0-9-]+\/$/u.test(productBase)) throw new Error('Expected exact local pinned product base');
if (bundle === '--bundle') {
  const outDir = process.argv.at(3);
  if (outDir === undefined) throw new Error('Missing owned bundle directory');
  const { build } = await import('vite');
  await build({ configFile: false, root: join(root, 'scripts/library-cache'), publicDir: false, logLevel: 'warn',
    define: { __LIBRARY_BASE__: JSON.stringify(productBase), __BUILD_ID__: JSON.stringify('library-cache-proof'), __SAVE_NAMESPACES__: '[]', __DEVSERVER__: 'false' },
    build: { outDir, emptyOutDir: true, target: 'es2022', reportCompressedSize: false } });
} else {
  const scratch = await mkdtemp(join(tmpdir(), 'library-cache-'));
  const session = `library-cache-${process.pid}`;
  const dist = join(scratch, 'dist');
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const file = resolvePath(dist, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(`${dist}/`)) { response.writeHead(404).end(); return; }
    try {
      const bytes = readFileSync(file);
      response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  const browser = (/** @type {string[]} */ args) => execute('agent-browser', ['--session', session, ...args]);
  try {
    await execute('python3', [join(root, 'scripts/heavy-lane.py'), 'build', '--', process.execPath, import.meta.filename, '--bundle', dist, productBase]);
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Missing oracle server address');
    assertQuiet();
    await browser(['--args', '--mute-audio,--use-angle=metal,--ignore-gpu-blocklist', 'open', `http://127.0.0.1:${address.port}`]);
    await browser(['wait', '--fn', 'window.libraryCacheProof !== undefined']);
    const report = await browser(['eval', 'JSON.stringify(window.libraryCacheProof)']);
    const result = await browser(['eval', 'window.libraryCacheProof.pass === true']);
    console.log('COLD', report.stdout.trim());
    if (result.stdout.trim() !== 'true') throw new Error('Cold admission failed');
    await browser(['reload']);
    await browser(['wait', '--fn', 'window.libraryCacheProof !== undefined']);
    const warm = await browser(['eval', 'JSON.stringify(window.libraryCacheProof)']);
    console.log('WARM', warm.stdout.trim());
    const warmPass = await browser(['eval', 'window.libraryCacheProof.pass === true && window.libraryCacheProof.warm === true']);
    if (warmPass.stdout.trim() !== 'true') throw new Error('Warm admission refetched library bytes');
    if (result.stdout.trim() !== 'true') throw new Error('Library admission failed');
  } finally {
    await browser(['close']).catch(() => undefined);
    server.close();
    await rm(scratch, { recursive: true, force: true });
  }
}
