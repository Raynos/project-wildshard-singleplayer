import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
/** Native return services own the queue clock and predecessor identities.
 * The admitted event program chooses deadlines, eligibility and placement. */
export const NativeReturnRowsSchema: v.GenericSchema<NativeReturnRowsInput, NativeReturnRows> = v.strictObject({
  program: v.unknown(), outOfSight: v.pipe(finite, v.minValue(0)),
  water: finite, fixed: v.pipe(v.array(v.string()), v.maxLength(32)),
  interval: v.pipe(finite, v.minValue(0.1)),
  limit: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)),
  rules: v.record(v.string(), v.strictObject({
    delay: v.strictObject({ min: v.pipe(finite, v.minValue(0)), max: v.pipe(finite, v.minValue(0)) }),
    night: v.exactOptional(v.boolean()),
  })),
});


/** Authored seconds before replacement and its existing night gate. */
export interface RespawnRule { delay: { min: number; max: number }; night?: boolean }

/** One pending return, kept in death order until the configured traversal takes it. */
export interface RespawnEntry { kind: string; variant: string | undefined; herd: number; x: number; z: number; due: number; night: boolean }

/** Traversal, native refusal and result ownership are data, never subclass hooks. */
export interface RespawnTraversal {
  readonly order: 'forward' | 'reverse';
  readonly limit: number | null;
  readonly result: 'reuse' | 'fresh';
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type NativeReturnRowsInput = NativeReturnRows;
interface NativeReturnRowsFields {
    program: unknown;
    outOfSight: number;
    water: number;
    fixed: (string)[];
    interval: number;
    limit: number;
    rules: Record<string, {
        delay: {
            min: number;
            max: number;
        };
        night?: boolean;
    }>;
}
export type NativeReturnRows = { [Key in keyof NativeReturnRowsFields]: NativeReturnRowsFields[Key] };
