/**
 * The shared quest core (NALATI-MERGE Q1): the pieces of Driftwood's adventure layer that are not Driftwood's, so a
 * second shard runs its quest line on the same machinery, look and saves. A shard's install (Driftwood: Adventure.ts
 * + Spine.ts + Places.ts; Nalati: src/nalati/adventure.ts) owns its data and its NPCs and wires these:
 *
 *   QuestChip        the quest chip under the minimap (QuestUI.ObjectiveLine, E51): the goal + its counter, and the
 *                    nearest live marker's short name, metres and bearing. `chip.update(t, player)` every frame.
 *   NpcTalk          one NPC's "[E] Talk to …" prompt over a DialogueBox (several NPCs may share one box): picks the
 *                    first dialogue entry whose `when` holds (quest.ts `lineFor`), raises its `sets` when the talk ends,
 *                    closes it if you walk off. `talk.update(playerPos)` every frame.
 *   placesWithDiscovery   named places: walk within `r` and the place is DISCOVERED — a saved `seen:<id>` flag (so it
 *                    persists across reloads), a "Discovered · X" toast, its name on the full map (a dim "?" until
 *                    then) and the live quest markers on top.
 *   QuestLine        chained chapters (QuestDefs whose `startWhen` reads the previous one's `completeFlag`): the active
 *                    chapter is the first one not complete; step / complete callbacks for every chapter.
 *
 * Flags (src/world/interact/flags.ts) stay the one store: per shard, `ws.flags.v1`, `?resetquest` clears them.
 */
import type * as THREE from 'three';
import { ObjectiveLine, type DialogueBox } from './QuestUI';
import { QuestState, lineFor, type DialogueEntry, type NpcDef, type QuestDef, type QuestStep } from './quest';
import type { Flags } from '../../world/interact/flags';
import type { Interactable } from '../../world/Cabin';
import type { MapPoi } from '../../ui/Map';

/** a quest marker resolved to world coordinates */
export interface LiveMarker { id: string; label: string; short: string; x: number; z: number }

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
  constructor(private readonly src: ChipSource) {}

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
}

/** one NPC's talk prompt + dialogue over a (shared) DialogueBox */
export class NpcTalk {
  readonly prompt: Interactable;
  private mine = false;
  constructor(private readonly o: NpcTalkOpts) {
    const dialogue = o.dialogue, r = o.radius;
    this.prompt = {
      position: o.at,
      get radius() { return dialogue.isOpen ? 0 : r; },   // hidden while talking: the box has its own NEXT (E / a tap)
      label: o.label,
      onInteract: () => { this.talk(); },
    };
  }

  get talking(): boolean { return this.mine && this.o.dialogue.isOpen; }

  talk(): void {
    const { dialogue, flags, npc, speaker } = this.o;
    if (dialogue.isOpen) { dialogue.advance(); return; }
    const entry = lineFor(npc, flags);
    if (!entry) return;
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
export interface PlacePoint { id: string; label: string; x: number; z: number; r: number; quiet?: boolean }

export interface Places {
  /** the full map's list: places (named / "?") + the quest's markers */
  mapPois: () => MapPoi[];
  /** call a few times a second with the player's feet */
  update: (x: number, z: number) => void;
  discovered: (id: string) => boolean;
}

/** named places with saved discovery (`seen:<id>` flags) + the live quest markers, for the full map */
export function placesWithDiscovery(pts: PlacePoint[], flags: Flags, toast: (t: string) => void, markers: () => LiveMarker[]): Places {
  const out: MapPoi[] = [];
  return {
    discovered: (id) => flags.has(`seen:${id}`),
    update: (x, z) => {
      for (const p of pts) {
        if (flags.has(`seen:${p.id}`)) continue;
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < p.r * p.r) { flags.set(`seen:${p.id}`); if (p.quiet !== true) toast(`Discovered · ${p.label}`); }
      }
    },
    mapPois: () => {
      out.length = 0;
      for (const p of pts) out.push({ x: p.x, z: p.z, label: p.label, kind: flags.has(`seen:${p.id}`) ? 'place' : 'unknown' });
      for (const m of markers()) out.push({ x: m.x, z: m.z, label: m.label, kind: 'quest' });
      return out;
    },
  };
}

/** chained chapters: each def's `startWhen` reads the one before's `completeFlag`; the active one is the first not done */
export class QuestLine {
  readonly chapters: QuestState[];
  /** a chapter's current step changed (null = it just completed) */
  onStep?: (chapter: QuestState, step: QuestStep | null, prev: QuestStep | null) => void;
  onComplete?: (chapter: QuestState) => void;

  constructor(defs: QuestDef[], flags: Flags) {
    this.chapters = defs.map((d) => {
      const q = new QuestState(d, flags);
      q.onStep = (s, p) => { this.onStep?.(q, s, p); };
      q.onComplete = () => { this.onComplete?.(q); };
      return q;
    });
  }

  /** the chapter being played: the first not complete (null once the line is finished) */
  get active(): QuestState | null { return this.chapters.find((q) => !q.isComplete) ?? null; }
  /** 1-based chapter number of `q` */
  number(q: QuestState): number { return this.chapters.indexOf(q) + 1; }
  dispose(): void { for (const q of this.chapters) q.dispose(); }
}
