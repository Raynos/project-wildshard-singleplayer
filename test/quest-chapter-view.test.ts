import { titanFightOwners } from './fixtures/titanFightOwners';
import { installArenaShapes } from './fixtures/arenaShapes';
import {ReturnProgram} from '../src/game/shared/population/returnProgram';
import {carriedPropFiles,carriedPropBytes} from './fixtures/carriedPropFiles';
import {lendNalatiPasture,lendNalatiKokpar} from './fixtures/nalati-return-modules';
import { type OpenArenaWorld, ArenaRoomEncounter } from '../src/game/client/boss/arenaRoom';
import { ARENA_ROOM_PAGE } from '../src/game/client/boss/arenaRoomView';
// @vitest-environment happy-dom
import { expect, test, vi, afterEach } from 'vitest';
import * as v from 'valibot';
import { Group, MeshBasicMaterial } from 'three';
import { app } from '../src/engine/client/app/runtime';
import { WorldRegistry } from '../src/engine/client/world/registry';
import { Mount } from '../src/game/client/riding/mount';
import { parseArenaScriptData } from '@wildshard/format/arenaScriptRows';
import { lendLooks } from '../src/game/client/shardfile/lentLooks';
import { CarriedQuestProp } from '../src/game/client/quest/carriedProp';
import { manager } from '@wildshard/engine/test/manager';
import { bossArena } from './fake/bossArena';
import { bindFlatTerrain } from '@wildshard/engine/test/terrain';
import { mockCanvas } from '@wildshard/engine/test/weaponParity';
import king from './fixtures/nalati-goldenKing-original.json' with { type: 'json' };
import * as titan from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import { titanGeometryRows } from '../src/shards/nalati-grasslands/generators/stormTitanGeometry';
import arenaFire from '../src/shards/nalati-grasslands/data/arenaFire.json' with { type: 'json' };
import {titanPrograms as programs} from './fixtures/titanInlineWitness';
import { carriedQuestRows } from './fixtures/nalati-carried-quest';
import { Scope } from '../src/engine/shared/app/scope';
import { Flags } from '../src/engine/shared/world/interact/flags';
import { QuestState } from '../src/engine/shared/quest/core';
import { publishBoundQuest } from '../src/game/shared/quest/boundState';
import type { ShardContext } from '../src/game/client/plugin/context';
import { Events } from '../src/engine/shared/events/events';
import { createShardProduct } from '../src/game/shared/shardfile/shardProduct';
import type { QuestChapter } from '../src/game/client/quest/chapter';
import * as chapterHost from '../src/game/client/quest/chapter';
import * as questFigures from '../src/game/client/quest/figures';
import * as bindings from '../src/game/shared/quest/chapterBindings';
import type { PageTamingOwner } from '../src/game/client/riding/client';
import { ChapterViewSchema, type ChapterViewRows } from '@wildshard/format/questPageComposition';
import { installQuestPageComposition } from '../src/game/client/quest/pageComposition';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { namedJsonSchema } from '../src/sharddev/formatJsonSchema';
import { validateNamedJsonSchema } from '../src/game/shared/shardfile/customSchema';
import { installEntryChapterView } from '../src/game/client/shardfile/clientQuestComposition';
import { publishEntryOwner } from '../src/game/shared/shardfile/entryOwners';
import { peopleRows } from '../src/shards/nalati-grasslands/generators/peopleRows.mjs';
import content from '../src/shards/nalati-grasslands/data/questContent.json' with { type: 'json' };
import { NALATI_KOKPAR as guest } from './fixtures/nalati-kokpar';
import view from '../src/shards/nalati-grasslands/data/chapterView.json' with { type: 'json' };

const geometry = titanGeometryRows();

afterEach(() => { vi.restoreAllMocks(); });

await installArenaShapes();

function fixture() {
  type Runtime = NonNullable<ShardContext['game']['runtime']>;
  type World = NonNullable<Runtime['world']>;
  mockCanvas();
  const terrain = bindFlatTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 });
  const scope = new Scope('chapter-view'), flags = new Flags('chapter-view', false), f = manager();
  lendNalatiPasture(scope);lendNalatiKokpar(scope);
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
    sections: new Map(), files: new Map([...carriedPropFiles.keys()].map(name=>[name,{hash:'prop',url:name}])), read: () => Promise.resolve(carriedPropBytes) });
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
  const people = { group: new Group(), figures: new Map(), ready: Promise.resolve(), update: vi.fn<questFigures.QuestFigureGroup['update']>() };
  const enter = vi.spyOn(questFigures, 'installQuestFigures').mockReturnValue(people);
  const kill = vi.fn<ReturnType<typeof bindings.enteredAdventurePersistence>['kill']>();
  vi.spyOn(bindings, 'enteredAdventurePersistence').mockReturnValue(legacyDouble<ReturnType<typeof bindings.enteredAdventurePersistence>>({ kill }));
  const rows = v.parse(ChapterViewSchema, { npcs: content.npcs, places: content.places, program: guest.program, view });
  json.mockResolvedValueOnce({}).mockResolvedValueOnce(rows).mockResolvedValueOnce(carriedQuestRows);
  const arena = new ArenaRoomEncounter(bossArena(), { ...king, definition: king.encounter, program: programs.rules }, null, ARENA_ROOM_PAGE);
  const fight = new ArenaRoomEncounter({kind:'open',page:ARENA_ROOM_PAGE,world:{ game, player: f.player, tieSpot: null,
    weather: legacyDouble<OpenArenaWorld['weather']>({}),
    air: legacyDouble<OpenArenaWorld['air']>({}) },rows:
    parseArenaScriptData({ ...titanFightOwners, arenaScript: titan.TITAN_HOST, programs:{attack:programs.attack,wind:programs.wind}, arenaFire }, geometry)});
  new Mount(legacyDouble<ConstructorParameters<typeof Mount>[0]>({ app, scope }), f.player, f.manager,
    { speeds: { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 }, names: {}, thrownDamage: 7, thrownLabel: 'Thrown', restAt: { x: 3, z: 5 } });
  const carried: Pick<CarriedQuestProp, 'update'> = CarriedQuestProp.prototype;
  const carriedUpdate = vi.spyOn(carried, 'update');
  const taming = legacyDouble<PageTamingOwner>({ phase: 'bonded', upgraded: true });
  const owners = { taming, arena, fight, figures: {} };
  return { ctx, scope, flags, world, play, rows, owners, json, system, events, onNames, projection, chapterUpdate, people, placesUpdate, enter, kill, carriedUpdate };
}

