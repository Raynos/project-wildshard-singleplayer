import type { Actor } from '@wildshard/engine/combat/pipeline';
import type { MapPoi, MapQuest } from '@wildshard/engine/ui/Map';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

import type { QuestLine } from '@wildshard/engine/quest/core';
import type { QuestChip, LiveMarker, Places } from '@wildshard/engine/quest/view';
import type { DialogueBox } from '@wildshard/engine/quest/view/ui';
import type { AdventurePersistence as NalatiPersistence } from '@wildshard/game/quest/persistence';
import { bindStoryChapters, presentChapterStory } from '@wildshard/game/quest/story';
import source from './shard.config';
import type { ShardContext } from '@wildshard/game/shard/context';

import * as THREE from 'three';
import * as v from 'valibot';
import { NpcDialogueRowSchema } from '@wildshard/game/plugin/quests';
import { parseChapterStoryPresentation } from '@wildshard/format/questStory';
import { buildCampPeople, type CampPeople, type PersonId } from './campPeople';
import type { KokparMount, KokparRound } from './kokpar';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { poiMaterial } from './world/modelView';
import { bakedActorGeometry } from './world/placeBake';

/** what the adventure reads of Nalati's bosses (src/shards/nalati-grasslands/kurganBoss.ts KurganBoss, stormTitan.ts StormTitan) — polled */
export interface NalatiBosses {
  boss: { inside: boolean; boss: { defeated: boolean } | null };
  titan: { fight: { tied: boolean }; boss: { defeated: boolean } | null };
}

export interface NalatiAdventureWorld<A extends { kind: string; variant?: string; combatActor: () => Actor } = { kind: string; combatActor: () => Actor }> {
  ctx: ShardContext;
  game: { scene: THREE.Scene; onUpdate: (fn: (dt: number, t: number) => void, label?: string) => void };
  sky: Sky;
  player: { position: THREE.Vector3; yaw: number };
  chunk: { slug: string };
  /** main.ts's interactable list ("[E] …" prompts, the touch USE button) */
  prompts: Interactable[];
  hud: { toast: (text: string) => void };
  audio: { weaponSwap: () => void };
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void };
  persistence: NalatiPersistence;
  fullMap?: { setPois: (source: () => MapPoi[], opts?: { declutter?: boolean }) => void; setQuest?: (source: () => MapQuest | null) => void };
  registry?: WorldRegistry | undefined;
  /** Nalati's riding + taming (src/shards/nalati-grasslands/ride/ride.ts): the mount for the kokpar, the bonded horse for the quest */
  ride: { mount: KokparMount; taming: { phase: string; isArgymaq: boolean } } | null;
  /** the animal manager: its onKill is chained on the first frame (a balbal toppled = chapter 2's clue) */
  animals?: { animals: readonly A[]; onKill?: ((a: A) => void) | undefined };
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

const KokparRows = v.object({ program: v.unknown(), home: v.object({ x: v.number(), z: v.number() }),
  goals: v.array(v.object({ x: v.number(), z: v.number() })), messages: v.record(v.string(), v.string()) });
