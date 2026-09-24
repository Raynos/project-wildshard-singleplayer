/**
 * Nalati's adventure layer (NALATI-MERGE Q1–Q3) — the shard's quest line on the shared quest core
 * (src/game/quest/core.ts: the chip, NPC talk, places with saved discovery, chained chapters), wired from main.ts in
 * ONE call. Any other shard gets `null` and nothing is built (Pine Hollow and Driftwood stay as they are).
 *
 *   installNalatiAdventure({ game, sky, player, chunk, prompts: interactables, hud, audio, music, progress, fullMap,
 *                            registry, ride, params });
 *
 * What it adds:
 *   · the camp's people (src/nalati/campPeople.ts): Baqyt Ata the elder (the quest giver), two herders, a child, the
 *     cook — each with an "[E] Talk to …" prompt over one shared DialogueBox (quest.ts NpcDefs in src/game/quest/nalati.ts)
 *   · the quest chip under the minimap (◆ TULPAR 1/3 │ HORSE PLAINS 180 M ▲ — main's chip, H2's under-minimap stack),
 *     the blue quest markers on the full map, and the MAP tab's quest card (chapter · objective · hint)
 *   · the full map's places with discovery that PERSISTS (a `seen:<id>` flag per place, 17 places) — it replaces the
 *     minimap fog read main.ts used to do, which forgot every place on reload
 *   · the events the quest reads, as flags: the taming's bonded horse (polled, so a horse tamed in an earlier session
 *     counts on load — the quest catches up from the saved state), a kokpar round won (src/nalati/kokpar.ts)
 *   · chapter 1's reward: a title (the NALATI achievements' event rows: `progress.recordEvent('tulpar')`) and the
 *     reward caption; `kokpar` as its own achievement
 *
 * Dev: `?resetquest` forgets the shard's flags (quest, discovery); `?questflags=talked:elder,tamed:horse` raises flags
 * on load; `window.__nalatiQuest` = { flags, line, people, kokpar, places, talk(id) }.
 */
import type * as THREE from 'three';
import { Flags } from '../world/interact/flags';
import { heightAt } from '../world/Heightfield';
import type { WorldRegistry } from '../world/registry';
import type { Sky } from '../world/Sky';
import type { Interactable } from '../world/Cabin';
import type { MapPoi, MapQuest } from '../ui/Map';
import { DialogueBox, RewardCaption } from '../game/quest/QuestUI';
import { NpcTalk, QuestChip, QuestLine, placesWithDiscovery, type LiveMarker, type Places } from '../game/quest/core';
import type { QuestState } from '../game/quest/quest';
import type { ProgressSink } from '../game/quest/Feats';
import { CAMP_NPCS, NALATI_PLACES, NALATI_QUESTS, TULPAR_DONE } from '../game/quest/nalati';
import { buildCampPeople, type CampPeople, type PersonId } from './campPeople';
import { buildKokparRound, KOKPAR_GOALS, type KokparMount, type KokparRound } from './kokpar';

export interface NalatiAdventureWorld {
  game: { scene: THREE.Scene; onUpdate: (fn: (dt: number, t: number) => void) => void };
  sky: Sky;
  player: { position: THREE.Vector3; yaw: number };
  chunk: { slug: string; id: string };
  /** main.ts's interactable list ("[E] …" prompts, the touch USE button) */
  prompts: Interactable[];
  hud: { toast: (text: string) => void };
  audio: { weaponSwap: () => void };
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void };
  progress?: ProgressSink;
  fullMap?: { setPois: (source: () => MapPoi[]) => void; setQuest?: (source: () => MapQuest | null) => void };
  registry?: WorldRegistry | undefined;
  /** Nalati's riding + taming (src/nalati/ride.ts): the mount for the kokpar, the bonded horse for the quest */
  ride: { mount: KokparMount; taming: { phase: string; isArgymaq: boolean } } | null;
  params?: URLSearchParams;
}

export interface NalatiAdventure {
  flags: Flags;
  line: QuestLine;
  people: CampPeople;
  kokpar: KokparRound;
  places: Places;
  dialogue: DialogueBox;
  chip: QuestChip;
  /** the current chapter's markers in world coordinates */
  markers: () => LiveMarker[];
}

const TALK_R = 3.2;
const LABELS: Record<PersonId, string> = { elder: 'Talk to Baqyt Ata', herderGate: 'Talk to Dauren', herderRail: 'Talk to Erlan', child: 'Talk to Ayan', cook: 'Talk to Gulnar Apa' };
/** the title each chapter's achievement row (src/game/achievements.ts, event = the chapter id) unlocks — for its caption */
const REWARD: Record<string, string> = { tulpar: 'Formerly On Foot' };

