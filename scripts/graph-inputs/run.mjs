#!/usr/bin/env node
/** Bundle in the check mirror; then run the bounded GPU oracle under browser-lane. */
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { promisify } from 'node:util';

/** @type {typeof execFile.__promisify__} */
const execute = Reflect.get(execFile, promisify.custom);
const root = resolvePath(import.meta.dirname, '../..');
const mode = process.argv[2], directory = process.argv[3];
if (process.argv.length < 4) throw new Error('Use --bundle or --serve with an owned ./tmp directory');
const dist = resolvePath(directory);
if (existsSync(join(root, '.git/quiet'))) throw new Error('Another lane owns quiet');
if (mode === '--bundle') {
  const {build} = await import('vite');
  await build({configFile: false, root: join(root, 'scripts/graph-inputs'), publicDir: false, logLevel: 'warn',
    define: {__BUILD_ID__: JSON.stringify('graph-inputs-oracle'), __SAVE_NAMESPACES__: '[]', __DEVSERVER__: 'false'},
    build: {outDir: dist, emptyOutDir: true, target: 'es2022', reportCompressedSize: false}});
} else if (mode === '--serve') {
  const session = `graph-inputs-${process.pid}`;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const file = resolvePath(dist, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(`${dist}/`)) {response.writeHead(404).end(); return;}
    try {
      const bytes = readFileSync(file);
      response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
      response.end(bytes);
    } catch {response.writeHead(404).end();}
  });
  const browser = (/** @type {string[]} */ args) => execute('agent-browser', ['--session', session, ...args]);
  try {
    await new Promise(resolve => {server.listen(0, '127.0.0.1', resolve);});
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('Missing oracle address');
    await browser(['--args', '--mute-audio,--use-angle=metal,--ignore-gpu-blocklist', 'open', `http://127.0.0.1:${address.port}`]);
    await browser(['wait', '--fn', 'window.graphInputsProof !== undefined']);
    console.log((await browser(['eval', 'JSON.stringify(window.graphInputsProof)'])).stdout.trim());
    if ((await browser(['eval', 'window.graphInputsProof.pass === true'])).stdout.trim() !== 'true') {
      console.error((await browser(['console', '--json'])).stdout.trim());
      throw new Error('Graph input GPU oracle failed');
    }
  } finally {await browser(['close']).catch(() => undefined); server.close();}
} else throw new Error('Unknown oracle mode');
