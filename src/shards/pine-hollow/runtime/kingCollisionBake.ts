import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const point = v.strictObject({ x: finite, y: finite, z: finite });
const triple = v.tuple([finite, finite, finite]);
const matrix = v.pipe(v.array(finite), v.length(16));
const joint = (parent: -1 | 0 | 1 | 2) => v.strictObject({ parent: v.literal(parent), position: triple });

/** Trusted native metadata only. Unknown fields, invalid framing or stale caller identity are never defaulted. */
export const KingCollisionBake = v.strictObject({
  version: v.literal(1), hz: v.literal(60),
  inputs: v.record(v.string(), v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u))),
  joints: v.tuple([joint(-1), joint(0), joint(1), joint(2)]),
  rest: v.strictObject({ at: v.record(v.string(), point), rootPos: point,
    H: v.pipe(finite, v.minValue(0.5)), walkStride: v.pipe(finite, v.minValue(0.001)), chargeStride: v.pipe(finite, v.minValue(0.001)) }),
  volumes: v.strictObject({ head: triple,
    body: v.strictObject({ at: triple, pitch: finite, halfLength: v.pipe(finite, v.minValue(0.001)) }),
    fore: v.strictObject({ at: triple, halfLength: v.pipe(finite, v.minValue(0.001)) }), ribs: triple }),
  clips: v.array(v.strictObject({ name: v.picklist(['sweep', 'strike', 'roar']), duration: v.pipe(finite, v.minValue(0.001)),
    frames: v.array(v.strictObject({ tick: v.pipe(v.number(), v.integer(), v.minValue(0)), phase: v.pipe(finite, v.minValue(0), v.maxValue(1)),
      transforms: v.tuple([matrix, matrix, matrix, matrix]) })) })),
});

/** Read a generated collision bake; the runtime never creates a skeleton from this metadata. */
export function readKingCollisionBake(input: unknown): v.InferOutput<typeof KingCollisionBake> {
  const bake = v.parse(KingCollisionBake, input);
  if (bake.clips.length !== 3 || new Set(bake.clips.map(clip => clip.name)).size !== 3
    || Object.keys(bake.inputs).length === 0) throw new Error('Incomplete King collision bake');
  for (let i = 0; i < 3; i++) {
    const clip = bake.clips[i]; if (clip === undefined) throw new Error('Missing King collision clip');
    const end = Math.ceil(clip.duration * bake.hz);
    if (clip.frames.length !== end + 1 || clip.frames.some((frame, tick) =>
      frame.tick !== tick || frame.phase !== Math.min(tick / bake.hz / clip.duration, 1))) {
      throw new Error('Invalid King collision sample clock');
    }
  }
  return bake;
}
