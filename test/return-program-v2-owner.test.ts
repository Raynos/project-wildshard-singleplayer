import { expect,test,vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import { ReturnProgram,ProjectedState } from '../src/game/population/returnProgram';
import { ReturnProgramSchema } from '../src/format/namedJsonContracts';
import { ArenaScriptFightFileSchema } from '../src/format/arenaScriptRows';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { nameBlob } from '../src/sdk/blobs';
import { wireProgram } from '../src/shards/nalati-grasslands/generators/returnProgramRows';
import { hashImmutableBytes } from '../src/sdk/immutable';
import * as v from 'valibot';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};

const spear={phase:0,mode:3,dt:2,t:0,cd:0,x:0,z:0,px:1,pz:1,chain:0,aim:1,lock:.2,stuck:.5};

test('selected attack/rules share the original module owner and instantiate only v2',()=>{
  const owner=new Scope('fixture.titan-v2'),other=new Scope('fixture.titan-v2-other');
  const original=WebAssembly.Instance;let instances=0;
  const spy=vi.spyOn(WebAssembly,'Instance').mockImplementation(class extends original{
    constructor(module:WebAssembly.Module,imports?:WebAssembly.Imports){super(module,imports);instances++;}
  });
  try{
    const first=ReturnProgram.page(programs.attack,owner);
    expect(ReturnProgram.page(structuredClone(programs.rules),owner)).toBe(first);expect(instances).toBe(1);
    expect(first.prepare).toBeTypeOf('function');
    expect(ReturnProgram.page(programs.attack,other)).not.toBe(first);expect(instances).toBe(2);
    const legacy=ReturnProgram.page({script:programs.attack.script,bytes:programs.attack.bytes},owner);
    expect(legacy).not.toBe(first);expect(legacy.prepare).toBeUndefined();expect(instances).toBe(3);
    expect(first.project('bossClamp',{fullHp:100,share:.3})).toStrictEqual(legacy.project('bossClamp',{fullHp:100,share:.3}));
  }finally{spy.mockRestore();owner.dispose();other.dispose();}
});

test('descriptor mutation, malformed selections and accessor rows cannot alter a cached module',()=>{
  const owner=new Scope('fixture.titan-v2-descriptor'),row=structuredClone(programs.attack);
  try{
    const first=ReturnProgram.page(row,owner);
    row.v2.fields[0]='changed';
    expect(first.project('bossClamp',{fullHp:100,share:.3})).toStrictEqual({hp:30});
    expect(()=>ReturnProgram.page(row,owner)).toThrow('Invalid projection declaration');
    expect(()=>ReturnProgram.page({...programs.attack,v2:{...programs.attack.v2,unexpected:true}},owner)).toThrow();
    expect(()=>ReturnProgram.page({...programs.attack,v2:{...programs.attack.v2,artifact:{...programs.attack.v2.artifact,hash:'0'.repeat(64)}}},owner)).toThrow('hash mismatch');
    expect(()=>ReturnProgram.page({...programs.attack,v2:{...programs.attack.v2,bytes:'not wasm'}},owner)).toThrow();
    let reads=0;
    expect(()=>ReturnProgram.page({...programs.attack,get v2(){reads++;return programs.attack.v2;}},owner)).toThrow('JSON data');expect(reads).toBe(0);
    expect(ReturnProgram.page(structuredClone(programs.attack),owner)).toBe(first);
  }finally{owner.dispose();}
});

test('sliced ancestor retirement refuses capture and prepared acceptance before RNG publication',()=>{
  const parent=new Scope('fixture.titan-parent'),owner=parent.child('construction');
  const first=ReturnProgram.page(programs.attack,owner),random=new Rng(55),before=random.snapshot();
  const prepared=first.prepare?.('spear',spear,random);
  if(prepared===undefined)throw new Error('Missing selected projection');
  expect(random.snapshot()).toStrictEqual(before);
  const retirement=parent.disposeSteps();retirement.next();
  expect(owner.disposing||owner.disposed).toBe(true);
  expect(()=>prepared.accept()).toThrow('Return owner disposed');
  expect(()=>first.project('spear',spear,random)).toThrow('Return owner disposed');
  expect(()=>ReturnProgram.page(programs.attack,owner)).toThrow('Return owner disposed');
  expect(random.snapshot()).toStrictEqual(before);
  for(const step of retirement)void step;
});

