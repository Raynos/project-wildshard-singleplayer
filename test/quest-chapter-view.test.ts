// @vitest-environment happy-dom
import { expect, test, vi, afterEach } from 'vitest';
import * as v from 'valibot';
import { Group, MeshBasicMaterial } from 'three';
import { app } from '../src/engine/app/runtime';
import { WorldRegistry } from '../src/engine/world/registry';
import { Mount } from '../src/game/riding/mount';
import { parseArenaScriptData } from '../src/format/arenaScriptRows';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { CarriedQuestProp } from '../src/game/quest/carriedProp';
import { manager } from './fake/manager';
import { bossArena } from './fake/bossArena';
import { overrideTerrain } from './fake/terrain';
import { mockCanvas } from './fake/weaponParity';
import king from '../src/shards/nalati-grasslands/data/goldenKing.generated.json' with { type: 'json' };
import titan from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with { type: 'json' };
import geometry from '../src/shards/nalati-grasslands/data/stormTitanGeometry.generated.json' with { type: 'json' };
import arenaFire from '../src/shards/nalati-grasslands/data/arenaFire.json' with { type: 'json' };
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import { carriedQuestRows } from '../src/shards/nalati-grasslands/generators/carriedQuest';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState } from '../src/engine/quest/core';
import { publishBoundQuest } from '../src/game/quest/boundState';
import type { ShardContext } from '../src/game/plugin/context';
import type { Actor, DamageRequest } from '../src/engine/combat/pipeline';
import { Events } from '../src/engine/events/events';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import type { Animal } from '../src/engine/entities/AnimalView';
import type { QuestChapter } from '../src/game/quest/chapter';
import * as chapterHost from '../src/game/quest/chapter';
import * as figures from '../src/game/systems/npc/figureRows';
import * as bindings from '../src/game/quest/chapterBindings';
import { ArenaRoomEncounter } from '../src/game/boss/arenaRoom';
import { ArenaScriptEncounter } from '../src/game/boss/arenaScript';
import type { PageTamingOwner } from '../src/game/riding/client';
import { ChapterViewSchema, type ChapterViewRows } from '../src/format/questPageComposition';
import { installQuestPageComposition } from '../src/game/quest/pageComposition';
import { legacyDouble } from './fake/FakeGame';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';
import { installEntryChapterView } from '../src/game/shardfile/clientQuestComposition';
import { publishEntryOwner } from '../src/game/shardfile/entryOwners';
import peopleRows from '../src/shards/nalati-grasslands/data/peopleFrames.generated.json' with { type: 'json' };
import content from '../src/shards/nalati-grasslands/data/questContent.json' with { type: 'json' };
import guest from '../src/shards/nalati-grasslands/data/kokpar.generated.json' with { type: 'json' };
import view from '../src/shards/nalati-grasslands/data/chapterView.json' with { type: 'json' };

afterEach(() => { vi.restoreAllMocks(); });

