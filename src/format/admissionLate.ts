import * as v from 'valibot';
import { ShardHashSchema } from './shardSections';
import { SHARDFILE_ADMISSION_LIMITS } from './admissionLimits';
import { WIRE_CELL } from './wireLimits';

/** A declared library root which may warm after control. A required reader can demand it earlier.
 * Cell-local x/z is an ordering hint; no position means after positioned files. Full costs and inventory stay declared. */
export interface LateFile { hash: string; at?: [number, number] }
export type AdmissionLate = LateFile[];
const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-WIRE_CELL.half), v.maxValue(WIRE_CELL.half));
/** Optional additive admission metadata; duplicate, out-of-cell or undeclared roots refuse instead of changing a guard. */
export const AdmissionLateSchema: v.GenericSchema<AdmissionLate, AdmissionLate> = v.pipe(
  v.array(v.strictObject({ hash: ShardHashSchema, at: v.exactOptional(v.tuple([coordinate, coordinate])) })),
  v.maxLength(SHARDFILE_ADMISSION_LIMITS.files), v.check(rows => new Set(rows.map(row => row.hash)).size === rows.length, 'unique late file hashes'),
);
