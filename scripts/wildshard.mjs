#!/usr/bin/env node
// Execute the workspace's author CLI without requiring a previously packed SDK or a Vite dev server.
import { build } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';
import { rapierAlias } from '../vite/rapier.ts';

let runner;
/** Bundle trusted workspace tooling once; external Vite resolves against this installed tool, not a data URL. */
export async function runWildshard(args) {
  runner ??= (async () => {
    const result = await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'silent', define: { __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision()), 'import.meta.dirname': JSON.stringify(resolve(import.meta.dirname, '../src/sdk')) }, plugins: [{ name: 'author-node-vite', enforce: 'pre', resolveId(id) {
      if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
      return null;
    } }], build: { write: false, minify: false, lib: { entry: resolve(import.meta.dirname, '../src/sdk/cli.ts'), formats: ['es'], fileName: 'cli' }, rolldownOptions: { platform: 'node', external: [/^node:/u] } } });
    const output = Array.isArray(result) ? result.at(0) : result;
    if (output === undefined || !('output' in output)) throw new Error('Author CLI build produced no output');
    const chunks = output.output.filter((chunk) => chunk.type === 'chunk');
    if (chunks.length !== 1) throw new Error('Author CLI must bundle to one module');
    const cli = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
    if (typeof cli.runCli !== 'function') throw new Error('Author CLI has no runner');
    return cli.runCli;
  })();
  await (await runner)(args);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runWildshard(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
