import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { ForestWeatherSchema } from '../src/format/forestWeather';
import {parseHeldSlots} from '../src/format/heldArms';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare emitted slot metadata with its exact generated authoring input.
import {readFileSync} from 'node:fs';
import { NALATI_WEATHER_PAGE } from '../src/shards/nalati-grasslands/generators/weatherPage';
// @vitest-environment node
import { expect,test,vi } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import {WorldAssemblySchema} from '../src/format/worldAssembly';
import {parseClientPlan} from '../src/format/clientPlan';
import {installClientWorldAssembly} from '../src/game/shardfile/clientWorldAssembly';
import type {StepRunner} from '../src/engine/boot/plan';
import {Vector3} from 'three';
import type {Physics} from '../src/engine/physics/Physics';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardContext } from '../src/game/plugin/context';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import { WorldAssembly } from '../src/game/shardfile/worldAssembly';
import { SceneDressing } from '../src/game/shardfile/sceneDressing';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { nodeNamedJsonCheck } from '../src/game/shardfile/outputChecksNode';
import { ReturnProgram } from '../src/game/population/returnProgram';
import {ReturnModulesSchema} from '../src/format/scriptContract';
import * as room from '../src/game/boss/arenaRoom';
import { readProjectAssets } from '../src/sdk/project';
import { fakeWorld } from '@wildshard/engine/test/world';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';

// Run the shipped world feature and its real King stage. Unrelated prefix
// resources retain their separate native/product construction oracles.
// Prepare the complete live source product in its real Node build realm.
// AssemblyScript loads its parser WASM through native streaming; a DOM
// Response is not a Node Response. This King intake stops before UI creation.
// Compiler/native setup failures still refuse collection before the unchanged
// timed assertions.
const nalatiEnvelope=await readProjectAssets('src/shards/nalati-grasslands', undefined, { folder: 'nalati-grasslands', imageRoots: [
    { prefix: '/src/shards/nalati-grasslands/', directory: 'src/shards/nalati-grasslands' },
    { prefix: '/assets/', directory: 'public/assets' },
  ] });

test('the shipped world assembly King intake retains its attack owner before weather is published',async()=>{
  const emitted=nalatiEnvelope;
  const files=new Map((emitted.output.namedFiles??[]).flatMap(file=>file.name===undefined?[]:[[file.name,{...file,url:file.path}] as const]));
  const product=createShardProduct({slug:emitted.shard.identity.slug,revision:emitted.shard.identity.revision,shardfile:emitted.shard,sections:outputPlatformPayloads(emitted.output.platform,['client/plan','actors/return-scripts']),files,
    jsonCheck:nodeNamedJsonCheck,
    read:hash=>{const bytes=emitted.assets.get(hash);if(bytes===undefined)throw new Error('Missing shipped named bytes');return Promise.resolve(bytes);}});
  const plan=parseClientPlan(product.section('client/plan'));
  const assembly=plan.features.find(row=>row.kind==='world.assembly');
  if(assembly?.native===undefined)throw new Error('Missing native assembly feature');
  expect(plan.features.filter(row=>row.kind==='weather.forest')).toEqual([{kind:'weather.forest',file:'world/forest-weather.json',owner:'nalati.weather',hud:true}]);
  expect(await product.json('world/forest-weather.json')).toEqual(v.parse(ForestWeatherSchema,NALATI_WEATHER_PAGE));
  const slotRows:unknown=JSON.parse(readFileSync('src/shards/nalati-grasslands/boot/mountedLoadout.json','utf8'));
  expect(parseHeldSlots(await product.json('held/slots.json'))).toEqual(parseHeldSlots(slotRows));
  const fight=v.parse(v.object({programs:v.record(v.string(),v.unknown())}),await product.json('combat/titan-fight.json'));
  expect(Object.keys(fight.programs)).toStrictEqual(['attack','wind']);
  const scope=new Scope('state-intake'),f=fakeWorld(),game=Object.assign(f.game.asGame(),{levelScope:scope,tier:'desktop' as const});
  const steps:string[]=[],step:StepRunner=(key,work)=>{steps.push(key);return Promise.resolve(work({set:()=>undefined,detail:()=>undefined}));};
  const world=legacyDouble<ShardWorld>({game,sky:f.sky,player:f.player,forest:f.forest,registry:f.registry,physics:legacyDouble<Physics>({})}),runtime=legacyDouble<ShardRuntime>({world,step,viewer:()=>new Vector3()});
  const plugin=legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({runtime})});
  ReturnProgram.lendModules(scope,emitted.assets,v.parse(ReturnModulesSchema,product.section('actors/return-scripts')));
  publishEntryOwner(scope,'arena-room','nalati.titan',legacyDouble<ArenaRoomEncounter>({}));
  publishEntryOwner(scope,'drawn-models','nalati.trophies',new Map());
  const stop=new Error('King intake reached');let selected:ReturnProgram|undefined;
  const draws:FixedDraws={ready:true,load:()=>Promise.resolve(),handle:()=>{throw new Error('Unrelated geometry intake');}};
  const prepare=vi.spyOn(WorldAssembly,'prepareNative').mockResolvedValue(draws);
  const realConstruct=WorldAssembly.construct.bind(WorldAssembly);
  const construct=vi.spyOn(WorldAssembly,'construct').mockImplementation((input,ports)=>realConstruct({stages:v.parse(WorldAssemblySchema,input).stages.filter(stage=>stage.kind==='arena-room'&&'mode' in stage)},ports));
  const dressing=vi.spyOn(SceneDressing,'current').mockReturnValue(legacyDouble<SceneDressing>({pieces:new Map()}));
  const king=vi.spyOn(room,'buildArenaRoomEncounter').mockImplementation((_ctx,_rows,input)=>{
    const row=v.parse(v.object({program:v.unknown()}),input);selected=ReturnProgram.page(row.program,scope);throw stop;
  });
  try{
    await expect(installClientWorldAssembly(plugin,assembly)).rejects.toBe(stop);
    expect(steps).toEqual(['cabins','props']);
    expect(king).toHaveBeenCalledTimes(1);
    expect(selected).toBe(ReturnProgram.page(fight.programs['attack'],scope));
  }finally{king.mockRestore();dressing.mockRestore();construct.mockRestore();prepare.mockRestore();scope.dispose();}
});

type ArenaRoomEncounter=room.ArenaRoomEncounter;
