import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { readQuestServiceActions } from '@wildshard/game/quest/effects';
import { cableModes } from '@wildshard/engine/player/modes';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { MapPoi, MapQuest } from '@wildshard/engine/ui/Map';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactables, InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import { createQuestPlacements, type Interactable, type Place } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ITEMS } from '@wildshard/game/bag/itemCatalog';
import type { ItemId } from '@wildshard/game/Inventory';
import type { Progress, ProgressSink } from '@wildshard/game/Progress';
import type { ShardContext } from '@wildshard/game/shard/context';
import frames from '../data/questFrames.json' with { type: 'json' };
import DRIFTWOOD_KIT_EVENTS from '../data/questEvents.json' with { type: 'json' };
import { installAdventureInteractables } from './interactLifetime';
import type { DialogueBox } from '@wildshard/engine/quest/view/ui';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { QuestViews, type QuestNpcTalkPorts } from '@wildshard/game/plugin/ui';
import { bindQuestDeathEffects } from '@wildshard/game/plugin/quests';
import { installQuestChapter, installQuestFlags, ownQuestTree, type QuestChapter } from '@wildshard/game/quest/chapter';
import { Castaway } from '../runtime/npc/Castaway';
import deathRows from '../data/questDeaths.json' with { type: 'json' };
import { readQuestStory, bindStoryAchievements, observeStoryFlags, bindStoryBench, installStoryTalks } from '@wildshard/game/quest/story';
import { installQuestTrader, type QuestTrader } from '@wildshard/game/quest/trader';
import { trader, tradeCounter, traderRigOf } from '../runtime/models/trader';
import { bindRuntimeBoss } from '@wildshard/game/shardfile/hybridRows';
import { PlaceGuide, type Places } from '@wildshard/engine/quest/view';
import { parseAdventureContent, type AdventureContent } from '@wildshard/format/questStory';
import { readChapterDirector } from '@wildshard/game/quest/chapterDirector';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { WakeBossEncounter } from '@wildshard/game/boss/wake';
import { presentWakeBoss } from '@wildshard/game/boss/presentation';
import { driftwoodRows } from '../runtime/boot/rows';
import { installCompletion, type Completion as Complete, type CompletionProgress as CompleteProgress } from '@wildshard/game/complete/declared';
import { installPageReturns } from '@wildshard/game/population/pageReturns';
import type { RespawnQueueInstance as RespawnQueue } from '@wildshard/sdk/populationRespawn';
import type { Placed } from '@wildshard/engine/models/place';

/** The adventure's existing borrowed boss view and its baked reward pose. */
export interface Finale { readonly captain: Pick<AdvAnimal, 'kind' | 'position' | 'mem' | 'hp' | 'maxHp' | 'alive'> | null; rewardAt: THREE.Vector3; rewardPose: { yaw: number; pitch: number; phase: number } }
interface Zipline { group: THREE.Object3D; placed: Placed; a: THREE.Vector3; b: THREE.Vector3; prompt: Interactable; cables: ReturnType<typeof cableModes>; mode: string }


/** a named point a model module exports (`anchors`, world coords) for the adventure to place things at */
export interface Anchor { x: number; y?: number; z: number; yaw?: number }
/** what the adventure reads of an animal (Animal.ts satisfies it) */
export interface AdvAnimal { kind: string; variant?: string; position: THREE.Vector3; mem: Record<string, number>; hp: number; maxHp: number; alive: boolean; herd: number; aggressive?: boolean; combatActor?: () => Actor }

