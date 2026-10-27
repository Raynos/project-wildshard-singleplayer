#!/usr/bin/env node
// Every source project is built before Vite copies public/. Legacy shards without a config remain on their runtime.
// SF66 (G247): a shard whose baked map (look/map.baked.json) no longer matches its world is refused in CI and on Vercel,
// so a stale map never deploys; a local build only warns, since the rebake itself needs a served build of that world
// (node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=<slug>). test/baked-maps.test.ts is the gate's check.
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runWildshard } from './wildshard.mjs';
import { legacyInventory } from './legacy-shards.mjs';
import { mapInputHashes, mapTilesHash, verifyMapPixels } from './map-hash.mjs';
import { readBuildKey, reuseOrBuild, shardfileCacheRoot, shardfileKey, treeHashes } from './shardfile-cache.mjs';
import { randomBytes } from 'node:crypto';
import { InputHashMemo } from './bake-input-hashes.mjs';
import { productInputKey, productToolchainKey, matchingProductInputKey, publishProductInputs } from './shardfile-inputs.mjs';
import { quietCli } from './quiet-cli.mjs';
import { outputManifest, shardOutputs } from './shard-outputs.mjs';
import { usesProgramDiscovery } from './program-discovery.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';
import { runShardBuild, runShardBuildPool } from './shard-build-pool.mjs';
import { prepareProductBuildTools } from './product-build-tools.mjs';
import { checkTileBake } from './tile-bakes.mjs';
import { runtimeCopyIssues, productMapInput, publishProductMap, productFlags, productRecipe, readBuiltShardfile as selectBuiltShardfile } from './built-product.mjs';

/** Read CI's output or a matching immutable product without invoking the builder.
 * @param {string} root @param {string} name
 * @param {{cacheRoot?:string,env?:NodeJS.ProcessEnv}} [options] */
export function readBuiltShardfile(root, name, options = {}) { return selectBuiltShardfile(root, name, options); }

// --reuse (fast proofs: serve-build.sh, `pnpm build:proof`): a shard whose inputs are unchanged keeps its product, from
// the slot or the shared content-keyed cache (scripts/shardfile-cache.mjs). The plain `pnpm build` (the push gate)
// rebuilds every shard into a fresh folder. CI may explicitly reuse exact input receipts, then fully validates each hit.
// --shard=<slug>[,<slug>] builds only those shards: another shard's product stays only while its key still matches,
// else it is removed, so a one-shard preview never serves a stale product of a changed shard. A product whose discovery
// is program-bound (scripts/program-discovery.mjs) is always built too: the app build writes its discovery module from
// that product's current receipt, so it cannot be left stale (unchanged inputs reuse it at once).
/** Pack every first-party map through the existing charged SDK row; missing maps keep the old no-map build path.
 * @param {string} root @param {{strict?:boolean, build?:typeof runWildshard, reuse?:boolean, only?:string[], scope?:string[], copyRuntime?:boolean|'closed',onFailure?:(slug:string,error:unknown)=>void}} options */
