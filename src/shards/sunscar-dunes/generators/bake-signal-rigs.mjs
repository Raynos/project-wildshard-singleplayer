#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' code-built creature bodies baked offline,
// and (G345) the generated strider fitted and skinned from its rows (generators/hulls.ts) through the client's own model intake,
// and the generated manta band-skinned twice: the dune ray in its tint and the Matriarch untinted.
// The generators run here only; each body's skinned GLB goes to public/assets/sunscar-dunes/rigs/<name>.glb, which the
// client reads (world/meshes.ts duneRig); the strider's skeleton goes to data/striderRig.baked.ts.
// test/shards/sunscar-dunes/rig-bake.test.ts is the byte-exact stale gate (it re-runs the generator).
// G320 (SF87): author-only. Every input is a literal import from this shard's authoring folders, the SDK or a package, under
// the SDK's authoring loader (no game, engine, runtime or look module), and the two generated models are read from their
// retained authoring copies (assets/models/, the same bytes as public/assets/sunscar-dunes/models/) through the library's
// facet intake (generators/facets.ts); no committed output is read back as a seed.
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/sunscar-dunes/generators/bake-signal-rigs.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeSignalSkitterer } from './species.ts';
import { bakeSignalManta, bakeSignalStrider } from './hulls.ts';
import { facetModel } from './facets.ts';
import { MANTA_HULL, RAY_TINT, STRIDER_HULL } from '../data/hulls.ts';
import { FACET_AO_FLOOR } from '../data/facets.ts';

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
{
  const { glb } = bakeSignalSkitterer();
  emit(resolve(out, 'skitterer.glb'), glb); keep.add('skitterer.glb');
  console.info(`sunscar-dunes skitterer: ${String(glb.length)} bytes → rigs/skitterer.glb`);
}
// the generated strider and manta, as the model library takes them in, from their retained authoring copies
const model = (name) => facetModel(new Uint8Array(readFileSync(resolve(project, `assets/models/${name}.glb`))), FACET_AO_FLOOR);
{
  const { glb, rig } = bakeSignalStrider(await model('dune-strider'), STRIDER_HULL);
  emit(resolve(out, 'strider.glb'), glb); keep.add('strider.glb');
  emit(resolve(project, 'data/striderRig.baked.ts'), new TextEncoder().encode(rig));
  console.info(`sunscar-dunes strider: ${String(glb.length)} bytes → rigs/strider.glb`);
  const manta = await model('dune-matriarch');
  /** @param {string} name @param {typeof RAY_TINT | null} tint */
  const bakeManta = (name, tint) => {
    const { glb: bytes } = bakeSignalManta(`sunscar.${name}`, manta.clone(), MANTA_HULL, tint);
    emit(resolve(out, `${name}.glb`), bytes); keep.add(`${name}.glb`);
    console.info(`sunscar-dunes ${name}: ${String(bytes.length)} bytes → rigs/${name}.glb`);
  };
  bakeManta('ray', RAY_TINT); bakeManta('matriarch', null);
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
