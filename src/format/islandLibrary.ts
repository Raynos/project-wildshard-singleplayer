import * as v from 'valibot';
import { FixedDrawRowsSchema } from './fixedDraws.ts';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const groupId = v.pipe(v.string(), v.maxLength(512));
/** G1004: complete named geometry groups. The library still owns the referenced
 * binary draws, figure admission and retired-owner checks. */
export interface FixedGeometryGroupsRows {
  cargo:{barrel:string;lying:string;crate:string;broken:string;coil:string};
  driftLogs:{long:string;short:string;pale:string};
  npc:{trader:{body:string;head:string;upper:string;fore:string};castaway:{body:string;head:string;camp:string;arm:string;flames:string}};
  entryDecks:{world:string;deep:string;shallow:string};
  cover:Record<string,string>;
  piers:Record<string,{deck:string;cloth:string|null}>;
}
export const FixedGeometryGroupsSchema:v.GenericSchema<FixedGeometryGroupsRows,FixedGeometryGroupsRows> = v.strictObject({
  cargo: v.strictObject({barrel:groupId,lying:groupId,crate:groupId,broken:groupId,coil:groupId}),
  driftLogs: v.strictObject({long:groupId,short:groupId,pale:groupId}),
  npc: v.strictObject({
    trader:v.strictObject({body:groupId,head:groupId,upper:groupId,fore:groupId}),
    castaway:v.strictObject({body:groupId,head:groupId,camp:groupId,arm:groupId,flames:groupId}),
  }),
  entryDecks:v.strictObject({world:groupId,deep:groupId,shallow:groupId}),
  cover:v.record(groupId,groupId),
  piers:v.record(groupId,v.strictObject({deck:groupId,cloth:v.nullable(groupId)})),
});
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
