// G292: one verified, content-addressed cache for generated assets and native checkpoints.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as v from 'valibot';

/** @param {string | Uint8Array} bytes */
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u));
const name = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u));
const file = v.pipe(v.string(), v.check(value => value.length > 0 && !isAbsolute(value)
  && !value.includes('\\') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..')
  && value !== '.generation-receipt.json', 'Expected a bounded repository-relative file'));
const Job = v.strictObject({ id: name, inputs: v.record(file, digest), command: v.array(v.string()), outputs: v.array(file),
  platform: v.picklist(['portable', 'native', 'darwin']), tools: v.optional(v.record(v.string(), v.string())) });
const Receipt = v.strictObject({ schema: v.literal('generation-cache/1'), key: digest, files: v.record(file, digest) });
const NOTICE = '.generation-receipt.json';
/** @type {Map<string, Promise<{directory:string,key:string,hit:boolean,hashes:Record<string,string>,elapsedMs:number}>>} */
const active = new Map();
/** @param {unknown} value */
function canonical(value) {
  if (value === undefined) throw new Error('Unserializable generation identity');
  const text = JSON.stringify(value, (/** @type {string} */ _key, /** @type {unknown} */ item) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
  return text;
}

/** Persistent shared root outside git; CI and fixtures can select an isolated cache. */
export function generationCacheRoot(env = process.env) {
  return resolve(env.WILDSHARD_GENERATE_CACHE ?? resolve(homedir(), '.cache/wildshard/generate'));
}

/** Validate exact producer inputs and include command, toolchain and native host identity in the key.
 * @param {string} root @param {import('./generation-cache.mjs').GenerationJob} descriptor
 * @param {{platform?:string,arch?:string}} [host] */
export function generationKey(root, descriptor, host = {}) {
  const job = v.parse(Job, descriptor), platform = host.platform ?? process.platform, arch = host.arch ?? process.arch;
  if (job.outputs.length === 0 || new Set(job.outputs).size !== job.outputs.length || Object.keys(job.inputs).length === 0) throw new Error('Incomplete generation job');
  for (const [path, expected] of Object.entries(job.inputs)) {
    const at = resolve(root, path);
    if (!lstatSync(at).isFile() || hash(readFileSync(at)) !== expected) throw new Error(`Generation input changed: ${path}`);
  }
  return hash(canonical({ schema: 'generation-cache/1', job, node: process.version,
    host: job.platform === 'portable' ? 'portable' : { platform, arch } }));
}

/** Complete declared output hashes; symlinks cannot escape a staging directory.
 * @param {string} directory @param {string[]} outputs */
export function generationOutputHashes(directory, outputs) {
  const root = realpathSync(directory);
  return Object.fromEntries([...outputs].sort().map(path => {
    v.parse(file, path);
    const at = resolve(root, path);
    if (!lstatSync(at).isFile() || !realpathSync(at).startsWith(root + sep)) throw new Error(`Invalid generated file ${path}`);
    return [path, hash(readFileSync(at))];
  }));
}

/** @param {string} directory @param {string} key @param {string[]} outputs */
function valid(directory, key, outputs) {
  try {
    const receipt = v.parse(Receipt, JSON.parse(readFileSync(resolve(directory, NOTICE), 'utf8')));
    return receipt.key === key && canonical(receipt.files) === canonical(generationOutputHashes(directory, outputs));
  } catch { return false; }
}
/** @param {string} lock */
function abandoned(lock) {
  try {
    const { pid } = v.parse(v.strictObject({ pid: v.pipe(v.number(), v.integer(), v.minValue(1)) }), JSON.parse(readFileSync(resolve(lock, 'owner.json'), 'utf8')));
    try { process.kill(pid, 0); return false; } catch (error) { return error instanceof Error && 'code' in error && error.code === 'ESRCH'; }
  } catch { try { return Date.now() - statSync(lock).mtimeMs > 60_000; } catch { return false; } }
}
/** @param {string} lock */
function reclaim(lock) {
  const guard = `${lock}.reclaim`;
  try { mkdirSync(guard); } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return; throw error; }
  try { if (abandoned(lock)) rmSync(lock, { recursive: true, force: true }); }
  finally { rmSync(guard, { recursive: true, force: true }); }
}

