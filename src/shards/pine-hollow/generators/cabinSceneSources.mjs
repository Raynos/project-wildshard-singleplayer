/** Original cabin geometry and glTF hierarchy, decoded without a Node image host. */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import {Mesh} from 'three';
import {GeometryPack,packedRows} from '@wildshard/sdk/kit/geometryPack';
import {readSourceModel} from '@wildshard/sdk/bake/skinned';
import {pineCabinPropParts} from './cabinPropMaterials.mjs';
import {pineCabinPropShapes} from './cabinPropShapes.ts';
import {BakedPiece} from '@wildshard/sdk/bake';

const root=new URL('../../../../',import.meta.url),project=new URL('../',import.meta.url);
const readJson=url=>JSON.parse(readFileSync(url,'utf8'));
function pack(doc,bin){
 const json=Buffer.from(JSON.stringify(doc)),text=Buffer.concat([json,Buffer.alloc((-json.length)&3,0x20)]),binary=Buffer.concat([bin,Buffer.alloc((-bin.length)&3)]),header=Buffer.alloc(20),binaryHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+text.length+binary.length,8);header.writeUInt32LE(text.length,12);header.writeUInt32LE(0x4e4f534a,16);
 binaryHeader.writeUInt32LE(binary.length);binaryHeader.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,text,binaryHeader,binary]);
}
// SourceModel records embedded base-colour image bytes before stripping. These
// native glTFs use external images; remove references first, never rewrite any
// geometry buffer, material scalar, transform, node or primitive ordering.
function stripTextures(value){
 if(Array.isArray(value))return value.map(stripTextures);
 if(value===null||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([key,entry])=>!(key.endsWith('Texture')&&entry!==null&&typeof entry==='object')).map(([key,entry])=>[key,stripTextures(entry)]));
}
async function model(url){
 const input=new URL(`public${url}`,root),bytes=readFileSync(input);
 let doc,bin;
 if(url.endsWith('.glb')){
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw new Error('Cabin source GLB header differs');
  const size=bytes.readUInt32LE(12);doc=JSON.parse(bytes.subarray(20,20+size).toString());
  if(bytes.readUInt32LE(24+size)!==0x004e4942)throw new Error('Cabin source GLB binary absent');
  bin=bytes.subarray(28+size,28+size+bytes.readUInt32LE(20+size));
 }else{
  doc=JSON.parse(bytes.toString());
  if(doc.buffers.length!==1||typeof doc.buffers[0].uri!=='string')throw new Error('Cabin source buffer roster differs');
  bin=readFileSync(new URL(doc.buffers[0].uri,input));delete doc.buffers[0].uri;
 }
 const materials=doc.materials.map(stripTextures);
 doc={...doc,materials};delete doc.images;delete doc.textures;delete doc.samplers;
 for(const key of ['extensionsUsed','extensionsRequired'])if(doc[key]!==undefined)doc[key]=doc[key].filter(name=>!['EXT_texture_webp','KHR_texture_basisu','EXT_texture_avif'].includes(name));
 const loaded=await readSourceModel(pack(doc,bin));loaded.gltf.scene.updateMatrixWorld(true);
 const descriptors=[];
 loaded.gltf.scene.traverse(node=>{
  if(!(node instanceof Mesh))return;
  const part=descriptors.length;
  if(Array.isArray(node.material))throw new Error('Cabin source primitive has multiple materials');
  const materialId=loaded.gltf.parser.associations.get(node.material)?.materials;
  if(materialId===undefined)throw new Error('Cabin source omitted original material association');
  node.material.userData.cabinSource={url,part,material:materialId};
  descriptors.push({url,part,material:materialId,name:node.material.name});
 });
 return{scene:loaded.gltf.scene,descriptors,sourceHash:createHash('sha256').update(bytes).digest('hex')};
}
/** All shape data comes from the published native pack or original glTF buffers. */
export async function cabinSceneSources(tier){
 if(!['phone','desktop'].includes(tier))throw new Error('Cabin author tier differs');
 const rows=readJson(new URL('data/cabins.json',project)),packed=readFileSync(new URL('public/assets/pine-hollow/baked/cabins.bin',root)),bytes=Uint8Array.from(inflateSync(packed));
 if(createHash('sha256').update(bytes).digest('hex')!==rows.bin)throw new Error('Cabin native geometry pack hash differs');
 const geometryPack=new GeometryPack(bytes,packedRows(rows),'native cabin scene'),geometry=new Map();
 for(let i=0;i<rows.geometries.length;i++){
  const shape=geometryPack.geometry(i);
  if(shape.hasAttribute('moss')){shape.setAttribute('aMoss',shape.getAttribute('moss'));shape.deleteAttribute('moss');}
  geometry.set(i,shape);
 }
 const propsSource=await pineCabinPropParts(),piece=new BakedPiece('cabin-author-props',[],[]),propRows=pineCabinPropShapes(piece,propsSource),props={};
 const shipping=readJson(new URL('data/timberWorld.generated.json',project));
 for(const [kind,row]of Object.entries(propRows)){
  const node=piece.children.find(child=>child.name===row.name),native=shipping.cabinProps[kind];
  if(!(node instanceof Mesh)||JSON.stringify(row)!==JSON.stringify(native))throw new Error(`Cabin original prop metadata differs: ${kind}`);
  const partCount=propsSource[kind].length;if(partCount<1||partCount>16)throw new Error(`Cabin native prop part bound differs: ${kind}`);
  props[kind]={geometry:node.geometry,matrix:row.matrix,partCount};
 }
 const firePit=await model('/assets/models/stone_fire_pit/stone_fire_pit.gltf');
 const lantern=await model(`/assets/models/Lantern_01/Lantern_01_lod${tier==='phone'?'.phone':''}.glb`);
 return{tier,rows,geometry,props,firePit,lantern,inputFiles:[fileURLToPath(new URL('data/cabins.json',project)),fileURLToPath(new URL('public/assets/pine-hollow/baked/cabins.bin',root))]};
}
