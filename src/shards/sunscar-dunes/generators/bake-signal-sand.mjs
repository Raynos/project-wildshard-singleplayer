#!/usr/bin/env node
// SHARD-PLATFORM SF72 (RENDERING.md: a world-build output that is a pure function of committed files is baked): Signal
// Dunes' sand maps baked offline. The generator (src/shards/sunscar-dunes/generators/sand.ts) runs here only; each map's
// bytes go as single-level zstd-supercompressed KTX2 library files (src/shards/sunscar-dunes/assets/<sha256>, rows in
// data/sandMaps.json) the data client draws the sand with, and the grain tile's means to data/sand.json; the dune skirt
// (generators/skirt.ts) as a geometry pack, sand/skirt.bin, with its rows in data/skirt.json.
// test/shards/sunscar-dunes/sand-bake.test.ts is the byte-exact stale gate (it re-runs the generator).
// G320 (SF87): author-only. Every input is a literal import from this shard's authoring folders, the SDK or a package, under
// the SDK's authoring loader (no game, engine, runtime or look module; no committed output read back as a seed).
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/sunscar-dunes/generators/bake-signal-sand.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { constants, zstdCompressSync } from 'node:zlib';
import { zlibSync } from 'fflate';
import { SAND_ZSTD_LEVEL } from './sand.ts';
import { bakeSignalSandSources } from './sandSources.ts';

const root = resolve(import.meta.dirname, '../../../..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/sand');
const check = process.argv.includes('--check');
const emit = (file, bytes) => {
  if (check) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`STALE ${file}`);
  } else writeFileSync(file, bytes);
};
if (!check) mkdirSync(out, { recursive: true });
const files = bakeSignalSandSources(bytes => zlibSync(bytes, { level: 9 }),
  bytes => new Uint8Array(zstdCompressSync(bytes, { params: { [constants.ZSTD_c_compressionLevel]: SAND_ZSTD_LEVEL } })));
for (const [name, bytes] of files) {
  const target = name.startsWith('sand/') ? resolve(out, name.slice(5)) : resolve(project, name.startsWith('assets/') ? name : `data/${name}`);
  emit(target, bytes);
  console.info(`sunscar-dunes ${name}: ${String(bytes.length)} bytes`);
}
// the folder holds exactly this bake: no orphan map from an older bake ships
for (const entry of readdirSync(out)) if (!files.has(`sand/${entry}`)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