/** The guest owns round rules; this binding only applies its published pose and service effects. */
export function kokparView(w: Pick<NalatiAdventureWorld, 'sky' | 'hud' | 'music' | 'player' | 'ride'> & {
  ctx: Pick<ShardContext, 'scope'>; persistence: { flags: Pick<Flags, 'set'> };
}, floorAt: (x: number, z: number) => number, kokparRows: v.InferOutput<typeof KokparRows>,
goat: THREE.Mesh = new THREE.Mesh(bakedActorGeometry('goat'), poiMaterial(w.sky))): KokparRound {
  goat.castShadow = true; goat.receiveShadow = true; goat.name = 'nalati-kokpar-goat';
  const home = new THREE.Vector3(kokparRows.home.x, floorAt(kokparRows.home.x, kokparRows.home.z) + 0.16, kokparRows.home.z);
  const lie = (): void => { goat.position.copy(home); goat.rotation.set(0, 0.7, Math.PI / 2 - 0.25); };
  lie();
  const brain = ReturnProgram.page(kokparRows.program, w.ctx.scope), state = { carrying: 0, left: 0, slow: 0, cheer: 0, warned: 0 };
  const messages = new Map<string, string>(Object.entries(kokparRows.messages));
  const carryPose = (horse: NonNullable<KokparMount['horse']>): void => {
    goat.position.set(horse.position.x + Math.cos(horse.yaw) * 0.62, horse.position.y + 1.02, horse.position.z - Math.sin(horse.yaw) * 0.62);
    goat.rotation.set(0, horse.yaw + Math.PI / 2, 0.35);
  };
  const project = (signal: string, dt: number, player: THREE.Vector3, mount: KokparMount | null): void => {
    const horse = mount?.horse, out = brain.project(signal, { ...state, dt, playerX: player.x, playerZ: player.z,
      goatX: goat.position.x, goatZ: goat.position.z, mounted: Number(mount?.mounted === true), horse: Number(horse !== null && horse !== undefined),
      fast: Number(mount?.gait === 'canter' || mount?.gait === 'gallop'), practice: Number(practiceRoom.open), horseX: horse?.position.x ?? 0, horseZ: horse?.position.z ?? 0 });
    for (const key of ['carrying', 'left', 'slow', 'cheer', 'warned'] as const) {
      const value = out[key]; if (value === undefined) throw new Error('Missing kokpar state'); state[key] = value;
    }
    const notice = (id: string): void => { const text = messages.get(id); if (text === undefined) throw new Error('Missing kokpar notice'); w.hud.toast(text); };
    if (out['warning'] === 1) notice('6');
    if (out['pose'] === 1) lie();
    else if ((out['pose'] === 2 || out['pose'] === 3) && horse !== null && horse !== undefined) carryPose(horse);
    const event = out['event'];
    if (event !== undefined && event > 0) {
      notice(String(event)); w.music.sting(event === 1 ? 'pickup' : event === 7 ? 'chunk' : 'death');
      if (event === 7) w.persistence.flags.set('won:kokpar');
    }
    if (out['pose'] === 3) {
      const goal = kokparRows.goals[out['goal'] ?? -1]; if (goal === undefined) throw new Error('Missing kokpar goal');
      goat.position.set(goal.x, floorAt(goal.x, goal.z) + 0.9, goal.z); goat.rotation.set(0, 0.3, Math.PI / 2 - 0.2);
    }
  };
  let pending = 0;
  return { object: goat, get carrying() { return state.carrying !== 0; },
    win: () => { project('win', 0, w.player.position, w.ride?.mount ?? null); },
    update: (dt, player, mount) => {
      pending += dt;
      if (pending >= 0.1) { const elapsed = pending; pending = 0; project('step', elapsed, player, mount); }
      else if (state.carrying !== 0 && mount?.horse !== null && mount?.horse !== undefined) carryPose(mount.horse);
    } };
}

const Content = v.object({ npcs: v.record(v.string(), NpcDialogueRowSchema), places: v.array(v.object({ id: v.string(), label: v.string(), x: v.number(), z: v.number(), r: v.number(), quiet: v.exactOptional(v.boolean()), y: v.exactOptional(v.number()) })),
  clueFlags: v.array(v.string()), carvings: v.array(v.array(v.string())), featherFlags: v.array(v.string()),
  featherElites: v.array(v.object({ id: v.string() })), kokpar: KokparRows });
/** Saved elite read failures are recoverable; quest/save listener failures must propagate. */
export function syncFelledElites(flags: Pick<Flags, 'set'>, elites: readonly { id: string }[], read: () => ReturnType<NalatiPersistence['elites']['read']>): void {
  let savedElites: ReturnType<NalatiPersistence['elites']['read']> = {};
  try { savedElites = read(); } catch { /* No saved elites yet. */ }
  for (const [id, saved] of Object.entries(savedElites)) if (saved.kills > 0 && elites.some(e => e.id === id)) flags.set(`felled:${id}`);
}

