// Inspect the commit's immutable index; never remove, restore or generate in the shared working tree.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverGeneration } from './generate.mjs';
import { cleanRoomGeneration } from './generation-clean-room.mjs';
import { planGenerationRemovals, assertGenerationRemovalProof } from './generation-removals.mjs';

/** Rehearse newly deleted catalogue outputs and their complete products from the staged tree, using a fresh cache.
 * Ordinary commits and previously removed outputs do no generation work. Quiet windows refuse a new rehearsal.
 * @param {string} [root]
 * @returns {Promise<import('./generation-removals.mjs').GenerationRemovalPlan|null>} */
export async function precommitGenerationRemovals(root = resolve(import.meta.dirname, '..')) {
  /** @param {string[]} args */
  const git = args => execFileSync('git', args, {cwd:root, maxBuffer:256*1024*1024});
  const deleted = git(['diff', '--cached', '--no-renames', '--name-only', '--diff-filter=D', '-z']).toString().split('\0').filter(Boolean);
  if (deleted.length === 0) return null;
  /** @type {{jobs:import('./generate.mjs').ShardGenerationJob[]}} */
  const before = JSON.parse(git(['show', 'HEAD:scripts/generation-jobs.json']).toString());
  if (!before.jobs.some(job => job.outputs.some(file => deleted.includes(file)))) return null;
  const tree = git(['write-tree']).toString().trim();
  const temporary = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-removal-guard-')));
  try {
    const archive = resolve(temporary, 'source.tar');
    execFileSync('git', ['archive', tree, `--output=${archive}`], {cwd:root});
    execFileSync('tar', ['-xf', archive, '-C', temporary]);
    rmSync(archive);
    const after = discoverGeneration(temporary).jobs;
    const plan = planGenerationRemovals(before.jobs, after, deleted, file => createHash('sha256').update(git(['show', `HEAD:${file}`])).digest('hex'));
    const common = git(['rev-parse', '--git-common-dir']).toString().trim();
    if (existsSync(resolve(root, common, 'quiet'))) throw new Error('Quiet window active: generated-output removal requires a fresh clean-room rehearsal');
    const report = await cleanRoomGeneration(root, {pin:tree, jobIds:plan.jobIds});
    assertGenerationRemovalProof(plan, report, tree);
    console.info(`Removal guard: ${String(plan.outputs.length)} exact cold outputs in ${String(plan.shards.length)} complete products`);
    return plan;
  } finally {rmSync(temporary, {recursive:true, force:true});}
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {await precommitGenerationRemovals();}
  catch (error) {console.error(error instanceof Error ? error.message : String(error));process.exitCode=1;}
}
