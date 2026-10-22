// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the existing native chain with its shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { expect,test,vi } from 'vitest';
import { Group,MeshBasicMaterial,Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Scope } from '../src/engine/app/scope';
import type { World } from '../src/engine/core/bootstrap';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { RopeChain } from '../src/engine/physics/ropeChain';
import { shardContext, ShardPlugin, type ShardContext } from '../src/game/plugin/context';
import { declaredRuntimeEntry } from '../src/game/shard/declaredEntry';
import { hybridInstallation } from '../src/game/shardfile/hybrid';
import { bindResidentWorldScope, boundResidentWorldScope } from '../src/game/shardfile/hybridPresentation';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';
import * as movers from '../src/game/plugin/mover';
import { installClientMoverOwners } from '../src/game/shardfile/clientMoverOwners';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { parseMovers } from '../src/format/movers';
import { validateGraph } from '../src/format/materialGraph';
import { lendLooks, type LentLooks } from '../src/game/shardfile/lentLooks';
import island from '../src/shards/driftwood-isle/data/movers.generated.json' with {type:'json'};
import { legacyDouble } from './fake/FakeGame';

const admitted=parseMovers(island),boat=admitted.find(row=>row.kind==='platform');
if(boat===undefined)throw new Error('Missing admitted platform fixture');
const platform=boat;
type FixtureWorld=NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;
async function fixtureRuntime(scope:Scope):Promise<movers.MoverRuntime>{
  const host=await movers.createMoverHost([platform],new Map(),()=>[]);
  return new movers.MoverRuntime([platform],{scope,host,physics:legacyDouble<Physics>({}),adopt:()=>({pose:()=>undefined})});
}
function fixture(rows=admitted,bound=true){
  const scope=new Scope('mover-owners'),source=emptyShardfile({slug:'mover-owners',name:'Mover owners',author:'Fixture',revision:1,seed:9});
  if(bound){const construction=new Scope('mover-construction');bindResidentWorldScope(scope,construction);scope.onDispose(()=>{construction.dispose();});}
  // Root movers differ deliberately: this host reads only the admitted section.
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map<string,unknown>([['world/movers',{movers:rows}],['client/plan',{version:1,features:[]}]]),files:new Map(),read:()=>Promise.reject(new Error('No guest bytes expected'))});
  const world=legacyDouble<FixtureWorld>({game:legacyDouble<FixtureWorld['game']>({})});
  const ctx=legacyDouble<ShardContext>({scope,product,system:vi.fn<ShardContext['system']>(),game:legacyDouble<ShardContext['game']>({runtime:legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world})})});
  return {ctx,scope,source};
}

test('typed scene loans preserve native pose order, visibility and the original system id',async()=>{
  const {ctx,scope}=fixture([platform]),group=new Group(),result=await fixtureRuntime(scope);
  const install=vi.spyOn(movers,'installDeclaredMovers').mockResolvedValue(result);
  try{
    publishEntryOwner(scope,'object','boat',group);
    expect(await installClientMoverOwners(ctx,{system:'original.movers',bindings:[{id:platform.id,kind:'object',owner:'boat',order:'XYZ',visibility:'enabled'}]})).toBe(result);
    const options=install.mock.calls[0]?.[2],view=options?.views?.get(platform.id);
    if(options===undefined||view===undefined)throw new Error('Missing typed native view');
    expect(options.data).toEqual([platform]);expect(options.systemId).toBe('original.movers');expect(options.borrowed).toBeUndefined();
    view.pose({position:{x:2,y:3,z:4},euler:{x:.1,y:.2,z:.3},enabled:false},{});
    expect(group.position).toEqual(new Vector3(2,3,4));expect(group.rotation.order).toBe('XYZ');expect(group.visible).toBe(false);
    expect(group.userData['declaredMotion']).toBe(true);
    await expect(installClientMoverOwners(ctx,{system:'duplicate',bindings:[{id:platform.id,kind:'object',owner:'boat'}]})).rejects.toThrow('already installed');
    scope.dispose();expect(group.userData['declaredMotion']).toBeUndefined();
  }finally{install.mockRestore();scope.dispose();}
});

