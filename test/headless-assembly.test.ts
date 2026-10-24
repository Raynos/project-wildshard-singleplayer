import {sha256} from '../src/game/plugin/moduleHash';
import {OUTPUT_SECTIONS,outputSectionPayloads,parseOutputIndex} from '../src/format/outputIndex';
import {parseShardfile} from '../src/format/shardSchema';
import {resolveOutputDescriptor,carryOutputDescriptor} from '../src/game/shardfile/outputDescriptor';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { parseReturnProjectionV2 } from '../src/format/returnProjectionV2';
import {titanPrograms as returnPrograms} from './fixtures/titanInlineWitness';
// oxlint-disable-next-line import/no-nodejs-modules -- The unit host uses the same native physics module as the resident.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { trustedLevel } from '../src/game/plugin/simulation';
import type { HeadlessRuntimePlan } from '../src/sdk/headlessRuntime';
import { installBodyScripts, prepareReturns } from './fixtures/headless-plan';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost, onSimHostRestored } from '../src/engine/sim/snapshot';
import { hasStaticGround } from '../src/engine/physics/query';
import { tagCollider } from '../src/engine/physics/surface';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { HEADLESS_ASSEMBLY_JSON_SCHEMA } from '../src/format/namedJsonContracts';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import driftwoodAssembly from '../src/shards/driftwood-isle/data/headlessAssembly.json' with { type: 'json' };

const base = { version: 1, modules: {}, constants: {}, prepare: [], install: [],
  level: { speed: 5, lift: .1, ground: { size: 500, height: 0 } },
  ports: { ground: false, heightAt: { $fn: 0 } }, entries: { $fn: { lanes: 2, steps: 3 } } };
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

test('the shipped assembly passes its wire fence without admitting native expressions elsewhere', () => {
  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  expect(validateNamedJsonSchema(HEADLESS_ASSEMBLY_JSON_SCHEMA, encode(driftwoodAssembly))).toEqual(driftwoodAssembly);
  expect(driftwoodAssembly.modules).toEqual({});
  expect(driftwoodAssembly.prepare).toEqual([]);
  expect(driftwoodAssembly.install).toEqual([]);
  const native = { $native: 'native.body-scripts' }, install = [{ name: 'bodyScripts', value: native }];
  for (const declaration of [
    { ...base, constants: { hidden: native } }, { ...base, prepare: install },
    { ...base, install: [{ name: 'bodyScripts', value: { nested: native } }] },
    { ...base, install: [{ name: 'bodyScripts', value: { $native: 'native.unknown' } }] },
    { ...base, install: [{ name: 'bodyScripts', value: { ...native, ports: {} } }] },
  ]) expect(() => validateNamedJsonSchema(HEADLESS_ASSEMBLY_JSON_SCHEMA, encode(declaration))).toThrow();
});

/** Typed fixture composition retains native contracts independently of the retiring DSL. */
function directPlan(shard: ReturnType<typeof emptyShardfile>, install: HeadlessRuntimePlan['install']): HeadlessRuntimePlan {
  return { level: trustedLevel(shard, {at:{x:shard.spawn.x,y:Math.max(shard.spawn.y,.1),z:shard.spawn.z},yaw:shard.spawn.yaw,speed:5}, {size:500,height:0}),
    ports:{ground:false,heightAt:()=>0},install };
}

test('refuses native body scripts before real ground admission or after its host ends', () => {
  const shard = emptyShardfile({ slug: 'native-ground', name: 'Native Ground', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: 'native-ground', revision: 1, shardfile: shard, sections: new Map(),
    files: new Map(),
    read: () => Promise.reject(new Error('Direct body proof reads sections only')) });
  const plan = directPlan(shard, (host, context) => installBodyScripts(host, context, {shard,product,assets:new Map(),rapier}));
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  const context = { restoring: false, commands: () => [], emit: () => undefined };
  try {
    const before = snapshotSimHost(host);
    expect(() => plan.install(host, context)).toThrow('require admitted ground');
    expect(snapshotSimHost(host)).toEqual(before);
    // A disabled floor, a sensor and a dynamic ground-tagged body do not
    // establish the static collision admission this capability requires.
    const physics = host.physics;
    const moving = physics.world.createRigidBody(physics.R.RigidBodyDesc.dynamic());
    const falseGround = [
      physics.world.createCollider(physics.R.ColliderDesc.cuboid(1, 1, 1).setEnabled(false)),
      physics.world.createCollider(physics.R.ColliderDesc.cuboid(1, 1, 1).setSensor(true)),
      physics.world.createCollider(physics.R.ColliderDesc.cuboid(1, 1, 1), moving),
    ];
    for (const collider of falseGround) tagCollider(collider, 'ground');
    const unready = snapshotSimHost(host);
    expect(() => plan.install(host, context)).toThrow('require admitted ground');
    expect(snapshotSimHost(host)).toEqual(unready);
  } finally { host.dispose(); }
  expect(() => plan.install(host, context)).toThrow('owner has ended');
});

