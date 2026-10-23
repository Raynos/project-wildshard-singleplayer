// G668 G10: two real producer processes share one isolated input stage.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { generationKey, generationOutputHashes } from './generation-cache.mjs';

const digest = (/** @type {Uint8Array} */ bytes) => createHash('sha256').update(bytes).digest('hex');
/** Never follow dependency links into the checkout or include compiler caches.
 * @param {string} tree @returns {Map<string,string|null>} */
function inventory(tree) {
  const entries = new Map();
  /** @param {string} folder */
  const visit = folder => {
    for (const entry of readdirSync(resolve(tree, folder), { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isDirectory()) { entries.set(file, null); visit(file); }
      else if (entry.isFile()) entries.set(file, digest(readFileSync(resolve(tree, file))));
      else throw new Error(`Unexpected generation stage link: ${file}`);
    }
  };
  visit(''); return entries;
}

/** Reset declared outputs, seeds and incidental writes before the second run.
 * Ordinary input writes refuse instead of silently selecting changed inputs.
 * @param {string} tree @param {{id:string,outputs:string[],seedOutputs?:string[]}} job
 * @param {()=>Promise<void>} run */
export async function verifyStagedGeneration(tree, job, run) {
  const baseline = inventory(tree), outputs = new Set(job.outputs);
  const seeds = new Map((job.seedOutputs ?? []).filter(file => existsSync(resolve(tree, file))).map(file => [file, readFileSync(resolve(tree, file))]));
  /** @returns {void} */
  const unchanged = () => {
    for (const [file, hash] of baseline) if (hash !== null && !outputs.has(file)) {
      const at = resolve(tree, file);
      if (!existsSync(at) || !lstatSync(at).isFile() || digest(readFileSync(at)) !== hash) throw new Error(`Generator changed staged input: ${job.id} ${file}`);
    }
  };
  await run(); unchanged();
  const first = generationOutputHashes(tree, job.outputs);
  /** @param {string} folder */
  const reset = folder => {
    for (const entry of readdirSync(resolve(tree, folder), { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const file = folder ? `${folder}/${entry.name}` : entry.name;
      if (!baseline.has(file) || outputs.has(file)) rmSync(resolve(tree, file), { recursive: true, force: true });
      else if (entry.isDirectory()) reset(file);
    }
  };
  reset('');
  for (const [file, bytes] of seeds) { mkdirSync(dirname(resolve(tree, file)), { recursive: true }); writeFileSync(resolve(tree, file), bytes); utimesSync(resolve(tree, file), 1, 1); }
  await run(); unchanged();
  const second = generationOutputHashes(tree, job.outputs);
  const differences = job.outputs.filter(file => first[file] !== second[file]);
  if (differences.length > 0) throw new Error(`Non-deterministic generation: ${job.id}; ${differences.map(file => `${file} (${first[file]} -> ${second[file]})`).join(', ')}`);
}

/** Audit results stay private: no shared-cache hit/publication or pin waiver.
 * The normal caller continues using its existing cache and pin checks.
 * @param {string} root @param {import('./generation-cache.mjs').GenerationJob} job
 * @param {(directory:string)=>Promise<void>} generate @param {import('./bake-input-hashes.mjs').InputHashMemo} inputs
 * @returns {Promise<import('./generation-cache.mjs').GenerationResult>} */
export async function runDeterminismAudit(root, job, generate, inputs) {
  if (job.platform === 'darwin' && process.platform !== 'darwin') throw new Error(`Darwin determinism unavailable: ${job.id}`);
  const scratch = resolve(root, 'tmp'); mkdirSync(scratch, { recursive: true });
  if (lstatSync(scratch).isSymbolicLink() || !realpathSync(scratch).startsWith(realpathSync(root) + sep)) throw new Error('Generation audit scratch escaped source tree');
  const directory = mkdtempSync(resolve(scratch, 'generation-audit-')), started = performance.now();
  try {
    const key = generationKey(root, job, { inputHashes: inputs });
    await generate(directory); inputs.verifyInputs(job.inputs);
    if (generationKey(root, job, { inputHashes: inputs }) !== key) throw new Error(`Generation inputs changed during audit: ${job.id}`);
    return { directory, key, hit: false, hashes: generationOutputHashes(directory, job.outputs), elapsedMs: performance.now() - started,
      release: () => { rmSync(directory, { recursive: true, force: true }); } };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}