test('exact mover identities and every target preflight before native installation or draw mutation',async()=>{
  const {ctx,scope}=fixture([platform]),group=new Group(),install=vi.spyOn(movers,'installDeclaredMovers');
  publishEntryOwner(scope,'object','boat',group);
  try{
    await expect(installClientMoverOwners(ctx,{system:'movers',bindings:[]})).rejects.toThrow('exact admitted');
    await expect(installClientMoverOwners(ctx,{system:'movers',bindings:[{id:'wrong',kind:'object',owner:'boat'}]})).rejects.toThrow('exact admitted');
    await expect(installClientMoverOwners(ctx,{system:'movers',bindings:[{id:platform.id,kind:'chain',owner:'boat'}]})).rejects.toThrow('kind differs');
    await expect(installClientMoverOwners(ctx,{system:'movers',bindings:[{id:platform.id,kind:'object',owner:'missing'}]})).rejects.toThrow('Missing live entry owner');
    expect(install).not.toHaveBeenCalled();expect(group.userData).toEqual({});
  }finally{install.mockRestore();scope.dispose();}
});

test('the original native chain is borrowed without replacing or disposing any body',async()=>{
  const row=admitted.find(value=>value.kind==='chain'),spec=row?.chain;
  if(row===undefined||spec===undefined)throw new Error('Missing chain fixture');
  const R=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))),physics=new Physics(R),chain=new RopeChain(physics,spec);
  const {ctx,scope}=fixture([row]),dispose=vi.spyOn(chain,'dispose'),result=await fixtureRuntime(scope),install=vi.spyOn(movers,'installDeclaredMovers').mockResolvedValue(result);
  try{
    const bodies=[...chain.bodies];publishEntryOwner(scope,'chain','deck',chain);
    await installClientMoverOwners(ctx,{system:'chain.movers',bindings:[{id:row.id,kind:'chain',owner:'deck'}]});
    expect(install.mock.calls[0]?.[2].views?.get(row.id)?.chain).toBe(chain);
    scope.dispose();expect(chain.bodies).toEqual(bodies);expect(dispose).not.toHaveBeenCalled();
  }finally{install.mockRestore();dispose.mockRestore();scope.dispose();chain.dispose();physics.dispose();}
});

test('entry retirement across an awaited installer never publishes a completed mover owner',async()=>{
  const {ctx,scope}=fixture([platform]),group=new Group(),result=await fixtureRuntime(scope);let resume:((runtime:movers.MoverRuntime)=>void)|undefined;
  const install=vi.spyOn(movers,'installDeclaredMovers').mockReturnValue(new Promise(resolve=>{resume=resolve;}));
  try{
    publishEntryOwner(scope,'object','boat',group);
    const running=installClientMoverOwners(ctx,{system:'movers',bindings:[{id:platform.id,kind:'object',owner:'boat'}]});
    scope.dispose();if(resume===undefined)throw new Error('Missing installer resolver');resume(result);
    await expect(running).rejects.toThrow('has ended');expect(group.userData['declaredMotion']).toBeUndefined();
  }finally{install.mockRestore();scope.dispose();}
});

test('the native installer refuses an ancestor retirement before reading or allocating physics',async()=>{
  const {ctx,scope}=fixture([platform]),construction=new Scope('retiring-world'),entered=construction.child('entered');
  const host=await movers.createMoverHost([platform],new Map(),()=>[]),readPhysics=vi.fn();
  const world=legacyDouble<World>({get physics():Physics{readPhysics();throw new Error('No native allocation during retirement');}});
  construction.onDispose(()=>undefined);
  const retiring=construction.disposeSteps();retiring.next();
  try{
    expect(entered.disposed).toBe(false);expect(entered.disposing).toBe(true);
    await expect(movers.installDeclaredMovers({...ctx,scope:entered},world,{data:[platform],modules:new Map(),systemId:'retiring.movers',shared:{host,tick:()=>0}})).rejects.toThrow('scope left during admission');
    expect(readPhysics).not.toHaveBeenCalled();
  }finally{for(const step of retiring)void step;scope.dispose();construction.dispose();}
});

function moorLook(type:'vec2'|'float'='vec2'){
  const checked=validateGraph({version:1,kind:'material',model:'toon',params:{moor:{type,value:type==='vec2'?[0,0]:0}},
    nodes:{paint:{op:'const',type:'vec3',value:[1,1,1]}},stages:{surface:{colour:'paint'}}});
  if(!checked.ok)throw new Error(checked.errors.join('; '));
  return {family:'graph' as const,graph:checked.graph};
}

