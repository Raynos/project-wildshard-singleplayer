import * as v from 'valibot';

/** Authored terrain and millrace placement recipe, unchanged across page and native owners. */
export interface PopulationWaveSpec {
  max: number; region: { x: number; z: number; ax: number; az: number };
  exclude: { x: number; z: number; blend: number }; face: { x: number; z: number }; mill: { x: number; z: number };
  water: number; roamKinds: readonly string[]; race: readonly { kind: string; x: number; z: number }[];
}

/** Execution bounds and spatial/motor tuning are data; the legacy spec remains the saved compatibility key. */
export interface PopulationWaveTuning {
  readonly actorLimit: number; readonly forceLimit: number; readonly fleeLimit: number;
  readonly escape: { readonly speed: number; readonly turn: number };
  readonly listenTurn: number; readonly raceRange: number; readonly regionScale: number;
  readonly placement: { readonly attempts: number; readonly radius: number; readonly bound: number; readonly waterClear: number; readonly excludeClear: number;
    readonly near: readonly number[]; readonly far: readonly number[] };
  readonly voices: { readonly call: string; readonly wake: string; readonly flee: string };
}

/** The same admitted data drives native and page owners; page presentation consumes returned effects. */
export interface PopulationWaveRule {
  step: string; variant: string; state: string; asked: string; done: string; table: string;
  label: string; fallback: Record<string, string>; tint: readonly number[];
}
export interface PopulationWaveBundle {
  spec: PopulationWaveSpec; stages: unknown; tuning: PopulationWaveTuning; rule: PopulationWaveRule;
  declaration: unknown; module: { module: string; bytes: string }; seed: number;
}

const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0));
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const point = v.looseObject({ x: finite, z: finite });
const specSchema = v.looseObject({ max: v.pipe(positive, v.integer(), v.minValue(1), v.maxValue(8)),
  region: v.looseObject({ ...point.entries, ax: v.pipe(finite, v.minValue(Number.EPSILON)), az: v.pipe(finite, v.minValue(Number.EPSILON)) }),
  exclude: v.looseObject({ ...point.entries, blend: positive }), face: point, mill: point, water: finite,
  roamKinds: v.pipe(v.array(key), v.minLength(1), v.maxLength(64)), race: v.pipe(v.array(v.looseObject({ kind: key, ...point.entries })), v.maxLength(8)) });
const band = v.pipe(v.tuple([positive, positive]), v.check(row => row[0] <= row[1]));
const tuningSchema = v.strictObject({ actorLimit: v.pipe(positive, v.integer(), v.minValue(1), v.maxValue(8)),
  forceLimit: v.pipe(positive, v.integer(), v.maxValue(8)), fleeLimit: v.pipe(positive, v.maxValue(3.5)),
  escape: v.strictObject({ speed: positive, turn: positive }), listenTurn: positive, raceRange: positive, regionScale: positive,
  placement: v.strictObject({ attempts: v.pipe(positive, v.integer(), v.minValue(1), v.maxValue(1024)), radius: positive,
    bound: positive, waterClear: finite, excludeClear: positive, near: band, far: band }),
  voices: v.strictObject({ call: key, wake: key, flee: key }) });
const bundle = v.strictObject({
  // Preserve the historical object's insertion order, including extra authored layout fields, in its saved JSON key.
  spec: v.custom<PopulationWaveSpec>(input => v.is(specSchema, input)), stages: v.unknown(), tuning: tuningSchema,
  rule: v.strictObject({ step: key, variant: key, state: key, asked: key, done: key, table: key, label: key,
    fallback: v.record(key, key), tint: v.tuple([finite, finite, finite]) }),
  declaration: v.unknown(), module: v.object({ module: key, bytes: v.string() }), seed: v.pipe(finite, v.integer()),
});
/** Admit all native/page wave rows once; preserve the old spec wire exactly. */
export function parsePopulationWaves(input: unknown): PopulationWaveBundle { return v.parse(bundle, input); }
