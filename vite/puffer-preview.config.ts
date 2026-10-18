import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { rapierAlias, rapierPreviewPlugin } from './rapier.ts';
import { assertHeavyLease } from '../scripts/heavy-lane-lease.mjs';
import { starterArmClipsTableSource } from '../scripts/gen-starter-arm-clips.mjs';
import { starterEffectsTableSource } from '../scripts/gen-starter-effects.mjs';

/** Explicit developer artifact; never alters the production entry or world asset inventory. */
export const pufferPreviewConfig = defineConfig(({ command }) => {
  if (command === 'build') assertHeavyLease('build');
  const preview = resolve(process.env.PUFFER_PREVIEW_DIR ?? 'tmp/puffer-native-preview/rest');
  const product = resolve(join(preview, 'product'));
  const outDir = 'tmp/puffer-native-preview-dist';
  let destinationRoot = outDir;
  let bundleWritten = false;
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
  if (!('mode' in receiptPreview) || typeof receiptPreview.mode !== 'string' || !['rest', 'inflate-105', 'inflate-110', 'attack', 'gait4'].includes(receiptPreview.mode)) throw new Error('Unknown Puffer preview mode');
  const mode = receiptPreview.mode;
  if (!('candidate' in receiptPreview) || typeof receiptPreview.candidate !== 'string' || !/^V[0-9]+(?: · UNACCEPTED WIP)?$/u.test(receiptPreview.candidate)) throw new Error('Invalid Puffer candidate identity');
  const candidate = receiptPreview.candidate.split(' ')[0];
  const bodyFile = bake.file.slice(1);
  const assets = [ 'assets/models/driftwood-fp/fp-arms.glb', 'assets/physics/rapier.wasm'];
  // The isolated entry must not require ignored production boot tables in a clean source export.
  // These virtual tables describe only files this preview actually copies, from their real bytes.
  const bytes: Record<string, number> = {}, versions: Record<string, string> = {};
  const include = (url: string, path: string): void => {
    const data = readFileSync(path); bytes[url] = data.byteLength;
    versions[url] = createHash('sha256').update(data).digest('hex').slice(0, 8);
  };
  for (const asset of assets) include(`/${asset}`, join('public', asset));
  include(`/${bodyFile}`, join(preview, 'pack/payload.bin'));
  const visit = (directory: string, url: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), target = `${url}/${entry.name}`;
      if (entry.isDirectory()) visit(path, target); else include(target, path);
    }
  };
  visit(product, '/practice-product');
  const tables = new Map([
    [resolve('src/game/systems/viewmodel/clips.generated'), starterArmClipsTableSource()],
    [resolve('src/game/systems/effects/starter.generated'), starterEffectsTableSource()],
    [resolve('src/game/boot/bytes.generated'), `export const PUBLIC_BYTES = ${JSON.stringify(bytes)};`],
    [resolve('src/game/boot/versions.generated'), `export const ASSET_VERSIONS = ${JSON.stringify(versions)};`],
  ]);
  return { publicDir: false, base: './', resolve: { alias: rapierAlias },
    define: { __DEVSERVER__: true, __BUILD_ID__: JSON.stringify(`puffer-native-${candidate}-unaccepted-${mode}`), __SAVE_NAMESPACES__: '[]',
      __SHARDFILE_VALIDATOR__: JSON.stringify(receipt.revision), __SHARDFILE_VERDICTS__: JSON.stringify([receipt]) },
    build: { outDir, target: 'es2022', sourcemap: false, cssCodeSplit: false,
      rolldownOptions: { input: resolve('practice.html') } },
    plugins: [rapierPreviewPlugin(), {
      name: 'puffer-native-preview-asset-tables',
      resolveId(source, importer) {
        if (importer === undefined || !source.startsWith('.')) return null;
        const path = resolve(dirname(importer), source).replace(/\.ts$/u, '');
        return tables.has(path) ? `\0puffer-preview-table:${path}.ts` : null;
      },
      load(id) { return id.startsWith('\0puffer-preview-table:') ? tables.get(id.slice('\0puffer-preview-table:'.length).replace(/\.ts$/u, '')) ?? null : null; },
    }, { name: 'puffer-native-preview-closure',
      transformIndexHtml(html) { return html.replace('Wildshard practice demo', `Puffer ${candidate} · UNACCEPTED WIP`).replace('Developer arena · rejected meshes', `Puffer ${candidate} · UNACCEPTED WIP`).replace('These five creature meshes were rejected. Approved replacement art is still in progress.', 'One unaccepted native Puffer candidate. Diagnostic pose and collider dimensions are experimental.').replace('</head>', '<style>.ws-practice-demo{top:calc(env(safe-area-inset-top,0px) + 108px);left:max(8px,env(safe-area-inset-left,0px));right:max(8px,env(safe-area-inset-right,0px))}.ws-native-preview-note{display:block;font-size:10px;margin-bottom:3px}</style></head>').replace('<section class="ws-practice-demo">', `<section class="ws-practice-demo"><small class="ws-native-preview-note">${mode} · actual-engine arena · collider tuning unaccepted</small>`); }, configResolved(config) {
        destinationRoot = config.build.outDir;
        if (command === 'build' && existsSync(destinationRoot) && readdirSync(destinationRoot).length > 0) throw new Error('Puffer preview output must be new or empty');
      }, writeBundle() { bundleWritten = true; }, closeBundle() {
      // Rollup also closes a failed build; never mask its original diagnostic with missing output copies.
      if (!bundleWritten) return;
      copyFileSync(join(destinationRoot, 'practice.html'), join(destinationRoot, 'index.html'));
      copyFileSync(join(preview, 'preview.json'), join(destinationRoot, 'puffer-preview.json'));
      const bodyDestination = join(destinationRoot, bodyFile); mkdirSync(dirname(bodyDestination), { recursive: true });
      copyFileSync(join(preview, 'pack/payload.bin'), bodyDestination);
      cpSync(product, join(destinationRoot, 'practice-product'), { recursive: true });
      for (const asset of assets) { const destination = join(destinationRoot, asset); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join('public', asset), destination); }
    } }],
  };
});
