#!/usr/bin/env node
// Every source project is built before Vite copies public/. Legacy shards without a config remain on their runtime.
// SF66 (G247): a shard whose baked map (look/map.baked.json) no longer matches its world is refused in CI and on Vercel,
// so a stale map never deploys; a local build only warns, since the rebake itself needs a served build of that world
// (node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=<slug>). test/baked-maps.test.ts is the gate's check.
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { shardfileBoundaryViolations } from '../lint/shardfile-boundaries.mjs';
import { runWildshard } from './wildshard.mjs';
import { checkHeadlessAssembly } from './check-headless-assemblies.mjs';
import { legacyInventory } from './legacy-shards.mjs';
import { mapInputHashes, mapTilesHash, mapStampPath, verifyMapPixels } from './map-hash.mjs';
import { borrowShardfileEntry, readBuildKey, reuseOrBuild, shardfileCacheRoot, shardfileKey, treeHashes } from './shardfile-cache.mjs';
import { createDataMapPreparation } from './bake-data-maps.mjs';
import { createHash, randomBytes } from 'node:crypto';
import { InputHashMemo } from './bake-input-hashes.mjs';
import { productInputKey, productToolchainKey, matchingProductInputKey, publishProductInputs } from './shardfile-inputs.mjs';
import { quietCli } from './quiet-cli.mjs';
import { productFolder, shardOutputs } from './shard-outputs.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';
import { runShardBuild, runShardBuildPool } from './shard-build-pool.mjs';
import { checkTileBake } from './tile-bakes.mjs';

/** Exact closed-runtime copy admission shared by the builder and read-only product consumers.
 * @param {string} root @param {string} project */
function runtimeCopyIssues(root, project) {
  const issues = [];
  /** @type {Set<string>} */
  const executable = new Set();
  const walk = directory => {
    if (!existsSync(directory)) return;
    for (const file of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, file.name);
      if (file.isDirectory()) walk(path);
      else if (file.name.endsWith('.ts')) {
        if (!file.name.endsWith('.d.ts')) executable.add(path);
        for (const issue of shardfileBoundaryViolations(root, path.slice(root.length + 1), readFileSync(path, 'utf8')).filter(row => row.rule === 'runtime-standalone')) issues.push({ file: path.slice(project.length + 1), message: issue.message });
      }
    }
  };
  walk(resolve(project, 'runtime'));
  if (executable.size > 0 && !existsSync(resolve(project, 'runtime/index.ts'))) issues.push({ file: 'runtime/index.ts', message: 'Closed runtime requires its compiled index entry' });
  return issues;
}
/** @param {string} root @param {string|undefined} output
 * @param {{image:string,tilesHash:string}|undefined} map @param {boolean} copy */
function productFlags(root, output, map, copy) {
  return [...(copy ? ['--copy-runtime'] : []), ...(map === undefined ? [] : [`--map=${resolve(root, 'public', map.image.slice(1))}`, `--map-tiles-hash=${map.tilesHash}`]), ...(output === undefined ? [] : [`--output=${output}`])];
}
/** @param {string} root @param {string} name @param {string[]} flags
 * @param {string} toolchain @param {string} cacheRoot */
function productRecipe(root, name, flags, toolchain, cacheRoot) {
  const normalized = flags.map(flag=>flag.replace(root,'<root>'));
  const recipe = [name,...normalized,toolchain];
  const receipts = resolve(cacheRoot,'.inputs-v2',name,createHash('sha256').update(JSON.stringify(recipe)).digest('hex'));
  return { normalized, recipe, receipts };
}
/** Locate a normal build's product without generating or publishing bytes.
 * A cache path loan remains pinned through this consumer process's lifetime.
 * CI consumes its exact build output. Local callers require a matching sealed input receipt.
 * The caller still admits the returned product's complete bytes through its normal loader.
 * @param {string} sourceRoot @param {string} name
 * @param {{cacheRoot?:string,env?:NodeJS.ProcessEnv}} [options] */
