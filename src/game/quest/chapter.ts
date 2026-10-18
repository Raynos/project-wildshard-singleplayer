import * as v from 'valibot';
import type { Object3D } from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { ownSceneTree, sceneObjectOwner } from '@wildshard/engine/app/sceneOwnership';
import type { Scope } from '@wildshard/engine/app/scope';
import type { QuestState } from '@wildshard/engine/quest/core';
import { placesWithDiscovery, type Places, type LiveMarker } from '@wildshard/engine/quest/view';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { FullMap } from '@wildshard/engine/ui/Map';
import type { ObjectiveLine } from '@wildshard/engine/quest/view/ui';
import { parseQuestStory } from '@wildshard/format/questStory';
import type { ShardContext } from '../plugin/context';
import { completionProjection, type CompletionProgress } from '../complete/declared';
import type { QuestPresentationHost, QuestPresentationOptions } from '../plugin/ui';
import { boundQuestServices, findBoundQuestState, installBoundQuestFlags } from './boundState';
import { bindRuntimeQuest } from '../plugin/headless';
import { bindStoryChapters, presentChapterStory, presentQuestStory } from './story';

const finite = v.pipe(v.number(), v.finite());
const point = v.strictObject({ x: finite, y: finite, z: finite });
const discoverySchema = v.pipe(v.array(v.strictObject({ id: v.string(), label: v.string(), x: finite, z: finite,
  r: v.pipe(finite, v.minValue(0)), quiet: v.exactOptional(v.boolean()) })), v.maxLength(64));
const schema = v.strictObject({
  placements: v.exactOptional(v.record(v.string(), point)),
  completion: v.exactOptional(v.boolean()),
  remainingLabel: v.exactOptional(v.string()),
});
/** Existing entered services; callers cannot inject story policy or owner paths. */
export interface QuestChapterContext extends Pick<ShardContext, 'app' | 'scope' | 'product'> {
  readonly game: { readonly runtime?: {
    readonly world: { readonly player: QuestPresentationHost['player'] } | null;
    readonly play: { readonly progress?: CompletionProgress; readonly fullMap: Pick<FullMap, 'setQuest'>;
      readonly hud: { toast: (text: string) => void }; readonly music: { sting: (name: 'chunk') => void } } | null;
  } };
}
/** A client-only view over a quest already bound by its existing progression owner. */
export interface QuestChapter {
  readonly quest: QuestState;
  readonly objective: ObjectiveLine;
  readonly places: Places | null;
  readonly discover: (rows: unknown) => Places;
  readonly chip: ReturnType<typeof presentQuestStory>['chip'];
  readonly markers: () => LiveMarker[];
}
const chapters = new WeakMap<Scope, Map<string, QuestChapter>>();
/** Framework lookup of the installed chapter, sharing its original objective owner. */
export function boundQuestChapter(scope: Scope, id: string): QuestChapter {
  const chapter = chapters.get(scope)?.get(id);
  if (scope.disposed || chapter === undefined) throw new Error('Chapter presentation is not installed');
  return chapter;
}
/** Respect a piece's owner when a quest borrows it; own only the entry's unowned subtree. */
export function ownQuestTree(object: Object3D, scope: Scope): void {
  const mine = sceneObjectOwner(object);
  if (mine !== null && mine !== (object.parent === null ? null : sceneObjectOwner(object.parent))) return;
  ownSceneTree(object, scope, app.assets);
}

/** Bind the existing saved flag book by declared quest id and its original level key. */
export function installQuestFlags(ctx: Pick<QuestChapterContext, 'scope' | 'product'>, id: string, level: string): Flags {
  if (!ctx.product.shardfile.quests.quests.some(row => row.id === id)) throw new Error('Quest flags require a declared quest');
  return installBoundQuestFlags(ctx.scope, id, level);
}

/** Client-only chapter presentation. Intake is story/placement rows and an existing quest id;
 * play, map, music, flags and completion progress resolve from the entered context.
 * Anchors are the placement owner's coordinate table, never callbacks or reflected services.
 * The caller retains the original UI update phase; this installs no clock or save owner.
 */
