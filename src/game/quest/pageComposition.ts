/** Client-only entered quest presentation over existing native owners. */
import type * as THREE from 'three';
import type { QuestPageCompositionRows } from '@wildshard/format/questPageComposition';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { installQuestHints } from './hints';
import { questPageWorld } from './pageResources';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { installWorldScenes } from '../shardfile/worldScenes';
import { residentWorldScope } from '../shardfile/hybridPresentation';
import type { cableModes } from '@wildshard/engine/player/modes';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactables } from '@wildshard/engine/world/interact/Interactables';
import type { Interactable, InteractTable, QuestPlace, QuestPlaceAnchor } from '@wildshard/engine/world/interact/types';
import { ITEMS } from '../bag/itemCatalog';
import type { ItemId } from '../Inventory';
import type { ShardContext } from '../plugin/context';
import type { DialogueBox } from '@wildshard/engine/quest/view/ui';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { prepareQuestEntry, type QuestChapter } from './chapter';
import type { QuestTrader } from './trader';
import { PlaceGuide, type Places } from '@wildshard/engine/quest/view';
import type { AdventureContent } from '@wildshard/format/questStory';
import { installChapterWakeEncounter } from './chapterDirector';
import { installCompletion, type Completion as Complete } from '../complete/declared';
import { installPageReturns } from '../population/pageReturns';
import type { Placed } from '@wildshard/engine/models/place';
import { HeldClaims } from '../loadout/claims';
/** The page borrows the actual native boss and its baked reward pose. */
interface PageFinale { readonly actor: Animal | null; readonly rewardAt: THREE.Vector3; readonly rewardPose: { yaw: number; pitch: number; phase: number } }
interface PageCable { group: THREE.Object3D; placed: Placed; a: THREE.Vector3; b: THREE.Vector3; prompt: Interactable; cables: ReturnType<typeof cableModes>; mode: string }
/** Presentation handles share existing quest, shop and native continuation owners. */
export interface QuestPageComposition {
  readonly content: AdventureContent; readonly flags: Flags; readonly kit: Interactables;
  spine: (QuestChapter & { readonly dialogue: DialogueBox }) | null; places: Places | null;
  finale: PageFinale | null; ecology: ReturnType<typeof installPageReturns> | null;
  complete: Complete | null; zipline: PageCable | null; trader: QuestTrader | null;
  readonly place: (p: QuestPlace) => { x: number; y: number; z: number; yaw: number };
  readonly floorAt: (x: number, z: number) => number;
  readonly setAnchor: (name: string, a: QuestPlaceAnchor) => void;
}
async function preparePage(ctx: ShardContext, rows: QuestPageCompositionRows) {
  const shell = ctx.game.runtime, world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Quest page requires its entered play host');
  if (ctx.scope.disposed) throw new Error('Quest page left during admission');
  const scope = ctx.scope, d = questPageWorld(scope, rows.world);
  const update = (run: (dt: number, time: number) => void, id: string): void => { ctx.system({ id, phase: 'update', before: rows.systems.before, run }); };
  const ironDrop = HeldClaims.current(ctx.manifest.slug).claim(rows.held);
  const content = await ctx.product.json<AdventureContent>(rows.files.discovery);
  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(rows.files.stall)));
  const entry = await prepareQuestEntry(ctx, { story: 'quests/story.json', services: rows.files.services,
    placement: { world: rows.world, frames: rows.frames, platforms: true } });
  const { story, flags, services, floorAt, place, setAnchor, anchors } = entry;

  const assembly = await ctx.product.json<{ constants: { interact: InteractTable; interactSpots: unknown } }>(rows.files.assembly);
  const kit = await entry.interact({ table: assembly.constants.interact, placements: assembly.constants.interactSpots, platforms: true },
    { id: rows.systems.kit, before: rows.systems.before });

  const isItem = (id: string | undefined): id is ItemId => id !== undefined && id in ITEMS;
  const sfx = kit.sfx;
  kit.onEvent = sfx.bindEvents(rows.events, { toast: text => { h.hud.toast(text); },
    item: id => isItem(id) ? { label: ITEMS[id].label, add: n => { h.inventory.add(id, n); } } : null,
    calls: new Map(rows.services.map(id => [id, () => { services.run(id); }])) });
  return { entry, rows, shell, world, h, scope, d, update, ironDrop, story, services, content, traderStall, flags, floorAt, place, setAnchor, anchors, kit };
}
const preparations = new WeakMap<Scope, Map<string, Awaited<ReturnType<typeof preparePage>>>>();
/** Prepare the real placement/interaction owners before borrowed figures enter.
 * The only author input is an admitted row; model construction stays outside. */
