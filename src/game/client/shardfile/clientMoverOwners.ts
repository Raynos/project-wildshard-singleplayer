/** Concrete entered mover views over construction-owned scene objects and chains. */
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '../plugin/context';
import type { MoverRuntime, MoverView } from '../../server/plugin/mover';
import type { BorrowedSpeciesControl, SpeciesDecisionAuthority } from '../../server/plugin/brain';
import type { PageSimFeed } from '../../server/plugin/pageSimFeed';
import { netClimate } from '../weather/netClimate';
import { wirePage } from './wirePage';
import { liftPrompt } from '../../shared/shardfile/wirePrompts';
import { entryOwner } from '../../shared/shardfile/entryOwners';
import { boundResidentWorldScope } from './hybridPresentation';
import { outputDescriptor } from '../../shared/shardfile/outputDescriptor';
import { hasLentLook, lentLooksOf, setLentParam, type LentLooks } from './lentLooks';
import { productClosureFile } from '../../shared/shardfile/shardProduct';
import { materialGraphIr } from '@wildshard/format/materials';
import { grassHeightAt, trample } from '../systems/looks/trample';

export interface MoverMoorRows {readonly look:string;readonly water:number;readonly cleats:readonly [number,number]}
export type MoverOwnerBinding =
  | {readonly id:string;readonly kind:'object';readonly owner:string;readonly order?:'XYZ'|'YXZ';readonly visibility?:'enabled';readonly moor?:MoverMoorRows}
  | {readonly id:string;readonly kind:'chain';readonly owner:string};
export interface MoverOwnerRows {readonly system:string;readonly bindings:readonly MoverOwnerBinding[]}
const installed=new WeakSet<Scope>();
/** The client's one seat on the page sim's feed. Views only read it, and each row goes as a view stops building on it. `src/pageSim.ts` fills it
 * from the boot's import bank, so the sim stays out of the session chunk's static closure (J10's ratchet). */
export let pageSim:PageSimFeed;
/** J130: this page runs on a server. Motion and the sky come off rows; what else `pageSim` holds still builds, on nothing, and
 * stands down where a bar, a payout or a flag would otherwise have two drivers. */
const noDecision=():BorrowedSpeciesControl=>({phase:0,fighting:false,restart:()=>undefined,current:null,windup:0,aim:0,snapshot:()=>null,restore:()=>undefined,observe:()=>undefined});
/** A row's brain is the server's. A body this page draws asks for a decision and is told there is none. */
export const rowDecisions:SpeciesDecisionAuthority={bind:noDecision};
let wired=false;
export function wirePageSim():void{
  wirePage.followBooks();
  if(wired)return;
  wired=true;
  const {installDeclaredMovers,climate,pageWildlife,bindMeleeContacts}=pageSim;
  Object.assign(pageSim,{
    installDeclaredMovers:async(...[ctx,world,options]:Parameters<PageSimFeed['installDeclaredMovers']>)=>{
      const runtime=await installDeclaredMovers(ctx,world,{...options,followed:true});
      for(const row of options.data)wirePage.movers.set(row.id,{pose:pose=>{wirePage.posed++;runtime.follow(row.id,pose);},place:(at,next)=>{runtime.replayPose(row.id,at,next);}});
      return runtime;
    },
    // The server keeps the wild: a page keeps only what has no row, the crowds it draws and the foragers underfoot. Its crowds see the rows.
    pageWildlife:(...input:Parameters<PageSimFeed['pageWildlife']>)=>{
      const wildlife=pageWildlife(...input);
      wildlife.rowBodies=true;
      return wildlife;
    },
    // A blade still swings here, and what it lands is the server's: its contacts have nobody to scan.
    bindMeleeContacts:(id,rows,ports)=>bindMeleeContacts(id,rows,{...ports,targets:()=>[]}),
    commandSocketLift:(_runtime:Parameters<PageSimFeed['commandSocketLift']>[0],lift:Parameters<PageSimFeed['commandSocketLift']>[1],action:Parameters<PageSimFeed['commandSocketLift']>[2])=>{wirePage.send(liftPrompt(lift.mover,action));},
    climate:(ports:Parameters<PageSimFeed['climate']>[0])=>climate({...ports,net:rows=>netClimate(wirePage.climateRows,rows,word=>{wirePage.climate(word);})}),
  } satisfies Partial<PageSimFeed>);
}
/** The grass a creature reads and parts is a view's, so this seat lends it the moment the page sim is reachable. */
export function installPageSim(feed:PageSimFeed):void{
  pageSim=feed;
  feed.lendPageGrass({heightAt:grassHeightAt,push:(x,z,radius,strength,vx,vz)=>{trample.push(x,z,radius,strength,vx,vz);}});
}

