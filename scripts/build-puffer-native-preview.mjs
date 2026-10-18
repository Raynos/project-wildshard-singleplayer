#!/usr/bin/env node
// Explicit opt-in native Puffer WIP. Never invokes another creature bake or changes a published product.
import { build } from 'vite';
import { pufferPreviewConfig } from '../vite/puffer-preview.config.ts';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertHeavyLease } from './heavy-lane-lease.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rapierAlias } from '../vite/rapier.ts';
import { decisionLegacyLines } from './decision-legacy-lines.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';
import { resolvePufferPreviewInput } from './puffer-preview-input.mjs';
import { assertPufferGaitAdmission } from './puffer-gait-admission.mjs';

/** Pack one native source and compile one unchanged decision through the official SDK pipeline. */
export async function buildPufferNativePreview(dimensions, mode = 'rest', destination = resolve(import.meta.dirname, `../tmp/puffer-native-preview/${mode}`), descriptor = null) {
  assertHeavyLease('build');
  if (!['rest', 'inflate-105', 'inflate-110', 'attack', 'gait4', 'gait5'].includes(mode)) throw new Error('Unknown Puffer diagnostic pose');
  if (typeof dimensions !== 'string') throw new Error('Supply an explicit dimensions JSON; collider tuning is unaccepted');
  const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/driftwood-isle');
  // Refuse stale/foreign output rather than silently deleting data or leaving an invalid mixed inventory.
  if (existsSync(destination) && readdirSync(destination).length > 0) throw new Error('Practice output must be a new or empty directory');
  const input = resolvePufferPreviewInput(root, descriptor, dimensions);
  const { candidate, source, sourceRelative, sourceBytes, dimensionBytes, measurementSha256 } = input;
  const rigAdmission = mode === 'gait4' || mode === 'gait5' ? assertPufferGaitAdmission(root, input, mode) : null;
  const packed = resolve(destination, 'pack'), productDirectory = resolve(destination, 'product');
  mkdirSync(destination, { recursive: true });
  writeFileSync(resolve(destination, 'unaccepted-dimensions.json'), dimensionBytes, { flag: 'wx' });
  execFileSync('python3', [resolve(root, 'art/driftwood-isle/approved-puffer/native_export.py'), source,
    resolve(destination, 'unaccepted-dimensions.json'), packed], { stdio: 'inherit' });
  const metadata = JSON.parse(readFileSync(resolve(packed, 'metadata.json'), 'utf8'));
  const bones = metadata.bodies?.[0]?.bones;
  if (!Array.isArray(bones) || bones.find(row => row.name === 'head')?.parent !== 'belly'
    || bones.find(row => row.name === 'belly')?.parent !== 'body') throw new Error('Preview requires head under belly under body');
  const authorRequire = createRequire(resolve(root, 'src/sdk/package.json'));
  const result = await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'silent',
    define: { __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision(root)),
      'import.meta.dirname': JSON.stringify(resolve(root, 'src/sdk')) },
    plugins: [{ name: 'practice-author-node', enforce: 'pre', resolveId(id) {
      if (id === 'vite') return { id: import.meta.resolve('vite'), external: true };
      if (id === 'sharp' || id === 'binaryen' || /^assemblyscript(?:\/|$)/u.test(id)) return { id: pathToFileURL(authorRequire.resolve(id)).href, external: true };
      return null;
    } }],
    build: { write: false, minify: false, lib: { entry: resolve(project, 'generators/pufferNativePreview.ts'), formats: ['es'], fileName: 'puffer-native-preview-product' },
      rolldownOptions: { platform: 'node', external: [/^node:/u], output: { codeSplitting: false } } },
  });
  const output = Array.isArray(result) ? result.at(0) : result;
  if (output === undefined || !('output' in output)) throw new Error('Practice author bundle produced no output');
  const chunks = output.output.filter(chunk => chunk.type === 'chunk'), chunk = chunks.at(0);
  if (chunks.length !== 1 || chunk === undefined) throw new Error('Practice author bundle must contain one module');
  const author = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  if (typeof author.buildPufferPreviewProduct !== 'function') throw new Error('Practice author entry is missing');
  const lines = decisionLegacyLines(root, 'driftwood-isle');
  if (lines === undefined) throw new Error('Practice decisions require the sealed Driftwood line budget');
  const rootFlinch = rigAdmission?.profile === 'v70-rig1-gait5' ? 'authored-pose' : undefined;
  const product = await author.buildPufferPreviewProduct(project, productDirectory, { decisionLegacyLines: lines }, metadata, mode, rootFlinch);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(destination, 'preview.json'), JSON.stringify({
    schema: 'wildshard.puffer.native-preview.v1', candidate, mode,
    ...(rigAdmission === null ? {} : { rigAdmission }),
    ...(rootFlinch === undefined ? {} : { rootFlinch }),
    ...(mode === 'gait5' ? { visualAdapter: 'puffer-gait5-continuity', visualAdapterSha256: hash(readFileSync(resolve(root, 'src/pufferGaitContinuityPreview.ts'))) } : {}),
    source: sourceRelative, measurementSha256, sourceSha256: hash(sourceBytes), metadataSha256: hash(readFileSync(resolve(packed, 'metadata.json'))),
    dimensionsSha256: hash(dimensionBytes), colliderAcceptance: false, visualAcceptance: false,
    rendering: 'Actual-engine arena preview; not full Model Explorer Solid/Paint or frozen Noon proof',
    packedSha256: hash(readFileSync(resolve(packed, 'payload.bin'))), bodyFile: metadata.file,
    sourceHash: product.index.build.sourceHash,
  }, null, 2));
  return product.index;
}

const command = process.argv.at(1);
if (command !== undefined && import.meta.url === pathToFileURL(resolve(command)).href) {
  try {
    if (process.argv.at(2) === '--app') {
      const config = pufferPreviewConfig({ command: 'build', mode: 'production' });
      const outDir = process.argv.at(3);
      await build({ ...config, configFile: false,
        ...(outDir === undefined ? {} : { build: { ...config.build, outDir: resolve(outDir) } }) });
    } else {
    const dimensions = process.argv.at(2), mode = process.argv.at(3) ?? 'rest', output = process.argv.at(4);
    const index = await buildPufferNativePreview(dimensions, mode, output === undefined ? undefined : resolve(output), process.argv.at(5));
    console.info(JSON.stringify({ slug: index.identity.slug, sourceHash: index.build.sourceHash,
      mode, files: index.files.length, wasm: index.files.filter(file => file.kind === 'wasm').length,
      visualAcceptance: false, colliderAcceptance: false }));
    }
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
