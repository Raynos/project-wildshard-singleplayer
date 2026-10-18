import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { rapierAlias, copyRapierWasm, rapierPreviewPlugin } from './rapier';
import { assertHeavyLease } from '../scripts/heavy-lane-lease.mjs';

/** Explicit developer artifact; never alters the production entry or world asset inventory. */
export default defineConfig(({ command }) => {
  if (command === 'build') assertHeavyLease('build');
  const product = resolve(process.env.PRACTICE_PRODUCT_DIR ?? 'tmp/driftwood-practice/product');
  const outDir = 'tmp/practice-demo-dist';
  let destinationRoot = outDir;
  const indexBytes = readFileSync(join(product, 'shard.json'));
  const receipt: unknown = JSON.parse(readFileSync(join(product, 'validation.json'), 'utf8'));
  if (typeof receipt !== 'object' || receipt === null || !('indexHash' in receipt) ||
      receipt.indexHash !== createHash('sha256').update(indexBytes).digest('hex') || !('revision' in receipt) || typeof receipt.revision !== 'string')
    throw new Error('Practice product needs its exact validated receipt');
  const bake: unknown = JSON.parse(readFileSync('src/shards/driftwood-isle/data/creatureBodies.generated.json', 'utf8'));
  if (typeof bake !== 'object' || bake === null || !('file' in bake) || typeof bake.file !== 'string' ||
      !/^\/assets\/driftwood-isle\/creatures\/bodies-[a-f0-9]{64}\.bin$/u.test(bake.file)) throw new Error('Invalid fixture body asset');
  const assets = [bake.file.slice(1), 'assets/models/driftwood-fp/fp-arms.glb', 'assets/physics/rapier.wasm'];
  return { publicDir: false, base: '/', resolve: { alias: rapierAlias },
    define: { __DEVSERVER__: true, __BUILD_ID__: JSON.stringify('practice-demo'), __SAVE_NAMESPACES__: '[]',
      __SHARDFILE_VALIDATOR__: JSON.stringify(receipt.revision), __SHARDFILE_VERDICTS__: JSON.stringify([receipt]) },
    build: { outDir, target: 'es2022', sourcemap: false, cssCodeSplit: false,
      rolldownOptions: { input: resolve('practice/index.html') } },
    plugins: [rapierPreviewPlugin(), { name: 'practice-demo-closure', configResolved(config) { destinationRoot = config.build.outDir; }, buildStart() { copyRapierWasm(); }, closeBundle() {
      copyFileSync(join(destinationRoot, 'practice/index.html'), join(destinationRoot, 'index.html'));
      cpSync(product, join(destinationRoot, 'practice-product'), { recursive: true });
      for (const asset of assets) { const destination = join(destinationRoot, asset); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(join('public', asset), destination); }
    } }],
  };
});
