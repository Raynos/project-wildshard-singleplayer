#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' code-built creature bodies baked offline,
// and (G345) the generated strider fitted and skinned from its rows (generators/hulls.ts) through the client's own model intake,
// and the generated manta band-skinned twice: the dune ray in its tint and the Matriarch untinted.
// The generators run here only; each body's skinned GLB goes to public/assets/sunscar-dunes/rigs/<name>.glb, which the
// client reads (world/meshes.ts duneRig); the strider's skeleton goes to data/striderRig.json.
// test/shards/sunscar-dunes/rig-bake.test.ts is the byte-exact stale gate (it re-runs the generator).
// G320 (SF87): author-only. Every input is a literal import from this shard's authoring folders, the SDK or a package, under
// the SDK's authoring loader (no game, engine, runtime or look module), and the two generated models are read from their
// retained authoring copies (assets/models/, the same bytes as public/assets/sunscar-dunes/models/) through the library's
// facet intake (generators/facets.ts); no committed output is read back as a seed.
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/sunscar-dunes/generators/bake-signal-rigs.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeSignalRigSources } from './rigSources.ts';

const root = resolve(import.meta.dirname, '../../../..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/rigs');
const check = process.argv.includes('--check');
const emit = (file, bytes) => {
  if (check) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`STALE ${file}`);
  } else writeFileSync(file, bytes);
};
if (!check) mkdirSync(out, { recursive: true });
const keep = new Set();
const files = await bakeSignalRigSources(
  new Uint8Array(readFileSync(resolve(project, 'assets/models/dune-strider.glb'))),
  new Uint8Array(readFileSync(resolve(project, 'assets/models/dune-matriarch.glb'))));
for (const [name, bytes] of files) {
  if (name === 'striderRig.json') emit(resolve(project, 'data/striderRig.json'), bytes);
  else {
    emit(resolve(out, name), bytes); keep.add(name);
    console.info(`sunscar-dunes ${name}: ${String(bytes.length)} bytes → rigs/${name}`);
  }
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
