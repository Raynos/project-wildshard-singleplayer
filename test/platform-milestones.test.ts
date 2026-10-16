import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Small evidence fixtures, never repository copies.
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import {join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated disposable directory.
import {tmpdir} from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind the receipt to the actual fixture index.
import {createHash} from 'node:crypto';
import {emptyShardfile} from '../src/sdk/author';
import {outputSectionPayloads} from '../src/format/outputIndex';
import {MILESTONE_SHARDS,m3Progress,planProgress,gridReady,readinessVerdict} from '../scripts/shard-milestones.mjs';
import {sourceProgressLines} from '../scripts/shard-platform.mjs';
import {platformOutput} from './fixtures/platformOutputs';

it('weights actual must-go lines and keeps unknown M2 evidence out of a point claim',()=>{
 const input={basis:'source' as const,customLines:20,legacyLines:100};
 expect(m3Progress('far-reach',{...input,customLines:10})?.fraction).toBe(1);
 expect(m3Progress('pine-hollow',input)?.fraction).toBe(1);
 expect(m3Progress('nalati-grasslands',{...input,customLines:120})?.fraction).toBe(0);
 const rows:Parameters<typeof planProgress>[0]={};
 for(const slug of MILESTONE_SHARDS)rows[slug]={m3:m3Progress(slug,input),gridReady:{verdict:'unknown',criteria:{}}};
 const result=planProgress(rows);
 expect(result.m3).toMatchObject({cut:480,mustGo:500,fraction:.96});
 expect(result.m2).toMatchObject({lower:0,upper:1,unknown:6});
 expect(result.plan?.lower).toBeCloseTo(.576);
 expect(result.plan?.upper).toBeCloseTo(.976);
 expect(readinessVerdict({})).toBe('unknown');
});

it('requires bound validation evidence for each grid-ready criterion',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-grid-ready-'));
 try{
  const products=join(root,'out');
  expect(gridReady(root,'pine-hollow',products).verdict).toBe('unknown');
  const source=emptyShardfile({slug:'pine-hollow',name:'Fixture',author:'Test',revision:1,seed:1});
  platformOutput(root,'pine-hollow',{},Object.fromEntries([...outputSectionPayloads(source)].map(([name,value])=>[name,JSON.stringify(value)])));
  mkdirSync(join(root,'src/format'),{recursive:true});
  writeFileSync(join(root,'src/format/memoryGates.json'),JSON.stringify({explorerMB:1200,loadingMB:1800}));
  const bytes=readFileSync(join(products,'pine-hollow/shard.json'));
  const receipt={indexHash:createHash('sha256').update(bytes).digest('hex'),revision:'fixture',sourceHash:'0'.repeat(64),worst:{playing:100,loading:200}};
  const path=join(products,'pine-hollow/validation.json');writeFileSync(path,JSON.stringify(receipt));
  const ready=gridReady(root,'pine-hollow',products);
  expect(ready.criteria['fourEntryways']?.verdict).toBe('pass');
  expect(ready.criteria['hudAccent']?.verdict).toBe('pass');
  expect(ready.criteria['memory']?.verdict).toBe('pass');
  expect(ready.criteria['oneFrameLooks']?.verdict).toBe('unknown');
  expect(ready.criteria['bakedTiles']?.verdict).toBe('fail');
  writeFileSync(path,JSON.stringify({...receipt,worst:{playing:1_200_000_001,loading:200}}));
  expect(gridReady(root,'pine-hollow',products).criteria['memory']?.verdict).toBe('fail');
  writeFileSync(path,JSON.stringify({...receipt,indexHash:'f'.repeat(64)}));
  expect(gridReady(root,'pine-hollow',products).verdict).toBe('unknown');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('labels source progress without exposing an output percentage or executing source',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-source-progress-'));
 try{
  mkdirSync(join(root,'src/shards/pine-hollow/runtime'),{recursive:true});
  writeFileSync(join(root,'src/shards/pine-hollow/runtime/index.ts'),'throw new Error("never execute");');
  expect(sourceProgressLines(root)['pine-hollow']).toMatchObject({basis:'source',customLines:1,legacyLines:null});
  expect(sourceProgressLines(root)['pine-hollow']).not.toHaveProperty('runtimeShare');
 }finally{rmSync(root,{recursive:true,force:true});}
});
