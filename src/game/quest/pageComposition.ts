/** Client-only entered quest presentation over existing native owners. */
import * as THREE from 'three';
import type { QuestPageRows, ChapterViewRows } from '@wildshard/format/questPageComposition';
import type { PageTamingOwner } from '../riding/client';
import { ArenaRoomEncounter } from '../boss/arenaRoom';
import { ArenaScriptEncounter } from '../boss/arenaScript';
import { enterFigureGroup } from '../systems/npc/figureRows';
import { CarriedQuestProp } from './carriedProp';
import { enteredAdventurePersistence, publishChapterFlags } from './chapterBindings';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import type { ContractCatalogue } from '@wildshard/format/contracts';
import { installQuestHintFile } from './hints';
import { questPageWorld } from './pageResources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { installWorldScenes } from '../shardfile/worldScenes';
import { residentWorldScope } from '../shardfile/hybridPresentation';
import type { cableModes } from '@wildshard/engine/player/modes';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactables, InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import type { Interactable, InteractTable, QuestPlace, QuestPlaceAnchor } from '@wildshard/engine/world/interact/types';
import { perfLap } from '@wildshard/engine/core/perfLap';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { ITEMS, isItemId } from '../bag/itemCatalog';
import type { ItemId } from '../Inventory';
import type { ShardContext } from '../plugin/context';
import { QuestViews, bindQuestPageInteractions, type QuestPageInteractions } from '../plugin/ui';
import type { MoverRuntime } from '../plugin/mover';
import type { DialogueBox } from '@wildshard/engine/quest/view/ui';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { prepareQuestEntry, buildQuestChapter, type QuestCableView, type QuestChapter } from './chapter';
import { bindRuntimeQuest } from '../plugin/headless';
import { installQuestShop, type QuestTrader } from './trader';
import { PlaceGuide, type Places } from '@wildshard/engine/quest/view';
import type { AdventureContent } from '@wildshard/format/questStory';
import { installChapterWakeEncounter, readChapterDirector } from './chapterDirector';
import { installCompletion, type Completion as Complete } from '../complete/declared';
import { installPageReturns } from '../population/pageReturns';
import type { Placed } from '@wildshard/engine/models/place';
import { HeldClaims } from '../loadout/claims';
import { DataPanel, readDataPanels } from '../ui/dataPanels';
import { forestPage } from '../shardfile/forestPage';
import { rangedPage } from '../loadout/rangedPage';
import { installPageMap, installPageMover, pageCollectionCalls } from './pageFacets';
import { installPageDoor } from './pageDoors';