export function installQuestChapter(ctx: QuestChapterContext, storyInput: unknown,
  input: unknown = {}, anchors?: ReadonlyMap<string, { readonly x: number; readonly z: number }>): QuestChapter {
  const story = parseQuestStory(storyInput), rows = v.parse(schema, input);
  const existing = findBoundQuestState(ctx.scope, story.quest.id);
  if (chapters.get(ctx.scope)?.has(story.quest.id) === true) throw new Error('Chapter presentation is already installed');
  const services = existing === undefined ? boundQuestServices(ctx.scope, story.quest.id) : { flags: existing.flags };
  const ports: Parameters<typeof bindRuntimeQuest>[3] = { ...services, place: marker => story.quest.markers[marker.id] };
  const line = story.chapters === undefined ? null
    : bindStoryChapters(ctx, ctx.product.shardfile, [story.quest.id], ports, 'after-facts');
  const quest = existing ?? line?.chapters[0] ?? bindRuntimeQuest(ctx, ctx.product.shardfile, story.quest.id, ports).state;
  const world = ctx.game.runtime?.world, play = ctx.game.runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null) throw new Error('Quest chapter requires its entered play services');
  if (rows.placements !== undefined) {
    const markers = [...quest.def.intro?.markers ?? [], ...quest.def.steps.flatMap(step => step.markers ?? [])];
    if (markers.some(marker => rows.placements?.[JSON.stringify(marker.at)] === undefined)) throw new Error('Quest chapter lacks an admitted marker placement');
  }
  const complete = rows.completion === true ? ctx.product.section('ui/completion') : null;
  const left = (): LiveMarker[] | null => complete === null || !quest.isComplete ? null
    : completionProjection(complete, quest.flags, play.progress, undefined, undefined, anchors).markers;
  const markers = (): LiveMarker[] => quest.markers().map(marker => {
    const at = rows.placements?.[JSON.stringify(marker.at)] ?? marker.at;
    return { id: marker.id, label: marker.label, short: marker.short ?? marker.label, x: at.x, z: at.z };
  });
  const toast = (text: string): void => { play.hud.toast(text); }, sting = (): void => { play.music.sting('chunk'); };
  const fullMap = { setQuest: play.fullMap.setQuest.bind(play.fullMap) };
  const options: Pick<QuestPresentationOptions, 'markers' | 'chip' | 'place'> = { markers: () => left() ?? markers(), chip: () => { const remaining = left(); return remaining === null ? quest.chip()
      : { label: remaining.length > 0 ? rows.remainingLabel ?? '' : '', count: '' }; },
    ...(rows.placements === undefined ? {} : { place: at => {
      const resolved = rows.placements?.[JSON.stringify(at)];
      if (resolved === undefined) throw new Error('Quest chapter lacks an admitted marker placement');
      return resolved;
    } }),
  };
  const presentation = line === null || story.chapters === undefined
    ? presentQuestStory(story, { scope: ctx.scope, player: world.player, fullMap, toast, sting }, quest, options)
    : presentChapterStory(line, story.chapters, { scope: ctx.scope, flags: quest.flags, figures: {}, npcs: {},
      places: [], prompts: [], open: () => undefined, fullMap, toast, sting, ...options });
  let places: Places | null = null;
  const discover = (catalogue: unknown): Places => {
    if (places !== null) throw new Error('Quest discovery is already installed');
    places = placesWithDiscovery(v.parse(discoverySchema, catalogue), quest.flags, text => { play.hud.toast(text); }, markers);
    return places;
  };
  ctx.scope.onDispose(() => { presentation.chip.line.root.remove(); });
  const chapter: QuestChapter = { quest, chip: presentation.chip, objective: presentation.chip.line, get places() { return places; }, discover, markers };
  let installed = chapters.get(ctx.scope);
  if (installed === undefined) { installed = new Map(); chapters.set(ctx.scope, installed); }
  installed.set(story.quest.id, chapter);
  return chapter;
}

/** Client-only registration of admitted item and achievement rows in their existing level scope.
 * Simulation counters, ledger rewards and saved inventory retain their original owners. */
export function installQuestCatalogue(ctx: Pick<ShardContext, 'product'> & { readonly rows: Pick<ShardContext['rows'], 'item' | 'feat'> }): void {
  const items = ctx.product.section('combat/items').items.catalogue;
  const feats = ctx.product.section('quests/quests').quests.achievements;
  if (items !== undefined) ctx.rows.item(items);
  if (feats !== undefined) ctx.rows.feat(feats);
}
