/** One anatomy-first rigid-owner variant. No solver, fitting loop or runtime writes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {Vector3} from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
const sourceDir=new URL('../complete-character-next/',import.meta.url);
const out=new URL('./',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected={
 'build_iguana.py':'ede883698fc58f0c09f1691095cfb5f634b981707a2b8d36edabc5c716e51e79',
 'native-source.json':'3a8c1d134385720d2d77051c8a5aac138a25773cd01771ee6eedc304f5673171',
 'metadata.json':'b1dfd298135f609f01ad8195c242617073f0d184b79be6636bc1a0c961111b14',
 'payload.bin':'6f53f402e8574c985f87b95fe80bd5b98a445a2e221688686f1b1714ec17e219',
 'bloomthroat-iguana-complete-next.glb':'8f9337f5675a2692b01e097db4b5df813699bc21e9e403c88b441ed516472d43',
 'construction.json':'112b92d713721ac3362f96ce2257109b59b7efdfbfdd38a56d3c207e653d16c2',
};
for(const [name,pin]of Object.entries(expected))if(hash(readFileSync(new URL(name,sourceDir)))!==pin)throw Error(`Selected source changed: ${name}`);
const original=JSON.parse(readFileSync(new URL('native-source.json',sourceDir)));
const oldMeta=JSON.parse(readFileSync(new URL('metadata.json',sourceDir)));
const groups=[['body',['body']],['head',['neck','head','jaw']],['bloom0',Array.from({length:7},(_,i)=>`bloom${i}`)],['tail0',['tail']],...['legFL','legFR','legBL','legBR'].map(n=>[n,[n]])];
const findBone=n=>{const b=original.bones.find(b=>b.name===n);if(!b)throw Error(n);return structuredClone(b);};
const bones=groups.map(([name])=>{const b=findBone(name);if(name==='head'){b.parent='body';b.pos=findBone('neck').pos;}else if(name==='bloom0')b.parent='head';return b;});
const candidate=structuredClone(original);candidate.candidate='bloomthroat-iguana-eight-owner-candidate1';candidate.status='isolated source variant; no runtime or contact admission';candidate.bones=bones;
const mapping=[];
for(const p of candidate.parts){const owner=groups.find(([,names])=>names.includes(p.name))?.[0];if(owner===undefined)throw Error(`Unowned ${p.name}`);const boneIndex=bones.findIndex(b=>b.name===owner);const corners=p.positions.length/3;p.skinIndices=Array.from({length:corners},()=>[boneIndex,0,0,0]).flat();p.skinWeights=Array.from({length:corners},()=>[1,0,0,0]).flat();mapping.push({part:p.name,owner,boneIndex,triangles:corners/3,triangleRange:[0,corners/3-1],corners,assignment:'whole named anatomical component, not old influence magnitude'});}
const pointsFor=names=>candidate.parts.filter(p=>names.includes(p.name)).flatMap(p=>Array.from({length:p.positions.length/3},(_,i)=>new Vector3(...p.positions.slice(i*3,i*3+3).map(Math.fround))));
const budget=[];const provenance=[];
const parts=groups.map(([bone,names])=>{const points=pointsFor(names);const hull=new ConvexHull().setFromPoints(points);const extremes=new Map();for(const face of hull.faces){let e=face.edge;do{const v=e.head().point;extremes.set(v.toArray().join(','),v);e=e.next;}while(e!==face.edge);}
 const pivot=new Vector3(...bones.find(b=>b.name===bone).pos);const selected=[...extremes.values()];const local=selected.map(p=>p.clone().sub(pivot).toArray());
 budget.push({bone,sourceParts:names,sourceCorners:points.length,points:local.length});
 provenance.push({bone,extremes:selected.map(p=>({actorBind:p.toArray(),sourceCorner:points.findIndex(v=>v.equals(p))})),maxPlaneExcess:Math.max(...points.map(p=>Math.max(...hull.faces.map(f=>f.distanceToPoint(p)))))});
 return{bone,points:local};});
const total=parts.reduce((s,p)=>s+p.points.length,0);if(parts.length>8||parts.some(p=>p.points.length>128)||total>512)throw Error(`Budget refuses ${total}`);
// One descriptor from anatomy, never a parameter search. Trunk axis is the producer's first/last section centre.
const a=new Vector3(0,.63,-1.08),b=new Vector3(0,1.26,.82),axis=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);
const distanceSegment=(p,a,b)=>{const d=b.clone().sub(a);const t=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/d.lengthSq()));return p.distanceTo(a.clone().addScaledVector(d,t));};
const bodyPoints=pointsFor(['body']);const bodyRadius=Math.max(...bodyPoints.map(p=>distanceSegment(p,a,b)));
const headPoints=pointsFor(['neck','head','jaw']);const headPivot=new Vector3(...bones.find(b=>b.name==='head').pos);
// Cranio-cervical support sphere centred at its actual geometry bounds centre.
const bounds=ps=>{const lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);ps.forEach(p=>{lo.min(p);hi.max(p);});return{lo,hi,mid:lo.clone().add(hi).multiplyScalar(.5)};};
const headCentre=bounds(headPoints).mid;const headRadius=Math.max(...headPoints.map(p=>p.distanceTo(headCentre)));
// The transverse fore capsule belongs to the flower, not an invented longitudinal second torso.
const flowerPoints=pointsFor(groups[2][1]);const flower=bounds(flowerPoints),fa=flower.mid.clone(),fb=flower.mid.clone();fa.x=flower.lo.x;fb.x=flower.hi.x;
const fore={bone:'bloom0',at:flower.mid.clone().sub(new Vector3(...bones.find(b=>b.name==='bloom0').pos)).toArray(),halfLen:(flower.hi.x-flower.lo.x)/2,radius:Math.max(...flowerPoints.map(p=>distanceSegment(p,fa,fb)))};
const dims={...oldMeta.bodies[0].dims,bodyAt:mid.clone().sub(new Vector3(...bones[0].pos)).toArray(),bodyPitch:Math.atan2(axis.y,axis.z),bodyHalfLen:axis.length()/2,bodyRadius,headAt:headCentre.clone().sub(headPivot).toArray(),headRadius,fore,rigidCorpse:{parts}};
const attrs=[['position','f32',3,'positions'],['color','f32',3,'colorsLinear'],['skinIndex','u16',4,'skinIndices'],['skinWeight','f32',4,'skinWeights'],['furLen','f32',1,'furLen']];
const chunks=[];let byteLength=0;
const hard=candidate.parts.map(p=>{const offsets=[];for(const [,kind,,key]of attrs){offsets.push(byteLength);const buf=Buffer.alloc(p[key].length*(kind==='u16'?2:4));p[key].forEach((v,i)=>kind==='u16'?buf.writeUInt16LE(v,i*2):buf.writeFloatLE(v,i*4));chunks.push(buf);byteLength+=buf.length;const pad=Buffer.alloc((-byteLength%4+4)%4);chunks.push(pad);byteLength+=pad.length;}return{offsets,row:{attrs:attrs.map(([name,kind,width])=>[name,kind,width,false]),count:p.positions.length/3,index:null,indexCount:0,box:true}};});
const binary=deflateSync(Buffer.concat(chunks),{level:9});const metadata={file:`/assets/driftwood-isle/bloomthroat-iguana-eight-owner-${hash(binary)}.bin`,bytes:byteLength,bodies:[{kind:'bloomthroat-iguana',variant:'bloomthroat-iguana',bones,dims,fur:null,hard,eye:null}]};
const write=(name,data)=>writeFileSync(new URL(name,out),JSON.stringify(data,null,2)+'\n');
// Compact native source stays below repository JSON budget.
writeFileSync(new URL('native-source.json',out),JSON.stringify(candidate));write('metadata.json',metadata);writeFileSync(new URL('payload.bin',out),binary);
write('ownership.json',{source:'../complete-character-next',pins:expected,root:'unchanged ground actor root, metre +Y/+Z units',groups:mapping,budget,totalPoints:total,hullInput:'exact float32 positions consumed by native geometry; no padding, simplification or pose envelope',provenance,liveDescriptor:{torsoAxis:[a.toArray(),b.toArray()],headCentre:headCentre.toArray(),flowerAxis:[fa.toArray(),fb.toArray()],policy:'every triangle must be covered; no appendage exemption',definition:'one maximum over each anatomically named component; no search',unassignedOwners:['tail0','legFL','legFR','legBL','legBR']},runtimeAcceptance:false});
console.log(JSON.stringify({candidate:candidate.candidate,parts:parts.length,totalPoints:total,budget,sourcePins:expected,strictAdmission:'pending live coverage, never implied by structural budget'}));