const isCustom = (id: string): id is `custom/${string}` => id.startsWith('custom/');
/** The page borrows the actual native boss and its baked reward pose. */
interface PageFinale { readonly actor: Animal | null; readonly rewardAt: THREE.Vector3; readonly rewardPose: { yaw: number; pitch: number; phase: number } }
interface PageCable { group: THREE.Object3D; placed: Placed; a: THREE.Vector3; b: THREE.Vector3; prompt: Interactable; cables: ReturnType<typeof cableModes>; mode: string }
/** Presentation handles share existing quest, shop and native continuation owners. */
export interface QuestPageComposition {
  readonly content: AdventureContent | null; readonly flags: Flags; readonly kit: Interactables;
  spine: (QuestChapter & { readonly dialogue: DialogueBox }) | null; places: Places | null;
  finale: PageFinale | null; ecology: ReturnType<typeof installPageReturns> | null;
  complete: Complete | null; zipline: PageCable | null; trader: QuestTrader | null;
  readonly place: (p: QuestPlace) => { x: number; y: number; z: number; yaw: number };
  readonly floorAt: (x: number, z: number) => number;
  readonly setAnchor: (name: string, a: QuestPlaceAnchor) => void;
  /** the optional facets' live owners, for the page's listed views and debug */
  readonly facets: {
    achievements: Awaited<ReturnType<Awaited<ReturnType<typeof prepareQuestEntry>>['achievements']>> | null;
    people: Awaited<ReturnType<Awaited<ReturnType<typeof prepareQuestEntry>>['talks']>>['people'];
    cable: QuestCableView | null; motion: MoverRuntime | null; director: Awaited<ReturnType<typeof readChapterDirector>> | null;
    board: ReturnType<Awaited<ReturnType<typeof prepareQuestEntry>>['board']> | null;
    shop: ReturnType<typeof installQuestShop> | null;
    readonly pages: ReadonlyMap<string, QuestPageInteractions>;
  };
}
async function preparePage(ctx: ShardContext, rows: QuestPageRows, lent: ReadonlyMap<string, unknown>) {
  const product = ctx.product, shell = ctx.game.runtime, world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Quest page requires its entered play host');
  if (ctx.scope.disposed) throw new Error('Quest page left during admission');
  const scope = ctx.scope, d = rows.world === undefined ? null : questPageWorld(scope, rows.world);
  const update = (run: (dt: number, time: number) => void, id: string): void => {
    ctx.system({ id, phase: 'update', after: [rows.systems.kit], before: rows.systems.before, run });
  };
  const ironDrop = rows.held === undefined ? null : HeldClaims.current(ctx.manifest.slug).claim(rows.held);
  const content = rows.files.discovery === undefined ? null : await ctx.product.json<AdventureContent>(rows.files.discovery);
  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(rows.files.stall)));
  const entry = await prepareQuestEntry(ctx, { story: 'quests/story.json', services: rows.files.services,
    placement: { ...(rows.world === undefined ? {} : { world: rows.world }), ...(rows.frames === undefined ? {} : { frames: rows.frames }), ...rows.placement } });
  const { story, flags, services, floorAt, place, setAnchor, anchors } = entry;

  const assembly = rows.files.assembly === undefined ? null
    : (await ctx.product.json<{ constants: { interact: InteractTable; interactSpots: unknown } }>(rows.files.assembly)).constants;
  const section = rows.kit?.section, table = section === undefined || !isCustom(section) ? assembly?.interact : ctx.product.section<{ table: InteractTable }>(section).table;
  if (table === undefined) throw new Error('Quest page requires its interaction table');
  const kit = await entry.interact({ table, ...(assembly === null ? {} : { placements: assembly.interactSpots }),
    ...(rows.kit?.platforms === undefined ? {} : { platforms: rows.kit.platforms }), ...(rows.kit?.registryReach === undefined ? {} : { registryReach: rows.kit.registryReach }) },
    { id: rows.systems.kit, before: rows.systems.before, after: rows.systems.kitAfter });

  // the page interaction files bind over lent owners, the kit's sounds, named floor points and placed scene objects
  const ui = new QuestViews(ctx), scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
  const owners = new Map<string, unknown>(lent);
  owners.set('sfx', kit.sfx); owners.set('points', Object.fromEntries(rows.points.map(row => [row.id, new THREE.Vector3(row.x, floorAt(row.x, row.z) + row.height, row.z)])));
  if (rows.forest !== undefined) owners.set('floor', forestPage(scope, rows.forest));
  if (rows.ranged !== undefined) {
    const sfx = rangedPage(scope, rows.ranged).ambience.sfx;
    owners.set('sound', { shot: (name: Parameters<typeof sfx.shot>[0], at?: THREE.Vector3): void => { sfx.shot(name, at ? { at } : {}); } });
  }
  for (const row of rows.placed) owners.set(row.owner, (await scenes.place(row.scene)).object);
  // the door's flag gate reads the entered quest, so bind it first (with the achievements' facts); the chapter reuses it
  if (rows.door !== undefined) bindRuntimeQuest(ctx, ctx.product.shardfile, story.quest.id, { flags, facts: (await entry.achievements()).facts });
  const door = rows.door === undefined ? null : installPageDoor(ctx, rows.door);
  if (door !== null) owners.set('door', door);
  const interactions = ctx.product.shardfile.questHost?.interactions;
  const pages = new Map<string, QuestPageInteractions>(), actions = new Map<string, QuestPageInteractions>();
  for (const row of rows.pages.filter(wanted => wanted.requires.every(owner => owners.has(owner)))) {
    const data = parseQuestPageInteractions(await ctx.product.json(row.file));
    const bound = bindQuestPageInteractions(data, { flags, timer: ui, toast: text => { h.hud.toast(text); }, owners, ...(interactions === undefined ? {} : { interactions }),
      ...(row.prompts.length === 0 ? {} : { promptIds: row.prompts, interactables: shell.interactables }) });
    pages.set(row.file, bound); for (const declared of data.actions) actions.set(declared.id, bound);
  }
  const action = (id: string): ((e: InteractEvent) => void) => {
    const bound = actions.get(id); if (bound === undefined) throw new Error(`Unknown quest page action ${id}`);
    return bound.action(id);
  };
  const panels = rows.board === undefined && rows.collections === undefined ? {} : await readDataPanels(ctx.product);
  const panel = (name: string): NonNullable<(typeof panels)[string]> => { const found = panels[name]; if (found === undefined) throw new Error(`Missing quest panel ${name}`); return found; };
  const collections = rows.collections === undefined ? new Map<string, (e: InteractEvent) => void>() : ((countPanel): Map<string, (e: InteractEvent) => void> => {
    const chip = ui.view('count', view => new DataPanel(countPanel, { scope: view }));
    ui.disposeLegacy(() => { scope.onDispose(() => { chip().root.remove(); }); });
    return pageCollectionCalls(rows.collections, { flags, chip, action, sting: name => { h.music.sting(name); } });
  })(panel(rows.collections.panel));

  const isItem = (id: string | undefined): id is ItemId => id !== undefined && id in ITEMS;
  const sfx = kit.sfx;
  kit.onEvent = sfx.bindEvents(rows.events, { toast: text => { h.hud.toast(text); },
    item: id => isItem(id) ? { label: ITEMS[id].label, add: n => { h.inventory.add(id, n); } } : null,
    calls: new Map([...rows.services.map(id => [id, () => { services.run(id); }] as const), ...collections]) });
  return { entry, rows, product, shell, world, h, scope, d, update, ironDrop, story, services, content, traderStall, flags, floorAt, place, setAnchor, anchors, kit,
    ui, scenes, pages, panel };
}
/** The public guard names only the concrete owners retained by preparation.
 * Its type never exposes private implementation members of prepared views. */
