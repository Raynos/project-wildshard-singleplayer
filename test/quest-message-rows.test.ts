// @vitest-environment happy-dom
import {expect,test} from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { publishBoundQuest } from '../src/game/quest/boundState';
import { installQuestChapter, installQuestFlags, type QuestChapterContext } from '../src/game/quest/chapter';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { PAGE_STORY as pineStory } from '../src/shards/pine-hollow/generators/pageStory';
import { PAGE_STORY as driftwoodStory } from '../src/shards/driftwood-isle/generators/pageStory';
import { PINE_QUESTS } from '../src/shards/pine-hollow/generators/quests';
import { DRIFTWOOD_QUESTS } from '../src/shards/driftwood-isle/generators/quests';
import { completionRows } from '../src/shards/driftwood-isle/generators/completion';
import type { MapQuest } from '../src/engine/ui/Map';
import {QuestState,questMessageHandlers} from '../src/engine/quest/core';
import {Flags} from '../src/engine/world/interact/flags';
import {QUEST_PRESENTATION as pine} from '../src/shards/pine-hollow/generators/questPresentation';
import {QUEST_PRESENTATION as driftwood} from '../src/shards/driftwood-isle/generators/questPresentation';

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

for (const [story, definitions] of [[pineStory, PINE_QUESTS], [driftwoodStory, DRIFTWOOD_QUESTS]] as const) {
  test(`${story.quest.id}: data-only chapter borrows its old flags, marker and notice owners`, () => {
    const scope = new Scope('chapter-services'), flags = new Flags('chapter-services', false);
    const def = definitions.quests[0]; if (def === undefined) throw new Error('Missing real quest');
    // An existing mid-quest save enters quietly; the next actual flag transition still emits once.
    const initial = new Set(def.startWhen?.all);
    for (const flag of def.steps[0]?.done.all ?? []) initial.add(flag);
    flags.restore([...initial]);
    const quest = new QuestState(def, flags), before = flags.all;
    publishBoundQuest(scope, quest);
    const source = { ...emptyShardfile({ slug: 'chapter-services', name: 'Chapter services', author: 'Wildshard', revision: 1, seed: 1 }), quests: definitions };
    const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source,
      sections: new Map([['ui/completion', completionRows()]]), files: new Map(), read: () => Promise.reject(new Error('No asset read')) });
    const log: string[] = [], map: { read: (() => MapQuest | null) | null } = { read: null };
    const player = { position: new Vector3(), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
    const ctx: QuestChapterContext = { app: new App(), scope, product, game: { runtime: { world: { player }, play: {
      hud: { toast: text => { log.push(text); } }, music: { sting: () => { log.push('sting'); } },
      fullMap: { setQuest: read => { map.read = read; } },
    } } } };
    try {
      expect(installQuestFlags(ctx, story.quest.id, flags.level)).toBe(flags);
      expect(() => installQuestFlags(ctx, story.quest.id, 'other-level')).toThrow('differs');
      expect(() => installQuestFlags(ctx, 'unbound', flags.level)).toThrow('declared quest');
      const next = quest.current;
      const completion = story.quest.id === driftwoodStory.quest.id;
      const chapter = scope.run(() => installQuestChapter(ctx, story, completion ? { completion: true, remainingLabel: 'Still to find' } : {}));
      expect(chapter.quest).toBe(quest); expect(flags.all).toEqual(before); expect(log).toEqual([]);
      const places = chapter.discover([{ id: 'road', label: 'Road', x: 999, z: 999, r: 2 }]);
      expect(chapter.places).toBe(places); expect(places.points[0]?.id).toBe('road');
      expect(() => chapter.discover([])).toThrow('already installed');
      expect(map.read?.()?.objective).toBe(quest.objective());
      expect(chapter.markers().map(row => row.id)).toEqual(quest.markers().map(row => row.id));
      if (next === null) throw new Error('Expected a mid-quest step');
      for (const flag of next.done.all ?? []) flags.set(flag);
      expect(log).toEqual([`Objective · ${quest.objective()}`, 'sting']);
      const stable = [...log]; for (const flag of next.done.all ?? []) flags.set(flag);
      expect(log).toEqual(stable);
      expect(() => installQuestChapter(ctx, story, { calls: {} })).toThrow();
      expect(() => installQuestChapter(ctx, { ...story, quest: { ...story.quest, id: 'unbound' } })).toThrow('not bound');
      expect(() => installQuestChapter(ctx, story, { placements: {} })).toThrow('marker placement');
      if (completion) {
        for (const step of def.steps) for (const flag of step.done.all ?? []) flags.set(flag);
        expect(quest.isComplete).toBe(true);
        chapter.chip.update(2, player);
        expect(chapter.objective.root.textContent).toContain('Still to find');
        expect(chapter.markers()).toEqual([]); // Discovery keeps quest markers; only the chip projects remaining finds.
        expect(map.read?.()?.hint).toBe('');
      }
    } finally { scope.dispose(); quest.dispose(); }
    expect(() => installQuestChapter(ctx, story)).toThrow('not bound');
  });
}
