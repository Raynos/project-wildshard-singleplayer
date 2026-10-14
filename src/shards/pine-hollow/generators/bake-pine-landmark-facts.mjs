/** Static landmark questions, authored from the original renderer geometry and retained rows. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BEAR_CAVE } from '../data/layout.ts';

const root=resolve(import.meta.dirname,'../../../..');
async function hero(id,phone=false){
  const raw=readFileSync(resolve(root,`public/assets/models/pine-hollow-hero/${id}/${id}${phone?'.phone':''}.glb`)),length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length).toString());
  for(const key of ['images','textures','samplers'])delete doc[key];
  for(const material of doc.materials??[]){for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];if(material.pbrMetallicRoughness){delete material.pbrMetallicRoughness.baseColorTexture;delete material.pbrMetallicRoughness.metallicRoughnessTexture;}}
  const json=Buffer.from(JSON.stringify(doc)),text=Buffer.concat([json,Buffer.alloc((-json.length)&3,0x20)]),header=Buffer.from(raw.subarray(0,20)),rest=raw.subarray(20+length);header.writeUInt32LE(20+text.length+rest.length,8);header.writeUInt32LE(text.length,12);
  const bytes=Buffer.concat([header,text,rest]);await MeshoptDecoder.ready;
  const loaded=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');loaded.scene.updateMatrixWorld(true);
  const node=loaded.scene.getObjectByProperty('isMesh',true);if(!(node instanceof THREE.Mesh))throw new Error('Landmark source omitted first mesh');
  const geometry=node.geometry.clone(),position=geometry.getAttribute('position'),words=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++)for(let k=0;k<3;k++)words[i*3+k]=position.getComponent(i,k);
  geometry.setAttribute('position',new THREE.BufferAttribute(words,3));geometry.applyMatrix4(node.matrixWorld);geometry.computeBoundingBox();return geometry;
}
function same(a,b){const p=a.getAttribute('position'),q=b.getAttribute('position');if(p.count!==q.count||a.index?.count!==b.index?.count)throw new Error('Landmark tiers require separate facts');for(let i=0;i<p.count;i++)for(let k=0;k<3;k++)if(p.getComponent(i,k)!==q.getComponent(i,k))throw new Error('Landmark tier positions differ');for(let i=0;i<(a.index?.count??0);i++)if(a.index.getX(i)!==b.index.getX(i))throw new Error('Landmark tier indices differ');}
function lamp(g){const pos=g.getAttribute('position'),bb=g.boundingBox,h=bb.max.y-bb.min.y,v=new THREE.Vector3();let px=0,pz=0,pn=0,far=0,count=0;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(v.y<bb.min.y+h*.3){px+=v.x;pz+=v.z;pn++;}}px/=Math.max(1,pn);pz/=Math.max(1,pn);for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(v.y>bb.min.y+h*.5)far=Math.max(far,Math.hypot(v.x-px,v.z-pz));}const point=new THREE.Vector3();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(v.y>bb.min.y+h*.45&&Math.hypot(v.x-px,v.z-pz)>far*.7){point.add(v);count++;}}if(count===0)point.set(px,bb.min.y+h*.7,pz);else point.divideScalar(count);return point.toArray();}
function arch(g,m,floorY){const b=g.boundingBox,w=b.max.x-b.min.x,h=b.max.y-b.min.y,d=b.max.z-b.min.z,pos=g.getAttribute('position'),index=g.index,triangles=(index?.count??pos.count)/3,mask=new Uint8Array(Math.ceil(triangles/4)),c=Math.cos(BEAR_CAVE.rot),s=Math.sin(BEAR_CAVE.rot),v=new THREE.Vector3();
  for(let t=0;t<triangles;t++){let xs=0,zs=0,ys=0;for(let k=0;k<3;k++){v.fromBufferAttribute(pos,index?index.getX(t*3+k):t*3+k).applyMatrix4(m);const dx=v.x-BEAR_CAVE.x,dz=v.z-BEAR_CAVE.z;xs+=dx*c-dz*s;zs+=dx*s+dz*c;ys+=v.y;}if(Math.abs(xs/3)<2.6&&ys/3-floorY>-.3&&ys/3-floorY<4.8&&zs/3>-.6)mask[Math.floor(t/4)]|=1<<(t%4);}
  return {vertices:pos.count,triangles,excluded:[...mask].map(n=>n.toString(16)).join(''),dark:{w:w*.5,h:h*.72,x:0,y:h*.36,z:d*.05},boxes:[{x:-w*.36,y:h*.5,z:0,hx:w*.14,hy:h*.5,hz:d*.45},{x:w*.36,y:h*.5,z:0,hx:w*.14,hy:h*.5,hz:d*.45},{x:0,y:h*.86,z:0,hx:w*.5,hy:h*.14,hz:d*.45}],wall:{x:0,y:h*.4,z:-d*.1,hx:w*.24,hy:h*.4,hz:.3}};
}
/** No runtime world, controller or renderer service is installed by this producer. */
export async function pineLandmarkFacts(sites,placements,lookout,landing,bridge){
  const [stone,stonePhone,fine,finePhone,coarse]=await Promise.all([hero('waystone'),hero('waystone',true),hero('cave-arch'),hero('cave-arch',true),hero('cave-arch-lod1')]);same(stone,stonePhone);same(fine,finePhone);
  const a=fine.boundingBox.getCenter(new THREE.Vector3()),b=coarse.boundingBox.getCenter(new THREE.Vector3());coarse.translate(a.x-b.x,0,a.z-b.z);coarse.boundingBox.translate(new THREE.Vector3(a.x-b.x,0,a.z-b.z));
  const p=sites.arch,m=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch,p.yaw,p.roll,'YXZ')),new THREE.Vector3(p.scale,p.scale,p.scale));
  const world=(point,frame)=>new THREE.Vector3(...point).applyMatrix4(new THREE.Matrix4().fromArray(frame.matrix)).toArray();
  const floors=(row,frame)=>row.floors.map(f=>{const [x,y,z]=world([f.x,f.y,f.z],frame);return{x,z,y,rot:frame.yaw+f.rot,hw:f.hw,hd:f.hd};});
  const zip={top:world(lookout.anchors.zipTop,placements.lookout),launch:world(lookout.anchors.launch,placements.lookout),bottom:world(landing.anchors.zipBottom,placements.landing),landing:world(landing.anchors.landing,placements.landing)};
  const facts={lamp:lamp(stone),archShape:{fine:arch(fine,m,sites.archGround),coarse:arch(coarse,m,sites.archGround)},zip,timberFloors:{'pine-lookout':floors(lookout,placements.lookout),'pine-zip-landing':floors(landing,placements.landing),'pine-footbridge':floors(bridge,placements.bridge)}};
  for(const g of[stone,stonePhone,fine,finePhone,coarse])g.dispose();return facts;
}
