// node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/driftwood-isle/generators/bake-driftwood-fixed-models.mjs [--check]
// The original fixed builders run offline; no colour quantization, simplification or material conversion.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { driftwoodScene } from './scene.ts';
import { WorldBakeRows } from '@wildshard/sdk/bake/worldRows';
import { bakeQueryTerrain, readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { driftwoodGroundBytes } from './groundRows.ts';

const assets = new URL('../../../../public/assets/driftwood-isle/baked/fixed-models/', import.meta.url);
const check = process.argv.includes('--check');
const write = (url, bytes) => {
  if (!process.argv.includes('--force-write') && existsSync(url) && readFileSync(url).equals(Buffer.from(bytes))) return;
  if (check) { console.error(`bake-fixed-models: STALE ${url.pathname}`); process.exitCode = 1; }
  else writeFileSync(url, bytes);
};
if (!check) mkdirSync(assets, { recursive: true });
const material = new MeshStandardMaterial({ vertexColors: true });
const emit = (name, geometry) => {
  const glb = staticGlb([{ geometry, material, customAttributes: geometry.hasAttribute('aSway') ? { _SWAY: 'aSway' } : {} }], name);
  write(new URL(`${name}.glb`, assets), glb);
  geometry.dispose();
};
const { baked, fixed } = driftwoodScene(`${import.meta.dirname}/../../../..`);
for (const [name, geometry] of fixed.geometries) emit(name, geometry);
for (const [name, value] of Object.entries(fixed.rows)) write(new URL(`../data/${name}.json`, import.meta.url), `${JSON.stringify(value, null, 2)}\n`);
if (baked.props === null) throw new Error('Driftwood scene must contain its static world');
const library = new WorldBakeRows(), templateFiles = [];
for (const part of baked.pieces) {
  const row = library.asset(part.glb, 'glb'); templateFiles.push(row.hash); baked.assets.set(row.hash, part.glb);
}
const libraryRows = library.finish('toon');
const queries = bakeQueryTerrain(readNativeTerrain(driftwoodGroundBytes()), { normalEpsilon: 0.6, datum: -0.8 });
for (const [hash, bytes] of queries.assets) baked.assets.set(hash, bytes);
const files = [...baked.shardfile.files, ...libraryRows.files, ...queries.files].sort((a, b) => a.hash.localeCompare(b.hash));
const product = { terrain: queries.terrain, props: { ...baked.props.props, wholeLibrary: templateFiles }, tiles: baked.shardfile.tiles, files,
  library: templateFiles, critical: [...baked.shardfile.critical, ...queries.critical], templateFiles,
  report: baked.props.report, libraryCost: { resident: libraryRows.files.reduce((sum, file) => sum + file.decoded + file.gpu, 0),
    compressed: libraryRows.files.reduce((sum, file) => sum + file.compressed, 0) } };
const folder = new URL('../assets/', import.meta.url);
if (!check) mkdirSync(folder, { recursive: true });
for (const [hash, bytes] of baked.assets) write(new URL(hash, folder), bytes);
write(new URL('../data/fixedTiles.generated.json', import.meta.url), `${JSON.stringify(product)}\n`);
console.info(`Driftwood scene: ${fixed.geometries.size} source draws, ${product.tiles.length} tiles, ${baked.pieces.length} library subsets; ${baked.scenePath}`);
material.dispose();
