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
