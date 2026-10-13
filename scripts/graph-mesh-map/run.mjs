#!/usr/bin/env node
/** Actual GPU regression, no game/timing run:
 * scripts/browser-lane.sh node scripts/graph-mesh-map/run.mjs
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
if (existsSync(quiet)) throw new Error('Another lane owns quiet');
// Node's native promise adapter preserves stdout/stderr and rejects child errors.
/** @type {typeof execFile.__promisify__} */
const execute = Reflect.get(execFile, promisify.custom);
const bundle = process.argv[2];
if (bundle === '--bundle') {
  const outDir = process.argv.at(3);
  if (outDir === undefined) throw new Error('Missing owned bundle directory');
  const { build } = await import('vite');
  await build({ configFile: false, root: join(root, 'scripts/graph-mesh-map'), publicDir: false, logLevel: 'warn',
    define: { __BUILD_ID__: JSON.stringify('graph-mesh-map-proof'), __SAVE_NAMESPACES__: '[]', __DEVSERVER__: 'false' },
    build: { outDir, emptyOutDir: true, target: 'es2022', reportCompressedSize: false } });
} else {
  const scratch = await mkdtemp(join(tmpdir(), 'graph-mesh-map-'));
  const session = `graph-mesh-map-${process.pid}`;
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
    await execute('python3', [join(root, 'scripts/heavy-lane.py'), 'build', '--', process.execPath, import.meta.filename, '--bundle', dist]);
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Missing oracle server address');
    if (existsSync(quiet)) throw new Error('Another lane acquired quiet');
    await browser(['--args', '--mute-audio,--use-angle=metal,--ignore-gpu-blocklist', 'open', `http://127.0.0.1:${address.port}`]);
    await browser(['wait', '--fn', 'window.meshMapProof !== undefined']);
    const report = await browser(['eval', 'JSON.stringify(window.meshMapProof)']);
    const result = await browser(['eval', 'window.meshMapProof.pass === true']);
    console.log(report.stdout.trim());
    if (result.stdout.trim() !== 'true') throw new Error('Per-material GPU mesh map regression failed');
  } finally {
    await browser(['close']).catch(() => undefined);
    server.close();
    await rm(scratch, { recursive: true, force: true });
  }
}
