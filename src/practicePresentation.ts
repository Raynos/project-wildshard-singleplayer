import * as v from 'valibot';

const presentationSchema = v.strictObject({
  materials: v.strictObject({ body: v.string(), glowing: v.string() }),
  looks: v.array(v.strictObject({ id: v.string(), species: v.string(), kind: v.string(), pose: v.string(),
    rootFlinch: v.exactOptional(v.picklist(['engine', 'authored-pose'])),
    rigContract: v.strictObject({ skeleton: v.string(), clips: v.tuple([]), sockets: v.array(v.string()) }) })),
});

/** Practice look data is strict; omitted recoil ownership preserves the engine default. */
export function readPracticePresentation(input: unknown): v.InferOutput<typeof presentationSchema> {
  return v.parse(presentationSchema, input);
}
