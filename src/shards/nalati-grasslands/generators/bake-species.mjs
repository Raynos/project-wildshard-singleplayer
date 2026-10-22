import { resolve } from 'node:path';
import * as v from 'valibot';
import speciesRows from '../data/speciesRows.json' with {type:'json'};
import admission from '../behaviour/admission.generated.json' with { type: 'json' };
import SPECIES_LOOK_ROWS from '../data/speciesLooks.json' with { type: 'json' };
import strikes from '../data/strikeProfiles.generated.json' with { type: 'json' };
import kingPose from '../data/goldenKingPose.generated.json' with { type: 'json' };
import { inflateSync, deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileDecisionScripts, readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import bodyRows from '../data/bodies.json' with { type: 'json' };
import { SPECIES_POSES } from './speciesPoses.ts';
import { buildCracks } from './balbalCracks.ts';
import { CreatureGuestSchema } from '@wildshard/format/speciesBookRows';
import { wireProgram } from './returnProgramRows.ts';

const authored=readDecisionSources(fileURLToPath(new URL('../',import.meta.url)));
// The existing weak-point row bounds move with their build-time admission.
const finite=v.pipe(v.number(),v.finite());
const weak=v.parse(v.pipe(v.array(v.tuple([finite,finite,finite])),v.maxLength(32)),speciesRows.weak);
const radius=v.parse(v.pipe(finite,v.minValue(0)),speciesRows.balbalGuest.radius);
const tests=weak.map(([x,y,z])=>`Math.sqrt((x-(${x}))*(x-(${x}))+(y-(${y}))*(y-(${y}))+(z-(${z}))*(z-(${z})))<${radius}`);
authored.set('behaviour/weakPoints.generated.as',`export function weakPoint(x:f64,y:f64,z:f64):bool{\n  return ${tests.join('\n    || ')||'false'};\n}\n`);
const text=['heldWeapons','balbal'].map(name=>authored.get(`behaviour/${name}.as`)).join('\n');
const names=prefix=>[...new Set([...text.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`,'g'))].map(match=>match[1]))];
const fields=names('Field'),channels=names('Channel'),signals=names('Signal');
const aliases=values=>Object.fromEntries(values.map(name=>[name,name]));
const registry=values=>new Map([...values].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const source={id:'nalati.held-weapons',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/heldWeapons.as',binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
const built=await compileDecisionScripts([source],{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:2837,singleSignal:true});
const script=built.rows.at(0),blob=built.blobs.at(0),crackBody=bodyRows.bodies.find(row=>row.key.startsWith('balbal:'));
if(script===undefined||blob===undefined||crackBody===undefined)throw new Error('Missing species program or skeleton');
const cracks=buildCracks(crackBody.bones);
const lanes=inflateSync(readFileSync(fileURLToPath(new URL('../../../../public/assets/nalati/baked/bodies.bin',import.meta.url)))),words=lanes.length/4,raw=new Uint8Array(lanes.length);
for(let i=0;i<words;i++)for(let byte=0;byte<4;byte++)raw[i*4+byte]=lanes[byte*words+i];
const attrs=[['position','f32',3,false],['normal','f32',3,false],['uv','f32',2,false],['color','f32',3,false],['skinIndex','u16',4,false],['skinWeight','f32',4,false],['furLen','f32',1,false]];
let offset=0;
const sourceParts=parts=>parts.map(([count,indexCount,...flat])=>{
  const offsets=attrs.map(([,type,size])=>{const at=offset,n=count*size*(type==='u16'?2:4);offset+=n+(4-n%4)%4;return at;});
  offsets.push(offset);const n=indexCount*2;offset+=n+(4-n%4)%4;
  const groups=[];for(let i=0;i<flat.length;i+=3)groups.push(flat.slice(i,i+3));
  return {offsets,groups,indexEncoding:'raw',row:{attrs,count,index:'u16',indexCount,box:false}};
});
const bodies=bodyRows.bodies.map(row=>({kind:row.key.split(':')[0],variant:row.key,bones:row.bones,dims:row.dims,fur:sourceParts(row.fur),hard:sourceParts(row.hard),eye:sourceParts(row.eye)}));
if(offset!==bodyRows.bytes)throw new Error('Creature body offsets do not cover the existing bake');
// A few horse fur lists exceed the host's 64-part limit. Pair adjacent parts
// offline, retaining typed vertex bytes, rebased indices and material groups.
let packedSize=0;const blocks=[];
const block=bytes=>{const at=packedSize,pad=(4-bytes.length%4)%4;blocks.push(bytes,new Uint8Array(pad));packedSize+=bytes.length+pad;return at;};
const pack=parts=>{
  const result=[];
  for(let i=0;i<parts.length;i+=parts.length>64?2:1){
    const group=parts.slice(i,i+(parts.length>64?2:1)),count=group.reduce((n,p)=>n+p.row.count,0),indexCount=group.reduce((n,p)=>n+p.row.indexCount,0);
    const offsets=attrs.map(([,type,width],a)=>block(Buffer.concat(group.map(p=>raw.slice(p.offsets[a],p.offsets[a]+p.row.count*width*(type==='u16'?2:4))))));
    const indices=count>65535?new Uint32Array(indexCount):new Uint16Array(indexCount);let vertex=0,index=0;const groups=[];
    for(const chunk of group){
      const start=chunk.offsets[attrs.length],view=new DataView(raw.buffer,raw.byteOffset+start,chunk.row.indexCount*2);
      for(let j=0;j<chunk.row.indexCount;j++)indices[index+j]=view.getUint16(j*2,true)+vertex;
      for(const [at,n,material] of chunk.groups)groups.push([at+index,n,material]);
      vertex+=chunk.row.count;index+=chunk.row.indexCount;
    }
    offsets.push(block(new Uint8Array(indices.buffer)));
    result.push({offsets,groups,indexEncoding:'raw',row:{attrs,count,index:count>65535?'u32':'u16',indexCount,box:false}});
  }
  return result;
};
const packed=bodies.map(entry=>({kind:entry.kind,variant:entry.variant,bones:entry.bones,dims:entry.dims,fur:pack(entry.fur),hard:pack(entry.hard),eye:pack(entry.eye)}));
const compressed=deflateSync(Buffer.concat(blocks),{level:9});
const file=`/assets/nalati/baked/bodies-${createHash('sha256').update(compressed).digest('hex')}.bin`;
const packedBodies={file,bytes:packedSize,bodies:packed};
const skeletons=[],skeletonKeys=new Map();
const compactRows=packed.map(body=>{
  const key=JSON.stringify([body.bones,body.dims]);let skeleton=skeletonKeys.get(key);
  if(skeleton===undefined){skeleton=skeletons.length;skeletonKeys.set(key,skeleton);skeletons.push({bones:body.bones,dims:body.dims});}
  const parts=rows=>rows.map(part=>[part.row.count,part.row.indexCount,part.offsets[0],part.groups,part.row.index]);
  return {kind:body.kind,variant:body.variant,skeleton,fur:parts(body.fur),hard:parts(body.hard),eye:parts(body.eye)};
});
const compactBodies={file,bytes:packedSize,attrs,skeletons,rows:compactRows};
const poseConfigs=Object.fromEntries(Object.entries(SPECIES_POSES).map(([key,{programs:_programs,...config}])=>[key,{...config,prefix:`pose.${key==='canidDead'?'canid-dead':key}.`}]));
const crackBlocks=[],crackAttrs=[];let crackSize=0;
for(const [name,attr] of Object.entries(cracks.attributes)){
  const type=attr.array instanceof Uint16Array?'u16':'f32';crackAttrs.push([name,type,attr.itemSize,false]);
  const bytes=new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength);crackBlocks.push(bytes);crackSize+=bytes.length;
}
const crackIndex=cracks.index;if(crackIndex===null)throw new Error('Missing crack triangles');
let last=0;const deltas=Int32Array.from(crackIndex.array,index=>{const delta=index-last;last=index;return delta;});crackBlocks.push(new Uint8Array(deltas.buffer));crackSize+=deltas.byteLength;
const crackBytes=new Uint8Array(crackSize);let crackAt=0;for(const bytes of crackBlocks){crackBytes.set(bytes,crackAt);crackAt+=bytes.length;}
const crackRow={attrs:crackAttrs,count:cracks.getAttribute('position').count,index:'u32',indexCount:crackIndex.count,box:false};
const program=wireProgram({script,bytes:Buffer.from(blob.bytes).toString('base64')});
const guest=v.parse(CreatureGuestSchema,{...speciesRows.balbalGuest,program,strike:strikes.balbal});
const presentation={packedBodies:compactBodies,poses:poseConfigs,guest,lookBook:{slug:'nalati-grasslands',rows:SPECIES_LOOK_ROWS,program:wireProgram(admission)}};
const writer=byteWriter(process.argv.includes('--check'),'nalati-species');
writer.put(fileURLToPath(new URL(`../../../../public${file}`,import.meta.url)),compressed);
// G600 L8: the looks are the hull book's packed looks (game/looks/speciesBook HullLookBook.packedLooks): the compact bodies
// as the book's section, each row its bodies, coats, painterly material, rigged hull skins and post-pose programmes
const hullBook={slug:'nalati-grasslands',compactBody:compactBodies,definitions:{},derived:{},rows:[]};
// each row built by assignment, in the same key order (the generated bytes are unchanged)
const lookRow=row=>{
  const variants={};
  for(const [id,variant] of Object.entries(row.variants)){
    const coat={body:variant.body};if(variant.tint!==undefined)coat.tint=variant.tint;if(variant.traits!==undefined)coat.traits=variant.traits;variants[id]=coat;
  }
  const look={id:row.id,species:row.metadata.id,kind:row.metadata.kind,family:row.family,skeleton:row.rigContract.skeleton,sockets:row.rigContract.sockets,
    clips:row.rigContract.clips,variants,material:{family:'painterly',rim:row.material.rim,bands:row.material.bands},hulls:true};
  if(row.rig!==undefined)look.rig=row.rig;if(row.pose!==undefined)look.stance=row.pose;if(row.gait!==undefined)look.gait=row.gait;
  if(row.eyeGlow!==undefined)look.eyeGlow=row.eyeGlow;if(row.eyeGlowIntensity!==undefined)look.eyeGlowIntensity=row.eyeGlowIntensity;
  if(row.postPose!==undefined)look.postPose=row.postPose;
  // G600 L8: the balbal's and the eagle's frames are their pose programmes; the balbal wears its glowing cracks (the
  // creature view module colours the 'balbal-cracks' part)
  if(row.metadata.kind==='balbal'||row.metadata.kind==='eagle')look.animate=row.metadata.kind;
  if(row.metadata.kind===speciesRows.king.kind)look.frame='king';
  if(row.metadata.kind==='balbal')look.attachments=[{name:'balbal-cracks',file:'actors/balbal-cracks.bin',colour:[1,.46,.1],geometry:crackRow}];
  return look;
};
// the Golden King's frame: his surface, observation and pose programmes (bake-kurgan) over his frame rows
const {kingFrame,kingPoseDefaults}=speciesRows;
const frames={king:{programs:kingPose.programs,surface:'king.surface',observe:kingFrame.group,pose:kingPose.group,look:kingFrame.look,
  smooth:kingFrame.smooth.map(({input,output,initial})=>({input,output,initial})),floor:{lift:kingFrame.floor.lift,death:kingFrame.floor.death},memory:kingPoseDefaults}};
const looks={poses:SPECIES_POSES,frames,rows:SPECIES_LOOK_ROWS.map(lookRow)};
writer.put(fileURLToPath(new URL('../data/species.generated.json',import.meta.url)),jsonBytes({packedBodies,poses:SPECIES_POSES,presentation,hullBook,looks,crackBytes:Array.from(crackBytes),program}));
const {balbal,king,slam}=speciesRows;
writer.put(resolve(import.meta.dirname,'../boot/speciesRows.generated.json'),jsonBytes({balbal:{kind:balbal.kind},king:{kind:king.kind},slam}));
writer.finish();
