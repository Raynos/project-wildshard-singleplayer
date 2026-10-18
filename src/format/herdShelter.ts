import * as v from 'valibot';

/** Population shelter tuning in metres and seconds; no rendering or shard dependencies. */
export interface HerdShelterRows {
  /** the herd kinds that shelter (a bear sits it out) */
  readonly kinds: readonly string[];
  /** a tree this tall (m) is a shelter */
  readonly bigTree: number;
  /** a herd looks this far (m) for one */
  readonly reach: number;
  /** seconds the old home is held after the rain, so the herd walks back out */
  readonly homeHold: number;
  /** metres past the trunk's radius the herd stands (under the crown, clear of the trunk) */
  readonly clear: number;
  /** the wander radius under the tree, and back home */
  readonly spotR: number;
  readonly homeR: number;
  /** rain over this shelters; under `dry` the hold counts down */
  readonly wet: number;
  readonly dry: number;
  /** Distance-score credits per metre of height and unit of crown cover. */
  readonly heightBias: number;
  readonly coverBias: number;
}


const positive = v.pipe(v.number(), v.finite(), v.minValue(0));
const lookSchema = v.strictObject({ kinds: v.array(v.pipe(v.string(), v.minLength(1))), bigTree: positive, reach: positive,
  homeHold: positive, clear: positive, spotR: positive, homeR: positive, wet: positive, dry: positive, heightBias: positive, coverBias: positive });
const rowsSchema = v.strictObject({ environment: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), roster: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), weather: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), step: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  program: v.unknown(), herdLimit: v.pipe(positive, v.integer(), v.minValue(1), v.maxValue(1024)), look: lookSchema });
/** Parse the admitted native shelter rows; the page borrows exactly the same look. */
export function parsePopulationShelter(input: unknown): v.InferOutput<typeof rowsSchema> { return v.parse(rowsSchema, input); }