export async function installNalatiAdventure<A extends { kind: string; variant?: string; combatActor: () => Actor }>(w: NalatiAdventureWorld<A>): Promise<NalatiAdventure | null> {
  const scope = w.ctx.scope;
  if (w.chunk.slug !== 'nalati-grasslands') return null;
  const [storyBytes, contentBytes] = await Promise.all([w.ctx.product.file('quests/chapters.json'), w.ctx.product.file('quests/content.json')]);
  if (scope.disposed) throw new Error('The adventure left during story admission');
  const story = parseChapterStoryPresentation(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(storyBytes)));
  const content = v.parse(Content, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(contentBytes)));
  const flags = w.persistence.flags;
  if (w.params?.has('resetquest') === true) flags.reset();
  for (const f of (w.params?.get('questflags') ?? '').split(',')) if (f.trim() !== '') flags.set(f.trim());

  const floorAt = (x: number, z: number): number => {
    const y = heightAt(x, z), r = w.registry?.floorAt(x, z);
    return r !== undefined && r > y && r < y + 2 ? r : y;   // a deck, not a roof
  };

  // ── the camp's people ──
  const people = buildCampPeople(w.sky, floorAt, w.registry ?? null, scope);
  if (!w.registry) w.game.scene.add(people.group);

  // ── the quest line, the chip, the dialogue ──
  const line = bindStoryChapters(w.ctx, source, story.chapters, { flags, facts: w.persistence.facts });
  const presentation = presentChapterStory(line, story, { scope, ctx: w.ctx, flags,
    figures: people.fig, npcs: content.npcs, places: content.places, prompts: w.prompts,
    toast: text => { w.hud.toast(text); }, sting: () => { w.music.sting('chunk'); }, open: () => { w.audio.weaponSwap(); },
    feat: w.persistence.feat,
    ...(w.fullMap === undefined ? {} : { fullMap: w.fullMap }) });
  const { chip, markers, places, dialogue: currentDialogue } = presentation;

  // ── a round of kokpar (TULPAR step 2; open any time) ──
  const kokpar = kokparView(w, floorAt, content.kokpar);
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
      syncFelledElites(flags, content.featherElites, () => w.persistence.elites.read(w.chunk.slug));
      const n = content.featherElites.filter((e) => flags.has(`felled:${e.id}`)).length;
      content.featherFlags.forEach((f, i) => { if (i < n && !flags.has(f)) { flags.set(f); if (line.active?.def.id === 'father-wind') w.hud.toast(`Storm feather · ${i + 1} / ${content.featherFlags.length}`); } });
    }
  };
  poll();

  // chapter 2's clues: a balbal warrior toppled while the chapter wants them — its carving, in the dialogue box.
  // Chained on the first frame, not now: main.ts assigns its own onKill (kill feed, achievements) after this
  const carving = (): void => {
    const q = line.active;
    if (q?.def.id !== 'golden-king' || q.current?.id !== 'clues') return;
    const i = content.clueFlags.findIndex((f) => !flags.has(f));
    const flag = content.clueFlags[i], lines = content.carvings[i];
    if (flag === undefined || lines === undefined) return;
    w.hud.toast(`A carving on its back · clue ${i + 1} / ${content.clueFlags.length}`);
    const dialogue = currentDialogue();
    if (!dialogue.isOpen) dialogue.open(`A toppled balbal · ${i + 1} / ${content.clueFlags.length}`, lines, () => undefined);
    flags.set(flag);
  };
  w.ctx.on('actor.died', ({ actor }) => {
    const animal = w.animals?.animals.find(a => a.combatActor() === actor);
    if (animal === undefined) return;
    w.persistence.kill(animal.kind, animal.variant);
    if (animal.kind === 'balbal') carving();
  });

  presentation.installFeats();

  // ── per frame ──
  let slowT = 0;
  const update = (dt: number, t: number): void => {
    const pp = w.player.position;
    presentation.update(dt, pp);
    people.update(dt, t, pp);
    kokpar.update(dt, pp, w.ride?.mount ?? null);
    chip.update(t, w.player);
    if (t - slowT > 0.5) { slowT = t; poll(t); places.update(pp.x, pp.z); }
  };
  w.ctx.system({ id: 'shard.nalati.quest', phase: 'update', after: ['main.6'], before: ['hud.combat', 'shard.nalati-grasslands.bind', 'first hints', 'main.world', 'main.frame'], run: update });

  const adventure: NalatiAdventure = { flags, line, people, kokpar, places, get dialogue() { return currentDialogue(); }, chip, markers };
  // Object spread would evaluate adventure.dialogue while road preparation still has no entered dialogue scope.
  const debug = { flags, line, people, kokpar, places, chip, markers, get dialogue() { return currentDialogue(); }, kokparGoals: content.kokpar.goals, carving, talk: (id: PersonId) => { presentation.talk(id); } };
  w.ctx.debug.expose('nalati.quest', debug);
  return adventure;
}