export interface AdventureWorld<A extends AdvAnimal = AdvAnimal> {
  game: { scene: THREE.Scene; camera: THREE.Camera; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  sky: Sky;
  player: { position: THREE.Vector3; velocity: THREE.Vector3; yaw: number; pitch: number; carried: boolean; platforms: ((x: number, z: number) => number | undefined)[] };
  chunk: { slug: string; next?: string };
  scope?: Scope;
  onDeath?: (run: (animal: A) => void, order: number) => void;
  debug?: ShardContext['debug'];
  /** main.ts's interactable list ("[E] …" prompts, the touch USE button) */
  prompts: Interactable[];
  /** the HUD: toasts; the complete card (E132) resumes play through `onResume` (the pause menu's close) and leaves by `exitToMenu` */
  hud: { toast: (text: string) => void; onResume?: (() => void) | undefined; exitToMenu?: () => void; readonly entered?: boolean; readonly paused?: boolean };
  /** the game's Audio: the kit's sounds are InteractSfx.interact (S4) — chests, locks, levers, plates, doors, pickups, the beacon */
  audio: Audio;
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void; combat?: (intensity: number) => void };
  inventory: { add: (id: ItemId, n?: number) => void };
  pois: Partial<Record<Exclude<Place['poi'], 'world'>, object | null>>;
  /** Creature views for scoped death listeners and authored respawns. */
  animals: { animals?: A[]; spawn?: (kind: string, x: number, z: number, yaw: number, variant?: string) => A; herds?: { cx: number; cz: number; members: A[] }[] };
  params?: URLSearchParams;
  /** shard achievements (Progress.recordEvent) — the adventure's event achievements (A4) */
  progress?: ProgressSink & CompleteProgress & Partial<Pick<Progress, 'bindLedger' | 'refreshLedger'>>;
  /** the full map (the menu's MAP tab): shows the island's places with discovery + the quest markers (A5), and the quest card (E51) */
  fullMap?: { setPois: (source: () => MapPoi[], opts?: { tally?: boolean }) => void; setQuest?: (source: () => MapQuest | null) => void };
  /** the island's gulls: three fly you toward the nearest unfound place when you wander or idle (E309 B, gullGuide.ts) */
  gulls?: { guide: (player: THREE.Vector3, tx: number, tz: number) => boolean } | null;
  /** the held claim in the wreck's hold — guarded until the drowned sailor is beaten (B4 / D6) */
  /** the rope bridge's walkable floor (RopeBridge.floorHeightAt) — the camera sways while you cross (A7) */
  bridgeFloor?: ((x: number, z: number) => number | undefined) | undefined;
  /** the world registry (PHYSICS P4): registered pieces' floors for placement; a piece added here collides */
  registry?: WorldRegistry | undefined;
  /** show / hide the weapon viewmodel (the golden-hour reward view lowers it) */
  setViewmodel?: (on: boolean) => void;
  /** lower the held weapon out of the frame and turn its input off while a dialogue is open (E129); false raises it */
  stowWeapon?: (on: boolean) => void;
  ironDrop?: { bindGuardFlags: (flags: readonly string[]) => void } | null;
}

export interface Adventure {
  readonly content: AdventureContent;
  flags: Flags;
  kit: Interactables;
  /** the quest spine (A1): quest state, objective line, the castaway — set once installed */
  spine: (QuestChapter & { readonly dialogue: DialogueBox }) | null;
  /** the island's named places + discovery (A5) */
  places: Places | null;
  /** the Drowned Captain + the golden-hour reward (A6) */
  finale: Finale | null;
  /** enemies coming back after a kill (A6) */
  ecology: RespawnQueue | null;
  /** the "Driftwood complete" card after the reward view (E132) */
  complete: Complete | null;
  /** the lookout → cove zipline (A7) */
  zipline: Zipline | null;
  /** the trader at Wendell's hut (E314): the loot hands her the shop screen (src/game/loot/runtime.ts) */
  trader: QuestTrader | null;
  place: (p: Place) => { x: number; y: number; z: number; yaw: number };
  floorAt: (x: number, z: number) => number;
  /** register a computed anchor (`<poi>.<name>`) that placements and quest markers can name */
  setAnchor: (name: string, a: Anchor) => void;
}


/**
 * The adventure's view of the Game with its own update registration. Never spread the Game: `scene` (and `camera`) may
 * be prototype getters (SF47's `Game.scene` resolves the bound regional frame), which an object spread drops, leaving
 * `scene` undefined. Delegating getters keep the live resolution.
 */
export function adventureGame(game: AdventureWorld['game'], onUpdate: AdventureWorld['game']['onUpdate']): AdventureWorld['game'] {
  return { get scene() { return game.scene; }, get camera() { return game.camera; }, onUpdate };
}

