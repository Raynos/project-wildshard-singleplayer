import * as v from 'valibot';

const continuationNumber = v.pipe(v.number(), v.finite());
const lairContinuation = v.strictObject({ timer: continuationNumber, discovered: v.boolean(), skinTaken: v.boolean(), kills: continuationNumber, retired: v.boolean() });
const entryContinuation = v.strictObject({ id: v.string(), state: v.picklist(['absent', 'idle', 'aware', 'engaged', 'leash', 'dead', 'broken', 'retired']),
  timer: continuationNumber, waitDusk: v.boolean(), discovered: v.boolean(), bannerArmed: v.boolean(), farT: continuationNumber,
  phase2: v.boolean(), beatT: continuationNumber, lockHp: continuationNumber, seenSig: v.boolean(), leashT: continuationNumber,
  lastHit: v.nullable(continuationNumber), forced: v.boolean() });
/** Compose these core fields into the caller's strict versioned envelope; script/body/strike state stays with that caller.
 * The top-level object also accepts that envelope directly, projecting only the core fields. Nested rows stay strict. */
export const EliteCoreContinuationSchema = v.object({ clocks: v.strictObject({ saveT: continuationNumber, lastDusk: v.boolean() }),
  records: v.record(v.string(), lairContinuation), entries: v.array(entryContinuation) });
/** Detached lair rules state, with a null last-hit value representing the untouched negative-infinity clock. */
export type EliteCoreContinuation = v.InferOutput<typeof EliteCoreContinuationSchema>;


const finite = v.pipe(v.number(), v.finite());
/** The historical member save wire. A row without a group rejects its pack field. */
export const EliteMemberContinuationSchema = v.strictObject({ animal: v.nullable(v.string()), phase2: v.boolean(), keeper: v.unknown(), pack: v.nullable(v.pipe(finite, v.integer(), v.minValue(0))) });
/** Project existing encounter declarations onto the finite native continuation contract. */
export const EliteContinuationRowsSchema = v.strictObject({
  version: finite, wire: v.strictObject({ detached: v.exactOptional(v.string()) }),
  rows: v.array(v.object({ def: v.object({ id: v.string() }), snapshot: v.string(), member: v.object({ kind: v.string(), variant: v.string() }),
    pack: v.exactOptional(v.object({ variants: v.array(v.string()), kind: v.string(), idPrefix: v.string() })),
    continuation: v.exactOptional(v.strictObject({ detachable: v.exactOptional(v.literal(true)),
      borrowed: v.exactOptional(v.strictObject({ group: v.pipe(finite, v.integer(), v.minValue(0)), role: v.literal('guard') })) })),
  })),
});
/** Row-controlled native member binding; all lifecycle and controller state stays lent. */
export type EliteContinuationRows = v.InferInput<typeof EliteContinuationRowsSchema>;
