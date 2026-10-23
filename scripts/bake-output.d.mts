import type {BinaryLike} from 'node:crypto';
import type {Buffer} from 'node:buffer';
/** SHA-256 of the exact emitted bytes. */
export function outputHash(bytes:BinaryLike):string;
/** Serialize ordinary JSON rows after refusing embedded byte values. */
export function jsonBytes(value:unknown,indent?:number|string):Buffer;
export function toolVersion(command:string,args:readonly string[]):string|null|undefined;
export interface ByteWriter {
  readonly put:(path:string,bytes:Uint8Array|string|readonly number[])=>void;
  readonly remove:(path:string)=>void;
  readonly finish:()=>number;
}
/** Check or publish complete bytes; JSON output also passes its writer guard. */
export function byteWriter(check:boolean,label:string,root?:string):ByteWriter;
