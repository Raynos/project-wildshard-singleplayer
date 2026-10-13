// Inspect the commit's immutable index; never remove, restore or generate in the shared working tree.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverGeneration, generateShardJob } from './generate.mjs';
import { proveGenerationRemoval } from './generation-removal-cache.mjs';
import { guardIndexTree } from './guard-index-tree.mjs';
import { planGenerationRemovals } from './generation-removals.mjs';
import { linkNodeModules } from './link-node-modules.mjs';

/** Hash exact Git blobs in one binary-safe batch, not one process per asset.
 * @param {string} root @param {string[]} objects */
function blobHashes(root,objects) {
  const ordered=[...new Set(objects)];
  if(ordered.length===0)return new Map();
  const bytes=execFileSync('git',['cat-file','--batch'],{cwd:root,input:`${ordered.join('\n')}\n`,maxBuffer:256*1024*1024});
  const hashes=new Map();let offset=0;
  for(const object of ordered) {
    const end=bytes.indexOf(10,offset),header=bytes.subarray(offset,end).toString().split(' ');
    const size=Number(header[2]);
    if(end<offset || header[0]!==object || header[1]!=='blob' || !Number.isSafeInteger(size) || size<0 || end+size+1>=bytes.length || bytes[end+size+1]!==10)throw new Error('Incomplete removal input blob batch');
    hashes.set(object,createHash('sha256').update(bytes.subarray(end+1,end+size+1)).digest('hex'));
    offset=end+size+2;
  }
  if(offset!==bytes.length)throw new Error('Unexpected removal input blob batch');
  return hashes;
}

/** Rehearse newly deleted catalogue outputs and their complete products from the staged tree, reusing only verified exact-input cold proofs.
 * Ordinary commits and previously removed outputs do no generation work. Quiet windows refuse a new rehearsal.
 * @param {string} [root]
 * @returns {Promise<import('./generation-removals.mjs').GenerationRemovalPlan|null>} */
