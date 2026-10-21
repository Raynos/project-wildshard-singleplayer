import * as v from 'valibot';
import { ObservationRefSchema } from './sceneRefs';
import { QuestEffectSchema } from './questSteps';
import { isJsonData } from './json';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0));
// Live markers and discovery name authored frames; readers admit their owners.
const at = v.strictObject({ poi: text, x: finite, z: finite, anchor: v.exactOptional(text) });
/** Original discovery catalogue; anchors resolve against the live placed world. */
export const AdventureContentSchema = v.strictObject({
  places: v.pipe(v.array(v.strictObject({ id: text, label: text, completeLabel: text, at, r: positive })), v.maxLength(64)),
  guide: v.strictObject({ wander: positive, idle: positive, idleSpeed: positive, cooldown: positive, retry: positive }),
  glassCount: v.pipe(positive, v.safeInteger()), shardFlags: v.pipe(v.array(text), v.maxLength(32)),
});
/** Immutable discovery rows; flags and clocks retain their existing owners. */
export type AdventureContent = v.InferOutput<typeof AdventureContentSchema>;
/** Refuse malformed catalogue data before installing world discovery. */
export function parseAdventureContent(input: unknown): AdventureContent { return v.parse(AdventureContentSchema, input); }

const markerAt = v.strictObject({ ...at.entries, y: v.exactOptional(finite), dy: v.exactOptional(finite), yaw: v.exactOptional(finite) });
const chapterText = v.pipe(v.string(), v.maxLength(512));
const ChapterPresentation = v.pipe(v.strictObject({
  chapters: v.pipe(v.array(v.pipe(chapterText, v.minLength(1))), v.maxLength(64)),
  talks: v.pipe(v.array(v.strictObject({ id: chapterText, figure: v.exactOptional(chapterText), label: chapterText,
    radius: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100)) })), v.maxLength(64)),
  rewards: v.record(chapterText, v.strictObject({ event: chapterText, title: chapterText })),
  flagEvents: v.pipe(v.array(v.strictObject({ flag: chapterText, event: chapterText })), v.maxLength(64)),
  introTitle: chapterText, chapterTitle: chapterText, completedObjective: chapterText, completedHint: chapterText,
  rewardKicker: chapterText, rewardSubtitle: chapterText, started: chapterText, objective: chapterText,
  messages: v.exactOptional(v.strictObject({ firstStep: v.exactOptional(chapterText), started: chapterText, objective: chapterText, completed: chapterText })),
  decision: v.exactOptional(v.strictObject({ program: v.exactOptional(v.pipe(v.unknown(), v.check(isJsonData))),
    observations: v.pipe(v.record(chapterText, v.strictObject({ source: ObservationRefSchema,
      on: v.exactOptional(chapterText) })), v.maxEntries(64)),
    actions: v.pipe(v.record(chapterText, v.pipe(v.array(QuestEffectSchema), v.maxLength(32))), v.maxEntries(64)),
  })),
  rewardMs: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(60000)),
}), v.check(rows => rows.chapters.length > 0 && new Set(rows.chapters).size === rows.chapters.length
  && new Set(rows.talks.map(row => row.id)).size === rows.talks.length
  && Object.keys(rows.rewards).every(id => rows.chapters.includes(id)), 'unique bound chapter and speaker ids'));
/** Immutable chapter UI policy; authored templates accept {chapter}, {title}, {objective} and {reward}. */
export type ChapterStoryPresentation = v.InferOutput<typeof ChapterPresentation>;
/** Admit the presentation separately from the quest graph; it never supplies progression state. */
export function parseChapterStoryPresentation(input: unknown): ChapterStoryPresentation { return v.parse(ChapterPresentation, input); }

