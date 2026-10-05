import * as v from 'valibot';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';

const natural = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
/** Parsed pinned-byte cost of one distinct commons hash; compressed bytes live in commonsWire. */
export const CommonsCostSchema = v.strictObject({ decoded: natural, gpu: natural, triangles: natural, draws: natural });
/** Bounded commons cost declarations, validated before immutable content is read. */
export const CommonsCostsSchema = v.pipe(v.record(hash, CommonsCostSchema), v.check(rows => Object.keys(rows).length <= limits.commons, 'bounded commons cost table'));
/** Exact byte-derived residency and geometry costs for each required hash. */
export type CommonsCosts = v.InferOutput<typeof CommonsCostsSchema>;
/** Refuse omitted, surplus or malformed commons costs before any fetch or cache read. */
export function assertCommonsCosts(commons: readonly string[], input: unknown): CommonsCosts {
  const rows = v.parse(CommonsCostsSchema, input === undefined ? {} : input), required = new Set(commons), keys = Object.keys(rows);
  if (required.size !== commons.length || keys.length !== required.size || keys.some(key => !required.has(key))) throw new Error('Commons require an exact cost key set');
  return rows;
}
