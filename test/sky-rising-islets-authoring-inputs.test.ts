// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the complete retained authoring job in its isolated tree.
import process from 'node:process';
import {expect,it} from 'vitest';
import {auditAuthoringInputs,isAuthoringInput} from '../scripts/authoring-inputs.mjs';
import {discoverGeneration} from '../scripts/generate.mjs';

it('keys the exact confined portalFloors closure and preserves the original ordered box product',()=>{
 const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='sky-rising-islets');
 if(job===undefined||job.shard!=='far-reach')throw new Error('Missing portalFloors job');
 const audits=[job.entry,'src/sdk/bake/source-loader.mjs'].map(entry=>auditAuthoringInputs(root,'far-reach',entry));
 expect(audits.flatMap(audit=>audit.issues)).toEqual([]);
 const expected=[...new Set([...audits.flatMap(audit=>audit.files),'src/sdk/bake/json.mjs','src/sdk/package.json','src/format/package.json','package.json','pnpm-lock.yaml'])].sort();
 expect(job.inputRoots).toEqual(expected);
 expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'far-reach')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
 expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs','src/sdk/bake/json.mjs',job.entry,'risingIsletRows','src/shards/far-reach/data/islets.generated.json']);
 expect(job.seedOutputs).toEqual([]);
 expect(job.outputs).toEqual(['src/shards/far-reach/data/islets.generated.json']);
 expect(job.buildOutputs).toEqual({'src/shards/far-reach/data/islets.generated.json':'ac1762788cb392151c16285dab616053b7403f443a0cccbd0634f396c9200b2c'});
});
