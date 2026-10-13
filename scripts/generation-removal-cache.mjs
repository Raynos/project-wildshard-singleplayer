// A warm proof reuses a successful cold rehearsal, never a producer-only hit.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {generationInputs, discoverGeneration} from './generate.mjs';
import {runGenerationJob, generationOutputHashes} from './generation-cache.mjs';
import {generationTools} from './generation-sources.mjs';
import {cleanRoomGeneration} from './generation-clean-room.mjs';
import {assertGenerationRemovalProof} from './generation-removals.mjs';

const reportFile='.clean-room-proof.json';
const digest=(/** @type {string|Uint8Array} */ bytes)=>createHash('sha256').update(bytes).digest('hex');

/** Verify every artifact and complete product before reusing an exact-input cold proof.
 * Misses run the unchanged fresh-cache rehearsal; failed/incomplete proofs never
 * publish. The current deletion plan is checked on hits as well as misses.
 * @param {string} root @param {string} source @param {string} tree
 * @param {import('./generation-removals.mjs').GenerationRemovalPlan} plan
 * @param {string} cacheDir @param {Record<string,string|null>} expected */
export async function proveGenerationRemoval(root,source,tree,plan,cacheDir,expected) {
  const jobs=discoverGeneration(source).jobs.filter(job=>plan.jobIds.includes(job.id));
  if(jobs.length!==plan.jobIds.length)throw new Error('Unknown or duplicate removal proof job');
  const inputs=generationInputs(source,['scripts/generation-jobs.json','.removal-inputs.json']);
  if(Object.values(expected).some(hash=>hash===null))throw new Error('Removal proof has missing output evidence');
  const outputs=jobs.flatMap(job=>job.outputs);
  // Bind the executing controller too, including fixtures that import it from
  // outside their staged archive. No working-tree implementation can lend a hit.
  const controller=generationInputs(resolve(import.meta.dirname,'..'),['scripts']);
  const result=await runGenerationJob(source,{id:'complete-removal-proof',inputs,outputs:[reportFile,...outputs],
    command:['cold-complete-product',...plan.jobIds],platform:'native',tools:{controller:JSON.stringify(controller),
      expected:JSON.stringify(expected),jobs:JSON.stringify(jobs),nodeBytes:digest(readFileSync(process.execPath)),
      nodeOptions:process.env.NODE_OPTIONS??'',nodePath:process.env.NODE_PATH??'',
      ...generationTools(jobs.flatMap(job=>job.toolCommands??[]))}}, {cacheDir,generate:async directory=>{
      const report=await cleanRoomGeneration(root,{pin:tree,jobIds:plan.jobIds,artifactDirectory:directory});
      assertGenerationRemovalProof(plan,report,tree);
      writeFileSync(resolve(directory,reportFile),JSON.stringify(report));
    }});
  /** @type {import('./generation-clean-room.mjs').CleanRoomReport} */
  const report=JSON.parse(readFileSync(resolve(result.directory,reportFile),'utf8'));
  assertGenerationRemovalProof(plan,report,report.pin);
  const hashes=generationOutputHashes(result.directory,outputs);
  for(const job of jobs) {
    const row=report.jobs.find(candidate=>candidate.id===job.id);
    if(row?.status!=='matched' || row.outputs.length!==job.outputs.length)throw new Error(`Incomplete removal proof: ${job.id}`);
    for(const file of job.outputs) {
      const evidence=row.outputs.find(output=>output.file===file);
      if(evidence?.exact!==true || evidence.expected!==expected[file] || evidence.generated!==hashes[file] || hashes[file]!==expected[file])throw new Error(`Removal proof artifact differs: ${file}`);
    }
  }
  console.info(`Removal proof: ${result.hit?'verified cold-proof hit':'fresh cold rehearsal'} ${result.elapsedMs.toFixed(1)}ms`);
  return result;
}
