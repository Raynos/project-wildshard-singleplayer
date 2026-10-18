import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { rapierAlias, rapierPreviewPlugin } from './rapier.ts';
import { assertHeavyLease } from '../scripts/heavy-lane-lease.mjs';

/** Explicit developer artifact; never alters the production entry or world asset inventory. */
export const pufferPreviewConfig = defineConfig(({ command }) => {
  if (command === 'build') assertHeavyLease('build');
  const preview = resolve(process.env.PUFFER_PREVIEW_DIR ?? 'tmp/puffer-native-preview/rest');
  const product = resolve(join(preview, 'product'));
  const outDir = 'tmp/puffer-native-preview-dist';
  let destinationRoot = outDir;
  const indexBytes = readFileSync(join(product, 'shard.json'));
  const receipt: unknown = JSON.parse(readFileSync(join(product, 'validation.json'), 'utf8'));
  if (typeof receipt !== 'object' || receipt === null || !('indexHash' in receipt) ||
      receipt.indexHash !== createHash('sha256').update(indexBytes).digest('hex') || !('revision' in receipt) || typeof receipt.revision !== 'string')
    throw new Error('Practice product needs its exact validated receipt');
  const bake: unknown = JSON.parse(readFileSync(join(preview, 'pack/metadata.json'), 'utf8'));
  if (typeof bake !== 'object' || bake === null || !('file' in bake) || typeof bake.file !== 'string' ||
      !/^\/assets\/driftwood-isle\/puffer-native-[a-f0-9]{64}\.bin$/u.test(bake.file)) throw new Error('Invalid fixture body asset');
  const receiptPreview: unknown = JSON.parse(readFileSync(join(preview, 'preview.json'), 'utf8'));
  const hash = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
  if (typeof receiptPreview !== 'object' || receiptPreview === null || !('metadataSha256' in receiptPreview) || !('packedSha256' in receiptPreview) || typeof receiptPreview.packedSha256 !== 'string'
    || receiptPreview.metadataSha256 !== hash(join(preview, 'pack/metadata.json')) || receiptPreview.packedSha256 !== hash(join(preview, 'pack/payload.bin'))
    || !bake.file.includes(receiptPreview.packedSha256)) throw new Error('Native preview body receipt mismatch');
  if (!('mode' in receiptPreview) || typeof receiptPreview.mode !== 'string' || !['rest', 'inflate-105', 'inflate-110', 'attack'].includes(receiptPreview.mode)) throw new Error('Unknown Puffer preview mode');
  const mode = receiptPreview.mode;
  const bodyFile = bake.file.slice(1);
  const assets = [ 'assets/models/driftwood-fp/fp-arms.glb', 'assets/physics/rapier.wasm'];
  return { publicDir: false, base: './', resolve: { alias: rapierAlias },
    define: { __DEVSERVER__: true, __BUILD_ID__: JSON.stringify(`puffer-native-v23-unaccepted-${mode}`), __SAVE_NAMESPACES__: '[]',
      __SHARDFILE_VALIDATOR__: JSON.stringify(receipt.revision), __SHARDFILE_VERDICTS__: JSON.stringify([receipt]) },
    build: { outDir, target: 'es2022', sourcemap: false, cssCodeSplit: false,
      rolldownOptions: { input: resolve('practice.html') } },
    plugins: [rapierPreviewPlugin(), { name: 'puffer-native-preview-closure',
      transformIndexHtml(html) { return html.replace('Wildshard practice demo', 'Puffer V23 · UNACCEPTED WIP').replace('Developer arena · rejected meshes', 'Puffer V23 · UNACCEPTED WIP').replace('These five creature meshes were rejected. Approved replacement art is still in progress.', 'One unaccepted native Puffer candidate. Diagnostic pose and collider dimensions are experimental.').replace('<body>', `<body><p style="position:fixed;top:0;left:0;right:0;z-index:10000;background:#351e10;color:white;text-align:center;font:12px sans-serif;pointer-events:none">V23 UNACCEPTED WIP · ${mode} · actual-engine arena · collider tuning unaccepted</p>`); }, configResolved(config) {
        destinationRoot = config.build.outDir;
        if (command === 'build' && existsSync(destinationRoot) && readdirSync(destinationRoot).length > 0) throw new Error('Puffer preview output must be new or empty');
      }, closeBundle() {
      copyFileSync(join(destinationRoot, 'practice.html'), join(destinationRoot, 'index.html'));
      copyFileSync(join(preview, 'preview.json'), join(destinationRoot, 'puffer-preview.json'));
      const bodyDestination = join(destinationRoot, bodyFile); mkdirSync(dirname(bodyDestination), { recursive: true });
      copyFileSync(join(preview, 'pack/payload.bin'), bodyDestination);
      cpSync(product, join(destinationRoot, 'practice-product'), { recursive: true });
      for (const asset of assets) { const destination = join(destinationRoot, asset); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join('public', asset), destination); }
    } }],
  };
});
