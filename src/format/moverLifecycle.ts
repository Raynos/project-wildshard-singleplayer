import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u), v.maxLength(128));
/** Endpoint observations use admitted mover fields, not view callbacks or approximate geometry tests. */
export const MoverAtEndSchema = v.pipe(v.strictObject({ field: v.picklist([1, 2, 3, 4, 5, 6]), equals: v.pipe(v.number(), v.finite(), v.minValue(-Math.PI), v.maxValue(Math.PI)) }),
  v.check(row => row.field < 4 || row.equals >= 0 && row.equals <= 1, 'endpoint matches admitted field range'));
/** Load-only endpoint restoration is distinct from the legacy drivers' nonuniform numeric commands. */
export const MoverRestoreFromSchema = v.strictObject({ flag: id, action: v.literal('end') });
/** Shared lifecycle data also serves collision-free channel movers. */
export const MoverLifecycleRowsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'plain JSON mover lifecycle'), v.array(v.strictObject({ id,
  atEnd: v.exactOptional(MoverAtEndSchema), restoreFrom: v.exactOptional(MoverRestoreFromSchema) })), v.maxLength(32),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique mover lifecycle ids'));
export type MoverLifecycleRows = v.InferOutput<typeof MoverLifecycleRowsSchema>;
