import { cableModes } from '@wildshard/engine/player/modes';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { MapPoi, MapQuest } from '@wildshard/engine/ui/Map';
import { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactables, InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import { createQuestPlacements, type Interactable, type Place } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ITEMS } from '@wildshard/game/bag/itemCatalog';
import type { ItemId } from '@wildshard/game/Inventory';
import type { Progress, ProgressSink } from '@wildshard/game/Progress';
import type { ShardContext } from '@wildshard/game/shard/context';
import { OCEAN } from '../world/sites';
import frames from '../data/questFrames.json' with { type: 'json' };
import { DRIFTWOOD_KIT_EVENTS } from '../data/questEvents';
import interactables from '../data/interactables.generated.json' with { type: 'json' };
import { installAdventureInteractables } from './interactLifetime';
import { installPlaces } from './Places';
import { installSpine, ownEnteredTree, type Spine } from './Spine';
import { readQuestStory, bindStoryAchievements, observeStoryFlags, bindStoryBench } from '@wildshard/game/quest/story';
import { installQuestTrader, type QuestTrader } from '@wildshard/game/quest/trader';
import { trader, tradeCounter, traderRigOf } from '../runtime/models/trader';
import { bindRuntimeBoss } from '@wildshard/game/shardfile/hybridRows';
import { PlaceGuide, type Places } from '@wildshard/engine/quest/view';
import { parseAdventureContent, type AdventureContent } from '@wildshard/format/questStory';
import { installDirectorFinale, type Finale } from '../runtime/finalePresentation';
import { installCompletion, type Completion as Complete, type CompletionProgress as CompleteProgress } from '@wildshard/game/complete/declared';
import { installEcology } from './Ecology';
import type { RespawnQueue } from '../runtime/ecology';
import { Zipline } from '../world/Zipline';
import { ironSwordGuard, SWORD_GUARDED } from './guards';

const { SEA_GLASS_COUNT, SEA_GLASS_FLAG } = interactables;

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
  /** the iron sword in the wreck's hold (IronSword.ts) — guarded until the drowned sailor is beaten (B4 / D6) */
  /** the rope bridge's walkable floor (RopeBridge.floorHeightAt) — the camera sways while you cross (A7) */
  bridgeFloor?: ((x: number, z: number) => number | undefined) | undefined;
  /** the world registry (PHYSICS P4): registered pieces' floors for placement; a piece added here collides */
  registry?: WorldRegistry | undefined;
  /** show / hide the weapon viewmodel (the golden-hour reward view lowers it) */
  setViewmodel?: (on: boolean) => void;
  /** lower the held weapon out of the frame and turn its input off while a dialogue is open (E129); false raises it */
  stowWeapon?: (on: boolean) => void;
  ironDrop?: { guard: (() => string | null) | null; onGuarded?: ((reason: string) => void) | undefined } | null;
}

