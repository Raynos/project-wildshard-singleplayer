import { Vector3 } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SystemSpec } from '@wildshard/engine/app/systems';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { Events } from '@wildshard/engine/events/events';
import type { HudVerbs } from '@wildshard/engine/level/context';
import type { MapPoi, MapQuest } from '@wildshard/engine/ui/Map';
import type { MapMark } from '@wildshard/engine/ui/Minimap';
import { Flags } from '@wildshard/engine/world/interact/flags';
import type { Place } from '@wildshard/engine/world/interact/types';
import { QuestState, type QuestDef, type QuestStep, type NpcDef } from '@wildshard/engine/quest/core';
import { QuestChip, NpcTalk, placesWithDiscovery, type LiveMarker, type PlacePoint, type Places, type NpcTalkOpts } from '@wildshard/engine/quest/view';
import { DialogueBox } from '@wildshard/engine/quest/view/ui';
import { QuestRewardBeat, type QuestRewardSpec, type QuestRewardPlayer } from './reward';
import { createLevelInstallation } from '@wildshard/engine/level/installation';
import type { ShardContext } from '../shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '../shard/retainedHooks';
import './presentation.css';

export interface QuestTarget {
  position: Vector3;
  label: string;
  short?: string;
  npc?: QuestPresentationNpc;
}
export interface QuestPresentationNpc {
  npc: NpcDef;
  at: Vector3;
  label: string;
  speaker: NpcTalkOpts['speaker'];
  radius?: number;
  /** A target NPC is offered only during this step; omit for a persistent quest giver. */
  step?: string;
  onOpen?: NonNullable<NpcTalkOpts['onOpen']>;
  onDone?: NonNullable<NpcTalkOpts['onDone']>;
}
export interface PresentedQuestStep extends Omit<QuestStep, 'objective'> {
  title: string;
  target: QuestTarget;
}
export interface PresentedQuestDef extends Omit<QuestDef, 'steps'> { steps: PresentedQuestStep[] }
export interface QuestPresentationOptions {
  flags?: Flags;
  /** Resolve existing POI-local markers; simple target positions need no resolver. */
  place?: (at: Place) => { x: number; y: number; z: number };
  introTitle?: string;
  npc?: QuestPresentationNpc;
  npcs?: QuestPresentationNpc[];
  places?: PlacePoint[];
  reward?: QuestRewardSpec | false;
  /** Existing adventures can retain their authored beat strings and leftovers. */
  stepToast?: (step: QuestStep, previous: QuestStep | null, quest: QuestState) => string;
  stepCompleteToast?: false | ((step: QuestStep) => string);
  completeToast?: (quest: QuestState) => string;
  chip?: () => { label: string; count: string };
  markers?: () => LiveMarker[];
  worldPins?: boolean;
  mapMarkers?: boolean;
  minimapMarks?: boolean;
}
export interface QuestPresentationHost {
  scope: Scope;
  player: QuestRewardPlayer;
  toast: (text: string) => void;
  sting: () => void;
  pin?: HudVerbs['pin'];
  fullMap?: { setQuest?: (source: () => MapQuest | null) => void; addQuest?: (source: () => MapQuest | null) => () => void; addPois?: (source: () => MapPoi[]) => () => void };
  minimap?: { addMarks: (source: () => readonly MapMark[]) => () => void } | null;
  prompts?: NpcTalk['prompt'][];
  stowWeapon?: (on: boolean) => void;
  setViewmodel?: (on: boolean) => void;
  dayNight?: { phase: number } | null;
}
export interface QuestPresentation {
  quest: QuestState;
  chip: QuestChip;
  markers: () => LiveMarker[];
  places: Places | null;
  reward: QuestRewardBeat | null;
  update: (dt: number, t: number) => void;
  dispose: () => void;
}
/** Structural play-context port; a ShardContext supplies all of it. */
export interface QuestPresentationContext {
  scope: Scope;
  app: { events: Events };
  manifest: { slug: string };
  system: (spec: SystemSpec) => void;
  hud: Pick<HudVerbs, 'pin'>;
  game: { runtime?: {
    world: { player: QuestRewardPlayer; sky: { dayNight?: { phase: number } | null } } | null;
    play: {
      hud: { toast: (text: string) => void };
      music: { sting: (name: 'chunk') => void };
      weapons: { visible: boolean; stowed: boolean };
      fullMap: NonNullable<QuestPresentationHost['fullMap']>;
      minimap?: QuestPresentationHost['minimap'];
    } | null;
    interactables: NpcTalk['prompt'][];
  } };
}

