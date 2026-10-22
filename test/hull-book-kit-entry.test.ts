import { afterEach, expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { HeldEquipmentSchema } from '../src/format/heldEquipment';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { output as pineOutput } from '../src/shards/pine-hollow/generators/output';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { parseExplorerCatalogue } from '../src/format/explorerCatalogue';
import { SocketRigCreatureSchema } from '../src/format/socketRigCreature';
import { declaredSocketRigCreatures, prepareDeclaredHullBookKit } from '../src/game/models/socketRigCreature';
import { SocketRigCard } from '../src/game/boss/socketRig';
import { HeldEquipment } from '../src/game/plugin/heldEquipment';
import { explorerRoster } from '../src/game/models/explorerCatalogue';
import { admitClientPlan, CLIENT_FEATURES } from '../src/game/shardfile/clientPlan';
import { ANTLER_KING_CARD } from '../src/shards/pine-hollow/generators/kingCard';
import kingLook from '../src/shards/pine-hollow/data/antlerKingLook.json' with {type:'json'};
import type { ShardContext } from '../src/game/plugin/context';
import { legacyDouble } from './fake/FakeGame';

const heldRows = v.parse(HeldEquipmentSchema, outputPlatformPayloads(pineOutput.platform, ['held/equipment']).get('held/equipment'));
let sequence=0;
afterEach(()=>{vi.restoreAllMocks();});
function deferred<T>(){
  let finish=(value:T):void=>{void value;}; const promise=new Promise<T>(resolve=>{finish=resolve;});return {promise,finish};
}
function fixture(entries:unknown[]=[{kind:'socket-creature',rows:ANTLER_KING_CARD,planned:1}],scope=new Scope('hull-book-kit')){
  const source=emptyShardfile({slug:'pine-hollow',name:'Fixture',author:'Fixture',revision:1,seed:1}),events:string[]=[];
  const files=new Map([['combat/roaming.json',{hash:'socket-source',url:'https://fixture.invalid/sockets.json'}]]);
  for (const name of [heldRows.launcher.pool.url, heldRows.hands.pool.url, heldRows.firearm.pool.url]) files.set(name,{hash:name,url:`https://fixture.invalid/${name}`});
  const catalogue=parseExplorerCatalogue({version:1,entries}),sections=new Map<string,unknown>([
    ['explore/catalogue',catalogue],['actors/species-programs',{page:[],spawns:[]}],['held/equipment',heldRows],
    ['look/hull-book',{slug:`fixture-socket-${String(sequence++)}`,definitions:{},derived:{},rows:[]}],
  ]);
  const product=createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,sections,files,read:()=>Promise.reject(new Error('No asset reads in declaration'))});
  const rows=legacyDouble<ShardContext['rows']>({species:()=>{events.push('species');},speciesLook:()=>{events.push('looks');},spawnTable:()=>{events.push('spawns');}});
  const ctx=legacyDouble<ShardContext>({scope,product,rows});
  const held = new HeldEquipment(product), install=vi.spyOn(held,'install').mockImplementation(()=>{events.push('install');});
  return {ctx,scope,product,sections,files,events,held,install,catalogue};
}

test('the declared King card retains the original coat, metadata and specimen identity',async()=>{
  const f=fixture();try{
    const cards=declaredSocketRigCreatures(f.product),card=cards[0];if(card===undefined)throw new Error('Missing King card');
    expect(ANTLER_KING_CARD.coat).toEqual(kingLook.KING_COAT);
    expect(card.model).toMatchObject({id:'pine-hollow/antler-king',name:'The Antler King',category:'creatures',pipeline:['hunyuan','code'],surface:'wood',defaults:{variant:'warden'},rig:{species:'antler-king'}});
    expect(card.model.file).toBe('src/shards/pine-hollow/generators/kingCard.ts');
    expect(declaredSocketRigCreatures(f.product)).toBe(cards);
    const preload=vi.spyOn(SocketRigCard.prototype,'preload').mockResolvedValue(undefined),roster=await explorerRoster(f.product);
    expect(roster).toHaveLength(1);expect(roster[0]?.id).toBe(card.model.id);expect(f.catalogue.entries[0]?.planned).toBe(1);
    expect(preload).not.toHaveBeenCalled();await roster[0]?.prepare?.();expect(preload).toHaveBeenCalledTimes(1);
    const other=fixture();try{expect(declaredSocketRigCreatures(other.product)[0]).not.toBe(card);}finally{other.scope.dispose();}
  }finally{f.scope.dispose();}
});

