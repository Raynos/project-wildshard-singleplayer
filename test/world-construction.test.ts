import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { BufferGeometry, Group, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three';
import type { Game } from '../src/engine/core/Game';
import type { Physics } from '../src/engine/physics/Physics';
import type { ModelContext } from '../src/engine/models/model';
import type { Placed } from '../src/engine/models/place';
import type { Player } from '../src/engine/player/Player';
import type { SkyRig } from '../src/engine/world/skyRig';
import { WorldRegistry } from '../src/engine/world/registry';
import { Scope } from '../src/engine/app/scope';
import * as boot from '../src/engine/boot/plan';
import * as model from '../src/engine/models/model';
import * as gpu from '../src/engine/core/gpuOnly';
import { WorldConstructionSchema, WorldAssemblySchema } from '../src/format/worldAssembly';
import { WorldAssembly, type WorldAssemblyPorts } from '../src/game/shardfile/worldAssembly';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { publishEntryOwner, type EntryOwnerTypes } from '../src/game/shardfile/entryOwners';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import type { BakedTiles } from '../src/game/shardfile/bakedTiles';
import * as assets from './fixtures/driftwoodLegacyAssets';
import { driftwoodProduct } from './fixtures/driftwoodLegacyRows';
import { sites } from './fixtures/driftwoodLegacyCatalogue';
import { WORLD_STAGES } from '../src/shards/driftwood-isle/generators/worldAssembly';
import manifest from '../src/shards/driftwood-isle/discovery.generated';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { buildDriftwoodWorld } from './fixtures/driftwoodWorldConstruction';
import { legacyDouble } from './fake/FakeGame';

const ISLAND=assets.ISLAND;
const stageRows=v.parse(WorldAssemblySchema,WORLD_STAGES).stages;
function fixture() {
  admitDriftwoodFixtureRows();
  const scope=new Scope('world-construction'),events:unknown[]=[],scenes=new SceneHandles({setupMaterial:()=>undefined});
  const position=new Vector3(3,11,5),root=new Scene(),registry=new WorldRegistry(),previous=driftwoodProduct();
  const player=legacyDouble<Player>({position}),sky=legacyDouble<SkyRig>({}),physics=legacyDouble<Physics>({});
  const game=legacyDouble<Game>({scene:root,registrationScope:scope,tier:'desktop'});
  const world=legacyDouble<ShardWorld>({game,player,sky,physics,registry}),viewer=()=>position;
  const runtime=legacyDouble<ShardRuntime>({world,viewer});
  let afterRead=():void=>undefined,afterStage=(_id:string):void=>undefined;
  const product={...previous,shardfile:{...previous.shardfile,identity:{...previous.shardfile.identity,seed:manifest.seed}},file:(name:string)=>{events.push(['file',name]);afterRead();return Promise.resolve(new Uint8Array([7]));}};
  ISLAND.admit(product);
  const objects=new Map<string,Group>(),placed=new Map<string,Placed[]>();
  const object=(id:string):Group=>{let value=objects.get(id);if(value===undefined){value=new Group();value.name=id;objects.set(id,value);}return value;};
  for(const row of stageRows){
    const id=row.kind==='streamed-cover'?row.object:row.id;
    publishEntryOwner(scope,'object',id,object(id));
    const group=object(`${row.id}.placed`),list=[legacyDouble<Placed>({object:group})];placed.set(row.id,list);
    publishEntryOwner(scope,'placed',row.id,list);publishEntryOwner(scope,'floor',row.id,()=>4);
    publishEntryOwner(scope,'site',row.id,{});
  }
  publishEntryOwner(scope,'rope-deck','bridge',legacyDouble<EntryOwnerTypes['rope-deck']>({placed:legacyDouble<Placed>({object:object('bridge')})}));
  publishEntryOwner(scope,'ambient-draw','driftwood.gulls',legacyDouble<EntryOwnerTypes['ambient-draw']>({group:object('driftwood.gulls')}));
  const moor=new Mesh(new BufferGeometry(),new MeshBasicMaterial());moor.name='moorings.mesh';scenes.publish('moorings.mesh',moor);
  const baked=new Map([['cove',legacyDouble<BakedTiles>({group:object('baked.cove')})]]);
  const loader:typeof ISLAND.load=(bytes,owner)=>{expect(bytes).toBeUndefined();expect(owner).toBe(scope);events.push(['load']);return Promise.resolve();};
  const load=vi.spyOn(ISLAND,'load').mockImplementation(loader),legacyLoad=vi.spyOn(assets,'loadFixedGeometry').mockImplementation(loader);
  const draws=legacyDouble<FixedDraws>({ready:true}),loaded=vi.spyOn(ISLAND,'loaded').mockReturnValue(draws),legacyLoaded=vi.spyOn(assets,'fixedDrawLibrary').mockReturnValue(draws);
  const context=vi.spyOn(model,'sharedModelContext').mockReturnValue(legacyDouble<ModelContext>({}));
  const slice=vi.spyOn(boot,'slicer').mockImplementation((budget,progress)=>{expect(budget).toBe(30);return Object.assign((done?:number,total?:number,detail?:string)=>{events.push(['slice',done,total,detail]);if(done!==undefined&&total!==undefined)progress?.set(done,total,detail);return Promise.resolve();},{due:()=>null});});
  const macro=vi.spyOn(boot,'macrotask').mockImplementation(()=>{events.push(['macrotask']);return Promise.resolve();});
  const release=vi.spyOn(gpu,'gpuOnlyTrees').mockImplementation((roots,label,keep)=>{events.push(['gpu',roots.map(value=>value.name),label,keep]);return 0;});
  const admit=vi.spyOn(WorldAssembly,'admit').mockImplementation((_input,ports:WorldAssemblyPorts)=>legacyDouble<WorldAssembly>({next:async id=>{
    const row=stageRows.find(value=>value.id===id);if(row===undefined)throw new Error('Unknown stage');
    events.push(['stage',id]);afterStage(id);if(row.kind!=='weather'&&row.kind!=='arena-script')await ports.slice(row.label);
  }}));
  const progress:boot.StepProgress={set:(...args)=>{events.push(['progress',...args]);},detail:()=>undefined};
  const ports={runtime,product,scope,library:ISLAND,scenes,baked,sites,progress};
  return {ports,events,world,scope,position,placed,release,admit,
    onRead(fn:()=>void){afterRead=fn;},onStage(fn:(id:string)=>void){afterStage=fn;},
    finish(){scope.dispose();ISLAND.admit(previous);for(const spy of [load,legacyLoad,loaded,legacyLoaded,context,slice,macro,release,admit])spy.mockRestore();moor.geometry.dispose();moor.material.dispose();}};
}

test('one declared stage walk preserves original progress, floor, yields, capture order and exact GPU root identities',async()=>{
  const run=async(original:boolean)=>{
    const f=fixture();
    try{
      await (original ? buildDriftwoodWorld(f.world,f.ports.runtime.viewer,f.ports.progress,f.ports.scenes,f.ports.baked,f.scope) : WorldAssembly.construct(WORLD_STAGES,f.ports));
      expect(f.position.y).toBe(4);expect(f.release).toHaveBeenCalledTimes(1);
      expect(f.events.filter(event=>Array.isArray(event)&&event[0]==='stage')).toEqual(stageRows.map(row=>['stage',row.id]));
      const roots=f.release.mock.calls[0]?.[0];expect(roots?.[4]).toBe(f.placed.get('boat')?.[0]?.object);expect(roots?.[6]).toBe(f.placed.get('shore')?.[0]?.object);
      return f.events;
    }finally{f.finish();}
  };
  expect(await run(false)).toEqual(await run(true));
});

test.each(['unknown','duplicate','future-floor'] as const)('%s checkpoint refuses before the original load or file read',async mode=>{
  const f=fixture(),data=structuredClone(WORLD_STAGES),first=data.construction.checkpoints[0];if(first===undefined)throw new Error('Missing checkpoint');
  if(mode==='unknown')first.stage='not-a-stage';
  if(mode==='duplicate')data.construction.checkpoints.push(first);
  if(mode==='future-floor')data.construction.checkpoints.unshift({stage:'decks',at:'before',actions:[{kind:'entry-floor',floor:'boat'}]});
  try{await expect(WorldAssembly.construct(data,f.ports)).rejects.toThrow();expect(f.events).toEqual([]);expect(f.admit).not.toHaveBeenCalled();}finally{f.finish();}
});

test('leave across the original early read stops before constructing even the first stage',async()=>{
  const f=fixture();f.onRead(()=>{f.scope.dispose();});
  try{await expect(WorldAssembly.construct(WORLD_STAGES,f.ports)).rejects.toThrow('owner left');expect(f.admit).not.toHaveBeenCalled();expect(f.release).not.toHaveBeenCalled();}finally{f.finish();}
});

test('leave across a stage stops before later checkpoints, stages or GPU release',async()=>{
  const f=fixture();f.onStage(id=>{if(id==='cover')f.scope.dispose();});
  try{await expect(WorldAssembly.construct(WORLD_STAGES,f.ports)).rejects.toThrow('owner left');expect(f.events).not.toContainEqual(['stage','bridge.deck']);expect(f.release).not.toHaveBeenCalled();}finally{f.finish();}
});

test.each(['placed','scene-part','baked'] as const)('a missing %s GPU root refuses the whole release',async kind=>{
  const f=fixture(),data=structuredClone(WORLD_STAGES);
  if(kind==='placed')f.placed.get('boat')?.splice(0);
  if(kind==='scene-part')data.construction.gpu.roots.push({kind:'scene-part',as:'mesh',id:'missing.mesh'});
  if(kind==='baked')data.construction.gpu.roots.push({kind:'baked',id:'missing-baked'});
  try{await expect(WorldAssembly.construct(data,f.ports)).rejects.toThrow();expect(f.release).not.toHaveBeenCalled();}finally{f.finish();}
});

test('checkpoints reject arbitrary callbacks, paths, repeated runs and authored phase selectors',()=>{
  const data=WORLD_STAGES.construction;
  for(const extra of [{kind:'run',id:'bridge'},{kind:'entry-floor',floor:'boat',path:'position.y'},{kind:'macrotask',phase:'render'},{kind:'progress',label:'x',run:()=>undefined}]){
    expect(v.safeParse(WorldConstructionSchema,{...data,checkpoints:[{stage:'cover',at:'after',actions:[extra]}]}).success).toBe(false);
  }
  expect(v.parse(WorldAssemblySchema,WORLD_STAGES).construction).toEqual(data);
});
