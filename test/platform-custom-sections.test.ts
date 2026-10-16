import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The ratchet fixture owns these temporary policy files.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine policy paths to the fixture.
import {join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small isolated policy fixture.
import {tmpdir} from 'node:os';
import {customSectionFailures} from '../scripts/shard-platform-sections.mjs';
import {comparePlatformList} from '../scripts/check-platform-ratchets.mjs';

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
  expect(comparePlatformList('lint/ratchet.json',before,after)).toHaveLength(2);
  writeFileSync(after,'{}');
  expect(comparePlatformList('lint/ratchet.json',before,after)).toHaveLength(2);
 }finally{rmSync(root,{recursive:true,force:true});}
});
