// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the existing native chain with its shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { expect,test,vi } from 'vitest';
import { Group,Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { World } from '../src/engine/core/bootstrap';
import { Physics } from '../src/engine/physics/Physics';
import { loadRapier } from '../src/engine/physics/rapier';
import { RopeChain } from '../src/engine/physics/ropeChain';
import type { ShardContext } from '../src/game/plugin/context';
import * as movers from '../src/game/plugin/mover';
import { installClientMoverOwners } from '../src/game/shardfile/clientMoverOwners';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { parseMovers } from '../src/format/movers';
import island from '../src/shards/driftwood-isle/data/movers.generated.json' with {type:'json'};
import { legacyDouble } from './fake/FakeGame';

const admitted=parseMovers(island),boat=admitted.find(row=>row.kind==='platform');
if(boat===undefined)throw new Error('Missing admitted platform fixture');
const platform=boat;
async function fixtureRuntime(scope:Scope):Promise<movers.MoverRuntime>{
  const host=await movers.createMoverHost([platform],new Map(),()=>[]);
  return new movers.MoverRuntime([platform],{scope,host,physics:legacyDouble<Physics>({}),adopt:()=>({pose:()=>undefined})});
}
function fixture(rows=admitted){
  const scope=new Scope('mover-owners'),source=emptyShardfile({slug:'mover-owners',name:'Mover owners',author:'Fixture',revision:1,seed:9});
  // Root movers differ deliberately: this host reads only the admitted section.
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections:new Map([['world/movers',{movers:rows}]]),files:new Map(),read:()=>Promise.reject(new Error('No guest bytes expected'))});
  const world=legacyDouble<NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>>({});
  const ctx=legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({runtime:legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world})})});
  return {ctx,scope};
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
