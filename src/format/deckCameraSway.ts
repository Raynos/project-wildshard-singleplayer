import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128)), finite = v.pipe(v.number(), v.finite());
/** A finite deck registry owner, update ordering and nine original view parameters. */
export const DeckCameraSwaySchema = v.strictObject({
  piece: id, system: id, before: v.pipe(v.array(id), v.maxLength(16)),
  /** height, ease, threshold, rate, speed, rollHz, roll, dipHz, dip */
  parameters: v.pipe(v.array(finite), v.length(9)),
});
export type DeckCameraSwayRows = v.InferOutput<typeof DeckCameraSwaySchema>;
