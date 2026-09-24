/**
 * Nalati's adventure layer (NALATI-MERGE Q1–Q5) — the shard's quest line on the shared quest core
 * (src/game/quest/core.ts: the chip, NPC talk, places with saved discovery, chained chapters), wired from main.ts in
 * ONE call. Any other shard gets `null` and nothing is built (Pine Hollow and Driftwood stay as they are).
 *
 *   installNalatiAdventure({ game, sky, player, chunk, prompts: interactables, hud, audio, music, progress, fullMap,
 *                            registry, ride, animals, nalati, params });
 *
 * What it adds:
 *   · the camp's people (src/nalati/campPeople.ts): Baqyt Ata the elder (the quest giver), two herders, a child, the
 *     cook — each with an "[E] Talk to …" prompt over one shared DialogueBox (quest.ts NpcDefs in src/game/quest/nalati.ts)
 *   · the quest chip under the minimap (◆ TULPAR 1/3 │ HORSE PLAINS 180 M ▲ — main's chip, H2's under-minimap stack),
 *     the blue quest markers on the full map, and the MAP tab's quest card (chapter · objective · hint)
 *   · the full map's places with discovery that PERSISTS (a `seen:<id>` flag per place, 17 places) — it replaces the
 *     minimap fog read main.ts used to do, which forgot every place on reload
 *   · the three chapters (src/game/quest/nalati.ts): TULPAR → THE GOLDEN KING → FATHER OF THE WIND, each given by the
 *     elder once the one before is done
 *   · the events the quest reads, as flags — polled from the saved stores, so whatever was done before a chapter
 *     existed counts on load (the quest catches up; the bosses stay open any time): the taming's bonded horse, a kokpar
 *     round won (src/nalati/kokpar.ts), the great kurgan entered + the Golden King beaten (KurganBoss / Boss.defeated),
 *     the named elites felled (the elite store → storm feathers), the Wind Cairn's strip tied + Jel Ata beaten
 *     (StormTitan); a balbal toppled while chapter 2 wants clues (animals.onKill, chained) shows its carving
 *   · each chapter's reward: a title (the NALATI achievements' event rows: tulpar / chapter-king / chapter-wind) and the
 *     reward caption; `kokpar` as its own achievement
 *
 * Dev: `?resetquest` forgets the shard's flags (quest, discovery); `?questflags=talked:elder,tamed:horse` raises flags
 * on load; `window.__nalatiQuest` = { flags, line, people, kokpar, places, talk(id), carving() }.
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
import { CAMP_NPCS, CARVINGS, CLUE_FLAGS, FEATHER_ELITES, FEATHER_FLAGS, NALATI_PLACES, NALATI_QUESTS } from '../game/quest/nalati';
import { buildCampPeople, type CampPeople, type PersonId } from './campPeople';
import { buildKokparRound, KOKPAR_GOALS, type KokparMount, type KokparRound } from './kokpar';

/** what the adventure reads of Nalati's bosses (src/nalati/kurganBoss.ts KurganBoss, stormTitan.ts StormTitan) — polled */
export interface NalatiBosses {
  boss: { inside: boolean; boss: { defeated: boolean } | null };
  titan: { fight: { tied: boolean }; boss: { defeated: boolean } | null };
}

