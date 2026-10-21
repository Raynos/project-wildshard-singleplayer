// G292: one verified, content-addressed cache for generated assets and native checkpoints.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as v from 'valibot';
import { bakeInputHashes, InputHashMemo } from './bake-input-hashes.mjs';

/** @param {string | Uint8Array} bytes */
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u));
const name = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u));
const file = v.pipe(v.string(), v.check(value => value.length > 0 && !isAbsolute(value)
  && !value.includes('\\') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..')
  && !['.generation-receipt.json','.output-hashes.json','.generation-reads.json'].includes(value), 'Expected a bounded repository-relative file'));
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
 * @param {{platform?:string,arch?:string,inputHashes?:import('./bake-input-hashes.mjs').InputHashMemo}} [host] */
export function generationKey(root, descriptor, host = {}) {
  const job = v.parse(Job, descriptor), platform = host.platform ?? process.platform, arch = host.arch ?? process.arch;
  if (job.outputs.length === 0 || new Set(job.outputs).size !== job.outputs.length || Object.keys(job.inputs).length === 0) throw new Error('Incomplete generation job');
  const actual = bakeInputHashes(root,Object.keys(job.inputs),host.inputHashes);
  for (const [path, expected] of Object.entries(job.inputs)) {
    if (actual[path] !== expected) throw new Error(`Generation input changed: ${path}`);
  }
  return hash(canonical({ schema: 'generation-cache/1', job, node: process.version,
    host: job.platform === 'portable' ? 'portable' : { platform, arch } }));
}

/** Complete declared hashes, using the same stat-validated memo as source
 * inputs. Every hit still checks file identity, size, nanosecond mtime/ctime
 * and root containment; missing or edited outputs never inherit an old hash.
 * @param {string} directory @param {string[]} outputs */
export function generationOutputHashes(directory, outputs) {
  const root = realpathSync(directory);
  for(const path of outputs)v.parse(file,path);
  const memo=new InputHashMemo(root,resolve(root,'.output-hashes.json'));
  const hashes=bakeInputHashes(root,outputs,memo);
  if(memo.reads>0)memo.flush();
  return hashes;
}

/** @param {string} directory @param {string} key @param {string[]} outputs */
function verifiedOutputHashes(directory, key, outputs) {
  try {
    const receipt = v.parse(Receipt, JSON.parse(readFileSync(resolve(directory, NOTICE), 'utf8')));
    if(receipt.key!==key)return undefined;
    const hashes=generationOutputHashes(directory,outputs);
    return canonical(receipt.files)===canonical(hashes)?hashes:undefined;
  } catch { return undefined; }
}
/** @param {string} directory @param {string} key @param {string[]} outputs */
const valid=(directory,key,outputs)=>verifiedOutputHashes(directory,key,outputs)!==undefined;
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
export async function runGenerationJob(root, descriptor, options) {
  const job = v.parse(Job, descriptor), key = generationKey(root, job, options), platform = options.platform ?? process.platform;
  if (job.platform === 'darwin' && platform !== 'darwin') throw new Error(`Darwin-only generator: ${job.id}`);
  const directory = resolve(options.cacheDir ?? generationCacheRoot(), job.id, key);
  // Pin before validation: an eviction already holding key.lock must finish
  // before execute inspects the entry; a later eviction sees this reader.
  const release = readLease(directory);
  // A force request must not turn into a warm hit by sharing an ordinary request.
  const token = `${directory}:${options.forceCompare === true ? 'compare' : options.probe === true ? 'probe' : 'ensure'}`;
  const prior = active.get(token);
  const task = prior ?? execute(root, directory, key, job, options).then(result => {
    if (!result.hit) maybePruneGenerationCache(options.cacheDir ?? generationCacheRoot(), { protect: [directory] });
    return result;
  }).finally(() => { active.delete(token); });
  active.set(token, task);
  try {return {...await task,release};}
  catch(error) {release();throw error;}
}
/** @param {string} root @param {string} directory @param {string} key
 * @param {import('./generation-cache.mjs').GenerationJob} job
 * @param {import('./generation-cache.mjs').GenerationOptions} options
 * @returns {Promise<Omit<import('./generation-cache.mjs').GenerationResult,'release'>>} */
