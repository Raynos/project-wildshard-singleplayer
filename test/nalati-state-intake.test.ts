// @vitest-environment happy-dom
import { expect,test,vi } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import type { ShardWorld } from '../src/game/shard/world';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardContext } from '../src/game/plugin/context';
import type { FixedDraws } from '../src/game/models/fixedDraws';
import { WorldAssembly } from '../src/game/shardfile/worldAssembly';
import { SceneDressing } from '../src/game/shardfile/sceneDressing';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { ReturnProgram } from '../src/game/population/returnProgram';
import * as spawn from '../src/game/population/spawnScript';
import * as room from '../src/game/boss/arenaRoom';
import { parseSpawnScript } from '../src/format/spawnScripts';
import chargeRows from '../src/shards/nalati-grasslands/data/eliteCharge.generated.json' with {type:'json'};
import { readProjectAssets } from '../src/sdk/project';
import { buildNalatiWorld } from '../src/shards/nalati-grasslands/runtime/state';
import { fakeWorld } from './fake/world';
import { legacyDouble } from './fake/FakeGame';
import { nalatiSpeciesCatalogue } from './fake/nalatiSpecies';

// Run the real state function and its independent King intake. Unrelated world
// construction and charge intake keep their own native/product oracles.
test('the shipped King intake retains its attack owner before weather is published',async()=>{
  const emitted=await readProjectAssets('src/shards/nalati-grasslands');
  const files=new Map((emitted.output.namedFiles??[]).flatMap(file=>file.name===undefined?[]:[[file.name,{...file,url:file.path}] as const]));
  const product=createShardProduct({slug:emitted.shard.identity.slug,revision:emitted.shard.identity.revision,shardfile:emitted.shard,sections:new Map(),files,
    read:hash=>{const bytes=emitted.assets.get(hash);if(bytes===undefined)throw new Error('Missing shipped named bytes');return Promise.resolve(bytes);}});
  const fight=v.parse(v.object({programs:v.record(v.string(),v.unknown())}),await product.json('combat/titan-fight.json'));
  expect(Object.keys(fight.programs)).toStrictEqual(['attack','wind']);
  const scope=new Scope('state-intake'),f=fakeWorld(),game=Object.assign(f.game.asGame(),{levelScope:scope});
  const world=legacyDouble<ShardWorld>({game,sky:f.sky,player:f.player,forest:f.forest}),runtime=legacyDouble<ShardRuntime>({world});
  const plugin=legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({runtime})});
  publishEntryOwner(scope,'arena-room','nalati.titan',legacyDouble<ArenaRoomEncounter>({}));
  publishEntryOwner(scope,'drawn-models','nalati.trophies',new Map());
  const stop=new Error('King intake reached');let selected:ReturnProgram|undefined;
  const draws:FixedDraws={ready:true,load:()=>Promise.resolve(),handle:()=>{throw new Error('Unrelated geometry intake');}};
  const prepare=vi.spyOn(WorldAssembly,'prepareNative').mockResolvedValue(draws);
  const construct=vi.spyOn(WorldAssembly,'construct').mockResolvedValue({});
  const dressing=vi.spyOn(SceneDressing,'current').mockReturnValue(legacyDouble<SceneDressing>({pieces:new Map()}));
  const charge=vi.spyOn(spawn,'readSpawnScript').mockResolvedValue(parseSpawnScript(chargeRows));
  const king=vi.spyOn(room,'buildArenaRoomEncounter').mockImplementation((_ctx,_rows,input)=>{
    const row=v.parse(v.object({program:v.unknown()}),input);selected=ReturnProgram.page(row.program,scope);throw stop;
  });
  try{
    await expect(buildNalatiWorld(world,plugin,nalatiSpeciesCatalogue())).rejects.toBe(stop);
    expect(king).toHaveBeenCalledTimes(1);
    expect(selected).toBe(ReturnProgram.page(fight.programs['attack'],scope));
  }finally{king.mockRestore();charge.mockRestore();dressing.mockRestore();construct.mockRestore();prepare.mockRestore();scope.dispose();}
});

type ArenaRoomEncounter=room.ArenaRoomEncounter;