test('mooring follows original fixed-pose order, one reusable lift buffer, rest and unchanged restore',async()=>{
  const {ctx,scope,source}=fixture([platform]),group=new Group(),material=new MeshBasicMaterial(),write=vi.fn<LentLooks['setParam']>();
  const R=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))),physics=new Physics(R);
  const moor={look:'fixture-moor',water:.375,cleats:[-2.9,2.9] as const};
  source.look.materials[moor.look]=moorLook();publishEntryOwner(scope,'object','boat',group);
  let host:Awaited<ReturnType<typeof movers.createMoverHost>>|undefined;
  const install=vi.spyOn(movers,'installDeclaredMovers').mockImplementation(async(_ctx,_world,options)=>{
    host=await movers.createMoverHost(options.data,new Map(),()=>[]);
    const native=new movers.MoverRuntime(options.data,{scope,host,physics});
    const view=new movers.MoverRuntime(options.data,{scope,host,physics,adopt:id=>options.views?.get(id)});
    view.restoreBodies(native.snapshotBodies());return view;
  });
  lendLooks(scope,{materials:new Map([[moor.look,material]]),setParam:(id,name,value)=>{
    const heave=group.position.y-moor.water,pitch=Math.sin(group.rotation.x);
    expect(value).toEqual([heave-moor.cleats[0]*pitch,heave-moor.cleats[1]*pitch]);
    write(id,name,value);
  },setTexture:()=>undefined,bindMeshMap:()=>material});
  try{
    const runtime=await installClientMoverOwners(ctx,{system:'original.movers',bindings:[{id:platform.id,kind:'object',owner:'boat',moor}]});
    if(runtime===undefined)throw new Error('Bound entry did not install its mover view');
    expect(write).not.toHaveBeenCalled(); // admission must not add a rest/initial update
    runtime.showRest();expect(write).toHaveBeenCalledTimes(1);const buffer=write.mock.calls[0]?.[2];
    for(let tick=1;tick<=180;tick++){
      if(host===undefined)throw new Error('Missing native host');host.beginTick(tick);runtime.step(tick);
      const pose=runtime.pose(platform.id),call=write.mock.calls.at(-1);
      expect(group.position).toEqual(new Vector3(pose.position.x,pose.position.y,pose.position.z));
      expect(group.rotation.x).toBe(pose.euler.x);expect(call?.[0]).toBe(moor.look);expect(call?.[1]).toBe('moor');expect(call?.[2]).toBe(buffer);
    }
    const saved=runtime.snapshotState(),writes=write.mock.calls.length;
    runtime.restoreState(saved);expect(runtime.snapshotState()).toBe(saved);expect(write).toHaveBeenCalledTimes(writes);
    runtime.showRest();expect(write).toHaveBeenCalledTimes(writes+1);expect(write.mock.calls.at(-1)?.[2]).toBe(buffer);
  }finally{install.mockRestore();scope.dispose();material.dispose();physics.dispose();}
});

test.each(['missing','not-lent','wrong-param'] as const)('a %s mooring look refuses before any native or scene effect',async mode=>{
  const {ctx,scope,source}=fixture([platform]),group=new Group(),material=new MeshBasicMaterial(),write=vi.fn<LentLooks['setParam']>(),install=vi.spyOn(movers,'installDeclaredMovers');
  const moor={look:'fixture-moor',water:0,cleats:[-2,2] as const};publishEntryOwner(scope,'object','boat',group);
  if(mode!=='missing')source.look.materials[moor.look]=moorLook(mode==='wrong-param'?'float':'vec2');
  if(mode!=='not-lent')lendLooks(scope,{materials:new Map([[moor.look,material]]),setParam:write,setTexture:()=>undefined,bindMeshMap:()=>material});
  try{
    await expect(installClientMoverOwners(ctx,{system:'movers',bindings:[{id:platform.id,kind:'object',owner:'boat',moor}]})).rejects.toThrow('declared lent vec2');
    expect(install).not.toHaveBeenCalled();expect(group.userData).toEqual({});expect(write).not.toHaveBeenCalled();
  }finally{install.mockRestore();scope.dispose();material.dispose();}
});

test('a replaced mooring look across native admission refuses completion',async()=>{
  const {ctx,scope,source}=fixture([platform]),group=new Group(),material=new MeshBasicMaterial(),replacement=new Scope('replacement-look');
  const moor={look:'fixture-moor',water:0,cleats:[-2,2] as const};source.look.materials[moor.look]=moorLook();publishEntryOwner(scope,'object','boat',group);
  const lend=(owner:Scope):void=>{lendLooks(owner,{materials:new Map([[moor.look,material]]),setParam:()=>undefined,setTexture:()=>undefined,bindMeshMap:()=>material});};
  lend(scope);const result=await fixtureRuntime(scope);let resume:((runtime:movers.MoverRuntime)=>void)|undefined;
  const install=vi.spyOn(movers,'installDeclaredMovers').mockReturnValue(new Promise(resolve=>{resume=resolve;}));
  try{
    const running=installClientMoverOwners(ctx,{system:'movers',bindings:[{id:platform.id,kind:'object',owner:'boat',moor}]});
    lend(replacement);if(resume===undefined)throw new Error('Missing installer resolver');resume(result);
    await expect(running).rejects.toThrow('look owner changed');
  }finally{install.mockRestore();replacement.dispose();scope.dispose();material.dispose();}
});

