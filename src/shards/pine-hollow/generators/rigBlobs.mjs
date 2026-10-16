// Split existing creature assets into admitted geometry and the exact KTX2 maps already shipped by bake-ktx2.
import {readFileSync} from 'node:fs';
import {PINE_HULLS} from '../data/creatureHulls.ts';
import {glbKtx2Key} from '../../../../scripts/ktx2-settings.mjs';
import {namedBlobOutput} from '../../../../scripts/named-blob-output.mjs';

const project=new URL('../',import.meta.url),root=new URL('../../../../',import.meta.url);
const read=url=>new Uint8Array(readFileSync(new URL(`public${url}`,root)));
const cache=JSON.parse(readFileSync(new URL('scripts/bake-ktx2.cache.json',root),'utf8'));
// Retained bake identity: extracting existing outputs does not require the encoder on build machines.
const encoder='v2.50.0';
function split(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=view.getUint32(12,true);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length||view.getUint32(16,true)!==0x4e4f534a||view.getUint32(24+length,true)!==0x004e4942||28+length+view.getUint32(20+length,true)!==bytes.length)throw new Error('Creature GLB chunks differ from the retained recipe');
 const doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)));
 if(!doc.buffers?.length||doc.buffers.some(buffer=>buffer.uri!==undefined))throw new Error('Creature GLB cannot use external buffers');
 return {doc,bin:bytes.subarray(28+length)};
}
function viewBytes(model,index){
 const view=model.doc.bufferViews[index];
 if(view?.buffer!==0||!Number.isSafeInteger(view.byteLength)||view.byteLength<0)throw new Error('Creature buffer view is missing');
 const offset=view.byteOffset??0;if(!Number.isSafeInteger(offset)||offset<0||offset+view.byteLength>model.bin.length)throw new Error('Creature buffer view exceeds BIN');
 return model.bin.subarray(offset,offset+view.byteLength);
}
function geometry(source){
 const {doc}=source,images=new Set((doc.images??[]).map(image=>image.bufferView));
 if(images.has(undefined))throw new Error('Creature image must be embedded');
 const remap=new Map(),chunks=[],placed=new Map();let size=0;
 const append=(offset,length)=>{
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>source.bin.length)throw new Error('Creature compressed range exceeds BIN');
  const key=`${offset}:${length}`,old=placed.get(key);if(old!==undefined)return old;
  const at=size,copy=new Uint8Array(Math.ceil(length/4)*4);copy.set(source.bin.subarray(offset,offset+length));chunks.push(copy);size+=copy.length;placed.set(key,at);return at;
 };
 let index=0;
 doc.bufferViews=doc.bufferViews.flatMap((view,oldIndex)=>{
  if(images.has(oldIndex))return [];
  remap.set(oldIndex,index++);
  const next={...view};
  if((view.buffer??0)===0)next.byteOffset=append(view.byteOffset??0,view.byteLength);
  const codec=view.extensions?.EXT_meshopt_compression;
  if(codec){if(codec.buffer!==0)throw new Error('Creature codec must use physical BIN');next.extensions={...view.extensions,EXT_meshopt_compression:{...codec,byteOffset:append(codec.byteOffset??0,codec.byteLength)}};}
  return [next];
 });
 for(const accessor of doc.accessors){const mapped=remap.get(accessor.bufferView);if(mapped===undefined)throw new Error('Creature image overlaps a geometry accessor');accessor.bufferView=mapped;}
 for(const material of doc.materials??[]){
  if(material.pbrMetallicRoughness)delete material.pbrMetallicRoughness.baseColorTexture;
  delete material.normalTexture;
  if(material.emissiveTexture||material.occlusionTexture||material.pbrMetallicRoughness?.metallicRoughnessTexture)throw new Error('Unexpected creature texture slot');
 }
 delete doc.images;delete doc.textures;delete doc.samplers;doc.buffers[0].byteLength=size;
 for(const key of ['extensionsUsed','extensionsRequired'])if(doc[key])doc[key]=doc[key].filter(name=>name!=='EXT_texture_webp'&&name!=='KHR_texture_basisu');
 const json=new TextEncoder().encode(JSON.stringify(doc)),padded=Math.ceil(json.length/4)*4,out=new Uint8Array(28+padded+size),header=new DataView(out.buffer);
 header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,out.length,true);header.setUint32(12,padded,true);header.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+padded);out.set(json,20);header.setUint32(20+padded,size,true);header.setUint32(24+padded,0x004e4942,true);
 let offset=28+padded;for(const bytes of chunks){out.set(bytes,offset);offset+=bytes.length;}return out;
}
function texture(model,slot){
 const material=model.doc.materials?.[0],index=slot==='base'?material?.pbrMetallicRoughness?.baseColorTexture?.index:material?.normalTexture?.index;
 const entry=model.doc.textures?.[index],image=model.doc.images?.[entry?.extensions?.KHR_texture_basisu?.source];
 if(image?.mimeType!=='image/ktx2')throw new Error(`Creature ${slot} map is not an existing KTX2 bake`);
 return viewBytes(model,image.bufferView);
}
const blobs=namedBlobOutput(project,'pine-rig-blob-inputs','assets/rig-blobs');
for(const tier of ['desktop','phone'])for(const hull of PINE_HULLS.rigs){
 const name=`${hull}${tier==='phone'?'.phone':''}`,url=`/assets/pine-hollow/creatures/${name}.rigged.glb`,bytes=read(url),encoded=cache[glbKtx2Key(bytes,encoder)];
 if(typeof encoded!=='string'||!encoded.startsWith('/assets/gpu/pine-hollow/creatures/'))throw new Error(`Missing existing creature KTX2 bake: ${url}`);
 const raw=split(bytes),baked=split(read(encoded));
 blobs.add(`models/creatures/${name}.base.ktx2`,'ktx2',texture(baked,'base'));
 blobs.add(`models/creatures/${name}.normal.ktx2`,'ktx2',texture(baked,'normal'));
 blobs.add(`models/creatures/${name}.rigged.glb`,'glb',geometry(raw),url);
}
blobs.finish(new URL('data/rigBlobs.generated.json',project));
