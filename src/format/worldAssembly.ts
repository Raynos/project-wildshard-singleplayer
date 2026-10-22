import * as v from 'valibot';
import { WorldEntryStepSchema } from './worldEntry';
import { RopeDeckSiteSchema, RopeDeckSpanSchema } from './ropeDeckSite';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const label = v.pipe(v.string(), v.minLength(1), v.maxLength(96));

/**
 * G571: a shard world's build as an ordered list of typed stages (game/shardfile/worldAssembly). Each stage loads one
 * admitted scene owner and publishes it as concrete entry-owner loans under its id: `place` an admitted scene placement
 * (its object, its Placed and its compiled floor), `site` a catalogue model site (its group, anchors, floor and Placed),
 * `mesh` / `group` an admitted scene part, `entry` declared world entry rows (format/worldEntry: their tier / variant
 * filter and row order) publishing the placements its applied rows loaded in row order, and when declared its `object`
 * (a scene part) and its `floor` (the compiled floor of one of its unconditional place rows).
 * `rope-deck` borrows loaded fixed draws to place a site and publish object/placed/floor/rope-deck loans;
 * `rope-chain` allocates from an earlier deck at its later stage, registers only fixed-post capture and publishes a
 * chain loan. Per-frame interpolation stays with its existing entered owner. No row selects a phase or callback.
 */
export const WorldAssemblyStageSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('place'), id, label }),
  v.strictObject({ kind: v.literal('rope-deck'), id, label, site: RopeDeckSiteSchema, span: RopeDeckSpanSchema }),
  v.strictObject({ kind: v.literal('rope-chain'), id, label, deck: id, capture: id }),
  v.strictObject({ kind: v.literal('site'), id, label, model: id, choice: id }),
  v.strictObject({ kind: v.literal('mesh'), id, label, part: id }),
  v.strictObject({ kind: v.literal('group'), id, label, part: id }),
  v.strictObject({ kind: v.literal('entry'), id, label, rows: v.pipe(v.array(WorldEntryStepSchema), v.minLength(1), v.maxLength(1024)),
    object: v.exactOptional(v.strictObject({ as: v.picklist(['group', 'mesh', 'object']), part: id })), floor: v.exactOptional(id) }),
]);
export const WorldAssemblySchema = v.strictObject({ stages: v.pipe(v.array(WorldAssemblyStageSchema), v.minLength(1), v.maxLength(64)) });
export type WorldAssemblyStage = v.InferOutput<typeof WorldAssemblyStageSchema>;
