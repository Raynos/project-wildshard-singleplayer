// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import type { ShardContext } from '../src/game/plugin/context';
import type { QuestChapter } from '../src/game/quest/chapter';
import { publishBoundChapter, publishChapterFlags } from '../src/game/quest/chapterBindings';
import { installQuestHints } from '../src/game/quest/hints';
import { legacyDouble } from './fake/FakeGame';
import hintsRows from '../src/shards/driftwood-isle/data/questHints.json' with { type: 'json' };
import compositionRows from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };
import { QuestPageCompositionSchema } from '../src/format/questPageComposition';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import * as v from 'valibot';

type Runtime = NonNullable<ShardContext['game']['runtime']>;
type Play = NonNullable<Runtime['play']>;
function fixture(parent?: Scope) {
  const scope = parent?.child('hint-entry') ?? new Scope('hint-entry');
  const hints = { feed: vi.fn<NonNullable<Play['firstHints']>['feed']>(), done: () => false, distance: 0 };
  const nativeHints = legacyDouble<NonNullable<Play['firstHints']>>(hints);
  const animals = legacyDouble<Play['animals']>({ animals: [] });
  const world = legacyDouble<NonNullable<Runtime['world']>>({ player: legacyDouble<NonNullable<Runtime['world']>['player']>({ position: new Vector3() }) });
  const play = legacyDouble<Play>({ firstHints: nativeHints, animals });
  const runtime = legacyDouble<Runtime>({ world, play, hooks: {} });
  const system = vi.fn<ShardContext['system']>(), event = vi.fn<(name: string) => void>();
  const on: ShardContext['on'] = name => { event(name); };
  const ui = legacyDouble<ShardContext['app']['ui']>({ prompt: () => 'Talk to the keeper' });
  const ctx = legacyDouble<ShardContext>({ scope, game: legacyDouble<ShardContext['game']>({ runtime }),
    app: legacyDouble<ShardContext['app']>({ ui }), system, on });
  return { scope, ctx, runtime, hints, system, on: event };
}

test('hint installation borrows actual native owners and preserves priority and system order', () => {
  const f = fixture();
  try {
    installQuestHints(f.ctx, hintsRows);
    const feed = f.hints.feed.mock.calls[0]?.[0], system = f.system.mock.calls[0]?.[0];
    if (feed === undefined || system === undefined) throw new Error('Missing hint registration');
    expect(feed.map(row => row.control)).toEqual(hintsRows.hints.map(row => row.control));
    expect(f.on.mock.calls.map(row => row[0])).toEqual(['ai.windup']);
    expect(system).toMatchObject({ ...hintsRows.system, phase: 'update' });
    system.run(.2, .2);
    expect(feed.find(row => row.control === 'move')?.when()).toBe(true);
    expect(feed.find(row => row.control === 'use')?.when()).toBe(true);
    expect(f.hints.feed).toHaveBeenCalledTimes(1);
  } finally { f.scope.dispose(); }
});

test('hint admission rejects missing native owners, accessors and ancestor retirement before registration', () => {
  const parent = new Scope('hint-parent'), f = fixture(parent), rows = structuredClone(hintsRows), getter = vi.fn(() => []);
  Object.defineProperty(rows, 'hostile', { enumerable: true, get: getter });
  try {
    expect(() => installQuestHints(f.ctx, rows)).toThrow('JSON'); expect(getter).not.toHaveBeenCalled();
    Object.assign(f.runtime, { play: null });
    expect(() => installQuestHints(f.ctx, hintsRows)).toThrow('owners');
    parent.onDispose(() => undefined); const retirement = parent.disposeSteps(); retirement.next();
    try { expect(f.scope.disposed).toBe(false); expect(f.scope.disposing).toBe(true);
      expect(() => installQuestHints(f.ctx, hintsRows)).toThrow('live');
    } finally { for (const step of retirement) void step; }
    expect(f.hints.feed).not.toHaveBeenCalled(); expect(f.on).not.toHaveBeenCalled(); expect(f.system).not.toHaveBeenCalled();
  } finally { parent.dispose(); }
});

test('flag publication borrows its bound chapter, snapshots live sorted flags and restores the previous hook', () => {
  const f = fixture(), flags = new Flags('probe-orchard', false), previous = () => ['previous'];
  const chapter = legacyDouble<QuestChapter>({ quest: legacyDouble<QuestChapter['quest']>({ flags }) });
  f.runtime.hooks.adventureFlags = previous; publishBoundChapter(f.scope, 'orchard', chapter);
  try {
    flags.set('z-last'); flags.set('a-first'); publishChapterFlags(f.ctx, 'orchard');
    const read = f.runtime.hooks.adventureFlags;
    expect(read()).toEqual(flags.all.slice().sort()); flags.set('middle'); expect(read()).toEqual(['a-first', 'middle', 'z-last']);
    expect(flags.all).toEqual(['z-last', 'a-first', 'middle']);
    f.scope.dispose(); expect(f.runtime.hooks.adventureFlags).toBe(previous); expect(read()).toEqual([]);
  } finally { f.scope.dispose(); }
});

test('flag publication refuses absent, replaced and retiring chapter owners', () => {
  const parent = new Scope('flag-parent'), f = fixture(parent), flags = new Flags('probe-replace', false);
  const chapter = legacyDouble<QuestChapter>({ quest: legacyDouble<QuestChapter['quest']>({ flags }) });
  try {
    expect(() => publishChapterFlags(f.ctx, 'missing')).toThrow('not installed'); expect(f.runtime.hooks.adventureFlags).toBeUndefined();
    publishBoundChapter(f.scope, 'orchard', chapter); publishChapterFlags(f.ctx, 'orchard');
    const read = f.runtime.hooks.adventureFlags;
    if (read === undefined) throw new Error('Missing probe');
    publishBoundChapter(f.scope, 'orchard', legacyDouble<QuestChapter>({ quest: chapter.quest })); expect(read).toThrow('changed');
    parent.onDispose(() => undefined); const retirement = parent.disposeSteps(); retirement.next();
    try { expect(read()).toEqual([]); expect(() => publishChapterFlags(f.ctx, 'orchard')).toThrow('live'); }
    finally { for (const step of retirement) void step; }
  } finally { parent.dispose(); }
});

test('the actual Driftwood descriptor uses existing map and bound native presentation fields', () => {
  const rows = { ...compositionRows, events: [], deaths: [] };
  const parsed = v.parse(QuestPageCompositionSchema, rows);
  expect(parsed.map).toEqual({ publish: { tally: true } }); expect(parsed.chapter.publishFlags).toBe(true);
  expect(parsed.files.hints).toBe('quests/hints.json');
  expect(() => v.parse(QuestPageCompositionSchema, { ...rows, presentation: { mapPois: true, flags: true } })).toThrow();
  const schema = namedJsonSchema(QuestPageCompositionSchema);
  expect(validateNamedJsonSchema(schema, new TextEncoder().encode(JSON.stringify(rows)))).toEqual(rows);
});
