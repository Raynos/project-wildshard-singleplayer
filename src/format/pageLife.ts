import * as v from 'valibot';
import { AmbientFlockSchema, AmbientPerchesSchema, ForagerPopulationSchema } from './ambientLife';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const number = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(number, v.minValue(0), v.maxValue(1000000));
const count = v.pipe(nonnegative, v.integer(), v.maxValue(256));
const range = v.pipe(v.tuple([number, number]), v.check(([lo, hi]) => lo <= hi));
const system = v.strictObject({ id, after: v.array(id), before: v.array(id) });
/** Client ambient ownership over actual flock, journal, tool and actor services.
 * Rules are stateless ABI-v1 projections; no executable shard ports cross rows. */
export const PageLifeSchema = v.strictObject({
  version: v.literal(1), seed: number, system,
  draw: v.nullable(v.strictObject({ library: id, capacity: v.pipe(number, v.integer(), v.minValue(1), v.maxValue(512)), glow: range })),
  flocks: v.pipe(v.array(v.strictObject({ id, row: AmbientFlockSchema, perches: AmbientPerchesSchema,
    packed: v.boolean(), borrowed: v.boolean(), audio: v.picklist(['bank', 'cue']) })), v.maxLength(16)),
  foragers: v.pipe(v.array(v.strictObject({ row: ForagerPopulationSchema, model: number, scale: number,
    alertRate: number, alertGain: number, sitPitch: number })), v.maxLength(16)),
  program: v.exactOptional(v.strictObject({ script: v.unknown(), bytes: v.string() })),
  carcasses: v.exactOptional(v.strictObject({ group: id, arrival: range, visitors: v.record(id, count),
    bodyWidths: v.record(id, nonnegative), defaultWidth: nonnegative, defaultVisitors: count,
    giveUp: nonnegative, reach: nonnegative, tint: nonnegative, untrackedAge: nonnegative, harvestDelay: nonnegative })),
  guide: v.exactOptional(v.strictObject({ group: id, policy: v.strictObject({ distance: v.literal('centre'), min: nonnegative, max: nonnegative,
    schedule: v.strictObject({ kind: v.literal('periodic'), initial: nonnegative, period: v.pipe(range, v.check(([lo]) => lo >= 0.1)) }) }), cue: id, gain: nonnegative })),
  harvest: v.exactOptional(v.strictObject({ len: nonnegative, kneelIn: nonnegative, cuts: v.array(nonnegative), rise: nonnegative,
    camera: v.strictObject({ down: number, targetY: number, defaultPitch: number, maxPitch: nonnegative }),
    surface: v.picklist(['litter', 'sand', 'rock', 'grass', 'planks']), sounds: v.tuple([id, id]), gain: nonnegative,
    kick: v.tuple([number, number]), fallbackSurface: v.picklist(['wood', 'ground', 'flesh']), fallbackPan: number, fallbackGain: number })),
  debug: v.exactOptional(v.strictObject({ id, window: id, flocks: v.record(id, id), visitors: v.record(id, id), populations: v.record(id, id),
    commands: v.record(id, v.strictObject({ operation: v.picklist(['visit', 'scavenge']), group: id })) })),
});
export type PageLifeRows = v.InferOutput<typeof PageLifeSchema>;
export function parsePageLife(input: unknown): PageLifeRows {
  const rows = v.parse(PageLifeSchema, input), ids = new Set(rows.flocks.map(row => row.id));
  const packed = rows.flocks.reduce((sum, row) => sum + (row.packed ? row.row.count : 0), 0)
    + rows.foragers.reduce((sum, row) => sum + row.row.count, 0);
  if (ids.size !== rows.flocks.length || rows.flocks.some(row => row.packed && row.borrowed)
    || (rows.draw === null ? packed > 0 : packed > rows.draw.capacity)
    || (rows.carcasses !== undefined || rows.guide !== undefined) && rows.program === undefined
    || rows.carcasses !== undefined && !rows.flocks.some(row => row.id === rows.carcasses?.group && row.row.scavenge !== null)
    || rows.guide !== undefined && !rows.flocks.some(row => row.id === rows.guide?.group && row.row.guide !== null)) throw new Error('Invalid ambient ownership rows');
  if (rows.debug !== undefined && [...Object.values(rows.debug.flocks), ...Object.values(rows.debug.visitors),
    ...Object.values(rows.debug.commands).map(row => row.group)].some(name => !ids.has(name))) throw new Error('Unknown ambient debug group');
  return rows;
}
