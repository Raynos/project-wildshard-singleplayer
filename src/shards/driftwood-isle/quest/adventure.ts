import * as THREE from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Audio } from '@wildshard/engine/audio/Audio';
import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { MapPoi, MapQuest } from '@wildshard/engine/ui/Map';
import { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactables, InteractEvent } from '@wildshard/engine/world/interact/Interactables';
import type { Interactable, PoiId, Place } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ITEMS } from '@wildshard/game/bag/itemCatalog';
import type { ItemId } from '@wildshard/game/Inventory';
import type { ProgressSink } from '@wildshard/game/Progress';
import type { ShardContext } from '@wildshard/game/shard/context';
import { HUT, LOOKOUT, WRECK, SHRINE, PIER, OCEAN } from '../manifest';
import { Cove } from '../world/Cove';
import { SEA_GLASS_COUNT, SEA_GLASS_FLAG } from './interactables';
import { installAdventureInteractables } from './interactLifetime';
import { installSpine, type Spine } from './Spine';
import { installTrader, type TraderStall } from './TraderStall';
import { installFeats } from './Feats';
import { installPlaces } from './Places';
import type { Places } from '@wildshard/engine/quest/view';
import { installGullGuide } from './gullGuide';
import { installFinale, type Finale } from './Finale';
import { installComplete, type Complete, type CompleteProgress } from './Complete';
import { installEcology, type RespawnQueue } from './Ecology';
import { Zipline } from '../world/Zipline';
import { ironSwordGuard, SWORD_GUARDED } from './guards';

/** a named point a model module exports (`anchors`, world coords) for the adventure to place things at */
export interface Anchor { x: number; y?: number; z: number; yaw?: number }
/** the POI module's `anchors` map, if it exports one (the model agent adds them as the hold / cave / shrine land) */
function anchorsOf(m: object | null | undefined): Record<string, Anchor> | undefined {
  if (m === null || m === undefined || !('anchors' in m)) return undefined;
  const a: unknown = m.anchors;
  return typeof a === 'object' && a !== null ? (a as Record<string, Anchor>) : undefined;
}

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
  pois: Partial<Record<Exclude<PoiId, 'world'>, object | null>>;
  /** Creature views for scoped death listeners and authored respawns. */
  animals: { animals?: A[]; spawn?: (kind: string, x: number, z: number, yaw: number, variant?: string) => A; herds?: { cx: number; cz: number; members: A[] }[] };
  params?: URLSearchParams;
  /** shard achievements (Progress.recordEvent) — the adventure's event achievements (A4) */
  progress?: ProgressSink & CompleteProgress;
  /** the full map (the menu's MAP tab): shows the island's places with discovery + the quest markers (A5), and the quest card (E51) */
  fullMap?: { setPois: (source: () => MapPoi[], opts?: { tally?: boolean }) => void; setQuest?: (source: () => MapQuest | null) => void };
  /** the island's gulls: three fly you toward the nearest unfound place when you wander or idle (E309 B, gullGuide.ts) */
  gulls?: { guide: (player: THREE.Vector3, yaw: number, tx: number, tz: number) => boolean } | null;
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
  trader: TraderStall | null;
  place: (p: Place) => { x: number; y: number; z: number; yaw: number };
  floorAt: (x: number, z: number) => number;
  /** register a computed anchor (`<poi>.<name>`) that placements and quest markers can name */
  setAnchor: (name: string, a: Anchor) => void;
}

