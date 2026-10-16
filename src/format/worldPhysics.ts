import * as v from 'valibot';
import { isJsonData } from './json';
import { nativeBodySchema, nativeColliderRecordSchema } from './nativePhysics';

const finite = v.pipe(v.number(), v.finite());
const triple = v.tuple([finite, finite, finite]);
const count = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65535));
const xyz = v.strictObject({ x: finite, y: finite, z: finite });
const encoded = v.pipe(v.string(), v.regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u), v.maxLength(24_000_000));
const ground = v.pipe(v.strictObject({ rows: count, cols: count, heights: encoded, friction: finite, groups: finite, scale: xyz, at: xyz }),
  v.check(row => row.rows === row.cols, 'Native floor must be square'));
const pose = v.strictObject({ joints: v.pipe(v.array(v.strictObject({ name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  parent: v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(31)), position: triple, order: v.picklist(['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY']), scale: triple })), v.minLength(1), v.maxLength(32)), custom: v.boolean(),
  gait: v.exactOptional(v.strictObject({ trot: finite, gallop: finite })), pose: v.exactOptional(v.strictObject({ grazeNeck: finite, gallopTail: finite })) });

function world(rig: 'segments' | 'axis', provenance: 'piece' | 'tagged') {
  const spec = nativeBodySchema(rig);
  const body = { id: v.string(), kind: v.string(), variant: v.string(), spec, seed: finite, scale: finite };
  const actor = v.strictObject({ ...body, herd: finite, scripted: v.exactOptional(v.boolean()), pose: v.exactOptional(pose),
    at: v.exactOptional(v.nullable(v.strictObject({ x: finite, z: finite }))) });
  return v.strictObject({ version: v.literal(1), rig: v.literal(rig), provenance: v.literal(provenance), ground,
    solids: v.pipe(v.array(nativeColliderRecordSchema(provenance === 'piece' ? [1, 2, 6, 9] : [1, 2, 9], provenance)), v.maxLength(65535)),
    actors: v.pipe(v.array(actor), v.maxLength(4096)), parked: v.exactOptional(v.pipe(v.array(v.strictObject(body)), v.maxLength(4096))),
    herds: v.pipe(v.array(v.strictObject({ kind: v.string(), members: v.pipe(v.array(v.string()), v.maxLength(4096)) })), v.maxLength(4096)) });
}

const raw = v.union([world('segments', 'piece'), world('axis', 'tagged')]);
/** Common raw native world bytes; owner metadata and decoded buffers never enter this platform section. */
export type WorldPhysics = v.InferOutput<typeof raw>;

/** Explicit rig/provenance policy, original actor identity and strict wire shapes for world/physics. */
export const WorldPhysicsSchema: v.GenericSchema<unknown, WorldPhysics> = v.pipe(v.unknown(), v.check(isJsonData, 'Physics must be plain JSON'), raw,
  v.check(row => {
    const bodies = [...row.actors, ...row.parked ?? []];
    return new Set(bodies.map(actor => actor.id)).size === bodies.length
      && bodies.every(actor => actor.kind === actor.spec.kind && actor.variant === actor.spec.variant);
  }, 'Divergent or duplicate native actor identity'));

/** Admission before section emission or publication; consumer-owned byte/lattice/encounter checks still run. */
export function parseWorldPhysics(input: unknown): WorldPhysics { return v.parse(WorldPhysicsSchema, input); }
