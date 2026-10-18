// P4 orchestration is deliberately separate from gen: no build -> gen -> build cycle.
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {runtimeClosures} from './shard-runtime-closure.mjs';
import {outputShardLines,portHeadline,sourceProgressLines,codeLines,shaderCodeLines} from './shard-platform.mjs';
import {outputContent} from './shard-output-content.mjs';
import {customSectionFailures} from './shard-platform-sections.mjs';
import {outputSections} from './shard-platform-output.mjs';
import {writeGeneratorInventory} from './generator-inventory.mjs';
import {gridReady,m3Progress,planProgress} from './shard-milestones.mjs';
import {runtimeReceiptPaths} from './grid-runtime-evidence.mjs';
import {netLineReport,platformLineTotals,sourceLineDelta} from './shard-net-lines.mjs';
import {productScriptMetrics,scriptReceiptPaths} from './script-scenario-metrics.mjs';

const sourceBaseline=v.strictObject({since:v.string(),revision:v.string(),basis:v.literal('source'),customLines:v.record(v.string(),v.pipe(v.number(),v.integer(),v.minValue(0)))});
const baseline=v.array(v.strictObject({wave:v.string(),revision:v.string(),record:v.string(),customLines:v.record(v.string(),v.number()),platformLines:v.record(v.string(),v.number())}));

/** Caller holds the heavy build lane (or measures the gate's exact HEAD output).
 * Each closed shard is copied strictly; an unclosed shard never gets a percent.
 * @param {string} root @param {{build?:boolean,products?:string,revision?:string|null,receipts?:readonly string[],scriptReceipts?:readonly string[]}} options */
export async function outputReport(root,{build=true,products=resolve(root,'out'),revision=process.env.VERCEL_GIT_COMMIT_SHA??null,receipts=runtimeReceiptPaths(root),scriptReceipts=scriptReceiptPaths(root)}={}) {
  const closure=runtimeClosures(root),closed=Object.keys(closure).filter(slug=>closure[slug].status==='closed');
  if(build) {
    if(products!==resolve(root,'out'))throw new Error('Build reports publish only to out/');
    const {buildShardfiles}=await import('./build-shardfiles.mjs');
    // Preparation copies raw-closed runtimes strictly and emits
    // unclosed products without copies. All receive actual byte-validation evidence.
    await buildShardfiles(root,{strict:false,copyRuntime:'closed',reuse:true});
  }
  const measures=outputShardLines(root,true,products,closed);
  // The noon comparison stays source-based even after every runtime closes.
  const source=sourceProgressLines(root,products);
  // G496: data debt applies even before a shard's runtime closes.
  const sections=Object.fromEntries(Object.keys(closure).map(slug=>[slug,outputSections(root,slug,products)]));
  const dailyLines=sourceLineDelta(source,v.parse(sourceBaseline,JSON.parse(readFileSync(resolve(import.meta.dirname,'shard-line-baseline.json'),'utf8'))));
  const rows=Object.fromEntries(Object.entries(closure).map(([slug,state])=>{
    const ready=gridReady(root,slug,products,{revision,receipts});
    const scriptMetrics=productScriptMetrics(root,slug,products,scriptReceipts);
    if(state.status==='unclosed') {
      const progress=source[slug];
      return [slug,{...state,customPercent:null,port:null,linesRemovedSince12Z:dailyLines.shards[slug]??null,gridReady:ready,scriptMetrics,m3:m3Progress(slug,progress),
        customSections:sections[slug].customSections,customSectionBytes:sections[slug].customSectionBytes,
        assemblyScriptLines:progress.assemblyScriptLines,assemblyScriptBudget:progress.assemblyScriptBudget}];
    }
    if(!Object.hasOwn(measures,slug))throw new Error(`${slug}: closed runtime has no output measure`);
    const measured=measures[slug];
    const content=outputContent(root,slug,products),customPercent=measured.conversion.runtimeShare===null?null:100*measured.conversion.runtimeShare;
    return [slug,{...state,...measured,customPercent,content,linesRemovedSince12Z:dailyLines.shards[slug]??null,port:portHeadline(customPercent,content),gridReady:ready,scriptMetrics,
      m3:m3Progress(slug,{basis:'output',customLines:measured.conversion.customRuntimeLines,legacyLines:measured.conversion.legacyLines})}];
  }));
  const current=Object.fromEntries(Object.entries(rows).flatMap(([slug,row])=>row.m3===null?[]:[[slug,{customLines:row.m3.customLines,basis:row.m3.basis}]]));
  const baselines=v.parse(baseline,JSON.parse(readFileSync(resolve(import.meta.dirname,'wave-line-baselines.json'),'utf8')));
  const platform=platformLineTotals(root,(text,path)=>path.endsWith('.glsl')?shaderCodeLines(text):codeLines(text,path));
  return {rows,measures,dailyLines,netLines:netLineReport(current,baselines,platform),progress:planProgress(rows),failures:customSectionFailures(root,sections)};
}

/** Cycle-free post-output publication. gen calls neither the builder nor ruler.
 * @param {string} root @param {Record<string,import('./shard-platform.mjs').ShardLines>} measures */
export function refreshOutputReports(root,measures) {
  writeGeneratorInventory(root,measures);
}