export async function buildShardfiles(root, { strict = [process.env.CI, process.env.VERCEL].some(flag => flag !== undefined && flag !== '' && flag !== 'false'), build = runWildshard, reuse = false, only, scope, copyRuntime = 'closed',onFailure } = {}) {
  if(onFailure!==undefined&&strict)throw new Error('Product failure collection is report-only; strict builds must fail');
  if (scope !== undefined && only !== undefined) throw new Error('Product phase scope and CLI only filter cannot be combined');
  const outputRoot = resolve(root, 'out');
  // Discard the retired discovery artifact left by older builds.
  rmSync(resolve(outputRoot, 'catalog.json'), { force: true });
  const projects = resolve(root, 'src/shards'), frozen = legacyInventory(root);
  let count = 0;
  const stale = [], runtimeReport = [], measured = [];
  // A folder may emit many products. Its shared source closure and prerequisite
  // generation are one immutable build-phase fact; output stamps/pixels stay
  // product-specific and are still checked for every output below.
  /** @type {Map<string,{file:string,message:string}[]>} */
  const runtimeChecks=new Map();
  /** @type {Map<string,string>} */
  const mapTileHashes=new Map();
  const runtimeIssues = project => {
    let issues = runtimeChecks.get(project);
    if (issues === undefined) { issues = runtimeCopyIssues(root, project); runtimeChecks.set(project, issues); }
    return issues;
  };
  const folders = readdirSync(projects, { withFileTypes: true }).filter(entry => entry.isDirectory() && !Object.hasOwn(frozen.shards, entry.name) && existsSync(resolve(projects, entry.name, 'shard.config.ts'))).map(entry => entry.name).sort((a, b) => a.localeCompare(b));
  // SF88g: a folder with declared outputs (scripts/shard-outputs.mjs) builds one product per output, each to out/<slug>
  const products = folders.flatMap(folder => (shardOutputs(root, folder) ?? [{ slug: folder }]).map(row => ({ name: row.slug, folder, output: row.slug === folder ? undefined : row.slug })));
  const built = products.map(row => row.name).sort((a, b) => a.localeCompare(b));
  // A product folder no source declares any more (a folder that now emits outputs, a dropped output) never ships stale
  for (const entry of existsSync(outputRoot) ? readdirSync(outputRoot, { withFileTypes: true }) : []) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && !built.includes(entry.name) && !Object.hasOwn(frozen.shards, entry.name) && existsSync(resolve(outputRoot, entry.name, 'shard.json'))) {
      rmSync(resolve(outputRoot, entry.name), { recursive: true, force: true }); console.info(`wildshard build: ${entry.name} is no longer a product; removed`);
    }
  }
  for (const slug of scope ?? only ?? []) if (!built.includes(slug)) throw new Error(`wildshard build: --shard=${slug} is not a first-party shardfile project (${built.join(', ')})`);
  const bound = (only === undefined || strict ? [] : products).filter(({ folder, output }) => {
    const manifest = resolve(projects, folder, 'manifest.json');
    if (!existsSync(manifest)) return false;
    const row = output === undefined ? undefined : shardOutputs(root, folder)?.find(entry => entry.slug === output);
    return usesProgramDiscovery(row === undefined ? JSON.parse(readFileSync(manifest, 'utf8')) : outputManifest(root, folder, row));
  }).map(row => row.name).filter(name => only?.includes(name) !== true);
  if (bound.length > 0) console.info(`wildshard build: --shard also keeps the program-bound discovery products current: ${bound.join(', ')}`);
  const selected = scope ?? (strict || only === undefined ? undefined : [...only, ...bound]);
  if (only !== undefined && strict) console.warn('wildshard build: --shard ignored in CI; building every shard');
  const recorded = build === runWildshard;
  const files = recorded ? undefined : treeHashes(root);
  const inputHashes = new InputHashMemo(root,resolve(root,'.cache/shardfile-input-hashes.json'));
  // The validation receipt every product carries is checked against this revision (vite.config.ts, the ruler). The
  // cached author CLI computes it once per compiler child, so a traced read set may miss its sources: key it directly,
  // or a product reused after the revision moved ships a stale receipt.
  const toolchainOf = () => `${productToolchainKey(root,inputHashes)}:${shardfileValidationRevision(root)}`;
  const toolchain = recorded ? toolchainOf() : '';
  try {
  await runShardBuildPool(products, async ({ name, folder, output }, signal) => {
    if (scope !== undefined && !scope.includes(name)) return;
    const buildOne = args => build === runWildshard ? runShardBuild(args, signal) : build(args);
    const project = resolve(projects, folder);
    try {
    const started = performance.now();
    const map = productMapInput(project, output), expected = map?.tilesHash ?? null;
    let actual=mapTileHashes.get(project);
    if(actual===undefined){actual=mapTilesHash(project);mapTileHashes.set(project,actual);}
    if (expected !== actual) {
      stale.push(name);
      console.error(`wildshard map inputs: ${JSON.stringify({ shard: name, expected, actual, files: mapInputHashes(project) })}`);
    }
    if (map?.image !== undefined && map.image !== `/assets/${name}/map/top.webp`) throw new Error(`Unexpected baked map path for ${name}`);
    if (map?.image !== undefined) {
      if (map.pixelHash === undefined) throw new Error(`Missing baked map pixel identity for ${name}`);
      await verifyMapPixels(resolve(root, 'public', map.image.slice(1)), map.pixelHash);
    }
    const issues = copyRuntime === 'closed' ? runtimeIssues(project) : [];
    runtimeReport.push({ slug: name, runtime: issues.length > 0 ? 'source' : 'output', issues });
    const flags = productFlags(root, output, map, copyRuntime === true || copyRuntime === 'closed' && issues.length === 0);
    // --no-placeholders (G348): a first-party product keeps its own bytes; its near / far views come from the repo bakes
    // until the grid reads a shardfile's `near`. The CLI's default baked a near row into Signal Dunes' product, whose play
    // stage then never ran (677bd1cf1: "Shardfile requires the normal play stage", the page held at 82 %).
    const destination = resolve(root, 'out', name);
    const { normalized, recipe, receipts } = productRecipe(root, name, flags, toolchain, shardfileCacheRoot());
    const currentKey = () => recorded ? matchingProductInputKey(root,receipts,recipe,inputHashes) : shardfileKey(files ?? new Map(),name,folders.filter(other=>other!==folder),normalized);
    const key = currentKey();
    if (selected !== undefined && !selected.includes(name)) {
      const here = readBuildKey(destination);
      if (here !== key && existsSync(destination)) { rmSync(destination, { recursive: true, force: true }); console.info(`wildshard build: ${name} skipped (--shard), stale product removed`); }
      else console.info(`wildshard build: ${name} skipped (--shard)${here === key ? ', product current' : ''}`);
      return;
    }
    const how = await reuseOrBuild({ slug: name, key:key ?? randomBytes(32).toString('hex'), destination, fresh:!reuse && (strict || only === undefined), build: async out => {
      const receipt=resolve(shardfileCacheRoot(),'.input-traces',`${process.pid}-${randomBytes(8).toString('hex')}.json`);
      try {
      await buildOne(['build',project,out,'--product-only','--no-placeholders','--format=2',...flags,...(recorded?[`--input-receipt=${receipt}`]:[])]);
      if (recorded && toolchainOf() !== toolchain) throw new Error('Product toolchain changed during build');
      const next = recorded ? productInputKey(root,receipt,recipe,inputHashes) : currentKey();
      if (next === undefined) throw new Error(`Missing complete product input receipt: ${name}`);
      if(recorded)publishProductInputs(receipts,receipt,next);
      return next;
      } finally { if(recorded)rmSync(receipt,{force:true}); }
    } });
    // Cache transport never substitutes for current strict admission, including
    // file hashes, schemas, budgets and executing the admitted script bytes.
    if (strict && how !== 'built') await buildOne(['validate',destination]);
    const tiles = checkTileBake(root, name, destination);
    if (map !== undefined && map.image === undefined) await publishProductMap(root, name, destination, map.tilesHash);
    console.info(`tile bake: ${name} ${tiles.l0} L0/${tiles.l1} L1, 16 full 5x5 windows checked, ${Object.keys(tiles.debt).length} existing debt metrics`);
    console.info(`wildshard build: ${name} ${how === 'built' ? 'built' : `reused (${how})`} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
    count++;
    measured.push(name);
    } catch(error) {
      if(onFailure===undefined)throw error;
      // A previous product cannot vouch for a failed rebuild or grant a census user.
      rmSync(resolve(outputRoot,name),{recursive:true,force:true});
      onFailure(name,error);
    }
  }, recorded ? () => prepareProductBuildTools(products.filter(row => selected === undefined || selected.includes(row.name)).map(row => row.name)) : undefined);
  } finally { inputHashes.flush(); }
  runtimeReport.sort((a,b)=>a.slug.localeCompare(b.slug));
  if (copyRuntime === 'closed') for (const report of runtimeReport) console.info(`runtime copy: ${JSON.stringify(report)}`);
  console.info(`wildshard build: ${count} shardfile project(s)`);
  // I12 (G792): the build refuses a product whose declared phone wire grows past its ceiling
  if (recorded && onFailure === undefined && measured.length > 0) {
    const { phoneWireReport } = await import('./phone-wire.mjs');
    const report = await phoneWireReport(root, measured);
    for (const row of report.rows) console.info(`phone wire: ${row.name} ${(row.bytes / 1e6).toFixed(2)} MB${row.ceiling === undefined ? ' (no ceiling)' : ` of ${(row.ceiling / 1e6).toFixed(2)} MB`}`);
    if (report.errors.length > 0) throw new Error(report.errors.join('\n'));
  }
  if (stale.length > 0) {
    const message = `wildshard build: the baked map of ${stale.join(', ')} does not match its world (SF66); rebake: node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=${stale.join(',')}`;
    if (strict) throw new Error(message);
    console.warn(message);
  }
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  quietCli('build-shardfiles');
  const only = process.argv.find(arg => arg.startsWith('--shard='))?.slice('--shard='.length).split(',').filter(Boolean);
  try { await buildShardfiles(resolve(import.meta.dirname, '..'), { copyRuntime: process.argv.includes('--copy-runtime') ? true : 'closed', reuse: process.argv.includes('--reuse'), ...(only === undefined ? {} : { only }) }); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
