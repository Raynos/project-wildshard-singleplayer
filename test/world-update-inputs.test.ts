import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { wind } from '../src/engine/world/steppeWind';
import type { SystemSpec } from '../src/engine/app/systems';
import type { DeclaredEliteEntry } from '../src/engine/ai/view/eliteEntry';
import type { ShardContext } from '../src/game/plugin/context';
import type { ArenaRoomEncounter } from '../src/game/boss/arenaRoom';
import type { ForestWeatherRig } from '../src/game/weather/forest';
import type { PaintedSky } from '../src/game/looks/keyedSky';
import { WorldUpdatesSchema } from '../src/format/worldUpdates';
import { installWorldUpdates } from '../src/game/shardfile/worldUpdates';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { clientCosmeticFinishes, installClientCosmeticFinishes } from '../src/game/shardfile/clientCosmeticFinishes';
import { publishBoundPersistence } from '../src/game/quest/chapterBindings';
import type { AdventurePersistence } from '../src/game/quest/persistence';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import rows from '../src/shards/nalati-grasslands/data/worldUpdates.json' with { type:'json' };
import { legacyDouble } from './fake/FakeGame';

const frameRows=v.parse(WorldUpdatesSchema,rows.filter(row=>row.kind==='cosmetic-finishes'||row.kind==='audio-scene'));
type World=NonNullable<NonNullable<ShardContext['game']['runtime']>['world']>;
function fixture(weatherReady=true){
 const scope=new Scope('world-inputs'),events=new Events(),emit=vi.spyOn(events,'emit'),systems:SystemSpec[]=[];
 const player=legacyDouble<World['player']>({position:new Vector3(1.123456789012345,2,-3.987654321098765)}),game=legacyDouble<World['game']>({});
 const world=legacyDouble<World>({game,player});
 const ids=['first','second'],cosmetics={skins:ids.map(id=>({id,name:id,slot:'tool',blurb:id,effect:`effect.${id}`,grant:`cosmetic.${id}`})),cards:ids.map(id=>({id,name:id,blurb:id,lockedBlurb:id,icon:'sword'})),paints:[]};
 const shardfile=emptyShardfile({slug:'input-fixture',name:'Inputs',author:'Test',seed:7,revision:1});
 const product=createShardProduct({slug:'input-fixture',revision:1,shardfile,sections:new Map([['held/finishes',{order:[],rows:{},cards:[],extras:{},cosmetics}]]),files:new Map(),read:()=>Promise.reject(new Error('No reads'))});
 const ctx=legacyDouble<ShardContext>({scope,product,app:legacyDouble<ShardContext['app']>({events}),game:legacyDouble<ShardContext['game']>({runtime:legacyDouble<NonNullable<ShardContext['game']['runtime']>>({world})}),system:row=>{systems.push(row);}});
 let sun=.37,phase:PaintedSky['clock']['dayPhase']='night',storm=true,inside=false,engaged=true;
 const clock=legacyDouble<PaintedSky['clock']>({get sunElevation(){return sun;},get dayPhase(){return phase;}});
 const sky=legacyDouble<PaintedSky>({clock}),weather=legacyDouble<ForestWeatherRig>({sky,storm:legacyDouble<NonNullable<ForestWeatherRig['storm']>>({get stormActive(){return storm;}})});
 if(weatherReady)publishEntryOwner(scope,'world-weather','nalati.weather',weather);
 const arena=legacyDouble<ArenaRoomEncounter>({get inside(){return inside;}}),fight=legacyDouble<ArenaRoomEncounter>({get engaged(){return engaged;}});
 const elite=legacyDouble<DeclaredEliteEntry>({skins:new Set(['first','second'])}),arenas=new Map([['arena',arena],['fight',fight]]),elites=new Map([['elites',elite]]);
 publishBoundPersistence(scope,legacyDouble<AdventurePersistence>({cosmetics:{read:()=>({owned:[],worn:{}}),write:()=>true}}));
 installClientCosmeticFinishes(ctx);
 const finishes=clientCosmeticFinishes(ctx),originalOwn=finishes.locker.own.bind(finishes.locker),calls:string[]=[];
 const own=vi.spyOn(finishes.locker,'own').mockImplementation(id=>{calls.push(`own:${id}`);originalOwn(id);});
 const frame=vi.spyOn(finishes,'frame').mockImplementation(owner=>{expect(owner).toBe(ctx);calls.push('frame');});
 return {scope,events,emit,systems,world,player,weather,clock,elite,arenas,elites,calls,own,frame,ctx,finish:()=>{scope.dispose();},
  pose(value:number,day:typeof phase,on:boolean,indoors:boolean,busy:boolean){sun=value;phase=day;storm=on;inside=indoors;engaged=busy;}};
}
test('audio rows retain the exact original event, numeric reads, doubles and system order',()=>{
 const f=fixture();
 try{
  installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites});
  expect(f.systems.map(({id,after,before})=>({id,after,before}))).toEqual(frameRows.map(row=>({id:row.system,after:row.after,before:row.before})));
  const audio=f.systems.find(row=>row.id==='shard.nalati.sound');if(audio===undefined)throw new Error('Missing audio');
  for(const [i,phase]of (['dawn','day','dusk','night'] as const).entries()){
   f.pose(i/7,phase,i%2===0,i%2===1,i%3===0);audio.run(.017,i);
   expect(f.emit).toHaveBeenLastCalledWith('audio.scene-frame',{delta:.017,inputs:{wind:wind.speed,gust:wind.gustAt(f.player.position.x,f.player.position.z),sun:i/7,dark:Number(phase==='dusk'||phase==='night'),storm:Number(i%2===0),inside:Number(i%2===1),engaged:Number(i%3===0)}});
  }
 }finally{f.finish();}
});
test('skin grants retain original initial tick, reset cadence, set order and frame order',()=>{
 const f=fixture();
 try{
  installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites});
  const skins=f.systems.find(row=>row.id==='shard.nalati.skins');if(skins===undefined)throw new Error('Missing skins');
  const original:string[]=[];let since=0;
  for(const dt of [0,.2,.8,2,.1]){
   since-=dt;if(since<=0){since=1;for(const id of f.elite.skins)original.push(`own:${id}`);}original.push('frame');skins.run(dt,0);
  }
  expect(f.calls).toEqual(original);
 }finally{f.finish();}
});
test('missing suffix loans refuse before any system or event publication',()=>{
 const f=fixture();
 try{f.arenas.delete('fight');expect(()=>installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites})).toThrow('Missing audio arena');expect(f.systems).toEqual([]);expect(f.calls).toEqual([]);expect(f.emit).not.toHaveBeenCalled();}finally{f.finish();}
});
test('a replaced native loan refuses before the corresponding effect',()=>{
 const f=fixture();
 try{
  installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites});f.arenas.set('fight',legacyDouble<ArenaRoomEncounter>({engaged:false}));
  expect(()=>f.systems.find(row=>row.id==='shard.nalati.sound')?.run(.1,2)).toThrow('Audio frame owner changed');expect(f.emit).not.toHaveBeenCalled();
  f.elites.set('elites',legacyDouble<DeclaredEliteEntry>({skins:new Set()}));
  expect(()=>f.systems.find(row=>row.id==='shard.nalati.skins')?.run(.1,2)).toThrow('Cosmetic grant owner changed');expect(f.calls).toEqual([]);
 }finally{f.finish();}
});
test('non-finite suffix inputs or retirement during sampling cannot emit a valid prefix',()=>{
 const f=fixture();
 try{
  installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites});f.pose(Number.NaN,'night',false,false,false);
  const audio=f.systems.find(row=>row.id==='shard.nalati.sound');if(audio===undefined)throw new Error('Missing audio');
  expect(()=>audio.run(.1,3)).toThrow('Non-finite audio');expect(f.emit).not.toHaveBeenCalled();
  Object.defineProperty(f.clock,'sunElevation',{get(){f.scope.dispose();return .3;}});
  expect(()=>audio.run(.1,4)).toThrow('owner left');expect(f.emit).not.toHaveBeenCalled();
 }finally{f.finish();}
});
test('a product swap cannot select another cosmetic book on the same live scope',()=>{
 const f=fixture();
 try{
  installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites});
  const original=f.ctx.product,source=emptyShardfile({slug:'other-inputs',name:'Other',author:'Test',seed:7,revision:1});
  const other=createShardProduct({slug:'other-inputs',revision:1,shardfile:source,sections:new Map([['held/finishes',original.section('held/finishes')]]),files:new Map(),read:()=>Promise.reject(new Error('No reads'))});
  Object.defineProperty(f.ctx,'product',{value:other});installClientCosmeticFinishes(f.ctx);
  const second=clientCosmeticFinishes(f.ctx),own=vi.spyOn(second.locker,'own');
  expect(()=>f.systems.find(row=>row.id==='shard.nalati.skins')?.run(.1,2)).toThrow('owner left or changed');
  expect(f.calls).toEqual([]);expect(own).not.toHaveBeenCalled();
 }finally{f.finish();}
});
test('retirement during a grant prevents later grants and painting',()=>{
 const f=fixture();
 try{
  installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites});
  f.own.mockImplementation(()=>{f.scope.dispose();});
  expect(()=>f.systems.find(row=>row.id==='shard.nalati.skins')?.run(.1,2)).toThrow('owner left or changed');
  expect(f.own).toHaveBeenCalledTimes(1);expect(f.frame).not.toHaveBeenCalled();
 }finally{f.finish();}
});
test('rows refuse duplicate input names, reflected sources, callbacks and unbounded cadence',()=>{
 const audio=frameRows.find(row=>row.kind==='audio-scene');if(audio?.kind!=='audio-scene')throw new Error('Missing row');
 for(const bad of [{...audio,inputs:[...audio.inputs,...audio.inputs]},{...audio,inputs:[{name:'x',source:{kind:'arena',owner:'arena',field:'room.inside'}}]},{...audio,read:()=>1},{kind:'cosmetic-finishes',system:'s',before:[],elite:'e',every:0}])expect(v.safeParse(WorldUpdatesSchema,[bad]).success).toBe(false);
});


test('audio registration waits for the same late weather loan before any frame emission',()=>{
 const f=fixture(false);
 try{
  installWorldUpdates(f.ctx,frameRows,{arenas:f.arenas,elites:f.elites});
  const audio=f.systems.find(row=>row.id==='shard.nalati.sound');if(audio===undefined)throw new Error('Missing audio');
  expect(()=>audio.run(.1,1)).toThrow('Missing live entry owner');expect(f.emit).not.toHaveBeenCalled();
  publishEntryOwner(f.scope,'world-weather','nalati.weather',f.weather);
  audio.run(.1,2);expect(f.emit).toHaveBeenCalledOnce();f.emit.mockClear();
  Object.assign(f.weather,{sky:legacyDouble<PaintedSky>({clock:f.clock})});
  expect(()=>audio.run(.1,3)).toThrow('Audio frame owner changed');expect(f.emit).not.toHaveBeenCalled();
 }finally{f.finish();}
});
