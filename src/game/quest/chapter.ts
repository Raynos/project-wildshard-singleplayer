import { Vector3, type Object3D, type Scene } from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { ownSceneTree, sceneObjectOwner } from '@wildshard/engine/app/sceneOwnership';
import type { Scope } from '@wildshard/engine/app/scope';
import type { QuestState } from '@wildshard/engine/quest/core';
import type { LiveMarker } from '@wildshard/engine/quest/view';
import type { DialogueBox, ObjectiveLine } from '@wildshard/engine/quest/view/ui';
import type { QuestStory } from '@wildshard/format/questStory';
import type { Interactable, Place } from '@wildshard/engine/world/interact/types';
import type { Interactables } from '@wildshard/engine/world/interact/Interactables';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { MapQuest } from '@wildshard/engine/ui/Map';
import { bindStoryChapters, presentChapterStory, installStoryTalks } from './story';
import { QuestViews, type QuestTalkFigure, type QuestNpcTalkPorts } from '../plugin/ui';
import { bindQuestDeathEffects } from '../plugin/quests';
import type { bindRuntimeQuest, RuntimeFacts } from '../plugin/headless';

/** A rendered chapter view; the existing flags and save owner remain authoritative. */
export interface QuestChapter {
  quest: QuestState;
  dialogue: DialogueBox;
  objective: ObjectiveLine;
  markers: () => LiveMarker[];
}
/** Respect a piece's owner when a quest borrows it; own only the entry's unowned subtree. */
export function ownQuestTree(object: Object3D, scope: Scope): void {
  const mine = sceneObjectOwner(object);
  if (mine !== null && mine !== (object.parent === null ? null : sceneObjectOwner(object.parent))) return;
  ownSceneTree(object, scope, app.assets);
}
/** A native pivot figure lends its existing head point, greeting and rig update. */
export interface QuestChapterFigure extends QuestTalkFigure {
  readonly position: Vector3;
  headWorld: (out: Vector3) => Vector3;
  wave: () => void;
}
/** Existing world and UI owners, passed as capabilities rather than shard callbacks. */
export interface QuestChapterWorld<Body extends { readonly kind: string; readonly position: { readonly x: number; readonly z: number } }> {
  readonly game: { readonly scene: Scene; onUpdate: (run: (dt: number, t: number) => void, label?: string) => void };
  readonly player: { readonly position: Vector3; readonly yaw: number };
  readonly hud: { toast: (text: string) => void };
  readonly music: { sting: (name: 'chunk') => void };
  readonly audio: { weaponSwap: () => void };
  readonly registry?: WorldRegistry | undefined;
  readonly prompts: Interactable[];
  readonly fullMap?: { setQuest?: (source: () => MapQuest | null) => void };
  readonly stowWeapon?: ((on: boolean) => void) | undefined;
  readonly onDeath?: ((run: (body: Body) => void, order: number) => void) | undefined;
}
/** Borrowed figure rigs keep their own model recipe, collider, materials and animation law. */
export interface QuestChapterPorts<Figure extends QuestChapterFigure> {
  readonly flags: Parameters<typeof bindRuntimeQuest>[3]['flags'];
  readonly facts: RuntimeFacts;
  readonly placement: { readonly place: (place: Place) => { x: number; y: number; z: number; yaw: number } };
  readonly figures: ReadonlyMap<string, { readonly model: Figure; update: (dt: number, time: number, player: Vector3) => void; dispose: () => void }>;
  readonly adventure: { readonly complete: { leftMarkers: () => LiveMarker[] } | null; readonly kit: Pick<Interactables, 'moveTo'> };
  readonly deaths: unknown;
  readonly drops: readonly { readonly call: string; readonly item: string }[];
  readonly system: string;
}
/** Compose declared chapters and named NPC dialogue at the original event and update phases. */
export function installQuestChapter<Figure extends QuestChapterFigure, Body extends { readonly kind: string; readonly position: { readonly x: number; readonly z: number } }>(ctx: ConstructorParameters<typeof QuestViews>[0],
  source: Parameters<typeof bindRuntimeQuest>[1], story: QuestStory, worldOwners: ReadonlyMap<string, QuestChapterWorld<Body>>, questOwners: ReadonlyMap<string, QuestChapterPorts<Figure>>): QuestChapter {
  const world = worldOwners.get('world'), ports = questOwners.get('quest');
  if (world === undefined || ports === undefined) throw new Error('Missing declared quest chapter owners');
  if (story.chapters === undefined) throw new Error('Quest requires its chapter presentation');
  const { flags, facts, placement: { place } } = ports;
  const chapters = bindStoryChapters(ctx, source, [story.quest.id], { flags, facts,
    place: marker => story.quest.markers[marker.id] }, 'after-facts');
  const quest = chapters.chapters[0];
  if (quest === undefined) throw new Error('Quest requires its declared chapter');
  const leftovers = (): LiveMarker[] | null => quest.isComplete ? ports.adventure.complete?.leftMarkers() ?? null : null;
  const presentation = presentChapterStory(chapters, story.chapters, { scope: ctx.scope, flags,
    figures: {}, npcs: {}, places: [], prompts: [], open: () => undefined, toast: text => { world.hud.toast(text); }, sting: () => { world.music.sting('chunk'); },
    ...(world.fullMap?.setQuest === undefined ? {} : { fullMap: { setQuest: world.fullMap.setQuest.bind(world.fullMap) } }), place,
    chip: () => { const left = leftovers(); return left === null ? quest.chip() : { label: left.length > 0 ? 'Still to find' : '', count: '' }; },
    markers: () => leftovers() ?? presentation.markers(),
  });
  const objective = presentation.chip.line;
  ctx.scope.onDispose(() => { quest.dispose(); objective.root.remove(); });
  const figures: QuestNpcTalkPorts<Figure>['figures'] = new Map([...ports.figures].map(([id, rig]) => {
    ctx.scope.onDispose(() => { rig.dispose(); });
    return [id, { kind: 'borrowed' as const, create: () => rig.model,
      own: (figure: Figure, register: () => void) => { ownQuestTree(figure.group, ctx.scope); ctx.scope.run(register); },
      at: (figure: Figure) => { figure.group.updateMatrixWorld(true); return figure.headWorld(new Vector3()); },
      advance: (_figure: Figure, dt: number, time: number, player: Vector3) => { rig.update(dt, time, player); },
      open: () => { world.audio.weaponSwap(); }, stow: (on: boolean) => { world.stowWeapon?.(on); },
      approach: { at: (figure: Figure) => figure.position, run: (figure: Figure) => { figure.wave(); } } }];
  }));
  const talks = installStoryTalks(new QuestViews(ctx), source, { flags, scene: world.game.scene, registry: world.registry ?? app.registry,
    prompts: world.prompts, calls: new Map(), figures });
  if (talks.people.length === 0) throw new Error('Quest requires its declared speaker');
  const calls = new Map(ports.drops.map(row => [row.call, (body: Body) => { ports.adventure.kit.moveTo(row.item, body.position.x, body.position.z); }]));
  world.onDeath?.(bindQuestDeathEffects<Body>(ports.deaths, { flags, calls, toast: text => { world.hud.toast(text); } }), 10);
  world.game.onUpdate((dt, t) => {
    talks.update(dt, t, world.player.position);
    presentation.update(dt, world.player.position);
    if (!practiceRoom.open) presentation.chip.update(t, world.player);
  }, ports.system);
  return { quest, get dialogue() { return talks.dialogue(); }, objective, markers: presentation.markers };
}