test('native restore checks the restored ground before releasing the host', () => {
  const shard = emptyShardfile({ slug: 'native-restore-ground', name: 'Restore Ground', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: shard.identity.slug, revision: 1, shardfile: shard,
    sections: new Map<string, unknown>([['sim/scripts', []], ['sim/bodies', {}]]),
    files: new Map(),
    read: () => Promise.reject(new Error('Direct body proof reads sections only')) });
  const plan = directPlan(shard, (host, context) => installBodyScripts(host, context, {shard,product,assets:new Map(),rapier}));
  const source = createSimHost(plan.level, { rapier }), empty = createSimHost(plan.level, { ...plan.ports, rapier });
  const ports = { ...plan.ports, rapier };
  const context = { restoring: true, commands: () => [], emit: () => undefined };
  try {
    const saved = snapshotSimHost(source);
    const restored = restoreSimHost(plan.level, ports, saved, host => {
      expect(hasStaticGround(host.physics)).toBe(false);
      plan.install(host, context);
    });
    try {
      expect(hasStaticGround(restored.physics)).toBe(true);
      expect(snapshotSimHost(restored)).toEqual(saved);
      expect(() => onSimHostRestored(restored, () => undefined)).toThrow('not restoring');
    } finally { restored.dispose(); }
    expect(() => restoreSimHost(plan.level, ports, snapshotSimHost(empty), host => { plan.install(host, context); })).toThrow('require admitted ground');
    expect(() => plan.install(empty, context)).toThrow('not restoring');
  } finally { source.dispose(); empty.dispose(); }
});

