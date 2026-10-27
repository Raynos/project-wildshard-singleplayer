// Test-only explicit native authoring composition; no scheduler or product entry reads this preload.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { authoredManifestSource, shardManifestPath } from '../../scripts/authored-manifest.mjs';
import { readProgramDiscovery, usesProgramDiscovery } from '../../scripts/program-discovery.mjs';
// Explicit build-tool composition root: install only this generator's real manifest, never a second shard's runtime.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installShards } from '../../src/game/shard/list.ts';
import { prepareNativeScalarBlocks } from '../../scripts/bake/nativeWorld.mjs';

const slug=process.argv.find(arg=>arg.startsWith('--generation-shard='))?.slice(19);
if(slug===undefined || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Missing generator shard');
const root = resolve(import.meta.dirname, '../..');
const manifestJson = resolve(root, `src/shards/${slug}/manifest.json`);
if (existsSync(manifestJson)) {
  // A manifest that binds program values reads them as pnpm gen does (gen-shards discoverySource): from the current
  // product's sealed discovery receipt, so the build must have run; never rows of the fixture's own.
  const program = usesProgramDiscovery(JSON.parse(readFileSync(manifestJson, 'utf8')));
  writeFileSync(resolve(root, shardManifestPath(root, slug)), authoredManifestSource(root, slug,
    { generation: true, ...(program ? { discovery: readProgramDiscovery(root, slug) } : {}) }));
}
/** @type {{default:import('../../src/game/shard/manifest.ts').ShardManifest}} */
const loaded=await import(pathToFileURL(resolve(root,shardManifestPath(root, slug))).href);
if(loaded.default.slug!==slug) throw new Error('Generator manifest identity differs');
// Native authoring consumers query the same exact scalar values before any
// product exists. Validate the complete declared intake before installing it.
prepareNativeScalarBlocks(loaded.default, root);
installShards([loaded.default]);
