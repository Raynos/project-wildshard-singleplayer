// Regression: source-span publication must never turn an unknown census into zero.
// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated ruler publication fixtures.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep fixture files beneath the repository scratch root.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { componentInventory } from '../scripts/shard-components.mjs';
import { rulerSpanReports, writeRulerSpans } from '../scripts/admin-data/ruler-spans.mjs';

const revision='a'.repeat(40),shard='nalati-grasslands';
const empty={customSources:[],conversion:{customRuntimeLines:0}};

test('publishes the existing census for every shard, including zero-native rows',()=>{
  const native=['native',...Array.from({length:22},(_,index)=>`native-${index}`)];
  const rows=rulerSpanReports('',{
    ...Object.fromEntries(native.map(slug=>[slug,empty])),
    [shard]:{customSources:[{path:'src/game/population/pageGroups.ts',kind:'sole-export',name:'PagePopulationPlanner',lines:7}],conversion:{customRuntimeLines:7}},
  },[shard,...native],null);
  expect(Object.keys(rows)).toEqual([shard,...native]);
  expect(Object.keys(rows)).toHaveLength(24);
  // G667 retired this host's C4 override; supplied census lines still publish in full under its C9 fallback.
  expect(rows[shard]).toMatchObject({total:7,counts:{C4:0,C9:7},spans:[{symbol:'PagePopulationPlanner',component:'C9',lines:7}]});
  expect(rows['native']).toMatchObject({total:0,spans:[],measurementError:null});
  expect(()=>rulerSpanReports('',{},[shard],null)).toThrow('missing source spans');
});

test('retains class and method symbols without changing any counted line',()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/ruler-symbols-'));
  const path='src/shards/nalati-grasslands/runtime/index.ts';
  try {
    mkdirSync(dirname(resolve(root,path)),{recursive:true});
    writeFileSync(resolve(root,path),'export class Runtime {\n  begin() {\n    return 1;\n  }\n}\n');
    const row=componentInventory(root,shard,[{path,kind:'runtime-ts',lines:5}],5);
    expect(row.total).toBe(5);expect(row.counts.C9).toBe(5);
    expect(row.spans.map(entry=>[entry.symbol,entry.start,entry.end,entry.lines])).toEqual([
      ['Runtime',1,1,1],['Runtime.begin',2,4,3],['Runtime',5,5,1],
    ]);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('writes same-revision sibling files and replaces stale success with unknown',()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/ruler-span-files-'));
  try {
    const rows=rulerSpanReports('',{[shard]:empty,native:empty},[shard,'native'],null);
    writeRulerSpans(root,rows,revision);
    const file=resolve(root,`spans-${shard}.json`);
    expect(JSON.parse(readFileSync(file,'utf8'))).toMatchObject({revision,total:0,spans:[]});
    expect(existsSync(resolve(root,'spans-native.json'))).toBe(true);
    writeRulerSpans(root,rulerSpanReports('',{},[shard,'native'],'Incomplete verified products'),'b'.repeat(40));
    expect(JSON.parse(readFileSync(file,'utf8'))).toMatchObject({revision:'b'.repeat(40),total:null,counts:null,spans:null,measurementError:'Incomplete verified products'});
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('invalid suffix identities and totals refuse before any publication',()=>{
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/ruler-span-refusal-'));
  try {
    const rows=rulerSpanReports('',{first:empty,last:empty},['first','last'],null),last=rows['last'];
    if(last===undefined)throw new Error('Missing fixture suffix');
    expect(()=>writeRulerSpans(root,{...rows,last:{...last,shard:'../escape'}},revision)).toThrow();
    expect(()=>writeRulerSpans(root,{...rows,last:{...last,total:1}},revision)).toThrow('incomplete span totals');
    expect(existsSync(resolve(root,'spans-first.json'))).toBe(false);
  }finally{rmSync(root,{recursive:true,force:true});}
});
