import * as v from 'valibot';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const clock = v.picklist(['t', 'phase']);
const when = v.strictObject({ alive: v.exactOptional(v.boolean()), attacking: v.exactOptional(v.boolean()), deathAbove: v.exactOptional(n),
  mem: v.exactOptional(v.strictObject({ key: id, above: v.exactOptional(n), atLeast: v.exactOptional(n) })) });
/** When a clip case or term applies (game/plugin/animation `ClipWhen`). */
export interface ClipWhenRow { alive?: boolean; attacking?: boolean; deathAbove?: number; mem?: { key: string; above?: number; atLeast?: number } }
/** One factor of a clip term: a constant, a wave, a clock, a memory or a bounded sum (nested at most three deep). */
export type ClipFactorRow = number | { wave: 't' | 'phase'; rate: number; offset?: number; abs?: boolean } | { clock: 't' | 'phase' } | { mem: string }
  | { bounded: ClipTermRow[]; min?: number; max?: number; divide?: number };
/** One term of a clip sum. */
export type ClipTermRow = number | { when?: ClipWhenRow; of: ClipFactorRow[] };
/** One case of a clip row. */
export interface ClipCaseRow { when?: ClipWhenRow; sum: ClipTermRow[] }
/** A pivot's channel or an eased memory channel. */
export type ClipRowData = { bone: string; channel: 'rotation.x' | 'rotation.y' | 'rotation.z' | 'position.x' | 'position.y' | 'position.z' | 'scale'; bind?: string; cases: ClipCaseRow[] }
  | { mem: string; ease: number; cases: ClipCaseRow[] };

const leaf = [n, v.strictObject({ wave: clock, rate: n, offset: v.exactOptional(n), abs: v.exactOptional(v.boolean()) }), v.strictObject({ clock }), v.strictObject({ mem: id })] as const;
const termOf = (factor: v.GenericSchema<unknown, ClipFactorRow>): v.GenericSchema<unknown, ClipTermRow> =>
  v.union([n, v.strictObject({ when: v.exactOptional(when), of: v.pipe(v.array(factor), v.maxLength(16)) })]);
const boundedOf = (term: v.GenericSchema<unknown, ClipTermRow>): v.GenericSchema<unknown, ClipFactorRow> =>
  v.strictObject({ bounded: v.pipe(v.array(term), v.maxLength(16)), min: v.exactOptional(n), max: v.exactOptional(n), divide: v.exactOptional(n) });
const leafFactor: v.GenericSchema<unknown, ClipFactorRow> = v.union(leaf);
/** Clip terms nest `bounded` factors three deep (deeper rows are refused). */
const term1 = termOf(leafFactor), term2 = termOf(v.union([...leaf, boundedOf(term1)])), term = termOf(v.union([...leaf, boundedOf(term2)]));
const cases = v.pipe(v.array(v.strictObject({ when: v.exactOptional(when), sum: v.pipe(v.array(term), v.maxLength(16)) })), v.maxLength(16));
/** Pose clip rows (game/plugin/animation `playClips`) as admitted JSON, typed at this boundary. */
export const ClipRowsSchema: v.GenericSchema<unknown, ClipRowData[]> = v.pipe(v.array(v.union([
  v.strictObject({ bone: id, channel: v.picklist(['rotation.x', 'rotation.y', 'rotation.z', 'position.x', 'position.y', 'position.z', 'scale']), bind: v.exactOptional(id), cases }),
  v.strictObject({ mem: id, ease: n, cases }),
])), v.maxLength(64));

const gestureStart = v.variant('kind', [
  /** a figure signal (FigureRows.signal) starts it and resets its timer */
  v.strictObject({ kind: v.literal('signal') }),
  /** once as the player comes inside `inside` (and stays beyond `beyond`), rearmed past `rearm` */
  v.strictObject({ kind: v.literal('approach'), inside: n, beyond: n, rearm: n }),
  /** every base + (sin(t × frequency) + 1) × span seconds while the player is within [from, to); the first after `first` */
  v.strictObject({ kind: v.literal('every'), base: n, span: n, frequency: n, first: n, from: n, to: n }),
]);
/**
 * A figure built from kit meshes (G478 figures; client-only presentation): its scene recipe and its bindings, the pivots
 * its pose clips drive and its gestures (the turn to face the player and the head's attention are its channel programs). Each
 * gesture plays `seconds` with the clip memory `gesture` = its code, `weight` its eased 0 → 1 → 0, `phase` its clock;
 * `turns: false` holds the figure's idle facing, `look` overrides the head and `offer` offsets it within `within`.
 * `hide` hides the figure and its companions past the figure row's draw distance.
 */
export const KitFigureSchema: v.GenericSchema<unknown, KitFigureRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Kit figure requires plain JSON'), v.strictObject({
  scene: v.strictObject({ recipe: v.unknown(), parts: v.record(id, v.picklist(['group', 'object'])), bindings: v.unknown() }),
  material: id, neck: n, hide: v.boolean(),
  pose: ClipRowsSchema,
  gestures: v.pipe(v.array(v.strictObject({ id, code: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(8)), seconds: v.pipe(n, v.minValue(0)), eased: v.boolean(),
    starts: v.pipe(v.array(gestureStart), v.minLength(1), v.maxLength(2)), turns: v.boolean(),
    look: v.exactOptional(v.strictObject({ yaw: n, pitch: n })), offer: v.exactOptional(v.strictObject({ yaw: n, pitch: n, within: n })) })), v.maxLength(8)),
}));
type GestureStart = { kind: 'signal' } | { kind: 'approach'; inside: number; beyond: number; rearm: number }
  | { kind: 'every'; base: number; span: number; frequency: number; first: number; from: number; to: number };
/** A validated kit figure row (named at the schema boundary so its consumers never re-infer the clip unions). */
export interface KitFigureRows {
  scene: { recipe: unknown; parts: Record<string, 'group' | 'object'>; bindings: unknown };
  material: string; neck: number; hide: boolean;
  pose: ClipRowData[];
  gestures: { id: string; code: number; seconds: number; eased: boolean; starts: GestureStart[]; turns: boolean;
    look?: { yaw: number; pitch: number }; offer?: { yaw: number; pitch: number; within: number } }[];
}
