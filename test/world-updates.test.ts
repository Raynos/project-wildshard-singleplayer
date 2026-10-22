import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { MeshBasicMaterial, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import type { SystemSpec } from '../src/engine/app/systems';
import { ToonLook } from '../src/engine/render/families/toon';
import { updateWind, windUniforms } from '../src/engine/world/wind';
import type { RopeChain } from '../src/engine/physics/ropeChain';
import type { RopeDeckSite } from '../src/game/models/ropeDeckSite';
import type { ShardContext } from '../src/game/plugin/context';
import { installWorldUpdates } from '../src/game/shardfile/worldUpdates';
import { CLIENT_FEATURES } from '../src/game/shardfile/clientPlan';
import { parseClientPlan } from '../src/format/clientPlan';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';
import { WorldUpdatesSchema, type WorldUpdatesRows } from '../src/format/worldUpdates';
import { bindResidentWorldScope } from '../src/game/shardfile/hybridPresentation';
import { publishEntryOwner, lendEntryOwner } from '../src/game/shardfile/entryOwners';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { toonLighting } from '../src/game/looks/toonLighting';
import { followToonLook } from '../src/game/looks/toonLook';
import { LivingBuildings } from '../src/game/shardfile/livingBuildings';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from '../src/format/buildings';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { driftwoodWorldUpdates } from '../src/shards/driftwood-isle/generators/worldUpdates';
import shrineRows from '../src/shards/driftwood-isle/data/buildingLife.json' with {type:'json'};
import { islandSystems } from './fixtures/driftwood-world-updates';
import { legacyDouble } from './fake/FakeGame';
import type { PainterlyWorld } from '../src/game/looks/postGraphLook';
import type { ForestWeatherRig } from '../src/game/weather/forest';
import type { PaintedSky } from '../src/game/looks/keyedSky';

type NativeWorld = NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;
const rows = driftwoodWorldUpdates();
function fixture() {
  const construction = new Scope('world-update-construction'), scope = construction.child('entered'), systems: SystemSpec[] = [];
  bindResidentWorldScope(scope, construction);
  const source = emptyShardfile({slug:'updates-fixture',name:'Updates',author:'Test',revision:1,seed:7});
  const lightingRow = {id:'updates-lighting',initial:{uToonLift:[.1,.2,.3] as [number,number,number],uToonRim:[.3,.2,.1] as [number,number,number],uCloudShadow:.5,uToonNight:0,uSeaLevel:-2,uCloudTime:8}};
  const lighting = toonLighting(lightingRow);
  const product = createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map<string,unknown>([['look/toon',{lighting:lightingRow}]]),files:new Map(),read:()=>Promise.reject(new Error('No reads'))});
  let alpha = .25, awake = false;
  const alphaRead = vi.fn(), poses = vi.fn<ReturnType<RopeDeckSite['place']>['setPoses']>();
  const game = legacyDouble<NativeWorld['game']>({get alpha(){alphaRead();return alpha;}});
  const world = legacyDouble<NativeWorld>({game});
  const ctx = legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({runtime:legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world})}),
    system(spec){expect(this).toBe(ctx);systems.push(spec);scope.onDispose(()=>{const index=systems.indexOf(spec);if(index!==-1)systems.splice(index,1);});}});
  const chain = legacyDouble<RopeChain>({get awake(){return awake;}});
  const deck = legacyDouble<ReturnType<RopeDeckSite['place']>>({setPoses(value, blend){expect(this).toBe(deck);poses(value,blend);}});
  const resources = new SceneHandles({setupMaterial:()=>undefined}), material = new MeshBasicMaterial();
  resources.publish('materials.glyphs',material);
  const lifeRows = v.parse(v.strictObject({look:BuildingLifeLookSchema,life:BuildingLifeRowsSchema,initialDusk:v.number()}),shrineRows);
  const life = new LivingBuildings(resources,lifeRows.look);life.add(lifeRows.life);life.setDusk(lifeRows.initialDusk);life.update(0);
  const toon = new ToonLook(), newer = new ToonLook(), lookMaterial = new MeshBasicMaterial();
  const names = rows.flatMap(row=>row.kind==='toon-look'?[row.look]:[]);
  const lend = (owner:Scope, family:ToonLook):void => {lendLooks(owner,{materials:new Map(names.map(id=>[id,lookMaterial])),toon:family,setParam:()=>undefined,setTexture:()=>undefined,bindMeshMap:()=>lookMaterial});};
  lend(construction,toon);lend(scope,newer);
  const owners = ():void => {
    publishEntryOwner(construction,'rope-deck','bridge',deck);publishEntryOwner(construction,'chain','bridge.deck',chain);publishEntryOwner(construction,'buildings','shrine',life);
    lendEntryOwner(scope,construction,'rope-deck','bridge');lendEntryOwner(scope,construction,'chain','bridge.deck');lendEntryOwner(scope,construction,'buildings','shrine');
  };
  const finish = ():void => {construction.dispose();material.dispose();lookMaterial.dispose();};
  return {ctx,world,construction,scope,systems,chain,deck,poses,life,material,toon,newer,lighting,alphaRead,owners,lend,finish,
    pose(value:boolean,blend:number){awake=value;alpha=blend;}};
}