export function readBuiltShardfile(sourceRoot, name, { cacheRoot = shardfileCacheRoot(), env = process.env } = {}) {
  if (!/^[a-z0-9_-]+$/u.test(name)) throw new Error('Invalid built product name');
  const root = resolve(sourceRoot);
  const destination = resolve(root, 'out', name), built = env.WS_TEST_PRODUCTS_SHA;
  if (built !== undefined && /^[a-f0-9]{40}$/u.test(built) && built === env.VERCEL_GIT_COMMIT_SHA
    && existsSync(resolve(destination, 'shard.json'))) return destination;
  const folder = productFolder(root, name), project = resolve(root, 'src/shards', folder);
  const output = name === folder ? undefined : name;
  const stamp = output === undefined ? mapStampPath(project) : resolve(project, `look/map.${output}.baked.json`);
  const map = existsSync(stamp) ? JSON.parse(readFileSync(stamp, 'utf8')) : undefined;
  const flags = productFlags(root, output, map, runtimeCopyIssues(root, project).length === 0);
  const memo = new InputHashMemo(root);
  const toolchain = `${productToolchainKey(root,memo)}:${shardfileValidationRevision(root)}`;
  const { recipe, receipts } = productRecipe(root, name, flags, toolchain, cacheRoot);
  const key = matchingProductInputKey(root, receipts, recipe, memo);
  if (key !== undefined) for (const directory of [destination, resolve(cacheRoot, name, key)]) {
    if (directory !== destination) {
      // Lazy product readers keep using the returned directory after this call.
      // Dead-process pins are reaped by the same ordinary cache eviction.
      borrowShardfileEntry(directory, true);
      if (existsSync(`${directory}.lock`)) continue;
    }
    if (readBuildKey(directory) === key && existsSync(resolve(directory, 'shard.json'))) return directory;
  }
  throw new Error(`Missing current product ${name}; run: node scripts/build-shardfiles.mjs --reuse --shard=${name}`);
}

// --reuse (fast proofs: serve-build.sh, `pnpm build:proof`): a shard whose inputs are unchanged keeps its product, from
// the slot or the shared content-keyed cache (scripts/shardfile-cache.mjs). The plain `pnpm build` (the push gate)
// rebuilds every shard into a fresh folder. CI may explicitly reuse exact input receipts, then fully validates each hit.
// --catalog requires a complete pass with strict copies for closed runtimes and atomically publishes out/catalog.json.
// --shard=<slug>[,<slug>] builds only those shards: another shard's product stays only while its key still matches,
// else it is removed, so a one-shard preview never serves a stale product of a changed shard.
/** Pack every first-party map through the existing charged SDK row; missing maps keep the old no-map build path.
 * @param {string} root @param {{strict?:boolean, build?:typeof runWildshard, reuse?:boolean, only?:string[], catalog?:boolean, copyRuntime?:boolean|'closed',onFailure?:(slug:string,error:unknown)=>void}} options */