const CAVE = Cove.forIsland().cave;
/** POI frames: origin + rotation (world = origin + R_y(rot) · local, the modules' own convention) */
const FRAMES: Record<Exclude<PoiId, 'world'>, { x: number; z: number; rot: number }> = {
  hut: HUT, lookout: LOOKOUT, shrine: SHRINE,
  wreck: { x: WRECK.x, z: WRECK.z, rot: WRECK.heading },
  cave: { x: CAVE.x, z: CAVE.z, rot: CAVE.yaw },
  pier: { x: PIER.x, z: PIER.z, rot: 0 },
};

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
  const w: AdventureWorld<A> = { ...source, scope: ctx.scope, debug: ctx.debug, game: adventureGame(source.game, (run, label) => { ctx.system({ id: label ?? 'shard.driftwood.adventure', phase: 'update', before: ['game.loot', 'body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world'], run }); }),
    onDeath: (run, order) => { ctx.on('actor.died', ({ actor }) => { const animal = source.animals.animals?.find((a) => a.combatActor?.() === actor); if (animal !== undefined) run(animal); }, { order }); } };
  const flags = new Flags(w.chunk.slug);
  if (w.params?.has('resetquest')) flags.reset();

  const floorAt = (x: number, z: number): number => {
    let y = heightAt(x, z);
    for (const p of w.player.platforms) { const f = p(x, z); if (f !== undefined && f > y) y = f; }
    const r = w.registry?.floorAt(x, z);
    if (r !== undefined && r > y) y = r;
    return y;
  };
  /** anchors the adventure computes itself (the finale's reward spot) — consulted before the models' */
  const ownAnchors: Record<string, Anchor> = {};
  const place = (p: Place): { x: number; y: number; z: number; yaw: number } => {
    const own = p.anchor !== undefined ? ownAnchors[p.anchor] : undefined;
    if (own) return { x: own.x, z: own.z, y: own.y ?? floorAt(own.x, own.z), yaw: own.yaw ?? 0 };
    if (p.anchor !== undefined) {
      const [poi, name] = p.anchor.split('.');
      const a = poi !== undefined && name !== undefined ? anchorsOf(w.pois[poi as Exclude<PoiId, 'world'>])?.[name] : undefined;
      if (a) return { x: a.x, z: a.z, y: a.y ?? floorAt(a.x, a.z) + (p.dy ?? 0), yaw: a.yaw ?? 0 };
    }
    let x = p.x, z = p.z, yaw = p.yaw ?? 0;
    if (p.poi !== 'world') {
      const f = FRAMES[p.poi], c = Math.cos(f.rot), s = Math.sin(f.rot);
      x = f.x + p.x * c + p.z * s; z = f.z - p.x * s + p.z * c; yaw += f.rot;
    }
    return { x, z, y: p.y ?? floorAt(x, z) + (p.dy ?? 0), yaw };
  };

  const kit = await installAdventureInteractables(ctx.scope, { scene: w.game.scene, sky: w.sky, player: w.player, flags, place, floorAt, prompts: w.prompts });
  kit.onEvent = (e) => onInteract(e);
  w.game.onUpdate((dt, t) => kit.update(dt, t), 'shard.driftwood.adventure');

  const isItem = (id: string | undefined): id is ItemId => id !== undefined && id in ITEMS;
  const sfx = new InteractSfx(w.audio);
  function onInteract(e: InteractEvent): void {
    switch (e.type) {
      case 'locked': w.hud.toast(e.text ?? 'Locked'); sfx.interact('locked', e.at); break;
      case 'found':
        if (isItem(e.item)) { w.inventory.add(e.item, e.n ?? 1); w.hud.toast(`${ITEMS[e.item].label} ×${e.n ?? 1}`); }
        else if (e.text) w.hud.toast(e.text);
        if (e.flag?.startsWith('shard:') === true) { sfx.interact('glyph', e.at, { delay: 0.55 }); w.music.sting('pickup'); }   // the wreck's shard, out of the strongbox
        else sfx.interact('chime', e.at, { delay: 0.55, gain: 0.8 }); // after the lid has thudded back
        break;
      case 'take': {
        if (isItem(e.item)) w.inventory.add(e.item, e.n ?? 1);
        if (e.def.kind === 'pickup' && e.def.look === 'seaglass') {
          const n = flags.count(SEA_GLASS_FLAG);
          w.hud.toast(`Sea glass · ${n} / ${SEA_GLASS_COUNT}`);
          sfx.interact('chime', e.at);
        } else { if (e.text) w.hud.toast(e.text); sfx.interact(e.def.kind === 'pickup' && e.def.look === 'shard' ? 'glyph' : 'chime', e.at); w.music.sting('pickup'); }
        break;
      }
      case 'press': case 'release': sfx.interact('plate', e.at, { release: e.type === 'release' }); break;
      case 'lever': case 'door':
        sfx.interact(e.type === 'lever' ? 'lever' : e.def.kind === 'door' && e.def.look !== 'plank' ? 'grate' : 'door', e.at);
        if (e.text) w.hud.toast(e.text);
        break;
      case 'open': case 'light':
        if (e.text) w.hud.toast(e.text);
        sfx.interact(e.type === 'light' ? 'ignite' : 'chest', e.at);
        break;
      case 'use': case 'sit': case 'barrel-reset': // the altar's shards, the bench, the barrel: a quest beat, not a sword hit (E318)
        if (e.text) w.hud.toast(e.text);
        sfx.interact('chime', e.at);
        break;
      default: break;
    }
  }

  const adventure: Adventure = { flags, kit, place, floorAt, spine: null, places: null, finale: null, ecology: null, complete: null, zipline: null, trader: null, setAnchor: (name, a) => { ownAnchors[name] = a; } };
  adventure.spine = installSpine(adventure, w);
  adventure.trader = installTrader(adventure, w);   // E314: the trader and her counter of goods at the hut, beside Wendell; her shop comes with the loot
  if (w.progress) installFeats(adventure, w, w.progress);
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
    const zip = new Zipline(w.sky, { top: new THREE.Vector3(lx, heightAt(lx, lz), lz), bottom: new THREE.Vector3(132, heightAt(132, 12), 12) }).build();
    // the launch deck collides as real geometry (PHYSICS P4); without a registry (dev scenes) it's a floor function
    // E315 M1: the zipline model (src/shards/driftwood-isle/models/zipline.ts) placed drawnInto the ride's group (piece `zipline`)
    if (w.registry) { zip.place(w.registry); w.game.scene.add(zip.group); }
    else { w.game.scene.add(zip.group); w.player.platforms.push((x, z) => zip.floorHeightAt(x, z)); }
    w.prompts.push(zip.prompt);
    zip.onRide = (on) => {
      w.player.carried = on; // the cable owns the position while riding (PHYSICS P2: the fixed step leaves it alone)
      w.setViewmodel?.(!on);
      if (!on) { flags.set('used:zipline'); sfx.interact('plate', zip.b); }
      else sfx.interact('lever', zip.a);
    };
    w.game.onUpdate((dt) => { zip.update(dt, w.player); }, 'shard.driftwood.adventure.2');
    adventure.zipline = zip;
    adventure.setAnchor('lookout.zipline', { x: lx, z: lz });
  }

  const places = installPlaces(adventure, (t) => { w.hud.toast(t); });
  adventure.places = places;
  w.fullMap?.setPois(places.mapPois, { tally: true });   // E309 A: "PLACES n / N" in the map's corner
  if (w.gulls) installGullGuide({ game: w.game, player: w.player, hud: w.hud, gulls: w.gulls }, places, flags);
  adventure.complete = installComplete(adventure, w, w.progress);   // before the finale: its reward hands over to the card
  adventure.finale = await installFinale(adventure, w, ctx);
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