/** Shared wiring for older adventures that own their frame order. New shards use installQuestPresentation. */
export function presentQuest(host: QuestPresentationHost, quest: QuestState, options: QuestPresentationOptions = {}): QuestPresentation {
  const scope = host.scope.child(`quest.${quest.def.id}`);
  const resolve = options.place ?? ((at: Place) => {
    if (at.poi !== 'world' || at.anchor !== undefined) throw new Error('Quest POI markers require a place resolver');
    return { x: at.x, y: (at.y ?? 0) + (at.dy ?? 0), z: at.z };
  });
  const markers = (): LiveMarker[] => quest.markers().map((m) => {
    const p = resolve(m.at);
    return { id: m.id, label: m.label, short: m.short ?? m.label, x: p.x, z: p.z };
  });
  const chip = new QuestChip({ chip: options.chip ?? (() => quest.chip()), markers: options.markers ?? markers });
  scope.onDispose(() => { chip.line.scope.dispose(); });
  const onStep: NonNullable<QuestState['onStep']> = (step, prev) => {
    if (prev && typeof options.stepCompleteToast === 'function') host.toast(options.stepCompleteToast(prev));
    if (step) host.toast(options.stepToast?.(step, prev, quest) ?? (prev === null ? `New quest · ${quest.def.title}` : `Objective · ${quest.objective()}`));
    host.sting();
  };
  const onComplete = (): void => { host.toast(options.completeToast?.(quest) ?? `Quest complete · ${quest.def.title}`); };
  scope.onDispose(quest.observe({ step: onStep, complete: onComplete }));
  const card = (): MapQuest => ({ title: quest.isStarted ? quest.def.title : options.introTitle ?? quest.def.title, objective: quest.objective(), hint: quest.isComplete ? '' : quest.hint() });
  if (host.fullMap?.addQuest) scope.onDispose(host.fullMap.addQuest(card));
  else host.fullMap?.setQuest?.(card);
  const flags = options.flags ?? quest.flags;
  const places = options.places ? placesWithDiscovery(options.places, flags, host.toast, markers) : null;
  if (options.mapMarkers !== false && host.fullMap?.addPois) scope.onDispose(host.fullMap.addPois(() => places?.mapPois() ?? markers().map((m) => ({ x: m.x, z: m.z, label: m.label, short: m.short, kind: 'quest' }))));
  if (options.minimapMarks !== false && host.minimap) scope.onDispose(host.minimap.addMarks(() => markers().map((m) => ({ x: m.x, z: m.z, color: '#8fe3ff' }))));

  const pins = new Map<string, { root: HTMLElement; distance: HTMLElement; position: Vector3 }>();
  if (options.worldPins !== false && host.pin) {
    const all = [...(quest.def.intro?.markers ?? []), ...quest.def.steps.flatMap((step) => step.markers ?? [])];
    for (const m of all) {
      // The same id can occur at a different position in a later step; projection reads the active marker.
      if (pins.has(m.id)) continue;
      const root = document.createElement('span'); root.className = 'ws-quest-pin';
      const label = document.createElement('span'), distance = document.createElement('b');
      root.append(label, distance);
      const position = new Vector3(); pins.set(m.id, { root, distance, position });
      host.pin(() => {
        if (scope.disposed || practiceRoom.open) return null;
        const active = quest.markers().find((a) => a.id === m.id);
        if (!active) return null;
        const at = resolve(active.at); position.set(at.x, at.y + 2.2, at.z);
        label.textContent = active.short ?? active.label;
        return position;
      }, root);
      scope.onDispose(() => { root.remove(); });
    }
  }
  const npcs = [...(options.npc ? [options.npc] : []), ...(options.npcs ?? [])];
  const dialogue = npcs.length > 0 ? new DialogueBox(scope.child('dialogue')) : null;
  const talks = dialogue ? npcs.map((npc) => {
    const talk = new NpcTalk({ ...npc, radius: npc.radius ?? 3.2, flags, dialogue });
    const prompt = { ...talk.prompt, get radius() { return npc.step === undefined || quest.current?.id === npc.step || talk.talking ? talk.prompt.radius : 0; } };
    host.prompts?.push(prompt);
    scope.onDispose(() => {
      const i = host.prompts?.indexOf(prompt) ?? -1; if (i >= 0) host.prompts?.splice(i, 1);
      npc.speaker.talking = false;
    });
    return talk;
  }) : [];
  let stowed = false;
  scope.onDispose(() => { if (stowed) host.stowWeapon?.(false); });
  const reward = options.reward !== undefined && options.reward !== false ? new QuestRewardBeat({ ...host, scope, objective: chip.line.root }, options.reward) : null;
  const update = (dt: number, t: number): void => {
    if (scope.disposed || practiceRoom.open) return;
    chip.update(t, host.player);
    places?.update(host.player.position.x, host.player.position.z, host.player.position.y);
    for (const pin of pins.values()) pin.distance.textContent = `${Math.round(Math.hypot(pin.position.x - host.player.position.x, pin.position.z - host.player.position.z))} m`;
    dialogue?.update(dt); for (const talk of talks) talk.update(host.player.position);
    const talking = talks.some((talk) => talk.talking);
    if (talking !== stowed) { stowed = talking; host.stowWeapon?.(stowed); }
    reward?.update(dt);
  };
  return { quest, chip, markers, places, reward, update, dispose: () => { scope.dispose(); } };
}

