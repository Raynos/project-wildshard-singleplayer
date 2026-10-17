import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0));
const count = v.pipe(positive, v.safeInteger());
const at = v.strictObject({ poi: v.picklist(['world', 'hut', 'lookout', 'wreck', 'shrine', 'cave', 'pier']), x: finite, z: finite, anchor: v.exactOptional(text) });
const content = v.strictObject({
  places: v.pipe(v.array(v.strictObject({ id: text, label: text, completeLabel: text, at, r: positive })), v.maxLength(64)),
  guide: v.strictObject({ wander: positive, idle: positive, idleSpeed: positive, cooldown: positive, retry: positive }),
  glassCount: count, shardFlags: v.pipe(v.array(text), v.maxLength(32)),
});
/** Immutable per-product card, discovery and guide rows. Live flags and clocks stay with the existing owners. */
export type AdventureContent = v.InferOutput<typeof content>;
/** Refuse malformed product data before any quest, marker or completion-card installation. */
export function parseAdventureContent(input: unknown): AdventureContent { return v.parse(content, input); }
