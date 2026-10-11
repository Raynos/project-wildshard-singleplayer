// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the complete retained authoring job in its isolated tree.
import process from 'node:process';
import {expect,it} from 'vitest';
import {auditAuthoringInputs,isAuthoringInput} from '../scripts/authoring-inputs.mjs';
import {discoverGeneration} from '../scripts/generate.mjs';

it('keys the exact confined floorBoxes closure and preserves the original ordered box product',()=>{
 const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nine-floor-boxes');
 if(job===undefined||job.shard!=='nine-dragon-stack')throw new Error('Missing floorBoxes job');
 const audits=[job.entry,'src/sdk/bake/source-loader.mjs'].map(entry=>auditAuthoringInputs(root,'nine-dragon-stack',entry));
 expect(audits.flatMap(audit=>audit.issues)).toEqual([]);
 const expected=[...new Set([...audits.flatMap(audit=>audit.files),'src/sdk/bake/json.mjs','src/sdk/package.json','src/format/package.json','package.json','pnpm-lock.yaml'])].sort();
 expect(job.inputRoots).toEqual(expected);
 expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nine-dragon-stack')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
 expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs','src/sdk/bake/json.mjs',job.entry,'floorBoxRows','src/shards/nine-dragon-stack/data/floorBoxes.generated.json']);
 expect(job.seedOutputs).toEqual([]);
 expect(job.outputs).toEqual(['src/shards/nine-dragon-stack/data/floorBoxes.generated.json']);
 expect(job.buildOutputs).toEqual({'src/shards/nine-dragon-stack/data/floorBoxes.generated.json':'9ff69ebfcc6d83a941dee58bf603b089339a04ba9e9b6315134cc69cbbe536e6'});
});
