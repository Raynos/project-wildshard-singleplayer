import type {ScalarChannelRows} from '../../src/format/scalarChannel';
import {originalGeographyFiles} from './nalati-geography-original';
import reference from './nalati-geography-blocks.json' with {type:'json'};

const originals=originalGeographyFiles();
function block(file:string):Uint8Array{
  const bytes=originals.get(file);
  if(bytes===undefined)throw new Error(`Missing original scalar block ${file}`);
  return bytes.slice();
}
export function scalarBlockBytes(data:ScalarChannelRows['data']):Uint8Array{
  return typeof data==='string'?Uint8Array.from(atob(data),value=>value.codePointAt(0)??0):block(data.file);
}
export function readNalatiScalarBlocks():ReadonlyMap<string,Uint8Array>{
  return new Map(reference.map(row=>[row.file,block(row.file)]));
}
/** Reconstruct only the old inline transport for the unchanged whole-book hash. */
export function inlineScalarBook(value:unknown):unknown{
  if(Array.isArray(value))return value.map((entry:unknown)=>inlineScalarBook(entry));
  if(typeof value!=='object'||value===null)return value;
  if('file' in value&&typeof value.file==='string')return Buffer.from(block(value.file)).toString('base64');
  return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='sources').map(([key,entry])=>[key,inlineScalarBook(entry)]));
}