export interface Adventure {
  readonly content: AdventureContent;
  flags: Flags;
  kit: Interactables;
  /** the quest spine (A1): quest state, objective line, the castaway — set once installed */
  spine: Spine | null;
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
  const content = parseAdventureContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/discovery.json'))));
  const traderStall: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/stall.json')));
  const traderRows = parseQuestPageInteractions(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/trader.json'))));
  const flags = new Flags(w.chunk.slug);
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
      ['glass', () => { w.hud.toast(`Sea glass · ${flags.count(SEA_GLASS_FLAG)} / ${SEA_GLASS_COUNT}`); }],
      ['pickup', () => { w.music.sting('pickup'); }],
    ]) });

  const adventure: Adventure = { content, flags, kit, place, floorAt, spine: null, places: null, finale: null, ecology: null, complete: null, zipline: null, trader: null, setAnchor };
  const grants = await bindStoryAchievements(ctx, story, w.progress, w.chunk.slug);
  adventure.spine = installSpine(adventure, w, ctx, grants.facts, declaration, story);
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
  if (w.ironDrop) {
    const all = w.animals.animals;   // guarded while any drowned sailor is up — after a reload or a night respawn too (guards.ts)
    w.ironDrop.guard = () => (all ? ironSwordGuard(all) : flags.has('dead:sailor') ? null : SWORD_GUARDED);
    w.ironDrop.onGuarded = (why) => { w.hud.toast(`${why} — beat him first`); sfx.interact('locked'); };
  }
  // ── A7: the zipline — a launch deck on the headland's cliff lip, on the line from the lookout platform to the sea cave,
  // down to the cove beach west of the cave mouth (the headland's 34 m shelf rules out a cable straight off the platform) ──
  {
    const from = place({ poi: 'lookout', anchor: 'lookout.zipTop', x: 0, z: 0 }), cave = place({ poi: 'cave', anchor: 'cave.caveFloor', x: 0, z: 0 });
    const lx = from.x + (cave.x - from.x) * 0.47, lz = from.z + (cave.z - from.z) * 0.47;
    const zip = new Zipline(w.sky, { top: new THREE.Vector3(lx, heightAt(lx, lz), lz), bottom: new THREE.Vector3(132, heightAt(132, 12), 12) }, cableModes(ctx.scope), 'driftwood.zipline', w.player).build();
    // the launch deck collides as real geometry (PHYSICS P4); without a registry (dev scenes) it's a floor function
    // E315 M1: the zipline model (src/shards/driftwood-isle/runtime/models/zipline.ts) placed drawnInto the ride's group (piece `zipline`)
    // SF57: the piece, its deck colliders and the group belong to this entry (after an await the ambient owner is the page's,
    // and a re-entered borrowed home runs this install again)
    const registry = w.registry;
    if (registry) { scope.run(() => zip.place(registry)); w.game.scene.add(zip.group); }
    else { w.game.scene.add(zip.group); w.player.platforms.push((x, z) => zip.floorHeightAt(x, z)); }
    ownEnteredTree(zip.group, scope);
    w.prompts.push(zip.prompt);
    w.game.onUpdate((dt) => {
      zip.cables.update(zip.mode, dt);
      for (const on of zip.cables.takeTransitions(zip.mode)) {
        w.setViewmodel?.(!on);
        sfx.interact(on ? 'lever' : 'plate', on ? zip.a : zip.b);
      }
    }, 'shard.driftwood.adventure.2');
    adventure.zipline = zip;
    adventure.setAnchor('lookout.zipline', { x: lx, z: lz });
  }

  const places = installPlaces(adventure, (t) => { w.hud.toast(t); });
  adventure.places = places;
  w.fullMap?.setPois(places.mapPois, { tally: true });   // E309 A: "PLACES n / N" in the map's corner
  if (w.gulls) {
    const gulls = w.gulls, guide = new PlaceGuide({ distance: 'edge', min: 0, schedule: { kind: 'idle', ...content.guide } },
      { points: () => places.points, discovered: places.discovered, position: () => w.player.position,
        fly: (target: { readonly x: number; readonly z: number }) => gulls.guide(w.player.position, target.x, target.z) });
    flags.onChange((flag, on) => { if (on && !flag.startsWith('plate:')) guide.progressed(); });
    w.game.onUpdate(dt => { if (dt > 0 && w.hud.entered !== false && w.hud.paused !== true && w.player.position.y <= 300)
      guide.update(dt, Math.hypot(w.player.velocity.x, w.player.velocity.z)); }, 'shard.driftwood-isle.installGullGuide');
  }
  adventure.complete = installCompletion(ctx, flags, w.progress, adventure.spine.objective.root, anchors);   // before the finale: its reward hands over to the card
  const captain = bindRuntimeBoss(ctx, declaration, 'driftwood.captain', undefined, { identity: 'runtime' });
  adventure.finale = await installDirectorFinale(adventure, { ...w, spawnCaptain: captain.spawn }, ctx);
  adventure.ecology = installEcology(w, (x, z) => heightAt(x, z) > OCEAN.level + 0.15);

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
  ctx.debug.expose('driftwood.adventure', adventure);
  return adventure;
}
