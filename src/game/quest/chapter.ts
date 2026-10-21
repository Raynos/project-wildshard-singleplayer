import * as v from 'valibot';
import { InteractSfx } from '@wildshard/engine/audio/interactSfx';
import { BatchedMesh, type Object3D, type Vector3 } from 'three';
import { withOwner } from '@wildshard/engine/app/ownership';
import type { Interactables } from '@wildshard/engine/world/interact/Interactables';
import { bindInteractPlacements, createQuestPlacements, type InteractTable } from '@wildshard/engine/world/interact/types';
import { validateTable } from '@wildshard/engine/world/interact/validate';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { isJsonData } from '@wildshard/format/json';
import { app } from '@wildshard/engine/app/runtime';
import { ownSceneTree, sceneObjectOwner } from '@wildshard/engine/app/sceneOwnership';
import type { Scope } from '@wildshard/engine/app/scope';
import type { QuestLine, QuestState } from '@wildshard/engine/quest/core';
import { placesWithDiscovery, type Places, type LiveMarker } from '@wildshard/engine/quest/view';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { FullMap } from '@wildshard/engine/ui/Map';
import type { DialogueBox, ObjectiveLine } from '@wildshard/engine/quest/view/ui';
import { parseQuestStory, parseChapterStoryPresentation } from '@wildshard/format/questStory';
import { FigureRows } from '../systems/npc/figureRows';
import { NpcDialogueRowSchema } from '../plugin/quests';
import { ReturnProgram } from '../population/returnProgram';
import { boundChapter, hasBoundChapter, publishBoundChapter, readQuestObservation, enteredAdventurePersistence } from './chapterBindings';
import { commitQuestEffects, readQuestServiceActions } from './effects';
import { QuestEffectSchema } from '@wildshard/format/questSteps';
import type { ShardContext } from '../plugin/context';
import { completionProjection, type CompletionProgress } from '../complete/declared';
import type { QuestPresentationHost, QuestPresentationOptions } from '../plugin/ui';
import { boundQuestServices, findBoundQuestState, installBoundQuestFlags } from './boundState';
import { bindRuntimeQuest } from '../plugin/headless';
import { bindStoryAchievements, bindStoryChapters, presentChapterStory, presentQuestStory } from './story';
import { questPageWorld } from './pageResources';
import { questBenchPose } from './storyLaw';

const finite = v.pipe(v.number(), v.finite());
const point = v.strictObject({ x: finite, y: finite, z: finite });
const discoverySchema = v.pipe(v.array(v.strictObject({ id: v.string(), label: v.string(), x: finite, z: finite,
  r: v.pipe(finite, v.minValue(0)), quiet: v.exactOptional(v.boolean()) })), v.maxLength(64));
