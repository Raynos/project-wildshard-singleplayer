#!/usr/bin/env node
// Run through scripts/browser-lane.sh. A bounded renderer-only pixel proof, without a game build or Simulator.
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'vite';

// oxlint-disable-next-line typescript/strict-void-return -- Node's custom promisify adapter retains execFile's ChildProcess for stdin.
const exec = promisify(execFile);
/** @param {string} command @param {string[]} args @param {NodeJS.ProcessEnv} [env] @param {string} [input] @returns {Promise<string>} */
async function run(command, args, env, input) {
  const pending = exec(command, args, { env: env ?? process.env, timeout: 60_000, encoding: 'utf8' });
  if (input !== undefined) pending.child.stdin?.end(input);
  return (await pending).stdout;
}
const root = resolvePath('tmp/texture-retirement-');
await mkdir('tmp', { recursive: true });const directory = await mkdtemp(root);
const name = await run('agent-browser', ['session', 'id', '--scope', 'worktree', '--prefix', `texture-retirement-${process.pid}`]);
const env = { ...process.env, AGENT_BROWSER_SESSION: name.trim() };
/** @param {string[]} args @param {string} [input] */
const browser = (args, input) => run('agent-browser', args, env, input);
let server;
try {
  await build({ configFile: false, logLevel: 'error', build: { outDir: directory, emptyOutDir: false, minify: false,
    lib: { entry: resolvePath('test/fixtures/texture-retirement.mjs'), formats: ['es'], fileName: () => 'fixture.js' },
    rolldownOptions: { output: { inlineDynamicImports: true } } } });
  const bundle = await readFile(resolvePath(directory, 'fixture.js'));
  server = createServer((request, response) => {
    if (request.url === '/fixture.js') { response.setHeader('content-type', 'text/javascript');response.end(bundle);return; }
    response.setHeader('content-type', 'text/html');response.end('<!doctype html><title>Texture retirement pixel proof</title>');
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', () => { resolve(); }); });
  const address = server.address();if (address === null || typeof address === 'string') throw new Error('Missing proof server address');
  await browser(['--args', '--mute-audio', 'open', `http://127.0.0.1:${address.port}`]);
  await browser(['set', 'device', 'iPhone 16 Pro']);
  const script = '(async () => { const fixture = await import("/fixture.js"); return fixture.textureRetirementProof(); })()';
  const output = await browser(['eval', '--stdin'], script);console.log(output);
} finally {
  try { await browser(['close']); } finally {
    await new Promise(resolve => { if (server === undefined) resolve();else server.close(() => { resolve(); }); });
    await rm(directory, { recursive: true, force: true });
  }
}
