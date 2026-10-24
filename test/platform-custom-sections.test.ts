import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The ratchet fixture owns these temporary policy files.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine policy paths to the fixture.
import {join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small isolated policy fixture.
import {tmpdir} from 'node:os';
import {customSectionFailures} from '../scripts/shard-platform-sections.mjs';
import {comparePlatformList} from '../scripts/check-platform-ratchets.mjs';
import {compareCustomSections,customSectionGrowthFailures} from '../scripts/custom-section-policy.mjs';

const growthBudgets={'custom-sections/demo/count':2,'custom-sections/demo/bytes':100};
it('permits section growth up to both budgets',()=>{
 expect(customSectionGrowthFailures(growthBudgets,{demo:{count:1,bytes:50}},{demo:{count:2,bytes:100}})).toEqual([]);
});
it('refuses each over-budget metric only when it grows past the pushed base',()=>{
 expect(customSectionGrowthFailures(growthBudgets,{demo:{count:3,bytes:110}},{demo:{count:4,bytes:111}})).toEqual([
  'demo: custom-section count 4 exceeds budget 2 and pushed base 3',
  'demo: custom-section bytes 111 exceeds budget 100 and pushed base 110',
 ]);
 expect(customSectionGrowthFailures(growthBudgets,{demo:{count:3,bytes:110}},{demo:{count:2,bytes:111}})).toHaveLength(1);
 expect(customSectionGrowthFailures(growthBudgets,{demo:{count:1,bytes:50}},{demo:{count:3,bytes:50}})).toHaveLength(1);
});
it('permits an existing excess to shrink or hold independently',()=>{
 for(const after of [{count:3,bytes:110},{count:4,bytes:120},{count:4,bytes:110}])
  expect(customSectionGrowthFailures(growthBudgets,{demo:{count:4,bytes:120}},{demo:after})).toEqual([]);
});
it('never treats a ruler upper bound as an exact measurement after a budget cut',()=>{
 const before={demo:{count:2,bytes:100,bounds:['count','bytes']}};
 expect(customSectionGrowthFailures(growthBudgets,before,{demo:{count:3,bytes:100}})).toEqual([
  'demo: custom-section count 3 exceeds budget 2 and pushed base at most 2',
 ]);
 expect(customSectionGrowthFailures({...growthBudgets,'custom-sections/demo/bytes':50},before,{demo:{count:1,bytes:75}})).toEqual([
  'demo: custom-section bytes 75 exceeds budget 50; exact pushed base needed (known only to be at most 100)',
 ]);
});

it('enforces both ceilings and a named exit for every private section',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-custom-section-'));
 const policy=(count:number,bytes:number,exits:Record<string,string>):void=>{
  writeFileSync(join(root,'lint/ratchet.json'),JSON.stringify({budgets:{'custom-sections/demo/count':count,'custom-sections/demo/bytes':bytes},allow:{'shardfile/custom-sections':exits}}));
 };
 const measures={demo:{customSections:[{name:'custom/wind',bytes:9}]}};
 try{
  mkdirSync(join(root,'lint'));mkdirSync(join(root,'docs/plans'),{recursive:true});
  writeFileSync(join(root,'docs/plans/port.md'),'| Row | Status |\n| Wind host | open |\n');
  policy(1,9,{'demo/custom/wind':'docs/plans/port.md#Wind host'});
  expect(customSectionFailures(root,measures)).toEqual([]);
  expect(customSectionFailures(root,{demo:{customSections:[...measures.demo.customSections,{name:'private.json',bytes:7}]}})).toEqual(['demo: custom-section count 2 exceeds 1','demo: custom-section bytes 16 exceeds 9']);
  policy(0,8,{});
  expect(customSectionFailures(root,measures)).toEqual(['demo: custom-section count 1 exceeds 0','demo: custom-section bytes 9 exceeds 8','demo: custom/wind needs a recorded plan exit row']);
  policy(2,100,{'demo/custom/wind':'docs/plans/port.md#Absent row'});
  expect(customSectionFailures(root,measures)).toEqual(['demo: custom/wind needs a recorded plan exit row']);
  writeFileSync(join(root,'lint/ratchet.json'),'{}');
  expect(customSectionFailures(root,{demo:{customSections:[]}})).toEqual(['demo: missing custom-section count ceiling','demo: missing custom-section bytes ceiling']);
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('cannot enlarge or remove either custom-section policy ceiling',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-custom-policy-'));
 const before=join(root,'before.json'),after=join(root,'after.json');
 const policy=(count:number,bytes:number):string=>JSON.stringify({budgets:{'custom-sections/demo/count':count,'custom-sections/demo/bytes':bytes}});
 try{
  writeFileSync(before,policy(2,100));writeFileSync(after,policy(1,90));
  expect(comparePlatformList('lint/ratchet.json',before,after)).toEqual([]);
  writeFileSync(after,policy(3,101));
  expect(comparePlatformList('lint/ratchet.json',before,after)).toEqual(['demo: custom-section ceilings are shrink-only']);
  for(const [count,bytes]of [[3,100],[2,101]] as const) {
   writeFileSync(after,policy(count,bytes));
   expect(comparePlatformList('lint/ratchet.json',before,after)).toEqual(['demo: custom-section ceilings are shrink-only']);
  }
  writeFileSync(after,'{}');
  expect(comparePlatformList('lint/ratchet.json',before,after)).toHaveLength(2);
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('refuses count and byte rises even with old adoption or measured-reset records',()=>{
 const budgets=(count:number,bytes:number):Record<string,number>=>({'custom-sections/demo/count':count,'custom-sections/demo/bytes':bytes});
 const base={version:1,baselineAt:'a'.repeat(40),baseline:{demo:{count:2,bytes:100}}};
 const row={slug:'demo',from:{count:2,bytes:100},to:{count:3,bytes:101},why:'historical override'};
 const reset={revision:'b'.repeat(40),ceilings:{demo:row.to}};
 for(const after of [base,{...base,raises:[row]},{...base,g514Reset:reset},
   {...base,remeasures:[{...reset,why:'measured'}]},{...base,risesCloseAt:null,raises:[row]}]) {
  for(const [count,bytes]of [[3,100],[2,101],[3,101]] as const)
   expect(compareCustomSections(budgets(2,100),budgets(count,bytes),base,after)).toContain('demo: custom-section ceilings are shrink-only');
 }
 expect(compareCustomSections(budgets(2,100),budgets(1,80),base,base)).toEqual([]);
 expect(compareCustomSections(budgets(2,100),budgets(2,100),base,base)).toEqual([]);
});

it('drops obsolete override history while preserving the immutable original baseline',()=>{
 const budgets={'custom-sections/demo/count':2,'custom-sections/demo/bytes':100};
 const base={version:1,baselineAt:'a'.repeat(40),baseline:{demo:{count:2,bytes:100}}};
 const old={...base,risesCloseAt:'W1 spike end',raises:[],g514Reset:{revision:'b'.repeat(40),ceilings:base.baseline},remeasures:[]};
 expect(compareCustomSections(budgets,budgets,old,base)).toEqual([]);
 expect(compareCustomSections(budgets,budgets,base,old)).toContain('custom-section policy is malformed');
 expect(compareCustomSections(budgets,budgets,base,{...base,baselineAt:'c'.repeat(40)})).toContain('custom-section initial baseline is immutable');
 expect(compareCustomSections(budgets,budgets,base,{...base,baseline:{}})).toContain('custom-section initial baseline is immutable');
 expect(compareCustomSections(budgets,budgets,base,undefined)).toContain('custom-section policy cannot be removed');
 expect(compareCustomSections(budgets,budgets,{},base)).toContain('custom-section predecessor policy is malformed');
 expect(compareCustomSections(budgets,budgets,undefined,base)).toEqual([]);
 expect(compareCustomSections({},budgets,undefined,base)).toContain('demo: custom-section ceilings are shrink-only');
 expect(compareCustomSections(budgets,{'custom-sections/demo/count':2},base,base)).not.toEqual([]);
});
