import * as v from 'valibot';
import { FixedDrawRowsSchema } from './fixedDraws';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
/** A resolved book: the product pins its identity; fixed rows occur once.
 * Figures are unpacked rows; legacy libraries retain their existing pack support. */
export const ResolvedIslandLibrarySchema: v.GenericSchema<ResolvedIslandLibraryRowsInput, ResolvedIslandLibraryRows> = v.strictObject({
  id, draws: FixedDrawRowsSchema, groups: id, figures: id,
  collections: v.pipe(v.record(id, id), v.maxEntries(16)),
});


/** Admitted data contracts, independent of validator implementation metadata. */
interface ResolvedIslandLibraryRowsInputFields {
    id: string;
    draws: v.InferInput<typeof FixedDrawRowsSchema>;
    groups: string;
    figures: string;
    collections: Record<string, string>;
}
export type ResolvedIslandLibraryRowsInput = { [Key in keyof ResolvedIslandLibraryRowsInputFields]: ResolvedIslandLibraryRowsInputFields[Key] };
interface ResolvedIslandLibraryRowsFields {
    id: string;
    draws: v.InferOutput<typeof FixedDrawRowsSchema>;
    groups: string;
    figures: string;
    collections: Record<string, string>;
}
export type ResolvedIslandLibraryRows = { [Key in keyof ResolvedIslandLibraryRowsFields]: ResolvedIslandLibraryRowsFields[Key] };
