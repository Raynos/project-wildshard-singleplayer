import * as v from 'valibot';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const uint = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
/** Ownership is independent of whether a body is alive; a dead materialized actor is still a corpse in the world. */
export const NativeActorEnvelopeSchema = v.strictObject({
  version: v.literal(1),
  allocator: v.strictObject({ next: uint, used: v.array(name) }),
  actors: v.array(v.strictObject({
    id: name, kind: name, variant: name,
    state: v.picklist(['dormant', 'materialized', 'retired']),
    group: v.nullable(name), encounter: v.nullable(name), listed: v.boolean(),
  })),
  auxiliary: v.array(v.strictObject({ id: name, actor: name, service: name, handle: v.pipe(v.number(), v.finite()) })),
});
/** A versioned game-owned identity envelope. Native handles are adopted after the physics world has restored. */
export type NativeActorEnvelope = v.InferOutput<typeof NativeActorEnvelopeSchema>;
export type NativeActorIdentity = NativeActorEnvelope['actors'][number];
export type NativeActorAuxiliary = NativeActorEnvelope['auxiliary'][number];
