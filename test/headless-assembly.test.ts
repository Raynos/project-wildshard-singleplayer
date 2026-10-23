import {sha256} from '../src/game/plugin/moduleHash';
import {OUTPUT_SECTIONS,outputSectionPayloads,parseOutputIndex} from '../src/format/outputIndex';
import {parseShardfile} from '../src/format/shardSchema';
import {resolveOutputDescriptor,carryOutputDescriptor} from '../src/game/shardfile/outputDescriptor';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { parseReturnProjectionV2 } from '../src/format/returnProjectionV2';
import returnPrograms from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};
// oxlint-disable-next-line import/no-nodejs-modules -- The unit host uses the same native physics module as the resident.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { checkedHeadlessAssembly, prepareHeadlessAssembly } from '../src/sdk/headlessAssembly';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost, onSimHostRestored } from '../src/engine/sim/snapshot';
import { hasStaticGround } from '../src/engine/physics/query';
import { tagCollider } from '../src/engine/physics/surface';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { HEADLESS_ASSEMBLY_JSON_SCHEMA } from '../src/format/namedJsonContracts';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import driftwoodAssembly from '../src/shards/driftwood-isle/data/headlessAssembly.json' with { type: 'json' };

const ref = (...path: readonly (string | number)[]) => ({ $ref: path });
const base = { version: 1, modules: {}, constants: {}, prepare: [], install: [],
  level: { speed: 5, lift: .1, ground: { size: 500, height: 0 } },
  ports: { ground: false, heightAt: { $fn: 0 } }, entries: { $fn: { lanes: 2, steps: 3 } } };
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

test('retains static receivers, late owners, call order and independent restore bindings', async () => {
  const order: string[] = [], readers: (() => number)[] = [], sources: object[] = [];
  class Owner {
    readonly lanes = 2;
    static identity = 'first';
    static create(read: () => number, source: object): void { order.push(this.identity); readers.push(read); sources.push(source); }
  }
  const module = { Owner, later: (): { value: number } => { order.push('later'); return { value: readers.length }; } };
  const declaration = { ...base, modules: { 'src/game/assemblyFixture': ['Owner', 'later'] },
    prepare: [{ name: 'constructed', value: { $new: [ref('src/game/assemblyFixture', 'Owner')] } }],
    entries: { $fn: { lanes: ref('constructed', 'lanes'), steps: 3 } }, install: [
    { name: 'first', value: { $call: [ref('src/game/assemblyFixture', 'Owner', 'create'), { $fn: ref('later', 'value') }, ref('shard')] } },
    { name: 'later', value: { $call: [ref('src/game/assemblyFixture', 'later')] } },
  ] };
  const shard = emptyShardfile({ slug: 'assembly', name: 'Assembly', author: 'Test', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: 'assembly', revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]),
    read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration))) });
  const plan = await prepareHeadlessAssembly({ shard: structuredClone(shard), product, assets: new Map(), rapier }, { 'src/game/assemblyFixture': module });
  const first = createSimHost(plan.level, { ...plan.ports, rapier }), restored = createSimHost(plan.level, { ...plan.ports, rapier });
  try {
    plan.install(first, { restoring: false, commands: () => [], emit: () => undefined });
    plan.install(restored, { restoring: true, commands: () => [], emit: () => undefined });
    expect(order).toEqual(['first', 'later', 'first', 'later']);
    expect(readers.map(read => read())).toEqual([1, 2]);
    for (const source of sources) expect(source).toBe(shard);
    expect(plan.proveEntries?.(first)).toEqual({ lanes: 2, steps: 3 });
  } finally { first.dispose(); restored.dispose(); }
});

test('refuses undeclared code, prototype traversal and binding collisions before installation', () => {
  const modules = { 'src/game/assemblyFixture': { install: (): void => undefined } };
  const declaration = { ...base, modules: { 'src/game/assemblyFixture': ['install'] } };
  expect(() => checkedHeadlessAssembly(declaration, modules)).not.toThrow();
  expect(() => checkedHeadlessAssembly({ ...declaration, modules: { 'https://example.com/code': [] } }, modules)).toThrow();
  expect(() => checkedHeadlessAssembly({ ...declaration, modules: { 'src/game/assemblyFixture': ['missing'] } }, modules)).toThrow();
  for (const path of [['src/game/assemblyFixture', 'missing'], ['host', '__proto__'], ['host', 'constructor', 'constructor']])
    expect(() => checkedHeadlessAssembly({ ...declaration, entries: ref(...path) }, modules)).toThrow();
  expect(() => checkedHeadlessAssembly({ ...declaration, install: [{ name: 'host', value: null }] }, modules)).toThrow('conflicts');
  expect(() => checkedHeadlessAssembly({ ...declaration, entries: { $eval: 'source' } }, modules)).toThrow();
});

