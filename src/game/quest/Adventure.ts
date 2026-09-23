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
import { HUT, LOOKOUT, WRECK, SHRINE, PIER } from '../../chunks/driftwood-isle';
import { Cove } from '../../world/Cove';
import type { Sky } from '../../world/Sky';
import type { Interactable } from '../../world/Cabin';
import type { Collider } from '../../player/Player';
import { Flags } from '../../world/interact/flags';
import { Interactables, type InteractEvent } from '../../world/interact/Interactables';
import { DRIFTWOOD_INTERACT, SEA_GLASS_COUNT, SEA_GLASS_FLAG } from '../../world/interact/driftwood';
import type { PoiId, Place } from '../../world/interact/types';
import { ITEMS, type ItemId } from '../Inventory';

/** a named point a model module exports (`anchors`, world coords) for the adventure to place things at */
export interface Anchor { x: number; y?: number; z: number; yaw?: number }
/** the POI module's `anchors` map, if it exports one (the model agent adds them as the hold / cave / shrine land) */
function anchorsOf(m: object | null | undefined): Record<string, Anchor> | undefined {
  if (m === null || m === undefined || !('anchors' in m)) return undefined;
  const a: unknown = m.anchors;
  return typeof a === 'object' && a !== null ? (a as Record<string, Anchor>) : undefined;
}

export interface AdventureWorld<A extends { kind: string; position: THREE.Vector3 } = { kind: string; position: THREE.Vector3 }> {
  game: { scene: THREE.Scene; camera: THREE.Camera; onUpdate: (fn: (dt: number, t: number) => void) => void };
  sky: Sky;
  player: { position: THREE.Vector3; velocity: THREE.Vector3; yaw: number; colliders: Collider[]; platforms: ((x: number, z: number) => number | undefined)[] };
  chunk: { slug: string; id: string };
  /** main.ts's interactable list ("[E] …" prompts, the touch USE button) */
  prompts: Interactable[];
  hud: { toast: (text: string) => void };
  audio: { hitMarker: () => void; weaponSwap: () => void; land: (hard: boolean) => void };
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void };
  inventory: { add: (id: ItemId, n?: number) => void };
  pois: Partial<Record<Exclude<PoiId, 'world'>, object | null>>;
  /** the animal manager: its onKill is chained (the sailor drops the hold key, the captain ends the fight) */
  animals: { onKill?: ((a: A) => void) | undefined };
  params?: URLSearchParams;
}

export interface Adventure {
  flags: Flags;
  kit: Interactables;
  place: (p: Place) => { x: number; y: number; z: number; yaw: number };
  floorAt: (x: number, z: number) => number;
}

const CAVE = Cove.forIsland().cave;
/** POI frames: origin + rotation (world = origin + R_y(rot) · local, the modules' own convention) */
const FRAMES: Record<Exclude<PoiId, 'world'>, { x: number; z: number; rot: number }> = {
  hut: HUT, lookout: LOOKOUT, shrine: SHRINE,
  wreck: { x: WRECK.x, z: WRECK.z, rot: WRECK.heading },
  cave: { x: CAVE.x, z: CAVE.z, rot: CAVE.yaw },
  pier: { x: PIER.x, z: PIER.z, rot: 0 },
};

export function installAdventure<A extends { kind: string; position: THREE.Vector3 }>(w: AdventureWorld<A>): Adventure | null {
  if (w.chunk.slug !== 'driftwood-isle') return null;
  const flags = new Flags(w.chunk.id);
  if (w.params?.has('resetquest')) flags.reset();

  const floorAt = (x: number, z: number): number => {
    let y = heightAt(x, z);
    for (const p of w.player.platforms) { const f = p(x, z); if (f !== undefined && f > y) y = f; }
    return y;
  };
  const place = (p: Place): { x: number; y: number; z: number; yaw: number } => {
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
  function onInteract(e: InteractEvent): void {
    switch (e.type) {
      case 'locked': w.hud.toast(e.text ?? 'Locked'); w.audio.weaponSwap(); break;
      case 'loot':
        if (isItem(e.item)) { w.inventory.add(e.item, e.n ?? 1); w.hud.toast(`${ITEMS[e.item].label} ×${e.n ?? 1}`); }
        else if (e.text) w.hud.toast(e.text);
        w.audio.hitMarker();
        break;
      case 'take': {
        if (isItem(e.item)) w.inventory.add(e.item, e.n ?? 1);
        if (e.def.kind === 'pickup' && e.def.look === 'seaglass') {
          const n = flags.count(SEA_GLASS_FLAG);
          w.hud.toast(`Sea glass · ${n} / ${SEA_GLASS_COUNT}`);
          w.audio.hitMarker();
        } else { if (e.text) w.hud.toast(e.text); w.music.sting('pickup'); }
        break;
      }
      case 'press': case 'release': w.audio.land(false); break;
      case 'lever': case 'door': w.audio.weaponSwap(); if (e.text) w.hud.toast(e.text); break;
      case 'open': case 'light': case 'use': case 'sit': case 'barrel-reset':
        if (e.text) w.hud.toast(e.text);
        w.audio.hitMarker();
        break;
      default: break;
    }
  }

  const adventure: Adventure = { flags, kit, place, floorAt };
  Object.assign(window, { __adventure: adventure });
  return adventure;
}
