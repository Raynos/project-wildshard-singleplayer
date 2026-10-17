import { bindBorrowedMethod } from '../plugin/borrowed';
import { questBenchPose } from './storyLaw';
import * as v from 'valibot';
import type { Vector3 } from 'three';
import { parseQuestStory, type QuestStory } from '@wildshard/format/questStory';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { Scope } from '@wildshard/engine/app/scope';
import { DialogueBox } from '@wildshard/engine/quest/view/ui';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { QuestState } from '@wildshard/engine/quest/core';
import type { Progress } from '../Progress';
import { progressSave } from '../saves';
import { createAchievementCounters } from '../achievements';
import { bindRuntimeLedger, bindRuntimeJsonRecord, type RuntimeFacts } from '../plugin/headless';
import type { ShardContext } from '../plugin/context';
import { type QuestViews, installDeclaredNpcTalks, type QuestNpcTalkPorts, type QuestTalkFigure, type NpcTalkInstallation, presentQuest, type QuestPresentation, type QuestPresentationHost, type QuestPresentationOptions } from '../plugin/ui';

const countsSchema = v.record(v.string(), v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0)));
type StoryContext = Pick<ShardContext, 'app' | 'scope' | 'product'>;
type JournalProgress = Partial<Pick<Progress, 'bindLedger' | 'refreshLedger'>> & { readonly rows?: readonly { readonly def: { readonly id: string }; readonly count: number }[] };
/** Read immutable story rows before borrowing any quest or saved owner. */
export async function readQuestStory(ctx: Pick<ShardContext, 'product'>): Promise<QuestStory> {
  return parseQuestStory(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/story.json'))));
}
/** The existing journal and ledger keep their saves; rows select the original migration and refresh boundaries. */
export async function bindStoryAchievements(ctx: StoryContext, story: QuestStory, progress: JournalProgress | undefined,
  instance = ctx.product.shardfile.identity.slug, supplied?: RuntimeFacts): Promise<{ facts: RuntimeFacts; count: (id: string, total: number) => void; kill: (kind: string, variant?: string) => void; event: (name: string, total?: number) => void; syncFlags: (flags: Parameters<ReturnType<typeof createAchievementCounters>['syncFlags']>[0]) => void }> {
  const rows = parseAchievementCounterData(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/achievements.json'))));
  if (ctx.scope.disposed) throw new Error('Quest achievement owner left during admission');
  const source = ctx.product.shardfile, policy = story.journal, emit = supplied ?? bindRuntimeLedger(ctx, source, instance);
  const facts: RuntimeFacts = Object.assign((name: string, entity: string) => {
    const receipt = emit(name, entity); if (policy.refresh === 'emit') progress?.refreshLedger?.(); return receipt;
  }, { flush: emit.flush, achievement: emit.achievement });
  let counts: Record<string, number> = Object.fromEntries(rows.feats.map(feat => [feat.id, emit.achievement(feat.id)?.count ?? 0]));
  const saved = policy.state === undefined ? null : bindRuntimeJsonRecord(ctx, source, policy.state, countsSchema, () => progressSave.read(instance).counts, instance);
  const counters = createAchievementCounters(rows, {
    read: () => saved === null ? { ...counts } : saved.read(),
    write: current => { if (saved === null) counts = current; else saved.write(current); }, emit: (name, entity) => { facts(name, entity); },
  });
  if (policy.replay) counters.replay();
  if (policy.migrateProgress) for (const row of progress?.rows ?? []) if (rows.feats.some(feat => feat.id === row.def.id)) counters.count(row.def.id, row.count);
  const achievement = (id: string) => emit.achievement(policy.achievementPrefix + id);
  progress?.bindLedger?.({ count: id => achievement(id)?.count ?? 0, earned: id => achievement(id)?.earned ?? false,
    checkpoint: () => { if (saved === null) return emit.flush(); const written = saved.write(saved.read()), grants = emit.flush(); return written && grants; } });
  const refresh = (): void => { if (policy.refresh === 'outcome') progress?.refreshLedger?.(); };
  const event = (name: string, total?: number): void => { counters.event(name, total); refresh(); };
  return { facts, count: counters.count, kill: (kind: string, variant?: string): void => { counters.kill(kind, variant); refresh(); }, event,
    syncFlags: (flags: Parameters<typeof counters.syncFlags>[0]): void => { counters.syncFlags(flags, policy.syncEvents ? event : undefined); } };
}
/** Subscribe at the original installation phase, retaining ordered synchronous flag consequences. */
export function observeStoryFlags(story: QuestStory, scope: Pick<Scope, 'onDispose'> | undefined, flags: Flags,
  owners: ReadonlyMap<string, unknown>): void {
  const sync = bindBorrowedMethod(owners, story.bindings.sync), toast = bindBorrowedMethod(owners, story.bindings.toast);
  sync(flags);
  const off = flags.onChange((flag, on) => {
    if (!on || story.ignoredFlagPrefixes.some(prefix => flag.startsWith(prefix))) return;
    sync(flags);
    for (const row of story.notices) if (flag.startsWith(row.prefix) && flags.count(row.prefix) === row.total) toast(row.text);
  });
  scope?.onDispose(off);
}
/** Bind the existing kit seat and player, without adding a prompt, flag or saved state. */
export function bindStoryBench(story: QuestStory, kit: { onSit?: (at: Vector3, yaw: number) => void },
  player: { position: Vector3; velocity: Vector3; yaw: number; pitch: number }, owners: ReadonlyMap<string, unknown>): void {
  const toast = bindBorrowedMethod(owners, story.bindings.toast);
  const floor = story.bindings.floor === undefined ? undefined : bindBorrowedMethod(owners, story.bindings.floor);
  const floorAt = floor === undefined ? undefined : (x: number, z: number): number => { const y = floor(x, z); if (typeof y !== 'number' || !Number.isFinite(y)) throw new Error('Quest seat floor must be finite'); return y; };
  kit.onSit = (at, yaw) => {
    const pose = questBenchPose(story.bench, at, yaw, floorAt);
    player.position.set(pose.x, pose.y, pose.z); player.velocity.set(0, 0, 0); player.yaw = pose.yaw; player.pitch = pose.pitch;
    toast(story.bench.text);
  };
}
/** Data-backed presentation over the original quest; the caller retains its existing update phase. */
export function presentQuestStory(story: QuestStory, host: QuestPresentationHost, quest: QuestState, options: QuestPresentationOptions = {}): QuestPresentation {
  return presentQuest(host, quest, { ...story.presentation, ...options });
}

/** Borrow the existing figure factories; dialogue and talks advance only when their original caller steps them. */
export function installStoryTalks<F extends QuestTalkFigure>(views: QuestViews, source: Pick<Shardfile, 'questNpcs'>,
  ports: Omit<QuestNpcTalkPorts<F>, 'dialogue'>): { dialogue: () => DialogueBox; people: (NpcTalkInstallation<F> & { readonly kind: string })[]; update: (dt: number, t: number, player: Vector3) => void } {
  const dialogue = views.view('dialogue', scope => new DialogueBox(scope));
  const people = installDeclaredNpcTalks(source, { ...ports, dialogue });
  return { dialogue, people, update: (dt: number, t: number, player: Vector3): void => {
    dialogue().update(dt); for (const person of people) person.update(dt, t, player);
  } };
}
