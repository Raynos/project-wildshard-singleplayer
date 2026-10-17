// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestLine } from '../src/engine/quest/core';
import type { MapQuest } from '../src/engine/ui/Map';
import { shardContext } from '../src/game/plugin/context';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { bindStoryChapters, presentChapterStory, presentQuestStory } from '../src/game/quest/story';
import { parseChapterStoryPresentation } from '../src/format/questStory';
import { parseQuestData } from '../src/format/quests';
import content from '../src/shards/nalati-grasslands/data/questContent.json' with { type: 'json' };
import policy from '../src/shards/nalati-grasslands/data/chapterStory.json' with { type: 'json' };
import nalati from '../src/shards/nalati-grasslands/shard.config';
import drift from '../src/shards/driftwood-isle/shard.config';
import { MANIFEST } from '../src/shards/_template/discovery.generated';
import { PAGE_STORY } from '../src/shards/driftwood-isle/generators/pageStory';

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

test('Nalati and Driftwood bind the same ordered states and replay completion facts once per bind', () => {
  for (const source of [nalati, drift]) {
    const scope = new Scope(`chapter-bind-${source.identity.slug}`), flags = new Flags(source.identity.slug, false);
    const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(),
      read: () => Promise.reject(new Error('No file needed for quest binding')) });
    const facts: string[] = [];
    try {
      const ids = source.quests.quests.map(q => q.id);
      const line = bindStoryChapters({ app: new App(), scope, product }, source, ids, { flags, facts: Object.assign((fact: string, entity: string) => {
        facts.push(`${fact}:${entity}`); return { id: `${fact}:${entity}`, status: 'granted' as const, recorded: true };
      }, { flush: () => true, achievement: () => undefined }) });
      const oracleFlags = new Flags(`${source.identity.slug}-oracle`, false), oracle = new QuestLine(parseQuestData(source.quests).quests, oracleFlags);
      const changes: string[] = [];
      line.onStep = (q, step) => { changes.push(`${q.def.id}:${step?.id ?? 'complete'}`); };
      line.onComplete = q => { changes.push(`done:${q.def.id}`); };
      try {
        for (const q of source.quests.quests) {
          for (const condition of [q.startWhen, ...q.steps.map(step => step.done)]) {
            for (const flag of condition?.none ?? []) { flags.clear(flag); oracleFlags.clear(flag); }
            for (const flag of condition?.all ?? condition?.any?.slice(0, 1) ?? []) {
              flags.set(flag); oracleFlags.set(flag);
              expect(line.chapters.map(state => state.snapshot())).toEqual(oracle.chapters.map(state => state.snapshot()));
              expect(line.active?.def.id).toBe(oracle.active?.def.id);
            }
          }
        }
        expect(line.active).toBeNull();
        expect(facts).toEqual(source.quests.quests.flatMap(q => q.onComplete?.fact === undefined ? [] : [`${q.onComplete.fact}:${q.id}`]));
        expect(changes.filter(entry => entry.startsWith('done:'))).toEqual(ids.map(id => `done:${id}`));
        flags.set('unrelated'); expect(new Set(facts).size).toBe(facts.length);
        expect(() => bindStoryChapters({ app: new App(), scope, product }, source, [ids[0] ?? '', ids[0] ?? ''], { flags })).toThrow('Invalid story chapters');
      } finally { oracle.dispose(); }
    } finally { scope.dispose(); }
  }
});

