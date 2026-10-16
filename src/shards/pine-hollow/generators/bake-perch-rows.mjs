#!/usr/bin/env node
// G466 C3: Pine Hollow's ambient perches as rows. Plants the forest the page plants (the level installed by
// scripts/generation-level.mjs, its baked terrain grid, `placeForest` on the manifest's tree set), then reads each
// planted tree's authored trunk spine (perches.generated.json, the pine-ambient-perches job): the snags' broken tops
// become the night sentinel's perches and a seeded bark section per weighted trunk the day forager's. Writes
// src/shards/pine-hollow/data/perchRows.generated.json; the page hands the rows to its visit flocks and never probes
// a trunk.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs --import ./scripts/generation-level.mjs
//   src/shards/pine-hollow/generators/bake-perch-rows.mjs --generation-shard=pine-hollow
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setActiveChunk } from '../../../game/shard/registry.ts';
import { _installBakedTerrain } from '../../../engine/world/Heightfield.ts';
import { bakedSamplers, parseBakedTerrain } from '../../../engine/world/BakedTerrain.ts';
import { placeForest, plantSpecs } from '../../../engine/world/forest/placement.ts';
import { Rng } from '../../../engine/core/rng.ts';
import { perchRows } from './perchRows.ts';

const root = resolve(import.meta.dirname, '../../../..');
const def = setActiveChunk('pine-hollow');
_installBakedTerrain(bakedSamplers(parseBakedTerrain(Uint8Array.from(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin'))).buffer)));
const { trees } = placeForest(plantSpecs(def.trees));
const spines = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/data/perches.generated.json'), 'utf8'));
const rows = perchRows(trees, spines, new Rng(0x71fe));
writeFileSync(resolve(root, 'src/shards/pine-hollow/data/perchRows.generated.json'), `${JSON.stringify(rows)}\n`);
console.info(JSON.stringify({ trees: trees.length, snags: rows.snags.length, bark: rows.bark.length }));
