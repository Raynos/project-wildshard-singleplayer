import * as v from 'valibot';
import { unzlibSync } from 'fflate';
import { base64Bytes } from '@wildshard/engine/core/deflate';
import type { Scope } from '@wildshard/engine/app/scope';
import { isJsonData } from '@wildshard/format/json';
import { BinarySourceSchema,type BinarySourceRows } from '@wildshard/format/binarySource';

/** A product's existing verified reader; JSON-only legacy declarations need no file capability. */
export interface BinaryFileReader { readonly file?: (name:string)=>Promise<Uint8Array>;readonly hasFile?: (name:string)=>boolean }
const requestsSchema=v.pipe(v.unknown(),v.check(isJsonData),v.array(v.strictObject({source:BinarySourceSchema,
  bytes:v.pipe(v.number(),v.safeInteger(),v.minValue(0))})));
/** Preflight all file/count declarations before reading, and all returned lengths before a caller allocates resources.
 * Bytes belong to the caller's existing preparation; there is no cache or decoded template. */
export async function prepareBinarySources(product:BinaryFileReader,input:unknown,scope?:Scope):Promise<ReadonlyMap<string,Uint8Array>> {
  const alive=():void=>{if(scope?.disposed===true||scope?.disposing===true)throw new Error('Binary source owner retired');};
  alive();const requests=v.parse(requestsSchema,input),lengths=new Map<string,number>(),files=new Map<string,Uint8Array>();
  for(const {source,bytes} of requests)if('file'in source){
    const previous=lengths.get(source.file);if(previous!==undefined&&previous!==bytes)throw new Error('Conflicting binary source lengths');
    lengths.set(source.file,bytes);
  }
  if(lengths.size===0)return files;
  const read=product.file,has=product.hasFile;
  const live=():void=>{alive();if(product.file!==read||product.hasFile!==has)throw new Error('Binary source reader changed');};
  if(read===undefined)throw new Error('Binary source requires its product reader');
  live();for(const file of lengths.keys())if(has!==undefined&&!has.call(product,file))throw new Error(`Missing binary source ${file}`);
  for(const [file,length] of lengths){
    live();const bytes=await read.call(product,file);live();
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==length)throw new Error(`Binary source byte count differs: ${file}`);
    files.set(file,bytes);
  }
  return files;
}
/** Resolve a prepared file, or decode a legacy inline block at its original construction slot. */
export function binarySourceBytes(input:BinarySourceRows,files:ReadonlyMap<string,Uint8Array>=new Map()):Uint8Array {
  const row=v.parse(BinarySourceSchema,input);if('data'in row)return unzlibSync(base64Bytes(row.data));
  const bytes=files.get(row.file);if(bytes===undefined)throw new Error(`Binary source was not prepared: ${row.file}`);return bytes;
}
