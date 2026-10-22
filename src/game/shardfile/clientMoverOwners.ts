/** Concrete entered mover views over construction-owned scene objects and chains. */
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '../plugin/context';
import { installDeclaredMovers, type MoverRuntime, type MoverView } from '../plugin/mover';
import { entryOwner } from './entryOwners';
import { outputDescriptor } from './outputDescriptor';

export type MoverOwnerBinding =
  | {readonly id:string;readonly kind:'object';readonly owner:string;readonly order?:'XYZ'|'YXZ';readonly visibility?:'enabled'}
  | {readonly id:string;readonly kind:'chain';readonly owner:string};
export interface MoverOwnerRows {readonly system:string;readonly bindings:readonly MoverOwnerBinding[]}
const installed=new WeakSet<Scope>();

/** Every mover id and original target is admitted before effects. The existing
 * native mover host owns tick, collider, script and save identities. No authored
 * callback, object path or second native body enters through these bindings.
 * A separate real view rule must replace any legacy after-pose work before a
 * product activates this capability; there is deliberately no callback adapter. */
export async function installClientMoverOwners(ctx:ShardContext,rows:MoverOwnerRows):Promise<MoverRuntime>{
  const world=ctx.game.runtime?.world,scope=ctx.scope;
  const live=():void=>{if(scope.disposed||scope.disposing)throw new Error('Mover entry owner has ended');};
  live();if(world===undefined||world===null)throw new Error('Mover entry requires its world');
  if(installed.has(scope))throw new Error('Mover entry is already installed');
  const data=ctx.product.section('world/movers').movers,ids=new Set(rows.bindings.map(row=>row.id));
  if(ids.size!==rows.bindings.length||ids.size!==data.length||data.some(row=>!ids.has(row.id)))throw new Error('Mover owners require the exact admitted id set');
  const loans=rows.bindings.map(row=>{
    const declared=data.find(mover=>mover.id===row.id);
    if(declared===undefined||(declared.kind==='chain')!==(row.kind==='chain'))throw new Error('Mover owner kind differs from its admitted primitive');
    return row.kind==='chain'?{row,value:entryOwner(scope,'chain',row.owner)}:{row,value:entryOwner(scope,'object',row.owner)};
  });
  const current=():void=>{
    live();
    for(const loan of loans){
      const value=loan.row.kind==='chain'?entryOwner(scope,'chain',loan.row.owner):entryOwner(scope,'object',loan.row.owner);
      if(value!==loan.value)throw new Error('Mover entry owner changed during admission');
    }
  };
  const views=new Map<string,MoverView>();
  // Resolve kinds again without reflected access; each callback is compiled
  // platform presentation over one typed loan, never supplied by authored data.
  for(const row of rows.bindings){
    if(row.kind==='chain'){views.set(row.id,{chain:entryOwner(scope,'chain',row.owner),pose:()=>undefined});continue;}
    const group=entryOwner(scope,'object',row.owner);
    views.set(row.id,{pose:pose=>{
      if(row.visibility==='enabled')group.visible=pose.enabled;
      group.position.set(pose.position.x,pose.position.y,pose.position.z);
      group.rotation.set(pose.euler.x,pose.euler.y,pose.euler.z,row.order??'YXZ');
    }});
  }
  current();installed.add(scope);scope.onDispose(()=>{installed.delete(scope);});
  for(const row of rows.bindings)if(row.kind==='object')scope.expose(entryOwner(scope,'object',row.owner).userData,'declaredMotion',true);
  const index=outputDescriptor(ctx.product.shardfile)?.index;
  const result=await installDeclaredMovers(ctx,world,{data,modules:new Map(),views,systemId:rows.system,read:async hash=>{
    current();const file=index?.files.find(row=>row.hash===hash);
    if(file?.name===undefined)throw new Error('Mover module requires its admitted logical file');
    const bytes=await ctx.product.file(file.name);current();return bytes;
  }});
  current();return result;
}
