import * as v from 'valibot';
import { isJsonData } from './json';

/** An inline compressed block or one verified product file containing the same raw bytes; never both. */
export const BinaryDataSchema:v.StrictObjectSchema<{data:v.GenericSchema<unknown,string>},undefined>=v.strictObject({data:v.pipe(v.string(),v.minLength(1))});
export const BinaryFileSchema:v.StrictObjectSchema<{file:v.GenericSchema<unknown,string>},undefined>=v.strictObject({file:v.pipe(v.string(),v.minLength(1),v.maxLength(256))});
export type BinarySourceRows={data:string}|{file:string};
export const BinarySourceSchema:v.GenericSchema<unknown,BinarySourceRows>=v.pipe(v.unknown(),v.check(isJsonData),v.union([BinaryDataSchema,BinaryFileSchema]));