const schema = v.strictObject({
  placements: v.exactOptional(v.record(v.string(), point)),
  completion: v.exactOptional(v.boolean()),
  remainingLabel: v.exactOptional(v.string()),
  program: v.exactOptional(v.unknown()),
  content: v.exactOptional(v.object({ npcs: v.record(v.string(), NpcDialogueRowSchema), places: discoverySchema })),
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
  readonly line: QuestLine | null;
  readonly project: (signal: string, input: Readonly<Record<string, number>>) => Readonly<Record<string, number>>;
  readonly reading: (input: unknown) => void;
  readonly dialogueBox: () => DialogueBox;
  readonly talk: (id: string) => void;
  readonly update: (dt: number, player: Vector3) => void;
  readonly installFeats: () => void;
  readonly objective: ObjectiveLine;
  readonly places: Places | null;
  readonly discover: (rows: unknown) => Places;
  readonly chip: ReturnType<typeof presentQuestStory>['chip'];
  readonly markers: () => LiveMarker[];
}
/** Framework lookup of the installed chapter, sharing its original objective owner. */
export function boundQuestChapter(scope: Scope, id: string): QuestChapter {
  return boundChapter(scope, id);
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

const entryId = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const entryPlacement = v.strictObject({ world: v.exactOptional(entryId),
  frames: v.exactOptional(v.pipe(v.record(entryId, v.strictObject({ x: finite, z: finite, rot: finite })), v.maxEntries(4096))),
  platforms: v.exactOptional(v.boolean()), registryReach: v.exactOptional(v.pipe(finite, v.minValue(Number.MIN_VALUE))) });
const entrySystem = v.strictObject({ id: entryId, before: v.pipe(v.array(entryId), v.maxLength(64)),
  after: v.optional(v.pipe(v.array(entryId), v.maxLength(64)), []) });
/** Prepared services retain the entered story's original state owners. */
export interface QuestEntry extends ReturnType<typeof createQuestPlacements> {
  readonly story: ReturnType<typeof parseQuestStory>; readonly flags: Flags;
  readonly services: Awaited<ReturnType<typeof readQuestServiceActions>>;
  interact: (interactions: Parameters<typeof installQuestInteractables>[2], system: unknown) => Promise<Awaited<ReturnType<typeof installQuestInteractables>>>;
  chapter: (input?: unknown) => QuestChapter;
  achievements: () => ReturnType<typeof bindStoryAchievements>;
  observe: () => void;
  bench: () => void;
}
/** Client-only quest entry shared by declared stories. Prepare saved flags,
 * service actions and placement first; install interactables after the caller
 * binds progression. Both stages take data and preserve the original owners. */
export async function prepareQuestEntry(ctx: ShardContext, storyInput: unknown, input: unknown): Promise<QuestEntry> {
  if (!isJsonData(input)) throw new Error('Quest entry requires plain JSON rows');
  const rows = v.parse(v.strictObject({ services: entryId, placement: entryPlacement }), input), story = parseQuestStory(storyInput);
  const world = ctx.game.runtime?.world;
  if (world === undefined || world === null || ctx.scope.disposed) throw new Error('Quest entry requires its entered world');
  const policy = rows.placement;
  const placement = createQuestPlacements({ terrain: terrainHeight, registry: world.registry,
    ...(policy.world === undefined ? {} : { pois: questPageWorld(ctx.scope, policy.world).pois }),
    ...(policy.frames === undefined ? {} : { frames: policy.frames }),
    ...(policy.platforms === true ? { platforms: world.player.platforms } : {}),
    ...(policy.registryReach === undefined ? {} : { registryReach: policy.registryReach }) });
  const flags = installQuestFlags(ctx, story.quest.id, ctx.manifest.slug);
  const services = await readQuestServiceActions(ctx, story.quest.id, rows.services);
  let achievements: Awaited<ReturnType<typeof bindStoryAchievements>> | null = null;
  let achievementRequest: ReturnType<typeof bindStoryAchievements> | null = null;
  let interaction: Awaited<ReturnType<typeof installQuestInteractables>> | null = null;
  let installed = false;
  return { story, flags, services, ...placement,
    bench: (): void => {
      const kit = interaction, play = ctx.game.runtime?.play;
      if (kit === null || play === undefined || play === null || ctx.scope.disposed) throw new Error('Quest seat requires its entered interaction table');
      kit.onSit = (at, yaw) => {
        const pose = questBenchPose(story.bench, at, yaw, placement.floorAt), player = world.player;
        player.position.set(pose.x, pose.y, pose.z); player.velocity.set(0, 0, 0); player.yaw = pose.yaw; player.pitch = pose.pitch;
        play.hud.toast(story.bench.text);
      };
    },
    achievements: (): ReturnType<typeof bindStoryAchievements> => {
      achievementRequest ??= bindStoryAchievements(ctx, story, ctx.game.runtime?.play?.progress, ctx.manifest.slug)
        .then(service => { achievements = service; return service; });
      return achievementRequest;
    },
    observe: (): void => {
      const counters = achievements, play = ctx.game.runtime?.play;
      if (counters === null || play === undefined || play === null || ctx.scope.disposed) throw new Error('Quest flag observation requires its entered achievements');
      counters.syncFlags(flags);
      ctx.scope.onDispose(flags.onChange((flag, on) => {
        if (!on || story.ignoredFlagPrefixes.some(prefix => flag.startsWith(prefix))) return;
        counters.syncFlags(flags);
        for (const row of story.notices) if (flag.startsWith(row.prefix) && flags.count(row.prefix) === row.total) play.hud.toast(row.text);
      }));
    },
    chapter: (chapterInput: unknown = {}): QuestChapter => {
      if (ctx.scope.disposed) throw new Error('Quest entry left before chapter installation');
      return buildQuestChapter(ctx, story, chapterInput, placement.anchors, ctx);
    },
    interact: async (interactions: Parameters<typeof installQuestInteractables>[2], system: unknown): Promise<Awaited<ReturnType<typeof installQuestInteractables>>> => {
      const order = v.parse(entrySystem, system);
      if (installed || ctx.scope.disposed) throw new Error('Quest entry interactables already installed or disposed');
      installed = true;
      const kit = await installQuestInteractables(ctx, story.quest.id, interactions);
      interaction = kit;
      ctx.system({ id: order.id, phase: 'update', before: order.before, after: order.after, run: (dt, time) => { kit.update(dt, time); } });
      return kit;
    } };
}

/** Client-only chapter presentation. Intake is story/placement rows and an existing quest id;
 * play, map, music, flags and completion progress resolve from the entered context.
 * Anchors are the placement owner's coordinate table, never callbacks or reflected services.
 * The caller retains the original UI update phase; this installs no clock or save owner.
 */
export function installQuestChapter(ctx: QuestChapterContext, storyInput: unknown,
  input: unknown = {}, anchors?: ReadonlyMap<string, { readonly x: number; readonly z: number }>): QuestChapter {
  return buildQuestChapter(ctx, storyInput, input, anchors);
}

/** Entered chapter stories resolve saved services and named figure resources;
 * story/content rows are the entire author API. Existing callers retain their
 * update, polling and feat installation phases. */
export function installChapterStory(ctx: ShardContext, storyInput: unknown,
  input: unknown = {}, anchors?: ReadonlyMap<string, { readonly x: number; readonly z: number }>): QuestChapter {
  return buildQuestChapter(ctx, storyInput, input, anchors, ctx);
}

function buildQuestChapter(ctx: QuestChapterContext, storyInput: unknown, input: unknown,
  anchors?: ReadonlyMap<string, { readonly x: number; readonly z: number }>, entered?: ShardContext): QuestChapter {
  if (!isJsonData(input)) throw new Error('Chapter intake requires plain JSON data');
  const rows = v.parse(schema, input);
  const completeStory = typeof storyInput === 'object' && storyInput !== null && 'quest' in storyInput ? parseQuestStory(storyInput) : null;
  const chapterRows = completeStory?.chapters ?? (completeStory === null ? parseChapterStoryPresentation(storyInput) : undefined);
  const id = completeStory?.quest.id ?? chapterRows?.chapters[0];
  if (id === undefined) throw new Error('Chapter requires a declared quest');
  const story = completeStory ?? { quest: { id, markers: {} }, chapters: chapterRows };
  const persistence = completeStory === null ? enteredAdventurePersistence(ctx.scope) : null;
  const existing = findBoundQuestState(ctx.scope, story.quest.id);
  if (hasBoundChapter(ctx.scope, story.quest.id)) throw new Error('Chapter presentation is already installed');
  const services = persistence === null ? existing === undefined ? boundQuestServices(ctx.scope, story.quest.id) : { flags: existing.flags } : { flags: persistence.flags, facts: persistence.facts };
  const ports: Parameters<typeof bindRuntimeQuest>[3] = { ...services, ...(completeStory === null ? {} : { place: (marker: { id: string }) => completeStory.quest.markers[marker.id] }) };
  const line = story.chapters === undefined ? null
    : bindStoryChapters(ctx, ctx.product.shardfile, story.chapters.chapters, ports, completeStory === null ? 'before-facts' : 'after-facts');
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
  const fullMap = completeStory === null && entered?.game.runtime?.play !== undefined && entered.game.runtime.play !== null
    ? entered.game.runtime.play.fullMap : { setQuest: play.fullMap.setQuest.bind(play.fullMap) };
  const options: Pick<QuestPresentationOptions, 'markers' | 'chip' | 'place'> = { markers: () => left() ?? markers(), chip: () => { const remaining = left(); return remaining === null ? quest.chip()
      : { label: remaining.length > 0 ? rows.remainingLabel ?? '' : '', count: '' }; },
    ...(rows.placements === undefined ? {} : { place: at => {
      const resolved = rows.placements?.[JSON.stringify(at)];
      if (resolved === undefined) throw new Error('Quest chapter lacks an admitted marker placement');
      return resolved;
    } }),
  };
  const presentation = line === null || story.chapters === undefined
    ? presentQuestStory(parseQuestStory(story), { scope: ctx.scope, player: world.player, fullMap, toast, sting }, quest, options)
    : presentChapterStory(line, story.chapters, { ...(completeStory === null && entered !== undefined ? { ctx: entered } : {}), scope: ctx.scope, flags: quest.flags,
      figures: Object.fromEntries(story.chapters.talks.map(row => {
        const figure = FigureRows.entered(ctx.scope, row.figure ?? row.id);
        return [row.id, { headWorld: figure.talkPoint, get talking() { return figure.talking; }, set talking(value: boolean) { figure.talking = value; } }];
      })), npcs: rows.content?.npcs ?? {}, places: rows.content?.places ?? [], prompts: entered?.game.runtime?.interactables ?? [],
      open: () => { entered?.game.runtime?.play?.audio.weaponSwap(); },
      ...(persistence === null ? {} : { feat: persistence.feat }), fullMap, toast, sting, ...(completeStory === null ? {} : options) });
  let places: Places | null = completeStory === null && 'places' in presentation ? presentation.places : null;
  const discover = (catalogue: unknown): Places => {
    if (places !== null) throw new Error('Quest discovery is already installed');
    places = placesWithDiscovery(v.parse(discoverySchema, catalogue), quest.flags, text => { play.hud.toast(text); }, markers);
    return places;
  };
  ctx.scope.onDispose(() => { presentation.chip.line.root.remove(); });
  const decision = chapterRows?.decision;
  const program = rows.program ?? decision?.program;
  const brain = program === undefined ? null : ReturnProgram.page(program, ctx.scope);
  const project = (signal: string, values: Readonly<Record<string, number>>): Readonly<Record<string, number>> => {
    if (brain === null) throw new Error('Chapter has no admitted decision program');
    const observed = { ...values };
    for (const [observationId, row] of Object.entries(decision?.observations ?? {})) {
      if (row.on === undefined || row.on === signal) observed[observationId] = readQuestObservation(ctx, quest.def.id, row.source);
    }
    const result = brain.project(signal, observed);
    for (const [channel, value] of Object.entries(result)) if (value !== 0) {
      const effects = decision?.actions[channel];
      if (effects !== undefined) {
        if (entered === undefined) throw new Error('Chapter effects require their entered services');
        commitQuestEffects(entered, quest.def.id, effects);
      }
    }
    return result;
  };
  const chapter: QuestChapter = { quest, line, project, reading: readingInput => {
    const row = v.parse(QuestEffectSchema, readingInput);
    if (row.kind !== 'reading' || !('dialogue' in presentation)) throw new Error('Chapter reading requires its dialogue');
    const dialogue = presentation.dialogue();
    if (!dialogue.isOpen) dialogue.open(row.title, row.lines, () => undefined);
  }, dialogueBox: () => {
    if (!('dialogue' in presentation)) throw new Error('Chapter has no dialogue');
    return presentation.dialogue();
  }, talk: personId => { if ('talk' in presentation) presentation.talk(personId); },
    update: (dt, player) => { if ('dialogue' in presentation) presentation.update(dt, player); },
    installFeats: () => { if ('installFeats' in presentation) presentation.installFeats(); }, chip: presentation.chip, objective: presentation.chip.line, get places() { return places; }, discover, markers: completeStory === null && 'markers' in presentation ? presentation.markers : markers };
  publishBoundChapter(ctx.scope, story.quest.id, chapter);
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

/** Client-only interactable presentation over entered services and saved quest flags.
 * Intake contains only bounded table/placement rows and floor policy. The caller
 * retains its update phase and event wiring; this owns no clock or save wire.
 */
export async function installQuestInteractables(ctx: ShardContext, id: string,
  input: { readonly table: InteractTable; readonly placements?: unknown; readonly platforms?: boolean; readonly registryReach?: number }): Promise<Interactables & { readonly sfx: InteractSfx }> {
  if (!isJsonData(input)) throw new Error('Quest interactables require plain JSON data');
  v.parse(v.strictObject({ table: v.unknown(), placements: v.exactOptional(v.unknown()),
    platforms: v.exactOptional(v.boolean()), registryReach: v.exactOptional(v.pipe(finite, v.minValue(Number.MIN_VALUE))) }), input);
  const table = input.placements === undefined ? input.table : bindInteractPlacements(input.table, input.placements);
  const errors = validateTable(table);
  if (errors.length > 0) throw new Error(`Invalid quest interactables: ${errors.join('; ')}`);
  if (table.rows.some(row => row.at.poi !== 'world')) throw new Error('Quest interactables require world placements');
  const runtime = ctx.game.runtime, world = runtime?.world;
  if (runtime === undefined || world === undefined || world === null) throw new Error('Quest interactables require entered world services');
  const flags = installQuestFlags(ctx, id, ctx.manifest.slug);
  const { floorAt, place } = createQuestPlacements({ terrain: terrainHeight, registry: world.registry,
    ...(input.platforms === true ? { platforms: world.player.platforms } : {}),
    ...(input.registryReach === undefined ? {} : { registryReach: input.registryReach }) });
  const { Interactables } = await import('@wildshard/engine/world/interact/Interactables');
  if (ctx.scope.disposed) throw new Error('Quest left while admitting interactables');
  const before = new Set(world.game.scene.children);
  const kit = withOwner(ctx.scope, () => new Interactables({ scene: world.game.scene, sky: world.sky,
    player: world.player, flags, place, floorAt, prompts: runtime.interactables }).build(table));
  for (const node of world.game.scene.children) if (!before.has(node) && node instanceof BatchedMesh) ownQuestTree(node, ctx.scope);
  ctx.scope.onDispose(() => { kit.dispose({ batches: false }); });
  const audio = runtime.play?.audio; if (audio === undefined) throw new Error('Quest interactions require entered audio');
  return Object.assign(kit, { sfx: new InteractSfx(audio) });
}
