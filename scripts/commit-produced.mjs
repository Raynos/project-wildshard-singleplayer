// G367: a bounded source-tree -> produced-tree receipt, never a source guard bypass.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GENERATED_FILES } from './generated-policy.mjs';
import { isWitnessManifest } from './witness-manifests.mjs';
import { isRecordedBake } from './bake-input-hashes.mjs';

const git = (root, args) => execFileSync('git', args, {cwd:root,encoding:'utf8',maxBuffer:64*1024*1024}).trim();
function permitted(root, source, file) {
  if (GENERATED_FILES.includes(file) || ['lint/ask-ids.json','lint/shard-words.generated.json'].includes(file) || isWitnessManifest(file) || isRecordedBake(file)) return true;
  if (/^src\/shards\/[^/]+\/(?:runtime\/(?:physics|spots)|look\/map)\.baked\.json$/u.test(file) || /^public\/assets\/[^/]+\/map\/top\.webp$/u.test(file)) return true;
  const catalogue = JSON.parse(git(root,['show',`${source}:scripts/generation-jobs.json`]));
  return (!/\.[cm]?[jt]sx?$/u.test(file) || /\.generated\.[cm]?[jt]s$/u.test(file))
    && catalogue.jobs.some(job => Array.isArray(job.outputs) && job.outputs.includes(file));
}
function location(root, tree) {
  return resolve(git(root,['rev-parse','--path-format=absolute','--git-common-dir']),'commit-produced',`${tree}.json`);
}
/** Publish after successful official producers and their index writes; before final guards.
 * @param {string} root @param {string} sourceTree @param {string[]} outputs @param {string} base */
export function recordCommitProduced(root, sourceTree, outputs, base) {
  const tree = git(root,['write-tree']);
  if (git(root,['rev-parse','HEAD']) !== base) throw new Error('Produced receipt parent moved; regenerate from current HEAD');
  const paths = git(root,['diff','--name-only','--no-renames',sourceTree,tree]).split('\n').filter(Boolean);
  if (paths.some(path => !outputs.includes(path) || !permitted(root,sourceTree,path))) throw new Error('Produced receipt cannot cover source or undeclared outputs');
  const file = location(root,tree);
  mkdirSync(resolve(file,'..'),{recursive:true});
  writeFileSync(file,JSON.stringify({base,sourceTree,tree,paths}));
}
/** Admit only exactly produced outputs of this same parent and complete index tree.
 * @param {string} root @param {string} tree @param {string[]} wanted */
export function verifyCommitProduced(root, tree, wanted) {
  const file = location(root,tree);
  if (!existsSync(file)) return false;
  const receipt = JSON.parse(readFileSync(file,'utf8'));
  if (receipt.tree !== tree || receipt.base !== git(root,['rev-parse','HEAD']) || !/^[a-f0-9]{40}$/u.test(receipt.sourceTree) || !Array.isArray(receipt.paths)) return false;
  const actual = git(root,['diff','--name-only','--no-renames',receipt.sourceTree,tree]).split('\n').filter(Boolean);
  if (JSON.stringify(actual) !== JSON.stringify(receipt.paths) || actual.some(path => !permitted(root,receipt.sourceTree,path))) return false;
  return wanted.every(path => actual.includes(path));
}
