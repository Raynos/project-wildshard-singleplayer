#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Nine Dragon's layout step (the square, the towers, the Well)
// baked offline. The generator (src/shards/nine-dragon-stack/generators/layout.ts) runs it here with a recording stand-in
// for the sign builder and writes the filled build context, zlib-compressed, to public/assets/nine-dragon/baked/layout.bin,
// and its stamp (the inflated binary's hash and size) to src/shards/nine-dragon-stack/data/layout.json; the page restores
// it (src/shards/nine-dragon-stack/world/layoutBake.ts). test/shards/nine-dragon-stack/layout-bake.test.ts is the stale gate.
// Then the code-built models' geometry and the world's banyan crown (generators/specimens.ts) to baked/specimens.bin,
// stamped in data/specimens.json (world/specimens.ts; stale gate test/shards/nine-dragon-stack/specimens-bake.test.ts).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nineWorldProduct, nineLayoutWord } from './worldProduct.ts';

const root = resolve(import.meta.dirname, '../../../..');

/** Retained file adapter until the Nine source product consumes the owned result directly. */
export function writeNineScene() {
  const { metadata, layout, assets } = nineWorldProduct(), out = resolve(root, 'src/shards/nine-dragon-stack/assets');
  mkdirSync(out, { recursive: true });
  const layoutPath = 'src/shards/nine-dragon-stack/data/layout.generated.json';
  writeFileSync(resolve(root, layoutPath), JSON.stringify(layout, nineLayoutWord));
  for (const [hash, bytes] of assets) writeFileSync(resolve(out, hash), bytes);
  const metadataPath = 'src/shards/nine-dragon-stack/data/world.generated.json';
  writeFileSync(resolve(root, metadataPath), `${JSON.stringify(metadata, nineLayoutWord)}\n`);
  const outputs = [metadataPath, layoutPath, ...[...assets.keys()].map(hash => `src/shards/nine-dragon-stack/assets/${hash}`)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  console.info(`Nine scene: ${metadata.shardfile.tiles.length} L0 tiles, ${metadata.shardfile.files.length} bounded GLBs, ${assets.size} files`);
  return { metadata, outputs };
}
if (import.meta.main) writeNineScene();
