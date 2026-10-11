// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the complete retained authoring job in its isolated tree.
import process from 'node:process';
import {expect,it} from 'vitest';
import {auditAuthoringInputs,isAuthoringInput} from '../scripts/authoring-inputs.mjs';
import {discoverGeneration} from '../scripts/generate.mjs';

it('keys the exact confined Nine front scene closure and preserves the original ordered box product',()=>{
 const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nine-fronts');
 if(job===undefined||job.shard!=='nine-dragon-stack')throw new Error('Missing Nine fronts job');
 const audits=[job.entry,'src/sdk/bake/source-loader.mjs'].map(entry=>auditAuthoringInputs(root,'nine-dragon-stack',entry));
 expect(audits.flatMap(audit=>audit.issues)).toEqual([]);
 const expected=[...new Set([...audits.flatMap(audit=>audit.files),'src/sdk/bake/json.mjs','src/sdk/package.json','src/format/package.json','package.json','pnpm-lock.yaml'])].sort();
 expect(job.inputRoots).toEqual(expected);
 expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nine-dragon-stack')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
 expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs','src/sdk/bake/json.mjs',job.entry,'frontRows','src/shards/nine-dragon-stack/data/fronts.generated.json']);
 expect(job.seedOutputs).toEqual([]);
 expect(job.outputs).toEqual(['src/shards/nine-dragon-stack/data/fronts.generated.json']);
 expect(job.buildOutputs).toEqual({'src/shards/nine-dragon-stack/data/fronts.generated.json':'1d3a18fd4a5d72a1db603183051edb18b4e59c8a83156ef283271f8a322eaa9d'});
});
