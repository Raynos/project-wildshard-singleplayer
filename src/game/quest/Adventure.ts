/**
 * installAdventure — Driftwood Isle's adventure layer (plan Track A) wired into the running game in ONE call from
 * main.ts. Everything it adds is data: the interactables table (src/world/interact/driftwood.ts) built by the kit
 * (src/world/interact/Interactables.ts); state lives in `Flags` (persisted per shard). Any other shard gets `null`
 * and nothing is built (Pine Hollow stays byte-for-byte, D8).
 *
 *   const adventure = installAdventure({ game, sky, player, chunk, prompts: interactables, hud, audio, music,
 *                                        inventory, progress, animals, fullMap, pois: { hut, lookout, wreck, shrine, cove }, ironDrop });
 *
 * Dev: `?resetquest` forgets this shard's adventure flags on load; `window.__adventure` = { flags, kit, … }.
 */
import type * as THREE from 'three';
import { heightAt } from '../../world/Heightfield';
import { HUT, LOOKOUT, WRECK, SHRINE, PIER, OCEAN } from '../../chunks/driftwood-isle';
import { Cove } from '../../world/Cove';
import type { Sky } from '../../world/Sky';
import type { Interactable } from '../../world/Cabin';
import type { Collider } from '../../player/Player';
import { Flags } from '../../world/interact/flags';
import { Interactables, type InteractEvent } from '../../world/interact/Interactables';
import { DRIFTWOOD_INTERACT, SEA_GLASS_COUNT, SEA_GLASS_FLAG } from '../../world/interact/driftwood';
import type { PoiId, Place } from '../../world/interact/types';
import { ITEMS, type ItemId } from '../Inventory';
import type { Audio } from '../../audio/Audio';
import { IslandSfx } from '../../audio/IslandSfx';
import { installSpine, type Spine } from './Spine';
import { installFeats, type ProgressSink } from './Feats';
import { installPlaces, type Places } from './Places';
import { installFinale, type Finale } from './Finale';
import { installEcology, type RespawnQueue } from './Ecology';
import type { MapPoi } from '../../ui/Map';

/** a named point a model module exports (`anchors`, world coords) for the adventure to place things at */
export interface Anchor { x: number; y?: number; z: number; yaw?: number }
/** the POI module's `anchors` map, if it exports one (the model agent adds them as the hold / cave / shrine land) */
function anchorsOf(m: object | null | undefined): Record<string, Anchor> | undefined {
  if (m === null || m === undefined || !('anchors' in m)) return undefined;
  const a: unknown = m.anchors;
  return typeof a === 'object' && a !== null ? (a as Record<string, Anchor>) : undefined;
}

/** what the adventure reads of an animal (Animal.ts satisfies it) */
export interface AdvAnimal { kind: string; variant?: string; position: THREE.Vector3; mem: Record<string, number>; hp: number; maxHp: number; alive: boolean; herd: number }

export interface AdventureWorld<A extends AdvAnimal = AdvAnimal> {
  game: { scene: THREE.Scene; camera: THREE.Camera; onUpdate: (fn: (dt: number, t: number) => void) => void };
  sky: Sky;
  player: { position: THREE.Vector3; velocity: THREE.Vector3; yaw: number; pitch: number; colliders: Collider[]; platforms: ((x: number, z: number) => number | undefined)[] };
  chunk: { slug: string; id: string };
  /** main.ts's interactable list ("[E] …" prompts, the touch USE button) */
  prompts: Interactable[];
  hud: { toast: (text: string) => void };
  /** the game's Audio: the kit's sounds are IslandSfx.interact (S4) — chests, locks, levers, plates, doors, pickups, the beacon */
  audio: Audio;
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void; combat?: (intensity: number) => void };
  inventory: { add: (id: ItemId, n?: number) => void };
  pois: Partial<Record<Exclude<PoiId, 'world'>, object | null>>;
  /** the animal manager: its onKill is chained (the sailor drops the hold key, the captain ends the fight) */
  animals: { onKill?: ((a: A) => void) | undefined; spawn?: (kind: string, x: number, z: number, yaw: number, variant?: string) => A; herds?: { cx: number; cz: number; members: A[] }[] };
  params?: URLSearchParams;
  /** shard achievements (Progress.recordEvent) — the adventure's event achievements (A4) */
  progress?: ProgressSink;
  /** the full map (the menu's MAP tab): shows the island's places with discovery + the quest markers (A5) */
  fullMap?: { setPois: (source: () => MapPoi[]) => void };
  /** the iron sword in the wreck's hold (IronSword.ts) — guarded until the drowned sailor is beaten (B4 / D6) */
  /** show / hide the weapon viewmodel (the golden-hour reward view lowers it) */
  setViewmodel?: (on: boolean) => void;
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

export function installAdventure<A extends AdvAnimal>(w: AdventureWorld<A>): Adventure | null {
  if (w.chunk.slug !== 'driftwood-isle') return null;
  const flags = new Flags(w.chunk.id);
  if (w.params?.has('resetquest')) flags.reset();

  const floorAt = (x: number, z: number): number => {
    let y = heightAt(x, z);
    for (const p of w.player.platforms) { const f = p(x, z); if (f !== undefined && f > y) y = f; }
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

  const kit = new Interactables({ scene: w.game.scene, sky: w.sky, player: w.player, flags, place, floorAt, prompts: w.prompts }).build(DRIFTWOOD_INTERACT);
  kit.onEvent = (e) => onInteract(e);
  w.game.onUpdate((dt, t) => kit.update(dt, t));

  const isItem = (id: string | undefined): id is ItemId => id !== undefined && id in ITEMS;
  const sfx = new IslandSfx(w.audio);
  function onInteract(e: InteractEvent): void {
    switch (e.type) {
      case 'locked': w.hud.toast(e.text ?? 'Locked'); sfx.interact('locked', e.at); break;
      case 'loot':
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
      case 'use': case 'sit': case 'barrel-reset':
        if (e.text) w.hud.toast(e.text);
        w.audio.hitMarker();
        break;
      default: break;
    }
  }

  const adventure: Adventure = { flags, kit, place, floorAt, spine: null, places: null, finale: null, ecology: null, setAnchor: (name, a) => { ownAnchors[name] = a; } };
  adventure.spine = installSpine(adventure, w);
  if (w.progress) installFeats(adventure, w, w.progress);
  if (w.ironDrop) {
    w.ironDrop.guard = () => (flags.has('dead:sailor') ? null : 'The drowned sailor guards the rack');
    w.ironDrop.onGuarded = (why) => { w.hud.toast(`${why} — beat him first`); sfx.interact('locked'); };
  }
  const places = installPlaces(adventure, (t) => { w.hud.toast(t); });
  adventure.places = places;
  w.fullMap?.setPois(places.mapPois);
  adventure.finale = installFinale(adventure, w);
  adventure.ecology = installEcology(w, (x, z) => heightAt(x, z) > OCEAN.level + 0.15);
  let placeT = 0;
  w.game.onUpdate((_dt, t) => { if (t - placeT > 0.25) { placeT = t; places.update(w.player.position.x, w.player.position.z); } });
  Object.assign(window, { __adventure: adventure });
  return adventure;
}
