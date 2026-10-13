// oxlint-disable-next-line import/no-nodejs-modules -- Isolated owned source fixtures.
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Place fixtures outside shared checkout.
import {tmpdir} from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture paths.
import {dirname,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {codeLines,type CustomSource} from '../scripts/shard-platform.mjs';
import {componentInventory,componentWave,componentMarkdown} from '../scripts/shard-components.mjs';

it('splits mixed composition by owner API, with each canonical TS line charged once',()=>{
  const root=mkdtempSync(resolve(tmpdir(),'wave-components-'));
  const file='src/shards/far-reach/runtime/headless.ts';
  const source=`// installation order remains untouched
import {installSpeciesHomes} from '@wildshard/game/plugin/brain';
import {installQuestGraph} from '@wildshard/game/plugin/quests';
import {installLashHost} from './items/lashHost';
export function install(host: Host) {
  const keeper = installSpeciesHomes(host, {
    species: ROWS,
  });
  installQuestGraph(host, QUEST);
  installLashHost(host, WEAPON);
  return host;
}
`;
  try{
    mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),source);
    const lines=codeLines(source,file), report=componentInventory(root,'far-reach',[{path:file,kind:'runtime-ts',lines}],lines);
    expect(report.total).toBe(11);
    expect(report.counts).toEqual({C1:0,C2:0,C3:0,C4:4,C5:2,C6:2,C7:0,C8:0,C9:3});
    expect(report.spans.flatMap(row=>row.start===undefined?[]:Array.from({length:row.lines},(_,i)=>(row.start??0)+i)).sort((a,b)=>a-b)).toEqual(Array.from({length:11},(_,i)=>i+2));
    expect(report.unknown).toEqual([]);
    expect(()=>componentInventory(root,'far-reach',[{path:file,kind:'runtime-ts',lines}],lines+1)).toThrow('differs from canonical');
  }finally{rmSync(root,{recursive:true,force:true});}
});
it('keeps extra GLSL and G294 sole declarations in their canonical units and owner roles',()=>{
  const sources:CustomSource[]=[
    {path:'src/shards/far-reach/data/paintLook.ts',kind:'additional-glsl',lines:17},
    {path:'src/shards/far-reach/data/windFx.ts',kind:'additional-glsl',lines:4},
    {path:'src/game/plugin/geometry.ts',kind:'sole-export',name:'installPivotNpc',lines:8},
    {path:'src/game/plugin/mover.ts',kind:'sole-export',name:'UpdraftDriver',lines:7},
  ];
  const report=componentInventory('/unused','far-reach',sources,36);
  expect(report.counts).toEqual({C1:0,C2:17,C3:4,C4:0,C5:8,C6:0,C7:7,C8:0,C9:0});
  expect(report.spans.every(row=>row.start===undefined)).toBe(true);
  expect(report.unknown).toEqual([]);
});
it('refuses closure credit for absent or unknown ownership and requires zero on both shards',()=>{
  const zero=componentInventory('/unused','far-reach',[],0);
  const one=componentInventory('/unused','sunscar-dunes',[{path:'src/shards/sunscar-dunes/data/lightLook.ts',kind:'additional-glsl',lines:1}],1);
  expect(componentWave({})).toMatchObject({closed:0,total:9});
  expect(componentWave({'far-reach':{components:zero},'sunscar-dunes':{components:zero}}).closed).toBe(9);
  expect(componentWave({'far-reach':{components:zero}}).closed).toBe(0);
  const wave=componentWave({'far-reach':{components:zero},'sunscar-dunes':{components:one}});
  expect(wave.closed).toBe(8);expect(wave.components.C2.closed).toBe(false);
  const unknown=componentInventory('/unused','far-reach',[{path:'src/sdk/newThing.ts',kind:'sole-export',name:'opaque',lines:1}],1);
  expect(unknown.unknown).toEqual(['src/sdk/newThing.ts#opaque']);
  expect(componentWave({'far-reach':{components:unknown},'sunscar-dunes':{components:zero}}).closed).toBe(0);
  expect(componentMarkdown({'far-reach':{components:zero},'sunscar-dunes':{components:one}}).join('\n')).toContain('Components closed 8 of 9');
});

it('treats constructor and prototype method names as ordinary owner spans',()=>{
  const root=mkdtempSync(resolve(tmpdir(),'wave-prototype-')), file='src/shards/far-reach/runtime/index.ts';
  try{
    mkdirSync(dirname(resolve(root,file)),{recursive:true});
    writeFileSync(resolve(root,file),'class Runtime {\n  constructor() {}\n  toString() { return "runtime"; }\n}');
    const row=componentInventory(root,'far-reach',[{path:file,kind:'runtime-ts',lines:4}],4);
    expect(row.counts.C9).toBe(4);expect(row.total).toBe(4);
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('keeps effect shader and primitive spans with the effect owner and registers weapon-family ownership',()=>{
  const root=mkdtempSync(resolve(tmpdir(),'wave-effects-')),file='src/shards/sunscar-dunes/runtime/looks/fireFx.ts';
  try{
    mkdirSync(dirname(resolve(root,file)),{recursive:true});
    writeFileSync(resolve(root,file),"import {Mesh,ShaderMaterial} from 'three';\nconst material = new ShaderMaterial();\nconst mesh = new Mesh(undefined, material);");
    const row=componentInventory(root,'sunscar-dunes',[{path:file,kind:'runtime-ts',lines:3},{path:'src/game/plugin/weaponFamily.ts',kind:'sole-export',name:'registerWeaponFamily',lines:2}],5);
    expect(row.counts.C3).toBe(3);expect(row.counts.C6).toBe(2);expect(row.unknown).toEqual([]);
  }finally{rmSync(root,{recursive:true,force:true});}
});

it('keeps typed arrays and subarray calls with their owner rather than treating Array as a ray',()=>{
  const root=mkdtempSync(resolve(tmpdir(),'wave-array-role-')),file='src/shards/far-reach/runtime/index.ts';
  const source='const bytes = new Uint8Array(8);\nconst positions = new Float32Array(8);\nconst slice = bytes.subarray(0, 4);\nconst copy = Array.from(positions);\nconst ray = body;';
  try{
    mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),source);
    const lines=codeLines(source,file), row=componentInventory(root,'far-reach',[{path:file,kind:'runtime-ts',lines}],lines);
    expect(row.counts.C4).toBe(1);expect(row.counts.C9).toBe(4);expect(row.total).toBe(5);
    expect(row.spans.filter(span=>span.component==='C4').map(span=>span.start)).toEqual([5]);
    expect(row.unknown).toEqual([]);
  }finally{rmSync(root,{recursive:true,force:true});}
});
