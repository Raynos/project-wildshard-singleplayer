import {expect,test} from 'vitest';
import {QuestState,questMessageHandlers} from '../src/engine/quest/core';
import {Flags} from '../src/engine/world/interact/flags';
import {QUEST_PRESENTATION as pine} from '../src/shards/pine-hollow/data/questPresentation';
import {QUEST_PRESENTATION as driftwood} from '../src/shards/driftwood-isle/data/questPresentation';

test('authored quest notices preserve text and toast/sting/beat order without touching saved flags',()=>{
  for(const rows of [pine,driftwood]){
    const flags=new Flags('quest-message-test',false),quest=new QuestState({id:'chapter',title:'The chapter',completeFlag:'done',
      startWhen:{all:['started']},steps:[{id:rows.messages.firstStep,objective:'Find the lantern',done:{all:['lit']}},
        {id:'dawn',objective:'Watch the sunrise',done:{all:['sunrise']}}]},flags);
    const events:string[]=[],handlers=questMessageHandlers(quest,rows.messages,{toast:text=>{events.push(text);},sting:()=>{events.push('sting');},
      afterStep:step=>{if(step?.id==='dawn')events.push('dawn');}});
    const off=quest.observe(handlers);
    flags.set('started');expect(events).toEqual(['New quest · The chapter','sting']);
    events.length=0;flags.set('lit');expect(events).toEqual(['Objective · Watch the sunrise','sting','dawn']);
    events.length=0;flags.set('sunrise');expect(events).toEqual(['Quest complete · The chapter','sting']);
    events.length=0;flags.set('unrelated');expect(events).toEqual([]);
    const before=flags.all;
    expect(()=>questMessageHandlers(quest,{...rows.messages,firstStep:'foreign'},{toast:()=>{throw new Error('effect');},sting:()=>{throw new Error('effect');}})).toThrow();
    expect(()=>questMessageHandlers(quest,{...rows.messages,objective:'x'.repeat(8193)},{toast:()=>{throw new Error('effect');},sting:()=>{throw new Error('effect');}})).toThrow();
    expect(flags.all).toEqual(before);off();quest.dispose();
    const loaded=new Flags('loaded-quest-message',false);loaded.restore(before);
    const restored=new QuestState({id:'chapter',title:'The chapter',completeFlag:'done',startWhen:{all:['started']},
      steps:[{id:rows.messages.firstStep,objective:'Find the lantern',done:{all:['lit']}},{id:'dawn',objective:'Watch the sunrise',done:{all:['sunrise']}}]},loaded);
    restored.observe(questMessageHandlers(restored,rows.messages,{toast:text=>{events.push(text);},sting:()=>{events.push('sting');}}));
    expect(restored.isComplete).toBe(true);expect(events).toEqual([]);restored.dispose();
  }
});
