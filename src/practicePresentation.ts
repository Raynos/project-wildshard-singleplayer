import * as v from 'valibot';

const colour = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff));
const intensity = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(4));

const presentationSchema = v.strictObject({
  arenaLighting: v.exactOptional(v.strictObject({ profile: v.picklist(['neutral-studio-v1', 'neutral-gray-v2']),
    sky: colour, ground: colour, intensity })),
  arenaOcclusion: v.exactOptional(v.strictObject({ profile: v.literal('contact-v1'),
    radius: v.pipe(v.number(), v.finite(), v.minValue(0.01), v.maxValue(2)), intensity })),
  materials: v.strictObject({ body: v.string(), glowing: v.string() }),
  looks: v.array(v.strictObject({ id: v.string(), species: v.string(), kind: v.string(), pose: v.string(),
    rootFlinch: v.exactOptional(v.picklist(['engine', 'authored-pose'])),
    rigContract: v.strictObject({ skeleton: v.string(), clips: v.tuple([]), sockets: v.array(v.string()) }) })),
});

/** Practice look data is strict; omitted recoil ownership preserves the engine default. */
export function readPracticePresentation(input: unknown): v.InferOutput<typeof presentationSchema> {
  return v.parse(presentationSchema, input);
}