/** One call in play(ctx): Wendell's chip, MAP card, diamonds, world pins, discovery, dialogue and reward. */
export function installQuestPresentation(ctx: QuestPresentationContext, source: QuestState | QuestDef | PresentedQuestDef, options: QuestPresentationOptions = {}): QuestPresentation {
  const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
  if (!runtime || !world || !play || ctx.scope.disposed) throw new Error('Quest presentation requires a live play host');
  const flags = options.flags ?? (source instanceof QuestState ? source.flags : new Flags(ctx.manifest.slug));
  const def: QuestDef | null = source instanceof QuestState ? null : { ...source, steps: source.steps.map((s) => {
    if (!('target' in s)) return s;
    const { target, title, ...step } = s;
    return { ...step, objective: title, markers: s.markers ?? [{ id: s.id, label: target.label, ...(target.short === undefined ? {} : { short: target.short }), at: { poi: 'world', x: target.position.x, y: target.position.y, z: target.position.z } }] };
  }) };
  const quest = source instanceof QuestState ? source : new QuestState(def ?? source as QuestDef, flags, ctx.app.events, ctx.scope);
  const targetNpcs = source instanceof QuestState ? [] : source.steps.flatMap((s) => 'target' in s && s.target.npc ? [{ ...s.target.npc, step: s.id }] : []);
  const targetPlaces = source instanceof QuestState ? [] : source.steps.flatMap((s) => 'target' in s ? [{ id: `${source.id}.${s.id}`, label: s.target.label, x: s.target.position.x, y: s.target.position.y, z: s.target.position.z, r: 12 }] : []);
  const alreadyComplete = quest.isComplete;
  const reward: QuestRewardSpec | false = options.reward ?? { kicker: 'Quest complete', title: quest.def.title, subtitle: '', when: () => !alreadyComplete && quest.isComplete, finish: () => undefined };
  const presentation = presentQuest({ scope: ctx.scope, player: world.player, toast: (text) => { play.hud.toast(text); }, sting: () => { play.music.sting('chunk'); },
    pin: ctx.hud.pin, fullMap: play.fullMap, minimap: play.minimap ?? null, prompts: runtime.interactables,
    dayNight: world.sky.dayNight ?? null, setViewmodel: (on) => { play.weapons.visible = on; }, stowWeapon: (on) => { play.weapons.stowed = on; } }, quest, { ...options, flags, reward,
      stepCompleteToast: options.stepCompleteToast ?? ((step) => `Step complete · ${step.chip ?? step.objective}`),
      places: options.places ?? targetPlaces, npcs: [...(options.npcs ?? []), ...targetNpcs] });
  ctx.system({ id: `game.quest.${quest.def.id}`, phase: 'update', when: (app) => app.state === 'play', run: presentation.update });
  if (!(source instanceof QuestState)) {
    const disposeView = presentation.dispose;
    presentation.dispose = () => { disposeView(); quest.dispose(); };
  }
  return presentation;
}

/** Keep quest state resident while rebuilding its ordinary presentation and input in each entered cell scope. */
export function installEnteredQuestPresentation(context: ShardContext, quest: QuestState, options: QuestPresentationOptions = {}): () => QuestPresentation | null {
  if (!retainsRuntimeServices(context)) throw new Error('Entered quest presentation needs a retained context');
  let current: QuestPresentation | null = null;
  installEnteredRuntimeService(context, scope => {
    // A fresh ordinary installation binds pins and systems to this entry without registering new retained installers.
    const installation = createLevelInstallation(context.app, scope, context.app.levelAdapters, () => context.progress);
    const presentation = installQuestPresentation({ ...context, ...installation.context }, quest, options);
    current = presentation;
    scope.onDispose(() => { presentation.dispose(); if (current === presentation) current = null; });
  });
  return () => current;
}