/** Coalesce a complete job across callers/processes; generate only in a fresh output directory.
 * A forced comparison never replaces a differing cache. No failed or incomplete output is published.
 * @param {string} root @param {import('./generation-cache.mjs').GenerationJob} descriptor
 * @param {import('./generation-cache.mjs').GenerationOptions} options
 * @returns {Promise<import('./generation-cache.mjs').GenerationResult>} */
export function runGenerationJob(root, descriptor, options) {
  const job = v.parse(Job, descriptor), key = generationKey(root, job, options), platform = options.platform ?? process.platform;
  if (job.platform === 'darwin' && platform !== 'darwin') return Promise.reject(new Error(`Darwin-only generator: ${job.id}`));
  const directory = resolve(options.cacheDir ?? generationCacheRoot(), job.id, key);
  // A force request must not turn into a warm hit by sharing an ordinary request.
  const token = `${directory}:${options.forceCompare === true ? 'compare' : 'ensure'}`;
  const prior = active.get(token);
  if (prior !== undefined) return prior;
  const task = execute(root, directory, key, job, options).finally(() => { active.delete(token); });
  active.set(token, task); return task;
}
/** @param {string} root @param {string} directory @param {string} key
 * @param {import('./generation-cache.mjs').GenerationJob} job
 * @param {import('./generation-cache.mjs').GenerationOptions} options
 * @returns {Promise<import('./generation-cache.mjs').GenerationResult>} */
async function execute(root, directory, key, job, options) {
  const started = performance.now(), lock = `${directory}.lock`, until = Date.now() + 600_000;
  mkdirSync(dirname(directory), { recursive: true });
  for (;;) {
    if (options.forceCompare !== true && valid(directory, key, job.outputs)) return { directory, key, hit: true, hashes: generationOutputHashes(directory, job.outputs), elapsedMs: performance.now() - started };
    try { mkdirSync(lock); break; } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      if (abandoned(lock)) { reclaim(lock); continue; }
      if (Date.now() >= until) throw new Error(`Generation lease timed out: ${job.id}`, {cause:error});
      await delay(100);
    }
  }
  writeFileSync(resolve(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
  const stage = mkdtempSync(resolve(dirname(directory), 'generating-'));
  try {
    const hadCache = valid(directory, key, job.outputs);
    if (options.forceCompare !== true && hadCache) return { directory, key, hit: true, hashes: generationOutputHashes(directory, job.outputs), elapsedMs: performance.now() - started };
    await options.generate(stage);
    // A producer that changed its inputs cannot publish under the old key.
    if (generationKey(root, job, options) !== key) throw new Error(`Generation inputs changed during job: ${job.id}`);
    const hashes = generationOutputHashes(stage, job.outputs);
    if (hadCache && canonical(hashes) !== canonical(generationOutputHashes(directory, job.outputs))) throw new Error(`Regenerate-and-compare failed: ${job.id}`);
    writeFileSync(resolve(stage, NOTICE), `${canonical({ schema: 'generation-cache/1', key, files: hashes })}\n`);
    if (!valid(stage, key, job.outputs)) throw new Error(`Incomplete generation cache: ${job.id}`);
    if (hadCache) return { directory, key, hit: false, hashes, elapsedMs: performance.now() - started };
    if (existsSync(directory)) rmSync(directory, { recursive: true });
    renameSync(stage, directory);
    return { directory, key, hit: false, hashes, elapsedMs: performance.now() - started };
  } finally { rmSync(stage, { recursive: true, force: true }); rmSync(lock, { recursive: true, force: true }); }
}
