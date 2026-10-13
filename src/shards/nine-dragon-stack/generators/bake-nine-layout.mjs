#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Nine Dragon's layout step (the square, the towers, the Well)
// baked offline. The generator (src/shards/nine-dragon-stack/generators/layout.ts) runs it here with a recording stand-in
// for the sign builder and writes the filled build context, zlib-compressed, to public/assets/nine-dragon/baked/layout.bin,
// and its stamp (the inflated binary's hash and size) to src/shards/nine-dragon-stack/data/layout.json; the page restores
// it (src/shards/nine-dragon-stack/world/layoutBake.ts). test/shards/nine-dragon-stack/layout-bake.test.ts is the stale gate.
// Then the code-built models' geometry and the world's banyan crown (generators/specimens.ts) to baked/specimens.bin,
// stamped in data/specimens.json (world/specimens.ts; stale gate test/shards/nine-dragon-stack/specimens-bake.test.ts).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/nine-dragon-stack/generators/bake-nine-layout.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeNineLayout } from './layout.ts';
import { bakeNineSpecimens } from './specimens.ts';
import { banyanOut } from '../world/banyanPlan.ts';

const root = resolve(import.meta.dirname, '../../../..');

const stampOf = (bin) => ({ version: 1, bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length });

/** the bake's inflated binary and its stamp */
export function nineLayoutBake() {
  const bin = bakeNineLayout();
  return { bin, stamp: stampOf(bin) };
}

/** the specimens bake (generators/specimens.ts) over the layout's banyan plan (run the layout first) */
export function nineSpecimensBake() {
  const bins = bakeNineSpecimens(banyanOut.plan?.lumps ?? []);
  const { version: _b, ...boot } = stampOf(bins.boot), { version: _e, ...explorer } = stampOf(bins.explorer);
  return { bins, stamp: { version: 1, boot, explorer } };
}

/** Nine's entire static scene as regenerated shardfile tiles and standard library GLBs. */
export async function writeNineScene() {
  const [{ nineScene }, { parseGlb }] = await Promise.all([import('./scene.ts'), import('@wildshard/sdk/assets')]);
  const product = nineScene(root), { baked } = product, out = resolve(root, 'src/shards/nine-dragon-stack/assets');
  mkdirSync(out, { recursive: true });
  const libraries = { layout: [], boot: [], explorer: [] }, assets = new Map(baked.assets), files = [...baked.shardfile.files];
  for (const part of baked.pieces) {
    const hash = createHash('sha256').update(part.glb).digest('hex'); assets.set(hash, part.glb);
    files.push({ hash, kind: 'glb', compressed: part.glb.length, ...parseGlb(part.glb), dependencies: [], critical: false });
    const section = part.name.startsWith('layout_sets_') ? 'layout' : part.name.startsWith('specimens_boot_') ? 'boot' : 'explorer';
    libraries[section].push(hash);
  }
  for (const [hash, bytes] of assets) writeFileSync(resolve(out, hash), bytes);
  files.sort((a, b) => a.hash.localeCompare(b.hash));
  const metadata = { version: 1, notice: 'DO NOT EDIT: generators/bake-nine-layout.mjs through bake(scene, identity).',
    layout: { rows: product.layout.rows, records: product.layout.records }, libraries, specimenBoxes: product.boxes,
    shardfile: { ...baked.shardfile, files, library: [...libraries.layout, ...libraries.boot, ...libraries.explorer].sort((a, b) => a < b ? -1 : a > b ? 1 : 0) }, props: baked.props?.props, report: baked.props?.report };
  const replacer = (_key, value) => typeof value === 'number' && Object.is(value, -0) ? '-0'
    : value === Infinity ? 'Infinity' : value === -Infinity ? '-Infinity' : value;
  const metadataPath = 'src/shards/nine-dragon-stack/data/world.generated.json';
  writeFileSync(resolve(root, metadataPath), `${JSON.stringify(metadata, replacer)}\n`);
  const outputs = [metadataPath, ...[...assets.keys()].map(hash => `src/shards/nine-dragon-stack/assets/${hash}`)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  console.info(`Nine scene: ${baked.shardfile.tiles.length} L0 tiles, ${files.length} bounded GLBs, ${assets.size} files, scene.json ${baked.scenePath}`);
  return { metadata, outputs };
}
if (import.meta.main) await writeNineScene();
