import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const point = v.strictObject({ x: finite, y: finite, z: finite });
const triple = v.tuple([finite, finite, finite]);
const matrix = v.pipe(v.array(finite), v.length(16));
const joint = (parent: -1 | 0 | 1 | 2) => v.strictObject({ parent: v.literal(parent), position: triple });

/** Generated from authored collision rows. Unknown fields or invalid framing are never defaulted. */
export const LimbCollisionBake: v.StrictObjectSchema<{ readonly version: v.GenericSchema<LimbCollisionBakeRowsInput['version'], LimbCollisionBakeRows['version']>; readonly hz: v.GenericSchema<LimbCollisionBakeRowsInput['hz'], LimbCollisionBakeRows['hz']>; readonly joints: v.GenericSchema<LimbCollisionBakeRowsInput['joints'], LimbCollisionBakeRows['joints']>; readonly rest: v.GenericSchema<LimbCollisionBakeRowsInput['rest'], LimbCollisionBakeRows['rest']>; readonly volumes: v.GenericSchema<LimbCollisionBakeRowsInput['volumes'], LimbCollisionBakeRows['volumes']>; readonly clips: v.GenericSchema<LimbCollisionBakeRowsInput['clips'], LimbCollisionBakeRows['clips']>; }, undefined> = v.strictObject({
  version: v.literal(1), hz: v.literal(60),
  joints: v.tuple([joint(-1), joint(0), joint(1), joint(2)]),
  rest: v.strictObject({ at: v.record(v.string(), point), rootPos: point,
    H: v.pipe(finite, v.minValue(0.5)), walkStride: v.pipe(finite, v.minValue(0.001)), chargeStride: v.pipe(finite, v.minValue(0.001)) }),
  volumes: v.strictObject({ head: triple,
    body: v.strictObject({ at: triple, pitch: finite, halfLength: v.pipe(finite, v.minValue(0.001)) }),
    fore: v.strictObject({ at: triple, halfLength: v.pipe(finite, v.minValue(0.001)) }), ribs: triple }),
  clips: v.array(v.strictObject({ name: v.string(), duration: v.pipe(finite, v.minValue(0.001)),
    frames: v.array(v.strictObject({ tick: v.pipe(v.number(), v.integer(), v.minValue(0)), phase: v.pipe(finite, v.minValue(0), v.maxValue(1)),
      transforms: v.tuple([matrix, matrix, matrix, matrix]) })) })),
});

/** Read a generated collision bake; the runtime never creates a skeleton from this metadata. */
export function readLimbCollisionBake(input: unknown): v.InferOutput<typeof LimbCollisionBake> {
  const bake = v.parse(LimbCollisionBake, input);
  if (bake.clips.length > 64 || new Set(bake.clips.map(clip => clip.name)).size !== bake.clips.length) throw new Error('Incomplete limb collision bake');
  for (let i = 0; i < bake.clips.length; i++) {
    const clip = bake.clips[i]; if (clip === undefined) throw new Error('Missing limb collision clip');
    const end = Math.ceil(clip.duration * bake.hz);
    if (clip.frames.length !== end + 1 || clip.frames.some((frame, tick) =>
      frame.tick !== tick || frame.phase !== Math.min(tick / bake.hz / clip.duration, 1))) {
      throw new Error('Invalid limb collision sample clock');
    }
  }
  return bake;
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type LimbCollisionBakeRowsInput = LimbCollisionBakeRows;
interface LimbCollisionBakeRowsFields {
    version: 1;
    hz: 60;
    joints: [
        {
            parent: -1 | 0 | 1 | 2;
            position: [
                number,
                number,
                number
            ];
        },
        {
            parent: -1 | 0 | 1 | 2;
            position: [
                number,
                number,
                number
            ];
        },
        {
            parent: -1 | 0 | 1 | 2;
            position: [
                number,
                number,
                number
            ];
        },
        {
            parent: -1 | 0 | 1 | 2;
            position: [
                number,
                number,
                number
            ];
        }
    ];
    rest: {
        at: Record<string, {
            x: number;
            y: number;
            z: number;
        }>;
        rootPos: {
            x: number;
            y: number;
            z: number;
        };
        H: number;
        walkStride: number;
        chargeStride: number;
    };
    volumes: {
        head: [
            number,
            number,
            number
        ];
        body: {
            at: [
                number,
                number,
                number
            ];
            pitch: number;
            halfLength: number;
        };
        fore: {
            at: [
                number,
                number,
                number
            ];
            halfLength: number;
        };
        ribs: [
            number,
            number,
            number
        ];
    };
    clips: ({
        name: string;
        duration: number;
        frames: ({
            tick: number;
            phase: number;
            transforms: [
                (number)[],
                (number)[],
                (number)[],
                (number)[]
            ];
        })[];
    })[];
}
export type LimbCollisionBakeRows = { [Key in keyof LimbCollisionBakeRowsFields]: LimbCollisionBakeRowsFields[Key] };