function fixture() {
  type Runtime = NonNullable<ShardContext['game']['runtime']>;
  type World = NonNullable<Runtime['world']>;
  mockCanvas();
  const terrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 });
  const scope = new Scope('chapter-view'), flags = new Flags('chapter-view', false), f = manager();
  scope.onDispose(terrain);
  publishBoundQuest(scope,new QuestState({id:carriedQuestRows.quest,title:'Carried delivery',
    steps:[{id:'delivery',objective:'Deliver',done:{all:['fixture:done']}}],completeFlag:'fixture:complete'},flags,undefined,scope));
  const game = Object.assign(f.game.asGame(), { app, levelScope: scope });
  const materials = new Map(['nalati-titan-cloud', 'nalati-titan-flame', 'nalati-titan-smoke'].map(id => [id, new MeshBasicMaterial()]));
  lendLooks(scope, { materials, setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => { throw new Error('No mapped fight material'); } });
  const world = legacyDouble<World>({ player: f.player, sky: f.sky, registry: new WorldRegistry(), game });
  type Play=NonNullable<Runtime['play']>;
  const play = legacyDouble<Play>({ animals: f.manager,
    hud:legacyDouble<Play['hud']>({toast:vi.fn<Play['hud']['toast']>()}),
    music:legacyDouble<Play['music']>({sting:vi.fn<Play['music']['sting']>()}),
    inventory:legacyDouble<Play['inventory']>({}),
  });
  const runtime = legacyDouble<Runtime>({ world, play });
  const product = createShardProduct({ slug: 'chapter-view', revision: 1, shardfile: legacyDouble<ShardContext['product']['shardfile']>({ clientChannels: [] }),
    sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('Mocked product should not read bytes')) });
  const json = vi.spyOn(product, 'json'), system = vi.fn<ShardContext['system']>(), events = new Events(), onNames: string[] = [];
  const on: ShardContext['on'] = (name, handler, options) => { onNames.push(name); events.on(name, handler, scope, options); };
  const ctx = legacyDouble<ShardContext>({ scope, app, game: legacyDouble<ShardContext['game']>({ runtime }),
    product,
    system, on, debug: legacyDouble<ShardContext['debug']>({ expose: vi.fn<ShardContext['debug']['expose']>() }) });
  const projection = vi.fn<QuestChapter['project']>(() => ({})), chapterUpdate = vi.fn<QuestChapter['update']>(), placesUpdate = vi.fn<NonNullable<QuestChapter['places']>['update']>();
  const chapter = legacyDouble<QuestChapter>({ quest: legacyDouble<QuestChapter['quest']>({ flags }),
    line: legacyDouble<NonNullable<QuestChapter['line']>>({}), project: projection, update: chapterUpdate,
    places: legacyDouble<NonNullable<QuestChapter['places']>>({ update: placesUpdate }),
    chip: legacyDouble<QuestChapter['chip']>({ update: vi.fn<QuestChapter['chip']['update']>() }), installFeats: vi.fn<QuestChapter['installFeats']>(), markers: () => [], talk: vi.fn<QuestChapter['talk']>(), dialogueBox: vi.fn<QuestChapter['dialogueBox']>() });
  vi.spyOn(chapterHost, 'buildQuestChapter').mockReturnValue(chapter);
  const people = { group: new Group(), figures: new Map(), ready: Promise.resolve(), update: vi.fn<figures.FigureGroup['update']>() };
  const enter = vi.spyOn(figures, 'enterFigureGroup').mockReturnValue(people);
  const kill = vi.fn<ReturnType<typeof bindings.enteredAdventurePersistence>['kill']>();
  vi.spyOn(bindings, 'enteredAdventurePersistence').mockReturnValue(legacyDouble<ReturnType<typeof bindings.enteredAdventurePersistence>>({ kill }));
  const rows = v.parse(ChapterViewSchema, { npcs: content.npcs, places: content.places, program: guest.program, view });
  json.mockResolvedValueOnce({}).mockResolvedValueOnce(rows).mockResolvedValueOnce(carriedQuestRows);
  const arena = new ArenaRoomEncounter(bossArena(), { ...king, definition: king.encounter, program: programs.rules }, null);
  const fight = new ArenaScriptEncounter({ game, player: f.player, tieSpot: null,
    weather: legacyDouble<ConstructorParameters<typeof ArenaScriptEncounter>[0]['weather']>({}),
    air: legacyDouble<ConstructorParameters<typeof ArenaScriptEncounter>[0]['air']>({}) },
    parseArenaScriptData({ arenaScript: titan.TITAN_HOST, programs, arenaFire }, geometry));
  new Mount(legacyDouble<ConstructorParameters<typeof Mount>[0]>({ app, scope }), f.player, f.manager,
    { speeds: { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 }, names: {}, thrownDamage: 7, thrownLabel: 'Thrown', restAt: { x: 3, z: 5 } });
  const carriedUpdate = vi.spyOn(CarriedQuestProp.prototype, 'update');
  const taming = legacyDouble<PageTamingOwner>({ phase: 'bonded', upgraded: true });
  const owners = { taming, arena, fight, figures: {} };
  return { ctx, scope, flags, world, play, rows, owners, json, system, events, onNames, projection, chapterUpdate, people, placesUpdate, enter, kill, carriedUpdate };
}

