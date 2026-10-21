import * as v from 'valibot';

const n = v.pipe(v.number(), v.finite()), key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
/** Native quest services are declared ids and channels, never shard methods. */
export const NativeQuestCompositionSchema = v.strictObject({
  actor: key, step: key, rewardFlag: key, population: key, equipment: key, director: key, cable: key,
  reward: v.strictObject({ channels: key, field: key, complete: key }),
  talkId: key, heldId: key, cableId: key, heldObservation: key,
  guardKind: key, guardRadius: n, promptHeight: n, heldSlot: v.pipe(n, v.integer(), v.minValue(0), v.maxValue(31)),
  actions: v.strictObject({ talk: n, sword: n, zipline: n, row: n }),
  touch: v.strictObject({ radius: n, height: n }), plate: v.strictObject({ inset: n, depth: n }),
  talkRadius: n, swordRadius: n, limits: v.strictObject({ rows: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(64)) }),
  barrelOwner: v.strictObject({ kind: key, id: key }), keyDrop: v.strictObject({ kind: key, id: key }),
});

/** Build-admitted service identities for the existing native composition. */
export type NativeQuestCompositionRows = v.InferOutput<typeof NativeQuestCompositionSchema>;
