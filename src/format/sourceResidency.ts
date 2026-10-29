import type {Shardfile} from './shardSchema';
import {preflightShardfile} from './preflight';

/** Exact existing source/wire claim, computed once by the publisher for first-party clients. */
export function publishedSourceResidency(source:Shardfile):number{
  const accounting={heapBytes:0};preflightShardfile(source,accounting);
  const wire=source.files.reduce((sum,file)=>sum+file.compressed,0)
    +source.requires.commons.reduce((sum,hash)=>sum+(source.requires.commonsWire[hash]??0),0);
  return wire+accounting.heapBytes*2+(source.files.length+source.requires.commons.length)*128+1024;
}
