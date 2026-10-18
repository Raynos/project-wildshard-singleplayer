import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The ratchet fixture owns these temporary policy files.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine policy paths to the fixture.
import {join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small isolated policy fixture.
import {tmpdir} from 'node:os';
import {customSectionFailures} from '../scripts/shard-platform-sections.mjs';
import {comparePlatformList} from '../scripts/check-platform-ratchets.mjs';
import {compareCustomSections} from '../scripts/custom-section-policy.mjs';

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
  expect(comparePlatformList('lint/ratchet.json',before,after)).toEqual(['demo: custom-section ceiling rises without a raises line']);
  for(const [count,bytes]of [[3,100],[2,101]] as const) {
   writeFileSync(after,policy(count,bytes));
   expect(comparePlatformList('lint/ratchet.json',before,after)).toEqual(['demo: custom-section ceiling rises without a raises line']);
  }
  writeFileSync(after,'{}');
  expect(comparePlatformList('lint/ratchet.json',before,after)).toHaveLength(2);
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('requires exact appended adoption rises and permanently seals them at the spike end',()=>{
 const budgets=(count:number,bytes:number):Record<string,number>=>({'custom-sections/demo/count':count,'custom-sections/demo/bytes':bytes});
 const base={version:1,baselineAt:'a'.repeat(40),baseline:{demo:{count:2,bytes:100}},risesCloseAt:null,raises:[]};
 const row={slug:'demo',from:{count:2,bytes:100},to:{count:3,bytes:101},why:'Admit the reviewed W2 section'};
 const raised={...base,raises:[row]};
 expect(compareCustomSections(budgets(1,90),budgets(2,100),undefined,base)).toEqual([]);
 expect(compareCustomSections(budgets(2,100),budgets(3,101),base,base)).toHaveLength(1);
 expect(compareCustomSections(budgets(2,100),budgets(3,101),base,raised)).toEqual([]);
 expect(compareCustomSections(budgets(3,101),budgets(4,102),raised,raised)).toHaveLength(1);
 expect(compareCustomSections(budgets(2,100),budgets(1,80),base,base)).toEqual([]);
 expect(compareCustomSections(budgets(3,101),budgets(3,101),raised,{...raised,raises:[{...row,why:'edit'}]})).toContain('custom-section raises must remain an immutable append-only history');
 expect(compareCustomSections(budgets(2,100),budgets(2,100),base,raised)).toContain('demo: custom-section raises line matches no ceiling change');
 const sealed={...base,risesCloseAt:'W1 spike end'};
 expect(compareCustomSections(budgets(2,100),budgets(2,100),base,sealed)).toEqual([]);
 expect(compareCustomSections(budgets(2,100),budgets(3,101),base,{...raised,risesCloseAt:'W1 spike end'})).toEqual([]);
 expect(compareCustomSections(budgets(2,100),budgets(3,101),sealed,{...sealed,raises:[row]})).toContain('demo: custom-section rises closed at W1 spike end');
 expect(compareCustomSections(budgets(2,100),budgets(2,100),sealed,base)).toContain('custom-section rise window cannot reopen');
 expect(compareCustomSections(budgets(2,100),{'custom-sections/demo/count':2},base,base)).not.toEqual([]);
});
