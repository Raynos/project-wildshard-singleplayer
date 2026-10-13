#!/usr/bin/env node
// Every source project is built before Vite copies public/. Legacy shards without a config remain on their runtime.
// SF66 (G247): a shard whose baked map (look/map.baked.json) no longer matches its world is refused in CI and on Vercel,
// so a stale map never deploys; a local build only warns, since the rebake itself needs a served build of that world
// (node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=<slug>). test/baked-maps.test.ts is the gate's check.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runWildshard } from './wildshard.mjs';
import { legacyInventory } from './legacy-shards.mjs';
import { mapTilesHash, verifyMapPixels } from './map-hash.mjs';

/** Pack every first-party map through the existing charged SDK row; missing maps keep the old no-map build path.
 * @param {string} root @param {{strict?:boolean, build?:typeof runWildshard}} options */
export async function buildShardfiles(root, { strict = [process.env.CI, process.env.VERCEL].some(flag => flag !== undefined && flag !== '' && flag !== 'false'), build = runWildshard } = {}) {
  const projects = resolve(root, 'src/shards'), frozen = legacyInventory(root);
  let count = 0;
  const stale = [];
  for (const entry of readdirSync(projects, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const project = resolve(projects, entry.name);
    if (!entry.isDirectory() || Object.hasOwn(frozen.shards, entry.name) || !existsSync(resolve(project, 'shard.config.ts'))) continue;
    const stamp = resolve(project, 'look/map.baked.json');
    if (!existsSync(stamp) || JSON.parse(readFileSync(stamp, 'utf8')).tilesHash !== mapTilesHash(project)) stale.push(entry.name);
    const map = existsSync(stamp) ? JSON.parse(readFileSync(stamp, 'utf8')) : undefined;
    if (map !== undefined && map.image !== `/assets/${entry.name}/map/top.webp`) throw new Error(`Unexpected baked map path for ${entry.name}`);
    if (map !== undefined) await verifyMapPixels(resolve(root, 'public', map.image.slice(1)), map.pixelHash);
    const flags = map === undefined ? [] : [`--map=${resolve(root, 'public', map.image.slice(1))}`, `--map-tiles-hash=${map.tilesHash}`];
    // --no-placeholders (G348): a first-party product keeps its own bytes; its near / far views come from the repo bakes
    // until the grid reads a shardfile's `near`. The CLI's default baked a near row into Signal Dunes' product, whose play
    // stage then never ran (677bd1cf1: "Shardfile requires the normal play stage", the page held at 82 %).
    await build(['build', project, resolve(root, 'public/shardfiles', entry.name), '--product-only', '--no-placeholders', ...flags]); count++;
  }
  console.info(`wildshard build: ${count} shardfile project(s)`);
  if (stale.length > 0) {
    const message = `wildshard build: the baked map of ${stale.join(', ')} does not match its world (SF66); rebake: node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=${stale.join(',')}`;
    if (strict) throw new Error(message);
    console.warn(message);
  }
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await buildShardfiles(resolve(import.meta.dirname, '..')); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