test('the finite chapter facet retains the original strict cadence, samples and update phase', async () => {
  const f = fixture();
  try {
    expect(await installQuestPageComposition(f.ctx, { chapterView: 'quests/content.json', story: 'quests/chapters.json' }, f.owners)).toBe(f.flags);
    expect(f.json.mock.calls.slice(0, 2)).toEqual([['quests/chapters.json'], ['quests/content.json']]);
    expect(f.projection.mock.calls).toEqual([['quest', { now: 0, bonded: 1, argymaq: 1, inside: 0, tied: 0 }], ['feathers', { now: 0 }]]);
    const system = f.system.mock.calls[0]?.[0];
    if (system === undefined) throw new Error('Missing original chapter phase');
    expect({ id: system.id, phase: system.phase, after: system.after, before: system.before }).toEqual({ ...view.system, phase: 'update' });
    f.projection.mockClear();
    let slowT = 0, pulseT = 0;
    const original: [string, Record<string, number>][] = [];
    for (let tick = 1; tick <= 600; tick++) {
      const t = tick / 60;
      system.run(1 / 60, t);
      if (t - slowT > .5) {
        slowT = t;
        original.push(['quest', { now: t, bonded: 1, argymaq: 1, inside: 0, tied: 0 }]);
        if (t - pulseT > 2) { pulseT = t; original.push(['feathers', { now: t }]); }
      }
    }
    expect(f.projection.mock.calls).toEqual(original);
    expect(f.chapterUpdate).toHaveBeenCalledTimes(600);
    expect(f.people.update).toHaveBeenCalledTimes(600);
    expect(f.carriedUpdate).toHaveBeenCalledTimes(600);
    expect(f.placesUpdate).toHaveBeenCalledTimes(original.filter(([signal]) => signal === 'quest').length);
    expect(f.onNames).toEqual(['actor.died']);
  } finally { f.scope.dispose(); }
});

