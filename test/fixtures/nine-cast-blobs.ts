import {readNamedBlob,type NamedBlob} from '../../src/sdk/blobs';
import {CAST_BLOBS,CAST_BINARY_SOURCES} from '../../src/shards/nine-dragon-stack/generators/castSources';
/** Exercise the same bounded project-file intake used after declaration bundling. */
export async function nineCastBlobs():Promise<NamedBlob[]>{
  return [...await Promise.all(CAST_BINARY_SOURCES.map(row=>readNamedBlob('src/shards/nine-dragon-stack',row.name,row.source,row.kind))),...CAST_BLOBS];
}
