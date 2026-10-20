// @vitest-environment happy-dom
import { expect,test,vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState } from '../src/engine/quest/core';
import { Owned } from '../src/game/loot/Owned';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { installClientFinds } from '../src/game/shardfile/clientFinds';
import { parseClientPlan } from '../src/format/clientPlan';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardProduct } from '../src/game/shardfile/shardProduct';
import { legacyDouble } from './fake/FakeGame';

test('orchard finds render the native quest flags without authored view/read hooks',async()=>{
  const scope=new Scope('orchard.finds'),flags=new Flags('orchard.finds'),fragment=vi.fn<ShardContext['bag']['fragment']>();
  const rows={counters:[{label:'Seeds',flags:['orchard.apple']}],sections:[{title:'Harvest',items:[{label:'Apple',icon:'pin',flag:'orchard.apple'}]}]};
  const quest=new QuestState({id:'orchard.quest',title:'Seeds',completeFlag:'orchard.done',steps:[{id:'pick',objective:'Pick',done:{all:['orchard.apple']}}]},flags,undefined,scope);
  publishBoundQuest(scope,quest);
  const runtime=legacyDouble<ShardRuntime>({play:legacyDouble<NonNullable<ShardRuntime['play']>>({owned:new Owned('orchard')}),hooks:{}}),product=legacyDouble<ShardProduct>({json:vi.fn<ShardProduct['json']>().mockResolvedValue(rows)});
  const ctx=legacyDouble<ShardContext>({scope,product,game:legacyDouble<ShardContext['game']>({runtime}),bag:legacyDouble<ShardContext['bag']>({fragment})}),feature={kind:'bag.finds',id:'orchard.finds',quest:'orchard.quest',file:'quests/finds.json'};
  try{
    const row=parseClientPlan({version:1,features:[feature]}).features[0];if(row===undefined)throw new Error('Missing finds feature');
    await installClientFinds(ctx,row);const view=fragment.mock.calls[0]?.[1];if(view===undefined)throw new Error('Missing native fragment');
    const panel=document.createElement('div');view.render(panel);expect(panel.querySelectorAll('.found')).toHaveLength(0);
    flags.set('orchard.apple');view.render(panel);expect(panel.querySelectorAll('.found')).toHaveLength(1);expect(panel.textContent).toContain('Apple');
    expect(runtime.hooks.questFlags?.()).toContain('orchard.apple');
    expect(()=>parseClientPlan({version:1,features:[{...feature,render:()=>undefined}]})).toThrow();
  }finally{scope.dispose();}
});
