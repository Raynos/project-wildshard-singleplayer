// node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/driftwood-isle/generators/bake-driftwood-fixed-models.mjs [--check]
// The original fixed builders run offline; no colour quantization, simplification or material conversion.
import { nameBlob } from '@wildshard/sdk/blobs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Mesh, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { castawayHead } from './castawayHead.ts';
import { driftwoodScene } from './scene.ts';
import { driftwoodCoarseTiles } from './coarseTiles.ts';
import { WorldBakeRows } from '@wildshard/sdk/bake/worldRows';
import { bakeQueryTerrain, readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { driftwoodGroundBytes } from './groundRows.ts';

const blobRows = new Map(), blobAliases = new Map();
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
  const customAttributes = Object.fromEntries(Object.keys(geometry.attributes).filter((key) => !['position', 'normal', 'color', 'uv'].includes(key))
    .map((key) => [key === 'aSway' ? '_SWAY' : `_${key.toUpperCase()}`, key]));
  const glb = staticGlb([{ geometry, material, customAttributes, ...(['bridge-plank-unit', 'bridge-rope-unit'].includes(name) ? { nativeAttributes: true, compactIndex: true } : name === 'cover-driftwood' ? { compactIndex: true } : {}) }], name);
  write(new URL(`${name}.glb`, assets), glb);
  const blob = nameBlob(`models/fixed/${name}.glb`, 'glb', glb), previous = blobRows.get(blob.file.hash);
  const row = previous ?? { name: blob.file.name, kind: 'glb', source: `assets/${blob.file.hash}` };
  blobRows.set(blob.file.hash, row);
  blobAliases.set(`/assets/driftwood-isle/baked/fixed-models/${name}.glb`, row.name);
  write(new URL(`../${row.source}`, import.meta.url), blob.bytes);
  geometry.dispose();
};
const headSource = await readSourceModel(new Uint8Array(readFileSync(new URL('../../../../public/assets/models/driftwood-hero/faces/wendell-head.glb', import.meta.url))));
headSource.gltf.scene.updateMatrixWorld(true);
/** @type {Mesh[]} */
const heads = [];
headSource.gltf.scene.traverse(node => { if (node instanceof Mesh) heads.push(node); });
if (heads.length !== 1) throw new Error('Wendell head source must contain one mesh');
const headMesh = heads.at(0);
if (headMesh === undefined) throw new Error('Missing authored Wendell head');
const head = castawayHead(headMesh.geometry.clone().applyMatrix4(headMesh.matrixWorld));
const aoBytes = new Uint8Array(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
const { baked, fixed } = driftwoodScene(`${import.meta.dirname}/../../../..`, head, aoBytes);
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
// T8 (G786) / G748: the occupied L1 parents' coarse tiles (generators/coarseTiles.ts): rows here, bytes from the output hook
const coarse = driftwoodCoarseTiles(aoBytes), coarseTiles = coarse.tiles.filter(tile => !baked.shardfile.tiles.some(row => row.lod === 1 && row.x === tile.x && row.z === tile.z));
const files = [...baked.shardfile.files, ...libraryRows.files, ...queries.files, ...coarse.files].sort((a, b) => a.hash.localeCompare(b.hash));
const product = { terrain: queries.terrain, props: { ...baked.props.props, tiles: [...baked.props.props.tiles, ...coarse.models.filter(model => coarseTiles.some(tile => tile.files.includes(model.file)))], wholeLibrary: templateFiles }, tiles: [...baked.shardfile.tiles, ...coarseTiles], files,
  library: templateFiles, critical: [...baked.shardfile.critical, ...queries.critical], templateFiles,
  report: baked.props.report, libraryCost: { resident: libraryRows.files.reduce((sum, file) => sum + file.decoded + file.gpu, 0),
    compressed: libraryRows.files.reduce((sum, file) => sum + file.compressed, 0) } };
const folder = new URL('../assets/', import.meta.url);
if (!check) mkdirSync(folder, { recursive: true });
for (const [hash, bytes] of baked.assets) write(new URL(hash, folder), bytes);
write(new URL('../data/fixedTiles.generated.json', import.meta.url), `${JSON.stringify(product)}\n`);
console.info(`Driftwood scene: ${fixed.geometries.size} source draws, ${product.tiles.length} tiles, ${baked.pieces.length} library subsets; ${baked.scenePath}`);
const blobs = [...blobRows.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const byUrl = Object.fromEntries([...blobAliases].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
write(new URL('../data/fixedBlobs.generated.json', import.meta.url), `${JSON.stringify({ blobs, byUrl }, null, 2)}\n`);
material.dispose();
