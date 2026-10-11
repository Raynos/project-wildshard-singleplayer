import * as v from 'valibot';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const label = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const coord = v.pipe(finite, v.minValue(-250), v.maxValue(250));
const point = v.tuple([coord, coord, coord]);
const positive = v.pipe(finite, v.minValue(0.001), v.maxValue(500));
const duration = v.pipe(finite, v.minValue(0), v.maxValue(60));
const phase = v.strictObject({ at: v.pipe(finite, v.minValue(0.001), v.maxValue(1)), name: label, caption: label, speed: v.pipe(finite, v.minValue(0), v.maxValue(15)), stopDistance: v.pipe(finite, v.minValue(0), v.maxValue(50)), turnRate: v.pipe(finite, v.minValue(0), v.maxValue(30)) });
const encounter = v.pipe(v.strictObject({ id, entity: id, kind: v.picklist(['elite', 'boss']), panel: v.nullable(id), name: label, title: label, retry: label,
  arena: v.strictObject({ at: point, radius: positive }), intro: duration, introShort: duration,
  respawn: v.strictObject({ at: point, yaw: finite }), phases: v.pipe(v.array(phase), v.minLength(1), v.maxLength(16)) }),
v.check((e) => e.phases[0]?.at === 1 && e.phases.every((p, i) => i === 0 || p.at < (e.phases[i - 1]?.at ?? 0)), 'descending phase thresholds starting at 1'));
/** Elite/boss phase tables with checkpoints/retry, neutral steering data and declared panel references. */
export const EncountersSchema = v.pipe(v.array(encounter), v.maxLength(64), v.check((rows) => new Set(rows.map((e) => e.id)).size === rows.length && new Set(rows.map((e) => e.entity)).size === rows.length, 'unique encounter ids and actors'));
/** Validated data-only encounter tables. */
export type ShardEncounters = v.InferOutput<typeof EncountersSchema>;
/** Full-loader references: declared actor spawn and the existing SF7f boss panel (if any). */
export function encounterRules(rows: ShardEncounters, entities: readonly string[], panels: readonly { id: string; encounter: string }[]): string[] {
  const errors: string[] = [];
  for (const row of rows) {
    if (!entities.includes(row.entity)) errors.push('declared encounter actor');
    if (row.panel !== null && !panels.some((p) => p.id === row.panel && p.encounter === row.id)) errors.push('declared matching boss panel');
  }
  return [...new Set(errors)];
}