test('an owner retiring during capture cannot publish retained state or RNG',()=>{
  const parent=new Scope('fixture.titan-capture'),owner=parent.child('construction');
  const program=ReturnProgram.page(programs.attack,owner),random=new Rng(56),before=random.snapshot();
  const state=new ProjectedState({initial:{cd:0},retain:{cd:'cd'},signal:'spear'},program);
  let retirement:ReturnType<Scope['disposeSteps']>|undefined;
  const snapshot=random.snapshot.bind(random);
  const spy=vi.spyOn(random,'snapshot').mockImplementation(()=>{
    retirement=parent.disposeSteps();retirement.next();return snapshot();
  });
  try{
    expect(()=>state.project(spear,random)).toThrow('Return owner disposed');
    expect(state.state).toStrictEqual({cd:0});expect(snapshot()).toStrictEqual(before);
  }finally{spy.mockRestore();if(retirement!==undefined)for(const step of retirement)void step;else parent.dispose();}
});

test('selected rows survive real named JSON admission while undeclared ABI1 rows remain unchanged',()=>{
  const row=v.parse(ReturnProgramSchema,wireProgram(programs.attack));
  expect(row.v2).toStrictEqual(programs.attack.v2);
  if(row.v2===undefined)throw new Error('Missing selected projection');
  const artifact=row.v2.artifact;
  const module=nameBlob('behaviour/titan-project.wasm','wasm',Uint8Array.from(atob(row.v2.bytes),byte=>byte.codePointAt(0)??0),
    {critical:true,script:{abi:2,lane:'project',pages:artifact.pages,ioBytes:artifact.ioBytes,compilerRevision:artifact.compilerRevision,admissionRevision:artifact.admissionRevision}});
  expect(module.file.hash).toBe(artifact.hash);expect(module.script?.abi).toBe(2);expect(module.file.decoded).toBe(module.bytes.length);
  const schema=namedJsonSchema(ReturnProgramSchema),encode=(value:unknown):Uint8Array=>new TextEncoder().encode(JSON.stringify(value));
  const blob=nameBlob('combat/projection.json','json',encode(row),{jsonSchema:schema});
  expect(validateNamedJsonSchema(schema,blob.bytes)).toStrictEqual(row);
  expect(()=>nameBlob('combat/projection.json','json',encode({...row,v2:{...row.v2,extra:1}}),{jsonSchema:schema})).toThrow('refuses its schema');
  expect(()=>nameBlob('combat/projection.json','json',encode({...row,v2:{...row.v2,artifact:{...programs.attack.v2.artifact,lane:'view'}}}),{jsonSchema:schema})).toThrow('refuses its schema');
  for(const legacy of [programs.fire,programs.wind]){
    expect(v.parse(ReturnProgramSchema,legacy)).toStrictEqual(legacy);
    expect(ReturnProgram.page(legacy).prepare).toBeUndefined();
    expect(hashImmutableBytes(new TextEncoder().encode(`${JSON.stringify(legacy,null,2)}\n`))).toBe('865255e00b841250d0a30cc3ed06474ce1c212bd306dfc9cf13f3e1714642d2a');
  }
  expect(namedJsonSchema(ArenaScriptFightFileSchema)).toHaveProperty('properties.programs.properties.attack.properties.v2');
});

test('native observation and ordered candidate snapshots preserve signed zero without invoking accessors',()=>{
  const legacy=ReturnProgram.page({script:programs.attack.script,bytes:programs.attack.bytes}),selected=ReturnProgram.page(programs.attack);
  const frame={...spear,mode:0,dt:0,cd:2,x:-0,z:-0};
  const direct=selected.project('spear',frame);
  expect(direct).toStrictEqual(legacy.project('spear',frame));expect(Object.is(direct['x'],-0)).toBe(true);expect(Object.is(direct['z'],-0)).toBe(true);
  const support={dt:0,px:0,pz:1,count:1,hp:100,cd:0,invuln:0,chip:1},candidates=[{hit:1,mode:0,x:-0,z:-0}];
  const a=new Rng(59),b=new Rng(59),answer=selected.project('couple',support,a,candidates);
  expect(answer).toStrictEqual(legacy.project('couple',support,b,candidates));expect(a.snapshot()).toStrictEqual(b.snapshot());
  expect(Object.is(answer['x0'],-0)).toBe(true);expect(Object.is(answer['z0'],-0)).toBe(true);
  let reads=0;const before=a.snapshot();
  expect(()=>selected.project('spear',{...frame,get x(){reads++;return -0;}},a)).toThrow('Invalid return observation frame');
  expect(reads).toBe(0);expect(a.snapshot()).toStrictEqual(before);
});
