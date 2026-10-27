// Execute the shared selection on one sealed candidate mirror. No loose source
// or extra checkout participates in native compiler/product/test resolution.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { runCommitJobs } from './precommit-jobs.mjs';

/** Build native commands from the authoritative selection; consumer tests wait
 * for products while pure tests and project builds can run immediately.
 * @param {string} checker @param {import('./gate-selection.mjs').GateSelection} selection
 * @param {readonly string[]} changed @param {Readonly<Record<string,readonly string[]>>} registry */
export function candidateCheckPlan(checker, selection, changed, registry) {
  /** @type {string[]} */ const pure=[];
  /** @type {string[]} */ const consumers=[];
  for (const file of selection.tests) ((registry[file]?.length ?? 0) === 0 ? pure : consumers).push(file);
  const testJobs = (/** @type {string[]} */ files, /** @type {string} */ group) => {
    const node = files.filter(file => /\.[cm]js$/u.test(file));
    const vitest = files.filter(file => !/\.[cm]js$/u.test(file));
    /** @type {import('./precommit-jobs.mjs').CommitJob[]} */ const jobs = [];
    if (node.length > 0) jobs.push({name:`node tests (${group})`,command:[process.execPath,'--test',...node]});
    if (vitest.length > 0) jobs.push({name:`related tests (${group})`,command:[process.execPath,checker,'--worker',JSON.stringify(changed),'--selected',JSON.stringify(vitest)]});
    return jobs;
  };
  /** @type {import('./precommit-jobs.mjs').CommitJob[]} */ const immediate = [];
  if (selection.projects.length > 0) immediate.push({name:'candidate types',command:[process.execPath,'node_modules/typescript/bin/tsc','-b',...selection.projects]});
  immediate.push(...testJobs(pure,'pure'));
  const products = selection.products;
  const generation = ['scripts/gen.mjs','--build-inputs',...(products.length === 0 ? [] : [`--shard=${products.join(',')}`])];
  // Both commands execute under the same existing heavy-lane build lease.
  // scope retains exact product selection even when the parent environment is CI.
  const program = `import{spawnSync}from'node:child_process';
const generated=spawnSync(process.execPath,${JSON.stringify(generation)},{stdio:'inherit',env:process.env});
if(generated.error)throw generated.error;
if(generated.status!==0)process.exit(generated.status??1);
const{buildShardfiles}=await import('./scripts/build-shardfiles.mjs');
if(${JSON.stringify(products)}.length>0)await buildShardfiles(process.cwd(),{reuse:true,scope:${JSON.stringify(products)}});`;
  const preparation = products.length === 0 && selection.generators.length === 0 ? [] : [{name:'candidate products',command:['python3','scripts/heavy-lane.py','build','--',process.execPath,'--input-type=module','--eval',program]}];
  return {immediate,preparation,consumers:testJobs(consumers,'products')};
}

/** Run all independent steps against the same private mirror index. A failed
 * prerequisite never launches its dependent tests; the refusal names both.
 * @param {string} repository @param {import('./build-mirror.mjs').Mirror} mirror
 * @param {ReturnType<typeof candidateCheckPlan>} plan @param {number} deadline
 * @param {import('./precommit-candidate.mjs').CandidatePlanOptions} [options] */
