import * as v from 'valibot';
import { ActorProjectionStepV2Schema } from './actorProjectionV2';

const number = v.pipe(v.number(), v.finite()), positive = v.pipe(number,v.minValue(0));
const triple = v.tuple([number,number,number]);
/** Numeric presentation only: shared rigid-joint gait, weighted skin and crowd tint. */
export const CrowdPresentationSchema: v.GenericSchema<CrowdPresentationRowsInput, CrowdPresentationRows> = v.object({ name: v.pipe(v.string(),v.minLength(1),v.maxLength(96)),
  attributes: v.tuple([v.pipe(v.string(),v.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/u))]),
  wool: v.pipe(v.array(triple),v.minLength(1),v.maxLength(32)),
  hits: v.pipe(v.array(triple),v.minLength(1),v.maxLength(16)),preyY: number,feetY: number,cullRadius: positive,
  motion: v.object({ walk: v.tuple([number,positive]),
    joints: v.pipe(v.array(v.tuple([number,number,number,number,number,number,number])),v.minLength(1),v.maxLength(64)),
    movingBob: v.tuple([number,positive,number]),idleBob: v.tuple([number,number]),movingAt: positive,
    deathPivot: triple,deathAngle: number,tint: v.tuple([number,number]),
  }),
});



/** A crowd guardian projects native threat, straggler and player observations. */
export const CrowdGuardSchema: v.GenericSchema<CrowdGuardRowsInput, CrowdGuardRows> = v.strictObject({projection:ActorProjectionStepV2Schema});

/** Admitted data contracts, independent of validator implementation metadata. */
export type CrowdPresentationRowsInput = CrowdPresentationRows;
interface CrowdPresentationRowsFields {
    name: string;
    attributes: [
        string
    ];
    wool: ([
        number,
        number,
        number
    ])[];
    hits: ([
        number,
        number,
        number
    ])[];
    preyY: number;
    feetY: number;
    cullRadius: number;
    motion: {
        walk: [
            number,
            number
        ];
        joints: ([
            number,
            number,
            number,
            number,
            number,
            number,
            number
        ])[];
        movingBob: [
            number,
            number,
            number
        ];
        idleBob: [
            number,
            number
        ];
        movingAt: number;
        deathPivot: [
            number,
            number,
            number
        ];
        deathAngle: number;
        tint: [
            number,
            number
        ];
    };
}
export type CrowdPresentationRows = { [Key in keyof CrowdPresentationRowsFields]: CrowdPresentationRowsFields[Key] };
interface CrowdGuardRowsInputFields {
    projection: v.InferInput<typeof ActorProjectionStepV2Schema>;
}
export type CrowdGuardRowsInput = { [Key in keyof CrowdGuardRowsInputFields]: CrowdGuardRowsInputFields[Key] };
interface CrowdGuardRowsFields {
    projection: v.InferOutput<typeof ActorProjectionStepV2Schema>;
}
export type CrowdGuardRows = { [Key in keyof CrowdGuardRowsFields]: CrowdGuardRowsFields[Key] };