test('standalone hybridInstallation owns exactly one entered client drive',async()=>{
  const {ctx,scope}=fixture([platform],false),app=new App(),runtime=ctx.game.runtime;
  if(runtime===undefined)throw new Error('Missing standalone runtime');
  const level=createLevelInstallation(app,scope,{},()=>({set:()=>undefined,detail:()=>undefined}));
  const base=shardContext(level.context,TEMPLATE,{shard:TEMPLATE,runtime,rows:new Map(),bag:{tab:()=>()=>undefined,fragment:()=>()=>undefined}},ctx.product);
  const entered=scope.child('standalone-entered'),installation=hybridInstallation(base,entered,runtime),group=new Group(),result=await fixtureRuntime(entered);
  publishEntryOwner(entered,'object','boat',group);
  const install=vi.spyOn(movers,'installDeclaredMovers').mockResolvedValue(result);
  try{
    expect(boundResidentWorldScope(installation.context.scope)).toBe(scope);
    expect(await installClientMoverOwners(installation.context,{system:'original.movers',bindings:[{id:platform.id,kind:'object',owner:'boat'}]})).toBe(result);
    expect(install).toHaveBeenCalledTimes(1);expect(install.mock.calls[0]?.[2].systemId).toBe('original.movers');
    expect(group.position).toEqual(new Vector3()); // admission adds no rest/pose write
    await expect(installClientMoverOwners(installation.context,{system:'original.movers',bindings:[{id:platform.id,kind:'object',owner:'boat'}]})).rejects.toThrow('already installed');
  }finally{install.mockRestore();scope.dispose();}
});

test('a direct NativeEntry leaves the original rest and native handles without a client drive',async()=>{
  const {ctx,scope}=fixture([platform],false),group=new Group();
  const R=await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))),physics=new Physics(R),host=await movers.createMoverHost([platform],new Map(),()=>[]);
  const result=new movers.MoverRuntime([platform],{scope,host,physics}),saved=result.snapshotBodies();
  expect(saved).toHaveLength(1);
  group.position.set(platform.at.x,platform.at.y,platform.at.z);const rest=group.position.clone();
  publishEntryOwner(scope,'object','boat',group);let completed=false;
  class Native extends ShardPlugin{
    override async world(context:ShardContext):Promise<void>{
      expect(await installClientMoverOwners(context,{system:'original.movers',bindings:[{id:platform.id,kind:'object',owner:'boat'}]})).toBeUndefined();completed=true;
    }
  }
  const entry=declaredRuntimeEntry(Native,Native,{entry:'fixture.ts',retainHomeRuntime:false,stagesOwner:'declared'});
  const NativeEntry=entry.default,native=new NativeEntry(undefined,()=>Promise.reject(new Error('Native must not admit a second hybrid')),()=>false);
  const install=vi.spyOn(movers,'installDeclaredMovers'),system=vi.spyOn(ctx,'system');
  try{
    await native.world(ctx);expect(completed).toBe(true);expect(boundResidentWorldScope(scope)).toBeUndefined();
    expect(install).not.toHaveBeenCalled();expect(system).not.toHaveBeenCalled();expect(group.position).toEqual(rest);
    expect(group.userData['declaredMotion']).toBeUndefined();expect(result.snapshotBodies()).toEqual(saved);
  }finally{install.mockRestore();system.mockRestore();scope.dispose();physics.dispose();}
});

test.each(['retired','replaced'] as const)('a %s construction across mover admission refuses completion',async mode=>{
  const {ctx,scope}=fixture([platform]),construction=boundResidentWorldScope(scope),replacement=new Scope('replacement-construction'),group=new Group(),result=await fixtureRuntime(scope);
  if(construction===undefined)throw new Error('Missing original construction');publishEntryOwner(scope,'object','boat',group);
  let resume:((runtime:movers.MoverRuntime)=>void)|undefined;
  const install=vi.spyOn(movers,'installDeclaredMovers').mockReturnValue(new Promise(resolve=>{resume=resolve;}));
  try{
    const running=installClientMoverOwners(ctx,{system:'movers',bindings:[{id:platform.id,kind:'object',owner:'boat'}]});
    if(mode==='retired')construction.dispose();else bindResidentWorldScope(scope,replacement);
    if(resume===undefined)throw new Error('Missing installer resolver');resume(result);
    await expect(running).rejects.toThrow('construction owner has ended or changed');
  }finally{install.mockRestore();scope.dispose();replacement.dispose();}
});
