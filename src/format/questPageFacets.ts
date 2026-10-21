import * as v from 'valibot';

/** the play music's stings (engine audio/Music StingName) */
const STINGS = ['pickup', 'death', 'chunk', 'dawn'] as const;
const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
/**
 * A quest page's ridden mover (game quest/pageFacets.ts `installPageMover`): the declared mover `id` of the shard's movers,
 * entered on its scene mesh under the binding's `target` name; `rest` is the scene object standing in for it at rest,
 * hidden while it is away; boarding plays the page kit's `board` interaction sound (an engine InteractSound) at its rest pose.
 */
const mover = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_.-]{1,128}$/u));
/** the declared mover bindings `MoverRuntime.enter` borrows (game plugin/mover.ts admits the same rows) */
const bindings = v.pipe(v.array(v.strictObject({ id: mover, target: mover, chain: v.exactOptional(v.boolean()), group: v.exactOptional(v.literal('group')),
  visibility: v.exactOptional(v.literal('enabled')), order: v.exactOptional(v.literal('XYZ')), afterPose: v.exactOptional(v.literal('refreshPose')) })), v.maxLength(32));
export const QuestPageMoverSchema = v.strictObject({
  id, target: mover, mesh: id, rest: id,
  binding: v.strictObject({ systemId: id, bindings }),
  board: v.strictObject({ sound: id, gain: v.pipe(n, v.minValue(0), v.maxValue(4)) }),
});
/**
 * A quest page's collections (`pageCollectionCalls`): each kit `event` shows the count chip (`label`, the flags set under
 * `prefix` of `names`), each `completeEvent` runs that interaction-page action; `pickup` plays a music sting on its event.
 */
export const QuestPageCollectionsSchema = v.strictObject({
  /** the count chip's data panel */
  panel: id,
  rows: v.pipe(v.array(v.strictObject({ event: id, completeEvent: id, prefix: id, names: v.pipe(v.array(id), v.minLength(1), v.maxLength(64)), label: id })), v.maxLength(16)),
  pickup: v.exactOptional(v.strictObject({ event: id, sting: v.picklist(STINGS) })),
});
/** A quest page's full map (`installPageMap`): the published pins' policy, the zone names under them and the ground features. */
export const QuestPageMapSchema = v.strictObject({
  publish: v.strictObject({ declutter: v.exactOptional(v.boolean()), tally: v.exactOptional(v.boolean()),
    unknownLabel: v.exactOptional(v.pipe(v.string(), v.maxLength(256))), markerLabels: v.exactOptional(v.picklist(['full', 'short'])) }),
  zones: v.pipe(v.array(v.strictObject({ label: id, x: n, z: n, size: v.exactOptional(n), rot: v.exactOptional(n) })), v.maxLength(64)),
  /** the entered forest's trees and this forest page's roofs on the map's ground layer */
  features: v.exactOptional(v.strictObject({ forest: id })),
});
export type QuestPageMoverRows = v.InferOutput<typeof QuestPageMoverSchema>;
export type QuestPageCollectionsRows = v.InferOutput<typeof QuestPageCollectionsSchema>;
export type QuestPageMapRows = v.InferOutput<typeof QuestPageMapSchema>;