test.each(['figures', 'taming', 'arena', 'fight'])('replacing %s during admission refuses before constructing figures or chapter views', async slot => {
  const f = fixture();
  let finish: ((value: ChapterViewRows) => void) | undefined;
  const pending = new Promise<ChapterViewRows>(resolve => { finish = resolve; });
  f.json.mockReset().mockResolvedValueOnce({}).mockReturnValueOnce(pending);
  try {
    const installing = installQuestPageComposition(f.ctx, { chapterView: 'quests/content.json', story: 'quests/chapters.json' }, f.owners);
    if (slot === 'figures') f.owners.figures = { replaced: true };
    else if (slot === 'taming') f.owners.taming = legacyDouble<PageTamingOwner>({ phase: 'wild', upgraded: false });
    else if (slot === 'arena') f.owners.arena = new ArenaRoomEncounter(bossArena(), { ...king, definition: king.encounter, program: programs.rules }, null, ARENA_ROOM_PAGE);
    else f.owners.fight = new ArenaRoomEncounter({kind:'open',page:ARENA_ROOM_PAGE,world:f.owners.fight.world,rows: f.owners.fight.data});
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



test('embedded original figures use the same admission and concrete entered loans', async () => {
  const f = fixture();
  const input = { ...f.rows, figures: peopleRows };
  v.parse(ChapterViewSchema, input);
  f.json.mockReset().mockResolvedValueOnce({}).mockResolvedValueOnce(input).mockResolvedValueOnce(carriedQuestRows);
  publishEntryOwner(f.scope, 'arena-room', 'chapter.arena', f.owners.arena);
  publishEntryOwner(f.scope, 'arena-room', 'chapter.fight', f.owners.fight);
  publishEntryOwner(f.scope, 'taming', 'chapter.taming', f.owners.taming);
  try {
    await installEntryChapterView(f.ctx, { kind: 'quest.chapter-view', chapterView: 'quests/content.json', story: 'quests/chapters.json',
      arena: 'chapter.arena', fight: 'chapter.fight', taming: 'chapter.taming' });
    expect(f.enter).toHaveBeenCalledOnce();
    const call = f.enter.mock.calls[0]; if (call === undefined) throw new Error('Missing figure admission');
    // the merged group goes through the quest-figures host, as the page's own rows (no copy)
    const [owner, admitted] = call;
    expect(owner === f.ctx).toBe(true); expect(admitted).toEqual({ figures: [], group: input.figures });
    expect(typeof admitted === 'object' && admitted !== null && Reflect.get(admitted, 'group') === input.figures).toBe(true);
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


test.each(['retired','product','world','reader'] as const)('raw carried model preparation refuses a changed %s owner before constructing the prop',async change=>{
  const f=fixture(),product=f.ctx.product,runtime=f.ctx.game.runtime;
  if(runtime===undefined)throw new Error('Missing actual fixture runtime');
  let begin=():void=>{throw new Error('Missing read latch');},settle=(_bytes:Uint8Array):void=>{throw new Error('Missing raw read resolver');};
  const started=new Promise<void>(resolve=>{begin=resolve;}),bytes=new Promise<Uint8Array>(resolve=>{settle=resolve;});
  const read=vi.spyOn(product,'file').mockImplementation(()=>{begin();return bytes;}),construct=vi.spyOn(ReturnProgram,'page');
  const run=installQuestPageComposition(f.ctx,{chapterView:'quests/content.json',story:'quests/chapters.json'},f.owners);
  const refused=expect(run).rejects.toThrow(/retired|left|changed/u);
  await started;
  if(change==='retired')f.scope.dispose();
  else if(change==='product')Object.assign(f.ctx,{product:{...product}});
  else if(change==='world')runtime.world={...f.world};
  else read.mockRestore();
  settle(carriedPropBytes);
  try{await refused;expect(construct).not.toHaveBeenCalled();expect(f.system).not.toHaveBeenCalled();}
  finally{f.scope.dispose();}
});
