#!/usr/bin/env node
// Tile streaming P1 (G652): Pine Hollow's ground as 64 L0 + 16 L1 splat tiles (G227, @wildshard/sdk/bake/splatGround).
// Cuts the live chunk mesh from the committed WSTR256 bake with the forest the page plants as a canopy channel (the level
// installed by scripts/generation-level.mjs) and the bear cave's drawn openings left out, and resolves the four ground
// layers' KTX2 files on each tier as the runtime's texture arrays do (Pine's phone draws its ASTC 6x6 twins). Writes every
// GLB and layer file content-addressed to src/shards/pine-hollow/assets/ and the rows (the props.splat row, the tiles and
// their file rows) to src/shards/pine-hollow/data/groundTiles.generated.json, which the product merges into its props.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs --import ./scripts/generation-level.mjs
//   src/shards/pine-hollow/generators/bake-pine-ground.mjs --generation-shard=pine-hollow
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeSplatGround, nativeSplatGround, splatGroundSource, splatLayerFiles } from '@wildshard/sdk/bake/splatGround';
import { parseKtx2 } from '@wildshard/sdk/assets';
import { terrainOpeningHits } from '@wildshard/game/shardfile/pagePreparation';
import { PINE_GROUND } from './groundTiles.ts';

const root = resolve(import.meta.dirname, '../../../..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Pine's KTX2 table (play code: read as data, as bake-pine-props does)
const table = (() => { const text = readFileSync(resolve(root, 'src/shards/pine-hollow/ktx2.generated.ts'), 'utf8'); return JSON.parse(text.slice(text.indexOf(' = {') + 3, text.lastIndexOf('}') + 1)); })();
const terrain = new Uint8Array(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin')));
const ground = nativeSplatGround('pine-hollow', terrain);
// the bear cave's drawn openings, as the page punches them (world/crag-cave.json's holes in the cave's frame)
const layout = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/data/layout.generated.json'), 'utf8'));
const cave = JSON.parse(readFileSync(resolve(root, 'public/assets/models/pine-hollow-crags/cave.json'), 'utf8'));
const openings = { frame: { x: layout.BEAR_CAVE.x, z: layout.BEAR_CAVE.z, yaw: layout.BEAR_CAVE.rot }, cuts: [], holes: cave.holes };
const tiles = await bakeSplatGround(splatGroundSource(terrain, ground.canopy, (...corners) => terrainOpeningHits(openings, ...corners)), PINE_GROUND);

const out = resolve(root, 'src/shards/pine-hollow/assets'); mkdirSync(out, { recursive: true });
const textures = new Map();
const layerFile = (path) => {
  const bytes = new Uint8Array(readFileSync(resolve(root, `public${path}`))), ref = hash(bytes);
  if (!textures.has(ref)) { writeFileSync(resolve(out, ref), bytes); textures.set(ref, { hash: ref, kind: 'ktx2', compressed: bytes.length, ...parseKtx2(bytes), dependencies: [], critical: false }); }
  return ref;
};
const paths = splatLayerFiles(ground.layers, table);
const roles = (set) => ({ colour: set.colour.map(layerFile), normal: set.normal.map(layerFile), arm: set.arm.map(layerFile) });
const layers = roles(paths.desktop), phone = roles(paths.phone);
const splat = { material: PINE_GROUND.material, layers, ...(JSON.stringify(phone) === JSON.stringify(layers) ? {} : { phone }),
  tints: ground.tints, boreal: ground.boreal };
const dependencies = [...textures.keys()];
const rows = tiles.map(({ tile, bytes, cost, geometricError }) => {
  const ref = hash(bytes); writeFileSync(resolve(out, ref), bytes);
  return { lod: tile.lod, x: tile.x, z: tile.z, bounds: tile.bounds, geometricError,
    file: { hash: ref, kind: 'glb', compressed: bytes.length, ...cost, dependencies, critical: false } };
});
writeFileSync(resolve(root, 'src/shards/pine-hollow/data/groundTiles.generated.json'), `${JSON.stringify({ splat, tiles: rows, textures: [...textures.values()] })}\n`);
console.info(JSON.stringify({ tiles: rows.length, l0: rows.filter(r => r.lod === 0).reduce((n, r) => n + r.file.compressed, 0),
  l1: rows.filter(r => r.lod === 1).reduce((n, r) => n + r.file.compressed, 0), textures: textures.size,
  textureBytes: [...textures.values()].reduce((n, t) => n + t.compressed, 0), canopy: Math.max(...ground.canopy) }));
