// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the complete retained authoring job in its isolated tree.
import process from 'node:process';
import {expect,it} from 'vitest';
import { expectKeyedClosure } from './fixtures/authoringClosure';
import {auditAuthoringInputs,isAuthoringInput} from '../scripts/authoring-inputs.mjs';
import {discoverGeneration} from '../scripts/generate.mjs';

it('keys the complete confined portalFloors closure and preserves the original ordered box product',()=>{
 const root=process.cwd(),job=discoverGeneration(root).jobs.find(row=>row.id==='nine-portal-floors');
 if(job===undefined||job.shard!=='nine-dragon-stack')throw new Error('Missing portalFloors job');
 const audits=[job.entry,'src/sdk/bake/source-loader.mjs'].map(entry=>auditAuthoringInputs(root,'nine-dragon-stack',entry));
 expect(audits.flatMap(audit=>audit.issues)).toEqual([]);
 const expected=[...new Set([...audits.flatMap(audit=>audit.files),'src/sdk/bake/json.mjs','src/sdk/package.json','src/format/package.json','package.json','pnpm-lock.yaml'])].sort();
 expectKeyedClosure(job.inputRoots, expected, 'nine-dragon-stack');
 expect(job.inputRoots.filter(file=>!isAuthoringInput(file,'nine-dragon-stack')&&!['package.json','pnpm-lock.yaml'].includes(file))).toEqual([]);
 expect(job.command).toEqual(['--import','./src/sdk/bake/source-loader.mjs','src/sdk/bake/json.mjs',job.entry,'portalFloorRows','src/shards/nine-dragon-stack/data/portalFloors.generated.json']);
 expect(job.seedOutputs).toEqual([]);
 expect(job.outputs).toEqual(['src/shards/nine-dragon-stack/data/portalFloors.generated.json']);
 expect(job.buildOutputs).toEqual({'src/shards/nine-dragon-stack/data/portalFloors.generated.json':'263927c5802155382328da9e16d2c2813c0bd8f0726130796f77ac1479d33b27'});
});