test('the original five ordered callbacks retain frame math, receivers and lazy awake/alpha reads',()=>{
  const run = (original:boolean) => {
    const f=fixture();f.owners();
    const time=windUniforms.uWindTime.value,gust=windUniforms.uGust.value;
    windUniforms.uWindTime.value=2;windUniforms.uGust.value=.5;
    try{
      if(original)withOwner(f.construction,()=>{
        const seabed=followToonLook(f.ctx.product,rows.find(row=>row.kind==='toon-look')?.look??'missing');
        const coveRow=[...rows].reverse().find(row=>row.kind==='toon-look');if(coveRow?.kind!=='toon-look')throw new Error('Missing cove');
        const cove=followToonLook(f.ctx.product,coveRow.look);
        islandSystems(f.ctx,{player:{position:new Vector3()},game:f.world.game},{boat:null,palms:{update:updateWind},bridge:f.deck,bridgeDeck:f.chain,seabed:{tick:seabed},cove:{update:cove},shrine:{update:f.life.update.bind(f.life)}});
      });else withOwner(f.scope,()=>{installWorldUpdates(f.ctx,rows);});
      const order=f.systems.map(({id,phase,before})=>({id,phase,before})),samples=[];
      expect(order).toEqual(rows.map(row=>({id:row.system,phase:'update',before:row.before})));
      expect(f.poses).not.toHaveBeenCalled();expect(f.alphaRead).not.toHaveBeenCalled();
      for(const [i,dt] of [0,1/30,.1,2].entries()){
        f.pose(i%2===1,.15+i*.1);f.lighting.uCloudTime.value=17+i;f.lighting.uCloudShadow.value=.2+i*.1;
        for(const system of f.systems)system.run(dt,i);
        samples.push({time:windUniforms.uWindTime.value,gust:windUniforms.uGust.value,color:f.material.color.toArray(),cloud:f.toon.uniforms.famToonCloud.value.toArray(),toonTime:f.toon.uniforms.famToonTime.value});
      }
      expect(f.alphaRead).toHaveBeenCalledTimes(2);expect(f.poses.mock.calls).toHaveLength(2);for(const call of f.poses.mock.calls)expect(call[0]).toBe(f.chain);
      expect(f.poses.mock.calls.map(call=>call[1])).toEqual([.25,.45000000000000007]);
      expect(f.newer.uniforms.famToonTime.value).not.toBe(f.toon.uniforms.famToonTime.value);
      return {order,samples};
    }finally{windUniforms.uWindTime.value=time;windUniforms.uGust.value=gust;f.finish();}
  };
  expect(run(false)).toEqual(run(true));
});

test('all loans preflight before registering even the first wind callback',()=>{
  const f=fixture();
  try{expect(()=>installWorldUpdates(f.ctx,rows)).toThrow('Missing live entry owner');expect(f.systems).toEqual([]);}finally{f.finish();}
});