export async function buildShardfiles(root, { strict = [process.env.CI, process.env.VERCEL].some(flag => flag !== undefined && flag !== '' && flag !== 'false'), build = runWildshard, reuse = false, only, catalog = false, copyRuntime = 'closed',onFailure } = {}) {
  if(onFailure!==undefined&&(strict||catalog))throw new Error('Product failure collection is report-only; strict/catalog builds must fail');
  if (catalog && only !== undefined) throw new Error('wildshard build: --catalog requires every project; --shard cannot publish a catalog');
  const prepareMaps=createDataMapPreparation(root);
  if(onFailure===undefined)await prepareMaps(strict ? undefined : only?.map(slug => productFolder(root, slug)));
  const outputRoot = resolve(root, 'out');
  // A partial/ordinary build cannot leave a previous complete catalog vouching for changed products.
  if (!catalog) rmSync(resolve(outputRoot, 'catalog.json'), { force: true });
  const projects = resolve(root, 'src/shards'), frozen = legacyInventory(root);
  let count = 0;
  const stale = [], runtimeReport = [];
  // A folder may emit many products. Its shared source closure and prerequisite
  // generation are one immutable build-phase fact; output stamps/pixels stay
  // product-specific and are still checked for every output below.
  /** @type {Map<string,{file:string,message:string}[]>} */
  const runtimeChecks=new Map();
  /** @type {Map<string,string>} */
  const mapTileHashes=new Map();
  /** @type {Map<string,Promise<void>>} */
  const folderPreparation=new Map();
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
  for (const slug of only ?? []) if (!built.includes(slug)) throw new Error(`wildshard build: --shard=${slug} is not a first-party shardfile project (${built.join(', ')})`);
  if(onFailure===undefined)for (const folder of new Set((only ?? built).map(slug => products.find(row => row.name === slug)?.folder ?? slug))) checkHeadlessAssembly(root, folder);
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
    const buildOne = args => build === runWildshard ? runShardBuild(args, signal) : build(args);
    const project = resolve(projects, folder);
    try {
    if(onFailure!==undefined){
      let preparation=folderPreparation.get(folder);
      if(preparation===undefined) {
        preparation=(async()=>{await prepareMaps([folder]);checkHeadlessAssembly(root,folder);})();
        folderPreparation.set(folder,preparation);
      }
      await preparation;
    }
    const started = performance.now();
    const stamp = output === undefined ? mapStampPath(project) : resolve(project, `look/map.${output}.baked.json`);
    const expected = existsSync(stamp) ? JSON.parse(readFileSync(stamp, 'utf8')).tilesHash : null;
    let actual=mapTileHashes.get(project);
    if(actual===undefined){actual=mapTilesHash(project);mapTileHashes.set(project,actual);}
    if (expected !== actual) {
      stale.push(name);
      console.error(`wildshard map inputs: ${JSON.stringify({ shard: name, expected, actual, files: mapInputHashes(project) })}`);
    }
    const map = existsSync(stamp) ? JSON.parse(readFileSync(stamp, 'utf8')) : undefined;
    if (map !== undefined && map.image !== `/assets/${name}/map/top.webp`) throw new Error(`Unexpected baked map path for ${name}`);
    if (map !== undefined) await verifyMapPixels(resolve(root, 'public', map.image.slice(1)), map.pixelHash);
    const issues = catalog || copyRuntime === 'closed' ? runtimeIssues(project) : [];
    runtimeReport.push({ slug: name, runtime: issues.length > 0 ? 'source' : 'output', issues });
    const flags = productFlags(root, output, map, copyRuntime === true || (catalog || copyRuntime === 'closed') && issues.length === 0);
    // --no-placeholders (G348): a first-party product keeps its own bytes; its near / far views come from the repo bakes
    // until the grid reads a shardfile's `near`. The CLI's default baked a near row into Signal Dunes' product, whose play
    // stage then never ran (677bd1cf1: "Shardfile requires the normal play stage", the page held at 82 %).
    const destination = resolve(root, 'out', name);
    const { normalized, recipe, receipts } = productRecipe(root, name, flags, toolchain, shardfileCacheRoot());
    const currentKey = () => recorded ? matchingProductInputKey(root,receipts,recipe,inputHashes) : shardfileKey(files ?? new Map(),name,folders.filter(other=>other!==folder),normalized);
    const key = currentKey();
    if (!strict && only !== undefined && !only.includes(name)) {
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
    console.info(`tile bake: ${name} ${tiles.l0} L0/${tiles.l1} L1, 16 full 5x5 windows checked, ${Object.keys(tiles.debt).length} existing debt metrics`);
    console.info(`wildshard build: ${name} ${how === 'built' ? 'built' : `reused (${how})`} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
    count++;
    } catch(error) {
      if(onFailure===undefined)throw error;
      // A previous product cannot vouch for a failed rebuild or grant a census user.
      rmSync(resolve(outputRoot,name),{recursive:true,force:true});
      onFailure(name,error);
    }
  });
  } finally { inputHashes.flush(); }
  runtimeReport.sort((a,b)=>a.slug.localeCompare(b.slug));
  if (copyRuntime === 'closed') for (const report of runtimeReport) console.info(`runtime copy: ${JSON.stringify(report)}`);
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
    const placements = source.placements.map(row => {
      const placement = { slug: row.slug, placement: { instance: row.instance, grid: row.cell, size: row.size } };
      return runtimeReport.some(report => report.slug === row.slug && report.runtime === 'source') ? Object.assign(placement, { runtime: 'source' }) : placement;
    });
    mkdirSync(outputRoot, { recursive: true });
    const temporary = mkdtempSync(resolve(outputRoot, '.catalog-input-'));
    try {
      const path = resolve(temporary, 'placements.json');
      writeFileSync(path, JSON.stringify(placements));
      await build(['catalog', outputRoot, path]);
      writeFileSync(resolve(outputRoot, 'catalog-report.json'), `${JSON.stringify(runtimeReport, null, 2)}\n`);
      for (const report of runtimeReport) console.info(`catalog runtime: ${report.slug}: ${report.runtime}, ${report.issues.length} closure issue(s)`);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  quietCli('build-shardfiles');
  const only = process.argv.find(arg => arg.startsWith('--shard='))?.slice('--shard='.length).split(',').filter(Boolean);
  try { await buildShardfiles(resolve(import.meta.dirname, '..'), { catalog: process.argv.includes('--catalog'), copyRuntime: process.argv.includes('--copy-runtime') ? true : 'closed', reuse: process.argv.includes('--reuse'), ...(only === undefined ? {} : { only }) }); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