export interface NalatiAdventureWorld<A extends { kind: string } = { kind: string }> {
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
  /** the animal manager: its onKill is chained on the first frame (a balbal toppled = chapter 2's clue) */
  animals?: { onKill?: ((a: A) => void) | undefined };
  /** the Golden King + Jel Ata (chapter 2 / 3 read their saved state) */
  nalati?: NalatiBosses | null;
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
/** the kurgan field's stone warriors (src/entities/species/balbal.ts BALBAL) */
const BALBAL_KIND = 'balbal';
const LABELS: Record<PersonId, string> = { elder: 'Talk to Baqyt Ata', herderGate: 'Talk to Dauren', herderRail: 'Talk to Erlan', child: 'Talk to Ayan', cook: 'Talk to Gulnar Apa' };
/** each chapter's achievement row (src/game/achievements.ts): its event, and the title it unlocks (for the caption) */
const REWARD: Record<string, { event: string; title: string }> = {
  'tulpar': { event: 'tulpar', title: 'Formerly On Foot' },
  'golden-king': { event: 'chapter-king', title: 'Honorary Balbal' },
  'father-wind': { event: 'chapter-wind', title: 'Weather Complainer (Successful)' },
};
/** the saved elite store (src/game/Elite.ts 'ws.elites.v1'): a named elite felled once (Argymaq: broken) = its storm feather */
const ELITE_STORE = 'ws.elites.v1';
function elitesFelled(): Set<string> {
  const out = new Set<string>();
  try {
    const all: unknown = JSON.parse(localStorage.getItem(ELITE_STORE) ?? '{}');
    if (typeof all !== 'object' || all === null) return out;
    for (const [id, v] of Object.entries(all as Record<string, unknown>)) if (typeof v === 'object' && v !== null && 'kills' in v && typeof v.kills === 'number' && v.kills > 0) out.add(id);
  } catch { /* nothing saved */ }
  return out;
}

export function installNalatiAdventure<A extends { kind: string }>(w: NalatiAdventureWorld<A>): NalatiAdventure | null {
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
    const title = REWARD[q.def.id]?.title;
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
  let eliteT = -1e9;
  const poll = (t = 0): void => {
    const tm = w.ride?.taming;
    if (tm?.phase === 'bonded') flags.set('tamed:horse');
    if (tm?.isArgymaq === true) { flags.set('tamed:argymaq'); flags.set('felled:argymaq'); }
    // chapter 2: the great kurgan (walked in, the King beaten — saved by the Boss, so a win before the chapter counts)
    const kb = w.nalati?.boss;
    if (kb?.inside === true) flags.set('entered:kurgan');
    if (kb?.boss?.defeated === true) flags.set('dead:golden-king');
    // chapter 3: the strip tied at the cairn in a storm, Jel Ata beaten
    const ti = w.nalati?.titan;
    if (ti?.fight.tied === true) flags.set('lit:cairn');
    if (ti?.boss?.defeated === true) flags.set('dead:jel-ata');
    // the storm feathers: one per named elite felled (the saved elite store, re-read every 2 s)
    if (t - eliteT > 2) {
      eliteT = t;
      for (const id of elitesFelled()) if (FEATHER_ELITES.some((e) => e.id === id)) flags.set(`felled:${id}`);
      const n = FEATHER_ELITES.filter((e) => flags.has(`felled:${e.id}`)).length;
      FEATHER_FLAGS.forEach((f, i) => { if (i < n && !flags.has(f)) { flags.set(f); if (line.active?.def.id === 'father-wind') w.hud.toast(`Storm feather · ${i + 1} / ${FEATHER_FLAGS.length}`); } });
    }
  };
  poll();

  // chapter 2's clues: a balbal warrior toppled while the chapter wants them — its carving, in the dialogue box.
  // Chained on the first frame, not now: main.ts assigns its own onKill (kill feed, achievements) after this
  const carving = (): void => {
    const q = line.active;
    if (q?.def.id !== 'golden-king' || q.current?.id !== 'clues') return;
    const i = CLUE_FLAGS.findIndex((f) => !flags.has(f));
    const flag = CLUE_FLAGS[i], lines = CARVINGS[i];
    if (flag === undefined || lines === undefined) return;
    w.hud.toast(`A carving on its back · clue ${i + 1} / ${CLUE_FLAGS.length}`);
    if (!dialogue.isOpen) dialogue.open(`A toppled balbal · ${i + 1} / ${CLUE_FLAGS.length}`, lines, () => undefined);
    flags.set(flag);
  };
  let chained = false;
  const chainKill = (): void => {
    chained = true;
    const an = w.animals;
    if (!an) return;
    const prev = an.onKill;
    an.onKill = (a) => { prev?.(a); if (a.kind === BALBAL_KIND) carving(); };
  };

  // ── achievements: the chapter + the kokpar as event rows (counts read back from the flags, like Driftwood's Feats) ──
  const feats = (): void => {
    const p = w.progress;
    if (!p) return;
    if (flags.has('won:kokpar')) p.recordEvent('kokpar', 1);
    for (const q of line.chapters) { const r = REWARD[q.def.id]; if (r && q.isComplete) p.recordEvent(r.event, 1); }
  };
  feats();
  flags.onChange((_f, on) => { if (on) feats(); });

  // ── per frame ──
  let slowT = 0;
  w.game.onUpdate((dt, t) => {
    if (!chained) chainKill();
    const pp = w.player.position;
    dialogue.update(dt);
    for (const { talk } of talks) talk.update(pp);
    people.update(dt, t, pp);
    kokpar.update(dt, pp, w.ride?.mount ?? null);
    chip.update(t, w.player);
    if (t - slowT > 0.5) { slowT = t; poll(t); places.update(pp.x, pp.z); }
  });

  const adventure: NalatiAdventure = { flags, line, people, kokpar, places, dialogue, chip, markers };
  Object.assign(window, { __nalatiQuest: { ...adventure, kokparGoals: KOKPAR_GOALS, carving, talk: (id: PersonId) => { talks.find((x) => x.id === id)?.talk.talk(); } } });
  return adventure;
}
