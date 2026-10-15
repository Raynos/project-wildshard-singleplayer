// Cold authored geometry table: no world boot, prior table, renderer or procedural page fallback.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Rng } from '../src/engine/core/rng.ts';
import { seedOf, paramsOf } from '../src/engine/models/model.ts';
import { recordGeometryBake, encodeGeometryBake, addGeometryBake, geometryBakeStats } from '../src/engine/world/geometryBake.ts';
import { shoreBoulder } from '../src/shards/driftwood-isle/models/shoreBoulder.ts';
import { smallRock } from '../src/shards/driftwood-isle/models/smallRock.ts';
import { reefRock } from '../src/shards/driftwood-isle/models/reefRock.ts';
import { byteWriter } from './bake-output.mjs';

const root = resolve(import.meta.dirname, '..');
const entry = process.argv[2];
if (!entry || entry.startsWith('--')) throw new Error('Expected the authored rock producer module');
const { sculptBakedRock } = await import(pathToFileURL(resolve(root, entry)).href);
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const meta = json('public/assets/models/driftwood-blender/island.json');
const facts = json('src/shards/driftwood-isle/data/islandFacts.generated.json');
const bytes = readFileSync(resolve(root, 'public/assets/models/driftwood-blender/placements.bin'));
const f = new Float32Array(Uint8Array.from(bytes).buffer);
const shore = json('src/shards/driftwood-isle/data/shoreBoulders.generated.json');
const small = [];
for (let i = 0; i < meta.mustDraw; i++) {
  const o = i * 10, pi = f[o] ?? 0;
  if (!/^smallrock\d+$/u.test(meta.protos[pi]?.name ?? '')) continue;
  const sc = f[o + 8] ?? 1, { half, top } = facts[pi] ?? { half: 0.4, top: 0.25 }, r = half * sc / 1.1;
  small.push({ r, sq: Math.min(0.9, Math.max(0.4, top * sc / (0.92 * r))) });
}
// These models only lend the material identity; no shader is compiled by an author build.
const context = { sky: { setupMaterial() { /* Author geometry never compiles a material. */ } } };
function build(def, params, rng) {
  const parts = def.build(context, params, rng);
  if (!Array.isArray(parts)) throw new Error(`Expected rock parts: ${def.id}`);
  for (const part of parts) part.geometry.dispose();
}
function visit() {
  for (const [def, rows] of [[shoreBoulder, shore.specs.map(row => ({ r: row.r, squash: row.squash ?? 0.7 }))], [smallRock, small]]) {
    const rng = new Rng(seedOf(def));
    for (const params of rows) build(def, params, rng);
  }
  for (const def of [shoreBoulder, smallRock, reefRock]) {
    for (const variant of def.variants) build(def, paramsOf(def, variant.id, undefined), new Rng(seedOf(def)));
  }
}
const output = resolve(root, 'public/assets/models/driftwood-blender/geometry.bin');
if (process.argv.includes('--verify')) {
  const release = addGeometryBake(Uint8Array.from(readFileSync(output)).buffer), before = geometryBakeStats();
  try {
    visit();
    const after = geometryBakeStats();
    if (after.hits === before.hits || after.misses !== before.misses) throw new Error('Required rock recipe missed its table');
    console.log(`Rock table: all world and Explorer recipes admitted (${after.hits - before.hits} hits)`);
  } finally { release(); }
} else {
  const recording = recordGeometryBake(sculptBakedRock);
  try { visit(); } finally { recording.stop(); }
  const result = encodeGeometryBake(recording.entries), writer = byteWriter(process.argv.includes('--check'), 'bake-driftwood-rocks');
  writer.put(output, result); writer.finish();
  console.log(`Rock table: ${recording.entries.size} authored recipes, ${result.length} bytes`);
}