test('ABI1-only raw returns borrow the original asset map on fresh and restored assembly hosts',async()=>{
  const program={script:structuredClone(returnPrograms.attack.script),bytes:''};
  const bytes=Uint8Array.from(atob(returnPrograms.attack.bytes),value=>value.codePointAt(0)??0),hash=sha256(bytes);
  const assets=new Map([[hash,bytes]]),captured:ReturnProgram[]=[];
  const returns=[program.script];
  const install=(host:SimHost):void=>{
    const original=ReturnProgram.native(host,program);captured.push(original);
    expect(ReturnProgram.native(host,program)).toBe(original);
    expect(original.project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
  };
  const shard=emptyShardfile({slug:'abi1-assembly',name:'ABI1 assembly',author:'Test',revision:1,seed:17});
  const product=createShardProduct({slug:shard.identity.slug,revision:1,shardfile:shard,sections:new Map([['actors/return-scripts',returns]]),
    files:new Map(),
    read:()=>Promise.reject(new Error('Direct ABI1 proof borrows its admitted asset map'))});
  const lend=await prepareReturns({shard,product,assets,rapier});
  const plan=directPlan(shard,host=>{lend(host);install(host);});
  const fresh=createSimHost(plan.level,{...plan.ports,rapier}),foreign=createSimHost(plan.level,{...plan.ports,rapier});
  let restored:SimHost|undefined;
  try{
    plan.install(fresh,{restoring:false,commands:()=>[],emit:()=>undefined});
    restored=restoreSimHost(plan.level,{...plan.ports,rapier},snapshotSimHost(fresh),host=>{
      plan.install(host,{restoring:true,commands:()=>[],emit:()=>undefined});
    });
    expect(captured).toHaveLength(2);expect(captured[0]).not.toBe(captured[1]);
    expect(assets.get(hash)).toBe(bytes);
    expect(()=>ReturnProgram.native(foreign,program)).toThrow('Missing admitted raw return module loan');
    assets.set(hash,new Uint8Array([0]));
    expect(()=>ReturnProgram.native(fresh,program)).toThrow('hash mismatch');
    assets.set(hash,bytes);
    const original=captured[0];if(original===undefined)throw new Error('Missing original projection');
    fresh.dispose();
    expect(()=>original.project('bossClamp',{fullHp:100,share:.3})).toThrow('Return owner disposed');
    expect(captured[1]?.project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
  }finally{fresh.dispose();foreign.dispose();restored?.dispose();}
});

test('raw return modules are lent before original native assembly owners on fresh and restored hosts',async()=>{
  const program=structuredClone(returnPrograms.attack),projection=parseReturnProjectionV2(program.v2),artifact=projection.artifact;
  const bytes=Uint8Array.from(atob(program.v2.bytes),value=>value.codePointAt(0)??0);program.v2.bytes='';
  const witness=Uint8Array.from(atob(program.bytes),value=>value.codePointAt(0)??0),witnessHash=sha256(witness);program.bytes='';
  const assets=new Map<string,Uint8Array>(),captured:ReturnProgram[]=[];
  let moduleReads=0,witnessReads=0;
  const returns=[{id:'fixture.return',module:`blobs/wasm/${artifact.hash}.wasm`,side:'sim' as const,abi:2 as const,lane:'project' as const,
    pages:artifact.pages,ioBytes:artifact.ioBytes,compilerRevision:artifact.compilerRevision,admissionRevision:artifact.admissionRevision}];
  const install=(host:SimHost):void=>{
    const original=ReturnProgram.native(host,program);captured.push(original);
    expect(ReturnProgram.native(host,program)).toBe(original);
    expect(original.project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
  };
  const shard=emptyShardfile({slug:'raw-assembly',name:'Raw assembly',author:'Test',revision:1,seed:17});
  const file={hash:artifact.hash,kind:'wasm' as const,compressed:bytes.length,decoded:bytes.length,gpu:0,triangles:0,draws:0,dependencies:[witnessHash],critical:false};
  const witnessFile={...file,kind:'bin' as const,hash:witnessHash,compressed:witness.length,decoded:witness.length,dependencies:[]};
  shard.files.push(file,{...witnessFile,kind:'binary'});shard.library.push(artifact.hash);
  shard.budgets.library={resident:bytes.length+witness.length,compressed:bytes.length+witness.length};
  const wires=new Map<string,Uint8Array>();
  const sections=[...outputSectionPayloads(shard)].map(([name,payload])=>{
    const mapping=OUTPUT_SECTIONS.find(row=>row.name===name);if(mapping===undefined)throw new Error('Missing fixture section');
    const wire=new TextEncoder().encode(JSON.stringify(payload)),path=`sections/${name}.json`;wires.set(path,wire);
    return {name,path,schema:`wildshard:${name}@1`,hash:sha256(wire),bytes:wire.length};
  });
  const index=parseOutputIndex({format:'wildshard.shardfile',formatVersion:2,sdk:'0.2',version:shard.version,identity:shard.identity,
    build:{sourceHash:sha256(new TextEncoder().encode(JSON.stringify(shard))),validator:'fixture'},requires:shard.requires,
    admission:{budgets:shard.budgets,serverBudget:shard.serverBudget,authorCaps:shard.authorCaps,critical:shard.critical,library:shard.library},
    sections,schemas:[],files:[{...file,path:`blobs/wasm/${artifact.hash}.wasm`,name:'behaviour/fixture.wasm'},{...witnessFile,path:`blobs/bin/${witnessHash}.bin`,name:'behaviour/fixture-witness.bin'}],runtime:null});
  const assembled=await resolveOutputDescriptor(index,{offline:false,hash:wire=>Promise.resolve(sha256(wire)),read:path=>{
    const wire=wires.get(path);if(wire===undefined)throw new Error('Missing fixture wire');return Promise.resolve(wire);
  }});
  const admitted=parseShardfile(assembled);carryOutputDescriptor(assembled,admitted);
  const product=createShardProduct({slug:shard.identity.slug,revision:1,shardfile:admitted,sections:new Map([['actors/return-scripts',returns]]),
    files:new Map([['behaviour/fixture.wasm',{hash:artifact.hash,url:'module'}],['behaviour/fixture-witness.bin',{hash:witnessHash,url:'witness'}]]),read:hash=>{
      if(hash===artifact.hash){moduleReads++;return Promise.resolve(bytes);}
      if(hash===witnessHash){witnessReads++;return Promise.resolve(witness);}
      return Promise.reject(new Error('Unexpected direct native file read'));
    }});
  const lend=await prepareReturns({shard,product,assets,rapier});
  const plan=directPlan(shard,host=>{lend(host);install(host);});
  expect(assets.get(artifact.hash)).toBe(bytes);expect(moduleReads).toBe(1);
  expect(assets.get(witnessHash)).toBe(witness);expect(witnessReads).toBe(1);
  const fresh=createSimHost(plan.level,{...plan.ports,rapier});
  let restored:SimHost|undefined;
  try{
    plan.install(fresh,{restoring:false,commands:()=>[],emit:()=>undefined});
    restored=restoreSimHost(plan.level,{...plan.ports,rapier},snapshotSimHost(fresh),host=>{
      plan.install(host,{restoring:true,commands:()=>[],emit:()=>undefined});
    });
    expect(captured).toHaveLength(2);expect(captured[0]).not.toBe(captured[1]);
    assets.set(artifact.hash,new Uint8Array([0]));
    const corruptLend=await prepareReturns({shard,product,assets,rapier});
    const corrupt=directPlan(shard,host=>{corruptLend(host);install(host);});
    expect(moduleReads).toBe(1);
    expect(()=>corrupt.install(fresh,{restoring:false,commands:()=>[],emit:()=>undefined})).toThrow('hash mismatch');
    expect(()=>ReturnProgram.native(fresh,program)).toThrow('hash mismatch');
    assets.set(artifact.hash,bytes);
    assets.set(witnessHash,new Uint8Array([0]));
    expect(()=>ReturnProgram.native(fresh,program)).toThrow('hash mismatch');
    assets.set(witnessHash,witness);
    const original=captured[0];if(original===undefined)throw new Error('Missing original projection');
    fresh.dispose();
    expect(()=>original.project('bossClamp',{fullHp:100,share:.3})).toThrow('Return owner disposed');
    expect(captured[1]?.project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
  }finally{fresh.dispose();restored?.dispose();}
});
