import { expect, test } from 'vitest';
import { prepareHeadlessAssembly } from '../src/sdk/headlessAssembly';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the original native assembly over real physics.
import { readFileSync } from 'node:fs';
import assembly from '../src/shards/nalati-grasslands/data/headlessAssembly.json' with {type:'json'};
import * as v from 'valibot';
import { ForagerPopulation } from '../src/engine/ai/ambientForager';
import { ForagerPopulationSchema } from '../src/format/ambientLife';
import { createNativeBakeReader } from '../src/game/population/nativeBake';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import policy from '../src/shards/nalati-grasslands/creatures/marmotForager.json' with {type:'json'};

const rows={label:'Orchard',resolution:2,size:32,parked:false,rig:'segments',provenance:'piece',shapes:[1,2,6,9],metadata:'population' as const};
function input(){
  const body=SIM_LEVEL.entities[0];if(body===undefined)throw new Error('Missing fixture recipe');
  const heights=btoa(String.fromCodePoint(...new Uint8Array(new Float32Array([0,1,2,3]).buffer)));
  const foragers=new ForagerPopulation(v.parse(ForagerPopulationSchema,{...policy,id:'orchard-sentries'}),73);
  return {version:1,ground:{rows:1,cols:1,heights,friction:.9,groups:1,scale:{x:32,y:1,z:32},at:{x:0,y:0,z:0}},solids:[],
    actors:[{id:body.id,kind:body.spec.kind,variant:body.spec.variant,herd:0,spec:body.spec,seed:body.seed,scale:body.scale,scripted:false}],
    herds:[{kind:'herd',members:[body.id]}],trees:[[2,3,.5]],tops:[6],yurts:[[4,5,6]],grass:[[4,5,.2]],
    spawns:[{id:body.id,at:[0,0,1],yaw:0,mem:{hit:null,age:1}}],groups:[{kind:'herd',members:[body.id],state:'graze'}],
    flocks:[{n:1,cx:2,cz:3,members:[{at:[2,0,3],yaw:0}]}],ledges:[],marmots:foragers.snapshot()};
}

test('orchard bake admission joins native identities and owns decoded terrain buffers',()=>{
  const source=input(),reader=createNativeBakeReader(source,rows),bake=reader.read(),other=createNativeBakeReader(source,rows).read();
  expect(reader.read()).toBe(bake);
  expect(source.spawns[0]?.mem.hit).toBeNull();expect(bake.ground.heights).toEqual(new Float32Array([0,1,2,3]));
  bake.ground.heights[0]=9;expect(other.ground.heights[0]).toBe(0);
  expect(bake.actors.map(row=>row.id)).toEqual(source.actors.map(row=>row.id));expect(bake.marmots).toEqual(source.marmots);
  expect(bake.trees).toEqual(source.trees);expect(bake.tops).toEqual(source.tops);expect(bake.ledges).toEqual(source.ledges);expect(bake.herds).toEqual(source.herds);
});

test('population intake refuses broken native rosters, canopy counts and executable metadata',()=>{
  const source=input();
  expect(()=>createNativeBakeReader({...source,actors:[...source.actors,...source.actors]},rows).read()).toThrow('one id per body');
  expect(()=>createNativeBakeReader({...source,herds:[{kind:'herd',members:['missing']}]},rows).read()).toThrow('one id per body');
  expect(()=>createNativeBakeReader({...source,tops:[]},rows).read()).toThrow('trees and tops');
  expect(()=>createNativeBakeReader(source,{...rows,check:()=>true})).toThrow();
  expect(()=>createNativeBakeReader(source,{...rows,metadata:'callback'})).toThrow();
  expect(()=>createNativeBakeReader({...source,trees:[[2,3,()=>3]]},rows).read()).toThrow();
});


test('the actual population assembly reads the stock profile at its original prepare slot across restore', async () => {
  type Bake = ReturnType<ReturnType<typeof createNativeBakeReader>['read']>;
  const captured: Bake[] = [], capture = (bake: Bake): void => { captured.push(bake); };
  const declaration = { ...assembly, modules: {
    '@wildshard/game/population/nativeBake': ['createNativeBakeReader'],
    'src/shards/nalati-grasslands/data/physics.generated.json': ['default'],
    'src/game/populationFixture': ['capture'],
  }, constants: { nativeBake: rows }, prepare: assembly.prepare.filter(row => row.name === 'bakeReader' || row.name === 'bake'),
  install: [{ name: 'capture', value: { $call: [{ $ref: ['src/game/populationFixture', 'capture'] }, { $ref: ['bake'] }] } }],
  level: { speed: 5, lift: .1, ground: { size: 32, height: 0 } }, ports: { ground: false, heightAt: { $fn: 0 } },
  entries: { $fn: { lanes: 0, steps: 0 } } };
  expect(declaration.prepare.map(row => row.name)).toEqual(['bakeReader', 'bake']);
  const bytes = new TextEncoder().encode(JSON.stringify(declaration));
  const shard = emptyShardfile({ slug: 'population-fixture', name: 'Population fixture', author: 'Test', revision: 1, seed: 73 });
  const product = createShardProduct({ slug: shard.identity.slug, revision: 1, shardfile: shard, sections: new Map(),
    files: new Map([['sim/headless-assembly.json', { hash: 'assembly', url: 'assembly' }]]), read: () => Promise.resolve(bytes) });
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const source = input(), modules = { '@wildshard/game/population/nativeBake': { createNativeBakeReader },
    'src/shards/nalati-grasslands/data/physics.generated.json': { default: source }, 'src/game/populationFixture': { capture } };
  const first = await prepareHeadlessAssembly({ shard, product, assets: new Map(), rapier }, modules);
  const independent = await prepareHeadlessAssembly({ shard, product, assets: new Map(), rapier }, modules);
  const host = createSimHost(first.level, { ...first.ports, rapier });
  try {
    for (const restoring of [false, true]) first.install(host, { restoring, commands: () => [], emit: () => undefined });
    independent.install(host, { restoring: false, commands: () => [], emit: () => undefined });
  } finally { host.dispose(); }
  const [initial, restored, other] = captured;
  if (initial === undefined || other === undefined) throw new Error('Missing admitted population bake');
  expect(restored).toBe(initial);
  expect(initial.ground.heights).toEqual(new Float32Array([0, 1, 2, 3]));
  expect(other.ground.heights.buffer).not.toBe(initial.ground.heights.buffer);
  expect(initial.actors).toEqual(source.actors); expect(initial.herds).toEqual(source.herds);
});