test('socket card references refuse foreign, missing and duplicate sources before any definition is cached',()=>{
  for(const entries of [
    [{kind:'socket-creature',rows:{...ANTLER_KING_CARD,product:'foreign'}}],
    [{kind:'socket-creature',rows:{...ANTLER_KING_CARD,sockets:'missing.json'}}],
    [{kind:'socket-creature',rows:ANTLER_KING_CARD},{kind:'socket-creature',rows:ANTLER_KING_CARD}],
  ]){const f=fixture(entries);try{expect(()=>declaredSocketRigCreatures(f.product)).toThrow();}finally{f.scope.dispose();}}
  expect(()=>v.parse(SocketRigCreatureSchema,{...ANTLER_KING_CARD,coat:{...ANTLER_KING_CARD.coat,hp:Number.NaN}})).toThrow();
  expect(()=>parseExplorerCatalogue({version:1,entries:[{kind:'socket-creature',rows:ANTLER_KING_CARD,prepare:()=>undefined}]})).toThrow();
});

test('finite kit admission requires its exact cards and precedes the ordinary kit consumers',()=>{
  const f=fixture(),feature={kind:'population.hull-book'} as const;try{
    expect(admitClientPlan({version:1,features:[feature]},f.product).features).toEqual([feature]);
    expect(CLIENT_FEATURES[feature.kind].phase).toBe('kit');expect(CLIENT_FEATURES[feature.kind].rank).toBeLessThan(CLIENT_FEATURES['content.catalogue'].rank);
    expect(()=>admitClientPlan({version:1,features:[feature,{kind:'population.product-creatures'}]},f.product)).toThrow('duplicate');
    f.files.clear();expect(()=>admitClientPlan({version:1,features:[feature]},f.product)).toThrow('socket cards');
  }finally{f.scope.dispose();}
});

test('the actual kit sequence preserves species, looks, spawns, held preparation, socket preload and installation',async()=>{
  const f=fixture();vi.spyOn(HeldEquipment,'prepare').mockImplementation(()=>{f.events.push('held');return Promise.resolve(f.held);});
  vi.spyOn(SocketRigCard.prototype,'preload').mockImplementation(()=>{f.events.push('card');return Promise.resolve();});
  try{await prepareDeclaredHullBookKit(f.ctx);expect(f.events).toEqual(['species','looks','spawns','held','card','install']);expect(f.install.mock.calls[0]?.[0]).toBe(f.ctx);}finally{f.scope.dispose();}
});

test('leave during held preparation prevents socket admission and equipment installation',async()=>{
  const f=fixture(),waiting=deferred<HeldEquipment>(),preload=vi.spyOn(SocketRigCard.prototype,'preload').mockResolvedValue(undefined);
  vi.spyOn(HeldEquipment,'prepare').mockReturnValue(waiting.promise);
  const request=prepareDeclaredHullBookKit(f.ctx),refused=expect(request).rejects.toThrow('owner left');f.scope.dispose();waiting.finish(f.held);await refused;
  expect(preload).not.toHaveBeenCalled();expect(f.install).not.toHaveBeenCalled();
});

test('leave during socket preload installs no held family',async()=>{
  const f=fixture(),waiting=deferred<undefined>(),started=deferred<undefined>();vi.spyOn(HeldEquipment,'prepare').mockResolvedValue(f.held);
  vi.spyOn(SocketRigCard.prototype,'preload').mockImplementation(()=>{started.finish(undefined);return waiting.promise;});
  const request=prepareDeclaredHullBookKit(f.ctx),refused=expect(request).rejects.toThrow('owner left');await started.promise;f.scope.dispose();waiting.finish(undefined);await refused;expect(f.install).not.toHaveBeenCalled();
});

test('an already retiring ancestor refuses before reading the catalogue or preparing any service',async()=>{
  const parent=new Scope('retiring-hull-owner'),scope=parent.child('entry'),f=fixture(undefined,scope),read=vi.spyOn(f.product,'section');parent.onDispose(()=>undefined);
  const retirement=parent.disposeSteps();retirement.next();try{
    expect(scope.disposed).toBe(false);expect(scope.disposing).toBe(true);await expect(prepareDeclaredHullBookKit(f.ctx)).rejects.toThrow('owner left');expect(read).not.toHaveBeenCalled();
  }finally{for(const step of retirement)void step;parent.dispose();}
});
