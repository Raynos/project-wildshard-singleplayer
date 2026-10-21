/** Client-only entered quest presentation over existing native owners. */
import * as THREE from 'three';
import * as v from 'valibot';
import { QuestPageCompositionSchema } from '@wildshard/format/questPageComposition';
import { installQuestHints } from './hints';
import { questPageWorld } from './pageResources';
import { FigureRows } from '../systems/npc/figureRows';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { installWorldScenes } from '../shardfile/worldScenes';
import { residentWorldScope } from '../shardfile/hybridPresentation';
import { cableModes } from '@wildshard/engine/player/modes';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactables } from '@wildshard/engine/world/interact/Interactables';
import type { Interactable, InteractTable, QuestPlace, QuestPlaceAnchor } from '@wildshard/engine/world/interact/types';
import { ITEMS } from '../bag/itemCatalog';
import type { ItemId } from '../Inventory';
import type { ShardContext } from '../plugin/context';
import type { DialogueBox } from '@wildshard/engine/quest/view/ui';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { QuestViews, type QuestNpcTalkPorts } from '../plugin/ui';
import { bindQuestDeathEffects } from '../plugin/quests';
import { installQuestChapter, prepareQuestEntry, ownQuestTree, type QuestChapter } from './chapter';
import { readQuestStory, bindStoryAchievements, observeStoryFlags, bindStoryBench, installStoryTalks } from './story';
import { installQuestTrader, parseQuestTrader, type QuestTrader } from './trader';
import { PlaceGuide, type Places } from '@wildshard/engine/quest/view';
import { parseAdventureContent, type AdventureContent } from '@wildshard/format/questStory';
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
async function preparePage(ctx: ShardContext, input: unknown) {
  const rows = v.parse(QuestPageCompositionSchema, input);
  const shell = ctx.game.runtime, world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Quest page requires its entered play host');
  if (ctx.scope.disposed) throw new Error('Quest page left during admission');
  const scope = ctx.scope, declaration = ctx.product.shardfile, d = questPageWorld(scope, rows.world);
  // Delegate the getters: spreading Game loses its live regional scene/camera.
  const w = { ...world, ...h, chunk: ctx.manifest, prompts: shell.interactables,
    game: { get scene() { return world.game.scene; }, get camera() { return world.game.camera; },
      onUpdate: (run: (dt: number, time: number) => void, id: string): void => { ctx.system({ id, phase: 'update', before: rows.systems.before, run }); } },
    pois: d.pois,
    ironDrop: HeldClaims.current(ctx.manifest.slug).claim(rows.held) };
  const onDeath = (run: (animal: Animal) => void, order: number): void => { ctx.on('actor.died', ({ actor }) => {
    const animal = h.animals.animals.find(a => a.combatActor() === actor); if (animal !== undefined) run(animal);
  }, { order }); };
  const story = await readQuestStory(ctx);
  const content = parseAdventureContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(rows.files.discovery))));
  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(rows.files.stall)));
  const entry = await prepareQuestEntry(ctx, story, { services: rows.files.services,
    placement: { world: rows.world, frames: rows.frames, platforms: true } });
  const { flags, services, floorAt, place, setAnchor, anchors } = entry;

  const assembly = await ctx.product.json<{ constants: { interact: InteractTable; interactSpots: unknown } }>(rows.files.assembly);
  const kit = await entry.interact({ table: assembly.constants.interact, placements: assembly.constants.interactSpots, platforms: true },
    { id: rows.systems.kit, before: rows.systems.before });

  const isItem = (id: string | undefined): id is ItemId => id !== undefined && id in ITEMS;
  const sfx = kit.sfx;
  kit.onEvent = sfx.bindEvents(rows.events, { toast: text => { w.hud.toast(text); },
    item: id => isItem(id) ? { label: ITEMS[id].label, add: n => { w.inventory.add(id, n); } } : null,
    calls: new Map(rows.services.map(id => [id, () => { services.run(id); }])) });
  return { rows, shell, world, h, scope, declaration, d, w, onDeath, story, services, content, traderStall, flags, floorAt, place, setAnchor, anchors, kit, sfx };
}
const preparations = new WeakMap<Scope, Map<string, Awaited<ReturnType<typeof preparePage>>>>();
/** Prepare the real placement/interaction owners before borrowed figures enter.
 * The only author input is an admitted row; model construction stays outside. */
