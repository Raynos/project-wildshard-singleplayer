import {lendNalatiPasture} from './fixtures/nalati-return-modules';
// @vitest-environment happy-dom
import {expect,test,vi} from 'vitest';
import {MeshBasicMaterial,Vector3,Group} from 'three';
import {app} from '../src/engine/app/runtime';
import {Scope} from '../src/engine/app/scope';
import type {BossScript} from '../src/engine/ai/BossBrain';
import {ArenaRoomEncounter} from '../src/game/boss/arenaRoom';
import {OriginalOpenArenaEncounter} from './fake/originalOpenArena';
import * as bossHost from '../src/game/Boss';
import * as persistence from '../src/game/quest/chapterBindings';
import type {ShardContext} from '../src/game/plugin/context';
import type {HeldClaims,HeldSlotKit} from '../src/game/loadout/claims';
import type {CosmeticFinishLocker} from '../src/game/loadout/cosmeticFinishes';
import {lendLooks} from '../src/game/shardfile/lentLooks';
import {Mount} from '../src/game/riding/mount';
import {parseArenaScriptData} from '../src/format/arenaScriptRows';
import type {ModelDef} from '../src/engine/models/model';
import type {BossBar} from '../src/engine/ui/BossBar';
import {manager} from './fake/manager';
import {legacyDouble} from './fake/FakeGame';
import {overrideTerrain} from './fake/terrain';
import {mockCanvas} from './fake/weaponParity';
import fireView from '../src/shards/nalati-grasslands/data/arenaFire.json' with {type:'json'};
import titan from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with {type:'json'};
import geometry from '../src/shards/nalati-grasslands/data/stormTitanGeometry.generated.json' with {type:'json'};
import {titanPrograms as programs} from './fixtures/titanInlineWitness';

