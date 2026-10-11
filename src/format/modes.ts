import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const range = (low: number, high: number) => v.pipe(finite, v.minValue(low), v.maxValue(high));
const id = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_.-]{1,128}$/));
const point = v.strictObject({ x: range(-250, 250), y: range(-250, 250), z: range(-250, 250) });
/** Cable traversal parameters; the endpoints are floor positions, not silently raised cable anchors. */
export const ZiplineModeSchema = v.pipe(v.strictObject({
  kind: v.literal('zipline'), id, top: point, bottom: point,
  sag: v.optional(range(0, 20), 1.6),
  hang: v.optional(range(0, 10), 2.9), gravity: v.optional(range(0, 64), 9.8),
  drag: v.optional(range(0, 1), 0.012), maxSpeed: v.optional(range(2.5, 32), 16),
}), v.check(row => Math.hypot(row.top.x - row.bottom.x, row.top.z - row.bottom.z) > 0, 'zipline requires distinct horizontal ends'));
/** A directional board-only wind column with the shipping open sides and upper ceiling. */
export const UpdraftModeSchema = v.pipe(v.strictObject({
  kind: v.literal('updraft'), id, from: point, to: point,
  width: range(0.1, 100), margin: v.optional(range(0, 5), 0.5), lift: range(0, 64),
}), v.check(row => Math.hypot(row.to.x - row.from.x, row.to.z - row.from.z) > 0, 'updraft requires a horizontal run'));
/** Only implemented platform traverse laws cross admission; executable callbacks never do. */
export const TraverseModeSchema = v.variant('kind', [ZiplineModeSchema, UpdraftModeSchema]);
/** Actual mode parameters admitted from authoring objects; absence retains the ordinary player law. */
export const ModesSchema = v.pipe(v.strictObject({
  traverse: v.optional(v.pipe(v.array(TraverseModeSchema), v.maxLength(64)), []),
}), v.check(rows => new Set(rows.traverse.map(row => row.id)).size === rows.traverse.length, 'unique traverse identities'));
/** Admitted platform traversal rows. */
export type ModeRows = v.InferOutput<typeof ModesSchema>;
/** One cable law's admitted parameters. */
export type ZiplineMode = v.InferOutput<typeof ZiplineModeSchema>;
/** One wind column's admitted parameters. */
export type UpdraftMode = v.InferOutput<typeof UpdraftModeSchema>;
/** One serializable traversal declaration. */
export type TraverseMode = v.InferOutput<typeof TraverseModeSchema>;
/** Validate every row before its host allocates resources or installs callbacks. */
export function parseModes(input: unknown): ModeRows { return v.parse(ModesSchema, input); }
