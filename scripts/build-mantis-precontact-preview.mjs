#!/usr/bin/env node
// Explicit opt-in native Mantis WIP. Never invokes another creature bake or changes a published product.
import { build } from 'vite';
import { mantisPrecontactPreviewConfig } from '../vite/mantis-precontact-preview.config.ts';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertHeavyLease } from './heavy-lane-lease.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rapierAlias } from '../vite/rapier.ts';
import { decisionLegacyLines } from './decision-legacy-lines.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';
import { admitMantisPrecontact } from './mantis-precontact-admission.mjs';

/** Compile the unchanged Mantis decision using the exact native candidate and normal SDK admission. */
export async function buildMantisNativePreview(destination = resolve(import.meta.dirname, '../tmp/mantis-native-preview/motion7')) {
  assertHeavyLease('build');
  const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/driftwood-isle');
  if (existsSync(destination) && readdirSync(destination).length > 0) throw new Error('Mantis output must be new or empty');
  const { receipt, metadata, payload } = admitMantisPrecontact(root);
  const packed = resolve(destination, 'pack'), productDirectory = resolve(destination, 'product');
  mkdirSync(packed, { recursive: true });
  writeFileSync(resolve(packed, 'metadata.json'), JSON.stringify(metadata));
  writeFileSync(resolve(packed, 'payload.bin'), payload);
  const authorRequire = createRequire(resolve(root, 'src/sdk/package.json'));
  const result = await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'silent',
    define: { __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision(root)),
      'import.meta.dirname': JSON.stringify(resolve(root, 'src/sdk')) },
    plugins: [{ name: 'practice-author-node', enforce: 'pre', resolveId(id) {
      if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
      if (id === 'sharp' || id === 'binaryen' || /^assemblyscript(?:\/|$)/u.test(id)) return { id: pathToFileURL(authorRequire.resolve(id)).href, external: true };
      return null;
    } }],
    build: { write: false, minify: false, lib: { entry: resolve(project, 'generators/mantisPrecontactPreview.ts'), formats: ['es'], fileName: 'mantis-native-preview-product' },
      rolldownOptions: { platform: 'node', external: [/^node:/u], output: { codeSplitting: false } } },
  });
  const output = Array.isArray(result) ? result.at(0) : result;
  if (output === undefined || !('output' in output)) throw new Error('Practice author bundle produced no output');
  const chunks = output.output.filter(chunk => chunk.type === 'chunk'), chunk = chunks.at(0);
  if (chunks.length !== 1 || chunk === undefined) throw new Error('Practice author bundle must contain one module');
  const author = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof author.buildMantisPrecontactPreviewProduct !== 'function') throw new Error('Practice author entry is missing');
  const lines = decisionLegacyLines(root, 'driftwood-isle');
  if (lines === undefined) throw new Error('Practice decisions require the sealed Driftwood line budget');
  const product = await author.buildMantisPrecontactPreviewProduct(project, productDirectory, { decisionLegacyLines: lines }, metadata);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(destination, 'preview.json'), JSON.stringify({
    schema: 'wildshard.mantis.native-preview.v1', candidate: receipt.candidate, mode: 'motion7',
    admission: receipt, metadataSha256: hash(readFileSync(resolve(packed, 'metadata.json'))),
    packedSha256: hash(payload), bodyFile: metadata.file, sourceHash: product.index.build.sourceHash,
    colliderAcceptance: false, visualAcceptance: false, runtimeAcceptance: false,
  }, null, 2));
  return product.index;
}

const command = process.argv.at(1);
if (command !== undefined && import.meta.url === pathToFileURL(resolve(command)).href) {
  try {
    if (process.argv.at(2) === '--app') {
      const config = mantisPrecontactPreviewConfig({ command: 'build', mode: 'production' });
      const outDir = process.argv.at(3);
      await build({ ...config, configFile: false,
        ...(outDir === undefined ? {} : { build: { ...config.build, outDir: resolve(outDir) } }) });
    } else {
    const output = process.argv.at(2);
    const index = await buildMantisNativePreview(output === undefined ? undefined : resolve(output));
    console.info(JSON.stringify({ slug: index.identity.slug, sourceHash: index.build.sourceHash,
      files: index.files.length, wasm: index.files.filter(file => file.kind === 'wasm').length,
      visualAcceptance: false, colliderAcceptance: false }));
    }
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