test('a later missing toon loan still leaves zero registered updates',()=>{
  const f=fixture();f.owners();
  try{expect(()=>installWorldUpdates(f.ctx,[...rows,{kind:'toon-look',system:'missing',before:[],look:'not-lent'}])).toThrow('No lent look');expect(f.systems).toEqual([]);}finally{f.finish();}
});

test('duplicate system ids refuse before any frame work or registrations',()=>{
  const f=fixture();f.owners();
  try{expect(()=>installWorldUpdates(f.ctx,[...rows,{kind:'wind',system:'shard.driftwood.palms',before:[]}])).toThrow('Repeated');expect(f.systems).toEqual([]);expect(f.poses).not.toHaveBeenCalled();}finally{f.finish();}
});

test.each(['entered','construction','retiring','changed'] as const)('%s ownership refuses all registrations',mode=>{
  const f=fixture();f.owners();const replacement=new Scope('unrelated');
  let retire:Generator<unknown,void>|undefined;
  if(mode==='entered')f.scope.dispose();
  if(mode==='construction')f.construction.dispose();
  if(mode==='retiring'){f.construction.onDispose(()=>undefined);retire=f.construction.disposeSteps();retire.next();}
  if(mode==='changed')bindResidentWorldScope(f.scope,replacement);
  try{expect(()=>installWorldUpdates(f.ctx,rows)).toThrow('World update owner');expect(f.systems).toEqual([]);}finally{if(retire!==undefined)for(const value of retire)void value;f.finish();replacement.dispose();}
});

test('leaving unregisters entered systems and retains the original borrowed native owners for reentry',()=>{
  const f=fixture();f.owners();
  try{
    installWorldUpdates(f.ctx,rows);f.scope.dispose();expect(f.systems).toEqual([]);expect(f.construction.disposed).toBe(false);
    const entered=f.construction.child('reentered'),systems:SystemSpec[]=[];
    bindResidentWorldScope(entered,f.construction);
    lendEntryOwner(entered,f.construction,'rope-deck','bridge');lendEntryOwner(entered,f.construction,'chain','bridge.deck');lendEntryOwner(entered,f.construction,'buildings','shrine');
    f.lend(entered,new ToonLook());
    installWorldUpdates({...f.ctx,scope:entered,system:spec=>{systems.push(spec);}},rows);
    f.pose(true,.75);f.lighting.uCloudTime.value=123;
    for(const system of systems)system.run(.1,0);
    expect(f.poses.mock.calls.at(-1)?.[0]).toBe(f.chain);expect(f.poses.mock.calls.at(-1)?.[1]).toBe(.75);expect(f.toon.uniforms.famToonTime.value).toBe(123);
  }finally{f.finish();}
});

test('schema refuses authored phases, traversal paths and unknown update laws',()=>{
  for(const extra of [{kind:'script',system:'x',before:[]},{kind:'wind',system:'x',before:[],phase:'fixed.pre'},{kind:'buildings',system:'x',before:[],owner:'shrine',path:'update'},{kind:'toon-look',system:'x',before:[],look:'cove',run:()=>undefined}])expect(v.safeParse(WorldUpdatesSchema,[extra]).success).toBe(false);
  expect(v.safeParse(WorldUpdatesSchema,Array.from({length:33},()=>({kind:'wind',system:'x',before:[]}))).success).toBe(false);
  expect(v.parse(WorldUpdatesSchema,rows)).toEqual(rows satisfies WorldUpdatesRows);
});

test('registration cannot continue after the entered scope retires',()=>{
  const f=fixture();f.owners();const registered:string[]=[];
  try{
    expect(()=>installWorldUpdates({...f.ctx,system:spec=>{registered.push(spec.id);f.scope.dispose();}},rows)).toThrow('World update owner');
    expect(registered).toEqual(['shard.driftwood.palms']);expect(f.poses).not.toHaveBeenCalled();
  }finally{f.finish();}
});