export interface PreparedQuestPageOwners {
  readonly scope: Scope; readonly product: ShardContext['product'];
  readonly shell: NonNullable<ShardContext['game']['runtime']>;
  readonly world: NonNullable<PreparedQuestPageOwners['shell']['world']>;
  readonly h: NonNullable<PreparedQuestPageOwners['shell']['play']>;
}
/** Refuse stale concrete preparation owners before late presentation publication. */
export function requireQuestPageOwners(ctx: ShardContext, page: PreparedQuestPageOwners): void {
  if (page.scope.disposed || page.scope.disposing || ctx.scope !== page.scope || ctx.product !== page.product || ctx.game.runtime !== page.shell
    || page.shell.world !== page.world || page.shell.play !== page.h) throw new Error('Quest page owners left or changed before presentation');
}
const preparations = new WeakMap<Scope, Map<string, Awaited<ReturnType<typeof preparePage>>>>();
/** Prepare the real placement/interaction owners before borrowed figures enter.
 * The only author input is an admitted row; model construction stays outside.
 * `owners` lends the page interaction files any further live owner by name. */
export async function prepareQuestPageComposition(ctx: ShardContext, input: QuestPageRows,
  owners: ReadonlyMap<string, unknown> = new Map()): Promise<Pick<QuestPageComposition, 'place' | 'floorAt' | 'setAnchor'>> {
  const page = await preparePage(ctx, input, owners), book = preparations.get(ctx.scope) ?? new Map<string, Awaited<ReturnType<typeof preparePage>>>();
  if (book.has(page.rows.id)) throw new Error('Duplicate quest page preparation');
  book.set(page.rows.id, page); preparations.set(ctx.scope, book); ctx.scope.onDispose(() => { book.delete(page.rows.id); }); return page;
}
/** The chapter-only facet borrows the actual entered owners, never policy
 * callbacks, runtime object paths or a second saved-state book. */
