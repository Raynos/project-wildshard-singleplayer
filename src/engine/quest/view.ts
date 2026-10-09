import { engineString } from '../strings';
import type * as THREE from 'three';
import { ObjectiveLine, type DialogueBox } from './view/ui';
import { lineFor, type DialogueEntry, type NpcDef } from './core';
import type { Flags } from '../world/interact/flags';
import type { Interactable } from '../world/interact/types';
import type { MapPoi } from '../ui/Map';
import { practiceRoom } from '../core/practiceRoom';

/** a quest marker resolved to world coordinates */
export interface LiveMarker { id: string; label: string; short: string; x: number; z: number }

/** what the quest chip (ObjectiveLine) shows: the goal's label and count and the live markers */
export interface ChipSource {
  /** the chip's goal: a short label and its counter ('' for none) */
  chip: () => { label: string; count: string };
  /** the live markers; the nearest one past 6 m is the chip's nav half */
  markers: () => LiveMarker[];
}

/** the quest chip under the minimap (QuestUI's ObjectiveLine) fed from a quest: goal + nearest marker, ~10 Hz */
export class QuestChip {
  readonly line = new ObjectiveLine();
  private navT = 0;
  private readonly src: ChipSource;
  constructor(src: ChipSource) {
    this.src = src;
  }

  update(t: number, player: { position: THREE.Vector3; yaw: number }): void {
    this.line.update(t);
    if (t - this.navT <= 0.1) return;
    this.navT = t;
    const pp = player.position;
    const chip = this.src.chip();
    this.line.set(chip.label, chip.count);
    let best: LiveMarker | null = null, bd = Infinity;
    for (const m of this.src.markers()) { const d = Math.hypot(m.x - pp.x, m.z - pp.z); if (d < bd) { bd = d; best = m; } }
    if (best && bd > 6) {
      // bearing relative to the view: forward = (−sin yaw, −cos yaw), right = (cos yaw, −sin yaw) (Player / main.ts)
      const dx = best.x - pp.x, dz = best.z - pp.z, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      this.line.setNav(best.short, bd, Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy));
    } else this.line.setNav(null, 0, 0);
  }
}

/** an NPC talk's parts: the dialogue box, the quest flags and the NPC's lines */
export interface NpcTalkOpts {
  dialogue: DialogueBox;
  flags: Flags;
  npc: NpcDef;
  /** where the prompt sits (the NPC's head) */
  at: THREE.Vector3;
  /** the prompt's reach (metres); the talk closes past radius + 2.5 */
  radius: number;
  label: string;
  /** gestures while the dialogue is open */
  speaker: { talking: boolean };
  /** a talk opened (a sound, turning to face you) */
  onOpen?: (entry: DialogueEntry) => void;
  /** a talk finished (after its `sets` are raised) */
  onDone?: (entry: DialogueEntry) => void;
  /** A voice with no remaining dialogue can still open its shop or offer. */
  onEmpty?: () => void;
}

/** one NPC's talk prompt + dialogue over a (shared) DialogueBox */
export class NpcTalk {
  readonly prompt: Interactable;
  private mine = false;
  private readonly o: NpcTalkOpts;
  constructor(o: NpcTalkOpts) {
    this.o = o;
    const r = o.radius; // The dialogue can be entry-owned: constructing the prompt must not read its getter.
    this.prompt = {
      position: o.at,
      get radius() { return o.dialogue.isOpen ? 0 : r; },   // hidden while talking: the box has its own NEXT (E / a tap)
      label: o.label,
      onInteract: () => { this.talk(); },
    };
  }

  get talking(): boolean { return this.mine && this.o.dialogue.isOpen; }

  talk(): void {
    const { dialogue, flags, npc, speaker } = this.o;
    if (dialogue.isOpen) { dialogue.advance(); return; }
    const entry = lineFor(npc, flags);
    if (!entry) { this.o.onEmpty?.(); return; }
    speaker.talking = true;
    this.mine = true;
    dialogue.open(npc.name, entry.lines, () => {
      speaker.talking = false;
      this.mine = false;
      for (const f of entry.sets ?? []) flags.set(f);
      this.o.onDone?.(entry);
    });
    this.o.onOpen?.(entry);
  }

  /** every frame: walking off closes the talk */
  update(player: THREE.Vector3): void {
    if (!this.mine) return;
    if (!this.o.dialogue.isOpen) { this.mine = false; this.o.speaker.talking = false; return; }
    if (player.distanceTo(this.o.at) > this.o.radius + 2.5) { this.o.dialogue.close(false); this.o.speaker.talking = false; this.mine = false; }
  }
}

/** a named place in world coordinates: discovered within `r`; `quiet` = discovered without a toast (the arrival point) */
export interface PlacePoint { id: string; label: string; x: number; z: number; r: number; quiet?: boolean; y?: number }

/** a level's named places: the map's points, discovery as the player walks, and the chip's markers */
export interface Places {
  /** the full map's list: places (named / "?") + the quest's markers */
  mapPois: () => MapPoi[];
  /** call a few times a second with the player's feet */
  update: (x: number, z: number, y?: number) => void;
  discovered: (id: string) => boolean;
  /** the places themselves, in world coords (E295: the last one reached is where a death puts you back, src/game/LastPlace.ts) */
  points: readonly PlacePoint[];
}

/** named places with saved discovery (`seen:<id>` flags) + the live quest markers, for the full map */
export function placesWithDiscovery(pts: PlacePoint[], flags: Flags, toast: (t: string) => void, markers: () => LiveMarker[]): Places {
  const out: MapPoi[] = [];
  return {
    points: pts,
    discovered: (id) => flags.has(`seen:${id}`),
    update: (x, z, y) => {
      if (practiceRoom.open) return; // an arena / playground has no discovery locations (E307)
      for (const p of pts) {
        if (flags.has(`seen:${p.id}`)) continue;
        const dy = p.y === undefined ? 0 : p.y - (y ?? Infinity);
        if ((p.x - x) ** 2 + (p.z - z) ** 2 + dy * dy < p.r * p.r) { flags.set(`seen:${p.id}`); if (p.quiet !== true) toast(engineString('s_4a4322f3623e', [p.label])); }
      }
    },
    mapPois: () => {
      out.length = 0;
      for (const p of pts) out.push({ x: p.x, z: p.z, label: p.label, kind: flags.has(`seen:${p.id}`) ? 'place' : 'unknown' });
      for (const m of markers()) out.push({ x: m.x, z: m.z, label: m.label, short: m.short, kind: 'quest' }); // the map labels a marker by its short name (E130)
      return out;
    },
  };
}


