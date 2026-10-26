import { resolve } from 'node:path';
import * as v from 'valibot';
import speciesRows from '../data/speciesRows.json' with {type:'json'};
import admissionInput from '../behaviour/admission.generated.json' with { type: 'json' };
import SPECIES_LOOK_ROWS from '../data/speciesLooks.json' with { type: 'json' };
import strikes from '../data/strikeProfiles.generated.json' with { type: 'json' };
import kingPose from '../data/goldenKingPose.generated.json' with { type: 'json' };
import { inflateSync, deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileReturnProjectionV2 } from '@wildshard/sdk/returnProjectionV2';
import { readDecisionSources } from '@wildshard/sdk/buildDecisionScripts';
import { fileURLToPath } from 'node:url';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import bodyRows from '../data/bodies.json' with { type: 'json' };
import { SPECIES_POSES } from './speciesPoses.ts';
import { buildCracks } from './balbalCracks.ts';
import { CreatureGuestSchema } from '@wildshard/format/speciesBookRows';
import { wireProgram } from './returnProgramRows.ts';
import { actorProjection } from './actorProjection.ts';
import { packNalatiSpeciesBodies } from './speciesBodyPacking.ts';
import { prepareNalatiSpeciesLooks } from './speciesLookPreparation.ts';

const {compiled:_admissionCompiled,...admission}=admissionInput;
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
// 3,184 checked-in lines plus the five generated weak-point lines above.
const dual=await compileReturnProjectionV2(source,{fields:registry(fields),channels:registry(channels),signals:registry(signals)},authored,{asLineCeiling:3189});
const crackBody=bodyRows.bodies.find(row=>row.key.startsWith('balbal:'));
if(crackBody===undefined)throw new Error('Missing species program or skeleton');
const cracks=buildCracks(crackBody.bones);
const lanes=inflateSync(readFileSync(fileURLToPath(new URL('../../../../public/assets/nalati/baked/bodies.bin',import.meta.url)))),words=lanes.length/4,raw=new Uint8Array(lanes.length);
for(let i=0;i<words;i++)for(let byte=0;byte<4;byte++)raw[i*4+byte]=lanes[byte*words+i];
const {bytes:packedBytes,attrs,bodies:packed,skeletons,rows:compactRows}=packNalatiSpeciesBodies(bodyRows,raw);
const packedSize=packedBytes.length;
const compressed=deflateSync(packedBytes,{level:9});
const file=`/assets/nalati/baked/bodies-${createHash('sha256').update(compressed).digest('hex')}.bin`;
const packedBodies={file,bytes:packedSize,bodies:packed};
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
// One shared selected module; the unchanged ABI1 witness is a raw data dependency.
const selected=dual.binary;
const compiled={source:'behaviour/held-weapons.generated.wasm',bytes:selected.length,hash:dual.candidate.artifact.hash};
const program=wireProgram({...dual.legacy,bytes:'',v2:{...dual.candidate,bytes:''}});
const guest=v.parse(CreatureGuestSchema,{...speciesRows.balbalGuest,program,strike:strikes.balbal});
const lookBookRows=[];
for(const row of SPECIES_LOOK_ROWS)lookBookRows.push(row.metadata.kind===speciesRows.balbal.kind?{...row,projection:actorProjection(guest)}:row);
const presentation={packedBodies:compactBodies,poses:poseConfigs,guest,lookBook:{slug:'nalati-grasslands',rows:lookBookRows,program:wireProgram(admission)}};
const writer=byteWriter(process.argv.includes('--check'),'nalati-species');
writer.put(fileURLToPath(new URL('../behaviour/held-weapons.generated.wasm',import.meta.url)),selected);
writer.put(fileURLToPath(new URL('../behaviour/held-witness.generated.bin',import.meta.url)),dual.witness);
writer.put(fileURLToPath(new URL(`../../../../public${file}`,import.meta.url)),compressed);
const {hullBook,looks}=prepareNalatiSpeciesLooks(compactBodies,kingPose,crackRow);
writer.put(fileURLToPath(new URL('../data/species.generated.json',import.meta.url)),jsonBytes({packedBodies,poses:SPECIES_POSES,presentation,hullBook,looks,crackBytes:Array.from(crackBytes),program,compiled,witnessBytes:dual.witness.length}));
const {balbal,king,slam}=speciesRows;
writer.put(resolve(import.meta.dirname,'../boot/speciesRows.generated.json'),jsonBytes({balbal:{kind:balbal.kind},king:{kind:king.kind},slam}));
writer.finish();