/** Every mover id and original target is admitted before effects. The existing
 * native mover host owns tick, collider, script and save identities. No authored
 * callback, object path or second native body enters through these bindings.
 * Declared mooring cleats update their vec2 look immediately after each native
 * pose, at the original fixed-step cadence; no display-rate view lane or
 * callback adapter changes that order. */
export async function installClientMoverOwners(ctx:ShardContext,rows:MoverOwnerRows):Promise<MoverRuntime|undefined>{
  const scope=ctx.scope,construction=boundResidentWorldScope(scope);
  const live=():void=>{
    if(scope.disposed||scope.disposing)throw new Error('Mover entry owner has ended');
    if(construction!==undefined&&(construction.disposed||construction.disposing||boundResidentWorldScope(scope)!==construction))throw new Error('Mover construction owner has ended or changed');
  };
  live();
  // A direct native entry kept the authored rest and never owned a client drive.
  // Standalone shardfile entries use hybridInstallation and bind a resident too.
  if(construction===undefined)return undefined;
  const world=ctx.game.runtime?.world;
  if(world===undefined||world===null)throw new Error('Mover entry requires its world');
  if(installed.has(scope))throw new Error('Mover entry is already installed');
  const data=ctx.product.section('world/movers').movers,ids=new Set(rows.bindings.map(row=>row.id));
  if(ids.size!==rows.bindings.length||ids.size!==data.length||data.some(row=>!ids.has(row.id)))throw new Error('Mover owners require the exact admitted id set');
  const loans=rows.bindings.map(row=>{
    const declared=data.find(mover=>mover.id===row.id);
    if(declared===undefined||(declared.kind==='chain')!==(row.kind==='chain'))throw new Error('Mover owner kind differs from its admitted primitive');
    return row.kind==='chain'?{row,value:entryOwner(scope,'chain',row.owner)}:{row,value:entryOwner(scope,'object',row.owner)};
  });
  const moors=new Map<string,[number,number]>(),looks=new Map<string,LentLooks>();
  for(const row of rows.bindings)if(row.kind==='object'&&row.moor!==undefined){
    const moor=row.moor,look=ctx.product.shardfile.look.materials[moor.look];
    if(!Number.isFinite(moor.water)||moor.cleats.some(value=>!Number.isFinite(value)))throw new Error('Mooring requires finite water and two cleats');
    // D74: the look's graph is its graph file
    const bytes=look?.family==='graph'&&'file' in look?await productClosureFile(ctx.product,look.file):undefined;
    if(look?.family!=='graph'||'preset' in look||materialGraphIr(look,()=>bytes).params?.['moor']?.type!=='vec2'||!hasLentLook(moor.look))throw new Error('Mooring requires its declared lent vec2 look');
    moors.set(row.id,[0,0]);looks.set(moor.look,lentLooksOf(moor.look));
  }
  const current=():void=>{
    live();
    for(const [id,look] of looks)if(!hasLentLook(id)||lentLooksOf(id)!==look)throw new Error('Mover look owner changed during admission');
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
    const moor=row.moor,lift=moors.get(row.id);
    views.set(row.id,{pose:pose=>{
      if(row.visibility==='enabled')group.visible=pose.enabled;
      group.position.set(pose.position.x,pose.position.y,pose.position.z);
      group.rotation.set(pose.euler.x,pose.euler.y,pose.euler.z,row.order??'YXZ');
      if(moor!==undefined&&lift!==undefined){
        const heave=pose.position.y-moor.water,pitch=Math.sin(pose.euler.x);
        lift[0]=heave-moor.cleats[0]*pitch;lift[1]=heave-moor.cleats[1]*pitch;
        setLentParam(moor.look,'moor',lift);
      }
    }});
  }
  current();installed.add(scope);scope.onDispose(()=>{installed.delete(scope);});
  for(const row of rows.bindings)if(row.kind==='object')scope.expose(entryOwner(scope,'object',row.owner).userData,'declaredMotion',true);
  const index=outputDescriptor(ctx.product.shardfile)?.index;
  const result=await pageSim.installDeclaredMovers(ctx,world,{data,modules:new Map(),views,systemId:rows.system,read:async hash=>{
    current();const file=index?.files.find(row=>row.hash===hash);
    if(file?.name===undefined)throw new Error('Mover module requires its admitted logical file');
    const bytes=await ctx.product.file(file.name);current();return bytes;
  }});
  current();return result;
}