export interface ChapterViewOwners {
  readonly taming: PageTamingOwner | null; readonly arena: ArenaRoomEncounter;
  readonly fight: ArenaScriptEncounter; readonly figures?: unknown;
}
export function installQuestPageComposition(ctx: ShardContext, input: { readonly chapterView: string; readonly story: string }, owners: ChapterViewOwners): Promise<Flags>;
export function installQuestPageComposition(ctx: ShardContext, input: QuestPageRows): Promise<QuestPageComposition>;
/** Complete a prepared page, or its optional finite chapter-view facet. */
export async function installQuestPageComposition(ctx: ShardContext, input: QuestPageRows | { readonly chapterView: string; readonly story: string }, owners?: ChapterViewOwners): Promise<QuestPageComposition | Flags> {
  if ('chapterView' in input) {
    const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
    if (runtime === undefined || world === undefined || world === null || play === undefined || play === null || owners === undefined
      || !(owners.arena instanceof ArenaRoomEncounter) || !(owners.fight instanceof ArenaScriptEncounter)) throw new Error('Chapter view requires its concrete entered owners');
    const product = ctx.product, ports = owners, { taming, arena, fight, figures } = ports;
    const live = (): void => { if (ports.taming !== taming || ports.arena !== arena || ports.fight !== fight || ports.figures !== figures
      || ctx.scope.disposed || ctx.scope.disposing || ctx.product !== product || ctx.game.runtime !== runtime
      || runtime.world !== world || runtime.play !== play) throw new Error('Chapter view left during admission'); };
    live();
    const [story, content] = await Promise.all([ctx.product.json<unknown>(input.story), ctx.product.json<ChapterViewRows>(input.chapterView)]);
    live();
    const rows = content.view;
    if (rows.story !== input.story) throw new Error('Chapter view story differs from its admitted entry');
    if ((figures === undefined) === (content.figures === undefined)) throw new Error('Chapter view requires exactly one figure source');
    const people = enterFigureGroup({ scope: ctx.scope, sky: world.sky, registry: world.registry, channels: product.shardfile.clientChannels }, figures === undefined ? content.figures : figures);
    const chapter = buildQuestChapter(ctx, story, { content, program: content.program }), { chip, markers, places, line } = chapter;
    if (places === null || line === null) throw new Error('Chapter view requires its discovery and quest line');
    const carriedRows = await ctx.product.json<unknown>(rows.carried);
    live();
    const carried = new CarriedQuestProp(ctx, carriedRows), persistence = enteredAdventurePersistence(ctx.scope);
    world.game.scene.add(carried.object);
    let now = 0, slowT = 0, pulseT = -1e9;
    const project = (signal: string): void => { chapter.project(signal, { [rows.timeField]: now }); };
    const poll = (): void => {
      const observed = { 'taming.bonded': Number(taming?.phase === 'bonded'), 'taming.upgraded': Number(taming?.upgraded === true),
        'arena.inside': Number(arena.inside), 'arena.tied': Number(fight.fight.tied) };
      chapter.project(rows.signal, { [rows.timeField]: now, ...Object.fromEntries(Object.entries(rows.observations).map(([field, source]) => [field, observed[source]])) });
      if (now - pulseT > rows.pulse.interval) { pulseT = now; project(rows.pulse.signal); }
    };
    poll();
    const death = (): void => { project(rows.death.signal); };
    ctx.on('actor.died', ({ actor }) => {
      const body = play.animals.animals.find(candidate => candidate.combatActor() === actor);
      if (body !== undefined) { persistence.kill(body.kind, body.variant); if (body.kind === rows.death.kind) death(); }
    });
    chapter.installFeats();
    ctx.system({ ...rows.system, phase: 'update', run: (dt, t) => {
      now = t; const pp = world.player.position;
      chapter.update(dt, pp); people.update(dt, t, pp); carried.update(dt); chip.update(t, world.player);
      if (t - slowT > rows.interval) { slowT = t; poll(); places.update(pp.x, pp.z); }
    } });
    const debug = rows.debug;
    ctx.debug.expose(debug.id, { flags: chapter.quest.flags, line, people, [debug.prop]: carried, places, chip, markers,
      get dialogue() { return chapter.dialogueBox(); }, [debug.goals]: carried.goals, [rows.death.signal]: death, talk: chapter.talk });
    await people.ready;
    live();
    return chapter.quest.flags;
  }
  const page = preparations.get(ctx.scope)?.get(input.id);
  if (page === undefined || ctx.scope.disposed) throw new Error('Quest page is not prepared');
  preparations.get(ctx.scope)?.delete(input.id);
  const { entry, rows, world, h, scope, d, update, ironDrop, story, content, traderStall, flags, floorAt, place, setAnchor, anchors, kit, ui, scenes, pages } = page;
  const facets: QuestPageComposition['facets'] = { achievements: null, people: [], cable: null, motion: null, director: null, board: null, shop: null, pages };
  const adventure: QuestPageComposition = { content, flags, kit, place, floorAt, spine: null, places: null, finale: null, ecology: null, complete: null, zipline: null, trader: null, setAnchor, facets };
  facets.achievements = await entry.achievements();
  const placements = !rows.chapter.placements ? {} : { placements: Object.fromEntries(Object.values(story.quest.markers).map(at => {
    const p = place(at); return [JSON.stringify(at), { x: p.x, y: p.y, z: p.z }];
  })) };
  const chapter = entry.chapter({ ...placements, ...(rows.chapter.completion ? { completion: true } : {}),
    ...(rows.chapter.remaining === undefined ? {} : { remainingLabel: rows.chapter.remaining }), ...(rows.chapter.program === undefined ? {} : { program: rows.chapter.program }) });
  ui.retainRoot(chapter.objective.root, () => { chapter.objective.hide(false); });
  if (rows.board !== undefined && rows.files.contracts !== undefined) {
    const { panel: name, ...board } = rows.board;
    facets.board = entry.board({ ...board, contracts: await ctx.product.json<ContractCatalogue>(rows.files.contracts), panel: page.panel(name) });
  }
  const talks = await entry.talks(rows.talks);
  if (talks.people.length === 0) throw new Error('Quest requires its declared speaker');
  facets.people = talks.people;
  adventure.spine = { ...chapter, get places() { return chapter.places; }, get dialogue() { return talks.dialogue(); } };
  scope.onDispose(() => { chapter.objective.root.remove(); ui.disposeLegacy(() => { talks.dialogue().dispose(); }); });
  entry.deaths({ effects: rows.deaths, moves: rows.deathMoves, order: rows.deathOrder });
  if (rows.deathKill !== undefined) entry.deaths({ effects: [{ effects: [{ kind: 'kill' }] }], order: rows.deathKill });
  adventure.trader = entry.trader({ rows: traderStall, ...(rows.trader === undefined ? {} : { resources: { ...rows.trader, before: rows.systems.before,
    ...(rows.files.trader === undefined ? {} : { page: parseQuestPageInteractions(await ctx.product.json(rows.files.trader)) }) } }) });
  if (rows.shop) {
    const shop = installQuestShop(ctx, traderStall), board = facets.board; facets.shop = shop;
    ui.panelHold({ hud: h.hud, weapons: h.weapons, menu: h.menu, nolock: h.nolock, touchUi: h.touchUi,
      panels: board === null ? [shop] : [board.panel, shop], closeMenu: true, resetOnLeave: true });
    ui.disposeLegacy(() => { scope.onDispose(() => { shop().root.remove(); }); });
  }
  facets.board?.observe();
  entry.observe();
  entry.bench();
  ironDrop?.bindGuardFlags(flags.all);

  const cable = facets.cable = await entry.cable(rows.cable.view);
  const ends = rows.cable.ends;
  if (ends !== undefined) {
    if (cable.placed === null) throw new Error('Quest cable requires its declared placement');
    adventure.zipline = { ...cable, placed: cable.placed, a: scenes.vector(ends.a), b: scenes.vector(ends.b) };
    setAnchor(ends.publish, { x: scenes.vector(ends.anchor).x, z: scenes.vector(ends.anchor).z });
  }
  const mover = rows.mover === undefined ? null : await installPageMover(ctx, rows.mover, { scenes, flags, sfx: kit.sfx });
  facets.motion = mover?.motion ?? null;
  const director = facets.director = rows.files.director === undefined ? null : await readChapterDirector(ctx, rows.files.director);
  if (director !== null) { ui.retainRoot(director.caption.root, () => { director.caption.show(false); }); scope.onDispose(() => { director.caption.root.remove(); }); }
  update((dt, t) => {
    talks.update(dt, t, world.player.position); mover?.update(); director?.update(dt);
    if (!practiceRoom.open) chapter.chip.update(t, world.player);
  }, rows.systems.talks);
  update(cable.update, rows.systems.cable);

  const places = chapter.discover(rows.places ?? (content?.places ?? []).map(site => { const p = place(site.at);
    return { id: site.id, label: site.label, x: p.x, z: p.z, r: site.r, quiet: rows.quietPlaces.includes(site.id) }; }));
  adventure.places = places;
  let guide: PlaceGuide<Places['points'][number]> | null = null;
  const flock = d?.flock ?? null;
  if (flock !== null && content !== null && rows.systems.guide !== undefined) {
    const height = rows.guideHeight ?? Infinity; guide = new PlaceGuide<Places['points'][number]>({ distance: 'edge', min: 0, schedule: { kind: 'idle', ...content.guide } },
      { points: () => places.points, discovered: places.discovered, position: () => world.player.position,
        fly: (target: { readonly x: number; readonly z: number }) => flock.guide(world.player.position, target.x, target.z) });
    const liveGuide = guide;
    update(dt => { if (dt > 0 && h.hud.entered && !h.hud.paused && world.player.position.y <= height)
      liveGuide.update(dt, Math.hypot(world.player.velocity.x, world.player.velocity.z)); }, rows.systems.guide);
  }
  if (rows.chapter.completion) adventure.complete = installCompletion(ctx, flags, h.progress, adventure.spine.objective.root, anchors);   // before the finale: its reward hands over to the card
  if (rows.boss !== undefined && rows.files.encounter !== undefined) {
    const pool = place(rows.boss.pool);
    const finale = await installChapterWakeEncounter(ctx, await ctx.product.json(rows.files.encounter), pool);
    setAnchor(rows.boss.reward, finale.rewardAt);
    adventure.finale = { get actor() { return finale.actor; }, rewardAt: finale.rewardAt, rewardPose: finale.rewardPose };
  }
  scope.onDispose(flags.onChange((flag, on) => { ironDrop?.bindGuardFlags(flags.all); if (on && !flag.startsWith('plate:')) guide?.progressed(); }));
  if (rows.files.returns !== undefined) adventure.ecology = installPageReturns(ctx, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(rows.files.returns))));

  // the slow gate: E350 F-J1, a perf lap's teleports discover no place
  let placeT = 0;
  const drawDistance = rows.cable.drawDistance;
  update((_dt, t) => { if (t - placeT > rows.placeInterval) {
    placeT = t;
    const eye = world.game.camera.position;
    if (rows.peopleLod) for (const person of talks.people) person.lod(eye);
    if (drawDistance !== undefined) cable.trolley.visible = cable.cables.state(cable.mode).riding || eye.distanceToSquared(cable.trolley.position) < drawDistance * drawDistance;
    if (!perfLap.active) places.update(world.player.position.x, world.player.position.z);
  } }, rows.systems.places);
  ctx.debug.expose(rows.debug, { content, flags, kit, spine: adventure.spine, places, finale: adventure.finale,
    ecology: adventure.ecology, complete: adventure.complete, trader: adventure.trader, ...facets });
  const goto = (id: string): void => {
    const jump = rows.jumps[id]; if (jump === undefined) return;
    flags.reset(); for (const flag of jump.flags) flags.set(flag);
    world.player.spawn(jump.x, jump.z, Math.atan2(-(jump.look.x - jump.x), -(jump.look.z - jump.z)));
    if (jump.height !== undefined) world.player.position.y = terrainHeight(jump.height.x, jump.height.z) + jump.height.up;
    if (jump.phase !== undefined && world.sky.dayNight !== null) void world.sky.dayNight.set(jump.phase);
  };
  if (rows.browser !== undefined) ui.exposeBrowser(rows.browser, { flags, people: talks.people, zip: cable, cables: cable.cables, movers: facets.motion,
    board: facets.board?.state ?? null, kit, goto, jump: goto, dawn: (): void => { director?.request('dawn.request'); }, night: (): void => { director?.run('debug.night'); },
    give: (id: string, n = 1): void => { if (isItemId(id)) h.inventory.add(id, n); },
    openBoard: (): void => { facets.board?.panel().open(); }, openTrade: (): void => { facets.shop?.().open(); } });
  ctx.debug.expose(`harness.quest.${ctx.manifest.slug}`, () => flags.all.slice().sort());
  requireQuestPageOwners(ctx, page);
  if (rows.map !== undefined) installPageMap(ctx, rows.map, chapter);
  if (rows.chapter.publishFlags === true) publishChapterFlags(ctx, story.quest.id);
  if (rows.files.hints !== undefined && h.firstHints !== undefined) await installQuestHintFile(ctx, rows.files.hints);
  return adventure;
}