async function execute(root, directory, key, job, options) {
  const started = performance.now(), lock = `${directory}.lock`, until = Date.now() + 600_000;
  mkdirSync(dirname(directory), { recursive: true });
  for (;;) {
    const verified=!existsSync(lock) && options.forceCompare!==true?verifiedOutputHashes(directory,key,job.outputs):undefined;
    if (verified!==undefined) return { directory: touch(directory), key, hit: true, hashes: verified, elapsedMs: performance.now() - started };
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
    const verified=verifiedOutputHashes(directory,key,job.outputs),hadCache=verified!==undefined;
    if (options.forceCompare !== true && verified!==undefined) return { directory: touch(directory), key, hit: true, hashes: verified, elapsedMs: performance.now() - started };
    await options.generate(stage);
    // A producer that changed its inputs cannot publish under the old key.
    options.inputHashes?.verifyInputs(job.inputs);
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

/** Mark an entry as used now, so pruning sees warm hits as recent. @param {string} directory */
function touch(directory) {
  try { const now = new Date(); utimesSync(directory, now, now); } catch { /* A missing entry regenerates; never fail a hit on it. */ }
  return directory;
}

const ENTRY = /^[0-9a-f]{64}$/u, EVICTING = /^evicting-[0-9a-f]{64}-(\d+)$/u, GIB = 1024 ** 3, PRUNE_EVERY_MS = 600_000;
/** Allocated bytes under a path, never following symlinks. @param {string} path @returns {number} */
function diskBytes(path) {
  try {
    const stat = lstatSync(path);
    let bytes = stat.blocks * 512;
    if (stat.isDirectory()) for (const child of readdirSync(path)) bytes += diskBytes(resolve(path, child));
    return bytes;
  } catch { return 0; /* Removed while counting. */ }
}
/** @param {number} pid */
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return !(error instanceof Error && 'code' in error && error.code === 'ESRCH'); }
}
/** A result stays readable until explicitly released, or its owner exits.
 * Separate files give coalesced callers independent lifetimes.
 * @param {string} directory */
function readLease(directory) {
  const readers=`${directory}.readers`;
  const owner=resolve(readers,`${process.pid}-${randomBytes(12).toString('hex')}`);
  for(;;) {
    mkdirSync(readers,{recursive:true});
    try {writeFileSync(owner,'',{flag:'wx'});break;}
    catch(error) {if(!(error instanceof Error) || !('code' in error) || error.code!=='ENOENT')throw error;}
  }
  return ()=>{rmSync(owner,{force:true});removeEmptyReaders(readers);};
}
/** An acquiring reader retries if this removes its still-empty directory.
 * @param {string} readers */
function removeEmptyReaders(readers) {
  try {rmdirSync(readers);}
  catch(error) {if(!(error instanceof Error) || !('code' in error) || !['ENOENT','ENOTEMPTY','EEXIST'].includes(String(error.code)))throw error;}
}
/** Reap only dead owners; an unfamiliar marker conservatively keeps the entry.
 * @param {string} directory */
function liveReaders(directory) {
  const readers=`${directory}.readers`;
  if(!existsSync(readers))return false;
  let live=false;
  for(const ownerName of readdirSync(readers)) {
    const match=/^(\d+)-[a-f0-9]{24}$/u.exec(ownerName);
    if(match===null || alive(Number(match[1])))live=true;
    else rmSync(resolve(readers,ownerName),{force:true});
  }
  return live;
}
/** Delete one entry under its own lock, so a job never reads it half-deleted; a held lock leaves it in place.
 * @param {string} jobDir @param {string} key */