test('admits only one top-level native installation, never constants or nested expressions', () => {
  const native = { $native: 'native.body-scripts' };
  const install = [{ name: 'bodies', value: native }];
  expect(() => checkedHeadlessAssembly({ ...base, install }, {})).not.toThrow();
  expect(() => checkedHeadlessAssembly({ ...base, constants: { literal: { $ref: ['not-an-expression'] } } }, {})).not.toThrow();
  for (const declaration of [
    { ...base, constants: { nested: [native] } },
    { ...base, prepare: install },
    { ...base, install: [{ name: 'bodies', value: { nested: native } }] },
    { ...base, install: [{ name: 'bodies', value: { $fn: native } }] },
    { ...base, install: [{ name: 'bodies', value: { $native: 'native.unknown' } }] },
    { ...base, install: [...install, { name: 'second', value: native }] },
  ]) expect(() => checkedHeadlessAssembly(declaration, {})).toThrow();
});

test('the shipped assembly passes its wire fence without admitting native expressions elsewhere', () => {
  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  expect(validateNamedJsonSchema(HEADLESS_ASSEMBLY_JSON_SCHEMA, encode(driftwoodAssembly))).toEqual(driftwoodAssembly);
  expect(driftwoodAssembly.install.find(row => row.name === 'bodyScripts')?.value).toEqual({ $native: 'native.body-scripts' });
  const native = { $native: 'native.body-scripts' }, install = [{ name: 'bodyScripts', value: native }];
  for (const declaration of [
    { ...base, constants: { hidden: native } }, { ...base, prepare: install },
    { ...base, install: [{ name: 'bodyScripts', value: { nested: native } }] },
    { ...base, install: [{ name: 'bodyScripts', value: { $native: 'native.unknown' } }] },
    { ...base, install: [{ name: 'bodyScripts', value: { ...native, ports: {} } }] },
  ]) expect(() => validateNamedJsonSchema(HEADLESS_ASSEMBLY_JSON_SCHEMA, encode(declaration))).toThrow();
});

test('refuses native body scripts before real ground admission or after its host ends', async () => {
  const shard = emptyShardfile({ slug: 'native-ground', name: 'Native Ground', author: 'Test', revision: 1, seed: 1 });
  const declaration = { ...base, install: [{ name: 'bodies', value: { $native: 'native.body-scripts' } }] };
  const product = createShardProduct({ slug: 'native-ground', revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]),
    read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration))) });
  const plan = await prepareHeadlessAssembly({ shard, product, assets: new Map(), rapier }, {});
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

test('native restore checks the restored ground before releasing the host', async () => {
  const shard = emptyShardfile({ slug: 'native-restore-ground', name: 'Restore Ground', author: 'Test', revision: 1, seed: 1 });
  const declaration = { ...base, install: [{ name: 'bodies', value: { $native: 'native.body-scripts' } }] };
  const product = createShardProduct({ slug: shard.identity.slug, revision: 1, shardfile: shard,
    sections: new Map<string, unknown>([['sim/scripts', []], ['sim/bodies', {}]]),
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]),
    read: () => Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration))) });
  const plan = await prepareHeadlessAssembly({ shard, product, assets: new Map(), rapier }, {});
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

