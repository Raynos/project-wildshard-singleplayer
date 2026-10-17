import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0));
const at = v.strictObject({ poi: v.picklist(['world', 'hut', 'lookout', 'wreck', 'shrine', 'cave', 'pier']), x: finite, z: finite, anchor: v.exactOptional(text) });
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
const borrowed = v.strictObject({ owner: text, path: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)) });
const Story = v.strictObject({
  bindings: v.strictObject({ sync: borrowed, toast: borrowed, floor: v.exactOptional(borrowed) }),
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
export type QuestStory = v.InferOutput<typeof Story>;
/** Strict story admission adds no cursor, save or callback policy. */
export function parseQuestStory(input: unknown): QuestStory { return v.parse(Story, input); }