function run(original:boolean):{trace:unknown[];input:unknown[];ownerScope:boolean;onePrompt:boolean}{
  mockCanvas();
  const construction=new Scope('open-arena.construction'),entered=construction.child('entered'),trace:unknown[]=[],input:unknown[]=[];
  const restore=overrideTerrain({heightAt:()=>0,normalAt:()=>[0,1,0],waterLevel:()=>-100});
  lendNalatiPasture(construction);
  const f=manager(),game=Object.assign(f.game.asGame(),{app,levelScope:construction,sky:f.sky});
  const materials=new Map(['nalati-titan-cloud','nalati-titan-flame','nalati-titan-smoke'].map(id=>[id,new MeshBasicMaterial()]));
  lendLooks(construction,{materials,setParam:()=>undefined,setTexture:()=>undefined,bindMeshMap:()=>{throw new Error('Unexpected mapped material');}});
  const data=parseArenaScriptData({arenaScript:titan.TITAN_HOST,arenaFire:fireView,programs:{attack:programs.attack,wind:programs.wind}},geometry);
  type Runtime=NonNullable<ShardContext['game']['runtime']>;type Play=NonNullable<Runtime['play']>;type World=NonNullable<Runtime['world']>;
  const world=legacyDouble<World>({game,sky:f.sky,player:f.player}),play=legacyDouble<Play>({animals:f.manager,
    weapons:legacyDouble<Play['weapons']>({setEnabled:value=>{input.push(['weapons',value]);}}),
    hud:legacyDouble<Play['hud']>({toast:value=>{trace.push(['toast',value]);},killFeed:value=>{trace.push(['feed',value]);}}),
    music:legacyDouble<Play['music']>({sting:value=>{trace.push(['sting',value]);},combat:value=>{trace.push(['combat',value]);}}),audio:legacyDouble<Play['audio']>({pickupHum:value=>{trace.push(['hum',value]);}})});
  const runtime=legacyDouble<Runtime>({world,play,interactables:[]});
  const ctx=legacyDouble<ShardContext>({scope:entered,app,game:legacyDouble<ShardContext['game']>({runtime}),
    product:legacyDouble<ShardContext['product']>({slug:'open-arena'}),debug:legacyDouble<ShardContext['debug']>({expose:()=>{trace.push('expose');}})});
  const checkpoint=vi.fn<NonNullable<typeof app.player>['checkpoint']>();
  entered.expose(app,'player',legacyDouble<NonNullable<typeof app.player>>({checkpoint}));
  const save=legacyDouble<ReturnType<typeof persistence.enteredAdventurePersistence>>({bosses:legacyDouble<ReturnType<typeof persistence.enteredAdventurePersistence>['bosses']>({})});
  const saved=vi.spyOn(persistence,'enteredAdventurePersistence').mockImplementation(scope=>{expect(scope).toBe(entered);trace.push('saved');return save;});
  new Mount(legacyDouble<ConstructorParameters<typeof Mount>[0]>({scope:entered,app}),f.player,f.manager,{speeds:{walk:1.8,trot:4.5,canter:8.5,gallop:13},names:{},thrownDamage:7,thrownLabel:'Thrown',restAt:{x:3,z:5}});
  let movement=1;Object.defineProperty(f.player,'moveScale',{configurable:true,get:()=>movement,set:(value:number)=>{movement=value;input.push(['move',value]);}});
  class Power {constructor(){trace.push('power');}update(dt:number,t:number):void{trace.push(['power.update',dt,t]);}}
  const power=legacyDouble<HeldClaims>({blade:()=>legacyDouble<ReturnType<HeldClaims['blade']>>({Power:legacyDouble<ReturnType<HeldClaims['blade']>['Power']>(Power)})});
  const kit=legacyDouble<HeldSlotKit>({upgradeBlade:(slot,_weapons,source)=>{expect(source).toBeInstanceOf(Power);trace.push(['upgrade',slot]);},refill:()=>{trace.push('refill');}});
  const locker=legacyDouble<CosmeticFinishLocker>({own:id=>{trace.push(['own',id]);}});
  const reward:ModelDef<object>={id:'open.reward',name:'open reward',category:'gear',pipeline:'code',file:'fixture',defaults:{},build:()=>{trace.push('reward.model');return new Group();}};
  let ports:bossHost.BossEncounterPorts<BossScript>|undefined;
  const install=vi.spyOn(bossHost,'installBossEncounter').mockImplementation((_rows,makeScript,borrowed)=>{
    ports=borrowed;trace.push('install');
    return {fight:makeScript(),boss:legacyDouble<bossHost.Boss>({rewardTaken:true,state:'dormant',engaged:false,update:(dt,t)=>{trace.push(['boss.update',dt,t]);}}),ui:legacyDouble<BossBar>({}),update:()=>undefined,onPlayerDeath:()=>false};
  });
  const owners={game,player:f.player};
  // These are the same concrete owners for the original and shared constructors.
  const weather=legacyDouble<ConstructorParameters<typeof OriginalOpenArenaEncounter>[0]['weather']>({flash:0,raise:()=>undefined,stormActive:true});
  const air=legacyDouble<ConstructorParameters<typeof OriginalOpenArenaEncounter>[0]['air']>({});
  try{
    const owner=original?new OriginalOpenArenaEncounter({...owners,weather,air,tieSpot:new Vector3()},data):new ArenaRoomEncounter({kind:'open',world:{...owners,weather,air,tieSpot:new Vector3()},rows:data});
    if(owner instanceof ArenaRoomEncounter)owner.bind(ctx,kit,reward,{arsenal:power,locker});else owner.bind(ctx,kit,power,reward,locker);
    if(ports===undefined)throw new Error('Missing native encounter ports');
    expect(checkpoint.mock.calls[0]?.[0]).toBe(entered);
    ports.lockInput(true);ports.lockInput(false);ports.reward.model();ports.reward.grant();ports.music?.('victory');
    owner.update(.016,3);
    return {trace,input,ownerScope:ports.scope===entered,onePrompt:runtime.interactables.length===1};
  }finally{install.mockRestore();saved.mockRestore();construction.dispose();restore();for(const material of materials.values())material.dispose();}
}

test('shared open lifecycle preserves original native owners, input barrier and reward order',()=>{
  const before=run(true),after=run(false);expect(after).toStrictEqual(before);
  expect(after.input).toStrictEqual([['weapons',false],['move',0],['weapons',true],['move',1]]);
  expect(after.ownerScope).toBe(true);expect(after.onePrompt).toBe(true);
});
