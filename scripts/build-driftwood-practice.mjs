#!/usr/bin/env node
// A source-only review product; never invokes the full island bake or changes its published output.
import { build } from 'vite';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rapierAlias } from '../vite/rapier.ts';
import { decisionLegacyLines } from './decision-legacy-lines.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';

/** Bundle only the practice author source and the official SDK pipeline, then return the actual validated index. */
export async function buildDriftwoodPractice(destination = resolve(import.meta.dirname, '../tmp/driftwood-practice/product')) {
  const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/driftwood-isle');
  // Refuse stale/foreign output rather than silently deleting data or leaving an invalid mixed inventory.
  if (existsSync(destination) && readdirSync(destination).length > 0) throw new Error('Practice output must be a new or empty directory');
  const authorRequire = createRequire(resolve(root, 'src/sdk/package.json'));
  const result = await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'silent',
    define: { __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision(root)),
      'import.meta.dirname': JSON.stringify(resolve(root, 'src/sdk')) },
    plugins: [{ name: 'practice-author-node', enforce: 'pre', resolveId(id) {
      if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
      if (id === 'sharp' || id === 'binaryen' || /^assemblyscript(?:\/|$)/u.test(id)) return { id: pathToFileURL(authorRequire.resolve(id)).href, external: true };
      return null;
    } }],
    build: { write: false, minify: false, lib: { entry: resolve(project, 'generators/practiceProduct.ts'), formats: ['es'], fileName: 'practice-product' },
      rolldownOptions: { platform: 'node', external: [/^node:/u], output: { codeSplitting: false } } },
  });
  const output = Array.isArray(result) ? result.at(0) : result;
  if (output === undefined || !('output' in output)) throw new Error('Practice author bundle produced no output');
  const chunks = output.output.filter(chunk => chunk.type === 'chunk'), chunk = chunks.at(0);
  if (chunks.length !== 1 || chunk === undefined) throw new Error('Practice author bundle must contain one module');
  const author = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof author.buildDriftwoodPracticeProduct !== 'function') throw new Error('Practice author entry is missing');
  const lines = decisionLegacyLines(root, 'driftwood-isle');
  if (lines === undefined) throw new Error('Practice decisions require the sealed Driftwood line budget');
  const product = await author.buildDriftwoodPracticeProduct(project, destination, { decisionLegacyLines: lines });
  return product.index;
}

const command = process.argv.at(1);
if (command !== undefined && import.meta.url === pathToFileURL(resolve(command)).href) {
  try {
    const argument = process.argv.at(2), destination = argument === undefined ? undefined : resolve(argument);
    const index = await buildDriftwoodPractice(destination);
    console.info(JSON.stringify({ slug: index.identity.slug, sourceHash: index.build.sourceHash,
      validator: index.build.validator, sections: index.sections.length, blobs: index.files.length,
      wasm: index.files.filter(file => file.kind === 'wasm').length,
      destination: destination ?? resolve(import.meta.dirname, '../tmp/driftwood-practice/product') }));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
