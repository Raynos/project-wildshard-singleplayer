import * as v from 'valibot';

const number = v.pipe(v.number(), v.finite()), positive = v.pipe(number,v.minValue(0));
const triple = v.tuple([number,number,number]);
/** Numeric presentation only: shared rigid-joint gait, weighted skin and crowd tint. */
export const CrowdPresentationSchema = v.object({ name: v.pipe(v.string(),v.minLength(1),v.maxLength(96)),
  attributes: v.tuple([v.pipe(v.string(),v.regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/u))]),
  wool: v.pipe(v.array(triple),v.minLength(1),v.maxLength(32)),
  hits: v.pipe(v.array(triple),v.minLength(1),v.maxLength(16)),preyY: number,feetY: number,cullRadius: positive,
  motion: v.object({ walk: v.tuple([number,positive]),
    joints: v.pipe(v.array(v.tuple([number,number,number,number,number,number,number])),v.minLength(1),v.maxLength(64)),
    movingBob: v.tuple([number,positive,number]),idleBob: v.tuple([number,number]),movingAt: positive,
    deathPivot: triple,deathAngle: number,tint: v.tuple([number,number]),
  }),
});

export type CrowdPresentationRows = v.InferOutput<typeof CrowdPresentationSchema>;
