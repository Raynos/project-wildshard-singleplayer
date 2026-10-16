// P4 orchestration is deliberately separate from gen: no build -> gen -> build cycle.
import {resolve} from 'node:path';
import {runtimeClosures} from './shard-runtime-closure.mjs';
import {outputShardLines,portHeadline,sourceProgressLines} from './shard-platform.mjs';
import {outputContent} from './shard-output-content.mjs';
import {customSectionFailures} from './shard-platform-sections.mjs';
import {genPortShares} from './gen-port-shares.mjs';
import {writeGeneratorInventory} from './generator-inventory.mjs';
import {gridReady,m3Progress,planProgress} from './shard-milestones.mjs';
import {runtimeReceiptPaths} from './grid-runtime-evidence.mjs';

/** Caller holds the heavy build lane (or measures the gate's exact HEAD output).
 * Each closed shard is copied strictly; an unclosed shard never gets a percent.
 * @param {string} root @param {{build?:boolean,products?:string,revision?:string|null,receipts?:readonly string[]}} options */
export async function outputReport(root,{build=true,products=resolve(root,'out'),revision=process.env.VERCEL_GIT_COMMIT_SHA??null,receipts=runtimeReceiptPaths(root)}={}) {
  const closure=runtimeClosures(root),closed=Object.keys(closure).filter(slug=>closure[slug].status==='closed');
  if(build) {
    if(products!==resolve(root,'out'))throw new Error('Build reports publish only to out/');
    const {buildShardfiles}=await import('./build-shardfiles.mjs');
    // Preparation copies raw-closed runtimes strictly and emits
    // unclosed products without copies. All receive actual byte-validation evidence.
    await buildShardfiles(root,{strict:false,copyRuntime:'closed',reuse:true});
  }
  const measures=outputShardLines(root,true,products,closed);
  const source=Object.values(closure).some(row=>row.status==='unclosed')?sourceProgressLines(root):{};
  const rows=Object.fromEntries(Object.entries(closure).map(([slug,state])=>{
    const ready=gridReady(root,slug,products,{revision,receipts});
    if(state.status==='unclosed') {
      const progress=source[slug];
      return [slug,{...state,customPercent:null,port:null,gridReady:ready,m3:m3Progress(slug,progress),
        assemblyScriptLines:progress.assemblyScriptLines,assemblyScriptBudget:progress.assemblyScriptBudget}];
    }
    if(!Object.hasOwn(measures,slug))throw new Error(`${slug}: closed runtime has no output measure`);
    const measured=measures[slug];
    const content=outputContent(root,slug,products),customPercent=measured.conversion.runtimeShare===null?null:100*measured.conversion.runtimeShare;
    return [slug,{...state,...measured,customPercent,content,port:portHeadline(customPercent,content),gridReady:ready,
      m3:m3Progress(slug,{basis:'output',customLines:measured.conversion.customRuntimeLines,legacyLines:measured.conversion.legacyLines})}];
  }));
  // This report's incomplete shards do not borrow budget space or receive zeroes.
  const sections=Object.fromEntries(Object.entries(measures).map(([slug,row])=>[slug,{customSections:row.customSections??[]}]));
  return {rows,measures,progress:planProgress(rows),failures:customSectionFailures(root,sections)};
}

/** Cycle-free post-output publication. gen calls neither the builder nor ruler.
 * @param {string} root @param {Record<string,import('./shard-platform.mjs').ShardLines>} measures */
export function refreshOutputReports(root,measures) {
  genPortShares(root,measures);
  writeGeneratorInventory(root,measures);
}
