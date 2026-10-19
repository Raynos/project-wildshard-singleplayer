/** Partial original build provenance is not full compiled-runtime equality. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, PREVIEW, hash } from './admission.mjs';
export function runtimeSourceComparison(root=ROOT){
 const preview=JSON.parse(readFileSync(resolve(root,PREVIEW,'preview.json')));
 const compare=files=>Object.entries(files).map(([path,expected])=>{
  if(path.startsWith('/')||path.split('/').includes('..'))throw new Error('Unsafe original source path');
  const actual=existsSync(resolve(root,path))?hash(readFileSync(resolve(root,path))):null;return {path,expected,actual,match:actual===expected};
 });
 const buildPin=compare(preview.buildPin.files),sourceFreeze=compare(preview.sourceFreeze.files),covered=new Set([...buildPin,...sourceFreeze].map(row=>row.path));
 const unlistedExamples=['src/engine/core/Game.ts','src/practiceBoot.ts','src/practiceContent.ts','src/engine/render/nodes/tentShadowFilter.ts'].filter(path=>!covered.has(path));
 return {schema:'wildshard.conch.public4-tent.runtime-scope.v1',originalPreviewSha256:hash(readFileSync(resolve(root,PREVIEW,'preview.json'))),buildPin,sourceFreeze,unlistedExamples,entireCompiledRuntimeEqualityProven:false,scope:'The original build2 preview retains partial source/build input hashes only. Named matching files and exact product/native bytes are proven; source outside that coverage and compiled behavior as a whole are not. This candidate recompiles the current host. Actual original4/candidate comparisons have only the scope of their recorded states, geometry, strike specifications and shader programs.'};
}