test.each(['figures', 'taming', 'arena', 'fight'])('replacing %s during admission refuses before constructing figures or chapter views', async slot => {
  const f = fixture();
  let finish: ((value: ChapterViewRows) => void) | undefined;
  const pending = new Promise<ChapterViewRows>(resolve => { finish = resolve; });
  f.json.mockReset().mockResolvedValueOnce({}).mockReturnValueOnce(pending);
  try {
    const installing = installQuestPageComposition(f.ctx, { chapterView: 'quests/content.json', story: 'quests/chapters.json' }, f.owners);
    if (slot === 'figures') f.owners.figures = { replaced: true };
    else if (slot === 'taming') f.owners.taming = legacyDouble<PageTamingOwner>({ phase: 'wild', upgraded: false });
    else if (slot === 'arena') f.owners.arena = new ArenaRoomEncounter(bossArena(), { ...king, definition: king.encounter, program: programs.rules }, null);
    else f.owners.fight = new ArenaScriptEncounter(f.owners.fight.world, f.owners.fight.data);
    if (finish === undefined) throw new Error('Missing deferred admission');
    finish(f.rows);
    await expect(installing).rejects.toThrow('left during admission');
    expect(f.enter).not.toHaveBeenCalled(); expect(f.system).not.toHaveBeenCalled(); expect(f.projection).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('chapter policy admits only bounded finite observation sources and clocks', () => {
  const f = fixture();
  try {
    expect(() => v.parse(ChapterViewSchema, { ...f.rows, view: { ...view, observations: { field: 'arena.reflected.path' } } })).toThrow();
    expect(() => v.parse(ChapterViewSchema, { ...f.rows, view: { ...view, interval: 0 } })).toThrow();
    expect(() => v.parse(ChapterViewSchema, { ...f.rows, view: { ...view, pulse: { ...view.pulse, interval: Number.NaN } } })).toThrow();
    expect(() => v.parse(ChapterViewSchema, { ...f.rows, view: { ...view, callback: () => undefined } })).toThrow();
  } finally { f.scope.dispose(); }
});


test('native actor death commits the original persistence fact before the chapter projection', async () => {
  const f = fixture();
  try {
    await installQuestPageComposition(f.ctx, { chapterView: 'quests/content.json', story: 'quests/chapters.json' }, f.owners);
    const actor = legacyDouble<Actor>({}), req = legacyDouble<DamageRequest>({});
    const body = legacyDouble<Animal>({ kind: 'balbal', variant: 'old-carving', combatActor: () => actor });
    f.play.animals.animals.push(body); f.projection.mockClear();
    const trace: string[] = [];
    f.kill.mockImplementation(() => { trace.push('kill'); });
    f.projection.mockImplementation(() => { trace.push('projection'); return {}; });
    f.events.emit('actor.died', { actor, req }); f.events.flush('update');
    expect(f.kill).toHaveBeenCalledExactlyOnceWith('balbal', 'old-carving');
    expect(f.projection).toHaveBeenCalledExactlyOnceWith('carving', { now: 0 });
    expect(trace).toEqual(['kill', 'projection']);
    f.kill.mockClear(); f.projection.mockClear();
    f.events.emit('actor.died', { actor: legacyDouble<Actor>({}), req }); f.events.flush('update');
    expect(f.kill).not.toHaveBeenCalled(); expect(f.projection).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});


test('embedded original figures use the same admission and concrete entered loans', async () => {
  const f = fixture();
  const input = { ...f.rows, figures: peopleRows };
  v.parse(ChapterViewSchema, input);
  f.json.mockReset().mockResolvedValueOnce({}).mockResolvedValueOnce(input).mockResolvedValueOnce(carriedQuestRows);
  publishEntryOwner(f.scope, 'arena-room', 'chapter.arena', f.owners.arena);
  publishEntryOwner(f.scope, 'arena-script', 'chapter.fight', f.owners.fight);
  publishEntryOwner(f.scope, 'taming', 'chapter.taming', f.owners.taming);
  try {
    await installEntryChapterView(f.ctx, { kind: 'quest.chapter-view', chapterView: 'quests/content.json', story: 'quests/chapters.json',
      arena: 'chapter.arena', fight: 'chapter.fight', taming: 'chapter.taming' });
    expect(f.enter).toHaveBeenCalledOnce();
    const call = f.enter.mock.calls[0]; if (call === undefined) throw new Error('Missing figure admission');
    expect(call[0].scope === f.scope).toBe(true); expect(call[0].sky === f.world.sky).toBe(true);
    expect(call[0].registry === f.world.registry).toBe(true); expect(call[1] === input.figures).toBe(true);
    expect(f.projection.mock.calls[0]).toEqual(['quest', { now: 0, bonded: 1, argymaq: 1, inside: 0, tied: 0 }]);
    expect(input.figures).toEqual(peopleRows);
  } finally { f.scope.dispose(); }
});

test.each([false, true])('missing or dual figure sources refuse before figure and chapter effects: embedded=%s', async embedded => {
  const f = fixture();
  const rows = embedded ? v.parse(ChapterViewSchema, { ...f.rows, figures: peopleRows }) : f.rows;
  f.json.mockReset().mockResolvedValueOnce({}).mockResolvedValueOnce(rows);
  const owners = embedded ? f.owners : { taming: f.owners.taming, arena: f.owners.arena, fight: f.owners.fight };
  try {
    await expect(installQuestPageComposition(f.ctx, { chapterView: 'quests/content.json', story: 'quests/chapters.json' }, owners)).rejects.toThrow('exactly one figure source');
    expect(f.enter).not.toHaveBeenCalled(); expect(f.system).not.toHaveBeenCalled(); expect(f.projection).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('missing chapter loans refuse before any file read', async () => {
  const f = fixture();
  try {
    await expect(installEntryChapterView(f.ctx, { kind: 'quest.chapter-view', chapterView: 'quests/content.json', story: 'quests/chapters.json', arena: 'missing', fight: 'missing' })).rejects.toThrow('Missing live entry owner');
    expect(f.json).not.toHaveBeenCalled(); expect(f.enter).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});

test('chapter figures cross the exact named schema bridge without changing the original payload', () => {
  const f = fixture();
  try {
    const rows = { ...f.rows, figures: peopleRows }, schema = namedJsonSchema(ChapterViewSchema), bytes = new TextEncoder().encode(JSON.stringify(rows));
    expect(validateNamedJsonSchema(schema, bytes)).toEqual(rows);
    expect(() => v.parse(ChapterViewSchema, { ...rows, figures: { ...peopleRows, callback: 'ignored' } })).toThrow();
    const getter = vi.fn(() => peopleRows);
    expect(() => v.parse(ChapterViewSchema, Object.defineProperty({ ...f.rows }, 'figures', { enumerable: true, get: getter }))).toThrow();
    expect(getter).not.toHaveBeenCalled();
  } finally { f.scope.dispose(); }
});
