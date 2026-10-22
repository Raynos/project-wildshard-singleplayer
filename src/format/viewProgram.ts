import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), finite = v.pipe(v.number(), v.finite());
const count = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
/**
 * G600 L7: a view module (SCRIPT-ABI v2, lane 3) and where its frame comes from and lands, as rows
 * (engine/script/viewProgram). `samples` are the one binding's public columns in order: the player's position or
 * horizontal speed, a registry piece's floor under the player (present 0 / 1, its height, 0 when absent) or a constant.
 * `channels` are the channel bank in order, each added to the camera every displayed frame (the last landed bank between
 * scheduled frames) or written to a lent look's parameter. `transforms` are the transform positions in order, each the
 * local matrix of an object its owner lends by id (a figure, a part, a bone). A program sampling a piece the registry
 * lacks installs nothing. Client-only; nothing reaches the sim or a save.
 */
export const ViewProgramSchema = v.strictObject({
  system: id, before: v.pipe(v.array(id), v.maxLength(16)),
  budget: v.strictObject({ pages: count(1, 4), ioBytes: count(16, 65536), fuel: count(1, 10_000_000), targetMs: v.pipe(finite, v.minValue(0.01), v.maxValue(16)) }),
  samples: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('player'), field: v.picklist(['x', 'y', 'z', 'speed']) }),
    v.strictObject({ kind: v.literal('floor'), piece: id, field: v.picklist(['present', 'height']) }),
    v.strictObject({ kind: v.literal('constant'), value: finite }),
  ])), v.minLength(1), v.maxLength(64)),
  channels: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('camera'), field: v.picklist(['x', 'y', 'z', 'pitch', 'yaw', 'roll']) }),
    v.strictObject({ kind: v.literal('look'), look: id, param: id }),
  ])), v.maxLength(64)),
  transforms: v.pipe(v.array(v.strictObject({ object: id })), v.maxLength(256),
    v.check(rows => new Set(rows.map(row => row.object)).size === rows.length, 'One transform position per object')),
  /** a written matrix's translation length, column scale range and normalized column cross-dot stay inside these */
  bounds: v.strictObject({ translation: v.pipe(finite, v.minValue(0)), scale: v.tuple([v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0))]), shear: v.pipe(finite, v.minValue(0), v.maxValue(1)) }),
});
export type ViewProgramRows = v.InferOutput<typeof ViewProgramSchema>;