function evict(jobDir, key) {
  const lock = resolve(jobDir, `${key}.lock`), doomed = resolve(jobDir, `evicting-${key}-${process.pid}`);
  try { mkdirSync(lock); } catch { return false; }
  try {
    writeFileSync(resolve(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
    // The scan is advisory. Recheck under the same lock a reader observes
    // before validation, closing acquisition versus eviction races.
    if(liveReaders(resolve(jobDir,key)))return false;
    renameSync(resolve(jobDir, key), doomed);
  } catch { return false; } finally { rmSync(lock, { recursive: true, force: true }); }
  rmSync(doomed, { recursive: true, force: true });
  removeEmptyReaders(resolve(jobDir,`${key}.readers`));
  return true;
}

/** G430 eviction: per job keep the newest `keep` entries (by last use), then delete least-recently-used entries until
 * the cache fits `capBytes`. The newest entry of every job, `protect`ed directories (the current inputs), entries with
 * a lock and `generating-*` staging dirs are never deleted.
 * @param {string} cacheDir @param {import('./generation-cache.mjs').PruneOptions} [options]
 * @returns {import('./generation-cache.mjs').PruneReport} */
export function pruneGenerationCache(cacheDir, options = {}) {
  const keep = options.keep ?? 3, capBytes = options.capBytes ?? 20 * GIB, dryRun = options.dryRun === true;
  const protect = new Set((options.protect ?? []).map(path => resolve(path)));
  /** @type {import('./generation-cache.mjs').PruneReport} */
  const report = { deleted: [], keptBytes: 0, keptEntries: 0, locked: 0, freedBytes: 0 };
  if (!existsSync(cacheDir)) return report;
  /** @type {{job:string,key:string,path:string,mtimeMs:number,newest:boolean,pinned:boolean,bytes:number}[]} */
  const survivors = [];
  /** @param {{job:string,key:string}} entry @param {number} bytes @param {'keep'|'cap'} reason */
  const drop = (entry, bytes, reason) => {
    if (!dryRun && !evict(resolve(cacheDir, entry.job), entry.key)) return false;
    report.deleted.push({ job: entry.job, key: entry.key, bytes, reason }); report.freedBytes += bytes; return true;
  };
  for (const job of readdirSync(cacheDir).sort()) {
    const jobDir = resolve(cacheDir, job);
    if (!lstatSync(jobDir).isDirectory()) continue;
    const names = readdirSync(jobDir);
    for (const child of names) {
      const match = EVICTING.exec(child);
      if (match !== null && !dryRun && !alive(Number(match[1]))) rmSync(resolve(jobDir, child), { recursive: true, force: true });
    }
    const entries = names.filter(child => ENTRY.test(child)).flatMap(key => {
      const path = resolve(jobDir, key);
      try {
        const stat = lstatSync(path);
        return stat.isDirectory() ? [{ key, path, mtimeMs: stat.mtimeMs, locked: names.includes(`${key}.lock`) ? true : liveReaders(path) }] : [];
      } catch { return []; }
    }).sort((a, b) => b.mtimeMs - a.mtimeMs);
    entries.forEach((entry, index) => {
      const pinned = protect.has(entry.path) || entry.locked;
      if (entry.locked) report.locked += 1;
      const bytes = diskBytes(entry.path);
      if (index >= keep && !pinned && drop({ job, key: entry.key }, bytes, 'keep')) return;
      survivors.push({ job, key: entry.key, path: entry.path, mtimeMs: entry.mtimeMs, newest: index === 0, pinned, bytes });
    });
  }
  let total = survivors.reduce((sum, entry) => sum + entry.bytes, 0);
  const kept = new Set(survivors);
  for (const entry of [...survivors].sort((a, b) => a.mtimeMs - b.mtimeMs)) {
    if (total <= capBytes) break;
    if (entry.newest || entry.pinned) continue;
    if (drop(entry, entry.bytes, 'cap')) { total -= entry.bytes; kept.delete(entry); }
  }
  report.keptEntries = kept.size; report.keptBytes = total;
  return report;
}

/** Prune after a generation, at most once per 10 minutes per cache (a stamp file); never fails the job.
 * @param {string} cacheDir @param {import('./generation-cache.mjs').PruneOptions} [options] */
export function maybePruneGenerationCache(cacheDir, options = {}) {
  const stamp = resolve(cacheDir, '.prune-stamp');
  try {
    if (Date.now() - statSync(stamp).mtimeMs < PRUNE_EVERY_MS) return undefined;
  } catch { /* Never pruned. */ }
  try {
    writeFileSync(stamp, `${new Date().toISOString()}\n`);
    return pruneGenerationCache(cacheDir, options);
  } catch (error) {
    console.warn(`generation-cache: prune failed: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
