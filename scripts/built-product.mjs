// Read-only product selection and the exact recipe shared with the normal builder.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { shardfileBoundaryViolations } from '../lint/shardfile-boundaries.mjs';
import { mapStampPath } from './map-hash.mjs';
import { borrowShardfileEntry, readBuildKey, shardfileCacheRoot } from './shardfile-cache.mjs';
import { InputHashMemo } from './bake-input-hashes.mjs';
import { productToolchainKey, matchingProductInputKey } from './shardfile-inputs.mjs';
import { productFolder } from './shard-outputs.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';

/** Exact closed-runtime copy admission shared by the builder and read-only product consumers.
 * @param {string} root @param {string} project */
export function runtimeCopyIssues(root, project) {
  /** @type {{file:string,message:string}[]} */
  const issues = [];
  /** @type {Set<string>} */
  const executable = new Set();
  /** @param {string} directory */
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
export function productFlags(root, output, map, copy) {
  return [...(copy ? ['--copy-runtime'] : []), ...(map === undefined ? [] : [`--map=${resolve(root, 'public', map.image.slice(1))}`, `--map-tiles-hash=${map.tilesHash}`]), ...(output === undefined ? [] : [`--output=${output}`])];
}
/** @param {string} root @param {string} name @param {string[]} flags
 * @param {string} toolchain @param {string} cacheRoot */
export function productRecipe(root, name, flags, toolchain, cacheRoot) {
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

/** Classify selected suites once, before workers load setup or tests.
 * Uses the same exact-SHA/current-input admission as each suite's reader.
 * Never builds, restores source outputs or accepts an older cached product.
 * @param {string} root @param {readonly string[]} files
 * @param {{cacheRoot?:string,env?:NodeJS.ProcessEnv}} [options] */
export function selectBuiltTestProducts(root, files, options = {}) {
  const registry = resolve(root, 'scripts/test-products.json');
  /** @type {Record<string,string[]>} */
  const products = existsSync(registry) ? v.parse(v.record(v.string(), v.array(v.string())), JSON.parse(readFileSync(registry, 'utf8'))) : {};
  const selected = files.filter(file => (products[file]?.length ?? 0) > 0);
  /** @type {Set<string>} */
  const missing = new Set();
  for (const name of new Set(selected.flatMap(file => products[file] ?? []))) {
    try { readBuiltShardfile(root, name, options); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith(`Missing current product ${name};`)) throw error;
      missing.add(name);
    }
  }
  const names = [...missing].sort();
  const suites = selected.filter(file => products[file]?.some(name => missing.has(name))).sort();
  const blocked = new Set(suites);
  return { ready: files.filter(file => !blocked.has(file)), blocked: suites, missing: names,
    buildCommand: names.length === 0 ? undefined : `node scripts/build-shardfiles.mjs --reuse --shard=${names.join(',')}` };
}
/** Strict full/focused/CI preflight; no unavailable suite may disappear.
 * @param {string} root @param {readonly string[]} files
 * @param {{cacheRoot?:string,env?:NodeJS.ProcessEnv}} [options] */
export function assertBuiltTestProducts(root, files, options = {}) {
  const {missing,blocked,buildCommand}=selectBuiltTestProducts(root, files, options);
  if(missing.length>0)throw new Error(`Missing current products ${missing.join(', ')} (no verified product matches current inputs), required by ${blocked.join(', ')}; run: ${buildCommand}`);
}