export const QuestStorySchema = v.strictObject({
  chapters: v.exactOptional(ChapterPresentation),
  quest: v.strictObject({ id: text, markers: v.record(text, markerAt) }),
  presentation: v.strictObject({ introTitle: text, worldPins: v.boolean(), mapMarkers: v.boolean(), minimapMarks: v.boolean(),
    messages: v.strictObject({ firstStep: text, started: text, objective: text, completed: text }) }),
  journal: v.strictObject({ state: v.exactOptional(text), achievementPrefix: v.pipe(v.string(), v.maxLength(96)),
    migrateProgress: v.boolean(), replay: v.boolean(), refresh: v.picklist(['emit', 'outcome']), syncEvents: v.boolean() }),
  ignoredFlagPrefixes: v.pipe(v.array(text), v.maxLength(16)),
  notices: v.pipe(v.array(v.strictObject({ prefix: text, total: v.pipe(positive, v.safeInteger()), text })), v.maxLength(32)),
  bench: v.strictObject({ forward: finite, height: finite, yaw: finite, pitch: finite, terrain: v.boolean(), text }),
});
/** Authored page presentation, migration and seat rows shared by quest hosts. */
export type QuestStory = v.InferOutput<typeof QuestStorySchema>;
/** Strict story admission adds no cursor, save or callback policy. */
export function parseQuestStory(input: unknown): QuestStory { return v.parse(QuestStorySchema, input); }


const bossRecord = v.variant('kind', [
  v.strictObject({ kind: v.literal('state'), key: text, actor: text, jsonError: text, writeError: text }),
  v.strictObject({ kind: v.literal('flags'), names: v.strictObject({ defeated: text, paid: text }), actor: text }),
]);
const pageStage = v.strictObject({ system: text, data: v.unknown(), initial: v.array(v.record(text, v.boolean())) });
export const PersistedQuestPageSchema = v.strictObject({
  id: text, rewardId: text, npc: text,
  strings: v.looseObject({ reward: v.string(), newQuest: v.string(), quest: v.string(), rewardKicker: v.string(), rewardSubtitle: v.string() }),
  persistence: v.strictObject({ reward: v.strictObject({ kind: v.picklist(['state', 'flag']), key: text, legacy: text }),
    boss: v.exactOptional(v.strictObject({ record: bossRecord, defeated: v.strictObject({ fact: text, entity: text }) })) }),
  model: v.exactOptional(v.strictObject({ id: text, kind: v.picklist(['mesh', 'pivots']), material: v.exactOptional(text) })),
  places: v.pipe(v.array(v.strictObject({ id: text, label: text, x: finite, z: finite, r: positive,
    quiet: v.exactOptional(v.boolean()), y: v.exactOptional(finite) })), v.maxLength(64)),
  markers: v.exactOptional(v.record(text, markerAt)),
  presentationFlags: v.exactOptional(v.boolean()), projectProgress: v.exactOptional(v.boolean()), unpaid: v.exactOptional(v.picklist(['live', 'initial'])),
  beat: v.exactOptional(v.strictObject({ at: v.strictObject({ x: finite, y: finite, z: finite }),
    toward: v.looseObject({ x: finite, z: finite }), pitch: finite, holdSeconds: positive })),
  finishFlags: v.exactOptional(v.pipe(v.array(text), v.maxLength(256))), stages: v.exactOptional(v.pipe(v.array(pageStage), v.maxLength(64))),
  repair: v.exactOptional(v.strictObject({ data: v.unknown(), initial: v.array(v.record(text, v.boolean())),
    legacyObservation: text, advances: v.pipe(positive, v.safeInteger(), v.maxValue(64)) })),
  capture: v.exactOptional(v.record(text, v.pipe(v.array(v.union([v.strictObject({ flag: text }), v.strictObject({ call: text })])), v.maxLength(64)))),
});
/** Page policy borrows existing flag, reward and presentation owners; it adds no saved cursor. */
export type PersistedQuestPage = v.InferOutput<typeof PersistedQuestPageSchema>;
/** Validate compiled page JSON before the existing shared quest owner installs it. */
export function parsePersistedQuestPage(input: unknown): PersistedQuestPage { return v.parse(PersistedQuestPageSchema, input); }
