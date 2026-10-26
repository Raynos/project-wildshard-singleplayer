// @vitest-environment happy-dom
import { lendNalatiHeld } from './fixtures/nalati-return-modules';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { PackBrain } from '../src/engine/ai/pack';
import type { HerdBrain } from '../src/engine/ai/herd';
import type { Player } from '../src/engine/player/Player';
import type { LevelContext } from '../src/engine/level/context';
import type { HeldSlotKit } from '../src/game/loadout/claims';
import type { PageRidingView } from '../src/game/riding/client';
import { StealthSourcesSchema } from '../src/format/stealth';
import { sampleStealthSources, StealthController, type StealthSourcesOwners, type StealthThreat } from '../src/game/stealth/controller';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import authored from '../src/shards/nalati-grasslands/data/stealth.json' with { type: 'json' };
import { originalHeldMetadata } from './fixtures/nalati-held-original';

const { stealth: generated } = originalHeldMetadata();

const rows=v.parse(StealthSourcesSchema,authored.observations);
function fixture(){
 const actors=Array.from({length:110},(_,i)=>legacyDouble<Animal>({alive:i%7!==0,position:new Vector3(i%13-6,i/3,i%9-4),mem:{aw:i/13,ridden:Number(i%11===0),owned:Number(i%17===0)}}));
 const packs=Array.from({length:100},(_,i)=>legacyDouble<PackBrain<Animal>>({members:actors,awareness:i/7,phase:'shadow'}));
 const herds=Array.from({length:100},()=>legacyDouble<HerdBrain<Animal>>({members:actors}));
 const player=legacyDouble<Player>({position:new Vector3(.123456789012345,0,-.987654321098765)});
 const grass={height:.72,grassStandingAt(x:number,z:number){expect(this).toBe(grass);expect([x,z]).toEqual([player.position.x,player.position.z]);return this.height;}};
 const owners:StealthSourcesOwners={population:{packs,herds},riding:null,kit:null,grass};
 return {actors,packs,herds,player,grass,owners};
}
/** The retired state.ts observation loop, independent of the configurable host. */
function original(player:Player,owners:StealthSourcesOwners){
 const threats:StealthThreat[]=[];
 for(let i=0;i<96;i++){const pack=owners.population?.packs[i];if(pack===undefined)break;for(let j=0;j<96;j++){const actor=pack.members[j];if(actor===undefined)break;if(actor.alive)threats.push({x:actor.position.x,z:actor.position.z,awareness:pack.awareness,alert:.35,hunting:Number(pack.phase==='shadow'||pack.phase==='encircle'||pack.phase==='regroup')});}}
 for(let i=0;i<96;i++){const herd=owners.population?.herds[i];if(herd===undefined)break;for(let j=0;j<96;j++){const actor=herd.members[j];if(actor===undefined)break;if(actor.alive&&(actor.mem['ridden']??0)!==1&&(actor.mem['owned']??0)!==1)threats.push({x:actor.position.x,z:actor.position.z,awareness:actor.mem['aw']??0,alert:.45,hunting:0});}}
 return {grass:owners.grass.grassStandingAt(player.position.x,player.position.z),mounted:owners.riding?.mounted??false,forced:owners.riding!==null&&owners.riding.taming.view.trust!==null,threats:threats.sort((a,b)=>Math.hypot(a.x-player.position.x,a.z-player.position.z)-Math.hypot(b.x-player.position.x,b.z-player.position.z)).slice(0,8)};
}
test('native rosters preserve original bounds, order, ties, missing flags and f64 positions',()=>{
 const f=fixture();
 for(const phase of ['roam','shadow','encircle','regroup','break'] as const){
  for(const pack of f.packs)pack.phase=phase;
  expect(sampleStealthSources(rows,f.player,f.owners)).toEqual(original(f.player,f.owners));
 }
 f.actors[1]?.position.set(.123456789012346,0,-.987654321098764);
 if(f.actors[1]!==undefined)f.actors[1].mem={};
 expect(sampleStealthSources(rows,f.player,f.owners)).toEqual(original(f.player,f.owners));
 expect(sampleStealthSources(rows,f.player,{...f.owners,population:null})).toEqual(original(f.player,{...f.owners,population:null}));
});
test('an unrelated source row changes ordering, limits and native exclusions without code',()=>{
 const f=fixture(),input=v.parse(StealthSourcesSchema,{take:2,sources:[{kind:'herds',groups:1,members:2,alert:.9,exclude:[]}]});
 expect(sampleStealthSources(input,f.player,f.owners).threats).toEqual([{x:-5,z:-3,awareness:1/13,alert:.9,hunting:0}]);
 for(const bad of [{...input,take:9},{...input,sources:[{...input.sources[0],members:97}]},{...input,sources:[{...input.sources[0],exclude:['actor.mem.owned']}]},{...input,read:()=>1}])expect(v.safeParse(StealthSourcesSchema,bad).success).toBe(false);
});
test('mount and taming observations preserve false and zero-valued trust exactly',()=>{
 const f=fixture(),riding=legacyDouble<PageRidingView>({mounted:true,taming:legacyDouble<PageRidingView['taming']>({view:legacyDouble<PageRidingView['taming']['view']>({trust:0})})});
 const owners={...f.owners,riding};
 expect(sampleStealthSources(rows,f.player,owners)).toEqual(original(f.player,owners));
 expect(sampleStealthSources(rows,f.player,owners)).toMatchObject({mounted:true,forced:true});
});
function controllerFixture(){
 const f=fixture(),scope=new Scope('stealth-sources'),systems:Parameters<LevelContext['system']>[0][]=[];
 const ctx=legacyDouble<LevelContext>({scope,app:legacyDouble<LevelContext['app']>({input:legacyDouble<LevelContext['app']['input']>({push:vi.fn<()=>void>()})}),
  hud:legacyDouble<LevelContext['hud']>({disc:()=>document.createElement('button'),widget:vi.fn<()=>void>()}),inputContext:vi.fn<()=>void>(),answer:vi.fn<()=>void>(),system:row=>{systems.push(row);}});
 lendNalatiHeld(scope);
 const controller=new StealthController(ctx,f.player,{...generated,observations:authored.observations});
 const events:string[]=[],update=vi.spyOn(controller,'update').mockImplementation(()=>{events.push('update');});
 const polearm={damageScale:0},kit=legacyDouble<HeldSlotKit>({polearm:id=>{expect(id).toBe('polearm');events.push('melee');return legacyDouble<ReturnType<HeldSlotKit['polearm']>>(polearm);}});
 return {...f,scope,systems,controller,events,update,owners:{...f.owners,kit}};
}
test('the original update slot observes first, renders next and sets melee scale last',()=>{
 const f=controllerFixture();
 try{
  expect(f.systems).toHaveLength(1);expect(f.systems[0]?.phase).toBe('input');
  f.controller.updateSources(.025,12,f.owners);
  expect(f.update).toHaveBeenCalledWith(.025,12,original(f.player,f.owners));
  expect(f.events).toEqual(['update','melee']);
 }finally{f.scope.dispose();}
});
test('retirement before or during sampling refuses before update or weapon publication',()=>{
 const f=controllerFixture();
 f.owners.grass.grassStandingAt=()=>{f.scope.dispose();return 1;};
 expect(()=>f.controller.updateSources(.1,2,f.owners)).toThrow('owner has ended');
 expect(f.events).toEqual([]);
 expect(()=>f.controller.updateSources(.1,3,f.owners)).toThrow('owner has ended');
});
test('a render callback that retires the owner cannot publish a weapon scale',()=>{
 const f=controllerFixture();
 f.update.mockImplementation(()=>{f.scope.dispose();});
 expect(()=>f.controller.updateSources(.1,4,f.owners)).toThrow('owner has ended');
 expect(f.events).toEqual([]);
});

test('herd exclusion reads stop at the first flag and snapshots stay detached',()=>{
 const f=fixture(),actor=f.actors[1];if(actor===undefined)throw new Error('Missing actor');
 const calls:string[]=[];
 actor.mem={get ridden(){calls.push('ridden');return 1;},get owned(){calls.push('owned');return 0;}};
 const input=v.parse(StealthSourcesSchema,{take:2,sources:[{kind:'herds',groups:1,members:2,alert:.9,exclude:['ridden','owned']}]});
 expect(sampleStealthSources(input,f.player,f.owners).threats).toEqual([]);
 expect(calls).toEqual(['ridden']);
 actor.mem={ridden:0,owned:0,aw:.4};
 const first=sampleStealthSources(input,f.player,f.owners);
 actor.position.x+=10;actor.mem['aw']=.8;
 const second=sampleStealthSources(input,f.player,f.owners);
 expect(first.threats[0]?.awareness).toBe(.4);expect(second.threats[0]?.awareness).toBe(.8);
 expect(first.threats[0]).not.toBe(second.threats[0]);
});