export async function prepareQuestPageComposition(ctx: ShardContext, input: QuestPageCompositionRows): Promise<Pick<QuestPageComposition, 'place' | 'floorAt' | 'setAnchor'>> {
  const page = await preparePage(ctx, input), book = preparations.get(ctx.scope) ?? new Map<string, Awaited<ReturnType<typeof preparePage>>>();
  if (book.has(page.rows.id)) throw new Error('Duplicate quest page preparation');
  book.set(page.rows.id, page); preparations.set(ctx.scope, book); ctx.scope.onDispose(() => { book.delete(page.rows.id); }); return page;
}
/** Complete a prepared page from declared native resource identities. */
export async function installQuestPageComposition(ctx: ShardContext, input: QuestPageCompositionRows): Promise<QuestPageComposition> {
  const page = preparations.get(ctx.scope)?.get(input.id);
  if (page === undefined || ctx.scope.disposed) throw new Error('Quest page is not prepared');
  preparations.get(ctx.scope)?.delete(input.id);
  const { entry, rows, world, h, scope, d, update, ironDrop, story, content, traderStall, flags, floorAt, place, setAnchor, anchors, kit } = page;
  const adventure: QuestPageComposition = { content, flags, kit, place, floorAt, spine: null, places: null, finale: null, ecology: null, complete: null, zipline: null, trader: null, setAnchor };
  await entry.achievements();
  const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
  const placements = Object.fromEntries(Object.values(story.quest.markers).map(at => {
    const p = place(at); return [JSON.stringify(at), { x: p.x, y: p.y, z: p.z }];
  }));
  const chapter = entry.chapter({ placements, completion: true, remainingLabel: rows.remaining });
  const talks = await entry.talks(rows.talks);
  if (talks.people.length === 0) throw new Error('Quest requires its declared speaker');
  adventure.spine = { ...chapter, get places() { return chapter.places; }, get dialogue() { return talks.dialogue(); } };
  entry.deaths({ effects: rows.deaths, moves: rows.deathMoves, order: 10 });
  update((dt, t) => {
    talks.update(dt, t, world.player.position);
    if (!practiceRoom.open) chapter.chip.update(t, world.player);
  }, rows.systems.talks);
  entry.deaths({ effects: [{ effects: [{ kind: 'kill' }] }], order: 35 });
  adventure.trader = entry.trader({ rows: traderStall, resources: { ...rows.trader, before: rows.systems.before,
    page: parseQuestPageInteractions(await ctx.product.json('quests/trader.json')) } });
  entry.observe();
  entry.bench();
  ironDrop?.bindGuardFlags(flags.all);
  {
    const cable = await entry.cable({ mode: rows.cable.mode, carriage: rows.cable.carriage, scene: { kind: 'placement', id: rows.cable.scene },
      prompt: rows.cable.prompt, radius: rows.cable.radius, label: rows.cable.label,
      feedback: { weapons: 'visible', start: { sound: 'lever', at: rows.cable.a }, end: { sound: 'plate', at: rows.cable.b } } });
    if (cable.placed === null) throw new Error('Quest cable requires its declared placement');
    const zip = { ...cable, placed: cable.placed, a: scenes.vector(rows.cable.a), b: scenes.vector(rows.cable.b) };
    update(cable.update, rows.systems.cable);
    adventure.zipline = zip;
    adventure.setAnchor(rows.cable.publish, { x: scenes.vector(rows.cable.anchor).x, z: scenes.vector(rows.cable.anchor).z });
  }

  const places = chapter.discover(content.places.map(site => { const p = place(site.at);
    return { id: site.id, label: site.label, x: p.x, z: p.z, r: site.r, quiet: rows.quietPlaces.includes(site.id) }; }));
  adventure.places = places;
  let guide: PlaceGuide<Places['points'][number]> | null = null;
  if (d.flock !== null) {
    const flock = d.flock; guide = new PlaceGuide<Places['points'][number]>({ distance: 'edge', min: 0, schedule: { kind: 'idle', ...content.guide } },
      { points: () => places.points, discovered: places.discovered, position: () => world.player.position,
        fly: (target: { readonly x: number; readonly z: number }) => flock.guide(world.player.position, target.x, target.z) });
    const liveGuide = guide;
    update(dt => { if (dt > 0 && h.hud.entered && !h.hud.paused && world.player.position.y <= rows.guideHeight)
      liveGuide.update(dt, Math.hypot(world.player.velocity.x, world.player.velocity.z)); }, rows.systems.guide);
  }
  adventure.complete = installCompletion(ctx, flags, h.progress, adventure.spine.objective.root, anchors);   // before the finale: its reward hands over to the card
  const pool = place(rows.boss.pool);
  const finale = await installChapterWakeEncounter(ctx, await ctx.product.json(rows.files.encounter), pool);
  scope.onDispose(flags.onChange((flag, on) => { ironDrop?.bindGuardFlags(flags.all); if (on && !flag.startsWith('plate:')) guide?.progressed(); }));
  setAnchor(rows.boss.reward, finale.rewardAt);
  adventure.finale = { get actor() { return finale.actor; }, rewardAt: finale.rewardAt, rewardPose: finale.rewardPose };
  adventure.ecology = installPageReturns(ctx, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(rows.files.returns))));

  let placeT = 0;
  update((_dt, t) => { if (t - placeT > rows.placeInterval) { placeT = t; places.update(world.player.position.x, world.player.position.z); } }, rows.systems.places);
  ctx.debug.expose(rows.debug, { content, flags, kit, spine: adventure.spine, places, finale: adventure.finale,
    ecology: adventure.ecology, complete: adventure.complete, trader: adventure.trader });
  if (rows.presentation?.mapPois === true) chapter.publishMap({ tally: true });
  if (rows.presentation?.flags === true) page.shell.hooks.adventureFlags = () => flags.all.slice().sort();
  if (rows.presentation?.hints !== undefined && h.firstHints !== undefined)
    installQuestHints(ctx, await ctx.product.json(rows.presentation.hints), new Map([['quest', { hints: h.firstHints, animals: h.animals, player: page.world.player, ui: ctx.app.ui }]]));
  return adventure;
}
