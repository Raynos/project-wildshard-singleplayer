#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's undergrowth shapes baked offline. The generator
// (src/shards/pine-hollow/generators/undergrowth.ts) runs here only and writes every kind's geometry (Float32-exact
// positions, normals and uvs, the triangles) to src/shards/pine-hollow/data/undergrowth.json, which the page builds them
// from (src/shards/pine-hollow/world/undergrowth.ts). test/shards/pine-hollow/undergrowth-bake.test.ts is the stale gate.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/generators/bake-pine-undergrowth.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakePineUndergrowth } from './undergrowth.ts';

const root = resolve(import.meta.dirname, '../../../..');
const shapes = bakePineUndergrowth();
writeFileSync(resolve(root, 'src/shards/pine-hollow/data/undergrowth.json'), `${JSON.stringify(shapes)}\n`);
console.info(`pine-hollow undergrowth: ${Object.entries(shapes).map(([kind, s]) => `${kind} ${String(s.position.length / 3)} v`).join(', ')} (data/undergrowth.json)`);
