import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), finite = v.pipe(v.number(), v.finite());
const count = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
/**
 * G600 L7: a view module (SCRIPT-ABI v2, lane 3) and where its frame comes from and lands, as rows
 * (engine/script/viewProgram). `samples` are the one binding's public columns in order: the player's position or
 * horizontal speed, a registry piece's floor under the player (present 0 / 1, its height, 0 when absent) or a constant.
 * `channels` are the channel bank in order: added to the camera every displayed frame (the last landed bank between
 * scheduled frames), or written on landing to a lent look's parameter, a lent object's visibility (value > 0.5), its
 * materials' opacity or a named uniform, or one component of one copy's instanced attribute (a per-instance look value).
 * `transforms` are the transform positions in order: a lent object's local matrix, a named bone under it, or one copy
 * of a lent instanced draw. Objects are lent by id by the program's owner. A program sampling a piece the registry
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
    v.strictObject({ kind: v.literal('visible'), object: id }),
    v.strictObject({ kind: v.literal('opacity'), object: id }),
    v.strictObject({ kind: v.literal('uniform'), object: id, uniform: id }),
    v.strictObject({ kind: v.literal('attribute'), object: id, attribute: id, index: count(0, 65535), component: count(0, 3) }),
  ])), v.maxLength(256)),
  transforms: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('object'), object: id }),
    v.strictObject({ kind: v.literal('bone'), object: id, bone: id }),
    v.strictObject({ kind: v.literal('instance'), object: id, index: count(0, 65535) }),
  ])), v.maxLength(256), v.check(rows => new Set(rows.map(row => JSON.stringify(row))).size === rows.length, 'One transform position per target')),
  /** a written matrix's translation length, column scale range and normalized column cross-dot stay inside these */
  bounds: v.strictObject({ translation: v.pipe(finite, v.minValue(0)), scale: v.tuple([v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0))]), shear: v.pipe(finite, v.minValue(0), v.maxValue(1)) }),
});
export type ViewProgramRows = v.InferOutput<typeof ViewProgramSchema>;