export async function precommitGenerationRemovals(root = resolve(import.meta.dirname, '..')) {
  /** @param {string[]} args */
  const git = args => execFileSync('git', args, {cwd:root, maxBuffer:256*1024*1024});
  const deleted = git(['diff', '--cached', '--no-renames', '--name-only', '--diff-filter=D', '-z']).toString().split('\0').filter(Boolean);
  if (deleted.length === 0) return null;
  const parent=git(['rev-parse','HEAD']).toString().trim();
  /** @type {{jobs:import('./generate.mjs').ShardGenerationJob[]}} */
  const before = JSON.parse(git(['show', `${parent}:scripts/generation-jobs.json`]).toString());
  if (!before.jobs.some(job => job.outputs.some(file => deleted.includes(file)))) return null;
  const tree = guardIndexTree(root);
  const temporary = realpathSync(mkdtempSync(resolve(tmpdir(), 'wildshard-removal-guard-')));
  try {
    const archive = resolve(temporary, 'source.tar');
    // Validate the complete catalogue and existence of every entry before reuse.
    // The immutable object census below keys the full source scope without
    // exporting its bytes on a hit. A miss still runs the original cold archive.
    /** @type {{jobs:import('./generate.mjs').ShardGenerationJob[]}} */
    const staged=JSON.parse(git(['show',`${tree}:scripts/generation-jobs.json`]).toString());
    const roots=['scripts/generation-jobs.json',...staged.jobs.map(job=>job.entry)];
    execFileSync('git', ['archive', tree, `--output=${archive}`, '--', ...roots], {cwd:root});
    execFileSync('tar', ['-xf', archive, '-C', temporary]);
    rmSync(archive);
    const after = discoverGeneration(temporary).jobs;
    const predecessor=git(['ls-tree','-rz',parent]).toString().split('\0').filter(Boolean);
    const objects=git(['ls-tree','-rz',tree]).toString().split('\0').filter(Boolean);
    const objectAt=new Map([...predecessor,...objects].map(row=>[row.slice(row.indexOf('\t')+1),row.slice(0,row.indexOf('\t')).split(' ').at(2)]));
    const oldAt=new Map(predecessor.map(row=>[row.slice(row.indexOf('\t')+1),row.slice(0,row.indexOf('\t')).split(' ').at(2)]));
    const wanted=new Set([...deleted,...after.filter(job=>job.shard!==null && before.jobs.some(old=>old.shard===job.shard && old.outputs.some(file=>deleted.includes(file)))).flatMap(job=>job.outputs)]);
    const hashes=blobHashes(root,[...[...wanted].map(file=>objectAt.get(file)),...[...wanted].map(file=>oldAt.get(file))].filter(object=>object!==undefined));
    const plan = planGenerationRemovals(before.jobs, after, deleted, file => {
      const object=oldAt.get(file),hash=object===undefined?undefined:hashes.get(object);
      if(hash===undefined)throw new Error(`Missing removal predecessor: ${file}`);
      return hash;
    });
    if ((plan.cheapJobIds ?? []).length > 0) {
      const source=resolve(temporary,'cheap-source');mkdirSync(source);
      execFileSync('git',['archive',tree,`--output=${archive}`,'--','.',':!art',':!progress',':!sources',':!ios',':!android'],{cwd:root});
      execFileSync('tar',['-xf',archive,'-C',source]);rmSync(archive);
      linkNodeModules(root,source);
      for (const job of after.filter(row=>plan.cheapJobIds?.includes(row.id))) {
        const result=await generateShardJob(source,job,{cacheDir:resolve(temporary,'cheap-cache')});
        if (result.elapsedMs >= 30_000) throw new Error(`Cheap removal exceeds G318 cold budget: ${job.id}`);
        console.info(`Removal guard: ${job.id} regenerates ${job.outputs.length} complete outputs in ${(result.elapsedMs/1000).toFixed(3)}s; G405, no historical byte baseline`);
      }
      if(guardIndexTree(root)!==tree || git(['rev-parse','HEAD']).toString().trim()!==parent)throw new Error('Removal proof parent or staged tree changed');
      if(plan.outputs.length===0)return plan;
    }
    const selected=after.filter(job=>plan.jobIds.includes(job.id));
    const paths=objects.map(row=>row.slice(row.indexOf('\t')+1));
    const scope=new Set(['scripts','src/format','src/sdk','src/commons',
      ...selected.flatMap(job=>job.inputRoots),...selected.map(job=>`src/shards/${job.shard}`),
      ...after.map(job=>job.entry),'package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.gitattributes',
      ...paths.filter(file=>/^src\/[^/]+\/package\.json$/u.test(file))]);
    const generated=new Set(after.flatMap(job=>job.outputs));
    const sourceObjects=objects.filter(row=>{
      const file=row.slice(row.indexOf('\t')+1);
      return !generated.has(file) && [...scope].some(path=>file===path || file.startsWith(`${path}/`));
    });
    const expected=Object.fromEntries(selected.flatMap(job=>job.outputs.map(file=>[file,paths.includes(file)
      ?hashes.get(objectAt.get(file)??'')??null
      :job.buildOutputs?.[file]??job.comparisonOutputs?.[file]??null])));
    writeFileSync(resolve(temporary,'.removal-inputs.json'),JSON.stringify({sourceObjects,expected}));
    const common = git(['rev-parse', '--git-common-dir']).toString().trim();
    if (existsSync(resolve(root, common, 'quiet'))) throw new Error('Quiet window active: generated-output removal requires a fresh clean-room rehearsal');
    await proveGenerationRemoval(root, temporary, tree, plan, resolve(root, common, 'commit-removal-cache'),expected);
    if(guardIndexTree(root)!==tree || git(['rev-parse','HEAD']).toString().trim()!==parent)throw new Error('Removal proof parent or staged tree changed');
    console.info(`Removal guard: ${String(plan.outputs.length)} exact cold outputs in ${String(plan.shards.length)} complete products`);
    return plan;
  } finally {rmSync(temporary, {recursive:true, force:true});}
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {await precommitGenerationRemovals();}
  catch (error) {console.error(error instanceof Error ? error.message : String(error));process.exitCode=1;}
}
