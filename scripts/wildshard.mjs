#!/usr/bin/env node
// Execute the workspace's author CLI without requiring a previously packed SDK or a Vite dev server.
import { build } from 'vite';
import { basename, relative, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';
import { rapierAlias } from '../vite/rapier.ts';
import { shardfileBoundaryViolations } from '../lint/shardfile-boundaries.mjs';
import { decisionLegacyLines } from './decision-legacy-lines.mjs';

let runner;
const authorRequire = createRequire(resolve(import.meta.dirname, '../src/sdk/package.json'));
/** Bundle trusted workspace tooling once; external Vite resolves against this installed tool, not a data URL. */
export async function runWildshard(args) {
  runner ??= (async () => {
    const result = await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'silent', define: { __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision()), 'import.meta.dirname': JSON.stringify(resolve(import.meta.dirname, '../src/sdk')) }, plugins: [{ name: 'author-node-vite', enforce: 'pre', resolveId(id) {
      if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
      if (id === 'sharp' || id === 'binaryen' || /^assemblyscript(?:\/|$)/u.test(id)) return { id: pathToFileURL(authorRequire.resolve(id)).href, external: true };
      return null;
    } }], build: { write: false, minify: false, lib: { entry: resolve(import.meta.dirname, '../src/sdk/cli.ts'), formats: ['es'], fileName: 'cli' }, rolldownOptions: { platform: 'node', external: [/^node:/u], output: { codeSplitting: false } } } });
    const output = Array.isArray(result) ? result.at(0) : result;
    if (output === undefined || !('output' in output)) throw new Error('Author CLI build produced no output');
    const chunks = output.output.filter((chunk) => chunk.type === 'chunk');
    if (chunks.length !== 1) throw new Error('Author CLI must bundle to one module');
    const cli = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
    if (typeof cli.runCli !== 'function') throw new Error('Author CLI has no runner');
    return cli.runCli;
  })();
  const root = resolve(import.meta.dirname, '..');
  const project = args[1] === undefined ? undefined : resolve(args[1]);
  const manifest = project === undefined || !['build', 'validate', 'prove'].includes(args[0] ?? '') || !existsSync(resolve(project, 'shard.config.ts')) ? undefined : {
    folder: basename(project), ...(existsSync(resolve(project, 'manifest.json')) ? { file: resolve(project, 'manifest.json') } : {}),
    imageRoots: [{ prefix: `/src/shards/${basename(project)}/`, directory: project }, { prefix: '/assets/', directory: resolve(root, 'public/assets') }],
  };
  const legacy = project === undefined ? undefined : decisionLegacyLines(root, basename(project));
  await (await runner)(args, { ...(legacy === undefined ? {} : { decisionLegacyLines: legacy }), ...(manifest === undefined ? {} : { manifest }), runtimeCheck: (/** @type {string} */ path, /** @type {string} */ source) => {
    const file = relative(root, resolve(args[1] ?? root, path)).split(sep).join('/');
    return shardfileBoundaryViolations(root, file, source).filter(issue => issue.rule === 'runtime-standalone');
  } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runWildshard(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
