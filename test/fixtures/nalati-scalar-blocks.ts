// oxlint-disable-next-line import/no-nodejs-modules -- Independent source-byte oracle; no production reader is mocked.
import {readFileSync} from 'node:fs';
import type {ScalarChannelRows} from '../../src/format/scalarChannel';
import reference from './nalati-geography-blocks.json' with {type:'json'};

export function scalarBlockBytes(data:ScalarChannelRows['data']):Uint8Array{
  return typeof data==='string'?Uint8Array.from(atob(data),value=>value.codePointAt(0)??0):readFileSync(`src/shards/nalati-grasslands/${data.file}`);
}
export function readNalatiScalarBlocks():ReadonlyMap<string,Uint8Array>{
  return new Map(reference.map(row=>[row.file,Uint8Array.from(readFileSync(`src/shards/nalati-grasslands/${row.file}`))]));
}
/** Reconstruct only the old inline transport for the unchanged whole-book hash. */
export function inlineScalarBook(value:unknown):unknown{
  if(Array.isArray(value))return value.map((entry:unknown)=>inlineScalarBook(entry));
  if(typeof value!=='object'||value===null)return value;
  if('file' in value&&typeof value.file==='string')return readFileSync(`src/shards/nalati-grasslands/${value.file}`).toString('base64');
  return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='sources').map(([key,entry])=>[key,inlineScalarBook(entry)]));
}