/** Driftwood Isle's adventure (plan Track A): the castaway spine, feats, places, the captain's finale, the zipline */
export async function installAdventure<A extends AdvAnimal>(ctx: ShardContext, source: AdventureWorld<A>): Promise<Adventure> {
  const { InteractSfx } = await import('@wildshard/engine/audio/interactSfx');
  const scope = ctx.scope, declaration = ctx.product.shardfile; // the admitted declaration (W2b: never shard.config)
  const w: AdventureWorld<A> = { ...source, scope, debug: ctx.debug, game: adventureGame(source.game, (run, label) => { ctx.system({ id: label ?? 'shard.driftwood.adventure', phase: 'update', before: ['game.loot', 'body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world'], run }); }),
    onDeath: (run, order) => { ctx.on('actor.died', ({ actor }) => { const animal = source.animals.animals?.find((a) => a.combatActor?.() === actor); if (animal !== undefined) run(animal); }, { order }); } };
  const story = await readQuestStory(ctx);
  const services = await readQuestServiceActions(ctx, story.quest.id, 'quests/services.json');
  const content = parseAdventureContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/discovery.json'))));
  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/stall.json')));
  const traderRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/trader.json'))));
  const flags = installQuestFlags(ctx, story.quest.id, w.chunk.slug);
  if (w.params?.has('resetquest')) flags.reset();

  const { floorAt, place, setAnchor, anchors } = createQuestPlacements({ terrain: heightAt, platforms: w.player.platforms, frames, pois: w.pois,
    ...(w.registry === undefined ? {} : { registry: w.registry }) });

  const kit = await installAdventureInteractables(scope, { scene: w.game.scene, sky: w.sky, player: w.player, flags, place, floorAt, prompts: w.prompts });
  w.game.onUpdate((dt, t) => kit.update(dt, t), 'shard.driftwood.adventure');

  const isItem = (id: string | undefined): id is ItemId => id !== undefined && id in ITEMS;
  const sfx = new InteractSfx(w.audio);
  kit.onEvent = sfx.bindEvents(DRIFTWOOD_KIT_EVENTS, { toast: text => { w.hud.toast(text); },
    item: id => isItem(id) ? { label: ITEMS[id].label, add: n => { w.inventory.add(id, n); } } : null,
    calls: new Map<string, (e: InteractEvent) => void>([
      ['glass', () => { services.run('glass'); }],
      ['pickup', () => { services.run('pickup'); }],
    ]) });

  const adventure: Adventure = { content, flags, kit, place, floorAt, spine: null, places: null, finale: null, ecology: null, complete: null, zipline: null, trader: null, setAnchor };
  const grants = await bindStoryAchievements(ctx, story, w.progress, w.chunk.slug);
  const feet = place({ poi: 'hut', anchor: 'hut.npc', x: 2.4, z: -8.2, yaw: Math.PI + 0.35 });
  const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), residentWorldScope(ctx));
  const npc = new Castaway(w.sky, feet, place({ poi: 'hut', x: 0.7, z: -9.8 }), scenes).build(ctx.scope);
  const placements = Object.fromEntries(Object.values(story.quest.markers).map(at => {
    const p = place(at); return [JSON.stringify(at), { x: p.x, y: p.y, z: p.z }];
  }));
  const chapter = installQuestChapter(ctx, story, { placements, completion: true, remainingLabel: 'Still to find' }, anchors);
  const figures: QuestNpcTalkPorts<typeof npc.model>['figures'] = new Map([['castaway', {
    kind: 'borrowed', create: () => npc.model,
    own: (figure, register) => { ownQuestTree(figure.group, scope); scope.run(register); },
    at: figure => { figure.group.updateMatrixWorld(true); return figure.headWorld(new THREE.Vector3()); },
    advance: (_figure, dt, time, player) => { npc.update(dt, time, player); },
    open: () => { w.audio.weaponSwap(); }, stow: on => { w.stowWeapon?.(on); },
    approach: { at: figure => figure.position, run: figure => { figure.wave(); } },
  }]]);
  const talks = installStoryTalks(new QuestViews(ctx), declaration, { flags, scene: w.game.scene, registry: w.registry ?? ctx.app.registry,
    prompts: w.prompts, calls: new Map(), figures });
  if (talks.people.length === 0) throw new Error('Quest requires its declared speaker');
  adventure.spine = { ...chapter, get places() { return chapter.places; }, get dialogue() { return talks.dialogue(); } };
  w.onDeath?.(bindQuestDeathEffects<A>(deathRows.page, { flags, toast: text => { w.hud.toast(text); },
    calls: new Map([['hold-key', body => { kit.moveTo('hold-key', body.position.x, body.position.z); }]]) }), 10);
  w.game.onUpdate((dt, t) => {
    talks.update(dt, t, w.player.position);
    if (!practiceRoom.open) chapter.chip.update(t, w.player);
  }, 'shard.driftwood-isle.installSpine');
  w.onDeath?.(animal => { grants.kill(animal.kind); }, 35);
  adventure.trader = installQuestTrader(traderStall, { player: w.player, placed: { scope, sky: w.sky,
    ...(w.registry === undefined ? {} : { registry: w.registry }),
    owners: new Map<string, unknown>([['placement', { place, floorAt }], ['game', w.game], ['hud', w.hud]]),
    models: new Map([['trader', { model: trader, name: 'The trader' }], ['trade-counter', { model: tradeCounter, name: "The trader's counter", solidFloor: false }]]),
    figures: new Map([['trader', traderRigOf]]), page: { rows: traderRows, flags, prompts: w.prompts },
  } });
  const storyOwners = new Map<string, unknown>([['counters', grants], ['hud', w.hud], ['placement', { floorAt }]]);
  observeStoryFlags(story, scope, flags, storyOwners);
  bindStoryBench(story, kit, w.player, storyOwners);
  w.ironDrop?.bindGuardFlags(flags.all);
  // ── A7: the zipline — a launch deck on the headland's cliff lip, on the line from the lookout platform to the sea cave,
  // down to the cove beach west of the cave mouth (the headland's 34 m shelf rules out a cable straight off the platform) ──
  {
    const placed = await scenes.place('harbour.zipline'), cables = cableModes(ctx.scope), mode = 'driftwood.zipline';
    const prompt = cables.bindView(mode, scenes.mesh('zipline.carriage'), w.player, { position: scenes.vector('zipline.prompt'), radius: 2.4, label: 'Ride the zipline' });
    const zip = { group: placed.object, placed, prompt, cables, mode, a: scenes.vector('zipline.a'), b: scenes.vector('zipline.b') };
    w.game.scene.add(zip.group);
    w.prompts.push(zip.prompt);
    w.game.onUpdate((dt) => {
      zip.cables.update(zip.mode, dt);
      for (const on of zip.cables.takeTransitions(zip.mode)) {
        w.setViewmodel?.(!on);
        sfx.interact(on ? 'lever' : 'plate', on ? zip.a : zip.b);
      }
    }, 'shard.driftwood.adventure.2');
    adventure.zipline = zip;
    adventure.setAnchor('lookout.zipline', { x: scenes.vector('zipline.anchor').x, z: scenes.vector('zipline.anchor').z });
  }

  const places = chapter.discover(content.places.map(d => { const p = place(d.at);
    return { id: d.id, label: d.label, x: p.x, z: p.z, r: d.r, quiet: d.id === 'pier' }; }));
  adventure.places = places;
  w.fullMap?.setPois(places.mapPois, { tally: true });   // E309 A: "PLACES n / N" in the map's corner
  let guide: PlaceGuide<Places['points'][number]> | null = null;
  if (w.gulls) {
    const gulls = w.gulls; guide = new PlaceGuide<Places['points'][number]>({ distance: 'edge', min: 0, schedule: { kind: 'idle', ...content.guide } },
      { points: () => places.points, discovered: places.discovered, position: () => w.player.position,
        fly: (target: { readonly x: number; readonly z: number }) => gulls.guide(w.player.position, target.x, target.z) });
    const liveGuide = guide;
    w.game.onUpdate(dt => { if (dt > 0 && w.hud.entered !== false && w.hud.paused !== true && w.player.position.y <= 300)
      liveGuide.update(dt, Math.hypot(w.player.velocity.x, w.player.velocity.z)); }, 'shard.driftwood-isle.installGullGuide');
  }
  adventure.complete = installCompletion(ctx, flags, w.progress, adventure.spine.objective.root, anchors);   // before the finale: its reward hands over to the card
  const captain = bindRuntimeBoss(ctx, declaration, 'driftwood.captain', undefined, { identity: 'runtime' });
  const finale = await readChapterDirector(ctx, 'quests/chapter-director.json');
  if (finale.rewardAt === null || finale.rewardPose === undefined) throw new Error('The finale requires its baked reward pose');
  const pool = place({ poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 8 });
  const view = driftwoodRows('custom/fixedLayouts').nativeView, bar = scope.run(() => new BossBar());
  const encounter = new WakeBossEncounter(view.BOSS_ENCOUNTER, pool);
  let body: AdvAnimal | null = null;
  const spawn = (): void => {
    if (body !== null) return;
    try {
      body = captain.spawn(); if (body === null) throw new Error('Captain spawn host unavailable');
      body.herd = -1; body.mem['poolX'] = pool.x; body.mem['poolZ'] = pool.z; body.mem['arena'] = view.CAPTAIN_ARENA_R;
    } catch (error) { console.error('[finale] the captain failed to spawn', error); flags.set('dead:captain'); }
  };
  const observation = () => ({ player: w.player.position, animal: body === null ? null : { position: body.position, mem: body.mem, hp: body.hp, maxHp: body.maxHp, alive: body.alive }, wake: flags.has(encounter.row.wakeFlag), dead: flags.has(encounter.row.deadFlag) });
  const present = (): void => { presentWakeBoss(encounter, bar, ctx.app.events); };
  const cues = (): void => {
    for (const cue of finale.takeCues()) {
      if (cue === 'captain.restore') spawn();
      else if (cue === 'captain.wake') {
        spawn(); encounter.wake(observation()); present();
        w.hud.toast('The pool boils — the Drowned Captain rises!'); w.music.combat?.(1);
      } else if (cue === 'captain.dead') { w.hud.toast('Captain Brine sinks for good. The ring hums — go and stand in it'); w.music.sting('chunk'); }
    }
  };
  flags.onChange((flag, on) => { w.ironDrop?.bindGuardFlags(flags.all); if (on && !flag.startsWith('plate:')) guide?.progressed(); cues(); });
  ctx.app.encounters.register({ id: view.CAPTAIN_ID, displayName: view.CAPTAIN_NAME }, scope);
  ctx.app.encounters.boss(view.CAPTAIN_ID, encounter, scope);
  ctx.on('player.died', () => { encounter.onPlayerDeath(w.player.position); present(); });
  setAnchor('shrine.reward', finale.rewardAt);
  adventure.finale = { get captain() { return body === null ? null : { kind: body.kind, position: body.position, mem: body.mem, hp: body.hp, maxHp: body.maxHp, alive: body.alive }; }, rewardAt: finale.rewardAt, rewardPose: finale.rewardPose };
  cues();
  w.game.onUpdate(dt => { bar.update(dt); encounter.update(observation()); present(); }, 'shard.driftwood-isle.installFinale');
  w.game.onUpdate(dt => { finale.update(dt); cues(); }, 'shard.driftwood.director');
  adventure.ecology = installPageReturns(ctx, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('sim/returns.json'))));

  // ── A7: the rope bridge sways under you — a slow roll + a little dip on the camera while your feet are on its planks ──
  if (w.bridgeFloor) {
    const bf = w.bridgeFloor; let sway = 0, bt = 0;
    w.game.onUpdate((dt) => {
      const p = w.player.position, f = bf(p.x, p.z);
      const on = f !== undefined && Math.abs(p.y - f) < 0.35;
      sway += ((on ? 1 : 0) - sway) * Math.min(1, dt * 3);
      if (sway < 0.001) return;
      bt += dt * (0.8 + Math.hypot(w.player.velocity.x, w.player.velocity.z) * 0.25);
      w.game.camera.rotation.z += Math.sin(bt * 1.7) * 0.018 * sway;
      w.game.camera.position.y += Math.sin(bt * 3.4) * 0.025 * sway;
    }, 'shard.driftwood.adventure.3');
  }
  let placeT = 0;
  w.game.onUpdate((_dt, t) => { if (t - placeT > 0.25) { placeT = t; places.update(w.player.position.x, w.player.position.z); } }, 'shard.driftwood.adventure.4');
  ctx.debug.expose('driftwood.adventure', { content, flags, kit, spine: adventure.spine, places, finale: adventure.finale,
    ecology: adventure.ecology, complete: adventure.complete, trader: adventure.trader });
  return adventure;
}
