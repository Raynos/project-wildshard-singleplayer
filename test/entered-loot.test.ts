import {expect,test,vi} from 'vitest';
import {Scope} from '../src/engine/app/scope';
import {Flags} from '../src/engine/world/interact/flags';
import {Owned} from '../src/game/loot/Owned';
import {Purse} from '../src/game/loot/Purse';
import {enteredLootPresentation} from '../src/game/loot/runtime';
import type {ShardContext} from '../src/game/plugin/context';
import type {ShardRuntime} from '../src/game/shard/runtime';
import {createShardProduct} from '../src/game/shardfile/shardProduct';
import {emptyShardfile} from '../src/sdk/author';
import {legacyDouble} from './fake/FakeGame';
import {INK_ROWS as INK} from '../src/shards/ink-cel-valley/data/rows';
import {parseRows} from '../src/format/rows';
import {parseLootEconomy} from '../src/format/lootEconomy';
import {declaredLootEconomy} from '../src/game/shard/declaredRows';
import {fixtureLootPresentation} from './fixtures/loot-page';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with {type:'json'};

test('the real ink coin-only page uses the same entered row API without rich Bag owners',()=>{
 const scope=new Scope('ink.loot'),cue=vi.fn(),rows=parseRows(INK),row=rows.loot[0];if(row===undefined||!('gear'in row))throw new Error('Missing shipping Ink loot');
 const product=createShardProduct({slug:'ink-cel-valley',revision:1,shardfile:{...emptyShardfile({slug:'ink-cel-valley',name:'Ink Cel Valley',author:'Fixture',revision:1,seed:1}),rows},sections:new Map([['economy/loot',{rows:{loot:rows.loot}}]]),files:new Map(),read:()=>Promise.reject(new Error('Unexpected loot file read')),check:true});
 const play=legacyDouble<NonNullable<ShardRuntime['play']>>({cues:legacyDouble<NonNullable<ShardRuntime['play']>['cues']>({cue})});
 const ctx=legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({runtime:legacyDouble<ShardRuntime>({play})})});
 try{const view=enteredLootPresentation(ctx,row.id),purse=new Purse('ink-cel-valley',{read:()=>17,write:()=>true});
  expect(view.gear(purse)).toEqual({coins:17});expect(view.finds).toBeNull();expect(view.marks).toBeNull();expect(view.charted()).toBe(row.charted);
  view.chime();expect(cue).toHaveBeenCalledWith(row.chime);
 }finally{scope.dispose();}
});

test('shipping cosmetic rows keep labels, order and live ownership and wear state',async()=>{
 const scope=new Scope('loot.cosmetics'),owned=new Owned('driftwood-isle'),flags=new Flags('driftwood-isle',false),economy=declaredLootEconomy(parseRows({strikes:[],weather:[],days:[],species:[],looks:[],compendiums:[],loot:[LOOT]}).loot);
 try{const view=await fixtureLootPresentation({scope,economy,owned,adventure:{flags},health:{attributes:{maxHealth:100}},audio:{voices:{play:()=>undefined}}}),purse=new Purse('driftwood-isle',{read:()=>0,write:()=>true});
  expect(view.lateKinds).toEqual(['sailor','captain']);expect(view.gear(purse).cosmetics?.map(({id,name,icon,how})=>({id,name,icon,how}))).toEqual([
   {id:'captain-hat',name:"Captain's hat",icon:'hat',how:'The Drowned Captain'},
   {id:'cape',name:'Sailcloth cape',icon:'cape',how:"Maren's counter"},
  ]);
  expect(view.charted()).toBe(false);owned.grant('sea-chart');expect(view.charted()).toBe(true);
  owned.grant('cape');owned.wear('cape');expect(view.gear(purse).cosmetics?.find(row=>row.id==='cape')).toMatchObject({owned:true,worn:true});
  owned.takeOff('cape');expect(view.gear(purse).cosmetics?.find(row=>row.id==='cape')).toMatchObject({owned:true,worn:false});
 }finally{scope.dispose();}
});

test('loot projection admission rejects executable fields, invalid sound and unbounded gain',()=>{
 const view=parseLootEconomy(LOOT.economy).presentation;
 for(const presentation of [{...view,read:()=>0},{...view,chime:{sound:'not-a-sound',gain:.55}},{...view,chime:{sound:'chime',gain:Infinity}}])expect(()=>parseLootEconomy({...LOOT.economy,presentation})).toThrow();
});