test('a missing native world refuses before resolving loans or registering systems',()=>{
  const f=fixture();
  try{
    const game=legacyDouble<ShardContext['game']>({runtime:legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world:null})});
    expect(()=>installWorldUpdates({...f.ctx,game},rows)).toThrow('require their native world');expect(f.systems).toEqual([]);
  }finally{f.finish();}
});


test('compiled dispatch owns the entered pre-hook boundary and admits the defining schema',async()=>{
  const f=fixture();f.owners();
  try{
    const feature=CLIENT_FEATURES['world.updates'];
    expect({phase:feature.phase,rank:feature.rank,lifetime:feature.lifetime,sections:feature.sections}).toEqual({phase:'world-bindings',rank:-10,lifetime:'entered',sections:['look/toon']});
    const [row]=parseClientPlan({version:1,features:[{kind:'world.updates',rows}]}).features;if(row===undefined)throw new Error('Missing feature');
    await feature.install(f.ctx,row,f.construction);
    expect(f.systems.map(system=>system.id)).toEqual(rows.map(value=>value.system));
    expect(formatJsonSchema(WorldUpdatesSchema)).toBeDefined();
  }finally{f.finish();}
});


test('painted-world preserves its exact native look slot, weather values and method receiver', () => {
  const f = fixture(), update = vi.fn< PainterlyWorld['update'] >();
  const painted = legacyDouble<PainterlyWorld>({ update(dt, frame) { expect(this).toBe(painted); update(dt, frame); } });
  let sun = 0.75, overcast = 0.2;
  const look = legacyDouble<PaintedSky['look']>({});
  const sky = legacyDouble<PaintedSky>({ look, clock: legacyDouble<PaintedSky['clock']>({ get sunElevation() { return sun; } }) });
  const rig = legacyDouble<ForestWeatherRig>({ sky, weather: legacyDouble<ForestWeatherRig['weather']>({ get overcast() { return overcast; } }) });
  const row = { kind: 'painted-world' as const, system: 'orchard.look', before: ['engine.creatures.update'], after: ['orchard.titan'], world: 'orchard.painted', weather: 'orchard.weather' };
  try {
    publishEntryOwner(f.construction, 'painted-world', row.world, painted); publishEntryOwner(f.construction, 'world-weather', row.weather, rig);
    lendEntryOwner(f.scope, f.construction, 'painted-world', row.world); lendEntryOwner(f.scope, f.construction, 'world-weather', row.weather);
    installWorldUpdates(f.ctx, [row]);
    expect(f.systems.map(({ id, phase, before, after }) => ({ id, phase, before, after }))).toEqual([{ id: row.system, phase: 'update', before: row.before, after: row.after }]);
    expect(update).not.toHaveBeenCalled();
    f.systems[0]?.run(1 / 30, 100);
    sun = -0.4; overcast = 0.9; f.systems[0]?.run(0.2, 1000);
    expect(update.mock.calls.map(([dt, frame]) => ({ dt, sun: frame.sunElevation, overcast: frame.overcast }))).toEqual([{ dt: 1 / 30, sun: 0.75, overcast: 0.2 }, { dt: 0.2, sun: -0.4, overcast: 0.9 }]);
    for (const [, frame] of update.mock.calls) expect(frame.look).toBe(look);
  } finally { f.finish(); }
});

test('a missing painted suffix or accessor row registers no earlier native update', () => {
  const f = fixture(), getter = vi.fn(() => 'wind');
  try {
    expect(() => installWorldUpdates(f.ctx, [{ kind: 'wind', system: 'first', before: [] }, { kind: 'painted-world', system: 'later', before: [], world: 'missing', weather: 'missing' }])).toThrow('Missing live entry owner');
    expect(f.systems).toEqual([]);
    expect(() => installWorldUpdates(f.ctx, [{ get kind() { return getter(); }, system: 'getter', before: [] }])).toThrow('plain JSON');
    expect(getter).not.toHaveBeenCalled(); expect(f.systems).toEqual([]);
  } finally { f.finish(); }
});