test('raw return modules are lent before original native assembly owners on fresh and restored hosts',async()=>{
  const program=structuredClone(returnPrograms.attack),projection=parseReturnProjectionV2(program.v2),artifact=projection.artifact;
  const bytes=Uint8Array.from(atob(program.v2.bytes),value=>value.codePointAt(0)??0);program.v2.bytes='';
  const assets=new Map<string,Uint8Array>(),captured:ReturnProgram[]=[];
  let moduleReads=0;
  const returns=[{id:'fixture.return',module:`blobs/wasm/${artifact.hash}.wasm`,side:'sim' as const,abi:2 as const,lane:'project' as const,
    pages:artifact.pages,ioBytes:artifact.ioBytes,compilerRevision:artifact.compilerRevision,admissionRevision:artifact.admissionRevision}];
  const install=(host:SimHost):void=>{
    const original=ReturnProgram.native(host,program);captured.push(original);
    expect(ReturnProgram.native(host,program)).toBe(original);
    expect(original.project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
  };
  const declaration={...base,modules:{'src/game/rawAssemblyFixture':['install']},install:[{name:'original',value:{$call:[ref('src/game/rawAssemblyFixture','install'),ref('host')]}}]};
  const shard=emptyShardfile({slug:'raw-assembly',name:'Raw assembly',author:'Test',revision:1,seed:17});
  const file={hash:artifact.hash,kind:'wasm' as const,compressed:bytes.length,decoded:bytes.length,gpu:0,triangles:0,draws:0,dependencies:[],critical:false};
  shard.files.push(file);shard.library.push(artifact.hash);
  shard.budgets.library={resident:bytes.length,compressed:bytes.length};
  const wires=new Map<string,Uint8Array>();
  const sections=[...outputSectionPayloads(shard)].map(([name,payload])=>{
    const mapping=OUTPUT_SECTIONS.find(row=>row.name===name);if(mapping===undefined)throw new Error('Missing fixture section');
    const wire=new TextEncoder().encode(JSON.stringify(payload)),path=`sections/${name}.json`;wires.set(path,wire);
    return {name,path,schema:`wildshard:${name}@1`,hash:sha256(wire),bytes:wire.length};
  });
  const index=parseOutputIndex({format:'wildshard.shardfile',formatVersion:2,sdk:'0.2',version:shard.version,identity:shard.identity,
    build:{sourceHash:sha256(new TextEncoder().encode(JSON.stringify(shard))),validator:'fixture'},requires:shard.requires,
    admission:{budgets:shard.budgets,serverBudget:shard.serverBudget,authorCaps:shard.authorCaps,critical:shard.critical,library:shard.library},
    sections,schemas:[],files:[{...file,path:`blobs/wasm/${artifact.hash}.wasm`,name:'behaviour/fixture.wasm'}],runtime:null});
  const assembled=await resolveOutputDescriptor(index,{offline:false,hash:wire=>Promise.resolve(sha256(wire)),read:path=>{
    const wire=wires.get(path);if(wire===undefined)throw new Error('Missing fixture wire');return Promise.resolve(wire);
  }});
  const admitted=parseShardfile(assembled);carryOutputDescriptor(assembled,admitted);
  const product=createShardProduct({slug:shard.identity.slug,revision:1,shardfile:admitted,sections:new Map([['actors/return-scripts',returns]]),
    files:new Map([['sim/headless-assembly.json',{hash:'assembly',url:'assembly'}],['behaviour/fixture.wasm',{hash:artifact.hash,url:'module'}]]),read:hash=>{
      if(hash===artifact.hash){moduleReads++;return Promise.resolve(bytes);}
      return Promise.resolve(new TextEncoder().encode(JSON.stringify(declaration)));
    }});
  const plan=await prepareHeadlessAssembly({shard,product,assets,rapier},{'src/game/rawAssemblyFixture':{install}});
  expect(assets.get(artifact.hash)).toBe(bytes);expect(moduleReads).toBe(1);
  const fresh=createSimHost(plan.level,{...plan.ports,rapier});
  let restored:SimHost|undefined;
  try{
    plan.install(fresh,{restoring:false,commands:()=>[],emit:()=>undefined});
    restored=restoreSimHost(plan.level,{...plan.ports,rapier},snapshotSimHost(fresh),host=>{
      plan.install(host,{restoring:true,commands:()=>[],emit:()=>undefined});
    });
    expect(captured).toHaveLength(2);expect(captured[0]).not.toBe(captured[1]);
    assets.set(artifact.hash,new Uint8Array([0]));
    const corrupt=await prepareHeadlessAssembly({shard,product,assets,rapier},{'src/game/rawAssemblyFixture':{install}});
    expect(moduleReads).toBe(1);
    expect(()=>corrupt.install(fresh,{restoring:false,commands:()=>[],emit:()=>undefined})).toThrow('hash mismatch');
    expect(()=>ReturnProgram.native(fresh,program)).toThrow('hash mismatch');
    assets.set(artifact.hash,bytes);
    const original=captured[0];if(original===undefined)throw new Error('Missing original projection');
    fresh.dispose();
    expect(()=>original.project('bossClamp',{fullHp:100,share:.3})).toThrow('Return owner disposed');
    expect(captured[1]?.project('bossClamp',{fullHp:100,share:.3})).toEqual({hp:30});
  }finally{fresh.dispose();restored?.dispose();}
});
