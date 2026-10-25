import * as v from 'valibot';

const continuationNumber = v.pipe(v.number(), v.finite());
const lairContinuation = v.strictObject({ timer: continuationNumber, discovered: v.boolean(), skinTaken: v.boolean(), kills: continuationNumber, retired: v.boolean() });
const entryContinuation = v.strictObject({ id: v.string(), state: v.picklist(['absent', 'idle', 'aware', 'engaged', 'leash', 'dead', 'broken', 'retired']),
  timer: continuationNumber, waitDusk: v.boolean(), discovered: v.boolean(), bannerArmed: v.boolean(), farT: continuationNumber,
  phase2: v.boolean(), beatT: continuationNumber, lockHp: continuationNumber, seenSig: v.boolean(), leashT: continuationNumber,
  lastHit: v.nullable(continuationNumber), forced: v.boolean() });
/** Compose these core fields into the caller's strict versioned envelope; script/body/strike state stays with that caller.
 * The top-level object also accepts that envelope directly, projecting only the core fields. Nested rows stay strict. */
export const EliteCoreContinuationSchema: v.ObjectSchema<{ readonly clocks: v.GenericSchema<EliteCoreContinuationInput['clocks'], EliteCoreContinuation['clocks']>; readonly records: v.GenericSchema<EliteCoreContinuationInput['records'], EliteCoreContinuation['records']>; readonly entries: v.GenericSchema<EliteCoreContinuationInput['entries'], EliteCoreContinuation['entries']>; }, undefined> = v.object({ clocks: v.strictObject({ saveT: continuationNumber, lastDusk: v.boolean() }),
  records: v.record(v.string(), lairContinuation), entries: v.array(entryContinuation) });
/** Detached lair rules state, with a null last-hit value representing the untouched negative-infinity clock. */



const finite = v.pipe(v.number(), v.finite());
/** The historical member save wire. A row without a group rejects its pack field. */
export const EliteMemberContinuationSchema: v.StrictObjectSchema<{ readonly [Key in keyof EliteMemberContinuationRows]: v.GenericSchema<EliteMemberContinuationRowsInput[Key], EliteMemberContinuationRows[Key]> }, undefined> = v.strictObject({ animal: v.nullable(v.string()), phase2: v.boolean(), keeper: v.unknown(), pack: v.nullable(v.pipe(finite, v.integer(), v.minValue(0))) });
/** Project existing encounter declarations onto the finite native continuation contract. */
export const EliteContinuationRowsSchema: v.StrictObjectSchema<{ readonly version: v.GenericSchema<EliteContinuationRowsRowsInput['version'], EliteContinuationRowsRows['version']>; readonly wire: v.GenericSchema<EliteContinuationRowsRowsInput['wire'], EliteContinuationRowsRows['wire']>; readonly rows: v.ArraySchema<v.ObjectSchema<EliteMemberEntries, undefined>, undefined>; }, undefined> = v.strictObject({
  version: finite, wire: v.strictObject({ detached: v.exactOptional(v.string()) }),
  rows: v.array(v.object({ def: v.object({ id: v.string() }), snapshot: v.string(), member: v.object({ kind: v.string(), variant: v.string() }),
    pack: v.exactOptional(v.object({ variants: v.array(v.string()), kind: v.string(), idPrefix: v.string() })),
    continuation: v.exactOptional(v.strictObject({ detachable: v.exactOptional(v.literal(true)),
      borrowed: v.exactOptional(v.strictObject({ group: v.pipe(finite, v.integer(), v.minValue(0)), role: v.literal('guard') })) })),
  })),
});
/** Row-controlled native member binding; all lifecycle and controller state stays lent. */
export type EliteContinuationRows = v.InferInput<typeof EliteContinuationRowsSchema>;

/** Admitted data contracts, independent of validator implementation metadata. */
export type EliteCoreContinuationInput = EliteCoreContinuation;
interface EliteCoreContinuationFields {
    clocks: {
        saveT: number;
        lastDusk: boolean;
    };
    records: Record<string, {
        timer: number;
        discovered: boolean;
        skinTaken: boolean;
        kills: number;
        retired: boolean;
    }>;
    entries: ({
        id: string;
        state: 'absent' | 'idle' | 'aware' | 'engaged' | 'leash' | 'dead' | 'broken' | 'retired';
        timer: number;
        waitDusk: boolean;
        discovered: boolean;
        bannerArmed: boolean;
        farT: number;
        phase2: boolean;
        beatT: number;
        lockHp: number;
        seenSig: boolean;
        leashT: number;
        lastHit: (number) | null;
        forced: boolean;
    })[];
}
export type EliteCoreContinuation = { [Key in keyof EliteCoreContinuationFields]: EliteCoreContinuationFields[Key] };
export type EliteMemberContinuationRowsInput = EliteMemberContinuationRows;
interface EliteMemberContinuationRowsFields {
    animal: (string) | null;
    phase2: boolean;
    keeper: unknown;
    pack: (number) | null;
}
export type EliteMemberContinuationRows = { [Key in keyof EliteMemberContinuationRowsFields]: EliteMemberContinuationRowsFields[Key] };
export type EliteContinuationRowsRowsInput = EliteContinuationRowsRows;
interface EliteContinuationRowsRowsFields {
    version: number;
    wire: {
        detached?: string;
    };
    rows: ({
        def: {
            id: string;
        };
        snapshot: string;
        member: {
            kind: string;
            variant: string;
        };
        pack?: {
            variants: (string)[];
            kind: string;
            idPrefix: string;
        };
        continuation?: {
            detachable?: true;
            borrowed?: {
                group: number;
                role: 'guard';
            };
        };
    })[];
}
export type EliteContinuationRowsRows = { [Key in keyof EliteContinuationRowsRowsFields]: EliteContinuationRowsRowsFields[Key] };

type EliteMemberInput = EliteContinuationRowsRowsInput['rows'][number];
type EliteMemberOutput = EliteContinuationRowsRows['rows'][number];
type EliteMemberEntries = {
 [Key in Exclude<keyof EliteMemberOutput, 'pack' | 'continuation'>]: v.GenericSchema<EliteMemberInput[Key], EliteMemberOutput[Key]>;
} & {
 pack: v.ExactOptionalSchema<v.GenericSchema<NonNullable<EliteMemberInput['pack']>, NonNullable<EliteMemberOutput['pack']>>, undefined>;
 continuation: v.ExactOptionalSchema<v.GenericSchema<NonNullable<EliteMemberInput['continuation']>, NonNullable<EliteMemberOutput['continuation']>>, undefined>;
};