export async function runCandidatePlan(repository, mirror, plan, deadline, options = {}) {
  const {signal,token,execute=runCommitJobs}=options;
  const gitDirectory=execFileSync('git',['rev-parse','--absolute-git-dir'],{cwd:repository,encoding:'utf8'}).trim();
  mkdirSync(resolve(repository,'tmp'),{recursive:true});
  const temporary=mkdtempSync(resolve(repository,'tmp/commit-candidate-'));
  const reads=resolve(temporary,'reads.jsonl');
  const {WS_COMMIT_READ_SET:readSet}=process.env;
  const environment={...process.env,...(token===undefined?{}:{WS_COMMIT_RELATED_TOKEN:token}),
    GIT_DIR:gitDirectory,
    GIT_WORK_TREE:mirror.dir,GIT_INDEX_FILE:resolve(mirror.dir,'../index'),WS_COMMIT_READ_SET:reads};
  /** @type {import('./precommit-jobs.mjs').CommitResult[]} */ let completed=[];
  /** @type {unknown} */ let failure;
  let refused=false;
  try {
    const typesStopped=new AbortController();
    const typeSignal=signal===undefined?typesStopped.signal:AbortSignal.any([signal,typesStopped.signal]);
    const observe=(/** @type {import('./precommit-jobs.mjs').CommitResult} */ result)=>{
      if(token!==undefined&&result.name.startsWith('related tests')&&result.code!==0&&!result.timedOut&&result.cancelled!==true
        &&result.output.includes(`CF1 TEST FAILURE: ${token} `))typesStopped.abort();
    };
    const types=execute(mirror.dir,plan.immediate.filter(job=>job.name==='candidate types'),deadline,environment,typeSignal);
    const immediate=execute(mirror.dir,plan.immediate.filter(job=>job.name!=='candidate types'),deadline,environment,signal,observe);
    const dependent=(async()=>{
      const prepared=await execute(mirror.dir,plan.preparation,deadline,environment,signal);
      if(prepared.some(result=>result.code!==0)) {
        const capped=prepared.some(result=>result.timedOut);
        return [...prepared,...plan.consumers.map(job=>({name:job.name,code:capped?124:1,timedOut:capped,
          output:'Not started: candidate product prerequisite did not complete'}))];
      }
      return [...prepared,...await execute(mirror.dir,plan.consumers,deadline,environment,signal,observe)];
    })();
    const settled=await Promise.allSettled([types,immediate,dependent]);
    for(const result of settled)if(result.status==='rejected')throw result.reason;
    completed=settled.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  }catch(error){refused=true;failure=error;}
  try {
      if(readSet!==undefined&&existsSync(reads)) {
        for(const line of readFileSync(reads,'utf8').split('\n').filter(Boolean)) {
          /** @type {unknown} */ const row=JSON.parse(line);
          if(typeof row!=='object'||row===null||typeof Reflect.get(row,'root')!=='string')
            throw new Error('Candidate checker read set has an invalid root');
          appendFileSync(readSet,`${JSON.stringify({...row,root:Reflect.get(row,'root')===mirror.dir?repository:Reflect.get(row,'root')})}\n`);
        }
      }
  }catch(error){if(!refused){refused=true;failure=error;}}
  finally{rmSync(temporary,{recursive:true,force:true});}
  if(refused)throw failure;
  return completed;
}

/** A cap is the explicit G757 handoff, never a tooling-error exemption. Keep
 * this worker's executed/collection reds and compiler diagnostics at the cap.
 * Nested fixture output cannot impersonate an owning worker's token.
 * @param {readonly import('./precommit-jobs.mjs').CommitResult[]} results
 * @param {string} token */
export function candidateStepOutcomes(results, token) {
  /** @type {string[]} */ const failures=[],deferred=[];
  for(const result of results) {
    const ownTestRed=result.name.startsWith('related tests')&&[
      `CF1 TEST FAILURE: ${token} `,`CF1 RUNNER FAILURE: ${token} `,
    ].some(marker=>result.output.includes(marker));
    const compilerRed=result.name==='candidate types'&&/\berror TS\d+:/u.test(result.output);
    const nodeRed=result.name.startsWith('node tests')&&/^not ok \d+ - /mu.test(result.output);
    const productRed=result.name==='candidate products'&&/^(?:Error|TypeError|ValidationError):/mu.test(result.output);
    if(result.cancelled===true||ownTestRed||compilerRed||nodeRed||productRed)
      failures.push(`${result.name}: ${result.cancelled===true?'cancelled':'observed refusal'}`);
    else if(result.code===0)continue;
    else if(result.timedOut)deferred.push(result.name);
    else failures.push(`${result.name}: tooling/prerequisite failed (exit ${result.code})`);
  }
  return {failures,deferred};
}
