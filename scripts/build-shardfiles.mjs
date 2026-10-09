#!/usr/bin/env node
// Every source project is built before Vite copies public/. Legacy shards without a config remain on their runtime.
// SF66 (G247): a shard whose baked map (look/map.baked.json) no longer matches its world is refused in CI and on Vercel,
// so a stale map never deploys; a local build only warns, since the rebake itself needs a served build of that world
// (node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=<slug>). test/baked-maps.test.ts is the gate's check.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runWildshard } from './wildshard.mjs';
import { mapTilesHash } from './map-hash.mjs';

const root = resolve(import.meta.dirname, '..'), projects = resolve(root, 'src/shards');
const strict = [process.env.CI, process.env.VERCEL].some((flag) => flag !== undefined && flag !== '' && flag !== 'false');
let count = 0;
const stale = [];
for (const entry of readdirSync(projects, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  const project = resolve(projects, entry.name);
  if (!entry.isDirectory() || !existsSync(resolve(project, 'shard.config.ts'))) continue;
  const stamp = resolve(project, 'look/map.baked.json');
  if (!existsSync(stamp) || JSON.parse(readFileSync(stamp, 'utf8')).tilesHash !== mapTilesHash(project)) stale.push(entry.name);
  await runWildshard(['build', project, resolve(root, 'public/shardfiles', entry.name), '--product-only']); count++;
}
console.info(`wildshard build: ${count} shardfile project(s)`);
if (stale.length > 0) {
  const message = `wildshard build: the baked map of ${stale.join(', ')} does not match its world (SF66); rebake: node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=${stale.join(',')}`;
  if (strict) { console.error(message); process.exit(1); }
  console.warn(message);
}
