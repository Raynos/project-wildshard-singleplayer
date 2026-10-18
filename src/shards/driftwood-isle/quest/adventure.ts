import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { readQuestServiceActions } from '@wildshard/game/quest/effects';
import { cableModes } from '@wildshard/engine/player/modes';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import * as THREE from 'three';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactables, InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import { createQuestPlacements, type Interactable, type InteractTable, type Place } from '@wildshard/engine/world/interact/types';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ITEMS } from '@wildshard/game/bag/itemCatalog';
import type { ItemId } from '@wildshard/game/Inventory';
import type { ShardContext } from '@wildshard/game/shard/context';
import frames from '../data/questFrames.json' with { type: 'json' };
import DRIFTWOOD_KIT_EVENTS from '../data/questEvents.json' with { type: 'json' };
import type { DialogueBox } from '@wildshard/engine/quest/view/ui';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { QuestViews, type QuestNpcTalkPorts } from '@wildshard/game/plugin/ui';
import { bindQuestDeathEffects } from '@wildshard/game/plugin/quests';
import { installQuestChapter, installQuestFlags, installQuestInteractables, ownQuestTree, type QuestChapter } from '@wildshard/game/quest/chapter';
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
import { installCompletion, type Completion as Complete } from '@wildshard/game/complete/declared';
import { installPageReturns } from '@wildshard/game/population/pageReturns';
import type { RespawnQueueInstance as RespawnQueue } from '@wildshard/sdk/populationRespawn';
import type { Placed } from '@wildshard/engine/models/place';
import { driftwoodWorld } from '../world/build';
import { HeldClaims } from '@wildshard/game/loadout/claims';

/** The adventure's existing borrowed boss view and its baked reward pose. */
export interface Finale { readonly captain: Pick<AdvAnimal, 'kind' | 'position' | 'mem' | 'hp' | 'maxHp' | 'alive'> | null; rewardAt: THREE.Vector3; rewardPose: { yaw: number; pitch: number; phase: number } }
interface Zipline { group: THREE.Object3D; placed: Placed; a: THREE.Vector3; b: THREE.Vector3; prompt: Interactable; cables: ReturnType<typeof cableModes>; mode: string }


/** a named point a model module exports (`anchors`, world coords) for the adventure to place things at */
export interface Anchor { x: number; y?: number; z: number; yaw?: number }
/** what the adventure reads of an animal (Animal.ts satisfies it) */
export interface AdvAnimal { kind: string; variant?: string; position: THREE.Vector3; mem: Record<string, number>; hp: number; maxHp: number; alive: boolean; herd: number; aggressive?: boolean; combatActor?: () => Actor }

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


/** Entered page composition borrows the actual world/play services. Quest rows,
 * chapter progression and v8 native continuation keep their existing owners. */
