#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' code-built creature bodies baked offline,
// and (G345) the generated strider fitted and skinned from its rows (generators/hulls.ts) through the client's own model intake.
// The generators run here only; each body's skinned GLB goes to public/assets/sunscar-dunes/rigs/<name>.glb, which the
// client reads (world/meshes.ts duneRig); the strider's skeleton goes to data/striderRig.baked.ts.
// test/shards/sunscar-dunes/rig-bake.test.ts is the byte-exact stale gate (it re-runs the generator).
// Usage: node --import ./scripts/bake-loader.mjs src/shards/sunscar-dunes/generators/bake-signal-rigs.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../../..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/rigs');
const RIGS = [['skitterer', 'generators/species.ts', 'bakeSignalSkitterer']];
const at = (path) => import(pathToFileURL(resolve(project, path)).href);
const check = process.argv.includes('--check');
const emit = (file, bytes) => {
  if (check) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`STALE ${file}`);
  } else writeFileSync(file, bytes);
};
if (!check) mkdirSync(out, { recursive: true });
const keep = new Set();
for (const [name, file, bake] of RIGS) {
  const generator = await import(pathToFileURL(resolve(project, file)).href);
  const { glb } = generator[bake]();
  emit(resolve(out, `${name}.glb`), glb); keep.add(`${name}.glb`);
  console.info(`sunscar-dunes ${name}: ${String(glb.length)} bytes → rigs/${name}.glb`);
}
// the strider: the client's intake of its generated model (the model library, reading public/ through the bake fetch)
{
  const { installBakeEnvironment } = await import(pathToFileURL(resolve(root, 'scripts/bake/environment.mjs')).href);
  const environment = installBakeEnvironment(root);
  try {
    const [{ createModelLibrary }, { DUNE_MODELS }, { STRIDER_HULL }, { bakeSignalStrider }] = await Promise.all([
      import(pathToFileURL(resolve(root, 'src/sdk/looks/modelLibrary.ts')).href), at('data/files.ts'), at('data/hulls.ts'), at('generators/hulls.ts')]);
    const library = createModelLibrary({ ...DUNE_MODELS, meshes: ['dune-strider'], hd: [], rigs: [] }, '[sunscar-dunes bake]');
    await library.preload();
    const source = library.mesh('dune-strider');
    if (source === null) throw new Error('dune-strider did not load');
    const { glb, rig } = bakeSignalStrider(source, STRIDER_HULL);
    emit(resolve(out, 'strider.glb'), glb); keep.add('strider.glb');
    emit(resolve(project, 'data/striderRig.baked.ts'), new TextEncoder().encode(rig));
    console.info(`sunscar-dunes strider: ${String(glb.length)} bytes → rigs/strider.glb`);
  } finally { environment.dispose(); }
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
