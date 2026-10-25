import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- A tiny Git fixture supplies immutable commits without copying the repo.
import {execFileSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the isolated gate products and receipts.
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine all fixture files to this test's scratch directory.
import {join} from 'node:path';
import {checkCustomSectionGrowth} from '../scripts/check-custom-section-growth.mjs';
import {platformOutput} from './fixtures/platformOutputs';

it('checks emitted products against committed base data and reuses exact receipts',()=>{
 mkdirSync('tmp',{recursive:true});
 const root=mkdtempSync('tmp/custom-section-gate-'),receipts=join(root,'receipts');
 const git=(...args:string[]):string=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const commit=():string=>{
  git('add','lint/ratchet.json','lint/legacy-shards.json','src/shards');
  return git('-c','user.name=Fixture','-c','user.email=fixture@example.test','commit-tree',git('write-tree'),'-m','Fixture');
 };
 try{
  git('init');
  mkdirSync(join(root,'lint'));mkdirSync(join(root,'src/shards/demo'),{recursive:true});
  mkdirSync(join(root,'src/shards/demo-legacy'),{recursive:true});
  const budgets={'custom-sections/demo/count':1,'custom-sections/demo/bytes':8};
  writeFileSync(join(root,'lint/ratchet.json'),JSON.stringify({budgets}));
  writeFileSync(join(root,'lint/legacy-shards.json'),JSON.stringify({version:1,sealed:true,shards:{'demo-legacy':{
   primary:'demo',source:'a'.repeat(40),files:{'manifest.ts':'b'.repeat(64),'plugin.ts':'c'.repeat(64)},
  }}}));
  writeFileSync(join(root,'src/shards/demo/shard.config.ts'),'export default {};');
  // The builder does not emit a product for a reviewed frozen predecessor.
  writeFileSync(join(root,'src/shards/demo-legacy/shard.config.ts'),'export default {};');
  const base=commit();
  writeFileSync(join(root,'src/shards/demo/shard.config.ts'),'export default {}; // next revision');
  const revision=commit();
  mkdirSync(receipts,{recursive:true});
  writeFileSync(join(receipts,`${base}.json`),JSON.stringify({revision:base,shards:{demo:{count:1,bytes:9}}}));
  platformOutput(root,'demo',{}, {'custom/wind':'{"key":12}'});
  expect(checkCustomSectionGrowth(root,root,base,revision,receipts)).toEqual([
   'demo: custom-section bytes 10 exceeds budget 8 and pushed base 9',
  ]);
  expect(existsSync(join(receipts,`${revision}.json`))).toBe(false);
  rmSync(join(receipts,`${base}.json`));
  expect(()=>checkCustomSectionGrowth(root,root,base,revision,receipts)).toThrow('exact receipt required');
  writeFileSync(join(receipts,`${base}.json`),JSON.stringify({revision:base,shards:{demo:{count:1,bytes:9}}}));
  platformOutput(root,'demo',{}, {'custom/wind':'{"key":1}'});
  expect(checkCustomSectionGrowth(root,root,base,revision,receipts)).toEqual([]);
  expect(JSON.parse(readFileSync(join(receipts,`${revision}.json`),'utf8'))).toEqual({revision,shards:{demo:{count:1,bytes:9}}});
  // The next push reuses its exact receipt without a predecessor rebuild.
  expect(checkCustomSectionGrowth(root,root,revision,revision,receipts)).toEqual([]);
  rmSync(join(root,'out/demo/shard.json'));
  expect(()=>checkCustomSectionGrowth(root,root,revision,revision,receipts)).toThrow('section inventory missing');
  // A new gate can admit in-budget products without any historical receipt.
  platformOutput(root,'demo');
  expect(checkCustomSectionGrowth(root,root,base,base,receipts)).toEqual([]);
  expect(JSON.parse(readFileSync(join(receipts,`${base}.json`),'utf8'))).toEqual({revision:base,shards:{demo:{count:0,bytes:0}}});
  // Retired count/byte capacity cannot be spent on a new private identity.
  writeFileSync(join(root,'lint/custom-sections.json'),JSON.stringify({version:1,baselineAt:base,baseline:{demo:{count:1,bytes:8}},freeze:{at:base,names:{demo:[]}}}));
  platformOutput(root,'demo',{}, {'custom/new':'{}'});
  expect(checkCustomSectionGrowth(root,root,base,revision,receipts)).toEqual(['demo: new custom section custom/new is frozen']);
  platformOutput(root,'demo');
  expect(checkCustomSectionGrowth(root,root,base,revision,receipts)).toEqual([]);
  const source='@wildshard/format/demo#DemoSchema',document={$comment:source,type:'object'};
  const hash='44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
  const index:unknown=JSON.parse(readFileSync(join(root,'out/demo/shard.json'),'utf8'));
  if(typeof index!=='object'||index===null)throw new Error('Missing output fixture');
  const generic={name:'new.json',path:`blobs/json/${hash}.json`,hash,kind:'json',compressed:2,decoded:0,gpu:0,triangles:0,draws:0,dependencies:[],critical:false,jsonSchema:document};
  Reflect.set(index,'files',[generic]);
  mkdirSync(join(root,'out/demo/blobs/json'),{recursive:true});
  writeFileSync(join(root,'out/demo',generic.path),'{}');
  writeFileSync(join(root,'out/demo/shard.json'),JSON.stringify(index));
  // Missing catalogue refuses, then an exact defining contract admits the new generic JSON.
  expect(checkCustomSectionGrowth(root,root,base,revision,receipts)).toEqual(['demo: new named JSON new.json needs verified shared-format schema provenance']);
  mkdirSync(join(root,'.wildshard/format'),{recursive:true});
  writeFileSync(join(root,'.wildshard/format/named.json'),JSON.stringify({[source]:document}));
  expect(checkCustomSectionGrowth(root,root,base,revision,receipts)).toEqual([]);
  generic.jsonSchema={...document,type:'number'};
  writeFileSync(join(root,'out/demo/shard.json'),JSON.stringify(index));
  expect(checkCustomSectionGrowth(root,root,base,revision,receipts)).toHaveLength(1);

 }finally{rmSync(root,{recursive:true,force:true});}
});
