#!/usr/bin/env node
// G668: measure two normal generation runs at one landed revision.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openMirror} from './build-mirror.mjs';
import {quietCli} from './quiet-cli.mjs';

/** @param {string[]} args */
export function generationBenchmarkOptions(args) {
  const revisions=args.filter(arg=>arg.startsWith('--rev='));
  const parallels=args.filter(arg=>arg.startsWith('--parallel='));
  const revision=revisions[0]?.slice(6)??'HEAD',parallel=parallels[0]?.slice(11)??'4';
  if(revisions.length>1||parallels.length>1||args.length!==revisions.length+parallels.length
    ||!/^(?:HEAD|[a-f0-9]{40})$/u.test(revision)||!/^[1-4]$/u.test(parallel)) {
    throw new Error('Expected --rev=HEAD|<full-main-sha> and --parallel=1..4');
  }
  return {revision,parallel};
}

/** Queue/sync are outside these command wall times. A failure stops the pair.
 * @param {()=>void} run @param {()=>number} [now]
 * @param {(row:{phase:string,seconds:number,success:boolean})=>void} [report] */
export function measureGenerationPair(run,now=()=>performance.now(),report=row=>console.info(`generation-benchmark: ${JSON.stringify(row)}`)) {
  for(const phase of ['initial','warm']) {
    const started=now();let success=false;
    try {run();success=true;}
    finally {report({phase,seconds:(now()-started)/1000,success});}
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const {revision,parallel}=generationBenchmarkOptions(process.argv.slice(2));
    quietCli('generation-benchmark');
    const mirror=openMirror(revision);
    try {
      console.info(`generation-benchmark: committed ${mirror.sha}; initial then unchanged warm, parallel=${parallel}`);
      const child=`import {spawnSync} from 'node:child_process';
import {measureGenerationPair} from './scripts/benchmark-generation.mjs';
measureGenerationPair(()=>{
  const result=spawnSync(process.execPath,['scripts/gen.mjs','--build-inputs','--parallel=${parallel}'],{stdio:'inherit'});
  if(result.error!==undefined)throw result.error;
  if(result.status!==0)throw new Error('Generation exited '+String(result.status));
});`;
      const result=spawnSync('python3',['scripts/heavy-lane.py','build','--',process.execPath,'--input-type=module','--eval',child],{
        cwd:mirror.dir,stdio:'inherit',env:{...process.env,VERCEL_GIT_COMMIT_SHA:mirror.sha},
      });
      if(result.error!==undefined)throw result.error;
      process.exitCode=result.status??1;
    } finally {mirror.release();}
  } catch(error) {
    console.error(error instanceof Error?error.message:String(error));process.exitCode=1;
  }
}