export async function prepareQuestPageComposition(ctx: ShardContext, input: unknown): Promise<Pick<QuestPageComposition, 'place' | 'floorAt' | 'setAnchor'>> {
  const page = await preparePage(ctx, input), book = preparations.get(ctx.scope) ?? new Map<string, Awaited<ReturnType<typeof preparePage>>>();
  if (book.has(page.rows.id)) throw new Error('Duplicate quest page preparation');
  book.set(page.rows.id, page); preparations.set(ctx.scope, book); ctx.scope.onDispose(() => { book.delete(page.rows.id); }); return page;
}
/** Complete a prepared page from declared native resource identities. */
export async function installQuestPageComposition(ctx: ShardContext, input: unknown): Promise<QuestPageComposition> {
  const id = v.parse(QuestPageCompositionSchema, input).id, page = preparations.get(ctx.scope)?.get(id);
  if (page === undefined || ctx.scope.disposed) throw new Error('Quest page is not prepared');
  preparations.get(ctx.scope)?.delete(id);
  const { rows, h, scope, declaration, d, w, onDeath, story, content, traderStall, flags, floorAt, place, setAnchor, anchors, kit, sfx } = page;
  const adventure: QuestPageComposition = { content, flags, kit, place, floorAt, spine: null, places: null, finale: null, ecology: null, complete: null, zipline: null, trader: null, setAnchor };
  const grants = await bindStoryAchievements(ctx, story, w.progress, w.chunk.slug);
  const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
  const placements = Object.fromEntries(Object.values(story.quest.markers).map(at => {
    const p = place(at); return [JSON.stringify(at), { x: p.x, y: p.y, z: p.z }];
  }));
  const chapter = installQuestChapter(ctx, story, { placements, completion: true, remainingLabel: rows.remaining }, anchors);
  const figures: QuestNpcTalkPorts<FigureRows>['figures'] = new Map(rows.figures.map(row => {
    const figure = FigureRows.entered(scope, row.id);
    return [row.id, { kind: 'borrowed' as const, create: () => figure,
      own: (value: FigureRows, register: () => void) => { ownQuestTree(value.group, scope); scope.run(register); },
      at: (value: FigureRows) => value.headWorld(new THREE.Vector3()),
      advance: (value: FigureRows) => { value.syncAnchors(); },
      open: () => { w.audio.weaponSwap(); }, stow: (on: boolean) => { h.weapons.stowed = on; },
      approach: { at: (value: FigureRows) => value.group.position, run: (value: FigureRows) => { value.signal(row.approach); } },
    }];
  }));
  const talks = installStoryTalks(new QuestViews(ctx), declaration, { flags, scene: w.game.scene, registry: w.registry,
    prompts: w.prompts, calls: new Map(), figures });
  if (talks.people.length === 0) throw new Error('Quest requires its declared speaker');
  adventure.spine = { ...chapter, get places() { return chapter.places; }, get dialogue() { return talks.dialogue(); } };
  onDeath(bindQuestDeathEffects<Animal>(rows.deaths, { flags, toast: text => { w.hud.toast(text); },
    calls: new Map(rows.deathMoves.map(row => [row.effect, (body: Animal) => { kit.moveTo(row.target, body.position.x, body.position.z); }])) }), 10);
  w.game.onUpdate((dt, t) => {
    talks.update(dt, t, w.player.position);
    if (!practiceRoom.open) chapter.chip.update(t, w.player);
  }, rows.systems.talks);
  onDeath(animal => { grants.kill(animal.kind); }, 35);
  const stall = parseQuestTrader(traderStall), placement = stall.placement;
  if (placement === undefined) throw new Error('Page trader requires its declared placement');
  const feet = place(placement.feet), ax = feet.x + Math.sin(feet.yaw) * placement.tradeAhead, az = feet.z + Math.cos(feet.yaw) * placement.tradeAhead;
  adventure.trader = installQuestTrader(ctx, traderStall, { figure: rows.trader.figure, counter: rows.trader.counter, offer: rows.trader.offer,
    at: { x: ax, y: floorAt(ax, az) + placement.tradeHeight, z: az }, prompt: { label: rows.trader.label, radius: rows.trader.radius }, before: rows.systems.before });
  const storyOwners = new Map<string, unknown>([['counters', grants], ['hud', w.hud], ['placement', { floorAt }]]);
  observeStoryFlags(story, scope, flags, storyOwners);
  bindStoryBench(story, kit, w.player, storyOwners);
  w.ironDrop?.bindGuardFlags(flags.all);
  {
    const placed = await scenes.place(rows.cable.scene), cables = cableModes(ctx.scope), mode = rows.cable.mode;
    const prompt = cables.bindView(mode, scenes.mesh(rows.cable.carriage), w.player, { position: scenes.vector(rows.cable.prompt), radius: rows.cable.radius, label: rows.cable.label });
    const zip = { group: placed.object, placed, prompt, cables, mode, a: scenes.vector(rows.cable.a), b: scenes.vector(rows.cable.b) };
    w.game.scene.add(zip.group);
    w.prompts.push(zip.prompt);
    w.game.onUpdate((dt) => {
      zip.cables.update(zip.mode, dt);
      for (const on of zip.cables.takeTransitions(zip.mode)) {
        h.weapons.visible = !on;
        sfx.interact(on ? 'lever' : 'plate', on ? zip.a : zip.b);
      }
    }, rows.systems.cable);
    adventure.zipline = zip;
    adventure.setAnchor(rows.cable.publish, { x: scenes.vector(rows.cable.anchor).x, z: scenes.vector(rows.cable.anchor).z });
  }

  const places = chapter.discover(content.places.map(site => { const p = place(site.at);
    return { id: site.id, label: site.label, x: p.x, z: p.z, r: site.r, quiet: rows.quietPlaces.includes(site.id) }; }));
  adventure.places = places;
  let guide: PlaceGuide<Places['points'][number]> | null = null;
  if (d.flock !== null) {
    const flock = d.flock; guide = new PlaceGuide<Places['points'][number]>({ distance: 'edge', min: 0, schedule: { kind: 'idle', ...content.guide } },
      { points: () => places.points, discovered: places.discovered, position: () => w.player.position,
        fly: (target: { readonly x: number; readonly z: number }) => flock.guide(w.player.position, target.x, target.z) });
    const liveGuide = guide;
    w.game.onUpdate(dt => { if (dt > 0 && w.hud.entered && !w.hud.paused && w.player.position.y <= rows.guideHeight)
      liveGuide.update(dt, Math.hypot(w.player.velocity.x, w.player.velocity.z)); }, rows.systems.guide);
  }
  adventure.complete = installCompletion(ctx, flags, w.progress, adventure.spine.objective.root, anchors);   // before the finale: its reward hands over to the card
  const pool = place(rows.boss.pool);
  const finale = await installChapterWakeEncounter(ctx, await ctx.product.json(rows.files.encounter), pool);
  scope.onDispose(flags.onChange((flag, on) => { w.ironDrop?.bindGuardFlags(flags.all); if (on && !flag.startsWith('plate:')) guide?.progressed(); }));
  setAnchor(rows.boss.reward, finale.rewardAt);
  adventure.finale = { get actor() { return finale.actor; }, rewardAt: finale.rewardAt, rewardPose: finale.rewardPose };
  adventure.ecology = installPageReturns(ctx, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file(rows.files.returns))));

  const bridge = w.registry.get(rows.sway.piece);
  if (bridge !== undefined) {
    let sway = 0, bt = 0;
    w.game.onUpdate((dt) => {
      const p = w.player.position, f = bridge.floor?.(p.x, p.z);
      const on = f !== undefined && Math.abs(p.y - f) < rows.sway.height;
      sway += ((on ? 1 : 0) - sway) * Math.min(1, dt * rows.sway.ease);
      if (sway < rows.sway.threshold) return;
      bt += dt * (rows.sway.rate + Math.hypot(w.player.velocity.x, w.player.velocity.z) * rows.sway.speed);
      w.game.camera.rotation.z += Math.sin(bt * rows.sway.rollHz) * rows.sway.roll * sway;
      w.game.camera.position.y += Math.sin(bt * rows.sway.dipHz) * rows.sway.dip * sway;
    }, rows.systems.sway);
  }
  let placeT = 0;
  w.game.onUpdate((_dt, t) => { if (t - placeT > rows.placeInterval) { placeT = t; places.update(w.player.position.x, w.player.position.z); } }, rows.systems.places);
  ctx.debug.expose(rows.debug, { content, flags, kit, spine: adventure.spine, places, finale: adventure.finale,
    ecology: adventure.ecology, complete: adventure.complete, trader: adventure.trader });
  if (rows.presentation?.mapPois === true) h.fullMap.setPois(places.mapPois, { tally: true });
  if (rows.presentation?.flags === true) page.shell.hooks.adventureFlags = () => flags.all.slice().sort();
  if (rows.presentation?.hints !== undefined && h.firstHints !== undefined)
    installQuestHints(ctx, await ctx.product.json(rows.presentation.hints), new Map([['quest', { hints: h.firstHints, animals: h.animals, player: page.world.player, ui: ctx.app.ui }]]));
  return adventure;
}

/** Modal policy over the entered HUD/equipment owner; no shard hooks cross it. */
export function questPagePanelHold(ctx: ShardContext, input: unknown): (on: boolean) => void {
  const row = v.parse(v.strictObject({ restartOnClose: v.boolean(), stow: v.boolean(), resumeSwimming: v.boolean() }), input);
  const world = ctx.game.runtime?.world, play = ctx.game.runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null) throw new Error('Quest modal requires its entered owner');
  return new QuestViews(ctx).panelHold({ hud: play.hud, weapons: play.weapons, menu: play.menu, nolock: play.nolock, touchUi: play.touchUi,
    restartOnClose: row.restartOnClose,
    stow: on => { if (row.stow) play.weapons.stowed = on; },
    resume: () => { play.weapons.setEnabled(!row.resumeSwimming || !world.player.swimming); } });
}
