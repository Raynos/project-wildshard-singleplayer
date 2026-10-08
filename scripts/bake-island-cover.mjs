#!/usr/bin/env node
// bake-island-cover.mjs — Driftwood's Blender-cove cover splat, at build time (SF67 fix 3, E461).
//
// BlenderIsland.build walked every instanced cover triangle (~1 M on the desktop) into the cover grid on the main thread at
// load (the audit's islandInstances.ts `coverTriangles` task, 733 ms at 4× CPU). The splat overwrites the whole area from
// island.glb, placements.bin and island.json alone, so this runs the build's own functions (islandProtos, islandSets,
// coverTrianglesOf, islandCoverBlock) in Node, once per tier (the tile counts and the phone's cover share are the tier's:
// a child process each, the tier set before the modules load), and writes public/assets/baked/driftwood-isle/
// island-cover.<tier>.bin. The page writes it back and splats only when it is missing or does not fit (BlenderIsland.ts).
// Every run bakes in memory and writes only differing bytes; --check (bake-check.mjs) fails when a source or asset changed
// without a rebake.
//
//   node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-island-cover.mjs [--check]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { byteWriter } from './bake-output.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const TIERS = ['phone', 'desktop'];
const tierArg = process.argv.find((a) => a.startsWith('--tier='))?.slice('--tier='.length);

if (tierArg === undefined) {
  // the parent: one child per tier (TIER is read once, as each module loads)
  let failed = false;
  for (const tier of TIERS) {
    const r = spawnSync(process.execPath, [...process.execArgv, import.meta.filename, `--tier=${tier}`, ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) failed = true;
  }
  if (failed) process.exitCode = 1;
} else {
  if (!TIERS.includes(tierArg)) throw new Error(`bake-island-cover: unknown tier ${tierArg}`);
  const check = process.argv.includes('--check');
  const { installBakeEnvironment } = await import('./bake/environment.mjs');
  const environment = installBakeEnvironment(ROOT);
  try {
    const src = (p) => import(pathToFileURL(resolve(ROOT, 'src', p)).href);
    (await src('engine/core/tier.ts')).initializeTier(tierArg);
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
    const island = await src('shards/driftwood-isle/world/BlenderIsland.ts');
    const { coverTrianglesOf } = await src('shards/driftwood-isle/world/islandInstances.ts');
    const dir = resolve(ROOT, 'public/assets/models/driftwood-blender');
    const glb = readFileSync(resolve(dir, 'island.glb')), bin = readFileSync(resolve(dir, 'placements.bin'));
    const meta = JSON.parse(readFileSync(resolve(dir, 'island.json'), 'utf8'));
    await MeshoptDecoder.ready;
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
    gltf.scene.updateMatrixWorld(true);
    const found = [];
    gltf.scene.traverse((o) => { if (o instanceof THREE.Mesh) found.push(o); });
    const protos = island.islandProtos(found, meta);
    const f = island.islandPlacements(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));
    const used = island.islandUsed(f, meta, tierArg === 'phone');
    const { covers, bigs } = island.islandSets(f, meta, used);
    const t0 = performance.now();
    const block = island.islandCoverBlock(coverTrianglesOf(protos, f, [covers, bigs]));
    const bytes = island.encodeIslandCover(block, used);
    const url = island.islandCoverUrl(tierArg);
    const output = byteWriter(check, 'bake-island-cover');
    output.put(resolve(ROOT, 'public', url.replace(/^\//, '')), bytes);
    console.log(`[island-cover] ${tierArg}: ${used} placements, ${block.length / 5} cells, ${(bytes.length / 1024).toFixed(1)} KB in ${(performance.now() - t0).toFixed(0)} ms`);
    output.finish();
  } finally {
    environment.dispose();
  }
}
