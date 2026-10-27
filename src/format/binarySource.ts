import * as v from 'valibot';
import { isJsonData } from './json';

/** An inline compressed block or one verified product file containing the same raw bytes; never both. */
export const BinaryDataSchema:v.StrictObjectSchema<{data:v.GenericSchema<unknown,string>},undefined>=v.strictObject({data:v.pipe(v.string(),v.minLength(1))});
export const BinaryFileSchema:v.StrictObjectSchema<{file:v.GenericSchema<unknown,string>},undefined>=v.strictObject({file:v.pipe(v.string(),v.minLength(1),v.maxLength(256))});
export type BinarySourceRows={data:string}|{file:string};
export const BinarySourceSchema:v.GenericSchema<unknown,BinarySourceRows>=v.pipe(v.unknown(),v.check(isJsonData),v.union([BinaryDataSchema,BinaryFileSchema]));

/** Transport grouping only: each member retains its original file identity,
 * byte count and SHA-256. A bank never grants admission to an undeclared file. */
export interface BinarySourceBankMember { file: string; offset: number; bytes: number; sha256: string }
export interface BinarySourceBank { file: string; bytes: number; members: BinarySourceBankMember[] }
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(16_777_216));
const bankFile = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
export const BinarySourceBanksSchema: v.GenericSchema<BinarySourceBank[], BinarySourceBank[]> = v.pipe(
  v.array(v.strictObject({ file: bankFile, bytes: count,
    members: v.pipe(v.array(v.strictObject({ file: bankFile, offset: count, bytes: count,
      sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)) })), v.minLength(1), v.maxLength(256)),
  })), v.maxLength(64), v.check(banks => {
    const roots = new Set(banks.map(bank => bank.file)), members = new Set<string>();
    if (roots.size !== banks.length) return false;
    for (const bank of banks) {
      let offset = 0;
      for (const member of bank.members) {
        if (roots.has(member.file) || members.has(member.file) || member.bytes === 0 || member.offset !== offset) return false;
        members.add(member.file); offset += member.bytes;
      }
      if (offset !== bank.bytes) return false;
    }
    return true;
  }, 'Binary bank members must be unique, contiguous and complete'));
