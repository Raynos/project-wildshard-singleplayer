import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), finite = v.pipe(v.number(), v.finite());
const count = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
/** A target: an object its owner lends by id, or the actor bound to one slot of a pool. */
const ref = v.union([id, v.strictObject({ pool: id, slot: count(0, 63), part: v.exactOptional(id) })]);
/**
 * G600 L7: a view module (SCRIPT-ABI v2, lane 3) and where its frame comes from and lands, as rows
 * (engine/script/viewProgram). `pools` name a native group's ordered actor slots (group, count, the named finite fields
 * each slot reports); a slot keeps its actor through death and is freed only on despawn, and a new identity in a slot
 * starts without interpolation. `samples` are the one binding's public columns in order: the player's position or
 * horizontal speed, a registry piece's floor under the player (present 0 / 1, its height, 0 when absent), a constant, or
 * a pool's block (per slot: present, x, y, z, yaw, alive, the ground under it, then its fields). `channels` are the channel bank in order:
 * added to the camera every displayed frame (the last landed bank between scheduled frames), or written on landing to a
 * lent look's parameter, a target's visibility (value > 0.5), its materials' opacity, colour (a base colour times the
 * value) or a named uniform, a named visual field of a slot's actor, or one component of one copy's instanced attribute.
 * A slot target may name a `part`, a child of the actor's object. `transforms` are the transform positions in order: a target's local
 * matrix, a named bone under it, or one copy of a lent instanced draw. A program sampling a piece or a group its owner
 * lacks installs nothing. Client-only; nothing reaches the sim or a save.
 */
export const ViewProgramSchema = v.pipe(v.strictObject({
  system: id, before: v.pipe(v.array(id), v.maxLength(16)),
  budget: v.strictObject({ pages: count(1, 4), ioBytes: count(16, 65536), fuel: count(1, 10_000_000), targetMs: v.pipe(finite, v.minValue(0.01), v.maxValue(16)) }),
  pools: v.optional(v.pipe(v.array(v.strictObject({ id, group: id, count: count(1, 64), fields: v.pipe(v.array(id), v.maxLength(16)) })), v.maxLength(8)), []),
  samples: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('player'), field: v.picklist(['x', 'y', 'z', 'speed']) }),
    v.strictObject({ kind: v.literal('floor'), piece: id, field: v.picklist(['present', 'height']) }),
    v.strictObject({ kind: v.literal('constant'), value: finite }),
    v.strictObject({ kind: v.literal('pool'), pool: id }),
  ])), v.minLength(1), v.maxLength(64)),
  channels: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('camera'), field: v.picklist(['x', 'y', 'z', 'pitch', 'yaw', 'roll']) }),
    v.strictObject({ kind: v.literal('look'), look: id, param: id }),
    v.strictObject({ kind: v.literal('visible'), object: ref }),
    v.strictObject({ kind: v.literal('opacity'), object: ref }),
    v.strictObject({ kind: v.literal('uniform'), object: ref, uniform: id }),
    v.strictObject({ kind: v.literal('color'), object: ref, color: v.tuple([finite, finite, finite]) }),
    v.strictObject({ kind: v.literal('field'), pool: id, slot: count(0, 63), field: id }),
    v.strictObject({ kind: v.literal('attribute'), object: id, attribute: id, index: count(0, 65535), component: count(0, 3) }),
  ])), v.maxLength(256)),
  transforms: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('object'), object: ref }),
    v.strictObject({ kind: v.literal('bone'), object: ref, bone: id }),
    v.strictObject({ kind: v.literal('instance'), object: id, index: count(0, 65535) }),
  ])), v.maxLength(256), v.check(rows => new Set(rows.map(row => JSON.stringify(row))).size === rows.length, 'One transform position per target')),
  /** a written matrix's translation length, column scale range and normalized column cross-dot stay inside these */
  bounds: v.strictObject({ translation: v.pipe(finite, v.minValue(0)), scale: v.tuple([v.pipe(finite, v.minValue(0)), v.pipe(finite, v.minValue(0))]), shear: v.pipe(finite, v.minValue(0), v.maxValue(1)) }),
}), v.check(rows => {
  const pools = new Map(rows.pools.map(pool => [pool.id, pool.count]));
  const refs = [...rows.channels, ...rows.transforms].flatMap(row => 'object' in row && typeof row.object === 'object' ? [row.object] : 'pool' in row ? [row] : []);
  return pools.size === rows.pools.length && rows.samples.every(row => row.kind !== 'pool' || pools.has(row.pool))
    && refs.every(row => row.slot < (pools.get(row.pool) ?? 0));
}, 'Pools are unique and every pool reference names a declared slot'));
export type ViewProgramRows = v.InferOutput<typeof ViewProgramSchema>;
export type ViewTargetRef = v.InferOutput<typeof ref>;
