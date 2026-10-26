import {base64Bytes} from '../../src/engine/core/deflate';
import {nameBlob,type NamedBlob} from '../../src/sdk/blobs';
import {encodeCanonicalJson} from '../../src/sdk/immutable';
import {SceneDressingSchema,type SceneDressingRows} from '../../src/format/sceneDressing';
import * as v from 'valibot';

/** Check every named contact loan against its original complete inline row,
 * then reconstruct only that transport for the unchanged full-wire pins. */
export function originalDressingContactTransport(blobs:readonly NamedBlob[],originals:ReadonlyMap<string,SceneDressingRows>):NamedBlob[]{
  const files=new Map(blobs.map(row=>[row.file.name,row])),used=new Set<string>();
  const output=blobs.filter(row=>!row.file.name?.startsWith('world/dressing-contacts/')).map(blob=>{
    const before=blob.file.name===undefined?undefined:originals.get(blob.file.name);if(before===undefined)return blob;
    const scene=v.parse(SceneDressingSchema,JSON.parse(new TextDecoder().decode(blob.bytes)));
    const sources=[...before.layers,...before.statics.flatMap(row=>row.members)],targets=[...scene.layers,...scene.statics.flatMap(row=>row.members)];
    if(sources.length!==targets.length)throw new Error('Contact row inventory changed');
    for(const [index,source]of sources.entries()){
      const old=source.contacts,target=targets[index];if(target===undefined)throw new Error('Missing contact row');
      if(Array.isArray(old)||!('data'in old))continue;
      const row=target.contacts;if(Array.isArray(row)||!('file'in row))throw new Error('Expected named contact loan');
      const {data,...metadata}=old,{file,...actual}=row,loan=files.get(file),bytes=base64Bytes(data);
      if(encodeCanonicalJson(metadata)!==encodeCanonicalJson(actual)||loan===undefined||loan.bytes.length!==bytes.length
        ||!loan.bytes.every((byte,at)=>byte===bytes[at]))throw new Error('Original contact bytes or metadata changed');
      used.add(file);target.contacts=old;
    }
    return nameBlob(blob.file.name??'', 'json',new TextEncoder().encode(encodeCanonicalJson(scene)),
      blob.file.jsonSchema===undefined?{}:{jsonSchema:blob.file.jsonSchema});
  });
  if(blobs.filter(row=>row.file.name?.startsWith('world/dressing-contacts/')).some(row=>!used.has(row.file.name??'')))throw new Error('Unvisited contact publication');
  return output;
}