export async function installAdventure(ctx: ShardContext): Promise<Adventure> {
  const shell = ctx.game.runtime, world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Driftwood adventure requires the play host');
  const { InteractSfx } = await import('@wildshard/engine/audio/interactSfx');
  if (ctx.scope.disposed) throw new Error('Driftwood adventure left while admitting its interactables');
  const scope = ctx.scope, declaration = ctx.product.shardfile, d = driftwoodWorld(shell);
  // Delegate the getters: spreading Game loses its live regional scene/camera.
  const w = { ...world, ...h, chunk: ctx.manifest, prompts: shell.interactables,
    game: { get scene() { return world.game.scene; }, get camera() { return world.game.camera; },
      onUpdate: (run: (dt: number, time: number) => void, id: string): void => { ctx.system({ id, phase: 'update', before: ['game.loot', 'body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world'], run }); } },
    pois: { hut: d.hut === null ? null : { anchors: d.hut.anchors }, lookout: d.lookout === null ? null : { anchors: d.lookout.anchors },
      wreck: d.wreck === null ? null : { anchors: d.wreck.anchors }, shrine: d.shrine === null ? null : { anchors: d.shrine.anchors }, cave: d.cove === null ? null : { anchors: d.cove.anchors } },
    ironDrop: HeldClaims.current(ctx.manifest.slug).claim('iron-sword') };
  const onDeath = (run: (animal: AdvAnimal) => void, order: number): void => { ctx.on('actor.died', ({ actor }) => {
    const animal = h.animals.animals.find(a => a.combatActor() === actor); if (animal !== undefined) run(animal);
  }, { order }); };
  const story = await readQuestStory(ctx);
  const services = await readQuestServiceActions(ctx, story.quest.id, 'quests/services.json');
  const content = parseAdventureContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/discovery.json'))));
  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/stall.json')));
  const traderRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/trader.json'))));
  const flags = installQuestFlags(ctx, story.quest.id, w.chunk.slug);
  if (w.params.has('resetquest')) flags.reset();

  const { floorAt, place, setAnchor, anchors } = createQuestPlacements({ terrain: heightAt, platforms: w.player.platforms, frames, pois: w.pois, registry: w.registry });

  const assembly = await ctx.product.json<{ constants: { interact: InteractTable; interactSpots: unknown } }>('sim/headless-assembly.json');
  const kit = await installQuestInteractables(ctx, story.quest.id, { table: assembly.constants.interact,
    placements: assembly.constants.interactSpots, platforms: true });
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
    open: () => { w.audio.weaponSwap(); }, stow: on => { h.weapons.stowed = on; },
    approach: { at: figure => figure.position, run: figure => { figure.wave(); } },
  }]]);
  const talks = installStoryTalks(new QuestViews(ctx), declaration, { flags, scene: w.game.scene, registry: w.registry,
    prompts: w.prompts, calls: new Map(), figures });
  if (talks.people.length === 0) throw new Error('Quest requires its declared speaker');
  adventure.spine = { ...chapter, get places() { return chapter.places; }, get dialogue() { return talks.dialogue(); } };
  onDeath(bindQuestDeathEffects<AdvAnimal>(deathRows.page, { flags, toast: text => { w.hud.toast(text); },
    calls: new Map([['hold-key', body => { kit.moveTo('hold-key', body.position.x, body.position.z); }]]) }), 10);
  w.game.onUpdate((dt, t) => {
    talks.update(dt, t, w.player.position);
    if (!practiceRoom.open) chapter.chip.update(t, w.player);
  }, 'shard.driftwood-isle.installSpine');
  onDeath(animal => { grants.kill(animal.kind); }, 35);
  adventure.trader = installQuestTrader(traderStall, { player: w.player, placed: { scope, sky: w.sky,
    registry: w.registry,
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
        h.weapons.visible = !on;
        sfx.interact(on ? 'lever' : 'plate', on ? zip.a : zip.b);
      }
    }, 'shard.driftwood.adventure.2');
    adventure.zipline = zip;
    adventure.setAnchor('lookout.zipline', { x: scenes.vector('zipline.anchor').x, z: scenes.vector('zipline.anchor').z });
  }

  const places = chapter.discover(content.places.map(site => { const p = place(site.at);
    return { id: site.id, label: site.label, x: p.x, z: p.z, r: site.r, quiet: site.id === 'pier' }; }));
  adventure.places = places;
  let guide: PlaceGuide<Places['points'][number]> | null = null;
  if (d.gulls) {
    const gulls = d.gulls; guide = new PlaceGuide<Places['points'][number]>({ distance: 'edge', min: 0, schedule: { kind: 'idle', ...content.guide } },
      { points: () => places.points, discovered: places.discovered, position: () => w.player.position,
        fly: (target: { readonly x: number; readonly z: number }) => gulls.guide(w.player.position, target.x, target.z) });
    const liveGuide = guide;
    w.game.onUpdate(dt => { if (dt > 0 && w.hud.entered && !w.hud.paused && w.player.position.y <= 300)
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
        services.run('captain-wake'); w.music.combat(1);
      } else if (cue === 'captain.dead') services.run('captain-dead');
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
  if (d.bridge) {
    const bridge = d.bridge; let sway = 0, bt = 0;
    w.game.onUpdate((dt) => {
      const p = w.player.position, f = bridge.floorHeightAt(p.x, p.z);
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