export function installNalatiAdventure(w: NalatiAdventureWorld): NalatiAdventure | null {
  if (w.chunk.slug !== 'nalati-grasslands') return null;
  const flags = new Flags(w.chunk.id);
  if (w.params?.has('resetquest') === true) flags.reset();
  for (const f of (w.params?.get('questflags') ?? '').split(',')) if (f.trim() !== '') flags.set(f.trim());

  const floorAt = (x: number, z: number): number => {
    const y = heightAt(x, z), r = w.registry?.floorAt(x, z);
    return r !== undefined && r > y && r < y + 2 ? r : y;   // a deck, not a roof
  };

  // ── the camp's people ──
  const people = buildCampPeople(w.sky, floorAt, w.registry ?? null);
  if (!w.registry) w.game.scene.add(people.group);

  // ── the quest line, the chip, the dialogue ──
  const line = new QuestLine(NALATI_QUESTS, flags);
  const markers = (): LiveMarker[] => (line.active?.markers() ?? []).map((m) => ({ id: m.id, label: m.label, short: m.short ?? m.label, x: m.at.x, z: m.at.z }));
  const chip = new QuestChip({
    chip: () => {
      const q = line.active;
      if (!q) return { label: '', count: '' };   // the line is finished (so far): no chip
      const n = q.def.steps.length;
      return { label: q.def.title, count: q.isStarted ? `${Math.min(n, q.index + 1)}/${n}` : '' };
    },
    markers,
  });
  const dialogue = new DialogueBox();
  const talks = (Object.keys(CAMP_NPCS) as PersonId[]).map((id) => {
    const talk = new NpcTalk({ dialogue, flags, npc: CAMP_NPCS[id], at: people.fig[id].headWorld, radius: TALK_R, label: LABELS[id], speaker: people.fig[id], onOpen: () => { w.audio.weaponSwap(); } });
    w.prompts.push(talk.prompt);
    return { id, talk };
  });

  const chapterName = (q: QuestState): string => `Chapter ${line.number(q)} · ${q.def.title}`;
  line.onStep = (q, step, prev) => {
    if (step === null) return;
    if (prev === null) w.hud.toast(`New quest · ${q.def.title}`);
    else w.hud.toast(`Objective · ${q.objective()}`);
    w.music.sting('chunk');
  };
  const caption = new Map<string, RewardCaption>();
  line.onComplete = (q) => {
    w.hud.toast(`Quest complete · ${chapterName(q)}`);
    w.music.sting('chunk');
    const title = REWARD[q.def.id];
    let c = caption.get(q.def.id);
    if (!c) { c = new RewardCaption(`Chapter ${line.number(q)} · complete`, q.def.title, title !== undefined ? `Title earned · ${title}` : ''); caption.set(q.def.id, c); }
    const shown = c;
    shown.show(true);
    chip.line.root.classList.add('ws-quest-hide');   // the caption has the screen
    window.setTimeout(() => { shown.show(false); chip.line.root.classList.remove('ws-quest-hide'); }, 6500);
  };
  // the MAP tab's quest card: the chapter, its objective, the hint
  w.fullMap?.setQuest?.(() => {
    const q = line.active;
    if (q) return { title: q.isStarted ? chapterName(q) : 'Nalati Grasslands', objective: q.objective(), hint: q.hint() };
    const last = line.chapters[line.chapters.length - 1];
    return last ? { title: chapterName(last), objective: `${last.def.title} — complete`, hint: 'The steppe has more stories. Baqyt Ata will tell them.' } : null;
  });

  // ── places with saved discovery (replaces the fog read: names stay found across reloads) ──
  const places = placesWithDiscovery(NALATI_PLACES, flags, (t) => { w.hud.toast(t); }, markers);
  w.fullMap?.setPois(places.mapPois);

  // ── a round of kokpar (TULPAR step 2; open any time) ──
  const kokpar = buildKokparRound(w.sky, floorAt, {
    toast: (t) => { w.hud.toast(t); },
    sting: (k) => { w.music.sting(k === 'lose' ? 'death' : k === 'win' ? 'chunk' : 'pickup'); },
    onWin: () => { flags.set('won:kokpar'); },
  });
  w.game.scene.add(kokpar.object);

  // ── the saved stores → flags (on load, then twice a second): the quest catches up with what you already did ──
  const poll = (): void => {
    const t = w.ride?.taming;
    if (t?.phase === 'bonded') flags.set('tamed:horse');
    if (t?.isArgymaq === true) flags.set('tamed:argymaq');
  };
  poll();

  // ── achievements: the chapter + the kokpar as event rows (counts read back from the flags, like Driftwood's Feats) ──
  const feats = (): void => {
    const p = w.progress;
    if (!p) return;
    if (flags.has('won:kokpar')) p.recordEvent('kokpar', 1);
    if (flags.has(TULPAR_DONE)) p.recordEvent('tulpar', 1);
  };
  feats();
  flags.onChange((_f, on) => { if (on) feats(); });

  // ── per frame ──
  let slowT = 0;
  w.game.onUpdate((dt, t) => {
    const pp = w.player.position;
    dialogue.update(dt);
    for (const { talk } of talks) talk.update(pp);
    people.update(dt, t, pp);
    kokpar.update(dt, pp, w.ride?.mount ?? null);
    chip.update(t, w.player);
    if (t - slowT > 0.5) { slowT = t; poll(); places.update(pp.x, pp.z); }
  });

  const adventure: NalatiAdventure = { flags, line, people, kokpar, places, dialogue, chip, markers };
  Object.assign(window, { __nalatiQuest: { ...adventure, kokparGoals: KOKPAR_GOALS, talk: (id: PersonId) => { talks.find((x) => x.id === id)?.talk.talk(); } } });
  return adventure;
}
