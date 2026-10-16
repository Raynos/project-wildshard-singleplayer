#!/usr/bin/env node
// Every source project is built before Vite copies public/. Legacy shards without a config remain on their runtime.
// SF66 (G247): a shard whose baked map (look/map.baked.json) no longer matches its world is refused in CI and on Vercel,
// so a stale map never deploys; a local build only warns, since the rebake itself needs a served build of that world
// (node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=<slug>). test/baked-maps.test.ts is the gate's check.
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runWildshard } from './wildshard.mjs';
import { legacyInventory } from './legacy-shards.mjs';
import { mapTilesHash, mapStampPath, verifyMapPixels } from './map-hash.mjs';
import { readBuildKey, publishProduct, reuseOrBuild, shardfileKey, treeHashes } from './shardfile-cache.mjs';

// --reuse (fast proofs: serve-build.sh, `pnpm build:proof`): a shard whose inputs are unchanged keeps its product, from
// the slot or the shared content-keyed cache (scripts/shardfile-cache.mjs). The plain `pnpm build` (the push gate)
// rebuilds every shard into a fresh folder and publishes it to that cache; CI and Vercel build in place, no cache.
// --catalog requires a complete pass with strict copied-runtime proofs and atomically publishes out/catalog.json.
// --shard=<slug>[,<slug>] builds only those shards: another shard's product stays only while its key still matches,
// else it is removed, so a one-shard preview never serves a stale product of a changed shard.
/** Pack every first-party map through the existing charged SDK row; missing maps keep the old no-map build path.
 * @param {string} root @param {{strict?:boolean, build?:typeof runWildshard, reuse?:boolean, only?:string[], catalog?:boolean, copyRuntime?:boolean}} options */
export async function buildShardfiles(root, { strict = [process.env.CI, process.env.VERCEL].some(flag => flag !== undefined && flag !== '' && flag !== 'false'), build = runWildshard, reuse = false, only, catalog = false, copyRuntime = false } = {}) {
  if (catalog && only !== undefined) throw new Error('wildshard build: --catalog requires every project; --shard cannot publish a catalog');
  const outputRoot = resolve(root, 'out');
  // A partial/ordinary build cannot leave a previous complete catalog vouching for changed products.
  if (!catalog) rmSync(resolve(outputRoot, 'catalog.json'), { force: true });
  const projects = resolve(root, 'src/shards'), frozen = legacyInventory(root);
  let count = 0;
  const stale = [];
  const built = readdirSync(projects, { withFileTypes: true }).filter(entry => entry.isDirectory() && !Object.hasOwn(frozen.shards, entry.name) && existsSync(resolve(projects, entry.name, 'shard.config.ts'))).map(entry => entry.name).sort();
  for (const slug of only ?? []) if (!built.includes(slug)) throw new Error(`wildshard build: --shard=${slug} is not a first-party shardfile project (${built.join(', ')})`);
  if ((reuse || only !== undefined) && strict) console.warn('wildshard build: --reuse / --shard ignored in CI; building every shard');
  const files = strict ? undefined : treeHashes(root);
  for (const entry of readdirSync(projects, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const project = resolve(projects, entry.name);
    if (!entry.isDirectory() || Object.hasOwn(frozen.shards, entry.name) || !existsSync(resolve(project, 'shard.config.ts'))) continue;
    const started = performance.now();
    const stamp = mapStampPath(project);
    if (!existsSync(stamp) || JSON.parse(readFileSync(stamp, 'utf8')).tilesHash !== mapTilesHash(project)) stale.push(entry.name);
    const map = existsSync(stamp) ? JSON.parse(readFileSync(stamp, 'utf8')) : undefined;
    if (map !== undefined && map.image !== `/assets/${entry.name}/map/top.webp`) throw new Error(`Unexpected baked map path for ${entry.name}`);
    if (map !== undefined) await verifyMapPixels(resolve(root, 'public', map.image.slice(1)), map.pixelHash);
    const flags = [...(catalog || copyRuntime ? ['--copy-runtime'] : []), ...(map === undefined ? [] : [`--map=${resolve(root, 'public', map.image.slice(1))}`, `--map-tiles-hash=${map.tilesHash}`])];
    // --no-placeholders (G348): a first-party product keeps its own bytes; its near / far views come from the repo bakes
    // until the grid reads a shardfile's `near`. The CLI's default baked a near row into Signal Dunes' product, whose play
    // stage then never ran (677bd1cf1: "Shardfile requires the normal play stage", the page held at 82 %).
    const destination = resolve(root, 'out', entry.name);
    if (files === undefined) {
      // CI / Vercel overwrite the product in place: drop any fast-path stamp so it can never vouch for these bytes.
      mkdirSync(resolve(root,'out'),{recursive:true});
      const temporary=mkdtempSync(resolve(root,'out',`.build-${entry.name}-`));
      try {await build(['build',project,temporary,'--product-only','--no-placeholders','--format=2',...flags]);publishProduct(temporary,destination);}finally{rmSync(temporary,{recursive:true,force:true});}
      count++;
      continue;
    }
    const key = shardfileKey(files, entry.name, built, flags.map(flag => flag.replace(root, '<root>')));
    if (only !== undefined && !only.includes(entry.name)) {
      const here = readBuildKey(destination);
      if (here !== key && existsSync(destination)) { rmSync(destination, { recursive: true, force: true }); console.info(`wildshard build: ${entry.name} skipped (--shard), stale product removed`); }
      else console.info(`wildshard build: ${entry.name} skipped (--shard)${here === key ? ', product current' : ''}`);
      continue;
    }
    const how = await reuseOrBuild({ slug: entry.name, key, destination, fresh: !reuse && only === undefined, build: out => build(['build', project, out, '--product-only', '--no-placeholders', '--format=2', ...flags]) });
    console.info(`wildshard build: ${entry.name} ${how === 'built' ? 'built' : `reused (${how})`} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
    count++;
  }
  console.info(`wildshard build: ${count} shardfile project(s)`);
  if (stale.length > 0) {
    const message = `wildshard build: the baked map of ${stale.join(', ')} does not match its world (SF66); rebake: node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=${stale.join(',')}`;
    if (strict) throw new Error(message);
    console.warn(message);
  }
  if (catalog) {
    // Only the game placement declarations are source inputs. Discovery metadata
    // comes from all validated outputs after the final product/map check passes.
    const source = JSON.parse(readFileSync(resolve(root, 'src/game/grid/singleplayer.json'), 'utf8'));
    if (source === null || typeof source !== 'object' || !Array.isArray(source.placements)) throw new Error('Catalog requires grid placements');
    const placements = source.placements.map(row => ({ slug: row.slug, placement: { instance: row.instance, grid: row.cell, size: row.size } }));
    mkdirSync(outputRoot, { recursive: true });
    const temporary = mkdtempSync(resolve(outputRoot, '.catalog-input-'));
    try {
      const path = resolve(temporary, 'placements.json');
      writeFileSync(path, JSON.stringify(placements));
      await build(['catalog', outputRoot, path]);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const only = process.argv.find(arg => arg.startsWith('--shard='))?.slice('--shard='.length).split(',').filter(Boolean);
  try { await buildShardfiles(resolve(import.meta.dirname, '..'), { catalog: process.argv.includes('--catalog'), copyRuntime: process.argv.includes('--copy-runtime'), reuse: process.argv.includes('--reuse'), ...(only === undefined ? {} : { only }) }); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