test('chapter presentation preserves messages, reward timing, discoveries and home exit ownership', () => {
  vi.useFakeTimers();
  const scope = new Scope('chapter-view'), app = new App(), flags = new Flags('chapter-view', false);
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(level.context, MANIFEST, { shard: MANIFEST, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const retained = new RetainedRuntimeHooks(context), line = new QuestLine(parseQuestData(content.quests).quests, flags);
  const figures = Object.fromEntries(Object.keys(content.npcs).map(id => [id, { headWorld: new Vector3(), talking: false }]));
  const toasts: string[] = [], feats: string[] = [], order: string[] = [];
  let map: (() => MapQuest | null) | undefined;
  try {
    const presentation = presentChapterStory(line, parseChapterStoryPresentation(policy), { ctx: retained.context, scope, flags,
      figures, npcs: content.npcs, places: content.places, prompts: [], open: () => { order.push('open'); },
      toast: text => { toasts.push(text); }, sting: () => { order.push('sting'); }, feat: event => { feats.push(event); },
      fullMap: { setQuest: source => { map = source; }, setPois: () => undefined } });
    expect(map?.()?.title).toBe('Nalati Grasslands');
    presentation.installFeats();
    presentation.talk('elder'); expect(presentation.dialogue().isOpen).toBe(true);
    expect(order).toEqual(['open']); presentation.dialogue().close(false);
    presentation.places.update(88, 212); expect(flags.has('seen:nomad-camp')).toBe(true);
    flags.set('talked:elder'); expect(toasts.at(-1)).toBe('New quest · Tulpar');
    expect(map?.()?.title).toBe('Chapter 1 · Tulpar');
    flags.set('tamed:horse'); expect(toasts.at(-1)).toBe('Objective · Win a round of kokpar');
    flags.set('won:kokpar'); flags.set('told:tulpar');
    expect(line.chapters[0]?.isComplete).toBe(true);
    expect(feats).toContain('kokpar'); expect(feats).toContain('tulpar');
    const caption = document.querySelector('.ws-quest-reward');
    expect(caption?.textContent).toContain('Chapter 1 · complete');
    expect(caption?.textContent).toContain('Title earned · Formerly On Foot');
    expect(presentation.chip.line.root.classList.contains('ws-quest-hide')).toBe(true);
    vi.advanceTimersByTime(6499); expect(presentation.chip.line.root.classList.contains('ws-quest-hide')).toBe(true);
    vi.advanceTimersByTime(1); expect(presentation.chip.line.root.classList.contains('ws-quest-hide')).toBe(false);
    const dialogue = presentation.dialogue(); dialogue.open('Reading', ['A long story.'], () => undefined);
    const parent = presentation.chip.line.root.parentNode;
    retained.deactivate(); expect(dialogue.isOpen).toBe(false); expect(presentation.chip.line.root.parentNode).toBeNull();
    expect(() => presentation.dialogue()).toThrow('left its home');
    retained.activate(); expect(presentation.dialogue()).not.toBe(dialogue); expect(presentation.chip.line.root.parentNode).toBe(parent);
    expect(flags.has('seen:nomad-camp')).toBe(true); expect(line.active?.def.id).toBe('golden-king');
  } finally { line.dispose(); scope.dispose(); }
});

test('Driftwood chapter adoption matches its previous presenter through completion and leftovers', () => {
  const scope = new Scope('drift-chapter-parity'), oldFlags = new Flags('drift-old', false), flags = new Flags('drift-new', false);
  const oldLine = new QuestLine(parseQuestData(drift.quests).quests, oldFlags), line = new QuestLine(parseQuestData(drift.quests).quests, flags);
  const quest = line.chapters[0], oldQuest = oldLine.chapters[0], rows = PAGE_STORY.chapters;
  if (quest === undefined || oldQuest === undefined || rows === undefined) throw new Error('Missing Driftwood chapter');
  const player = { position: new Vector3(), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
  const oldNotices: string[] = [], notices: string[] = [];
  let oldCard: (() => MapQuest | null) | undefined, card: (() => MapQuest | null) | undefined;
  const place = (at: { x: number; z: number }): { x: number; y: number; z: number } => ({ x: at.x, y: 0, z: at.z });
  try {
    const previous = presentQuestStory(PAGE_STORY, { scope, player, toast: text => { oldNotices.push(text); }, sting: () => { oldNotices.push('sting'); },
      fullMap: { setQuest: read => { oldCard = read; } } }, oldQuest, { place });
    const current = presentChapterStory(line, rows, { scope, flags, npcs: {}, figures: {}, places: [], prompts: [], open: () => undefined,
      toast: text => { notices.push(text); }, sting: () => { notices.push('sting'); }, fullMap: { setQuest: read => { card = read; } },
      place, chip: () => quest.chip() });
    let time = 0;
    for (const condition of [quest.def.startWhen, ...quest.def.steps.map(step => step.done)]) {
      for (const flag of condition?.none ?? []) { flags.clear(flag); oldFlags.clear(flag); }
      for (const flag of condition?.all ?? condition?.any?.slice(0, 1) ?? []) {
        flags.set(flag); oldFlags.set(flag); time++;
        previous.update(.1, time); current.update(.1, player.position); current.chip.update(time, player);
        expect(current.chip.line.root.textContent).toBe(previous.chip.line.root.textContent);
        expect(current.markers()).toEqual(previous.markers()); expect(card?.()).toEqual(oldCard?.()); expect(notices).toEqual(oldNotices);
      }
    }
    expect(quest.isComplete).toBe(true);
  } finally { oldLine.dispose(); line.dispose(); scope.dispose(); }
});
